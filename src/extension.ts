import path from 'node:path';
import * as vscode from 'vscode';

import { COMMANDS, EXTENSION_NAME } from './const';
import { formatJustfileTempFile } from './formatter';
import { getLauncher } from './terminal';
import { getLogger } from './logger';
import { createLanguageClient, stopLanguageClient } from './language-client';
import { runRecipeCommand } from './recipe';
import { TaskProvider } from './tasks';
import { RecipesViewProvider, showRecipesPanel } from './webview';

export const activate = (context: vscode.ExtensionContext) => {
  console.debug(`${EXTENSION_NAME} activated`);

  const formatProvider = vscode.languages.registerDocumentFormattingEditProvider(
    'just',
    {
      async provideDocumentFormattingEdits(
        document: vscode.TextDocument,
      ): Promise<vscode.TextEdit[] | undefined> {
        try {
          const fileDir =
            document.uri.scheme === 'file'
              ? path.dirname(document.uri.fsPath)
              : undefined;
          const formatted = await formatJustfileTempFile(document.getText(), fileDir);
          const fullRange = new vscode.Range(0, 0, document.lineCount, 0);
          return [vscode.TextEdit.replace(fullRange, formatted)];
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          vscode.window.showErrorMessage(`Failed to format justfile: ${message}`);
          return [];
        }
      },
    },
  );

  context.subscriptions.push(
    formatProvider,
    vscode.commands.registerCommand(COMMANDS.formatDocument, () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'just') {
        vscode.commands.executeCommand('editor.action.formatDocument');
      }
    }),
    vscode.commands.registerCommand(COMMANDS.runRecipe, () => runRecipeCommand()),
    vscode.commands.registerCommand(COMMANDS.showRecipes, () => showRecipesPanel()),
    vscode.window.registerWebviewViewProvider(
      RecipesViewProvider.viewType,
      new RecipesViewProvider(),
    ),
    vscode.tasks.registerTaskProvider(EXTENSION_NAME, new TaskProvider()),
  );

  createLanguageClient();
};

export const deactivate = () => {
  console.debug(`${EXTENSION_NAME} deactivated`);
  getLogger().dispose();
  getLauncher().dispose();
  stopLanguageClient();
};
