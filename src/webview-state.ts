import { getRecipes } from './recipe';
import { RecipeParsed } from './types';
import { getJustfileImports, getJustfilePath, getJustVersion } from './utils';
import {
  escapeHtml,
  groupRecipes,
  renderGroup,
  renderOpenFileBtn,
  renderRecipeCard,
  renderVersionInfo,
} from './webview-render';

// --- Types ---

export type StageStatus = 'idle' | 'loading' | 'ok' | 'error';

export interface StageUpdate {
  command: 'update';
  stage: 'cli' | 'justfile' | 'recipes';
  status: StageStatus;
  html: string;
}

export interface WebviewState {
  cli: { status: StageStatus; version?: string; error?: string };
  justfile: {
    status: StageStatus;
    path?: string;
    imports?: string[];
    error?: string;
  };
  recipes: { status: StageStatus; html?: string; error?: string };
}

type PostFn = (message: StageUpdate) => void;

// --- Per-stage sequence counters (race protection) ---

let seqCli = 0;
let seqJustfile = 0;
let seqRecipes = 0;

// --- State factory ---

export const createInitialState = (): WebviewState => ({
  cli: { status: 'idle' },
  justfile: { status: 'idle' },
  recipes: { status: 'idle' },
});

// --- Stage renderers ---

const renderLoading = (label: string): string =>
  `<div class="stage-loading"><span class="spinner-inline"></span> ${label}</div>`;

const renderError = (message: string, stage: string): string =>
  `<div class="stage-error">` +
  `<span class="error-icon-inline">&#9888;</span> ${escapeHtml(message)} ` +
  `<button class="stage-action-btn" data-stage="${stage}">Retry</button>` +
  `</div>`;

const renderCliOk = (version: string): string =>
  `<div class="stage-row">${renderVersionInfo(version)}</div>`;

const renderCliNotFound = (): string =>
  `<div class="stage-row">` +
  `${renderVersionInfo(undefined)} ` +
  `<button class="stage-action-btn" data-stage="cli">Recheck</button>` +
  `</div>`;

const renderJustfileOk = (filePath: string, imports: string[]): string => {
  const importsHtml =
    imports.length > 0
      ? `<button class="imports-toggle-btn" title="Show imported files">&#8595;</button>` +
        `<div class="imports-list collapsed">` +
        imports
          .map(
            (p) =>
              `<div class="import-path"><span>${escapeHtml(p)}</span>` +
              `${renderOpenFileBtn(p)}</div>`,
          )
          .join('') +
        `</div>`
      : '';

  return (
    `<div class="stage-row">` +
    `<span class="justfile-path">${escapeHtml(filePath)}</span> ` +
    `${renderOpenFileBtn(filePath)}` +
    `<button class="stage-action-btn" data-stage="justfile">&#8635;</button>` +
    `${importsHtml}` +
    `</div>`
  );
};

const renderRecipesOk = (recipes: RecipeParsed[]): string => {
  const { groups, ungrouped } = groupRecipes(recipes);
  const total = recipes.length;

  const statsHtml =
    `<div class="stage-row recipe-stats-row">` +
    `<span class="recipe-stats">${total} recipe${total !== 1 ? 's' : ''}${groups.length > 0 ? ` &middot; ${groups.length} group${groups.length !== 1 ? 's' : ''}` : ''}</span> ` +
    `<button class="stage-action-btn" data-stage="recipes">&#8635;</button>` +
    `</div>`;

  const groupsHtml = groups.map((g, i) => renderGroup(g, i)).join('');
  const ungroupedHtml = ungrouped.map(renderRecipeCard).join('');
  const separator =
    groups.length > 0 && ungrouped.length > 0 ? '<hr class="separator" />' : '';

  return total === 0
    ? `${statsHtml}<div class="empty-state">No recipes found. Check that your justfile is valid.</div>`
    : `${statsHtml}${groupsHtml}${separator}${ungroupedHtml}`;
};

// --- Helpers ---

