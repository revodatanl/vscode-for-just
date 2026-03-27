import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import * as vscode from 'vscode';
import yargsParser from 'yargs-parser';

import { EXTENSION_NAME, SETTINGS } from './const';
import { getLogger } from './logger';
import { getLauncher } from './terminal';
import { RecipeParameterKind, RecipeParsed, RecipeResponse } from './types';
import { getJustPath, workspaceRoot } from './utils';

const log = getLogger();
const execAsync = promisify(exec);

export const runRecipeCommand = async () => {
  let recipes: RecipeParsed[];
  try {
    recipes = await getRecipes();
  } catch {
    vscode.window.showErrorMessage('Failed to fetch recipes.');
    return;
  }
  if (!recipes.length) return;

  const selected = await selectRecipe(recipes);
  if (!selected) return;

  const args = await promptForArgs(selected);
  if (args === undefined) return;

  runRecipe(selected, yargsParser(args));
};

const selectRecipe = async (
  recipes: RecipeParsed[],
): Promise<RecipeParsed | undefined> => {
  const choices: vscode.QuickPickItem[] = recipes
    .map((r) => ({
      label: r.name,
      description: r.doc,
      detail: r.groups.length ? `Groups: ${r.groups.sort().join(', ')}` : '',
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const picked = await vscode.window.showQuickPick(choices, {
    placeHolder: 'Select a recipe to run',
  });

  return picked ? recipes.find((r) => r.name === picked.label) : undefined;
};

const promptForArgs = async (recipe: RecipeParsed): Promise<string | undefined> => {
  if (!recipe.parameters.length) return '';

  return vscode.window.showInputBox({
    placeHolder: `Enter arguments: ${paramsToString(recipe.parameters)}`,
  });
};

const getEvaluatedVariables = async (): Promise<Record<string, string>> => {
  try {
    const { stdout } = await execAsync(`${getJustPath()} --evaluate`, {
      cwd: workspaceRoot(),
    });
    const vars: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const match = line.match(/^(\S+)\s+:=\s+"(.*)"\s*$/);
      if (match) {
        vars[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }
    return vars;
  } catch {
    return {};
  }
};

export const getRecipes = async (): Promise<RecipeParsed[]> => {
  const cmd = `${getJustPath()} --dump --dump-format=json`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: workspaceRoot() });

    if (stderr) {
      log.error(stderr);
      throw new Error(stderr);
    }

    const evaluatedVars = await getEvaluatedVariables();
    return parseRecipes(stdout, evaluatedVars);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unknown error occurred.';
    log.error(message);
    throw new Error(message);
  }
};

const resolveDefault = (
  value: unknown,
  evaluatedVars: Record<string, string>,
): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value[0] === 'variable') {
    const varName = value[1] as string;
    return varName in evaluatedVars ? evaluatedVars[varName] : varName;
  }
  return String(value);
};

export const parseRecipes = (
  output: string,
  evaluatedVars: Record<string, string> = {},
): RecipeParsed[] => {
  const dump = JSON.parse(output);
  return (Object.values(dump.recipes) as RecipeResponse[])
    .filter((r) => !r.private && !r.attributes.some((attr) => attr === 'private'))
    .map(({ name, doc, parameters, attributes }) => ({
      name,
      doc,
      parameters: parameters.map((p) => ({
        ...p,
        default: resolveDefault(p.default, evaluatedVars) as unknown as string,
      })),
      groups: attributes
        .filter(
          (attr): attr is Record<string, string> =>
            typeof attr === 'object' && 'group' in attr,
        )
        .map((attr) => attr.group),
    }));
};

export const paramsToString = (params: RecipeParsed['parameters']): string =>
  params
    .sort((a, b) =>
      a.kind === RecipeParameterKind.PLUS ? 1 : a.name.localeCompare(b.name),
    )
    .map((p) => {
      const prefix = p.kind === RecipeParameterKind.PLUS ? '+' : '';
      const suffix = p.default != null ? `=${p.default}` : '';
      return `${prefix}${p.name}${suffix}`;
    })
    .join(' ');

const runRecipe = (recipe: RecipeParsed, parsed: yargsParser.Arguments) => {
  const args = [recipe.name, ...parsed._.map(String)];

  log.info(`Running recipe: ${recipe.name} with args: ${args.join(' ')}`);
  if (vscode.workspace.getConfiguration(EXTENSION_NAME).get(SETTINGS.runInTerminal)) {
    getLauncher().launch(getJustPath(), args);
  } else {
    runRecipeInBackground(args);
  }
};

const runRecipeInBackground = (args: string[]) => {
  const child = spawn(getJustPath(), args, { cwd: workspaceRoot() });
  child.stdout.on('data', (data: string) => log.info(data));
  child.stderr.on('data', (data: string) => log.info(data));
};
