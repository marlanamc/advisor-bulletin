#!/usr/bin/env node
/**
 * Uploads logos for the 4 housing resources added in
 * scripts/add-housing-resources-2026-08.mjs, matching the resourceLogos
 * collection pattern in src/resource-logos.js (logos live in their own
 * collection, keyed by bulletin doc id, not inline on the bulletin).
 *
 * Sources:
 *   BHA: official logo from bostonhousing.org
 *   Metrolist: City of Boston wordmark from boston.gov (Metrolist has no
 *     logo of its own — it's a Boston.gov tool)
 *   MRVP / HomeBASE: official MA state seal (both are state programs with
 *     no dedicated logo)
 *
 * Usage:
 *   node scripts/add-housing-resource-logos-2026-08.mjs           # dry run
 *   node scripts/add-housing-resource-logos-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const LOGO_COLLECTION = 'resourceLogos';
const LOGO_DIR = '/private/tmp/claude-501/-Users-marlanacreed-Downloads-Projects-advisor-bulletin/ed990227-dbac-44b2-8cd0-02e0e666acb9/scratchpad/logos';

const LOGOS = [
  { id: 'tzZSsuElGbd1jNgnEsWN', title: 'MRVP', file: 'state-seal.png', mime: 'image/png' },
  { id: '6yofpUiJxpWMgaltCe7n', title: 'HomeBASE', file: 'state-seal.png', mime: 'image/png' },
  { id: 'nWNbF0kTMBqkUOnn9BAX', title: 'Boston Housing Authority (State-Assisted Housing)', file: 'bha.png', mime: 'image/png' },
  { id: 'xY4Cpj9SJn6Ml4AZ82Lw', title: 'Metrolist', file: 'metrolist.svg', mime: 'image/svg+xml' },
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
