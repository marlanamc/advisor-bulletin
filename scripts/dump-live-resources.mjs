#!/usr/bin/env node
/**
 * Read-only dump of live resource-type bulletins straight from Firestore —
 * use this instead of public/student-feed-snapshot.json for anything that
 * needs current data. The snapshot file is a first-paint cache only
 * refreshed on push-to-main or a daily cron; it can be arbitrarily stale
 * relative to edits made directly in the Advisor Portal.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/dump-live-resources.mjs [--category=housing] [--json]
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

function parseArgs(argv) {
  const args = { category: null, json: false, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--category=')) args.category = arg.slice('--category='.length);
    else if (arg === '--json') args.json = true;
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

  let query = db.collection(COLLECTION).where('type', '==', 'resource');
  if (args.category) {
    query = query.where('resourceCategory', '==', args.category);
  }

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.titleEn || d.title || '',
      category: d.resourceCategory || '',
      url: d.url || '',
      actionLinks: d.actionLinks || [],
      isPublished: d.isPublished !== false,
    };
  });

  if (args.json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), count: rows.length, items: rows }, null, 2));
    return;
  }

  console.log(`Live resources (fetched just now): ${rows.length}\n`);
  for (const r of rows) {
    console.log(`──── ${r.title} (${r.category}) ────`);
    console.log(`  url: ${r.url}`);
    console.log(`  actionLinks: ${r.actionLinks.length ? r.actionLinks.map((l) => l.labelEn).join(', ') : '(none)'}`);
    console.log('');
  }
}

main().catch((error) => {
  console.error('Dump failed:', error.message || error);
  process.exit(1);
});
