#!/usr/bin/env node
/**
 * Tightens service chips on 4 of the 8 live family resources. This
 * category was already reasonably differentiated (max overlap was 2 of 8
 * before this pass), but a few cards had chips that either restated each
 * other (Head Start), included a chip unsupported by the description
 * (Home for Little Wanderers' "Get groceries"), or used generic filler
 * where the description actually names something distinctive (Salvation
 * Army's after-school program and holiday help; Family Nurturing Center's
 * home visits). Boston Public Library, Ollie Diaper Depot, ABCD Clothing &
 * Essentials, and Central Community Church (Clothing) were already clean
 * and are left untouched.
 *
 * Usage:
 *   node scripts/update-family-chips-2026-08.mjs           # dry run
 *   node scripts/update-family-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: '7JJfDHjpcnpksXd4WeCi',
    title: 'East Boston Head Start',
    serviceChips: ['Find preschool', 'Find childcare'],
  },
  {
    id: 'eFM0C58XW3ggLkz3wtXM',
    title: 'The Home for Little Wanderers – Family Resource Centers',
    serviceChips: ['Take parenting classes', 'Take English classes', 'Get diapers'],
  },
  {
    id: 'm5is5IAec1EYNmsJ4O0X',
    title: 'Family Nurturing Center',
    serviceChips: ['Take parenting classes', 'Home visits available'],
  },
  {
    id: 'yZm4YeBksjz9am97cMn2',
    title: 'Salvation Army of Chelsea/East Boston',
    serviceChips: ['Get groceries', 'After-school program', 'Get holiday help'],
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
