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

export const getJustfilePath = async (): Promise<string> => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

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

/**
 * Parses a justfile for `import` and `mod` statements and returns the
 * resolved file paths. Supports `import 'path'`, `import? 'path'`,
 * `mod name 'path'`, and `mod? name 'path'` with single or double quotes.
 */
export const getJustfileImports = async (justfilePath: string): Promise<string[]> => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  try {
    const content = await fs.readFile(justfilePath, 'utf8');
    const dir = path.dirname(justfilePath);
    const imports: string[] = [];

    // Match: import[?] 'path' or import[?] "path"
    //        mod[?] name 'path' or mod[?] name "path"
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
