#!/usr/bin/env node
/**
 * Eastie Farm's distribution hours change seasonally and couldn't be
 * verified against the live site. Replaces the static hours string with a
 * pointer to their text sign-up (and website) for the current schedule.
 *
 * Usage:
 *   node scripts/eastie-farm-hours-to-text-signup-2026-08.mjs           # dry run
 *   node scripts/eastie-farm-hours-to-text-signup-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const DOC_ID = 'GYzJeniWH0opHwWchmUw';

const hours =
  'Distribution days and times vary by season. Text "food" to (617) 207-6545 or check the website for the current schedule.';

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  if (!args.confirm) {
    console.log(`[dry-run] Eastie Farm (${DOC_ID})`);
    console.log(`   hours before: ${data.hours}`);
    console.log(`   hours after:  ${hours}`);
    console.log('\nDry run only — rerun with --confirm to write.');
    return;
  }

  await ref.update({
    hours,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Updated Eastie Farm (${DOC_ID})`);
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
