import * as vscode from 'vscode';
import getSymbolsFromDocument from './parser';

class ReactOutlineProvider implements vscode.DocumentSymbolProvider {
  private log: vscode.OutputChannel;

  constructor(log: vscode.OutputChannel) {
    this.log = log;
  }


  async provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.DocumentSymbol[]> {
    // Aquí parseas el documento y devuelves los símbolos
     return getSymbolsFromDocument(document, this.log);
  }
}

export default ReactOutlineProvider;