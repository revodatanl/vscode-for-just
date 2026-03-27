import { readFileSync, writeFileSync } from 'node:fs';

const GRAMMAR_FILE = 'syntaxes/just.tmLanguage.json';
const OUTPUT_FILE = 'syntaxes/scopes';

const grammar = readFileSync(GRAMMAR_FILE, 'utf8');
const regex = /"name"\s*:\s*"(.*?\.just)"/g;

const scopes = new Set<string>();
for (const match of grammar.matchAll(regex)) {
  scopes.add(match[1]);
}

writeFileSync(OUTPUT_FILE, JSON.stringify(Array.from(scopes).sort(), null, 2));
