"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLineChanges = applyLineChanges;
exports.toLineRanges = toLineRanges;
exports.getModifiedRange = getModifiedRange;
exports.intersectDiffWithRange = intersectDiffWithRange;
exports.invertLineChange = invertLineChange;
const vscode_1 = require("vscode");
function applyLineChanges(original, modified, diffs) {
    const result = [];
    let currentLine = 0;
    for (const diff of diffs) {
        const isInsertion = diff.originalEndLineNumber === 0;
        const isDeletion = diff.modifiedEndLineNumber === 0;
        let endLine = isInsertion ? diff.originalStartLineNumber : diff.originalStartLineNumber - 1;
        let endCharacter = 0;
        // if this is a deletion at the very end of the document,then we need to account
        // for a newline at the end of the last line which may have been deleted
        // https://github.com/microsoft/vscode/issues/59670
        if (isDeletion && diff.originalEndLineNumber === original.lineCount) {
            endLine -= 1;
            endCharacter = original.lineAt(endLine).range.end.character;
        }
        result.push(original.getText(new vscode_1.Range(currentLine, 0, endLine, endCharacter)));
        if (!isDeletion) {
            let fromLine = diff.modifiedStartLineNumber - 1;
            let fromCharacter = 0;
            // if this is an insertion at the very end of the document,
            // then we must start the next range after the last character of the
            // previous line, in order to take the correct eol
            if (isInsertion && diff.originalStartLineNumber === original.lineCount) {
                fromLine -= 1;
                fromCharacter = modified.lineAt(fromLine).range.end.character;
            }
            result.push(modified.getText(new vscode_1.Range(fromLine, fromCharacter, diff.modifiedEndLineNumber, 0)));
        }
        currentLine = isInsertion ? diff.originalStartLineNumber : diff.originalEndLineNumber;
    }
    result.push(original.getText(new vscode_1.Range(currentLine, 0, original.lineCount, 0)));
    return result.join('');
}
function toLineRanges(selections, textDocument) {
    const lineRanges = selections.map(s => {
        const startLine = textDocument.lineAt(s.start.line);
        const endLine = textDocument.lineAt(s.end.line);
        return new vscode_1.Range(startLine.range.start, endLine.range.end);
    });
    lineRanges.sort((a, b) => a.start.line - b.start.line);
    const result = lineRanges.reduce((result, l) => {
        if (result.length === 0) {
            result.push(l);
            return result;
        }
        const [last, ...rest] = result;
        const intersection = l.intersection(last);
        if (intersection) {
            return [intersection, ...rest];
        }
        if (l.start.line === last.end.line + 1) {
            const merge = new vscode_1.Range(last.start, l.end);
            return [merge, ...rest];
        }
        return [l, ...result];
    }, []);
    result.reverse();
    return result;
}
function getModifiedRange(textDocument, diff) {
    if (diff.modifiedEndLineNumber === 0) {
        if (diff.modifiedStartLineNumber === 0) {
            return new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber).range.end, textDocument.lineAt(diff.modifiedStartLineNumber).range.start);
        }
        else if (textDocument.lineCount === diff.modifiedStartLineNumber) {
            return new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end, textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end);
        }
        else {
            return new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.end, textDocument.lineAt(diff.modifiedStartLineNumber).range.start);
        }
    }
    else {
        return new vscode_1.Range(textDocument.lineAt(diff.modifiedStartLineNumber - 1).range.start, textDocument.lineAt(diff.modifiedEndLineNumber - 1).range.end);
    }
}
function intersectDiffWithRange(textDocument, diff, range) {
    const modifiedRange = getModifiedRange(textDocument, diff);
    const intersection = range.intersection(modifiedRange);
    if (!intersection) {
        return null;
    }
    if (diff.modifiedEndLineNumber === 0) {
        return diff;
    }
    else {
        const modifiedStartLineNumber = intersection.start.line + 1;
        const modifiedEndLineNumber = intersection.end.line + 1;
        // heuristic: same number of lines on both sides, let's assume line by line
        if (diff.originalEndLineNumber - diff.originalStartLineNumber === diff.modifiedEndLineNumber - diff.modifiedStartLineNumber) {
            const delta = modifiedStartLineNumber - diff.modifiedStartLineNumber;
            const length = modifiedEndLineNumber - modifiedStartLineNumber;
            return {
                originalStartLineNumber: diff.originalStartLineNumber + delta,
                originalEndLineNumber: diff.originalStartLineNumber + delta + length,
                modifiedStartLineNumber,
                modifiedEndLineNumber
            };
        }
        else {
            return {
                originalStartLineNumber: diff.originalStartLineNumber,
                originalEndLineNumber: diff.originalEndLineNumber,
                modifiedStartLineNumber,
                modifiedEndLineNumber
            };
        }
    }
}
function invertLineChange(diff) {
    return {
        modifiedStartLineNumber: diff.originalStartLineNumber,
        modifiedEndLineNumber: diff.originalEndLineNumber,
        originalStartLineNumber: diff.modifiedStartLineNumber,
        originalEndLineNumber: diff.modifiedEndLineNumber
    };
}
//# sourceMappingURL=staging.js.map