#!/usr/bin/env node
/**
 * Bulk-publish resources written by scripts/import-resources.mjs.
 *
 * Targets only docs with `importSource == 'csv-import'` and `isPublished == false`,
 * so it is safe to re-run and won't touch anything created by hand in the portal.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/publish-imported-resources.mjs [--dry-run]
 *
 *   # or pass a credentials path explicitly
 *   node scripts/publish-imported-resources.mjs --credentials=/path/to/sa.json
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
    throw new Error(
      'No service account found. Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=/path/to/sa.json'
    );
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
    .where('isPublished', '==', false)
    .get();

  if (snapshot.empty) {
    console.log('No imported drafts found — nothing to publish.');
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} imported draft resource(s).`);

  if (args.dryRun) {
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`[dry-run] would publish ${data.titleEn || data.title || doc.id} (${data.resourceCategory || '—'})`);
    });
    console.log(`\nDry run — ${snapshot.size} resource(s) ready to publish.`);
    process.exit(0);
  }

  const docs = snapshot.docs;
  let published = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_SIZE);
    slice.forEach((doc) => {
      batch.update(doc.ref, {
        isPublished: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    slice.forEach((doc) => {
      const data = doc.data();
      console.log(`Published ${data.titleEn || data.title || doc.id}`);
    });
    published += slice.length;
  }

  console.log(`\nPublished ${published} resource(s).`);
}

main().catch((error) => {
  console.error('Publish failed:', error.message || error);
  process.exit(1);
});
