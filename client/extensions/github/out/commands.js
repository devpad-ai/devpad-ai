"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const vscode = __importStar(require("vscode"));
const publish_1 = require("./publish");
const util_1 = require("./util");
const links_1 = require("./links");
async function copyVscodeDevLink(gitAPI, useSelection, context, includeRange = true) {
    try {
        const permalink = await (0, links_1.getLink)(gitAPI, useSelection, true, (0, links_1.getVscodeDevHost)(), 'headlink', context, includeRange);
        if (permalink) {
            return vscode.env.clipboard.writeText(permalink);
        }
    }
    catch (err) {
        if (!(err instanceof vscode.CancellationError)) {
            vscode.window.showErrorMessage(err.message);
        }
    }
}
async function openVscodeDevLink(gitAPI) {
    try {
        const headlink = await (0, links_1.getLink)(gitAPI, true, false, (0, links_1.getVscodeDevHost)(), 'headlink');
        return headlink ? vscode.Uri.parse(headlink) : undefined;
    }
    catch (err) {
        if (!(err instanceof vscode.CancellationError)) {
            vscode.window.showErrorMessage(err.message);
        }
        return undefined;
    }
}
function registerCommands(gitAPI) {
    const disposables = new util_1.DisposableStore();
    disposables.add(vscode.commands.registerCommand('github.publish', async () => {
        try {
            (0, publish_1.publishRepository)(gitAPI);
        }
        catch (err) {
            vscode.window.showErrorMessage(err.message);
        }
    }));
    disposables.add(vscode.commands.registerCommand('github.copyVscodeDevLink', async (context) => {
        return copyVscodeDevLink(gitAPI, true, context);
    }));
    disposables.add(vscode.commands.registerCommand('github.copyVscodeDevLinkFile', async (context) => {
        return copyVscodeDevLink(gitAPI, false, context);
    }));
    disposables.add(vscode.commands.registerCommand('github.copyVscodeDevLinkWithoutRange', async (context) => {
        return copyVscodeDevLink(gitAPI, true, context, false);
    }));
    disposables.add(vscode.commands.registerCommand('github.openOnVscodeDev', async () => {
        return openVscodeDevLink(gitAPI);
    }));
    return disposables;
}
//# sourceMappingURL=commands.js.map