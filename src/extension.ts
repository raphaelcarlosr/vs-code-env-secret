// https://code.visualstudio.com/api/get-started/your-first-extension
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as CryptoJS from 'crypto-js';

function sleep(timeout: number): Promise<void> {
	return new Promise((resolve, reject) => {
		setTimeout(() => resolve(), timeout);
	});
}
class EnvSafe {
	constructor() { };
	encrypt(phrase: string, text: string): string {
		return CryptoJS.AES.encrypt(text, phrase).toString();
	}
	decrypt(phrase: string, text: string): string {
		const cleanText = text?.split("\r\n")?.join('') ?? '';
		const bytes = CryptoJS.AES.decrypt(cleanText, phrase);
		const plainText = bytes.toString(CryptoJS.enc.Utf8);
		return plainText;
	}
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
		console.log(document.languageId, document.uri.scheme);
		if (document.languageId === "env-safe" && document.uri.scheme === "file") {
			const envSafe = new EnvSafe();
			const error = 'Passphrase cannot be empty';
			const secretKey = `env-safe-secret-${document.fileName}`;
			const secrets = context['secrets']; //SecretStorage-object
			let secret = await secrets.get(secretKey); //Get a secret
			if (!!secret === false) {
				const passString = await vscode.window.showInputBox({
					prompt: 'Provide your passphrase',
					placeHolder: 'My passphrase',
					password: true,
					validateInput: value => (value.length == 0) ? error : null
				});
				if (!!passString) {
					await vscode.window.showInformationMessage(passString);
					await secrets.store(secretKey, passString); //Save a secret
					secret = await secrets.get(secretKey);
				} else await vscode.window.showErrorMessage(error);
			}
			vscode.window.showInformationMessage(secret ?? 'undefined');
			const content = envSafe.encrypt(secret ?? '', document.getText());
			const wsEdit = new vscode.WorkspaceEdit();
			const hashFile = `${document.uri.fsPath}.hash`;
			const filePath = vscode.Uri.file(hashFile);
			// wsEdit.deleteFile(filePath, { ignoreIfNotExists: true });
			wsEdit.createFile(filePath, { overwrite: true });
			// const text = vscode.TextEdit.replace( new vscode.Range(0, 0, 0, 0), content)
			const text = vscode.TextEdit.insert(new vscode.Position(0, 0), content);
			wsEdit.set(filePath, [text]);
			await vscode.workspace.applyEdit(wsEdit);
			await vscode.workspace.openTextDocument(hashFile).then((hashDocument) => {
				hashDocument.save();				
			});
			// await vscode.workspace.saveAll();
			await vscode.window.showInformationMessage(`Hash file ${hashFile} created`);

		} 
		else if (document.languageId === "env-safe-hash" && document.uri.scheme === "file") {
			await vscode.window.showInformationMessage(`Hash file`);
		}
	});
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "env-safe" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('env-safe.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from env-safe!');
	});

	context.subscriptions.push(disposable);
	const deletePhrase = vscode.commands.registerCommand('extension.delete-phrase', async () => {
		// const result = await vscode.window.showSaveDialog();
		// const file = result?.fsPath.split('\\\\').pop();
		// if(!!file) vscode.window.showErrorMessage('Invalid env safe file path')
		const file = vscode.window.activeTextEditor?.document?.fileName;
		const key = `env-safe-secret-${file}`;
		const secrets = context['secrets']; //SecretStorage-object
		await secrets.delete(key);
	});
	context.subscriptions.push(deletePhrase);

	const encrypt = vscode.commands.registerCommand('extension.encrypt', async () => {
		const fullText = vscode.window.activeTextEditor?.document.getText();
		const passString = await vscode.window.showInputBox({
			prompt: 'Provide your passphrase',
			placeHolder: 'My passphrase',
			password: true,
			validateInput: value => (value.length == 0) ? "Passphrase cannot be empty" : null
		}) ?? '';
		const cipherText = CryptoJS.AES.encrypt(fullText ?? '', passString).toString();
		let wordWrapColumn = vscode.workspace.getConfiguration('editor').get('wordWrapColumn', false) || 80;
		const regex = new RegExp(`.{1,${wordWrapColumn}}`, "g");
		const cipherFormatted = cipherText.match(regex)?.join("\r\n") ?? '';
		const invalidRange = new vscode.Range(0, 0, vscode.window.activeTextEditor?.document.lineCount ?? 0, 0);
		const fullRange = vscode.window.activeTextEditor?.document.validateRange(invalidRange);
		if (!!fullRange) {
			vscode.window.activeTextEditor?.edit(edit => edit.replace(fullRange, cipherFormatted));
			vscode.window.showInformationMessage(`File Encrypted`);
		}

	});
	context.subscriptions.push(encrypt);

	const decrypt = vscode.commands.registerCommand('extension.decrypt', async () => {
		const fullText = vscode.window.activeTextEditor?.document.getText();
		const cleanText = fullText?.split("\r\n")?.join('') ?? '';
		const passString = await vscode.window.showInputBox({
			prompt: 'Provide your passphrase',
			placeHolder: 'My passphrase',
			password: true,
			validateInput: value => (value.length == 0) ? "Passphrase cannot be empty" : null
		}) ?? '';
		const bytes = CryptoJS.AES.decrypt(cleanText, passString);
		const plainText = bytes.toString(CryptoJS.enc.Utf8);
		const invalidRange = new vscode.Range(0, 0, vscode.window.activeTextEditor?.document.lineCount ?? 0, 0);
		const fullRange = vscode.window.activeTextEditor?.document.validateRange(invalidRange);
		if (!!fullRange) {
			vscode.window.activeTextEditor?.edit(edit => edit.replace(fullRange, plainText));
			vscode.window.showInformationMessage(`File Decrypted`);
		}
	});
	context.subscriptions.push(decrypt);
}

exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
module.exports = {
	activate,
	deactivate
}