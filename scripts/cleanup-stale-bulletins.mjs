#!/usr/bin/env node
/**
 * Delete long-inactive bulletins (all types) that have been hidden for a while.
 *
 * Complements cleanup-inactive-draft-bulletins.mjs, which only removes orphan
 * post drafts from failed first publishes. This script permanently deletes
 * bulletins where isActive === false and updatedAt is older than STALE_DAYS.
 *
 * Always dry-run first. Use --confirm to delete matched docs.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/cleanup-stale-bulletins.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/cleanup-stale-bulletins.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const BATCH_SIZE = 400;
const STALE_DAYS = 180;

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
  authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: 'ebhcs-bulletin-uploads-us',
  messagingSenderId: '556649154585',
  appId: '1:556649154585:web:3a3f49d2056aa507088288',
};

function parseArgs(argv) {
  const args = { confirm: false, credentials: null, days: STALE_DAYS, email: 'admin@ebhcs.org' };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--days=')) {
      const parsed = Number(arg.slice('--days='.length));
      if (Number.isFinite(parsed) && parsed > 0) args.days = parsed;
    }
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length).trim();
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/cleanup-stale-bulletins.mjs [options]

Options:
  --confirm           Permanently delete matched stale inactive bulletins (default: dry-run)
  --days=N            Inactive for at least N days (default: ${STALE_DAYS})
  --email=ADDR        Admin email to sign in with when no service account (default: admin@ebhcs.org)
  --credentials=PATH  Optional service account JSON (skips password prompt)
`);
      process.exit(0);
    }
  }
  return args;
}

function resolveCredentialPath(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve('service-account.json'),
    resolve('config/service-account.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const path = candidate.startsWith('~')
      ? resolve(process.env.HOME || '', candidate.slice(2))
      : resolve(candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: stdin, output: stdout });
    if (hidden) {
      const onData = () => {
        stdout.write('*');
      };
      stdin.on('data', onData);
      rl.question(question, (answer) => {
        stdin.removeListener('data', onData);
        stdout.write('\n');
        rl.close();
        resolvePrompt(answer);
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolvePrompt(answer);
      });
    }
  });
}

async function initAdminDb(credentialsPath) {
  const path = resolveCredentialPath(credentialsPath);
  if (!path) return null;

  const admin = await import('firebase-admin');
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return { mode: 'admin', db: admin.default.firestore() };
}

async function initClientDb(email) {
  const password = await prompt(`Password for ${email}: `, { hidden: true });
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  const app = initializeApp(FIREBASE_CONFIG, `cleanup-stale-bulletins-${Date.now()}`);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}\n`);

  return { mode: 'client', db: getFirestore(app) };
}

async function resolveDb(args) {
  const adminDb = await initAdminDb(args.credentials);
  if (adminDb) return adminDb;
  return initClientDb(args.email);
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function cutoffMs(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function summarizeDoc(id, data) {
  const title = data.title || data.titleEn || '(untitled)';
  return {
    id,
    title,
    type: data.type || '?',
    postedBy: data.postedBy || '?',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || String(data.updatedAt || ''),
  };
}

async function fetchInactiveDocs(ctx) {
  if (ctx.mode === 'admin') {
    const snapshot = await ctx.db.collection(COLLECTION).where('isActive', '==', false).get();
    return snapshot.docs;
  }

  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const snapshot = await getDocs(query(collection(ctx.db, COLLECTION), where('isActive', '==', false)));
  return snapshot.docs;
}

async function deleteCandidates(ctx, candidates) {
  if (ctx.mode === 'admin') {
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = ctx.db.batch();
      const slice = candidates.slice(i, i + BATCH_SIZE);
      slice.forEach(({ ref }) => batch.delete(ref));
      await batch.commit();
    }
    return;
  }

  const { collection, doc, writeBatch } = await import('firebase/firestore');
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = writeBatch(ctx.db);
    const slice = candidates.slice(i, i + BATCH_SIZE);
    slice.forEach(({ id }) => batch.delete(doc(ctx.db, COLLECTION, id)));
    await batch.commit();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await resolveDb(args);
  const docs = await fetchInactiveDocs(ctx);
  const threshold = cutoffMs(args.days);
  const candidates = [];
  let skippedRecent = 0;
  let skippedNoTimestamp = 0;

  docs.forEach((docSnap) => {
    const data = docSnap.data();
    const updatedMs = toMillis(data.updatedAt);
    if (updatedMs == null) {
      skippedNoTimestamp += 1;
      return;
    }
    if (updatedMs > threshold) {
      skippedRecent += 1;
      return;
    }
    candidates.push({
      id: docSnap.id,
      ref: docSnap.ref,
      data,
      ...summarizeDoc(docSnap.id, data),
    });
  });

  console.log(`Found ${docs.length} inactive bulletin(s) total.`);
  console.log(`Skipped ${skippedRecent} inactive bulletin(s) updated within the last ${args.days} days.`);
  if (skippedNoTimestamp) {
    console.log(`Skipped ${skippedNoTimestamp} inactive bulletin(s) with no updatedAt timestamp.`);
  }
  console.log(`${candidates.length} stale inactive bulletin(s) eligible for deletion.`);

  if (!candidates.length) {
    console.log('Nothing to do.');
    return;
  }

  candidates.forEach((item) => {
    console.log(`- ${item.id} | ${item.type} | ${item.postedBy} | ${item.title}`);
    console.log(`    updated: ${item.updatedAt}`);
  });

  if (!args.confirm) {
    console.log('\nDry run only. Re-run with --confirm to permanently delete the bulletins above.');
    return;
  }

  await deleteCandidates(ctx, candidates);
  console.log(`\nDeleted ${candidates.length} stale inactive bulletin(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
