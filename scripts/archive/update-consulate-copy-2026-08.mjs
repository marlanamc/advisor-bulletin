#!/usr/bin/env node
/**
 * Rewrites the description and summaryEs on the nine consulate cards that
 * scripts/add-consulates-2026-08.mjs already wrote to Firestore, bringing the
 * live docs in line with the shortened El Salvador-style copy.
 *
 * The copy is read out of add-consulates-2026-08.mjs rather than duplicated
 * here. That script stays the single source of truth for what a consulate
 * card says, so the two cannot drift — edit the copy there and re-run this.
 *
 * Only description and summaryEs are touched. Hours, addresses, phones, chips
 * and publish state are left exactly as they are, because an advisor may have
 * corrected them by hand during the verification pass and this script must
 * not stomp that work.
 *
 * Docs are matched on titleEn. A card that cannot be found is reported and
 * skipped, never created — this script only updates.
 *
 * Usage:
 *   node scripts/update-consulate-copy-2026-08.mjs           # dry run
 *   node scripts/update-consulate-copy-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const SOURCE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'add-consulates-2026-08.mjs');

/**
 * Pulls { titleEn, description, summaryEs } out of the seed script's
 * NEW_RESOURCES array. Reading the literal source keeps one copy of the text
 * in the repo; importing the module instead would run its main() on load.
 */
function readCanonicalCopy() {
  const source = readFileSync(SOURCE_SCRIPT, 'utf8');
  const start = source.indexOf('const NEW_RESOURCES = [');
  if (start === -1) throw new Error('Could not find NEW_RESOURCES in the seed script.');

  // Each card is a block starting at `titleEn:` and running to the next one.
  const cardPattern = /titleEn: '([^']+)',[\s\S]*?description: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),[\s\S]*?summaryEs: ("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'),/g;
  const unquote = (literal) => literal.slice(1, -1).replace(/\\(['"\\])/g, '$1');

  const cards = [];
  let match;
  while ((match = cardPattern.exec(source.slice(start))) !== null) {
    cards.push({
      titleEn: match[1],
      description: unquote(match[2]),
      summaryEs: unquote(match[3]),
    });
  }
  if (cards.length === 0) throw new Error('Parsed no cards out of the seed script.');
  return cards;
}

function parseArgs(argv) {
  const args = { confirm: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

async function initAdmin(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=...');
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return admin.default;
}

async function findByTitle(db, title) {
  const snapshot = await db
    .collection(COLLECTION)
    .where('type', '==', 'resource')
    .where('titleEn', '==', title)
    .get();
  if (snapshot.empty) return null;
  if (snapshot.size > 1) {
    console.warn(`! "${title}" matched ${snapshot.size} docs — updating the first only. Check for duplicates.`);
  }
  return snapshot.docs[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cards = readCanonicalCopy();

  if (!args.confirm) {
    for (const card of cards) {
      console.log(`[dry-run] ${card.titleEn}`);
      console.log(`   EN (${card.description.split(/\s+/).length} words): ${card.description}`);
      console.log(`   ES (${card.summaryEs.split(/\s+/).length} words): ${card.summaryEs}`);
      console.log('');
    }
    console.log(`${cards.length} cards would have description + summaryEs rewritten.`);
    console.log('Nothing else is touched. Re-run with --confirm to write.');
    return;
  }

  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  let updated = 0;
  let unchanged = 0;
  const missing = [];

  for (const card of cards) {
    const docSnap = await findByTitle(db, card.titleEn);
    if (!docSnap) {
      missing.push(card.titleEn);
      console.warn(`! Not found: "${card.titleEn}" — skipped.`);
      continue;
    }

    const current = docSnap.data();
    if (current.description === card.description && current.summaryEs === card.summaryEs) {
      unchanged += 1;
      console.log(`= ${card.titleEn} — already current.`);
      continue;
    }

    await docSnap.ref.update({
      description: card.description,
      summaryEs: card.summaryEs,
      updatedAt: FieldValue.serverTimestamp(),
    });
    updated += 1;
    console.log(`✓ ${card.titleEn} (${docSnap.id})`);
  }

  console.log(`\n${updated} updated, ${unchanged} already current, ${missing.length} not found.`);
  if (missing.length) {
    console.log('\nNot found — check whether these titles were edited in the Advisor Portal:');
    for (const title of missing) console.log(`  - ${title}`);
  }
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
