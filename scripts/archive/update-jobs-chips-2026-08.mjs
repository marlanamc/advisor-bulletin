#!/usr/bin/env node
/**
 * Rewrites service chips on the 5 live jobs resources. "Get career help"
 * was on 4 of 5 cards, and the Unemployment Assistance card carried "Find a
 * job program," which is misleading — that office pays benefits, it doesn't
 * run job programs. New chips are specific per resource. Only
 * serviceChips/services/highlights change.
 *
 * Usage:
 *   node scripts/update-jobs-chips-2026-08.mjs           # dry run
 *   node scripts/update-jobs-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'kY1Qv7hP5P3FLP2U09hW',
    title: 'Asian American Civic Association (AACA)',
    serviceChips: ['Get job training', 'Take English classes', 'Get community help'],
  },
  {
    id: 'ipBCBYM0hh7s6ZW66wOf',
    title: 'BEST Hospitality Training',
    serviceChips: ['Train for hotel & restaurant jobs', 'Practice job skills'],
  },
  {
    id: 'pkizk5s5rUJ4ZVAah624',
    title: 'JVS Boston',
    serviceChips: ['Get job training', 'Find a job program', 'Practice job skills'],
  },
  {
    id: 'zWD5bDlxTgckNSQCX55X',
    title: 'MA Department of Unemployment Assistance',
    serviceChips: ['Apply for unemployment benefits'],
  },
  {
    id: '4ONjF1DgFQ0pG2eCh9l5',
    title: 'MassHire Metro North Career Center (Chelsea)',
    serviceChips: ['Find a job program', 'Use free computers', 'Talk to a job counselor'],
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
    const changes = {
      serviceChips: u.serviceChips,
      services: u.serviceChips,
      highlights: u.serviceChips.join(', '),
    };
    if (u.description !== undefined) changes.description = u.description;
    if (u.summaryEs !== undefined) changes.summaryEs = u.summaryEs;

    if (!args.confirm) {
      const ref = db.collection(COLLECTION).doc(u.id);
      const snap = await ref.get();
      const data = snap.exists ? snap.data() : {};
      console.log(`[dry-run] ${u.title} (${u.id})`);
      console.log(`   chips before: ${JSON.stringify(data.serviceChips || data.services || [])}`);
      console.log(`   chips after:  ${JSON.stringify(u.serviceChips)}`);
      if (u.description !== undefined) {
        console.log(`   description before: ${JSON.stringify(data.description || '')}`);
        console.log(`   description after:  ${JSON.stringify(u.description)}`);
      }
      continue;
    }
    await db.collection(COLLECTION).doc(u.id).update({
      ...changes,
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
