import * as vscode from 'vscode';
import ReactOutlineProvider from './provider';

const logChannel = vscode.window.createOutputChannel('React Outline');

export function activate(context: vscode.ExtensionContext) {
  logChannel.appendLine('React Outline activated');

  const selector: vscode.DocumentSelector = [
    { language: 'javascriptreact', scheme: 'file' },
    { language: 'typescriptreact', scheme: 'file' },
  ];

  const provider: vscode.DocumentSymbolProvider = new ReactOutlineProvider(logChannel);

  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(selector, provider)
  );
}