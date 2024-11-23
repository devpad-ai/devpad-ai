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
exports.VsCodeOutputLogger = void 0;
const vscode = __importStar(require("vscode"));
const dispose_1 = require("./util/dispose");
var Trace;
(function (Trace) {
    Trace[Trace["Off"] = 0] = "Off";
    Trace[Trace["Verbose"] = 1] = "Verbose";
})(Trace || (Trace = {}));
(function (Trace) {
    function fromString(value) {
        value = value.toLowerCase();
        switch (value) {
            case 'off':
                return Trace.Off;
            case 'verbose':
                return Trace.Verbose;
            default:
                return Trace.Off;
        }
    }
    Trace.fromString = fromString;
})(Trace || (Trace = {}));
class VsCodeOutputLogger extends dispose_1.Disposable {
    get _outputChannel() {
        this._outputChannelValue ?? (this._outputChannelValue = this._register(vscode.window.createOutputChannel('Markdown')));
        return this._outputChannelValue;
    }
    constructor() {
        super();
        this._register(vscode.workspace.onDidChangeConfiguration(() => {
            this._updateConfiguration();
        }));
        this._updateConfiguration();
    }
    verbose(title, message, data) {
        if (this._trace === Trace.Verbose) {
            this._appendLine(`[Verbose ${this._now()}] ${title}: ${message}`);
            if (data) {
                this._appendLine(VsCodeOutputLogger._data2String(data));
            }
        }
    }
    _now() {
        const now = new Date();
        return String(now.getUTCHours()).padStart(2, '0')
            + ':' + String(now.getMinutes()).padStart(2, '0')
            + ':' + String(now.getUTCSeconds()).padStart(2, '0') + '.' + String(now.getMilliseconds()).padStart(3, '0');
    }
    _updateConfiguration() {
        this._trace = this._readTrace();
    }
    _appendLine(value) {
        this._outputChannel.appendLine(value);
    }
    _readTrace() {
        return Trace.fromString(vscode.workspace.getConfiguration().get('markdown.trace.extension', 'off'));
    }
    static _data2String(data) {
        if (data instanceof Error) {
            if (typeof data.stack === 'string') {
                return data.stack;
            }
            return data.message;
        }
        if (typeof data === 'string') {
            return data;
        }
        return JSON.stringify(data, undefined, 2);
    }
}
exports.VsCodeOutputLogger = VsCodeOutputLogger;
//# sourceMappingURL=logging.js.map