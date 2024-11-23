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
exports.register = register;
const vscode = __importStar(require("vscode"));
const api_1 = require("../tsServer/api");
const dependentRegistration_1 = require("./util/dependentRegistration");
const typeConverters_1 = require("../typeConverters");
class TsMappedEditsProvider {
    constructor(client) {
        this.client = client;
    }
    async provideMappedEdits(document, codeBlocks, context, token) {
        if (!this.isEnabled()) {
            return;
        }
        const file = this.client.toOpenTsFilePath(document);
        if (!file) {
            return;
        }
        const response = await this.client.execute('mapCode', {
            file,
            mapping: {
                contents: codeBlocks,
                focusLocations: context.documents.map(documents => {
                    return documents.flatMap((contextItem) => {
                        const file = this.client.toTsFilePath(contextItem.uri);
                        if (!file) {
                            return [];
                        }
                        return contextItem.ranges.map((range) => ({ file, ...typeConverters_1.Range.toTextSpan(range) }));
                    });
                }),
            }
        }, token);
        if (response.type !== 'response' || !response.body) {
            return;
        }
        return typeConverters_1.WorkspaceEdit.fromFileCodeEdits(this.client, response.body);
    }
    isEnabled() {
        return vscode.workspace.getConfiguration('typescript').get('experimental.mappedCodeEdits.enabled', false);
    }
}
function register(selector, client) {
    return (0, dependentRegistration_1.conditionalRegistration)([
        (0, dependentRegistration_1.requireMinVersion)(client, api_1.API.v540)
    ], () => {
        const provider = new TsMappedEditsProvider(client);
        return vscode.chat.registerMappedEditsProvider(selector.semantic, provider);
    });
}
//# sourceMappingURL=mappedCodeEditProvider.js.map