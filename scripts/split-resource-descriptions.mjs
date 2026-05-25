#!/usr/bin/env node
/**
 * Split bilingual `description` strings on previously imported resources into
 * separate `description` (English) and `summaryEs` (Spanish) fields.
 *
 * Targets only docs with `importSource == 'csv-import'` so it leaves anything
 * an advisor created by hand alone. Safe to re-run — once split, a doc no
 * longer has the `Español:` delimiter and is left untouched.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/split-resource-descriptions.mjs [--dry-run]
 *
 *   node scripts/split-resource-descriptions.mjs --credentials=/path/to/sa.json
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const IMPORT_SOURCE = 'csv-import';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { dryRun: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

function splitBilingualDescription(raw) {
  const text = String(raw || '').trim();
  if (!text) return { en: '', es: '' };
  const match = text.match(/\bEspañol\s*[:\-—]\s*/i);
  if (!match) return { en: text, es: '' };
  const en = text.slice(0, match.index).trim().replace(/[\s,;:.\-—]+$/, '');
  const es = text.slice(match.index + match[0].length).trim();
  return { en, es };
}

async function initAdminDb(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error(
      'No service account found. Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=/path/to/sa.json'
    );
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return { db: admin.default.firestore(), admin: admin.default };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db, admin } = await initAdminDb(args.credentials);

  const snapshot = await db.collection(COLLECTION)
    .where('importSource', '==', IMPORT_SOURCE)
    .get();

  if (snapshot.empty) {
    console.log('No imported resources found — nothing to split.');
    process.exit(0);
  }

  const updates = [];
  const skipped = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    const { en, es } = splitBilingualDescription(data.description);
    const existingEs = (data.summaryEs || '').trim();

    // Nothing to do if there's no Spanish half embedded and a summary already
    // exists (or the doc never had bilingual content to begin with).
    if (!es && existingEs) {
      skipped.push({ id: doc.id, title: data.titleEn || data.title || doc.id, reason: 'already split' });
      return;
    }
    if (!es && !existingEs) {
      skipped.push({ id: doc.id, title: data.titleEn || data.title || doc.id, reason: 'no Spanish half' });
      return;
    }

    updates.push({
      ref: doc.ref,
      id: doc.id,
      title: data.titleEn || data.title || doc.id,
      description: en,
      summaryEs: es,
    });
  });

  console.log(`Imported resources: ${snapshot.size}`);
  console.log(`Will split: ${updates.length}`);
  console.log(`Skipped: ${skipped.length}`);

  if (skipped.length) {
    skipped.slice(0, 10).forEach((s) => console.log(`  · ${s.title} — ${s.reason}`));
    if (skipped.length > 10) console.log(`  · …and ${skipped.length - 10} more`);
  }

  if (!updates.length) {
    console.log('Nothing to update.');
    process.exit(0);
  }

  if (args.dryRun) {
    console.log('\n[dry-run] sample of planned splits:');
    updates.slice(0, 5).forEach((u) => {
      console.log(`\n  ${u.title}`);
      console.log(`    EN: ${u.description}`);
      console.log(`    ES: ${u.summaryEs}`);
    });
    if (updates.length > 5) console.log(`\n  …and ${updates.length - 5} more`);
    process.exit(0);
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((update) => {
      batch.update(update.ref, {
        description: update.description,
        summaryEs: update.summaryEs,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    slice.forEach((u) => console.log(`Split ${u.title}`));
    written += slice.length;
  }

  console.log(`\nUpdated ${written} resource(s).`);
}

main().catch((error) => {
  console.error('Split failed:', error.message || error);
  process.exit(1);
});