const post = (
  fn: PostFn,
  stage: StageUpdate['stage'],
  status: StageStatus,
  html: string,
) => {
  fn({ command: 'update', stage, status, html });
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// --- Per-stage refresh functions ---

export const refreshCli = async (
  state: WebviewState,
  postFn: PostFn,
): Promise<void> => {
  const seq = ++seqCli;

  state.cli = { status: 'loading' };
  post(postFn, 'cli', 'loading', renderLoading('Checking just CLI&hellip;'));

  const version = await getJustVersion();
  if (seq !== seqCli) return;

  if (version) {
    state.cli = { status: 'ok', version };
    post(postFn, 'cli', 'ok', renderCliOk(version));
  } else {
    state.cli = { status: 'error', error: 'just CLI not found on PATH' };
    post(postFn, 'cli', 'error', renderCliNotFound());
  }
};

export const refreshJustfile = async (
  state: WebviewState,
  postFn: PostFn,
): Promise<void> => {
  const seq = ++seqJustfile;

  state.justfile = { status: 'loading' };
  post(postFn, 'justfile', 'loading', renderLoading('Locating justfile&hellip;'));

  try {
    const filePath = await getJustfilePath();
    if (seq !== seqJustfile) return;

    const imports = await getJustfileImports(filePath);
    if (seq !== seqJustfile) return;

    state.justfile = { status: 'ok', path: filePath, imports };
    post(postFn, 'justfile', 'ok', renderJustfileOk(filePath, imports));
  } catch (error) {
    if (seq !== seqJustfile) return;

    const msg = toErrorMessage(error);
    state.justfile = { status: 'error', error: msg };
    post(postFn, 'justfile', 'error', renderError(msg, 'justfile'));
  }
};

export const refreshRecipes = async (
  state: WebviewState,
  postFn: PostFn,
): Promise<void> => {
  const seq = ++seqRecipes;

  state.recipes = { status: 'loading' };
  post(postFn, 'recipes', 'loading', renderLoading('Loading recipes&hellip;'));

  try {
    const recipes = await getRecipes();
    if (seq !== seqRecipes) return;

    const html = renderRecipesOk(recipes);
    state.recipes = { status: 'ok', html };
    post(postFn, 'recipes', 'ok', html);
  } catch (error) {
    if (seq !== seqRecipes) return;

    const msg = toErrorMessage(error);
    state.recipes = { status: 'error', error: msg };
    post(postFn, 'recipes', 'error', renderError(msg, 'recipes'));
  }
};

// --- Send cached state (no fetching, immediate) ---

export const sendCachedState = (state: WebviewState, postFn: PostFn): void => {
  if (state.cli.status === 'ok' && state.cli.version) {
    post(postFn, 'cli', 'ok', renderCliOk(state.cli.version));
  } else if (state.cli.status === 'error') {
    post(postFn, 'cli', 'error', renderCliNotFound());
  }

  if (state.justfile.status === 'ok' && state.justfile.path) {
    post(
      postFn,
      'justfile',
      'ok',
      renderJustfileOk(state.justfile.path, state.justfile.imports ?? []),
    );
  } else if (state.justfile.status === 'error' && state.justfile.error) {
    post(postFn, 'justfile', 'error', renderError(state.justfile.error, 'justfile'));
  }

  if (state.recipes.status === 'ok' && state.recipes.html) {
    post(postFn, 'recipes', 'ok', state.recipes.html);
  } else if (state.recipes.status === 'error' && state.recipes.error) {
    post(postFn, 'recipes', 'error', renderError(state.recipes.error, 'recipes'));
  }
};

// --- Refresh only stages that need it ---

export const refreshNeeded = async (
  state: WebviewState,
  postFn: PostFn,
): Promise<void> => {
  const pending: Promise<void>[] = [];

  if (state.cli.status === 'idle' || state.cli.status === 'error') {
    pending.push(refreshCli(state, postFn));
  }
  if (state.justfile.status === 'idle' || state.justfile.status === 'error') {
    pending.push(refreshJustfile(state, postFn));
  }

  if (pending.length > 0) await Promise.all(pending);

  if (state.justfile.status !== 'ok') return;

  if (state.recipes.status === 'idle' || state.recipes.status === 'error') {
    await refreshRecipes(state, postFn);
  }
};
