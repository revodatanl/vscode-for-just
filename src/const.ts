export const EXTENSION_NAME = 'vscode-just';

export const COMMANDS = {
  formatDocument: `${EXTENSION_NAME}.formatDocument`,
  runRecipe: `${EXTENSION_NAME}.runRecipe`,
  showRecipes: `${EXTENSION_NAME}.showRecipes`,
} as const;

export const SETTINGS = {
  justPath: 'justPath',
  lspPath: 'lspPath',
  enableLsp: 'enableLsp',
  runInTerminal: 'runInTerminal',
  useSingleTerminal: 'useSingleTerminal',
  logLevel: 'logLevel',
} as const;
