#!/usr/bin/env node
/**
 * One-off repair for two production data problems found 2026-09-10.
 *
 * 1. resourceIcon stuck on 'globe'.
 *    buildBulletinObject read the suggested icon from a `#resourceCategory`
 *    element that does not exist in admin.html (values reach FormData through
 *    hidden name= mirrors instead), so every resource created in the portal
 *    fell back to 'globe'. Because the student renderer prefers a stored icon
 *    over the category default (getResourceIconSvg in src/firebase-config.js),
 *    Food/Family/College cards have been showing a globe.
 *
 *    This sets those docs to 'auto', which makes the renderer use the icon
 *    canonical for the category -- so they stay correct if a category's icon
 *    is ever redesigned. Only docs whose stored icon is exactly 'globe' AND
 *    whose category's canonical icon is something else are touched.
 *
 *    Resources with an uploaded logo are unaffected either way: the card
 *    renders the logo <img> and never consults resourceIcon.
 *
 *    Deliberately NOT touched: the 10 immigration resources storing 'shield',
 *    which came from import-resources.mjs and read better than the canonical
 *    globe. Pass --include-shields to reset those too.
 *
 * 2. The Honduras consulate phone number.
 *    Stored as 617-571-7974; the consulate's own listings and several
 *    directories all give 617-819-4885. Students were calling a number the
 *    consulate does not answer on.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/repair-resource-icons.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/repair-resource-icons.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';
import { RESOURCE_CATEGORY_CONFIG } from '../src/board-shared.js';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

// Honduras consulate: doc id -> corrected phone.
const PHONE_FIXES = {
  qr6RShk8gAyzxpTwM77p: { was: '617-571-7974', now: '617-819-4885', label: 'Consulate of Honduras — Chelsea' },
};

function parseArgs(argv) {
  const args = { confirm: false, credentials: null, includeShields: false };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg === '--dry-run') args.confirm = false;
    else if (arg === '--include-shields') args.includeShields = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

async function initAdminDb(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=...');
  }
  const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
  admin.default.initializeApp({
    credential: admin.default.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
  });
  return admin.default.firestore();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);

  const snap = await db.collection(COLLECTION).where('type', '==', 'resource').get();

  const iconFixes = [];
  const phoneFound = [];

  snap.forEach((docSnap) => {
    const r = docSnap.data();
    const canonical = RESOURCE_CATEGORY_CONFIG[r.resourceCategory]?.icon;
    if (!canonical) return;

    const stored = r.resourceIcon;
    const isWrongGlobe = stored === 'globe' && canonical !== 'globe';
    const isShield = args.includeShields && stored === 'shield' && canonical !== 'shield';

    if (isWrongGlobe || isShield) {
      iconFixes.push({
        id: docSnap.id,
        title: r.title || '(untitled)',
        category: r.resourceCategory,
        stored,
        canonical,
        hasLogo: r.hasResourceLogo === true,
      });
    }

    if (PHONE_FIXES[docSnap.id]) {
      phoneFound.push({ id: docSnap.id, current: r.phone || '', ...PHONE_FIXES[docSnap.id] });
    }
  });

  console.log(`Scanned ${snap.size} resource-type bulletins.\n`);

  console.log(`resourceIcon -> 'auto': ${iconFixes.length} doc(s)`);
  for (const f of iconFixes) {
    const logoNote = f.hasLogo ? '  [has a logo, no visual change]' : '';
    console.log(`  ${f.category.padEnd(17)} ${f.stored} -> auto (renders ${f.canonical})  ${f.title}${logoNote}`);
  }
  const noVisualChange = iconFixes.filter((f) => f.hasLogo).length;
  console.log(`  ${iconFixes.length - noVisualChange} card(s) change appearance; ${noVisualChange} have a logo and will look identical.\n`);

  console.log(`phone corrections: ${phoneFound.length} doc(s)`);
  for (const p of phoneFound) {
    const match = p.current === p.was ? '' : `  (WARNING: stored value is "${p.current}", expected "${p.was}" -- skipping)`;
    console.log(`  ${p.label}: ${p.current || '(empty)'} -> ${p.now}${match}`);
  }
  const phoneWrites = phoneFound.filter((p) => p.current === p.was);
  console.log('');

  if (!args.confirm) {
    console.log('Dry run. Re-run with --confirm to write.');
    process.exit(0);
  }

  if (!iconFixes.length && !phoneWrites.length) {
    console.log('Nothing to write.');
    process.exit(0);
  }

  const batch = db.batch();
  for (const f of iconFixes) {
    batch.update(db.collection(COLLECTION).doc(f.id), { resourceIcon: 'auto' });
  }
  for (const p of phoneWrites) {
    batch.update(db.collection(COLLECTION).doc(p.id), { phone: p.now });
  }
  await batch.commit();

  console.log(`Wrote ${iconFixes.length} icon fix(es) and ${phoneWrites.length} phone fix(es).`);
  console.log('Run `npm run build:snapshot` (or wait for the daily cron) to refresh the student snapshot.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
