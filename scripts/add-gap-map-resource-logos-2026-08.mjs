#!/usr/bin/env node
/**
 * Uploads logos for the 5 resources added in
 * scripts/add-gap-map-resources-2026-08.mjs, matching the resourceLogos
 * collection pattern in src/resource-logos.js (logos live in their own
 * collection, keyed by bulletin doc id, not inline on the bulletin).
 *
 * Sources (all pulled directly from each org's own site, except the
 * consulate which uses the official national coat of arms via Wikimedia
 * Commons since the consulate's own site didn't expose a clean logo asset):
 *   IINE: iine.org site logo (SVG)
 *   Consulate General of El Salvador: Coat of arms of El Salvador, Wikimedia Commons
 *   Child Care Financial Assistance: childcare.mass.gov site logo
 *   Matahari Women Workers' Center: matahariboston.org site logo
 *   Boston ElderINFO: ethocare.org site logo
 *
 * Usage:
 *   node scripts/add-gap-map-resource-logos-2026-08.mjs           # dry run
 *   node scripts/add-gap-map-resource-logos-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const LOGO_COLLECTION = 'resourceLogos';
const LOGO_DIR = '/private/tmp/claude-501/-Users-marlanacreed-Downloads-Projects-advisor-bulletin/f14a79ca-53e7-4bfa-a54d-e1540d379447/scratchpad/logos';

const LOGOS = [
  { id: 'Va0zydBZQqmH290pjccG', title: 'IINE', file: 'iine.svg', mime: 'image/svg+xml' },
  { id: '0sI8kWx3c3RWLKRzTMlP', title: 'Consulate General of El Salvador', file: 'el-salvador.svg', mime: 'image/svg+xml' },
  { id: 'HvQ6cF4OfobwTptodIcF', title: 'Child Care Financial Assistance (EEC)', file: 'eec.png', mime: 'image/png' },
  { id: 'PuDxmKs3fAaeIKCXKLUK', title: "Matahari Women Workers' Center", file: 'matahari.png', mime: 'image/png' },
  { id: '4qji3w2pVDIy4stHJt7T', title: 'Boston ElderINFO (Ethos)', file: 'ethos.jpg', mime: 'image/jpeg' },
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

  for (const logo of LOGOS) {
    const filePath = `${LOGO_DIR}/${logo.file}`;
    const bytes = readFileSync(filePath);
    const dataUrl = `data:${logo.mime};base64,${bytes.toString('base64')}`;
    const sizeKb = Math.round(bytes.length / 1024);

    if (!args.confirm) {
      console.log(`[dry-run] ${logo.title} (${logo.id}) <- ${logo.file} (${sizeKb}KB)`);
      continue;
    }

    await db.collection(LOGO_COLLECTION).doc(logo.id).set({
      dataUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(COLLECTION).doc(logo.id).update({
      hasResourceLogo: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ ${logo.title} logo set (${sizeKb}KB)`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
