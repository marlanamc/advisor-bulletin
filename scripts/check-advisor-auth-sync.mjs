#!/usr/bin/env node
/**
 * Pre-deploy check for the "active advisor" security rules.
 *
 * firestore.rules and storage.rules only allow writes from accounts whose
 * advisors/{username} doc exists (privileged admins exempt). Before deploying
 * that rule change — and any time logins look out of sync — run this to list:
 *
 *   1. Firebase Auth users with NO advisors/{username} doc
 *   2. advisors/{username} docs with NO Auth user
 *
 * Option A — service account key (full automatic check):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-advisor-auth-sync.mjs
 *
 * Option B — no key file (admin password + Firebase CLI):
 *   firebase login
 *   node scripts/check-advisor-auth-sync.mjs --email=mcreed@ebhcs.org
 *
 * Option C — no key file, manual Auth export:
 *   firebase auth:export /tmp/auth-users.json --format=json --project ebhcs-bulletin-board
 *   node scripts/check-advisor-auth-sync.mjs --email=mcreed@ebhcs.org --auth-export=/tmp/auth-users.json
 *
 * NOTE: the portal now uses Google sign-in only. Option B relies on
 * signInWithEmailAndPassword, so it stops working once the Email/Password
 * provider is disabled in Firebase Console — use Option A or C then.
 */

import { readFileSync, existsSync, mkdtempSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const PRIVILEGED_EMAILS = new Set(['mcreed@ebhcs.org', 'lgregory@ebhcs.org']);

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
  authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: 'ebhcs-bulletin-uploads-us',
  messagingSenderId: '556649154585',
  appId: '1:556649154585:web:3a3f49d2056aa507088288',
};

function parseArgs(argv) {
  const args = { credentials: null, email: null, authExport: null };
  for (const arg of argv) {
    if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length).trim();
    else if (arg.startsWith('--auth-export=')) args.authExport = arg.slice('--auth-export='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/check-advisor-auth-sync.mjs [options]

Options:
  --credentials=PATH   Service account JSON (or set GOOGLE_APPLICATION_CREDENTIALS)
  --email=ADDR         Sign in with this admin account to read advisors (no key file)
  --auth-export=PATH   JSON from "firebase auth:export" (used with --email)
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
    const path = resolve(candidate);
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

async function loadAdvisorUsernamesFromServiceAccount(credentialPath) {
  const admin = (await import('firebase-admin')).default;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(readFileSync(credentialPath, 'utf8'))),
      projectId: PROJECT_ID,
    });
  }
  const advisorsSnap = await admin.firestore().collection('advisors').get();
  return { advisorUsernames: new Set(advisorsSnap.docs.map((d) => d.id)), admin };
}

async function loadAdvisorUsernamesFromPassword(email) {
  const password = await prompt(`Password for ${email}: `, { hidden: true });
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore, collection, getDocs } = await import('firebase/firestore');

  const app = initializeApp(FIREBASE_CONFIG, `check-advisor-auth-sync-${Date.now()}`);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}\n`);

  const advisorsSnap = await getDocs(collection(getFirestore(app), 'advisors'));
  return new Set(advisorsSnap.docs.map((d) => d.id));
}

async function loadAuthUsernamesFromServiceAccount(admin) {
  const authUsers = [];
  let pageToken;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return mapAuthUsers(authUsers);
}

function mapAuthUsers(users) {
  const authUsernames = new Map();
  for (const user of users) {
    const email = (user.email || '').toLowerCase();
    if (!email.endsWith('@ebhcs.org')) continue;
    authUsernames.set(email.split('@')[0], {
      email,
      disabled: Boolean(user.disabled),
    });
  }
  return authUsernames;
}

function loadAuthUsernamesFromExport(exportPath) {
  const raw = JSON.parse(readFileSync(resolve(exportPath), 'utf8'));
  const users = Array.isArray(raw.users) ? raw.users : [];
  return mapAuthUsers(users);
}

function tryFirebaseAuthExport() {
  const dir = mkdtempSync(resolve(tmpdir(), 'advisor-auth-export-'));
  const exportPath = resolve(dir, 'users.json');
  try {
    execFileSync('firebase', [
      'auth:export',
      exportPath,
      '--format=json',
      '--project',
      PROJECT_ID,
    ], { stdio: 'pipe' });
    const authUsernames = loadAuthUsernamesFromExport(exportPath);
    unlinkSync(exportPath);
    return authUsernames;
  } catch (error) {
    return null;
  }
}

function reportSync(advisorUsernames, authUsernames) {
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
    // Not a problem with Google sign-in: the Auth account is created
    // automatically the first time the advisor signs in with Google.
    console.log(
      `INFO: advisors/${username} has no Firebase Auth user yet — ` +
        'they simply have not signed in with Google for the first time. No action needed.'
    );
  }

  if (!problems) {
    console.log('All good: every Auth login has an advisor doc and vice versa.');
  } else {
    console.log(`\n${problems} mismatch(es) found — resolve them before or shortly after deploying the rules.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const credentialPath = resolveCredentialPath(args.credentials);

  if (credentialPath) {
    const { advisorUsernames, admin } = await loadAdvisorUsernamesFromServiceAccount(credentialPath);
    const authUsernames = await loadAuthUsernamesFromServiceAccount(admin);
    reportSync(advisorUsernames, authUsernames);
    return;
  }

  if (!args.email) {
    console.error(
      'No service account key found. Use one of these instead:\n\n' +
        '  1. Service account key:\n' +
        '     GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/check-advisor-auth-sync.mjs\n\n' +
        '  2. Admin password + Firebase CLI (no key file):\n' +
        '     firebase login\n' +
        '     node scripts/check-advisor-auth-sync.mjs --email=mcreed@ebhcs.org\n\n' +
        '  3. Admin password + manual Auth export:\n' +
        '     firebase auth:export /tmp/auth-users.json --format=json --project ebhcs-bulletin-board\n' +
        '     node scripts/check-advisor-auth-sync.mjs --email=mcreed@ebhcs.org --auth-export=/tmp/auth-users.json'
    );
    process.exit(1);
  }

  const advisorUsernames = await loadAdvisorUsernamesFromPassword(args.email);

  let authUsernames = null;
  if (args.authExport) {
    authUsernames = loadAuthUsernamesFromExport(args.authExport);
  } else {
    console.log('Trying firebase auth:export (requires "firebase login" with project access)…');
    authUsernames = tryFirebaseAuthExport();
  }

  if (!authUsernames) {
    console.error(
      '\nCould not list Auth users without a service account key.\n' +
        'Run "firebase login", then re-run this script, or pass an export file:\n' +
        '  firebase auth:export /tmp/auth-users.json --format=json --project ebhcs-bulletin-board\n' +
        `  node scripts/check-advisor-auth-sync.mjs --email=${args.email} --auth-export=/tmp/auth-users.json`
    );
    process.exit(1);
  }

  reportSync(advisorUsernames, authUsernames);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
