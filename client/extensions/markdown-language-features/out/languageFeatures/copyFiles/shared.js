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
exports.mediaFileExtensions = exports.videoEditKind = exports.audioEditKind = exports.imageEditKind = exports.linkEditKind = exports.baseLinkEditKind = void 0;
exports.getSnippetLabelAndKind = getSnippetLabelAndKind;
exports.createInsertUriListEdit = createInsertUriListEdit;
exports.createUriListSnippet = createUriListSnippet;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const URI = __importStar(require("vscode-uri"));
const document_1 = require("../../util/document");
const schemes_1 = require("../../util/schemes");
const snippets_1 = require("./snippets");
/** Base kind for any sort of markdown link, including both path and media links */
exports.baseLinkEditKind = vscode.DocumentDropOrPasteEditKind.Empty.append('markdown', 'link');
/** Kind for normal markdown links, i.e. `[text](path/to/file.md)` */
exports.linkEditKind = exports.baseLinkEditKind.append('uri');
exports.imageEditKind = exports.baseLinkEditKind.append('image');
exports.audioEditKind = exports.baseLinkEditKind.append('audio');
exports.videoEditKind = exports.baseLinkEditKind.append('video');
var MediaKind;
(function (MediaKind) {
    MediaKind[MediaKind["Image"] = 0] = "Image";
    MediaKind[MediaKind["Video"] = 1] = "Video";
    MediaKind[MediaKind["Audio"] = 2] = "Audio";
})(MediaKind || (MediaKind = {}));
exports.mediaFileExtensions = new Map([
    // Images
    ['avif', MediaKind.Image],
    ['bmp', MediaKind.Image],
    ['gif', MediaKind.Image],
    ['ico', MediaKind.Image],
    ['jpe', MediaKind.Image],
    ['jpeg', MediaKind.Image],
    ['jpg', MediaKind.Image],
    ['png', MediaKind.Image],
    ['psd', MediaKind.Image],
    ['svg', MediaKind.Image],
    ['tga', MediaKind.Image],
    ['tif', MediaKind.Image],
    ['tiff', MediaKind.Image],
    ['webp', MediaKind.Image],
    // Videos
    ['ogg', MediaKind.Video],
    ['mp4', MediaKind.Video],
    // Audio Files
    ['mp3', MediaKind.Audio],
    ['aac', MediaKind.Audio],
    ['wav', MediaKind.Audio],
]);
function getSnippetLabelAndKind(counter) {
    if (counter.insertedVideoCount > 0 || counter.insertedAudioCount > 0) {
        // Any media plus links
        if (counter.insertedLinkCount > 0) {
            return {
                label: vscode.l10n.t('Insert Markdown Media and Links'),
                kind: exports.baseLinkEditKind,
            };
        }
        // Any media plus images
        if (counter.insertedImageCount > 0) {
            return {
                label: vscode.l10n.t('Insert Markdown Media and Images'),
                kind: exports.baseLinkEditKind,
            };
        }
        // Audio only
        if (counter.insertedAudioCount > 0 && !counter.insertedVideoCount) {
            return {
                label: vscode.l10n.t('Insert Markdown Audio'),
                kind: exports.audioEditKind,
            };
        }
        // Video only
        if (counter.insertedVideoCount > 0 && !counter.insertedAudioCount) {
            return {
                label: vscode.l10n.t('Insert Markdown Video'),
                kind: exports.videoEditKind,
            };
        }
        // Mix of audio and video
        return {
            label: vscode.l10n.t('Insert Markdown Media'),
            kind: exports.baseLinkEditKind,
        };
    }
    else if (counter.insertedImageCount > 0) {
        // Mix of images and links
        if (counter.insertedLinkCount > 0) {
            return {
                label: vscode.l10n.t('Insert Markdown Images and Links'),
                kind: exports.baseLinkEditKind,
            };
        }
        // Just images
        return {
            label: counter.insertedImageCount > 1
                ? vscode.l10n.t('Insert Markdown Images')
                : vscode.l10n.t('Insert Markdown Image'),
            kind: exports.imageEditKind,
        };
    }
    else {
        return {
            label: counter.insertedLinkCount > 1
                ? vscode.l10n.t('Insert Markdown Links')
                : vscode.l10n.t('Insert Markdown Link'),
            kind: exports.linkEditKind,
        };
    }
}
function createInsertUriListEdit(document, ranges, urlList, options) {
    if (!ranges.length || !urlList.entries.length) {
        return;
    }
    const edits = [];
    let insertedLinkCount = 0;
    let insertedImageCount = 0;
    let insertedAudioCount = 0;
    let insertedVideoCount = 0;
    // Use 1 for all empty ranges but give non-empty range unique indices starting after 1
    let placeHolderStartIndex = 1 + urlList.entries.length;
    // Sort ranges by start position
    const orderedRanges = [...ranges].sort((a, b) => a.start.compareTo(b.start));
    const allRangesAreEmpty = orderedRanges.every(range => range.isEmpty);
    for (const range of orderedRanges) {
        const snippet = createUriListSnippet(document.uri, urlList.entries, {
            placeholderText: range.isEmpty ? undefined : document.getText(range),
            placeholderStartIndex: allRangesAreEmpty ? 1 : placeHolderStartIndex,
            ...options,
        });
        if (!snippet) {
            continue;
        }
        insertedLinkCount += snippet.insertedLinkCount;
        insertedImageCount += snippet.insertedImageCount;
        insertedAudioCount += snippet.insertedAudioCount;
        insertedVideoCount += snippet.insertedVideoCount;
        placeHolderStartIndex += urlList.entries.length;
        edits.push(new vscode.SnippetTextEdit(range, snippet.snippet));
    }
    const { label, kind } = getSnippetLabelAndKind({ insertedAudioCount, insertedVideoCount, insertedImageCount, insertedLinkCount });
    return { edits, label, kind };
}
function createUriListSnippet(document, uris, options) {
    if (!uris.length) {
        return;
    }
    const documentDir = (0, document_1.getDocumentDir)(document);
    const config = vscode.workspace.getConfiguration('markdown', document);
    const title = options?.placeholderText || 'Title';
    let insertedLinkCount = 0;
    let insertedImageCount = 0;
    let insertedAudioCount = 0;
    let insertedVideoCount = 0;
    const snippet = new vscode.SnippetString();
    let placeholderIndex = options?.placeholderStartIndex ?? 1;
    uris.forEach((uri, i) => {
        const mdPath = (!options?.preserveAbsoluteUris ? getRelativeMdPath(documentDir, uri.uri) : undefined) ?? uri.str ?? uri.uri.toString();
        const desiredKind = getDesiredLinkKind(uri.uri, options);
        if (desiredKind === DesiredLinkKind.Link) {
            insertedLinkCount++;
            snippet.appendText('[');
            snippet.appendPlaceholder(escapeBrackets(options?.placeholderText ?? 'text'), placeholderIndex);
            snippet.appendText(`](${escapeMarkdownLinkPath(mdPath)})`);
        }
        else {
            const insertAsVideo = desiredKind === DesiredLinkKind.Video;
            const insertAsAudio = desiredKind === DesiredLinkKind.Audio;
            if (insertAsVideo || insertAsAudio) {
                if (insertAsVideo) {
                    insertedVideoCount++;
                }
                else {
                    insertedAudioCount++;
                }
                const mediaSnippet = insertAsVideo
                    ? config.get('editor.filePaste.videoSnippet', '<video controls src="${src}" title="${title}"></video>')
                    : config.get('editor.filePaste.audioSnippet', '<audio controls src="${src}" title="${title}"></audio>');
                snippet.value += (0, snippets_1.resolveSnippet)(mediaSnippet, new Map([
                    ['src', mdPath],
                    ['title', `\${${placeholderIndex++}:${title}}`],
                ]));
            }
            else {
                insertedImageCount++;
                snippet.appendText('![');
                const placeholderText = escapeBrackets(options?.placeholderText || 'alt text');
                snippet.appendPlaceholder(placeholderText, placeholderIndex);
                snippet.appendText(`](${escapeMarkdownLinkPath(mdPath)})`);
            }
        }
        if (i < uris.length - 1 && uris.length > 1) {
            snippet.appendText(options?.separator ?? ' ');
        }
    });
    return { snippet, insertedAudioCount, insertedVideoCount, insertedImageCount, insertedLinkCount };
}
var DesiredLinkKind;
(function (DesiredLinkKind) {
    DesiredLinkKind[DesiredLinkKind["Link"] = 0] = "Link";
    DesiredLinkKind[DesiredLinkKind["Image"] = 1] = "Image";
    DesiredLinkKind[DesiredLinkKind["Video"] = 2] = "Video";
    DesiredLinkKind[DesiredLinkKind["Audio"] = 3] = "Audio";
})(DesiredLinkKind || (DesiredLinkKind = {}));
function getDesiredLinkKind(uri, options) {
    if (options?.linkKindHint instanceof vscode.DocumentDropOrPasteEditKind) {
        if (exports.linkEditKind.contains(options.linkKindHint)) {
            return DesiredLinkKind.Link;
        }
        else if (exports.imageEditKind.contains(options.linkKindHint)) {
            return DesiredLinkKind.Image;
        }
        else if (exports.audioEditKind.contains(options.linkKindHint)) {
            return DesiredLinkKind.Audio;
        }
        else if (exports.videoEditKind.contains(options.linkKindHint)) {
            return DesiredLinkKind.Video;
        }
    }
    const normalizedExt = URI.Utils.extname(uri).toLowerCase().replace('.', '');
    if (options?.linkKindHint === 'media' || exports.mediaFileExtensions.has(normalizedExt)) {
        switch (exports.mediaFileExtensions.get(normalizedExt)) {
            case MediaKind.Video: return DesiredLinkKind.Video;
            case MediaKind.Audio: return DesiredLinkKind.Audio;
            default: return DesiredLinkKind.Image;
        }
    }
    return DesiredLinkKind.Link;
}
function getRelativeMdPath(dir, file) {
    if (dir && dir.scheme === file.scheme && dir.authority === file.authority) {
        if (file.scheme === schemes_1.Schemes.file) {
            // On windows, we must use the native `path.relative` to generate the relative path
            // so that drive-letters are resolved cast insensitively. However we then want to
            // convert back to a posix path to insert in to the document.
            const relativePath = path.relative(dir.fsPath, file.fsPath);
            return path.posix.normalize(relativePath.split(path.sep).join(path.posix.sep));
        }
        return path.posix.relative(dir.path, file.path);
    }
    return undefined;
}
function escapeMarkdownLinkPath(mdPath) {
    if (needsBracketLink(mdPath)) {
        return '<' + mdPath.replaceAll('<', '\\<').replaceAll('>', '\\>') + '>';
    }
    return mdPath;
}
function escapeBrackets(value) {
    value = value.replace(/[\[\]]/g, '\\$&'); // CodeQL [SM02383] The Markdown is fully sanitized after being rendered.
    return value;
}
function needsBracketLink(mdPath) {
    // Links with whitespace or control characters must be enclosed in brackets
    if (mdPath.startsWith('<') || /\s|[\u007F\u0000-\u001f]/.test(mdPath)) {
        return true;
    }
    // Check if the link has mis-matched parens
    if (!/[\(\)]/.test(mdPath)) {
        return false;
    }
    let previousChar = '';
    let nestingCount = 0;
    for (const char of mdPath) {
        if (char === '(' && previousChar !== '\\') {
            nestingCount++;
        }
        else if (char === ')' && previousChar !== '\\') {
            nestingCount--;
        }
        if (nestingCount < 0) {
            return true;
        }
        previousChar = char;
    }
    return nestingCount > 0;
}
//# sourceMappingURL=shared.js.map