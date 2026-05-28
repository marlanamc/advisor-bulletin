#!/usr/bin/env node
// Asserts that firestore.rules' resourceCategory whitelist matches the
// AUTHORABLE_RESOURCE_CATEGORIES list in src/resource-categories.js. Wired
// into package.json's prebuild script so a drift fails CI/local builds.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const canonicalPath = path.join(repoRoot, 'src/resource-categories.js');
const rulesPath = path.join(repoRoot, 'firestore.rules');

const canonicalSrc = fs.readFileSync(canonicalPath, 'utf8');
const rulesSrc = fs.readFileSync(rulesPath, 'utf8');

function parseStringArray(src, name, captureBlock) {
  // captureBlock is the substring containing a JS or rules-style array of
  // single-quoted strings. Extract every 'foo' token.
  const tokens = [...captureBlock.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);
  if (tokens.length === 0) {
    throw new Error(`Could not extract any tokens from ${name}`);
  }
  return tokens;
}

// Extract AUTHORABLE_RESOURCE_CATEGORIES = [ ... ]
const authorableMatch = canonicalSrc.match(
  /export const AUTHORABLE_RESOURCE_CATEGORIES\s*=\s*\[([\s\S]*?)\]/
);
if (!authorableMatch) {
  console.error('FAIL: AUTHORABLE_RESOURCE_CATEGORIES not found in src/resource-categories.js');
  process.exit(1);
}
const canonical = parseStringArray(canonicalSrc, 'AUTHORABLE_RESOURCE_CATEGORIES', authorableMatch[1]);

// Extract the resourceCategory whitelist from firestore.rules.
const rulesMatch = rulesSrc.match(/data\.resourceCategory in \[([^\]]*)\]/);
if (!rulesMatch) {
  console.error('FAIL: resourceCategory whitelist not found in firestore.rules');
  process.exit(1);
}
const rules = parseStringArray(rulesSrc, 'firestore.rules whitelist', rulesMatch[1]);

const canonicalSet = new Set(canonical);
const rulesSet = new Set(rules);

const missingFromRules = canonical.filter((k) => !rulesSet.has(k));
const extraInRules = rules.filter((k) => !canonicalSet.has(k));

if (missingFromRules.length || extraInRules.length) {
  console.error('FAIL: resourceCategory lists out of sync.');
  if (missingFromRules.length) {
    console.error(`  In canonical but not in firestore.rules: ${missingFromRules.join(', ')}`);
  }
  if (extraInRules.length) {
    console.error(`  In firestore.rules but not in canonical: ${extraInRules.join(', ')}`);
  }
  console.error('Fix src/resource-categories.js and/or firestore.rules so the lists match.');
  process.exit(1);
}

console.log(`OK: ${canonical.length} resource categories in sync (${canonical.join(', ')})`);
