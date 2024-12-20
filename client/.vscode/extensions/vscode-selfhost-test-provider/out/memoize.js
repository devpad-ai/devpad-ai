"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoizeLast = void 0;
const memoizeLast = (fn) => {
    let last;
    return arg => {
        if (last && last.arg === arg) {
            return last.result;
        }
        const result = fn(arg);
        last = { arg, result };
        return result;
    };
};
exports.memoizeLast = memoizeLast;
//# sourceMappingURL=memoize.js.map