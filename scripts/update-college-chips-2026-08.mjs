#!/usr/bin/env node
/**
 * Rewrites service chips on the 5 live college resources. "Go to college"
 * was on 3 of 5 cards (including OSFA, which isn't a college itself — it's
 * the financial-aid program that makes attending one free). Chips are kept
 * to actions the student takes; qualifying facts (cost, "ask your advisor
 * first", free-for-residents) stay in each description rather than
 * becoming non-actionable chips.
 *
 * Usage:
 *   node scripts/update-college-chips-2026-08.mjs           # dry run
 *   node scripts/update-college-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'NZf1fVhk0LQJiJI9kpWL',
    title: 'Bunker Hill Community College',
    serviceChips: ['Go to college', 'Get English support'],
  },
  {
    id: 'Wr5OxhlYHI2AVqLSbjDa',
    title: 'Help Paying for College (OSFA)',
    serviceChips: ['Get help paying for college'],
  },
  {
    id: 'OxBuTnTY0jKB5LluTMRy',
    title: 'Roxbury Community College',
    serviceChips: ['Go to college', 'Study health, business, or tech'],
  },
  {
    id: 'uegVzotHOvMeJ2fmHVQt',
    title: 'Center for Educational Documentation',
    serviceChips: ['Evaluate foreign diploma'],
  },
  {
    id: '0eVYeSFI5mYzoSfBwGnW',
    title: 'World Education Services (WES)',
    serviceChips: ['Evaluate foreign diploma'],
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
