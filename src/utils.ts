import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

import { EXTENSION_NAME, SETTINGS } from './const';
import { getLogger } from './logger';

const execAsync = promisify(exec);

export const showErrorWithLink = (message: string) => {
  vscode.window.showErrorMessage(message, 'Output').then((selection) => {
    if (selection === 'Output') getLogger().show();
  });
};

export const workspaceRoot = (): string => {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : '~';
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
    const { stdout } = await execAsync(`${getJustPath()} --version`);
    const match = stdout.trim().match(/just\s+([\d.]+)/);
    return match ? match[1] : stdout.trim();
  } catch {
    return undefined;
  }
};

export const getJustfilePath = async (): Promise<string> => {
  const root = workspaceRoot();
  const candidates = ['justfile', 'Justfile', '.justfile'];

  for (const name of candidates) {
    const filePath = path.join(root, name);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // try next candidate
    }
  }

  throw new Error(`No justfile found in ${root}`);
};

export const getJustfileImports = async (justfilePath: string): Promise<string[]> => {
  try {
    const content = await fs.readFile(justfilePath, 'utf8');
    const dir = path.dirname(justfilePath);
    const imports: string[] = [];

    const importRe = /^import\??\s+(['"])(.+?)\1/gm;
    const modRe = /^mod\??\s+[a-zA-Z_][a-zA-Z0-9_-]*\s+(['"])(.+?)\1/gm;

    for (const match of content.matchAll(importRe)) {
      imports.push(path.resolve(dir, match[2]));
    }
    for (const match of content.matchAll(modRe)) {
      imports.push(path.resolve(dir, match[2]));
    }

    return imports;
  } catch {
    return [];
  }
};
