import * as vscode from "vscode";
import ChatsWebviewProvider from "./chat/webview";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("chats", new ChatsWebviewProvider()));
}

export function deactivate() {}
