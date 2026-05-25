#!/usr/bin/env node
/**
 * Quick read-only diagnostic — dump description / summaryEs / hours for the
 * first N imported resources so we can see what actually landed in Firestore.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/inspect-imported-resources.mjs [--limit=10]
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

function parseArgs(argv) {
  const args = { limit: 10, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--limit=')) args.limit = Number(arg.slice('--limit='.length)) || 10;
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
    .where('importSource', '==', 'csv-import')
    .limit(args.limit)
    .get();

  console.log(`Found ${snapshot.size} imported docs. Showing first ${args.limit}:\n`);

  snapshot.forEach((doc) => {
    const d = doc.data();
    console.log(`──── ${d.titleEn || d.title || doc.id} (${d.resourceCategory || '?'}) ────`);
    console.log(`  description (${(d.description || '').length} chars): ${JSON.stringify(d.description || '').slice(0, 200)}`);
    console.log(`  summaryEs (${(d.summaryEs || '').length} chars): ${JSON.stringify(d.summaryEs || '').slice(0, 160)}`);
    console.log(`  hours: ${JSON.stringify(d.hours || '')}`);
    console.log(`  highlights: ${JSON.stringify(d.highlights || '')}`);
    console.log('');
  });
}

main().catch((error) => {
  console.error('Inspect failed:', error.message || error);
  process.exit(1);
});
