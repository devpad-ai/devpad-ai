"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitBlameController = void 0;
const vscode_1 = require("vscode");
const util_1 = require("./util");
const decorators_1 = require("./decorators");
const notCommittedYetId = '0000000000000000000000000000000000000000';
function isLineChanged(lineNumber, changes) {
    for (const change of changes) {
        // If the change is a delete, skip it
        if (change.kind === vscode_1.TextEditorChangeKind.Deletion) {
            continue;
        }
        const startLineNumber = change.modifiedStartLineNumber;
        const endLineNumber = change.modifiedEndLineNumber || startLineNumber;
        if (lineNumber >= startLineNumber && lineNumber <= endLineNumber) {
            return true;
        }
    }
    return false;
}
function mapLineNumber(lineNumber, changes) {
    if (changes.length === 0) {
        return lineNumber;
    }
    for (const change of changes) {
        // Line number is before the change so there is not need to process further
        if ((change.kind === vscode_1.TextEditorChangeKind.Addition && lineNumber < change.modifiedStartLineNumber) ||
            (change.kind === vscode_1.TextEditorChangeKind.Modification && lineNumber < change.modifiedStartLineNumber) ||
            (change.kind === vscode_1.TextEditorChangeKind.Deletion && lineNumber < change.originalStartLineNumber)) {
            break;
        }
        // Map line number to the original line number
        if (change.kind === vscode_1.TextEditorChangeKind.Addition) {
            // Addition
            lineNumber = lineNumber - (change.modifiedEndLineNumber - change.originalStartLineNumber);
        }
        else if (change.kind === vscode_1.TextEditorChangeKind.Deletion) {
            // Deletion
            lineNumber = lineNumber + (change.originalEndLineNumber - change.originalStartLineNumber) + 1;
        }
        else if (change.kind === vscode_1.TextEditorChangeKind.Modification) {
            // Modification
            const originalLineCount = change.originalEndLineNumber - change.originalStartLineNumber + 1;
            const modifiedLineCount = change.modifiedEndLineNumber - change.modifiedStartLineNumber + 1;
            if (originalLineCount !== modifiedLineCount) {
                lineNumber = lineNumber - (modifiedLineCount - originalLineCount);
            }
        }
        else {
            throw new Error('Unexpected change kind');
        }
    }
    return lineNumber;
}
function processTextEditorChangesWithBlameInformation(blameInformation, changes) {
    const [notYetCommittedBlameInformation] = blameInformation.filter(b => b.id === notCommittedYetId);
    if (!notYetCommittedBlameInformation) {
        return [...changes];
    }
    const changesWithBlameInformation = [];
    for (const change of changes) {
        const originalStartLineNumber = mapLineNumber(change.originalStartLineNumber, changes);
        const originalEndLineNumber = mapLineNumber(change.originalEndLineNumber, changes);
        if (notYetCommittedBlameInformation.ranges.some(range => range.startLineNumber === originalStartLineNumber && range.endLineNumber === originalEndLineNumber)) {
            continue;
        }
        changesWithBlameInformation.push(change);
    }
    return changesWithBlameInformation;
}
class GitBlameController {
    constructor(_model) {
        this._model = _model;
        this._onDidChangeBlameInformation = new vscode_1.EventEmitter();
        this.onDidChangeBlameInformation = this._onDidChangeBlameInformation.event;
        this.textEditorBlameInformation = new Map();
        this._repositoryBlameInformation = new Map();
        this._repositoryDisposables = new Map();
        this._disposables = [];
        this._disposables.push(new GitBlameEditorDecoration(this));
        this._disposables.push(new GitBlameStatusBarItem(this));
        this._model.onDidOpenRepository(this._onDidOpenRepository, this, this._disposables);
        this._model.onDidCloseRepository(this._onDidCloseRepository, this, this._disposables);
        vscode_1.window.onDidChangeTextEditorSelection(e => this._updateTextEditorBlameInformation(e.textEditor), this, this._disposables);
        vscode_1.window.onDidChangeTextEditorDiffInformation(e => this._updateTextEditorBlameInformation(e.textEditor), this, this._disposables);
        this._updateTextEditorBlameInformation(vscode_1.window.activeTextEditor);
    }
    _onDidOpenRepository(repository) {
        const repositoryDisposables = [];
        repository.onDidRunGitStatus(() => this._onDidRunGitStatus(repository), this, repositoryDisposables);
        this._repositoryDisposables.set(repository, repositoryDisposables);
    }
    _onDidCloseRepository(repository) {
        const disposables = this._repositoryDisposables.get(repository);
        if (disposables) {
            (0, util_1.dispose)(disposables);
        }
        this._repositoryDisposables.delete(repository);
        this._repositoryBlameInformation.delete(repository);
    }
    _onDidRunGitStatus(repository) {
        let repositoryBlameInformation = this._repositoryBlameInformation.get(repository);
        if (!repositoryBlameInformation) {
            return;
        }
        let updateDecorations = false;
        // 1. HEAD commit changed (remove all blame information for the repository)
        if (repositoryBlameInformation.commit !== repository.HEAD?.commit) {
            this._repositoryBlameInformation.delete(repository);
            repositoryBlameInformation = undefined;
            updateDecorations = true;
        }
        // 2. Resource has been staged/unstaged (remove blame information for the resource)
        for (const [uri, resourceBlameInformation] of repositoryBlameInformation?.blameInformation.entries() ?? []) {
            const isStaged = repository.indexGroup.resourceStates
                .some(r => (0, util_1.pathEquals)(uri.fsPath, r.resourceUri.fsPath));
            if (resourceBlameInformation.staged !== isStaged) {
                repositoryBlameInformation?.blameInformation.delete(uri);
                updateDecorations = true;
            }
        }
        if (updateDecorations) {
            for (const textEditor of vscode_1.window.visibleTextEditors) {
                this._updateTextEditorBlameInformation(textEditor);
            }
        }
    }
    async _getBlameInformation(resource) {
        const repository = this._model.getRepository(resource);
        if (!repository || !repository.HEAD?.commit) {
            return undefined;
        }
        const repositoryBlameInformation = this._repositoryBlameInformation.get(repository) ?? {
            commit: repository.HEAD.commit,
            blameInformation: new Map()
        };
        let resourceBlameInformation = repositoryBlameInformation.blameInformation.get(resource);
        if (repositoryBlameInformation.commit === repository.HEAD.commit && resourceBlameInformation) {
            return resourceBlameInformation.blameInformation;
        }
        const staged = repository.indexGroup.resourceStates
            .some(r => (0, util_1.pathEquals)(resource.fsPath, r.resourceUri.fsPath));
        const blameInformation = await repository.blame2(resource.fsPath) ?? [];
        resourceBlameInformation = { staged, blameInformation };
        this._repositoryBlameInformation.set(repository, {
            ...repositoryBlameInformation,
            blameInformation: repositoryBlameInformation.blameInformation.set(resource, resourceBlameInformation)
        });
        return resourceBlameInformation.blameInformation;
    }
    async _updateTextEditorBlameInformation(textEditor) {
        const diffInformation = textEditor?.diffInformation;
        if (!diffInformation || diffInformation.isStale) {
            return;
        }
        const resourceBlameInformation = await this._getBlameInformation(textEditor.document.uri);
        if (!resourceBlameInformation) {
            return;
        }
        // Remove the diff information that is contained in the git blame information.
        // This is done since git blame information is the source of truth and we don't
        // need the diff information for those ranges. The complete diff information is
        // still used to determine whether a line is changed or not.
        const diffInformationWithBlame = processTextEditorChangesWithBlameInformation(resourceBlameInformation, diffInformation.changes);
        const lineBlameInformation = [];
        for (const lineNumber of textEditor.selections.map(s => s.active.line)) {
            // Check if the line is contained in the diff information
            if (isLineChanged(lineNumber + 1, diffInformation.changes)) {
                lineBlameInformation.push({ lineNumber, blameInformation: vscode_1.l10n.t('Not Committed Yet') });
                continue;
            }
            // Map the line number to the git blame ranges
            const lineNumberWithDiff = mapLineNumber(lineNumber + 1, diffInformationWithBlame);
            const blameInformation = resourceBlameInformation.find(blameInformation => {
                return blameInformation.ranges.find(range => {
                    return lineNumberWithDiff >= range.startLineNumber && lineNumberWithDiff <= range.endLineNumber;
                });
            });
            if (blameInformation) {
                if (blameInformation.id !== notCommittedYetId) {
                    lineBlameInformation.push({ lineNumber, blameInformation });
                }
                else {
                    lineBlameInformation.push({ lineNumber, blameInformation: vscode_1.l10n.t('Not Committed Yet (Staged)') });
                }
            }
        }
        this.textEditorBlameInformation.set(textEditor, lineBlameInformation);
        this._onDidChangeBlameInformation.fire(textEditor);
    }
    dispose() {
        for (const disposables of this._repositoryDisposables.values()) {
            (0, util_1.dispose)(disposables);
        }
        this._repositoryDisposables.clear();
        this._disposables = (0, util_1.dispose)(this._disposables);
    }
}
exports.GitBlameController = GitBlameController;
__decorate([
    decorators_1.throttle
], GitBlameController.prototype, "_updateTextEditorBlameInformation", null);
class GitBlameEditorDecoration {
    constructor(_controller) {
        this._controller = _controller;
        this._disposables = [];
        this._decorationType = vscode_1.window.createTextEditorDecorationType({
            isWholeLine: true,
            after: {
                color: new vscode_1.ThemeColor('git.blame.editorDecorationForeground')
            }
        });
        this._disposables.push(this._decorationType);
        vscode_1.workspace.onDidChangeConfiguration(this._onDidChangeConfiguration, this, this._disposables);
        this._controller.onDidChangeBlameInformation(e => this._updateDecorations(e), this, this._disposables);
    }
    _onDidChangeConfiguration(e) {
        if (!e.affectsConfiguration('git.blame.editorDecoration.enabled')) {
            return;
        }
        const enabled = this._isEnabled();
        for (const textEditor of vscode_1.window.visibleTextEditors) {
            if (enabled) {
                this._updateDecorations(textEditor);
            }
            else {
                textEditor.setDecorations(this._decorationType, []);
            }
        }
    }
    _isEnabled() {
        const config = vscode_1.workspace.getConfiguration('git');
        return config.get('blame.editorDecoration.enabled', false);
    }
    _updateDecorations(textEditor) {
        if (!this._isEnabled()) {
            return;
        }
        const blameInformation = this._controller.textEditorBlameInformation.get(textEditor);
        if (!blameInformation || textEditor.document.uri.scheme !== 'file') {
            textEditor.setDecorations(this._decorationType, []);
            return;
        }
        const decorations = blameInformation.map(blame => {
            const contentText = typeof blame.blameInformation === 'string'
                ? blame.blameInformation
                : `${blame.blameInformation.message ?? ''}, ${blame.blameInformation.authorName ?? ''} (${(0, util_1.fromNow)(blame.blameInformation.date ?? Date.now(), true, true)})`;
            return this._createDecoration(blame.lineNumber, contentText);
        });
        textEditor.setDecorations(this._decorationType, decorations);
    }
    _createDecoration(lineNumber, contentText) {
        const position = new vscode_1.Position(lineNumber, Number.MAX_SAFE_INTEGER);
        return {
            range: new vscode_1.Range(position, position),
            renderOptions: {
                after: {
                    contentText: `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${contentText}`
                }
            },
        };
    }
    dispose() {
        this._disposables = (0, util_1.dispose)(this._disposables);
    }
}
class GitBlameStatusBarItem {
    constructor(_controller) {
        this._controller = _controller;
        this._disposables = [];
        vscode_1.workspace.onDidChangeConfiguration(this._onDidChangeConfiguration, this, this._disposables);
        vscode_1.window.onDidChangeActiveTextEditor(this._onDidChangeActiveTextEditor, this, this._disposables);
        this._controller.onDidChangeBlameInformation(e => this._updateStatusBarItem(e), this, this._disposables);
    }
    _onDidChangeConfiguration(e) {
        if (!e.affectsConfiguration('git.blame.statusBarItem.enabled')) {
            return;
        }
        if (this._isEnabled()) {
            if (vscode_1.window.activeTextEditor) {
                this._updateStatusBarItem(vscode_1.window.activeTextEditor);
            }
        }
        else {
            this._statusBarItem?.dispose();
            this._statusBarItem = undefined;
        }
    }
    _onDidChangeActiveTextEditor() {
        if (!this._isEnabled()) {
            return;
        }
        if (vscode_1.window.activeTextEditor) {
            this._updateStatusBarItem(vscode_1.window.activeTextEditor);
        }
        else {
            this._statusBarItem?.hide();
        }
    }
    _isEnabled() {
        const config = vscode_1.workspace.getConfiguration('git');
        return config.get('blame.statusBarItem.enabled', false);
    }
    _updateStatusBarItem(textEditor) {
        if (!this._isEnabled() || textEditor !== vscode_1.window.activeTextEditor) {
            return;
        }
        if (!this._statusBarItem) {
            this._statusBarItem = vscode_1.window.createStatusBarItem('git.blame', vscode_1.StatusBarAlignment.Right, 200);
            this._disposables.push(this._statusBarItem);
        }
        const blameInformation = this._controller.textEditorBlameInformation.get(textEditor);
        if (!blameInformation || blameInformation.length === 0 || textEditor.document.uri.scheme !== 'file') {
            this._statusBarItem.hide();
            return;
        }
        if (typeof blameInformation[0].blameInformation === 'string') {
            this._statusBarItem.text = `$(git-commit) ${blameInformation[0].blameInformation}`;
        }
        else {
            this._statusBarItem.text = `$(git-commit) ${blameInformation[0].blameInformation.authorName ?? ''} (${(0, util_1.fromNow)(blameInformation[0].blameInformation.date ?? new Date(), true, true)})`;
            this._statusBarItem.command = {
                title: vscode_1.l10n.t('View Commit'),
                command: 'git.statusBar.viewCommit',
                arguments: [textEditor.document.uri, blameInformation[0].blameInformation.id]
            };
        }
        this._statusBarItem.show();
    }
    dispose() {
        this._disposables = (0, util_1.dispose)(this._disposables);
    }
}
//# sourceMappingURL=blame.js.map