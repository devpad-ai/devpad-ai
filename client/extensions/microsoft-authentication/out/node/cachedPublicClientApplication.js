"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sequencer = exports.CachedPublicClientApplication = void 0;
const msal_node_1 = require("@azure/msal-node");
const msal_node_extensions_1 = require("@azure/msal-node-extensions");
const vscode_1 = require("vscode");
const async_1 = require("../common/async");
const cachePlugin_1 = require("../common/cachePlugin");
const loggerOptions_1 = require("../common/loggerOptions");
const accountAccess_1 = require("../common/accountAccess");
class CachedPublicClientApplication {
    //#endregion
    constructor(_clientId, _authority, _cloudName, _globalMemento, _secretStorage, _logger) {
        this._clientId = _clientId;
        this._authority = _authority;
        this._cloudName = _cloudName;
        this._globalMemento = _globalMemento;
        this._secretStorage = _secretStorage;
        this._logger = _logger;
        this._sequencer = new Sequencer();
        this._refreshDelayer = new DelayerByKey();
        this._accounts = [];
        this._loggerOptions = new loggerOptions_1.MsalLoggerOptions(this._logger);
        this._secretStorageCachePlugin = new cachePlugin_1.SecretStorageCachePlugin(this._secretStorage, 
        // Include the prefix as a differentiator to other secrets
        `pca:${JSON.stringify({ clientId: this._clientId, authority: this._authority })}`);
        this._accountAccess = new accountAccess_1.ScopedAccountAccess(this._secretStorage, this._cloudName, this._clientId, this._authority);
        this._config = {
            auth: { clientId: this._clientId, authority: this._authority },
            system: {
                loggerOptions: {
                    correlationId: `${this._clientId}] [${this._authority}`,
                    loggerCallback: (level, message, containsPii) => this._loggerOptions.loggerCallback(level, message, containsPii),
                    logLevel: msal_node_1.LogLevel.Info
                }
            },
            broker: {
                nativeBrokerPlugin: new msal_node_extensions_1.NativeBrokerPlugin()
            },
            cache: {
                cachePlugin: this._secretStorageCachePlugin
            }
        };
        this._isBrokerAvailable = this._config.broker?.nativeBrokerPlugin?.isBrokerAvailable ?? false;
        //#region Events
        this._onDidAccountsChangeEmitter = new vscode_1.EventEmitter;
        this.onDidAccountsChange = this._onDidAccountsChangeEmitter.event;
        this._onDidRemoveLastAccountEmitter = new vscode_1.EventEmitter();
        this.onDidRemoveLastAccount = this._onDidRemoveLastAccountEmitter.event;
        this._lastSeen = new Map();
        this._pca = new msal_node_1.PublicClientApplication(this._config);
        this._lastCreated = new Date();
        this._disposable = vscode_1.Disposable.from(this._registerOnSecretStorageChanged(), this._onDidAccountsChangeEmitter, this._onDidRemoveLastAccountEmitter);
    }
    get accounts() { return this._accounts; }
    get clientId() { return this._clientId; }
    get authority() { return this._authority; }
    async initialize() {
        if (this._isBrokerAvailable) {
            await this._accountAccess.initialize();
        }
        await this._update();
    }
    dispose() {
        this._disposable.dispose();
    }
    async acquireTokenSilent(request) {
        this._logger.debug(`[acquireTokenSilent] [${this._clientId}] [${this._authority}] [${request.scopes.join(' ')}] [${request.account.username}] starting...`);
        const result = await this._sequencer.queue(() => this._pca.acquireTokenSilent(request));
        this._logger.debug(`[acquireTokenSilent] [${this._clientId}] [${this._authority}] [${request.scopes.join(' ')}] [${request.account.username}] got result`);
        if (result.account && !result.fromCache && this._verifyIfUsingBroker(result)) {
            this._logger.debug(`[acquireTokenSilent] [${this._clientId}] [${this._authority}] [${request.scopes.join(' ')}] [${request.account.username}] firing event due to change`);
            this._setupRefresh(result);
            this._onDidAccountsChangeEmitter.fire({ added: [], changed: [result.account], deleted: [] });
        }
        return result;
    }
    async acquireTokenInteractive(request) {
        this._logger.debug(`[acquireTokenInteractive] [${this._clientId}] [${this._authority}] [${request.scopes?.join(' ')}] loopbackClientOverride: ${request.loopbackClient ? 'true' : 'false'}`);
        const result = await vscode_1.window.withProgress({
            location: vscode_1.ProgressLocation.Notification,
            cancellable: true,
            title: vscode_1.l10n.t('Signing in to Microsoft...')
        }, (_process, token) => (0, async_1.raceCancellationAndTimeoutError)(this._pca.acquireTokenInteractive(request), token, 1000 * 60 * 5));
        this._setupRefresh(result);
        if (this._isBrokerAvailable) {
            await this._accountAccess.setAllowedAccess(result.account, true);
        }
        return result;
    }
    /**
     * Allows for passing in a refresh token to get a new access token. This is the migration scenario.
     * TODO: MSAL Migration. Remove this when we remove the old flow.
     * @param request a {@link RefreshTokenRequest} object that contains the refresh token and other parameters.
     * @returns an {@link AuthenticationResult} object that contains the result of the token acquisition operation.
     */
    async acquireTokenByRefreshToken(request) {
        this._logger.debug(`[acquireTokenByRefreshToken] [${this._clientId}] [${this._authority}] [${request.scopes.join(' ')}]`);
        const result = await this._pca.acquireTokenByRefreshToken(request);
        if (result) {
            this._setupRefresh(result);
            if (this._isBrokerAvailable && result.account) {
                await this._accountAccess.setAllowedAccess(result.account, true);
            }
        }
        return result;
    }
    removeAccount(account) {
        this._globalMemento.update(`lastRemoval:${this._clientId}:${this._authority}`, new Date());
        if (this._isBrokerAvailable) {
            return this._accountAccess.setAllowedAccess(account, false);
        }
        return this._pca.getTokenCache().removeAccount(account);
    }
    _registerOnSecretStorageChanged() {
        if (this._isBrokerAvailable) {
            return this._accountAccess.onDidAccountAccessChange(() => this._update());
        }
        return this._secretStorageCachePlugin.onDidChange(() => this._update());
    }
    _verifyIfUsingBroker(result) {
        // If we're not brokering, we don't need to verify the date
        // the cache check will be sufficient
        if (!result.fromNativeBroker) {
            return true;
        }
        const key = result.account.homeAccountId;
        const lastSeen = this._lastSeen.get(key);
        const lastTimeAuthed = result.account.idTokenClaims.iat;
        if (!lastSeen) {
            this._lastSeen.set(key, lastTimeAuthed);
            return true;
        }
        if (lastSeen === lastTimeAuthed) {
            return false;
        }
        this._lastSeen.set(key, lastTimeAuthed);
        return true;
    }
    async _update() {
        const before = this._accounts;
        this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication update before: ${before.length}`);
        // Dates are stored as strings in the memento
        const lastRemovalDate = this._globalMemento.get(`lastRemoval:${this._clientId}:${this._authority}`);
        if (lastRemovalDate && this._lastCreated && Date.parse(lastRemovalDate) > this._lastCreated.getTime()) {
            this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication removal detected... recreating PCA...`);
            this._pca = new msal_node_1.PublicClientApplication(this._config);
            this._lastCreated = new Date();
        }
        let after = await this._pca.getAllAccounts();
        if (this._isBrokerAvailable) {
            after = after.filter(a => this._accountAccess.isAllowedAccess(a));
        }
        this._accounts = after;
        this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication update after: ${after.length}`);
        const beforeSet = new Set(before.map(b => b.homeAccountId));
        const afterSet = new Set(after.map(a => a.homeAccountId));
        const added = after.filter(a => !beforeSet.has(a.homeAccountId));
        const deleted = before.filter(b => !afterSet.has(b.homeAccountId));
        if (added.length > 0 || deleted.length > 0) {
            this._onDidAccountsChangeEmitter.fire({ added, changed: [], deleted });
            this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication accounts changed. added: ${added.length}, deleted: ${deleted.length}`);
            if (!after.length) {
                this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication final account deleted. Firing event.`);
                this._onDidRemoveLastAccountEmitter.fire();
            }
        }
        this._logger.debug(`[update] [${this._clientId}] [${this._authority}] CachedPublicClientApplication update complete`);
    }
    _setupRefresh(result) {
        const on = result.refreshOn || result.expiresOn;
        if (!result.account || !on) {
            return;
        }
        const account = result.account;
        const scopes = result.scopes;
        const timeToRefresh = on.getTime() - Date.now() - 5 * 60 * 1000; // 5 minutes before expiry
        const key = JSON.stringify({ accountId: account.homeAccountId, scopes });
        this._logger.debug(`[_setupRefresh] [${this._clientId}] [${this._authority}] [${scopes.join(' ')}] [${account.username}] timeToRefresh: ${timeToRefresh}`);
        this._refreshDelayer.trigger(key, () => this.acquireTokenSilent({ account, scopes, redirectUri: 'https://vscode.dev/redirect', forceRefresh: true }), timeToRefresh > 0 ? timeToRefresh : 0);
    }
}
exports.CachedPublicClientApplication = CachedPublicClientApplication;
class Sequencer {
    constructor() {
        this.current = Promise.resolve(null);
    }
    queue(promiseTask) {
        return this.current = this.current.then(() => promiseTask(), () => promiseTask());
    }
}
exports.Sequencer = Sequencer;
class DelayerByKey {
    constructor() {
        this._delayers = new Map();
    }
    trigger(key, fn, delay) {
        let delayer = this._delayers.get(key);
        if (!delayer) {
            delayer = new async_1.Delayer(delay);
            this._delayers.set(key, delayer);
        }
        return delayer.trigger(fn, delay);
    }
}
//# sourceMappingURL=cachedPublicClientApplication.js.map