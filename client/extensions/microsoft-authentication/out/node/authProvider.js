"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MsalAuthProvider = void 0;
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const msal_node_1 = require("@azure/msal-node");
const vscode_1 = require("vscode");
const ms_rest_azure_env_1 = require("@azure/ms-rest-azure-env");
const publicClientCache_1 = require("./publicClientCache");
const loopbackClientAndOpener_1 = require("../common/loopbackClientAndOpener");
const loopbackTemplate_1 = require("./loopbackTemplate");
const scopeData_1 = require("../common/scopeData");
const event_1 = require("../common/event");
const betterSecretStorage_1 = require("../betterSecretStorage");
const redirectUri = 'https://vscode.dev/redirect';
const MSA_TID = '9188040d-6c67-4c5b-b112-36a304b66dad';
const MSA_PASSTHRU_TID = 'f8cdef31-a31e-4b4a-93e4-5f571e91255a';
class MsalAuthProvider {
    constructor(_context, _telemetryReporter, _logger, _uriHandler, _env = ms_rest_azure_env_1.Environment.AzureCloud) {
        this._context = _context;
        this._telemetryReporter = _telemetryReporter;
        this._logger = _logger;
        this._uriHandler = _uriHandler;
        this._env = _env;
        this._eventBufferer = new event_1.EventBufferer();
        /**
         * Event to signal a change in authentication sessions for this provider.
         */
        this._onDidChangeSessionsEmitter = new vscode_1.EventEmitter();
        /**
         * Event to signal a change in authentication sessions for this provider.
         *
         * NOTE: This event is handled differently in the Microsoft auth provider than "typical" auth providers. Normally,
         * this event would fire when the provider's sessions change... which are tied to a specific list of scopes. However,
         * since Microsoft identity doesn't care too much about scopes (you can mint a new token from an existing token),
         * we just fire this event whenever the account list changes... so essentially there is one session per account.
         *
         * This is not quite how the API should be used... but this event really is just for signaling that the account list
         * has changed.
         */
        this.onDidChangeSessions = this._onDidChangeSessionsEmitter.event;
        this._disposables = _context.subscriptions;
        this._publicClientManager = new publicClientCache_1.CachedPublicClientApplicationManager(_context.globalState, _context.secrets, this._logger, this._env.name);
        const accountChangeEvent = this._eventBufferer.wrapEvent(this._publicClientManager.onDidAccountsChange, (last, newEvent) => {
            if (!last) {
                return newEvent;
            }
            const mergedEvent = {
                added: [...(last.added ?? []), ...(newEvent.added ?? [])],
                deleted: [...(last.deleted ?? []), ...(newEvent.deleted ?? [])],
                changed: [...(last.changed ?? []), ...(newEvent.changed ?? [])]
            };
            const dedupedEvent = {
                added: Array.from(new Map(mergedEvent.added.map(item => [item.username, item])).values()),
                deleted: Array.from(new Map(mergedEvent.deleted.map(item => [item.username, item])).values()),
                changed: Array.from(new Map(mergedEvent.changed.map(item => [item.username, item])).values())
            };
            return dedupedEvent;
        }, { added: new Array(), deleted: new Array(), changed: new Array() })(e => this._handleAccountChange(e));
        this._disposables.push(this._onDidChangeSessionsEmitter, this._publicClientManager, accountChangeEvent);
    }
    /**
     * Migrate sessions from the old secret storage to MSAL.
     * TODO: MSAL Migration. Remove this when we remove the old flow.
     */
    async _migrateSessions() {
        const betterSecretStorage = new betterSecretStorage_1.BetterTokenStorage('microsoft.login.keylist', this._context);
        const sessions = await betterSecretStorage.getAll(item => {
            item.endpoint || (item.endpoint = ms_rest_azure_env_1.Environment.AzureCloud.activeDirectoryEndpointUrl);
            return item.endpoint === this._env.activeDirectoryEndpointUrl;
        });
        this._context.globalState.update('msalMigration', true);
        const clientTenantMap = new Map();
        for (const session of sessions) {
            const scopeData = new scopeData_1.ScopeData(session.scope.split(' '));
            const key = `${scopeData.clientId}:${scopeData.tenant}`;
            if (!clientTenantMap.has(key)) {
                clientTenantMap.set(key, { clientId: scopeData.clientId, tenant: scopeData.tenant, refreshTokens: [] });
            }
            clientTenantMap.get(key).refreshTokens.push(session.refreshToken);
        }
        for (const { clientId, tenant, refreshTokens } of clientTenantMap.values()) {
            await this.getOrCreatePublicClientApplication(clientId, tenant, refreshTokens);
        }
    }
    async initialize() {
        await this._eventBufferer.bufferEventsAsync(() => this._publicClientManager.initialize());
        if (!this._context.globalState.get('msalMigration', false)) {
            await this._migrateSessions();
        }
        // Send telemetry for existing accounts
        for (const cachedPca of this._publicClientManager.getAll()) {
            for (const account of cachedPca.accounts) {
                if (!account.idTokenClaims?.tid) {
                    continue;
                }
                const tid = account.idTokenClaims.tid;
                const type = tid === MSA_TID || tid === MSA_PASSTHRU_TID ? "msa" /* MicrosoftAccountType.MSA */ : "aad" /* MicrosoftAccountType.AAD */;
                this._telemetryReporter.sendAccountEvent([], type);
            }
        }
    }
    /**
     * See {@link onDidChangeSessions} for more information on how this is used.
     * @param param0 Event that contains the added and removed accounts
     */
    _handleAccountChange({ added, changed, deleted }) {
        this._logger.debug(`[_handleAccountChange] added: ${added.length}, changed: ${changed.length}, deleted: ${deleted.length}`);
        this._onDidChangeSessionsEmitter.fire({
            added: added.map(this.sessionFromAccountInfo),
            changed: changed.map(this.sessionFromAccountInfo),
            removed: deleted.map(this.sessionFromAccountInfo)
        });
    }
    //#region AuthenticationProvider methods
    async getSessions(scopes, options) {
        const askingForAll = scopes === undefined;
        const scopeData = new scopeData_1.ScopeData(scopes);
        // Do NOT use `scopes` beyond this place in the code. Use `scopeData` instead.
        this._logger.info('[getSessions]', askingForAll ? '[all]' : `[${scopeData.scopeStr}]`, 'starting');
        // This branch only gets called by Core for sign out purposes and initial population of the account menu. Since we are
        // living in a world where a "session" from Core's perspective is an account, we return 1 session per account.
        // See the large comment on `onDidChangeSessions` for more information.
        if (askingForAll) {
            const allSessionsForAccounts = new Map();
            for (const cachedPca of this._publicClientManager.getAll()) {
                for (const account of cachedPca.accounts) {
                    if (allSessionsForAccounts.has(account.homeAccountId)) {
                        continue;
                    }
                    allSessionsForAccounts.set(account.homeAccountId, this.sessionFromAccountInfo(account));
                }
            }
            const allSessions = Array.from(allSessionsForAccounts.values());
            this._logger.info('[getSessions] [all]', `returned ${allSessions.length} session(s)`);
            return allSessions;
        }
        const cachedPca = await this.getOrCreatePublicClientApplication(scopeData.clientId, scopeData.tenant);
        const sessions = await this.getAllSessionsForPca(cachedPca, scopeData.originalScopes, scopeData.scopesToSend, options?.account);
        this._logger.info(`[getSessions] [${scopeData.scopeStr}] returned ${sessions.length} session(s)`);
        return sessions;
    }
    async createSession(scopes, options) {
        const scopeData = new scopeData_1.ScopeData(scopes);
        // Do NOT use `scopes` beyond this place in the code. Use `scopeData` instead.
        this._logger.info('[createSession]', `[${scopeData.scopeStr}]`, 'starting');
        const cachedPca = await this.getOrCreatePublicClientApplication(scopeData.clientId, scopeData.tenant);
        let result;
        try {
            const windowHandle = vscode_1.env.handle ? Buffer.from(vscode_1.env.handle, 'base64') : undefined;
            result = await cachedPca.acquireTokenInteractive({
                openBrowser: async (url) => { await vscode_1.env.openExternal(vscode_1.Uri.parse(url)); },
                scopes: scopeData.scopesToSend,
                // The logic for rendering one or the other of these templates is in the
                // template itself, so we pass the same one for both.
                successTemplate: loopbackTemplate_1.loopbackTemplate,
                errorTemplate: loopbackTemplate_1.loopbackTemplate,
                // Pass the label of the account to the login hint so that we prefer signing in to that account
                loginHint: options.account?.label,
                // If we aren't logging in to a specific account, then we can use the prompt to make sure they get
                // the option to choose a different account.
                prompt: options.account?.label ? undefined : 'select_account',
                windowHandle
            });
        }
        catch (e) {
            if (e instanceof vscode_1.CancellationError) {
                const yes = vscode_1.l10n.t('Yes');
                const result = await vscode_1.window.showErrorMessage(vscode_1.l10n.t('Having trouble logging in?'), {
                    modal: true,
                    detail: vscode_1.l10n.t('Would you like to try a different way to sign in to your Microsoft account? ({0})', 'protocol handler')
                }, yes);
                if (!result) {
                    this._telemetryReporter.sendLoginFailedEvent();
                    throw e;
                }
            }
            // This error comes from the backend and is likely not due to the user's machine
            // failing to open a port or something local that would require us to try the
            // URL handler loopback client.
            if (e instanceof msal_node_1.ServerError) {
                this._telemetryReporter.sendLoginFailedEvent();
                throw e;
            }
            // The user wants to try the loopback client or we got an error likely due to spinning up the server
            const loopbackClient = new loopbackClientAndOpener_1.UriHandlerLoopbackClient(this._uriHandler, redirectUri, this._logger);
            try {
                const windowHandle = vscode_1.env.handle ? Buffer.from(vscode_1.env.handle) : undefined;
                result = await cachedPca.acquireTokenInteractive({
                    openBrowser: (url) => loopbackClient.openBrowser(url),
                    scopes: scopeData.scopesToSend,
                    loopbackClient,
                    loginHint: options.account?.label,
                    prompt: options.account?.label ? undefined : 'select_account',
                    windowHandle
                });
            }
            catch (e) {
                this._telemetryReporter.sendLoginFailedEvent();
                throw e;
            }
        }
        if (!result) {
            this._telemetryReporter.sendLoginFailedEvent();
            throw new Error('No result returned from MSAL');
        }
        const session = this.sessionFromAuthenticationResult(result, scopeData.originalScopes);
        this._telemetryReporter.sendLoginEvent(session.scopes);
        this._logger.info('[createSession]', `[${scopeData.scopeStr}]`, 'returned session');
        // This is the only scenario in which we need to fire the _onDidChangeSessionsEmitter out of band...
        // the badge flow (when the client passes no options in to getSession) will only remove a badge if a session
        // was created that _matches the scopes_ that that badge requests. See `onDidChangeSessions` for more info.
        // TODO: This should really be fixed in Core.
        this._onDidChangeSessionsEmitter.fire({ added: [session], changed: [], removed: [] });
        return session;
    }
    async removeSession(sessionId) {
        this._logger.info('[removeSession]', sessionId, 'starting');
        const promises = new Array();
        for (const cachedPca of this._publicClientManager.getAll()) {
            const accounts = cachedPca.accounts;
            for (const account of accounts) {
                if (account.homeAccountId === sessionId) {
                    this._telemetryReporter.sendLogoutEvent();
                    promises.push(cachedPca.removeAccount(account));
                    this._logger.info(`[removeSession] [${sessionId}] [${cachedPca.clientId}] [${cachedPca.authority}] removing session...`);
                }
            }
        }
        if (!promises.length) {
            this._logger.info('[removeSession]', sessionId, 'session not found');
            return;
        }
        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'rejected') {
                this._telemetryReporter.sendLogoutFailedEvent();
                this._logger.error('[removeSession]', sessionId, 'error removing session', result.reason);
            }
        }
        this._logger.info('[removeSession]', sessionId, `attempted to remove ${promises.length} sessions`);
    }
    //#endregion
    async getOrCreatePublicClientApplication(clientId, tenant, refreshTokensToMigrate) {
        const authority = new URL(tenant, this._env.activeDirectoryEndpointUrl).toString();
        return await this._publicClientManager.getOrCreate(clientId, authority, refreshTokensToMigrate);
    }
    async getAllSessionsForPca(cachedPca, originalScopes, scopesToSend, accountFilter) {
        const accounts = accountFilter
            ? cachedPca.accounts.filter(a => a.homeAccountId === accountFilter.id)
            : cachedPca.accounts;
        const sessions = [];
        return this._eventBufferer.bufferEventsAsync(async () => {
            for (const account of accounts) {
                try {
                    const result = await cachedPca.acquireTokenSilent({ account, scopes: scopesToSend, redirectUri });
                    sessions.push(this.sessionFromAuthenticationResult(result, originalScopes));
                }
                catch (e) {
                    // If we can't get a token silently, the account is probably in a bad state so we should skip it
                    // MSAL will log this already, so we don't need to log it again
                    continue;
                }
            }
            return sessions;
        });
    }
    sessionFromAuthenticationResult(result, scopes) {
        return {
            accessToken: result.accessToken,
            idToken: result.idToken,
            id: result.account?.homeAccountId ?? result.uniqueId,
            account: {
                id: result.account?.homeAccountId ?? result.uniqueId,
                label: result.account?.username ?? 'Unknown',
            },
            scopes
        };
    }
    sessionFromAccountInfo(account) {
        return {
            accessToken: '1234',
            id: account.homeAccountId,
            scopes: [],
            account: {
                id: account.homeAccountId,
                label: account.username
            },
            idToken: account.idToken,
        };
    }
}
exports.MsalAuthProvider = MsalAuthProvider;
//# sourceMappingURL=authProvider.js.map