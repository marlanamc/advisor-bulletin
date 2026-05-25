#!/usr/bin/env node
/**
 * Delete every resource document that came from the CSV importer.
 *
 * Targets only docs with `importSource == 'csv-import'`. Anything an advisor
 * created by hand in the portal is left untouched.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/delete-imported-resources.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/delete-imported-resources.mjs
 */

import { readFileSync, existsSync } from 'node:fs';

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
  return admin.default.firestore();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);

  const snapshot = await db.collection(COLLECTION)
    .where('importSource', '==', IMPORT_SOURCE)
    .get();

  if (snapshot.empty) {
    console.log('No imported resources found — nothing to delete.');
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} imported resource(s).`);

  if (args.dryRun) {
    snapshot.forEach((doc) => {
      const d = doc.data();
      console.log(`[dry-run] would delete ${d.titleEn || d.title || doc.id} (${d.resourceCategory || '?'})`);
    });
    console.log(`\nDry run — ${snapshot.size} resource(s) would be deleted.`);
    process.exit(0);
  }

  const docs = snapshot.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    slice.forEach((doc) => {
      const d = doc.data();
      console.log(`Deleted ${d.titleEn || d.title || doc.id}`);
    });
    deleted += slice.length;
  }

  console.log(`\nDeleted ${deleted} resource(s).`);
}

main().catch((error) => {
  console.error('Delete failed:', error.message || error);
  process.exit(1);
});
