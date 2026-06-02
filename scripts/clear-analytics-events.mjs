#!/usr/bin/env node
/**
 * One-time cleanup: delete historical documents in the analyticsEvents collection.
 *
 * Engagement analytics are no longer collected by the app. Keep this script only
 * for removing old event documents after confirming historical stats are not needed.
 *
 * Use this after dev/testing inflated stats (localhost events are written to prod
 * until production-only tracking was added). Run with --dry-run first.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/clear-analytics-events.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/clear-analytics-events.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'analyticsEvents';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { dryRun: false, confirm: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/clear-analytics-events.mjs [--dry-run | --confirm]

Options:
  --dry-run     Count events that would be deleted (default if neither flag is set)
  --confirm     Actually delete all analyticsEvents documents
  --credentials=PATH  Service account JSON (or set GOOGLE_APPLICATION_CREDENTIALS)
`);
      process.exit(0);
    }
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

async function countCollection(db) {
  const snapshot = await db.collection(COLLECTION).count().get();
  return snapshot.data().count;
}

async function deleteInBatches(db) {
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(COLLECTION).limit(BATCH_SIZE).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
    console.log(`Deleted ${deleted} event(s) so far…`);
  }

  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun || !args.confirm;
  const db = await initAdminDb(args.credentials);

  const total = await countCollection(db);
  if (total === 0) {
    console.log('No analytics events found — nothing to delete.');
    process.exit(0);
  }

  if (dryRun) {
    console.log(`Found ${total} analytics event(s) in ${COLLECTION}.`);
    console.log('Dry run — no documents deleted. Re-run with --confirm to delete.');
    process.exit(0);
  }

  console.log(`Deleting ${total} analytics event(s) from ${COLLECTION}…`);
  const deleted = await deleteInBatches(db);
  console.log(`\nDone. Deleted ${deleted} analytics event(s).`);
}

main().catch((error) => {
  console.error('Clear analytics failed:', error.message || error);
  process.exit(1);
});
