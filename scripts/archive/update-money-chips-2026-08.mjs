#!/usr/bin/env node
/**
 * Rewrites service chips on the 4 live money resources. "Find your
 * benefits" was on 3 of 4 cards and did little differentiating work.
 * ABCD APAC's old chips also missed the tax help and cheaper-MBTA-pass
 * services its own description already mentions.
 *
 * Usage:
 *   node scripts/update-money-chips-2026-08.mjs           # dry run
 *   node scripts/update-money-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'xNjwFMQNy9PdEXHOtmtt',
    title: 'East Boston ABCD APAC',
    serviceChips: ['Get fuel help', 'Get tax help', 'Get cheaper transit'],
  },
  {
    id: 'eQwUy0g8u4c36n5PicxY',
    title: 'MA Department of Transitional Assistance (DTA)',
    serviceChips: ['Get cash help', 'Apply for SNAP'],
  },
  {
    id: 'JPm9kgAHjf1ltg4QyHKD',
    title: 'Find Your Funds (Tax Help)',
    serviceChips: ['Get tax help', 'Get money back on taxes'],
  },
  {
    id: 'NUCy4trgIRW9XKpXg482',
    title: 'MBTA Reduced Fare (Income-Eligible)',
    serviceChips: ['Get cheaper transit'],
  },
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  for (const u of UPDATES) {
    if (!args.confirm) {
      const ref = db.collection(COLLECTION).doc(u.id);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      console.log(`[dry-run] ${u.title} (${u.id})`);
      console.log(`   chips before: ${JSON.stringify(data.serviceChips || data.services || [])}`);
      console.log(`   chips after:  ${JSON.stringify(u.serviceChips)}`);
      continue;
    }
    await db.collection(COLLECTION).doc(u.id).update({
      serviceChips: u.serviceChips,
      services: u.serviceChips,
      highlights: u.serviceChips.join(', '),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Updated ${u.title} (${u.id})`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
