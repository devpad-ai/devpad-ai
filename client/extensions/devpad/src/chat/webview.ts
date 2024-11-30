import * as vscode from "vscode";
import fs from "fs";

export default class ChatsWebviewProvider implements vscode.WebviewViewProvider {
	constructor(private context?: vscode.ExtensionContext) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	) {
		webviewView.webview.options = {
			enableScripts: true
		};

		webviewView.webview.html = this.getWebviewContent();

		webviewView.webview.onDidReceiveMessage(async (message) => {
			switch (message.command) {
				case "showMessage":
					vscode.window.showInformationMessage(message.text);
					break;
			}
		});
	}

	getWebviewContent() {
		return fs.readFileSync("./extensions/devpad/out/ui/chats.html").toString();
	}
}
