#!/usr/bin/env node
// Asserts that the three lists governing a BULLETIN POST's category agree:
//
//   1. POST_CATEGORIES        src/feed-categories.js  — canonical: student filters + display labels
//   2. the post picker        src/post-composer.js    — CATS colour map + PRIMARY_CATS front row
//   3. the rules whitelist    firestore.rules         — data.category in [...] on create/update
//   4. getCatMeta             src/firebase-config.js  — live-render emoji/label per category
//   5. CATEGORY_META          src/student-snapshot.js — snapshot-render emoji/label per category
//
// Why this exists: the post picker used to be built from Object.keys(CATS),
// a chip-colour map shared with resource authoring. It therefore offered seven
// resource-tile categories (jobs, family, family-community, general, hse,
// legal-aid, consulates) that firestore.rules rejects, so choosing e.g.
// "Family & Community" failed the submit with a bare "Missing or insufficient
// permissions" that had nothing to do with the advisor's permissions — and the
// student feed had no filter for them either. Nothing compared the three lists,
// so the drift survived. Wired into package.json's prebuild so it fails the
// build instead of the advisor's post.
//
// Maps 4 and 5 both paint the same student feed -- CATEGORY_META renders the
// instant snapshot, then getCatMeta repaints from live Firestore. They had
// drifted on four emoji (food, immigration, money, announcement), so a student
// watching the page hydrate saw them flip. Nothing compared them, so this
// checks that both cover every canonical id and agree with it on the emoji.
// Labels are deliberately not compared: these surfaces legitimately use
// displayLabel, filterLabelEn and pickerShort for different purposes.
//
// Parsed with regexes rather than imported so this stays runnable in plain
// Node with no bundler and no DOM (post-composer.js touches `document`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const feedSrc = fs.readFileSync(path.join(repoRoot, 'src/feed-categories.js'), 'utf8');
const composerSrc = fs.readFileSync(path.join(repoRoot, 'src/post-composer.js'), 'utf8');
const rulesSrc = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const liveMetaSrc = fs.readFileSync(path.join(repoRoot, 'src/firebase-config.js'), 'utf8');
const snapshotMetaSrc = fs.readFileSync(path.join(repoRoot, 'src/student-snapshot.js'), 'utf8');

// Values a live post may legitimately carry that are not pickable in the
// composer, so the rules must keep accepting them on edit: 'resource' is the
// legacy category on resource-shaped posts, 'childcare' the retired post topic
// that POST_CATEGORY_ALIASES still maps 'family' onto.
const LEGACY_RULES_VALUES = new Set(['resource', 'childcare']);

const fail = (msg, ...details) => {
  console.error(`FAIL: ${msg}`);
  for (const d of details) console.error(`  ${d}`);
  process.exit(1);
};

function block(src, re, what) {
  const m = src.match(re);
  if (!m) fail(`${what} not found`);
  return m[1];
}

function tokens(chunk, what) {
  const found = [...chunk.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);
  if (found.length === 0) fail(`could not extract any tokens from ${what}`);
  return found;
}

