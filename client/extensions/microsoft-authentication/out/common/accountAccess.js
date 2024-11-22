"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessSecretStorage = exports.ScopedAccountAccess = void 0;
const vscode_1 = require("vscode");
class ScopedAccountAccess {
    constructor(_secretStorage, _cloudName, _clientId, _authority) {
        this._secretStorage = _secretStorage;
        this._cloudName = _cloudName;
        this._clientId = _clientId;
        this._authority = _authority;
        this._onDidAccountAccessChangeEmitter = new vscode_1.EventEmitter();
        this.onDidAccountAccessChange = this._onDidAccountAccessChangeEmitter.event;
        this.value = new Array();
        this._accountAccessSecretStorage = new AccountAccessSecretStorage(this._secretStorage, this._cloudName, this._clientId, this._authority);
        this._accountAccessSecretStorage.onDidChange(() => this.update());
    }
    initialize() {
        return this.update();
    }
    isAllowedAccess(account) {
        return this.value.includes(account.homeAccountId);
    }
    async setAllowedAccess(account, allowed) {
        if (allowed) {
            if (this.value.includes(account.homeAccountId)) {
                return;
            }
            await this._accountAccessSecretStorage.store([...this.value, account.homeAccountId]);
            return;
        }
        await this._accountAccessSecretStorage.store(this.value.filter(id => id !== account.homeAccountId));
    }
    async update() {
        const current = new Set(this.value);
        const value = await this._accountAccessSecretStorage.get();
        this.value = value ?? [];
        if (current.size !== this.value.length || !this.value.every(id => current.has(id))) {
            this._onDidAccountAccessChangeEmitter.fire();
        }
    }
}
exports.ScopedAccountAccess = ScopedAccountAccess;
class AccountAccessSecretStorage {
    constructor(_secretStorage, _cloudName, _clientId, _authority) {
        this._secretStorage = _secretStorage;
        this._cloudName = _cloudName;
        this._clientId = _clientId;
        this._authority = _authority;
        this._onDidChangeEmitter = new vscode_1.EventEmitter;
        this.onDidChange = this._onDidChangeEmitter.event;
        this._key = `accounts-${this._cloudName}-${this._clientId}-${this._authority}`;
        this._disposable = vscode_1.Disposable.from(this._onDidChangeEmitter, this._secretStorage.onDidChange(e => {
            if (e.key === this._key) {
                this._onDidChangeEmitter.fire();
            }
        }));
    }
    async get() {
        const value = await this._secretStorage.get(this._key);
        if (!value) {
            return undefined;
        }
        return JSON.parse(value);
    }
    store(value) {
        return this._secretStorage.store(this._key, JSON.stringify(value));
    }
    delete() {
        return this._secretStorage.delete(this._key);
    }
    dispose() {
        this._disposable.dispose();
    }
}
exports.AccountAccessSecretStorage = AccountAccessSecretStorage;
//# sourceMappingURL=accountAccess.js.map