#!/usr/bin/env node
/**
 * Rewrites service chips on the Immigration category. "Get immigration
 * help" was on 8 of 10 cards, making a large, already-crowded category
 * unscannable. Also fixes Family Preparedness (MIRA Coalition's
 * detention/deportation planning guide), which was isActive:false with a
 * broken, truncated description and no chips — invisible to students and
 * malformed, not just under-chipped.
 *
 * Usage:
 *   node scripts/update-immigration-chips-2026-08.mjs           # dry run
 *   node scripts/update-immigration-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'ftfx4zJIL11IfQjhSKIo',
    title: 'East Boston Community Council',
    serviceChips: ['Get immigration help', 'Take English classes', 'Take GED classes in Spanish'],
  },
  {
    id: 'Z6nHAJNi8iGKv2TsYreE',
    title: 'Agencia ALPHA',
    serviceChips: ['Local East Boston office', 'Apply for citizenship'],
  },
  {
    id: 'c1CzwnEaMjgyo6VVUB2k',
    title: 'Rian Immigrant Center',
    serviceChips: ['Free citizenship clinic', 'Apply for citizenship'],
  },
  {
    id: 'HgjucUkz7dxNFnAPqvKS',
    title: 'La Colaborativa',
    serviceChips: ['Get immigration help', 'Get mental health support', 'Get work help'],
  },
  {
    id: '2ARioOYAVid5tF3Jw7PI',
    title: 'Project Citizenship',
    serviceChips: ['Practice for citizenship test', 'Fill out citizenship forms'],
  },
  {
    id: 'oFe0iexVA1riSpg1zG2D',
    title: 'MIRA Coalition',
    serviceChips: ['Call for immigration info', 'Citizenship form workshops'],
  },
  {
    id: 'e7aGhmTIECOBwS3KlAjp',
    title: 'La Comunidad',
    serviceChips: ['Get immigration help', 'Get tax help', 'Translate documents'],
  },
  {
    id: 'JQwr3MbZChtEjReg1Qyb',
    title: "Mayor's Office for Immigrant Advancement (MOIA)",
    serviceChips: ['Talk to an immigration lawyer', 'Apply for citizenship'],
  },
  {
    id: '5TNjFZWVkLrKsymPAHxO',
    title: 'Family Preparedness',
    serviceChips: ['Make a family emergency plan', 'Prepare for detention or deportation'],
    description: 'This website has resources and legal help for immigrant families in Massachusetts to make an emergency plan in case of detention or deportation.',
    summaryEs: 'Este sitio web ofrece recursos y ayuda legal para familias inmigrantes en Massachusetts para hacer un plan de emergencia en caso de detención o deportación.',
    isActive: true,
    resourceOrder: 10,
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
    if (u.isActive !== undefined) changes.isActive = u.isActive;
    if (u.resourceOrder !== undefined) changes.resourceOrder = u.resourceOrder;

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
      if (u.summaryEs !== undefined) {
        console.log(`   summaryEs before: ${JSON.stringify(data.summaryEs || '')}`);
        console.log(`   summaryEs after:  ${JSON.stringify(u.summaryEs)}`);
      }
      if (u.isActive !== undefined) {
        console.log(`   isActive before: ${JSON.stringify(data.isActive)} -> after: ${JSON.stringify(u.isActive)}`);
      }
      if (u.resourceOrder !== undefined) {
        console.log(`   resourceOrder before: ${JSON.stringify(data.resourceOrder)} -> after: ${JSON.stringify(u.resourceOrder)}`);
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
