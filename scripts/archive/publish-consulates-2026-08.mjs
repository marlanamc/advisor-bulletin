#!/usr/bin/env node
/**
 * Publishes the nine consulate cards that scripts/add-consulates-2026-08.mjs
 * created as unpublished drafts.
 *
 * Those cards were written unpublished so an advisor could verify each
 * address, phone and hours before students saw them. The Advisor Portal has
 * no visible publish control, though — `resourcePublished` is a hidden input
 * pinned to 'on' (post-composer.js) — so a hidden resource cannot be brought
 * back from the UI. This is that missing step, done once for this batch.
 *
 * No resource in this app has ever actually been hidden: all 78 live
 * resources are published, and the dashboard's "hidden resources" stat was
 * removed back in June 2026 for being useless. The draft state exists in the
 * data model but is not part of how resources are really used, so this script
 * is a one-off for the verification pass, not a workflow to build on.
 *
 * Only isPublished is written. Every other field is left alone, including any
 * corrections an advisor made by hand during verification.
 *
 * Usage:
 *   node scripts/publish-consulates-2026-08.mjs           # dry run
 *   node scripts/publish-consulates-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const TITLES = [
  'Consulate General of Brazil — Boston',
  'Consulate General of Cape Verde — Quincy',
  'Consulate General of Colombia — Boston',
  'Consulate General of the Dominican Republic — Boston',
  'Consulate General of Guatemala — Providence, RI',
  'Consulate General of Haiti — Boston',
  'Consulate of Honduras — Chelsea',
  'Consulate General of Mexico — Boston',
  'Consulate General of Peru — Boston',
];

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
    console.warn(`! "${title}" matched ${snapshot.size} docs — publishing the first only. Check for duplicates.`);
  }
  return snapshot.docs[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.confirm) {
    for (const title of TITLES) console.log(`[dry-run] PUBLISH "${title}"`);
    console.log(`\n${TITLES.length} cards would be published (isPublished: true).`);
    console.log('Nothing else is touched. Re-run with --confirm to write.');
    return;
  }

  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  let published = 0;
  let already = 0;
  const missing = [];

  for (const title of TITLES) {
    const docSnap = await findByTitle(db, title);
    if (!docSnap) {
      missing.push(title);
      console.warn(`! Not found: "${title}" — skipped.`);
      continue;
    }

    if (docSnap.data().isPublished !== false) {
      already += 1;
      console.log(`= ${title} — already published.`);
      continue;
    }

    await docSnap.ref.update({
      isPublished: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    published += 1;
    console.log(`✓ ${title} (${docSnap.id}) is now live.`);
  }

  console.log(`\n${published} published, ${already} already live, ${missing.length} not found.`);
  if (missing.length) {
    console.log('\nNot found — check whether these titles were edited in the Advisor Portal:');
    for (const title of missing) console.log(`  - ${title}`);
  }
  if (published > 0) {
    console.log('\nThese are now visible to students. The student feed snapshot refreshes');
    console.log('on its own schedule; run scripts/build-student-feed-snapshot.mjs to');
    console.log('update it immediately.');
  }
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
