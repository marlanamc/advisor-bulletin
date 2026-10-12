#!/usr/bin/env node
/**
 * Uploads the MACI logo for the card added in
 * scripts/archive/add-immigration-maci-2026-10.mjs, using the resourceLogos
 * collection pattern in src/resource-logos.js.
 *
 * Source: the scales mark from MIRA's official MACI flyer
 * (miracoalition.org/wp-content/uploads/2025/12/MACI-Flyer-1-2025-Immigration-Helpline-poster-English.pdf),
 * cropped to the circle and saved as scripts/assets/maci-logo.png.
 *
 * Usage:
 *   node scripts/archive/add-immigration-maci-logo-2026-10.mjs           # dry run
 *   node scripts/archive/add-immigration-maci-logo-2026-10.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const LOGO_COLLECTION = 'resourceLogos';
const LOGO_DIR = new URL('../assets', import.meta.url).pathname;

const LOGOS = [
  { id: 'N55iRBQGTnpczz8qAcSx', title: 'Massachusetts Access to Counsel Initiative (MACI)', file: 'maci-logo.png', mime: 'image/png' },
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
