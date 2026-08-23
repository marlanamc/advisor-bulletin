#!/usr/bin/env node
/**
 * Adds the Spanish translation of Eastie Farm's hours note. The card code
 * (src/resource-hours.js) now reads a `hoursEs` field for free-form hours
 * text that doesn't parse into structured day/time rows.
 *
 * Usage:
 *   node scripts/eastie-farm-hours-es-2026-08.mjs           # dry run
 *   node scripts/eastie-farm-hours-es-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const DOC_ID = 'GYzJeniWH0opHwWchmUw';

const hoursEs =
  'Los días y horarios de distribución varían según la temporada. Envíe un mensaje de texto con "comida" al (617) 207-6545 o visite el sitio web para conocer el horario actual.';

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
    console.log(`   hours (en): ${data.hours}`);
    console.log(`   hoursEs before: ${data.hoursEs}`);
    console.log(`   hoursEs after:  ${hoursEs}`);
    console.log('\nDry run only — rerun with --confirm to write.');
    return;
  }

  await ref.update({
    hoursEs,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Updated Eastie Farm (${DOC_ID})`);
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
