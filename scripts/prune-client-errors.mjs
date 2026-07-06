#!/usr/bin/env node
/**
 * Prune old documents in the errors collection (client-side error logging).
 *
 * Errors accumulate from student and admin pages. This script deletes docs
 * whose createdAt is older than RETENTION_DAYS to keep Firestore growth bounded.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/prune-client-errors.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/prune-client-errors.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'errors';
const BATCH_SIZE = 400;
const RETENTION_DAYS = 90;

function parseArgs(argv) {
  const args = { dryRun: false, confirm: false, credentials: null, days: RETENTION_DAYS };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--days=')) {
      const parsed = Number(arg.slice('--days='.length));
      if (Number.isFinite(parsed) && parsed > 0) args.days = parsed;
    }
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/prune-client-errors.mjs [--dry-run | --confirm]

Options:
  --dry-run           Count errors that would be deleted (default if neither flag is set)
  --confirm           Actually delete matched error documents
  --days=N            Retention window in days (default: ${RETENTION_DAYS})
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

function cutoffTimestamp(days) {
  const ms = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

async function countStaleErrors(db, cutoff) {
  const snapshot = await db.collection(COLLECTION)
    .where('createdAt', '<', cutoff)
    .count()
    .get();
  return snapshot.data().count;
}

async function deleteStaleInBatches(db, cutoff) {
  let deleted = 0;

  while (true) {
    const snapshot = await db.collection(COLLECTION)
      .where('createdAt', '<', cutoff)
      .limit(BATCH_SIZE)
      .get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.docs.length;
    console.log(`Deleted ${deleted} error(s) so far…`);
  }

  return deleted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun || !args.confirm;
  const db = await initAdminDb(args.credentials);
  const cutoff = cutoffTimestamp(args.days);

  const staleCount = await countStaleErrors(db, cutoff);
  if (staleCount === 0) {
    console.log(`No error documents older than ${args.days} days — nothing to prune.`);
    process.exit(0);
  }

  if (dryRun) {
    console.log(`Found ${staleCount} error document(s) older than ${args.days} days (before ${cutoff.toISOString()}).`);
    console.log('Dry run — no documents deleted. Re-run with --confirm to delete.');
    process.exit(0);
  }

  console.log(`Deleting ${staleCount} error document(s) older than ${args.days} days…`);
  const deleted = await deleteStaleInBatches(db, cutoff);
  console.log(`\nDone. Deleted ${deleted} error document(s).`);
}

main().catch((error) => {
  console.error('Prune errors failed:', error.message || error);
  process.exit(1);
});
