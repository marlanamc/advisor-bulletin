#!/usr/bin/env node
/**
 * One-time migration for the Google sign-in switch (July 2026).
 *
 * The portal originally used made-up logins like jorge@ebhcs.org, so Firestore
 * keys advisors and posts by those short usernames. With Google sign-in,
 * everyone arrives as their REAL @ebhcs.org account (rocha@, vlalin@, …), and
 * access/ownership checks derive the username from that email. This script
 * re-keys everything to the real email prefixes:
 *
 *   1. advisors/{old} → advisors/{new} (copy fields, fix email, delete old)
 *   2. bulletins.postedBy old → new
 *   3. deletes the defunct advisors/admin doc if present
 *   4. ensures advisors/mcreed exists (displayName "Marlie", admin, hidden
 *      from the student directory)
 *   5. republishes config/studentDirectory with the new loginUsernames
 *
 * Dry-run by default — prints what it would change. Requires a service
 * account key (like the other maintenance scripts):
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/migrate-advisor-usernames.mjs           # dry run
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/migrate-advisor-usernames.mjs --confirm # write changes
 *
 * Run BEFORE (or together with) deploying the Google-sign-in build and rules.
 * Safe to re-run: already-migrated docs are skipped.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'ebhcs-bulletin-board';

// old username (current doc id / postedBy) → real email prefix
const USERNAME_MAP = {
  leah: 'lgregory',
  carmen: 'vlalin',
  fabiola: 'fvaquerano',
  felipe: 'fgallego',
  jerome: 'jkiley',
  jorge: 'rocha',
  leidy: 'lalzate',
  mike: 'mkelsen',
  simonetta: 'spiergentili',
};

const DELETE_USERNAMES = ['admin']; // defunct shared login, never a real Google account

const ENSURE_ADVISORS = [
  {
    username: 'mcreed',
    displayName: 'Marlie',
    email: 'mcreed@ebhcs.org',
    isAdmin: true,
    publicRole: 'Advisor',
    showInDirectory: false,
  },
];

function resolveCredentialPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve('service-account.json'),
    resolve('config/service-account.json'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const path = resolve(candidate);
    if (existsSync(path)) return path;
  }
  return null;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const credentialPath = resolveCredentialPath();
  if (!credentialPath) {
    console.error(
      'Service account key required. Set GOOGLE_APPLICATION_CREDENTIALS or place service-account.json in the repo root.'
    );
    process.exit(1);
  }

  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(readFileSync(credentialPath, 'utf8'))),
      projectId: PROJECT_ID,
    });
  }
  const db = admin.firestore();

  console.log(confirm ? 'LIVE RUN — writing changes.\n' : 'DRY RUN — pass --confirm to write.\n');
  let changes = 0;

  // 1 + 3. Re-key advisor docs, delete defunct ones.
  const advisorsSnap = await db.collection('advisors').get();
  const existingIds = new Set(advisorsSnap.docs.map((d) => d.id));

  for (const docSnap of advisorsSnap.docs) {
    const oldId = docSnap.id;

    if (DELETE_USERNAMES.includes(oldId)) {
      changes += 1;
      console.log(`DELETE advisors/${oldId} (defunct login)`);
      if (confirm) await db.doc(`advisors/${oldId}`).delete();
      continue;
    }

    const newId = USERNAME_MAP[oldId];
    if (!newId) continue; // already an email prefix (or unknown — leave alone)

    changes += 1;
    const data = { ...docSnap.data(), email: `${newId}@ebhcs.org` };
    if (existingIds.has(newId)) {
      // A doc for the real prefix already exists (e.g. lgregory) — keep it,
      // just drop the old alias doc.
      console.log(`MERGE  advisors/${oldId} → advisors/${newId} (target exists; deleting ${oldId})`);
      if (confirm) await db.doc(`advisors/${oldId}`).delete();
    } else {
      console.log(`RENAME advisors/${oldId} → advisors/${newId}`);
      if (confirm) {
        await db.doc(`advisors/${newId}`).set(data);
        await db.doc(`advisors/${oldId}`).delete();
      }
    }
  }

  // 2. Re-point bulletins.postedBy.
  for (const [oldName, newName] of Object.entries(USERNAME_MAP)) {
    const postsSnap = await db.collection('bulletins').where('postedBy', '==', oldName).get();
    if (postsSnap.empty) continue;
    changes += postsSnap.size;
    console.log(`UPDATE ${postsSnap.size} bulletin(s): postedBy '${oldName}' → '${newName}'`);
    if (confirm) {
      // Batched in chunks of 400 to stay under the 500-write batch limit.
      const docs = postsSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = db.batch();
        docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { postedBy: newName }));
        await batch.commit();
      }
    }
  }

  // 4. Ensure required advisor docs exist.
  for (const advisor of ENSURE_ADVISORS) {
    const { username, ...fields } = advisor;
    const ref = db.doc(`advisors/${username}`);
    const snap = await ref.get();
    if (snap.exists) {
      console.log(`OK     advisors/${username} already exists (untouched)`);
      continue;
    }
    changes += 1;
    console.log(`CREATE advisors/${username} (${fields.displayName}, admin: ${fields.isAdmin})`);
    if (confirm) {
      await ref.set({ ...fields, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }

  // 5. Republish the student directory from the (migrated) advisors collection.
  //    Mirrors publishStudentDirectory() in src/admin-manage.js.
  const finalSnap = confirm ? await db.collection('advisors').get() : advisorsSnap;
  const entries = finalSnap.docs
    .map((d) => ({ username: d.id, ...d.data() }))
    .filter((a) => !DELETE_USERNAMES.includes(a.username) && a.showInDirectory !== false)
    .map((a) => ({
      name: a.displayName || a.username,
      role: a.publicRole || 'Advisor',
      email: a.email || `${USERNAME_MAP[a.username] || a.username}@ebhcs.org`,
      loginUsername: USERNAME_MAP[a.username] || a.username,
    }))
    .sort((a, b) => {
      const aCoord = a.role === 'Advisor' ? 1 : 0;
      const bCoord = b.role === 'Advisor' ? 1 : 0;
      if (aCoord !== bCoord) return aCoord - bCoord;
      return a.name.localeCompare(b.name);
    });
  console.log(`PUBLISH config/studentDirectory with ${entries.length} advisor(s): ${entries.map((e) => e.loginUsername).join(', ')}`);
  if (confirm) {
    await db.doc('config/studentDirectory').set({
      advisors: entries,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(`\n${confirm ? 'Done.' : 'Dry run complete.'} ${changes} change(s)${confirm ? ' applied' : ' pending'}.`);
  if (!confirm && changes > 0) {
    console.log('Re-run with --confirm to apply.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
