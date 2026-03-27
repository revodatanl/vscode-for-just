import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';

import { EXTENSION_NAME, SETTINGS } from './const';
import { getLogger } from './logger';
import { workspaceRoot } from './utils';

const log = getLogger();

let client: LanguageClient | undefined;

export const createLanguageClient = async (): Promise<LanguageClient | null> => {
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
  if (!config.get(SETTINGS.enableLsp)) {
    log.info('Just LSP is disabled via settings.');
    return null;
  }

  const lspPath = getLspPath();
  const available = await checkLspAvailability(lspPath);

  if (!available) {
    log.warning(`Just LSP binary not found at path: ${lspPath}.`);
    vscode.window
      .showWarningMessage(
        `Just LSP binary not found at path: ${lspPath}. Please check the installation or configure the path in settings.`,
        'Install Instructions',
        "Don't Show Again",
      )
      .then((selection) => {
        if (selection === 'Install Instructions') {
          vscode.env.openExternal(
            vscode.Uri.parse('https://github.com/terror/just-lsp#installation'),
          );
        } else if (selection === "Don't Show Again") {
          config.update(SETTINGS.enableLsp, false, vscode.ConfigurationTarget.Global);
        }
      });
    return null;
  }

  const serverOptions: ServerOptions = {
    command: lspPath,
    args: [],
    options: { cwd: workspaceRoot() },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'just' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher(
        '**/{justfile,Justfile,.justfile,*.just}',
      ),
    },
  };

  client = new LanguageClient(
    'just-lsp',
    'Just Language Server',
    serverOptions,
    clientOptions,
  );

  try {
    await client.start();
    log.info(`Just LSP started successfully using: ${lspPath}`);
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to start Just LSP: ${message}`);
    vscode.window.showErrorMessage(`Failed to start Just Language Server: ${message}`);
    return null;
  }
};

export const stopLanguageClient = async (): Promise<void> => {
  if (client) {
    await client.stop();
    client = undefined;
  }
};

const checkLspAvailability = (lspPath: string): Promise<boolean> =>
  new Promise((resolve) => {
    const child = spawn(lspPath, ['--version'], {
      stdio: 'ignore',
      cwd: workspaceRoot(),
    });

    child.on('close', (code: number) => resolve(code === 0));
    child.on('error', () => resolve(false));

    setTimeout(() => {
      child.kill();
      resolve(false);
    }, 5000);
  });

const getLspPath = (): string =>
  (vscode.workspace
    .getConfiguration(EXTENSION_NAME)
    .get(SETTINGS.lspPath) as string) || 'just-lsp';
