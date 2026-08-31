#!/usr/bin/env node
/**
 * Backfills the missing `type` field on legacy bulletins created before
 * `type` was introduced to distinguish posts from structured resources.
 * 69 documents have no `type` at all, which means `data.type is string`
 * fails on every one of them — so validateBulletinData can never pass,
 * and editing any of them (even changing a single field) is silently
 * blocked by the Firestore rules regardless of what's being changed.
 *
 * All 69 have post-shaped data (category in the post enum: training,
 * college, career-fair, resource, announcement, job) and none have the
 * structured-resource fields (resourceCategory, isPublished, url in the
 * resource sense) — confirmed by inspection before writing this script.
 * So every one gets type: 'post', not type: 'resource'.
 *
 * Usage:
 *   node scripts/backfill-missing-post-type-2026-08.mjs           # dry run
 *   node scripts/backfill-missing-post-type-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

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

  const snapshot = await db.collection(COLLECTION).get();
  const typeless = snapshot.docs.filter((doc) => !('type' in doc.data()));
  console.log(`Found ${typeless.length} bulletins with no type field.`);

  for (const docSnap of typeless) {
    const v = docSnap.data();
    const title = v.title || v.titleEn || docSnap.id;
    if (!args.confirm) {
      console.log(`[dry-run] ${title} (${docSnap.id}) -> type: 'post'`);
      continue;
    }
    await docSnap.ref.update({ type: 'post', updatedAt: FieldValue.serverTimestamp() });
    console.log(`✓ ${title} (${docSnap.id}) -> type: 'post'`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
