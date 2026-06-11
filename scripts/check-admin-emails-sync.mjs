#!/usr/bin/env node
// Asserts that firestore.rules' isPrivilegedAdvisor email list matches
// PRIVILEGED_ADMIN_EMAILS in src/admin-roles.js. Wired into package.json's
// prebuild script so a drift fails CI/local builds, same pattern as
// check-resource-categories-sync.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const canonicalSrc = fs.readFileSync(path.join(repoRoot, 'src/admin-roles.js'), 'utf8');
const rulesSrc = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');

const canonicalMatch = canonicalSrc.match(
  /export const PRIVILEGED_ADMIN_EMAILS\s*=\s*\[([\s\S]*?)\]/
);
if (!canonicalMatch) {
  console.error('FAIL: PRIVILEGED_ADMIN_EMAILS not found in src/admin-roles.js');
  process.exit(1);
}
const canonical = [...canonicalMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const rulesMatch = rulesSrc.match(
  /function isPrivilegedAdvisor\(email\)\s*\{([\s\S]*?)\}/
);
if (!rulesMatch) {
  console.error('FAIL: isPrivilegedAdvisor function not found in firestore.rules');
  process.exit(1);
}
const rules = [...rulesMatch[1].matchAll(/email == '([^']+)'/g)].map((m) => m[1]);

if (canonical.length === 0 || rules.length === 0) {
  console.error('FAIL: extracted an empty admin email list — check the regexes against the files.');
  process.exit(1);
}

const canonicalSet = new Set(canonical);
const rulesSet = new Set(rules);
const missingFromRules = canonical.filter((e) => !rulesSet.has(e));
const extraInRules = rules.filter((e) => !canonicalSet.has(e));

if (missingFromRules.length || extraInRules.length) {
  console.error('FAIL: privileged admin email lists out of sync.');
  if (missingFromRules.length) {
    console.error(`  In src/admin-roles.js but not in firestore.rules: ${missingFromRules.join(', ')}`);
  }
  if (extraInRules.length) {
    console.error(`  In firestore.rules but not in src/admin-roles.js: ${extraInRules.join(', ')}`);
  }
  console.error('Fix src/admin-roles.js and/or firestore.rules so the lists match, then deploy rules (see DEPLOYMENT.md).');
  process.exit(1);
}

console.log(`OK: ${canonical.length} privileged admin emails in sync (${canonical.join(', ')})`);
