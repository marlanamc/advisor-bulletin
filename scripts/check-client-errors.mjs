#!/usr/bin/env node
/**
 * Weekly client-error digest. src/error-logger.js writes every uncaught
 * JS error and unhandled rejection from the student site and admin portal
 * into the `errors` Firestore collection — but nothing ever reads that
 * collection, so a real bug can sit there invisibly for months. This
 * summarizes the last WINDOW_DAYS of documents, grouped by (source,
 * message) fingerprint, so the same reporting → tracking-issue pattern as
 * scripts/check-resource-links.mjs surfaces them instead.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-client-errors.mjs [--json=out.json] [--days=7]
 *
 * Exit code is always 0 — this script reports, it doesn't fail the build.
 * The caller (CI workflow) decides what to do with the JSON output.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'errors';
const WINDOW_DAYS = 7;
const MAX_GROUPS = 25;

function parseArgs(argv) {
  const args = { json: null, days: WINDOW_DAYS, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--json=')) args.json = arg.slice('--json='.length);
    else if (arg.startsWith('--days=')) args.days = Number(arg.slice('--days='.length)) || WINDOW_DAYS;
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

function fingerprint(source, message) {
  return `${source || 'unknown'}: ${String(message || 'Unknown error').slice(0, 120)}`;
}

async function fetchRecentErrors(db, cutoff) {
  const snapshot = await db.collection(COLLECTION)
    .where('createdAt', '>=', cutoff)
    .get();
  return snapshot.docs.map((doc) => doc.data());
}

function groupErrors(errors) {
  const groups = new Map();
  for (const err of errors) {
    const key = fingerprint(err.source, err.message);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.pages.has(err.page)) existing.pages.add(err.page);
      const seenAt = err.createdAt?.toDate ? err.createdAt.toDate() : null;
      if (seenAt && (!existing.lastSeen || seenAt > existing.lastSeen)) existing.lastSeen = seenAt;
    } else {
      groups.set(key, {
        source: err.source || 'unknown',
        message: err.message || 'Unknown error',
        type: err.type || 'error',
        count: 1,
        pages: new Set([err.page].filter(Boolean)),
        lastSeen: err.createdAt?.toDate ? err.createdAt.toDate() : null,
      });
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, pages: [...g.pages].slice(0, 5) }))
    .sort((a, b) => b.count - a.count);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);
  const cutoff = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);

  const errors = await fetchRecentErrors(db, cutoff);
  const groups = groupErrors(errors).slice(0, MAX_GROUPS);

  const report = {
    checkedAt: new Date().toISOString(),
    windowDays: args.days,
    totalErrors: errors.length,
    groups,
  };

  console.log(`Checked last ${args.days} day(s): ${errors.length} error event(s), ${groups.length} distinct group(s).`);
  for (const g of groups) {
    console.log(`  [${g.count}x] ${g.source}: ${g.message}`);
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`\nWrote report to ${args.json}`);
  }
}

main().catch((error) => {
  console.error('Client error digest failed:', error.message || error);
  process.exit(1);
});
