import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

import { EXTENSION_NAME, SETTINGS } from './const';
import { getLogger } from './logger';

const asyncExec = promisify(exec);

const LOGGER = getLogger();

export const showErrorWithLink = (message: string) => {
  const outputButton = 'Output';
  vscode.window
    .showErrorMessage(message, outputButton)
    .then((selection) => selection === outputButton && LOGGER.show());
};

export const workspaceRoot = (): string => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  return workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : '~';
};

export const getJustPath = (): string => {
  return (
    (vscode.workspace
      .getConfiguration(EXTENSION_NAME)
      .get(SETTINGS.justPath) as string) || 'just'
  );
};

export const getJustVersion = async (): Promise<string | undefined> => {
  try {
    const { stdout } = await asyncExec(`${getJustPath()} --version`);
    const match = stdout.trim().match(/just\s+([\d.]+)/);
    return match ? match[1] : stdout.trim();
  } catch {
    return undefined;
  }
};
