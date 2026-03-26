import * as vscode from 'vscode';
import yargsParser from 'yargs-parser';

import { getLauncher } from './launcher';
import { getLogger } from './logger';
import { getJustPath } from './utils';
import { getShellContent } from './webview-html';
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

const LOGGER = getLogger();

// Shared state — persists across tab reopens within the session.
const state: WebviewState = createInitialState();

const makePostFn = (webview: vscode.Webview) => (message: StageUpdate) => {
  webview.postMessage(message);
};

const handleRefreshStage = async (
  stage: string,
  postFn: (message: StageUpdate) => void,
) => {
  if (stage === 'cli') {
    await refreshCli(state, postFn);
  } else if (stage === 'justfile') {
    await refreshJustfile(state, postFn);
  } else if (stage === 'recipes') {
    await refreshRecipes(state, postFn);
  }
};

// --- Sidebar WebviewViewProvider ---

export class RecipesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-just.recipesView';

  private view?: vscode.WebviewView;
  private messageListener?: vscode.Disposable;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    this.messageListener?.dispose();
    this.messageListener = webviewView.webview.onDidReceiveMessage(async (message) => {
      const postFn = makePostFn(webviewView.webview);
      if (message.command === 'run') {
        await runRecipeFromWebview(message.name, message.args);
      } else if (message.command === 'refresh') {
        await handleRefreshStage(message.stage, postFn);
      } else if (message.command === 'openUrl') {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.command === 'openFile') {
        openFileInEditor(message.path);
      } else if (message.command === 'ready') {
        sendCachedState(state, postFn);
        await refreshNeeded(state, postFn);
      }
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

  currentPanel.webview.onDidReceiveMessage(async (message) => {
    if (!currentPanel) return;
    const postFn = makePostFn(currentPanel.webview);

    if (message.command === 'run') {
      await runRecipeFromWebview(message.name, message.args);
    } else if (message.command === 'refresh') {
      await handleRefreshStage(message.stage, postFn);
    } else if (message.command === 'openUrl') {
      vscode.env.openExternal(vscode.Uri.parse(message.url));
    } else if (message.command === 'openFile') {
      openFileInEditor(message.path);
    } else if (message.command === 'ready') {
      sendCachedState(state, postFn);
      await refreshNeeded(state, postFn);
    }
  });

  currentPanel.webview.html = getShellContent();
};

// --- Shared logic ---

const openFileInEditor = (filePath: string) => {
  const uri = vscode.Uri.file(filePath);
  vscode.window.showTextDocument(uri, { preview: false });
};

const runRecipeFromWebview = async (name: string, args: string) => {
  const parsed = yargsParser(args);
  const cmdArgs = [name, ...parsed._.map(String)];

  LOGGER.info(`Running recipe: ${name} with args: ${cmdArgs.join(' ')}`);
  getLauncher().launch(getJustPath(), cmdArgs);
};
