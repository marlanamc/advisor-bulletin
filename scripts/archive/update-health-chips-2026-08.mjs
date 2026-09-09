#!/usr/bin/env node
/**
 * Rewrites service chips on the 7 live health resources. This category
 * mixes crisis hotlines (988, MA Behavioral Health, SafeLink, Community
 * Healing) with healthcare-access services (NeighborHealth, Mayor's Health
 * Line, Health Care For All). "Get crisis support" and "Get mental health
 * support" were each on 4 of 7 cards, so someone actually in crisis
 * couldn't tell which hotline matched their situation. New chips tie each
 * crisis line to its specific situation instead.
 *
 * Usage:
 *   node scripts/update-health-chips-2026-08.mjs           # dry run
 *   node scripts/update-health-chips-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'rhimw0Eete9pY9qKwbOf',
    title: 'NeighborHealth (formerly East Boston Neighborhood Health Center)',
    serviceChips: ['Get health care', 'Get dental care', 'See a doctor with no insurance'],
  },
  {
    id: '7CsAmPepfWdAFnYUL5XL',
    title: '988 Suicide & Crisis Lifeline',
    serviceChips: ['Call or text 988', 'Get crisis support'],
  },
  {
    id: 'FGVi15mOY87toPVemNgK',
    title: 'Massachusetts Behavioral Health Help Line',
    serviceChips: ['Get mental health support', 'Talk about drug or alcohol use'],
  },
  {
    id: 'zLiCrfxgtMGs80hPA6Ey',
    title: 'SafeLink Domestic Violence Hotline',
    serviceChips: ['If someone at home scares you'],
  },
  {
    id: 'adVC7hL5kgoIwEqrZlTP',
    title: 'Community Healing Response Network',
    serviceChips: ['Get trauma support', 'Support after community violence'],
  },
  {
    id: 's5IIOgQvt2YoLXfyJZI9',
    title: "Mayor's Health Line",
    serviceChips: ['Get insurance help', 'Find a clinic'],
  },
  {
    id: 'N71pr8wPfU2aCNHlAcnT',
    title: 'Health Care For All Massachusetts',
    serviceChips: ['Get insurance help', 'Keep your MassHealth'],
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
