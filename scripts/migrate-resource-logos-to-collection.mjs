#!/usr/bin/env node
/**
 * One-time migration: moves resource logos out of the bulletins collection
 * (stored inline as base64 data URLs) into their own `resourceLogos`
 * collection, keyed by bulletin doc ID. See src/resource-logos.js for why —
 * short version: the board's single always-on query loads every active
 * bulletin on every visit, and 63 inline logos added ~7MB of base64 text to
 * that one query.
 *
 * Firebase Storage would be the cleaner home for these, but this project's
 * billing account is disabled, so Storage uploads fail outright. This script
 * stays on Firestore documents instead, which don't require billing on the
 * free Spark plan.
 *
 * Dry-run by default — prints what it would change. Safe to re-run: any
 * bulletin whose resourceLogo is no longer a base64 string is skipped.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/migrate-resource-logos-to-collection.mjs           # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/migrate-resource-logos-to-collection.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const LOGO_COLLECTION = 'resourceLogos';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { confirm: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
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

  const snapshot = await db.collection(COLLECTION).where('type', '==', 'resource').get();
  console.log(`Found ${snapshot.size} resource doc(s).`);

  const toMigrate = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const logo = data.resourceLogo;
    if (typeof logo === 'string' && logo.startsWith('data:image/')) {
      toMigrate.push({ id: doc.id, title: data.titleEn || data.title || doc.id, logo });
    }
  });

  console.log(`${toMigrate.length} logo(s) still stored inline as base64.`);

  if (!args.confirm) {
    toMigrate.forEach((r) => console.log(`  [dry-run] would migrate: ${r.title} (${Math.round(r.logo.length / 1024)}KB base64)`));
    console.log('\nDry run — pass --confirm to write to the resourceLogos collection.');
    return;
  }

  let migrated = 0;
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const slice = toMigrate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((r) => {
      batch.set(db.collection(LOGO_COLLECTION).doc(r.id), {
        dataUrl: r.logo,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batch.update(db.collection(COLLECTION).doc(r.id), {
        resourceLogo: admin.firestore.FieldValue.delete(),
        hasResourceLogo: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    slice.forEach((r) => console.log(`Migrated: ${r.title}`));
    migrated += slice.length;
  }

  console.log(`\nMigrated ${migrated} logo(s).`);
}

main().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exit(1);
});
