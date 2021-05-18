// https://code.visualstudio.com/api/get-started/your-first-extension
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { EnvSafe } from './env-safe';
import * as vscode from 'vscode';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const envSafe = new EnvSafe(context);
	vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
		await envSafe.onSaveDocument(document);
	});
	const deletePhrase = vscode.commands.registerCommand('env-safe.deletePhrase', async () => {
		const file = vscode.window.activeTextEditor?.document?.fileName;
		if(!!file) envSafe.deleteSecret(file);
	});
	context.subscriptions.push(deletePhrase);

	const encrypt = vscode.commands.registerCommand('env-safe.encrypt', async () => {
		if(!!vscode.window.activeTextEditor?.document) {
			await envSafe.encryptFile(vscode.window.activeTextEditor?.document);
		} else {
			vscode.window.showInformationMessage(`Open env safe file first`);
		}
	});
	context.subscriptions.push(encrypt);

	const decrypt = vscode.commands.registerCommand('env-safe.decrypt', async () => {
		if(!!vscode.window.activeTextEditor?.document) {
			await envSafe.decryptFile(vscode.window.activeTextEditor?.document);
		} else {
			vscode.window.showInformationMessage(`Open env safe file first`);
		}
	});
	context.subscriptions.push(decrypt);
}

exports.activate = activate;
function deactivate() { }
module.exports = {
	activate,
	deactivate
}