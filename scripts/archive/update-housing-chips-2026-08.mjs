#!/usr/bin/env node
/**
 * Rewrites service chips on the 12 live housing resources. "Get housing
 * help" was on 9 of 12 cards, so the category tile (which lists every
 * housing resource together, not filtered by chip) read as 12 near-identical
 * cards. New chips are specific per resource so cards are scannable at a
 * glance. Only serviceChips/services/highlights change — everything else on
 * each doc (contact info, hours, publish state, logos) is left alone.
 *
 * Usage:
 *   node scripts/update-housing-chips-2026-08.mjs           # dry run
 *   node scripts/update-housing-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: '20nEfN1q1rjMstkDtizM',
    title: 'Maverick Landing Community Services',
    serviceChips: ['Talk to a housing case manager', 'Get help with landlord problems', 'Get groceries'],
    description: 'Get help finding and keeping housing. This Housing Stability Lab is open to any East Boston resident, not just people who live at Maverick Landing. They help with rent, utility bills, landlord problems, and legal housing questions. They also offer food, English classes, and job support.',
    summaryEs: 'Reciba ayuda para encontrar y mantener una vivienda. Este Housing Stability Lab está abierto a cualquier residente de East Boston, no solo a quienes viven en Maverick Landing. Ayudan con la renta, las facturas de servicios públicos, problemas con el dueño y preguntas legales de vivienda. También ofrecen alimentos, clases de inglés y apoyo laboral.',
  },
  {
    id: '41UtfHEQqtsi4tMcD29o',
    title: 'MA State Public Housing',
    serviceChips: ['Apply for public housing'],
  },
  {
    id: '5v2i2ZzQJ6dGva2bBQw9',
    title: 'RAFT (Residential Assistance for Families in Transition)',
    serviceChips: ['Get rent help', 'Get utility help'],
  },
  {
    id: '6yofpUiJxpWMgaltCe7n',
    title: 'HomeBASE',
    serviceChips: ['Prevent losing your home', 'Get help finding a home'],
  },
  {
    id: 'XrFRTpcTXKObO9GbwtGj',
    title: 'East Boston Adult Family Shelter (formerly Crossroads Family Center)',
    serviceChips: ['Find family shelter', 'Get a state referral'],
  },
  {
    id: 'e8ZdCGj1ws7PIWJQpfLJ',
    title: 'Neighborhood of Affordable Housing (NOAH)',
    serviceChips: ['Find affordable housing', 'Get help buying a home', 'Take English classes'],
  },
  {
    id: 'kw2XSXtjJITiQLwFtFGn',
    title: 'Mayor’s Office of Housing – Office of Housing Stability',
    serviceChips: ['Get eviction help', 'Talk to a housing lawyer'],
  },
  {
    id: 'nWNbF0kTMBqkUOnn9BAX',
    title: 'Boston Housing Authority (State-Assisted Housing)',
    serviceChips: ['Apply for public housing'],
  },
  {
    id: 'rSncRxrz2yhcy4Rs4zfO',
    title: 'Metro Housing Boston',
    serviceChips: ['Get help paying rent', 'Call if you owe rent'],
  },
  {
    id: 'tzZSsuElGbd1jNgnEsWN',
    title: 'Massachusetts Rental Voucher Program (MRVP)',
    serviceChips: ['Get rent help', 'Pay less rent every month'],
  },
  {
    id: 'xY4Cpj9SJn6Ml4AZ82Lw',
    title: 'Metrolist',
    serviceChips: ['Search apartment listings', 'Enter the housing lottery', 'Get new listing alerts'],
  },
  {
    id: 'yHcQps4ebiQYp1LCQ3ho',
    title: 'City Life/Vida Urbana',
    serviceChips: ['Get eviction help', 'Join tenant support', 'Learn your housing rights'],
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
      if (u.summaryEs !== undefined) {
        console.log(`   summaryEs before: ${JSON.stringify(data.summaryEs || '')}`);
        console.log(`   summaryEs after:  ${JSON.stringify(u.summaryEs)}`);
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
