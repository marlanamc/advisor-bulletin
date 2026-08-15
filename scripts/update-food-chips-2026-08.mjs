#!/usr/bin/env node
/**
 * Rewrites service chips on the 9 live food resources (including WIC,
 * just moved into this category from Family). "Get groceries" was on 7 of
 * 9 cards. Also fixes Project Bread FoodSource Hotline, which had chips
 * claiming it hands out groceries/emergency food/hot meals directly — it's
 * a referral hotline, it doesn't distribute food itself.
 *
 * Usage:
 *   node scripts/update-food-chips-2026-08.mjs           # dry run
 *   node scripts/update-food-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'GYzJeniWH0opHwWchmUw',
    title: 'Eastie Farm',
    serviceChips: ['Get fresh produce', 'Accepts SNAP and HIP'],
  },
  {
    id: 'pvlMYEM1KKdB4rmS1j0J',
    title: 'East Boston Soup Kitchen',
    serviceChips: ['Get a hot meal', 'No appointment needed'],
  },
  {
    id: '3Z4kOOvc9CKKrCjKvF5u',
    title: 'BCYF Paris Street',
    serviceChips: ['Get grocery bags'],
  },
  {
    id: 'fjkODcHh2e36UWlTkCpD',
    title: 'Central Community Church (Food Pantry)',
    serviceChips: ['Get fresh produce', 'Get emergency food'],
  },
  {
    id: 'rVB5pS7wdbfg2YFq5xnN',
    title: 'East Boston Adult Family Shelter - Our Daily Bread Pantry',
    serviceChips: ['Get emergency food', 'ID not required'],
  },
  {
    id: 'FdXxAGjLxT1AjhqycvTB',
    title: 'East Boston ABCD Mobile Food Pop‑Ups',
    serviceChips: ['Mobile food truck'],
  },
  {
    id: 'lTmhiEkakugMzF3ENoeZ',
    title: 'Project Bread FoodSource Hotline',
    serviceChips: ['Call for food help', 'Apply for SNAP'],
  },
  {
    id: 'RZM8G22VAVJ4C9ywlksI',
    title: 'East Boston ABCD (SNAP Assistance)',
    serviceChips: ['Apply for SNAP'],
  },
  {
    id: 'esQ9KOR0Bicmf6eqLF8o',
    title: 'EBNHC Women, Infants & Children (WIC)',
    serviceChips: ['For pregnant women and young kids', 'Already qualify with MassHealth or SNAP'],
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
