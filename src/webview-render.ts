import { RecipeParsed } from './types';

export interface RecipeGroup {
  name: string;
  recipes: RecipeParsed[];
}

export const groupRecipes = (
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

export const renderOpenFileBtn = (path: string): string =>
  `<button class="open-file-btn" data-path="${escapeHtml(path)}" title="Open file">` +
  `<svg viewBox="0 0 12 10"><path d="M1 5h9M7 2l3 3-3 3"/></svg>` +
  `</button>`;

export const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const compareVersions = (a: string, b: string): number => {
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
const RECOMMENDED_VERSION = '1.47.1';

export const renderVersionInfo = (version: string | undefined): string => {
  if (!version) {
    return `<div class="version-info version-warning">just not found on PATH</div>`;
  }

  const isOld = compareVersions(version, RECOMMENDED_VERSION) < 0;
  if (isOld) {
    return `<div class="version-info version-warning">just v${escapeHtml(version)} &mdash; v${RECOMMENDED_VERSION}+ recommended <a class="version-link" data-url="${PACKAGES_URL}">(update)</a></div>`;
  }

  return `<div class="version-info">just v${escapeHtml(version)}</div>`;
};

export const renderRecipeCard = (recipe: RecipeParsed): string => {
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

export const renderGroup = (group: RecipeGroup, index: number): string => {
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
