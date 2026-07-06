#!/usr/bin/env node
/**
 * Pre-deploy check for the "active advisor" security rules.
 *
 * firestore.rules and storage.rules only allow writes from accounts whose
 * advisors/{username} doc exists (privileged admins exempt). Before deploying
 * that rule change — and any time logins look out of sync — run this to list:
 *
 *   1. Firebase Auth users with NO advisors/{username} doc
 *      → they can sign in but can no longer post; disable or delete them
 *        in Firebase Console unless they are privileged admins.
 *   2. advisors/{username} docs with NO Auth user
 *      → they appear in the portal but cannot log in; complete step 2 of
 *        the new-advisor checklist (create the Auth user) or remove them.
 *
 * Requires a service account key (Auth users can't be listed with the client SDK):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-advisor-auth-sync.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'ebhcs-bulletin-board';
const PRIVILEGED_EMAILS = new Set(['admin@ebhcs.org', 'leah@ebhcs.org']);

function resolveCredentialPath() {
  const candidates = [
    process.argv.find((a) => a.startsWith('--credentials='))?.slice('--credentials='.length),
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
  const credentialPath = resolveCredentialPath();
  if (!credentialPath) {
    console.error(
      'A service account key is required (Firebase Auth users cannot be listed otherwise).\n' +
        'Download one from Firebase Console → Project settings → Service accounts, then run:\n' +
        '  GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/check-advisor-auth-sync.mjs'
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

  const advisorsSnap = await admin.firestore().collection('advisors').get();
  const advisorUsernames = new Set(advisorsSnap.docs.map((d) => d.id));

  const authUsers = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const authUsernames = new Map(); // username -> { email, disabled }
  for (const user of authUsers) {
    const email = (user.email || '').toLowerCase();
    if (!email.endsWith('@ebhcs.org')) continue;
    authUsernames.set(email.split('@')[0], { email, disabled: user.disabled });
  }

  console.log(`Found ${advisorUsernames.size} advisor doc(s) and ${authUsernames.size} @ebhcs.org Auth user(s).\n`);

  let problems = 0;

  for (const [username, { email, disabled }] of authUsernames) {
    if (advisorUsernames.has(username)) continue;
    if (PRIVILEGED_EMAILS.has(email)) {
      console.log(`OK (privileged, no advisor doc needed): ${email}`);
      continue;
    }
    if (disabled) {
      console.log(`OK (already disabled): ${email}`);
      continue;
    }
    problems += 1;
    console.log(
      `WARN: Auth user ${email} has no advisors/${username} doc. ` +
        'They can sign in but cannot post. If they left, disable the account in Firebase Console; ' +
        'if they are current staff, re-add them on the Advisors tab.'
    );
  }

  for (const username of advisorUsernames) {
    if (authUsernames.has(username)) continue;
    problems += 1;
    console.log(
      `WARN: advisors/${username} has no Firebase Auth user. ` +
        'They cannot log in — create the Auth user (new-advisor checklist step 2) or remove them from the Advisors tab.'
    );
  }

  if (!problems) {
    console.log('All good: every Auth login has an advisor doc and vice versa.');
  } else {
    console.log(`\n${problems} mismatch(es) found — resolve them before or shortly after deploying the rules.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
