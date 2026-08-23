#!/usr/bin/env node
/**
 * Lists action chips on live resources that have no Spanish translation in
 * src/resource-chip-labels.js — those chips render in English on the Español
 * side of the board, which is easy to miss when you add a resource.
 *
 * Reads Firestore directly (not public/student-feed-snapshot.json) so chips
 * added in the Advisor Portal minutes ago show up.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-chip-translations.mjs [--category=housing] [--json]
 *
 * Exits 1 when something is untranslated, so it can gate a deploy.
 */

import { readFileSync, existsSync } from 'node:fs';
import {
  getActionResourceChipLabel,
  parseResourceServiceChips,
  translateResourceChipEs,
} from '../src/resource-chip-labels.js';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

function parseArgs(argv) {
  const args = { category: null, json: false, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--category=')) args.category = arg.slice('--category='.length);
    else if (arg === '--json') args.json = true;
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
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return admin.default.firestore();
}

/** The English chip labels on one resource doc, however it stores them. */
function resourceChips(data) {
  const serviceChips = Array.isArray(data.serviceChips) && data.serviceChips.length
    ? data.serviceChips
    : data.services;
  const raw = Array.isArray(serviceChips) && serviceChips.length ? serviceChips : data.highlights;
  return parseResourceServiceChips(raw, Number.POSITIVE_INFINITY)
    .map((chip) => getActionResourceChipLabel(chip))
    .filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);

  let query = db.collection(COLLECTION).where('type', '==', 'resource');
  if (args.category) query = query.where('resourceCategory', '==', args.category);

  const snapshot = await query.get();

  const untranslated = new Map(); // chip label -> resource titles using it
  let chipCount = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.isPublished === false) return;
    const title = data.titleEn || data.title || doc.id;
    resourceChips(data).forEach((chip) => {
      chipCount += 1;
      // The translator falls back to the English label, so "unchanged" is the
      // signal that no Spanish entry exists for this chip.
      if (translateResourceChipEs(chip) !== chip) return;
      if (!untranslated.has(chip)) untranslated.set(chip, new Set());
      untranslated.get(chip).add(title);
    });
  });

  const rows = [...untranslated]
    .map(([chip, titles]) => ({ chip, resources: [...titles].sort() }))
    .sort((a, b) => a.chip.localeCompare(b.chip));

  if (args.json) {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      resources: snapshot.size,
      chips: chipCount,
      untranslated: rows,
    }, null, 2));
  } else if (!rows.length) {
    console.log(`✅ All ${chipCount} chips across ${snapshot.size} live resources have Spanish.`);
  } else {
    console.log(`⚠️  ${rows.length} chip label(s) with no Spanish translation:\n`);
    rows.forEach(({ chip, resources }) => {
      console.log(`  "${chip}"`);
      console.log(`      on: ${resources.join(', ')}`);
    });
    console.log('\nAdd them to RESOURCE_CHIP_ES in src/resource-chip-labels.js');
    console.log('(keys are the lowercased English label).');
  }

  if (rows.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Chip translation check failed:', error.message || error);
  process.exit(1);
});
