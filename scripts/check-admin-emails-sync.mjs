#!/usr/bin/env node
// Asserts that the break-glass owner email list stays in sync across
// src/admin-roles.js (OWNER_ADMIN_EMAILS), firestore.rules (isOwnerAdmin) and
// storage.rules (isActiveAdvisor allowlist). Wired into package.json's
// prebuild script so a drift fails CI/local builds, same pattern as
// check-resource-categories-sync.mjs.
//
// NOTE: this is not the admin roster. Since Sep 2026 admins are advisors with
// advisors/{username}.isAdmin == true, managed from the portal's Advisors tab,
// and the only thing that flag grants is adding/removing people. The list
// checked here is purely the owner recovery hatch.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const canonicalSrc = fs.readFileSync(path.join(repoRoot, 'src/admin-roles.js'), 'utf8');
const rulesSrc = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const storageRulesSrc = fs.readFileSync(path.join(repoRoot, 'storage.rules'), 'utf8');

const canonicalMatch = canonicalSrc.match(
  /export const OWNER_ADMIN_EMAILS\s*=\s*\[([\s\S]*?)\]/
);
if (!canonicalMatch) {
  console.error('FAIL: OWNER_ADMIN_EMAILS not found in src/admin-roles.js');
  process.exit(1);
}
const canonical = [...canonicalMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

const rulesMatch = rulesSrc.match(
  /function isOwnerAdmin\(email\)\s*\{([\s\S]*?)\}/
);
if (!rulesMatch) {
  console.error('FAIL: isOwnerAdmin function not found in firestore.rules');
  process.exit(1);
}
const rules = [...rulesMatch[1].matchAll(/email == '([^']+)'/g)].map((m) => m[1]);

const storageMatch = storageRulesSrc.match(
  /request\.auth\.token\.email in \[([\s\S]*?)\]/
);
if (!storageMatch) {
  console.error('FAIL: owner break-glass allowlist not found in storage.rules');
  process.exit(1);
}
const storageEmails = [...storageMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

if (canonical.length === 0 || rules.length === 0 || storageEmails.length === 0) {
  console.error('FAIL: extracted an empty owner email list — check the regexes against the files.');
  process.exit(1);
}

const canonicalSet = new Set(canonical);

function diffAgainstCanonical(label, list) {
  const listSet = new Set(list);
  const missing = canonical.filter((e) => !listSet.has(e));
  const extra = list.filter((e) => !canonicalSet.has(e));
  if (missing.length || extra.length) {
    console.error('FAIL: owner break-glass email lists out of sync.');
    if (missing.length) {
      console.error(`  In src/admin-roles.js but not in ${label}: ${missing.join(', ')}`);
    }
    if (extra.length) {
      console.error(`  In ${label} but not in src/admin-roles.js: ${extra.join(', ')}`);
    }
    console.error(`Fix src/admin-roles.js and/or ${label} so the lists match, then deploy rules (see DEPLOYMENT.md).`);
    process.exit(1);
  }
}

diffAgainstCanonical('firestore.rules', rules);
diffAgainstCanonical('storage.rules', storageEmails);

console.log(`OK: ${canonical.length} break-glass owner email(s) in sync across admin-roles.js, firestore.rules, storage.rules (${canonical.join(', ')})`);
