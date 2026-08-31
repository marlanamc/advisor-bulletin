#!/usr/bin/env node
/**
 * Uploads coat-of-arms logos for the nine consulate cards created by
 * scripts/add-consulates-2026-08.mjs, matching the resourceLogos collection
 * pattern in src/resource-logos.js (logos live in their own collection keyed
 * by bulletin doc id, not inline on the bulletin).
 *
 * Each country's official coat of arms, not its flag. That matches the
 * existing El Salvador card and reads as a government office rather than a
 * cultural reference. Source is Wikimedia Commons, which carries the official
 * public-domain renderings; each file was visually confirmed to be the right
 * country's arms before being committed.
 *
 * Size matters more here than elsewhere: Firebase Storage is unavailable on
 * this project (billing disabled), so logos are base64 inside Firestore docs
 * and the whole resourceLogos collection is fetched once per session. The
 * committed PNGs are trimmed of transparent margin, fit to 256px, and
 * quantized to a 128-colour palette — 3.6MB of source art down to ~148KB,
 * roughly 203KB once base64-encoded across all nine. They render at 40-64px
 * on a card, so 256px still covers a 3x display.
 *
 * Doc ids are looked up by title rather than hardcoded, because the consulate
 * cards were created interactively and their ids differ per environment. A
 * card that cannot be found is reported and skipped, never guessed at.
 *
 * Usage:
 *   node scripts/add-consulate-logos-2026-08.mjs           # dry run
 *   node scripts/add-consulate-logos-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const LOGO_COLLECTION = 'resourceLogos';
const LOGO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'assets', 'consulate-logos');

// titleEn is the lookup key — it must match what add-consulates-2026-08.mjs wrote.
const LOGOS = [
  { title: 'Consulate General of Brazil — Boston', file: 'brazil.png' },
  { title: 'Consulate General of Cape Verde — Quincy', file: 'capeverde.png' },
  { title: 'Consulate General of Colombia — Boston', file: 'colombia.png' },
  { title: 'Consulate General of the Dominican Republic — Boston', file: 'dominican.png' },
  { title: 'Consulate General of Guatemala — Providence, RI', file: 'guatemala.png' },
  { title: 'Consulate General of Haiti — Boston', file: 'haiti.png' },
  { title: 'Consulate of Honduras — Chelsea', file: 'honduras.png' },
  { title: 'Consulate General of Mexico — Boston', file: 'mexico.png' },
  { title: 'Consulate General of Peru — Boston', file: 'peru.png' },
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

async function findByTitle(db, title) {
  const snapshot = await db
    .collection(COLLECTION)
    .where('type', '==', 'resource')
    .where('titleEn', '==', title)
    .get();
  if (snapshot.empty) return null;
  if (snapshot.size > 1) {
    console.warn(`! "${title}" matched ${snapshot.size} docs — using the first. Check for duplicates.`);
  }
  return snapshot.docs[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Read and size every file up front so a missing asset fails before any write.
  const payloads = LOGOS.map((logo) => {
    const filePath = join(LOGO_DIR, logo.file);
    if (!existsSync(filePath)) throw new Error(`Missing logo asset: ${filePath}`);
    const bytes = readFileSync(filePath);
    return {
      ...logo,
      dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
      sizeKb: Math.round(bytes.length / 1024),
    };
  });

  const totalKb = payloads.reduce((sum, p) => sum + Math.round(p.dataUrl.length / 1024), 0);

  if (!args.confirm) {
    for (const p of payloads) {
      console.log(`[dry-run] ${p.title}`);
      console.log(`   <- ${p.file} (${p.sizeKb}KB file, ${Math.round(p.dataUrl.length / 1024)}KB encoded)`);
    }
    console.log(`\n${payloads.length} logos, ~${totalKb}KB encoded total.`);
    console.log('Re-run with --confirm to write (doc ids are resolved then).');
    return;
  }

  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  let written = 0;
  const missing = [];

  for (const p of payloads) {
    const docSnap = await findByTitle(db, p.title);
    if (!docSnap) {
      missing.push(p.title);
      console.warn(`! Not found: "${p.title}" — skipped.`);
      continue;
    }

    await db.collection(LOGO_COLLECTION).doc(docSnap.id).set({
      dataUrl: p.dataUrl,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(COLLECTION).doc(docSnap.id).update({
      hasResourceLogo: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
    written += 1;
    console.log(`✓ ${p.title} (${docSnap.id}) <- ${p.file} (${p.sizeKb}KB)`);
  }

  console.log(`\n${written} of ${payloads.length} logos written.`);
  if (missing.length) {
    console.log('\nNot found — run scripts/add-consulates-2026-08.mjs first, or check');
    console.log('whether these titles were edited in the Advisor Portal:');
    for (const title of missing) console.log(`  - ${title}`);
  }
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
