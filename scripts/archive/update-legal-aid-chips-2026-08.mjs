#!/usr/bin/env node
/**
 * Rewrites service chips on the 5 live legal-aid resources. "Learn your
 * rights" and "Get housing legal help" were each on 4 of 5 cards. These
 * five orgs actually do fundamentally different kinds of things (direct
 * representation vs. discrimination-specific vs. self-help guides vs.
 * referral-matching vs. enforcement complaints), so chips differentiate by
 * model rather than topic. Ends with zero chip overlap across the category.
 *
 * Usage:
 *   node scripts/update-legal-aid-chips-2026-08.mjs           # dry run
 *   node scripts/update-legal-aid-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'z8etC01nAXNPcZ0wuHo0',
    title: 'Greater Boston Legal Services',
    serviceChips: ['Talk to a free lawyer'],
  },
  {
    id: 'aql8YOrvxHJErHNBi0z0',
    title: 'Lawyers for Civil Rights',
    serviceChips: ['Report discrimination', 'Free workshops for businesses'],
  },
  {
    id: 'Gpa30JCZ52KT3sTtpgtv',
    title: 'MassLegalHelp',
    serviceChips: ['Read your rights online', 'Learn about housing or family law'],
  },
  {
    id: 'd7e0iokDWH8Rg3Rangep',
    title: 'Mass Legal Resource Finder',
    serviceChips: ['Find a lawyer near you', 'Search by your problem'],
  },
  {
    id: 'OxkqctNYJZlJkkmH9hKm',
    title: "Massachusetts Attorney General's Office",
    serviceChips: ['Report a problem', 'Landlord, job, or business issues'],
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
