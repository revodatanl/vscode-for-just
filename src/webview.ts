import * as vscode from 'vscode';
import yargsParser from 'yargs-parser';

import { getLauncher } from './launcher';
import { getLogger } from './logger';
import { getRecipes } from './recipe';
import { RecipeParsed } from './types';
import { getJustPath, getJustVersion, workspaceRoot } from './utils';

const LOGGER = getLogger();
const RECOMMENDED_VERSION = '1.47.1';

// --- Sidebar WebviewViewProvider ---

export class RecipesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vscode-just.recipesView';

  private view?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === 'run') {
        await runRecipeFromWebview(message.name, message.args);
      } else if (message.command === 'refresh') {
        await this.refresh();
      } else if (message.command === 'openUrl') {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
    });

    this.refresh();
  }

  async refresh() {
    if (!this.view) return;

    const recipes = await getRecipes();
    const root = workspaceRoot();
    const version = await getJustVersion();
    this.view.webview.html = getWebviewContent(recipes, root, version);
  }
}

// --- Command-opened panel ---

let currentPanel: vscode.WebviewPanel | undefined;

export const showRecipesPanel = async () => {
  if (currentPanel) {
    currentPanel.reveal();
    await refreshPanel();
    return;
  }

  currentPanel = vscode.window.createWebviewPanel(
    'justRecipes',
    'Just Recipes',
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  currentPanel.onDidDispose(() => {
    currentPanel = undefined;
  });

  currentPanel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === 'run') {
      await runRecipeFromWebview(message.name, message.args);
    } else if (message.command === 'refresh') {
      await refreshPanel();
    } else if (message.command === 'openUrl') {
      vscode.env.openExternal(vscode.Uri.parse(message.url));
    }
  });

  await refreshPanel();
};

const refreshPanel = async () => {
  if (!currentPanel) return;

  const recipes = await getRecipes();
  const root = workspaceRoot();
  const version = await getJustVersion();
  currentPanel.webview.html = getWebviewContent(recipes, root, version);
};

// --- Shared logic ---

const runRecipeFromWebview = async (name: string, args: string) => {
  const parsed = yargsParser(args);
  const cmdArgs = [name, ...parsed._.map(String)];

  LOGGER.info(`Running recipe: ${name} with args: ${cmdArgs.join(' ')}`);
  getLauncher().launch(getJustPath(), cmdArgs);
};

interface RecipeGroup {
  name: string;
  recipes: RecipeParsed[];
}

const groupRecipes = (
  recipes: RecipeParsed[],
): { groups: RecipeGroup[]; ungrouped: RecipeParsed[] } => {
  const groupMap = new Map<string, RecipeParsed[]>();
  const ungrouped: RecipeParsed[] = [];

  for (const recipe of recipes) {
    if (recipe.groups.length === 0) {
      ungrouped.push(recipe);
    } else {
      for (const group of recipe.groups) {
        if (!groupMap.has(group)) {
          groupMap.set(group, []);
        }
        groupMap.get(group)!.push(recipe);
      }
    }
  }

  const groups = Array.from(groupMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, recipes]) => ({
      name,
      recipes: recipes.sort((a, b) => a.name.localeCompare(b.name)),
    }));

  ungrouped.sort((a, b) => a.name.localeCompare(b.name));

  return { groups, ungrouped };
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
};

const PACKAGES_URL = 'https://just.systems/man/en/packages.html';

const renderVersionInfo = (version: string | undefined): string => {
  if (!version) {
    return `<div class="version-info version-warning">just not found on PATH</div>`;
  }

  const isOld = compareVersions(version, RECOMMENDED_VERSION) < 0;
  if (isOld) {
    return `<div class="version-info version-warning">just v${escapeHtml(version)} &mdash; v${RECOMMENDED_VERSION}+ recommended <a class="version-link" data-url="${PACKAGES_URL}">(update)</a></div>`;
  }

  return `<div class="version-info">just v${escapeHtml(version)}</div>`;
};

const renderRecipeCard = (recipe: RecipeParsed): string => {
  const params = recipe.parameters;
  const paramsHtml = params.length
    ? `<div class="params">
        ${params
          .map(
            (p) =>
              `<div class="param-row">
                <label>${escapeHtml(p.name)}</label>
                <input type="text" data-param="${escapeHtml(p.name)}" placeholder="${p.default != null ? escapeHtml(String(p.default)) : ''}" value="${p.default != null ? escapeHtml(String(p.default)) : ''}" />
              </div>`,
          )
          .join('')}
      </div>`
    : '';

  return `<div class="recipe-card">
    <div class="recipe-header">
      <span class="recipe-name">${escapeHtml(recipe.name)}</span>
      <button class="run-btn" data-recipe="${escapeHtml(recipe.name)}">Run</button>
    </div>
    ${recipe.doc ? `<div class="recipe-doc">${escapeHtml(recipe.doc)}</div>` : ''}
    ${paramsHtml}
  </div>`;
};