// 1. POST_CATEGORIES — canonical ids, in order.
const postCatBlock = block(
  feedSrc,
  /export const POST_CATEGORIES\s*=\s*\[([\s\S]*?)\n\];/,
  'POST_CATEGORIES in src/feed-categories.js'
);
const canonical = [...postCatBlock.matchAll(/\bid:\s*'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);
if (canonical.length === 0) fail('POST_CATEGORIES contains no id: entries');

// Canonical emoji per id, for the render-map comparison below.
const canonicalEmoji = new Map(
  [...postCatBlock.matchAll(/\bid:\s*'([a-z][a-z0-9-]*)'[\s\S]*?\bemoji:\s*'([^']+)'/g)]
    .map((m) => [m[1], m[2]])
);
if (canonicalEmoji.size !== canonical.length) {
  fail('could not read an emoji for every POST_CATEGORIES entry');
}

// Pulls { key: { ... emoji: 'X' ... } } entries out of a hand-maintained
// render map so we can compare coverage and emoji against the canonical list.
function renderMapEmoji(src, re, what) {
  const chunk = block(src, re, what);
  const found = new Map(
    [...chunk.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?\s*:\s*\{[^\n]*?\bemoji:\s*'([^']+)'/gm)]
      .map((m) => [m[1], m[2]])
  );
  if (found.size === 0) fail(`could not extract any entries from ${what}`);
  return found;
}

// 4/5. The two student-feed render maps.
const renderMaps = [
  {
    what: 'getCatMeta in src/firebase-config.js',
    entries: renderMapEmoji(liveMetaSrc, /getCatMeta\(category\)\s*\{[\s\S]*?const map\s*=\s*\{([\s\S]*?)\n\s*\};/, 'getCatMeta in src/firebase-config.js'),
  },
  {
    what: 'CATEGORY_META in src/student-snapshot.js',
    entries: renderMapEmoji(snapshotMetaSrc, /const CATEGORY_META\s*=\s*\{([\s\S]*?)\n\};/, 'CATEGORY_META in src/student-snapshot.js'),
  },
];

// 2a. CATS — the composer's chip-colour map. Every canonical id needs one, or
//     POST_CAT_KEYS filters the category out and it silently stops being pickable.
const catsBlock = block(composerSrc, /const CATS\s*=\s*\{([\s\S]*?)\n\}/, 'CATS in src/post-composer.js');
const catsKeys = new Set(
  [...catsBlock.matchAll(/^\s*'?([a-z][a-z0-9-]*)'?\s*:\s*\{/gm)].map((m) => m[1])
);

// 2b. PRIMARY_CATS — the front row shown before "+ More topics".
const primary = tokens(
  block(composerSrc, /const PRIMARY_CATS\s*=\s*\[([^\]]*)\]/, 'PRIMARY_CATS in src/post-composer.js'),
  'PRIMARY_CATS'
);

// 3. The rules whitelist for a post's category.
const rules = tokens(
  block(rulesSrc, /data\.category in \[([^\]]*)\]/, 'post category whitelist in firestore.rules'),
  'firestore.rules post whitelist'
);

const canonicalSet = new Set(canonical);
const rulesSet = new Set(rules);

const missingColours = canonical.filter((k) => !catsKeys.has(k));
const missingFromRules = canonical.filter((k) => !rulesSet.has(k));
const unexplainedInRules = rules.filter((k) => !canonicalSet.has(k) && !LEGACY_RULES_VALUES.has(k));
const unpickablePrimary = primary.filter((k) => !canonicalSet.has(k));

const renderProblems = [];
for (const { what, entries } of renderMaps) {
  const missing = canonical.filter((k) => !entries.has(k));
  if (missing.length) {
    renderProblems.push(
      `In POST_CATEGORIES but missing from ${what}: ${missing.join(', ')}`,
      '  -> the student feed would fall back to a generic pin icon for these. Add an entry.'
    );
  }
  const wrongEmoji = canonical
    .filter((k) => entries.has(k) && entries.get(k) !== canonicalEmoji.get(k))
    .map((k) => `${k} (${entries.get(k)} should be ${canonicalEmoji.get(k)})`);
  if (wrongEmoji.length) {
    renderProblems.push(
      `Emoji in ${what} disagree with POST_CATEGORIES: ${wrongEmoji.join(', ')}`,
      '  -> students see the emoji change as the page hydrates. Match src/feed-categories.js.'
    );
  }
}

if (missingColours.length || missingFromRules.length || unexplainedInRules.length || unpickablePrimary.length || renderProblems.length) {
  const details = [];
  if (missingColours.length) {
    details.push(
      `In POST_CATEGORIES but missing from CATS in src/post-composer.js: ${missingColours.join(', ')}`,
      '  -> the composer would silently drop these from the picker. Add a CATS entry.'
    );
  }
  if (missingFromRules.length) {
    details.push(
      `In POST_CATEGORIES but not in firestore.rules: ${missingFromRules.join(', ')}`,
      "  -> advisors could pick these and the write would be denied with a bare " +
        '"Missing or insufficient permissions". Add them to the data.category whitelist and deploy the rules.'
    );
  }
  if (unexplainedInRules.length) {
    details.push(
      `In firestore.rules but not a post category: ${unexplainedInRules.join(', ')}`,
      '  -> either add it to POST_CATEGORIES (so students can filter it) or, if it is a value only' +
        ' legacy docs carry, add it to LEGACY_RULES_VALUES in this script with a note.'
    );
  }
  if (unpickablePrimary.length) {
    details.push(
      `In PRIMARY_CATS but not a post category: ${unpickablePrimary.join(', ')}`,
      '  -> the composer front row must only offer categories a post can be saved with.'
    );
  }
  details.push(...renderProblems);
  fail('post category lists out of sync.', ...details);
}

console.log(
  `OK: ${canonical.length} post categories in sync across POST_CATEGORIES, CATS, firestore.rules, ` +
  `getCatMeta and CATEGORY_META (${canonical.join(', ')})`
);
