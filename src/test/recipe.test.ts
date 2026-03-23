import * as assert from 'assert';

import { parseRecipes, paramsToString } from '../recipe';
import { RecipeParameterKind } from '../types';

const makeJustDumpJson = (recipes: Record<string, unknown>) =>
  JSON.stringify({ recipes });

suite('parseRecipes', () => {
  test('returns empty array for no recipes', () => {
    const result = parseRecipes(makeJustDumpJson({}));
    assert.deepStrictEqual(result, []);
  });

  test('parses a simple recipe', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        build: {
          name: 'build',
          doc: 'Build the project',
          parameters: [],
          attributes: [],
          private: false,
        },
      }),
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'build');
    assert.strictEqual(result[0].doc, 'Build the project');
    assert.deepStrictEqual(result[0].parameters, []);
    assert.deepStrictEqual(result[0].groups, []);
  });

  test('filters recipes with private flag', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        public: {
          name: 'public',
          doc: '',
          parameters: [],
          attributes: [],
          private: false,
        },
        hidden: {
          name: 'hidden',
          doc: '',
          parameters: [],
          attributes: [],
          private: true,
        },
      }),
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'public');
  });

  test('filters recipes with private attribute', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        public: {
          name: 'public',
          doc: '',
          parameters: [],
          attributes: [],
          private: false,
        },
        hidden: {
          name: 'hidden',
          doc: '',
          parameters: [],
          attributes: ['private'],
          private: false,
        },
      }),
    );

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'public');
  });

  test('extracts groups from attributes', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        deploy: {
          name: 'deploy',
          doc: '',
          parameters: [],
          attributes: [{ group: 'infra' }, { group: 'release' }],
          private: false,
        },
      }),
    );

    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].groups, ['infra', 'release']);
  });

  test('ignores non-group object attributes', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        test: {
          name: 'test',
          doc: '',
          parameters: [],
          attributes: ['no-cd', { group: 'ci' }, 'linux'],
          private: false,
        },
      }),
    );

    assert.deepStrictEqual(result[0].groups, ['ci']);
  });

  test('preserves recipe parameters', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        build: {
          name: 'build',
          doc: '',
          parameters: [
            { name: 'target', kind: 'singular', default: null },
            { name: 'flags', kind: 'plus', default: '' },
          ],
          attributes: [],
          private: false,
        },
      }),
    );

    assert.strictEqual(result[0].parameters.length, 2);
    assert.strictEqual(result[0].parameters[0].name, 'target');
    assert.strictEqual(result[0].parameters[1].name, 'flags');
  });

  test('handles multiple recipes with mixed visibility', () => {
    const result = parseRecipes(
      makeJustDumpJson({
        build: {
          name: 'build',
          doc: 'Build',
          parameters: [],
          attributes: [],
          private: false,
        },
        _helper: {
          name: '_helper',
          doc: '',
          parameters: [],
          attributes: [],
          private: true,
        },
        test: {
          name: 'test',
          doc: 'Test',
          parameters: [],
          attributes: [],
          private: false,
        },
        _internal: {
          name: '_internal',
          doc: '',
          parameters: [],
          attributes: ['private'],
          private: false,
        },
      }),
    );

    assert.strictEqual(result.length, 2);
    const names = result.map((r) => r.name).sort();
    assert.deepStrictEqual(names, ['build', 'test']);
  });
});

suite('paramsToString', () => {
  test('returns empty string for no params', () => {
    assert.strictEqual(paramsToString([]), '');
  });

  test('formats a singular param', () => {
    const result = paramsToString([
      { name: 'target', kind: RecipeParameterKind.SINGULAR, default: null as unknown as string },
    ]);
    assert.strictEqual(result, 'target');
  });

  test('formats a variadic param with + prefix', () => {
    const result = paramsToString([
      { name: 'files', kind: RecipeParameterKind.PLUS, default: null as unknown as string },
    ]);
    assert.strictEqual(result, '+files');
  });

  test('appends default value', () => {
    const result = paramsToString([
      { name: 'mode', kind: RecipeParameterKind.SINGULAR, default: 'release' },
    ]);
    assert.strictEqual(result, 'mode=release');
  });

  test('sorts variadic params after singular params', () => {
    const result = paramsToString([
      { name: 'extras', kind: RecipeParameterKind.PLUS, default: null as unknown as string },
      { name: 'target', kind: RecipeParameterKind.SINGULAR, default: null as unknown as string },
    ]);
    assert.strictEqual(result, 'target +extras');
  });

  test('sorts singular params alphabetically', () => {
    const result = paramsToString([
      { name: 'zebra', kind: RecipeParameterKind.SINGULAR, default: null as unknown as string },
      { name: 'alpha', kind: RecipeParameterKind.SINGULAR, default: null as unknown as string },
    ]);
    assert.strictEqual(result, 'alpha zebra');
  });

  test('formats mixed params with defaults', () => {
    const result = paramsToString([
      { name: 'files', kind: RecipeParameterKind.PLUS, default: null as unknown as string },
      { name: 'mode', kind: RecipeParameterKind.SINGULAR, default: 'debug' },
      { name: 'arch', kind: RecipeParameterKind.SINGULAR, default: null as unknown as string },
    ]);
    assert.strictEqual(result, 'arch mode=debug +files');
  });
});
