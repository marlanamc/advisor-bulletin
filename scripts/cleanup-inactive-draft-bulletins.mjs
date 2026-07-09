#!/usr/bin/env node
/**
 * One-time cleanup: remove inactive *post* placeholders left by failed publishes
 * before createBulletin began deleting drafts on upload failure.
 *
 * Does NOT touch resources (type === 'resource') — those use isPublished and may
 * legitimately have isActive === false when hidden or soft-deleted.
 *
 * Targets posts only, where:
 *   type === 'post' AND isActive === false AND createdAt/updatedAt within ORPHAN_EDIT_WINDOW_MS.
 *
 * Intentionally soft-deleted posts usually have updatedAt well after createdAt.
 *
 * Always dry-run first. Use --confirm to delete matched docs.
 *
 * Usage (easiest — sign in as admin, no key file needed):
 *   node scripts/cleanup-inactive-draft-bulletins.mjs
 *   node scripts/cleanup-inactive-draft-bulletins.mjs --confirm
 *
 * Usage (service account key from Firebase Console):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/cleanup-inactive-draft-bulletins.mjs --confirm
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const BATCH_SIZE = 400;
/** Drafts that never received a later edit (failed first publish). */
const ORPHAN_EDIT_WINDOW_MS = 2 * 60 * 1000;

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
  authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: 'ebhcs-bulletin-uploads-us',
  messagingSenderId: '556649154585',
  appId: '1:556649154585:web:3a3f49d2056aa507088288',
};

function parseArgs(argv) {
  const args = { confirm: false, credentials: null, postedBy: null, email: 'mcreed@ebhcs.org' };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--posted-by=')) args.postedBy = arg.slice('--posted-by='.length).trim();
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length).trim();
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/cleanup-inactive-draft-bulletins.mjs [options]

Options:
  --confirm           Permanently delete matched orphan post drafts (default: dry-run list only)
  --posted-by=USER    Only consider bulletins postedBy this username
  --email=ADDR        Admin email to sign in with (default: mcreed@ebhcs.org)
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
  return { mode: 'admin', db: admin.default.firestore(), admin: admin.default };
}

async function initClientDb(email) {
  const password = await prompt(`Password for ${email}: `, { hidden: true });
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  const app = initializeApp(FIREBASE_CONFIG, `cleanup-inactive-drafts-${Date.now()}`);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}\n`);

  return { mode: 'client', db: getFirestore(app), admin: null };
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

function isLikelyOrphanDraft(data) {
  // Resources are never auto-deleted by this script — visibility is isPublished.
  if (data.type === 'resource') return false;
  if (data.type !== 'post') return false;
  if (data.isActive !== false) return false;
  const createdMs = toMillis(data.createdAt);
  const updatedMs = toMillis(data.updatedAt);
  if (createdMs == null || updatedMs == null) return false;
  return Math.abs(updatedMs - createdMs) <= ORPHAN_EDIT_WINDOW_MS;
}

function summarizeDoc(id, data) {
  const title = data.title || data.titleEn || '(untitled)';
  return {
    id,
    title,
    type: data.type || '?',
    postedBy: data.postedBy || '?',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || String(data.createdAt || ''),
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
  const candidates = [];
  let skippedResources = 0;
  let skippedOther = 0;

  docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.type === 'resource') {
      skippedResources += 1;
      return;
    }
    if (args.postedBy && data.postedBy !== args.postedBy) return;
    if (!isLikelyOrphanDraft(data)) {
      if (data.type === 'post') skippedOther += 1;
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
  console.log(`Skipped ${skippedResources} resource(s) (never deleted by this script).`);
  if (skippedOther) {
    console.log(`Skipped ${skippedOther} inactive post(s) that did not match the orphan heuristic.`);
  }
  console.log(`${candidates.length} likely orphan post draft(s) (createdAt ≈ updatedAt within ${ORPHAN_EDIT_WINDOW_MS / 1000}s).`);

  if (!candidates.length) {
    console.log('Nothing to do.');
    return;
  }

  candidates.forEach((item) => {
    console.log(`- ${item.id} | ${item.type} | ${item.postedBy} | ${item.title}`);
    console.log(`    created: ${item.createdAt}`);
    console.log(`    updated: ${item.updatedAt}`);
  });

  if (!args.confirm) {
    console.log('\nDry run only. Re-run with --confirm to delete the bulletins above.');
    return;
  }

  await deleteCandidates(ctx, candidates);
  console.log(`\nDeleted ${candidates.length} orphan post draft(s).`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
