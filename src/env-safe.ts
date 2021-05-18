import { JsonFormatter } from './json-formater';
import * as vscode from 'vscode';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';

export type Algorithms = 'AES' | 'DES' | 'Rabbit' | 'RC4' | 'RC4Drop';
export const ERROR_CODES = {
    EMPTY_PHRASE: 'Passphrase cannot be empty'
}
export class EnvSafe {
    /**
     * Secret base key
     */
    private readonly KEY = 'env-safe-secret';

    /**
     * Start new env safe for extension
     */
    constructor(
        private context: vscode.ExtensionContext
    ) { };

    /**
     * Encrypt text with same phrase
     * @param phrase Pass Phrase
     * @param text Plain text
     * @param algorithm Algorithms type
     */
    encrypt(phrase: string, text: string, algorithm: Algorithms = 'AES'): CryptoJS.lib.CipherParams {
        try {
            const cipherText = CryptoJS[algorithm].encrypt(text, phrase);
            // let wordWrapColumn = vscode.workspace.getConfiguration('editor').get('wordWrapColumn', false) || 80;
            // const regex = new RegExp(`.{1,${wordWrapColumn}}`, "g");
            // const cipherFormatted = cipherText.match(regex)?.join("\r\n") ?? '';
            return cipherText
            // return CryptoJS[algorithm].encrypt(text, phrase).toString();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Decrypt text with same phrase
     * @param phrase Pass Phrase
     * @param text Encrypted text
     * @param algorithm Algorithms type
     */
    decrypt(phrase: string, text: string, algorithm: Algorithms = 'AES'): string {
        try {
            const cleanText = text?.split("\r\n")?.join('') ?? '';
            const bytes = CryptoJS[algorithm].decrypt(cleanText, phrase);
            const plainText = bytes.toString(CryptoJS.enc.Utf8);
            return plainText;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get secret from same file
     * Can safe or hash file
     * @returns The file secret or input phrase
     */
    private async getSecret(
        key: string
    ): Promise<string | undefined> {
        key = key.replace(/\.hash/gi, '');
        const secrets = this.context['secrets'];
        const secretKey = `${this.KEY}-${key}`;
        let secret = await secrets.get(secretKey);
        if (!!secret === false) {
            const passString = await vscode.window.showInputBox({
                prompt: 'Provide your passphrase',
                placeHolder: 'Your file passphrase',
                password: true,
                validateInput: value => (value.length == 0) ? ERROR_CODES.EMPTY_PHRASE : null
            });
            if (!!passString) {
                await vscode.window.showQuickPick([
                    {
                        icon: 'check',
                        label: 'Yes, save passphrase for this file',
                        action: 'yes'
                    },
                    {
                        icon: 'cancel',
                        label: 'No, Thanks',
                        action: 'no'
                    }
                ]).then(async selection => {
                    switch (selection?.action) {
                        case 'yes':
                            await secrets.store(secretKey, passString); //Save a secret
                            secret = await secrets.get(secretKey);
                            vscode.window.showInformationMessage('Pass string stored');
                            break;
                        default:
                            secret = passString;
                            break;
                    }
                })
            } else vscode.window.showErrorMessage(ERROR_CODES.EMPTY_PHRASE);
        }
        return secret;
    }

    /**
     * Delete same secret from VS Code
     * @param key File name
     */
    async deleteSecret(key: string): Promise<void> {
        const secrets = this.context['secrets']; //SecretStorage-object
        await secrets.delete(`${this.KEY}-${key}`);
    }

    /**
     * Encrypt document
     * @param document VS Code document
     * @param algorithm Algorithm type
     */
    async encryptFile(
        document: vscode.TextDocument,
        algorithm: Algorithms = 'AES'
    ): Promise<void> {
        const secret = await this.getSecret(document.fileName);
        if (!!secret) {
            const content = this.encrypt(secret.toString(), document.getText(), algorithm).toString();
            let wsEdit = new vscode.WorkspaceEdit();
            const hashFile = `${document.uri.fsPath}.hash`;
            const filePath = vscode.Uri.file(hashFile);
            wsEdit.createFile(filePath, { overwrite: true });
            await vscode.workspace.applyEdit(wsEdit);
            await vscode.workspace.openTextDocument(hashFile).then(async (hashDocument) => {
                wsEdit = new vscode.WorkspaceEdit();
                const text = vscode.TextEdit.insert(new vscode.Position(0, 0), content);
                wsEdit.set(filePath, [text]);
                await vscode.workspace.applyEdit(wsEdit);
                hashDocument.save();
                vscode.window.showInformationMessage(`Hash file ${hashFile} created`);
                await vscode.window.showTextDocument(hashDocument);
            });
        }
    }

    /**
     * Decrypt document
     * @param document VS Code document
     * @param algorithm Algorithm type
     */
    async decryptFile(
        document: vscode.TextDocument,
        algorithm: Algorithms = 'AES'
    ): Promise<void> {
        const originalFileName = document.fileName.replace(/\.hash/gi, '');
        const secret = await this.getSecret(originalFileName);
        if (!!secret) {
            const content = document.getText();
            const plainText = this.decrypt(secret, content, algorithm);
            const uri = vscode.Uri.file(originalFileName);
            const wsEdit = new vscode.WorkspaceEdit();
            wsEdit.createFile(uri, {ignoreIfExists: true});
            await vscode.workspace.openTextDocument(originalFileName).then(async (envFile) => {
                const firstLine = envFile.lineAt(0);
                const lastLine = envFile.lineAt(envFile.lineCount - 1);
                const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);
                wsEdit.delete(uri, textRange);
                const text = vscode.TextEdit.insert(new vscode.Position(0, 0), plainText);
                wsEdit.set(uri, [text]);
                await vscode.workspace.applyEdit(wsEdit);
                // envFile.save();
                vscode.window.showInformationMessage(`Hash file ${originalFileName} decrypted`);
                await vscode.window.showTextDocument(envFile);
            });
        }
    }

    /**
     * On save document VS Code event
     */
    async onSaveDocument(document: vscode.TextDocument): Promise<void> {
        if (document.languageId === "env-safe" && document.uri.scheme === "file") {
            await this.encryptFile(document);
        }
        else if (document.languageId === "env-safe-hash" && document.uri.scheme === "file") {
            vscode.window.showInformationMessage(`Hash file`);
        }
    }
}