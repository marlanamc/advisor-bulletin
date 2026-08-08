#!/usr/bin/env node
/**
 * Pushes contact and schedule fields from the CSV into Firestore for resources
 * that were originally imported (`importSource: 'csv-import'`).
 *
 * update-imported-summaries.mjs only writes description and summaryEs, so a
 * corrected URL, address, phone or set of hours had no way to reach students
 * short of editing every card by hand in the Advisor Portal. That gap is why
 * several dead links survived in the app long after they were spotted.
 *
 * Only fields with a value in the CSV are written — a blank cell means "leave
 * whatever is in Firestore alone", so this can never blank out something an
 * advisor set in the portal. Logos, chips, publish state and pinning are never
 * touched.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/sync-resource-fields.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/sync-resource-fields.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const IMPORT_SOURCE = 'csv-import';
const BATCH_SIZE = 400;
const DEFAULT_CSV = resolve('data/resource-import-template.csv');

/** Fields this script is allowed to write. Deliberately narrow. */
const SYNCED_FIELDS = ['url', 'address', 'phone', 'hours', 'lastVerified'];

function parseArgs(argv) {
  const args = { dryRun: false, credentials: null, csv: DEFAULT_CSV };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (!arg.startsWith('--')) args.csv = resolve(arg);
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  return rows;
}

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Map of "orgName::resourceCategory" -> field values from the CSV. */
function readCsvFields(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const headers = rows[0];
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
  const byKey = new Map();

  for (const row of rows.slice(1)) {
    if ((row[idx.include] || '').trim().toUpperCase() !== 'Y') continue;
    const org = (row[idx.orgName] || '').trim();
    const category = (row[idx.resourceCategory] || '').trim();
    if (!org || !category) continue;

    const values = {};
    for (const field of SYNCED_FIELDS) {
      if (idx[field] === undefined) continue;
      const raw = (row[idx[field]] || '').trim();
      if (!raw) continue;
      values[field] = field === 'url' ? normalizeUrl(raw) : raw;
    }
    if (Object.keys(values).length) byKey.set(`${org}::${category}`, values);
  }

  return byKey;
}

async function initAdminDb(credentialsPath) {
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
  return { db: admin.default.firestore(), admin: admin.default };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvFields = readCsvFields(args.csv);
  console.log(`Read ${csvFields.size} resource(s) with syncable fields from ${args.csv}`);

  const { db, admin } = await initAdminDb(args.credentials);
  const snapshot = await db.collection(COLLECTION).where('importSource', '==', IMPORT_SOURCE).get();
  if (snapshot.empty) {
    console.log('No imported resources found.');
    return;
  }
  console.log(`Found ${snapshot.docs.length} imported resource(s) in Firestore.`);

  const updates = [];
  const unmatched = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const key = `${data.titleEn || data.title || ''}::${data.resourceCategory || ''}`;
    const desired = csvFields.get(key);
    if (!desired) { unmatched.push(key); continue; }

    const changes = {};
    for (const [field, value] of Object.entries(desired)) {
      if ((data[field] || '') !== value) changes[field] = value;
    }
    // The student card links through eventLink, so keep it aligned with url.
    if (changes.url) changes.eventLink = changes.url;

    if (Object.keys(changes).length) updates.push({ ref: doc.ref, key, changes, before: data });
  }

  console.log(`\nResources needing changes: ${updates.length}`);
  if (unmatched.length) console.log(`No CSV row for ${unmatched.length} Firestore resource(s).`);

  for (const update of updates) {
    console.log(`\n${update.key}`);
    for (const [field, value] of Object.entries(update.changes)) {
      console.log(`   ${field}: ${JSON.stringify(update.before[field] || '')} -> ${JSON.stringify(value)}`);
    }
  }

  if (args.dryRun) {
    console.log('\nDry run — nothing written.');
    return;
  }
  if (!updates.length) {
    console.log('\nNothing to write.');
    return;
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const slice = updates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    slice.forEach((u) => {
      batch.update(u.ref, { ...u.changes, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    await batch.commit();
    slice.forEach((u) => console.log(`Updated ${u.key}`));
  }

  console.log(`\nUpdated ${updates.length} resource(s).`);
}

main().catch((error) => {
  console.error('Sync failed:', error.message || error);
  process.exit(1);
});
