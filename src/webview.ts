import * as vscode from 'vscode';
import yargsParser from 'yargs-parser';

import { getLauncher } from './terminal';
import { getLogger } from './logger';
import { getJustPath } from './utils';
import { getShellContent } from './webview-render';
import {
  createInitialState,
  refreshCli,
  refreshJustfile,
  refreshNeeded,
  refreshRecipes,
  sendCachedState,
  type StageUpdate,
  type WebviewState,
} from './webview-state';

const log = getLogger();

const state: WebviewState = createInitialState();

const makePostFn = (webview: vscode.Webview) => (message: StageUpdate) => {
  webview.postMessage(message);
};

const handleRefreshStage = async (
  stage: string,
  postFn: (message: StageUpdate) => void,
) => {
  if (stage === 'cli') await refreshCli(state, postFn);
  else if (stage === 'justfile') await refreshJustfile(state, postFn);
  else if (stage === 'recipes') await refreshRecipes(state, postFn);
};

const handleMessage = async (
  message: Record<string, string>,
  postFn: (msg: StageUpdate) => void,
) => {
  switch (message.command) {
    case 'run':
      await runRecipeFromWebview(message.name, message.args);
      break;
    case 'refresh':
      await handleRefreshStage(message.stage, postFn);
      break;
    case 'openUrl':
      vscode.env.openExternal(vscode.Uri.parse(message.url));
      break;
    case 'openFile':
      openFileInEditor(message.path);
      break;
    case 'ready':
      sendCachedState(state, postFn);
      await refreshNeeded(state, postFn);
      break;
  }
};

// --- Sidebar WebviewViewProvider ---

export class RecipesViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'vscode-just.recipesView';

  private messageListener?: vscode.Disposable;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = { enableScripts: true };

    this.messageListener?.dispose();
    this.messageListener = webviewView.webview.onDidReceiveMessage((message) => {
      handleMessage(message, makePostFn(webviewView.webview)).catch((err) =>
        log.error(`Webview message error: ${err}`),
      );
    });

    webviewView.webview.html = getShellContent();
  }
}

// --- Command-opened panel ---

let currentPanel: vscode.WebviewPanel | undefined;

export const showRecipesPanel = async () => {
  if (currentPanel) {
    currentPanel.reveal();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'justRecipes',
    'Just Recipes',
    vscode.ViewColumn.One,
    { enableScripts: true, localResourceRoots: [] },
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  currentPanel.webview.onDidReceiveMessage((message) => {
    if (!currentPanel) return;
    handleMessage(message, makePostFn(currentPanel.webview)).catch((err) =>
      log.error(`Webview message error: ${err}`),
    );
  });

  currentPanel.webview.html = getShellContent();
};

// --- Shared logic ---

const openFileInEditor = (filePath: string) => {
  vscode.window.showTextDocument(vscode.Uri.file(filePath), { preview: false });
};

const runRecipeFromWebview = async (name: string, args: string) => {
  const parsed = yargsParser(args);
  const cmdArgs = [name, ...parsed._.map(String)];

  log.info(`Running recipe: ${name} with args: ${cmdArgs.join(' ')}`);
  getLauncher().launch(getJustPath(), cmdArgs);
};