const renderGroup = (group: RecipeGroup, index: number): string => {
  return `<div class="group">
    <div class="group-header" data-group="${index}">
      <span class="group-toggle collapsed">&#9660;</span>
      <span class="group-name">${escapeHtml(group.name)}</span>
      <span class="group-count">${group.recipes.length} recipe${group.recipes.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="group-body collapsed" id="group-${index}">
      ${group.recipes.map(renderRecipeCard).join('')}
    </div>
  </div>`;
};

const getWebviewContent = (
  recipes: RecipeParsed[],
  root: string,
  version: string | undefined,
): string => {
  const { groups, ungrouped } = groupRecipes(recipes);
  const totalRecipes = recipes.length;
  const totalGroups = groups.length;

  const groupsHtml = groups.map((g, i) => renderGroup(g, i)).join('');
  const ungroupedHtml = ungrouped.map(renderRecipeCard).join('');
  const separator =
    groups.length > 0 && ungrouped.length > 0 ? '<hr class="separator" />' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 0;
    }

    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .header h1 {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .refresh-btn {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .refresh-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .header-path {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-bottom: 2px;
    }

    .header-stats {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    .version-info {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .version-warning {
      color: var(--vscode-editorWarning-foreground, #cca700);
    }

    .version-link {
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      text-decoration: underline;
    }

    .content {
      padding: 8px 4px;
    }

    .group {
      margin-bottom: 2px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px;
      cursor: pointer;
      user-select: none;
      border-radius: 3px;
    }

    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .group-toggle {
      font-size: 0.7em;
      transition: transform 0.15s;
      width: 12px;
      display: inline-block;
    }

    .group-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .group-name {
      font-weight: 600;
      font-size: 1.05em;
    }

    .group-count {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
    }

    .group-body {
      padding-left: 0;
      overflow: hidden;
    }

    .group-body.collapsed {
      display: none;
    }

    .recipe-card {
      border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      border-radius: 4px;
      padding: 4px 8px;
      margin: 2px 0;
      background: var(--vscode-editor-background);
    }

    .recipe-card:hover {
      border-color: var(--vscode-focusBorder);
    }

    .recipe-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }

    .recipe-name {
      font-weight: 600;
      font-size: 1em;
      color: var(--vscode-textLink-foreground);
    }

    .recipe-doc {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-bottom: 4px;
    }

    .params {
      margin: 4px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .param-row label {
      min-width: 80px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      color: var(--vscode-foreground);
    }

    .param-row input {
      flex: 1;
      min-width: 100px;
      max-width: 300px;
      padding: 3px 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
      border-radius: 2px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
    }

    .param-row input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      border-color: var(--vscode-focusBorder);
    }

    .run-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 16px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 0.85em;
    }

    .run-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .separator {
      border: none;
      border-top: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
      margin: 8px 0;
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <h1>Just Recipes</h1>
      <button class="refresh-btn" id="refreshBtn">Refresh</button>
    </div>
    <div class="header-path">${escapeHtml(root)}/justfile</div>
    <div class="header-stats">${totalRecipes} recipe${totalRecipes !== 1 ? 's' : ''}${totalGroups > 0 ? ` &middot; ${totalGroups} group${totalGroups !== 1 ? 's' : ''}` : ''}</div>
    ${renderVersionInfo(version)}
  </div>

  <div class="content">
    ${totalRecipes === 0 ? '<div class="empty-state">No recipes found. Check that your justfile is valid.</div>' : ''}
    ${groupsHtml}
    ${separator}
    ${ungroupedHtml}
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('refreshBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'refresh' });
    });

    document.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', () => {
        const groupIndex = header.dataset.group;
        const body = document.getElementById('group-' + groupIndex);
        const toggle = header.querySelector('.group-toggle');
        body.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
      });
    });

    document.querySelectorAll('.version-link').forEach(link => {
      link.addEventListener('click', () => {
        vscode.postMessage({ command: 'openUrl', url: link.dataset.url });
      });
    });

    document.querySelectorAll('.run-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.recipe-card');
        const recipeName = btn.dataset.recipe;
        const inputs = card.querySelectorAll('input[data-param]');
        const args = [];
        inputs.forEach(input => {
          if (input.value.trim()) {
            args.push(input.value.trim());
          }
        });
        vscode.postMessage({
          command: 'run',
          name: recipeName,
          args: args.join(' ')
        });
      });
    });
  </script>
</body>
</html>`;
};
