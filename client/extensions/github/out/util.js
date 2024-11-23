"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisposableStore = void 0;
exports.getRepositoryFromUrl = getRepositoryFromUrl;
exports.getRepositoryFromQuery = getRepositoryFromQuery;
exports.repositoryHasGitHubRemote = repositoryHasGitHubRemote;
class DisposableStore {
    constructor() {
        this.disposables = new Set();
    }
    add(disposable) {
        this.disposables.add(disposable);
    }
    dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.clear();
    }
}
exports.DisposableStore = DisposableStore;
function getRepositoryFromUrl(url) {
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/i.exec(url)
        || /^git@github\.com:([^/]+)\/([^/]+?)(\.git)?$/i.exec(url);
    return match ? { owner: match[1], repo: match[2] } : undefined;
}
function getRepositoryFromQuery(query) {
    const match = /^([^/]+)\/([^/]+)$/i.exec(query);
    return match ? { owner: match[1], repo: match[2] } : undefined;
}
function repositoryHasGitHubRemote(repository) {
    return !!repository.state.remotes.find(remote => remote.fetchUrl ? getRepositoryFromUrl(remote.fetchUrl) : undefined);
}
//# sourceMappingURL=util.js.map