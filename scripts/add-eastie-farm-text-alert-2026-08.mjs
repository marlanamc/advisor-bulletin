#!/usr/bin/env node
/**
 * Adds the Eastie Farm free-food text alert line to the description and
 * Spanish summary.
 *
 * Usage:
 *   node scripts/add-eastie-farm-text-alert-2026-08.mjs           # dry run
 *   node scripts/add-eastie-farm-text-alert-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const DOC_ID = 'GYzJeniWH0opHwWchmUw';

const description =
  'Get free or low-cost fruits and vegetables. Bring your own bags if you can. They accept SNAP and HIP benefits. Text "food" to (617) 207-6545 to get notified when free food is available.';

const summaryEs =
  'Consiga frutas y verduras gratis o a bajo costo. Traiga sus propias bolsas si puede. Aceptan beneficios de SNAP y HIP. Envíe un mensaje de texto con "comida" al (617) 207-6545 para recibir avisos cuando haya comida gratis disponible.';

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

  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  if (!args.confirm) {
    console.log(`[dry-run] Eastie Farm (${DOC_ID})`);
    console.log(`   description before: ${data.description}`);
    console.log(`   description after:  ${description}`);
    console.log(`   summaryEs before: ${data.summaryEs}`);
    console.log(`   summaryEs after:  ${summaryEs}`);
    console.log('\nDry run only — rerun with --confirm to write.');
    return;
  }

  await ref.update({
    description,
    summaryEs,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Updated Eastie Farm (${DOC_ID})`);
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
