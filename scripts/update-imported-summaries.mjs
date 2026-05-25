#!/usr/bin/env node
/**
 * Pushes the latest EN/ES summaries from seed-resource-descriptions.mjs
 * straight into Firestore — matched by orgName + resourceCategory on docs
 * with `importSource: 'csv-import'`. No delete/reimport needed.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/update-imported-summaries.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/update-imported-summaries.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { COPY } from './seed-resource-descriptions.mjs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const IMPORT_SOURCE = 'csv-import';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { dryRun: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

async function initAdminDb(credentialsPath) {
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
  return { db: admin.default.firestore(), admin: admin.default };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, admin } = await initAdminDb(args.credentials);

  const snapshot = await db.collection(COLLECTION)
    .where('importSource', '==', IMPORT_SOURCE)
    .get();

  if (snapshot.empty) {
    console.log('No imported resources found.');
    return;
  }

  const docs = snapshot.docs;
  console.log(`Found ${docs.length} imported resource(s).`);

  let matched = 0;
  let skipped = [];
  const updates = [];

  for (const doc of docs) {
    const data = doc.data();
    const org = data.titleEn || data.title || '';
    const cat = data.resourceCategory || '';
    const key = `${org}::${cat}`;
    const copy = COPY[key];
    if (!copy) {
      skipped.push(key);
      continue;
    }
    matched += 1;
    updates.push({ ref: doc.ref, key, copy, current: data });
  }

  console.log(`Matched: ${matched}`);
  if (skipped.length) {
    console.log(`Skipped (no COPY entry): ${skipped.length}`);
    skipped.forEach((k) => console.log(`  - ${k}`));
  }

  if (args.dryRun) {
    updates.slice(0, 5).forEach((u) => {
      console.log(`\n[dry-run] ${u.key}`);
      console.log(`   EN now: ${u.current.description || '(empty)'}`);
      console.log(`   EN new: ${u.copy.en}`);
      console.log(`   ES now: ${u.current.summaryEs || '(empty)'}`);
      console.log(`   ES new: ${u.copy.es}`);
    });
    if (updates.length > 5) console.log(`\n... and ${updates.length - 5} more.`);
    console.log('\nDry run — nothing written.');
    return;
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((u) => {
      batch.update(u.ref, {
        description: u.copy.en,
        summaryEs: u.copy.es,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    slice.forEach((u) => console.log(`Updated ${u.key}`));
  }

  console.log(`\nUpdated ${updates.length} resource(s).`);
}

main().catch((error) => {
  console.error('Update failed:', error.message || error);
  process.exit(1);
});
