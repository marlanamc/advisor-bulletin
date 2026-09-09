#!/usr/bin/env node
/**
 * Rewrites service chips on the 3 live HSE resources. "Get training"
 * appeared on 2 of 3 cards without matching either one's actual
 * description (DESE's page is informational, not training; MassLINKS
 * already had "Take classes online" saying the same thing better). Also
 * surfaces HiSET's score-checking capability, which its old chips didn't
 * mention at all.
 *
 * Usage:
 *   node scripts/update-hse-chips-2026-08.mjs           # dry run
 *   node scripts/update-hse-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'v1y3hzvIONtX9BLeJ188',
    title: 'Learn About the HSE Test (DESE)',
    serviceChips: ['Learn about the HSE test', 'Compare GED and HiSET'],
  },
  {
    id: 'nnaMculsnndTpOWtnqF6',
    title: 'MassLINKS Free Online Classes',
    serviceChips: ['Take classes online', 'Take English classes'],
  },
  {
    id: 'AFJD1xzk8OBGa5KWD784',
    title: 'Massachusetts HiSET',
    serviceChips: ['Sign up for HiSET', 'Check your scores'],
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
