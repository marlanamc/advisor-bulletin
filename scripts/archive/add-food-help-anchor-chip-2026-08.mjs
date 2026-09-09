#!/usr/bin/env node
/**
 * Restores a fast "I'm hungry" path to the homepage "Start with a topic"
 * shortcut bar. That bar surfaces the most common chip labels site-wide as
 * one-tap filters (see buildResourceNeedChipIndex in board-resources.js) —
 * "Get groceries" used to rank there because it was on 7 of 9 food cards,
 * but the Aug 2026 food chip rewrite deliberately spread food across
 * specific chips (fresh produce, hot meal, mobile truck, etc.), so no
 * single label was common enough to earn a shortcut slot anymore. Unlike
 * housing or health — where picking the *specific* right resource matters
 * — almost any food resource is a reasonable answer to "I'm hungry", so a
 * broad one-tap shortcut has real value here that it wouldn't elsewhere.
 *
 * Adds "Get food help" as an additional chip on every food resource
 * (appended after each card's specific, distinguishing chip so that stays
 * the first/most prominent thing shown), except FoodSource Hotline, whose
 * existing "Call for food help" is renamed to the exact shared label
 * instead of gaining a near-duplicate third chip.
 *
 * Usage:
 *   node scripts/add-food-help-anchor-chip-2026-08.mjs           # dry run
 *   node scripts/add-food-help-anchor-chip-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  { id: 'GYzJeniWH0opHwWchmUw', title: 'Eastie Farm', serviceChips: ['Get fresh produce', 'Accepts SNAP and HIP', 'Get food help'] },
  { id: 'pvlMYEM1KKdB4rmS1j0J', title: 'East Boston Soup Kitchen', serviceChips: ['Get a hot meal', 'No appointment needed', 'Get food help'] },
  { id: '3Z4kOOvc9CKKrCjKvF5u', title: 'BCYF Paris Street', serviceChips: ['Get grocery bags', 'Get food help'] },
  { id: 'fjkODcHh2e36UWlTkCpD', title: 'Central Community Church (Food Pantry)', serviceChips: ['Get fresh produce', 'Get emergency food', 'Get food help'] },
  { id: 'rVB5pS7wdbfg2YFq5xnN', title: 'East Boston Adult Family Shelter - Our Daily Bread Pantry', serviceChips: ['Get emergency food', 'ID not required', 'Get food help'] },
  { id: 'FdXxAGjLxT1AjhqycvTB', title: 'East Boston ABCD Mobile Food Pop‑Ups', serviceChips: ['Mobile food truck', 'Get food help'] },
  { id: 'lTmhiEkakugMzF3ENoeZ', title: 'Project Bread FoodSource Hotline', serviceChips: ['Get food help', 'Apply for SNAP'] },
  { id: 'RZM8G22VAVJ4C9ywlksI', title: 'East Boston ABCD (SNAP Assistance)', serviceChips: ['Apply for SNAP', 'Get food help'] },
  { id: 'esQ9KOR0Bicmf6eqLF8o', title: 'EBNHC Women, Infants & Children (WIC)', serviceChips: ['For pregnant women and young kids', 'Already qualify with MassHealth or SNAP', 'Get food help'] },
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
