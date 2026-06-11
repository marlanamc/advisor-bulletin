#!/usr/bin/env node
/**
 * One-time backfill: set hideFromMainFeed on calendar events saved before the
 * advisor-portal fix that tags Event composer posts explicitly.
 *
 * Dry-run by default — pass --fix to write updates.
 *
 * Usage (easiest — sign in as admin, no key file needed):
 *   node scripts/patch-calendar-events.mjs --login
 *   node scripts/patch-calendar-events.mjs --login --fix
 *
 * Usage (service account key from Firebase Console):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/patch-calendar-events.mjs --fix
 *
 *   node scripts/patch-calendar-events.mjs --credentials=/path/to/key.json --fix
 *
 *   # single document
 *   node scripts/patch-calendar-events.mjs --login --id=abc123 --fix
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
  authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: 'ebhcs-bulletin-uploads-us',
  messagingSenderId: '556649154585',
  appId: '1:556649154585:web:3a3f49d2056aa507088288',
};

const CREDENTIAL_HELP = `No Firebase admin credentials found.

Option A — sign in (no key file):
  node scripts/patch-calendar-events.mjs --login
  node scripts/patch-calendar-events.mjs --login --fix

Option B — service account key:
  1. Firebase Console → Project settings → Service accounts
  2. "Generate new private key" (downloads a .json file)
  3. Save it outside git, e.g. ~/Downloads/ebhcs-service-account.json
  4. Run:
     node scripts/patch-calendar-events.mjs --credentials=~/Downloads/ebhcs-service-account.json --fix
`;

/** Mirrors isCalendarEventBulletin() legacy heuristic (pre hideFromMainFeed). */
function isLegacyCalendarEvent(data) {
  if (!data || data.type === 'resource') return false;

  const dt = data.dateType;
  if (dt !== 'event' && dt !== 'range' && dt !== 'sessions') return false;

  const hasBody = Boolean(
    (data.description || '').trim()
    || (data.company || '').trim()
    || (data.contact || '').trim()
    || (data.eventLink || '').trim()
    || data.image
    || data.pdfUrl
  );

  return data.category === 'announcement' && !hasBody;
}

/**
 * Calendar events created with optional info link / location were misclassified
 * as feed bulletins because eventLink counted as "body". Patch when the post
 * still looks like a date-label event, not a full announcement.
 */
function isMisclassifiedCalendarEvent(data) {
  if (!data || data.type === 'resource') return false;
  if (data.hideFromMainFeed === true) return false;
  if (data.category !== 'announcement') return false;
  if (!['event', 'range', 'sessions'].includes(data.dateType)) return false;
  if (data.image || data.pdfUrl) return false;
  if ((data.company || '').trim() || (data.contact || '').trim()) return false;

  const hasLocation = Boolean(
    (data.eventLocation || '').trim() || (data.address || '').trim()
  );
  const hasLink = Boolean((data.eventLink || '').trim());
  if (!hasLink && !hasLocation) return false;

  const description = (data.description || '').trim();
  const wordCount = description ? description.split(/\s+/).filter(Boolean).length : 0;
  if (wordCount > 35) return false;

  return true;
}

function needsPatch(data) {
  if (!data || data.type === 'resource') return false;
  if (data.isActive === false) return false;
  if (data.hideFromMainFeed === true) return false;
  return isLegacyCalendarEvent(data) || isMisclassifiedCalendarEvent(data);
}

function matchReason(data) {
  if (isLegacyCalendarEvent(data)) return 'legacy calendar event (title + date only)';
  if (isMisclassifiedCalendarEvent(data)) return 'calendar event with optional link/location';
  return 'unknown';
}

function parseArgs(argv) {
  const args = { fix: false, credentials: null, id: '', login: false, email: 'admin@ebhcs.org' };
  for (const arg of argv) {
    if (arg === '--fix') args.fix = true;
    else if (arg === '--login') args.login = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--id=')) args.id = arg.slice('--id='.length);
    else if (arg.startsWith('--email=')) args.email = arg.slice('--email='.length);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/patch-calendar-events.mjs [options]

Options:
  --login           Sign in with an @ebhcs.org admin account (no service-account file)
  --email=ADDR      Admin email for --login (default: admin@ebhcs.org)
  --credentials=PATH  Path to Firebase service-account JSON
  --fix             Write hideFromMainFeed: true (default is dry-run)
  --id=DOC_ID       Patch a single bulletin only
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
      const onData = (char) => {
        const s = char.toString();
        if (s === '\n' || s === '\r' || s === '\r\n' || s === '') return;
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
  return {
    mode: 'admin',
    db: admin.default.firestore(),
    admin: admin.default,
  };
}

async function initClientDb(email) {
  const password = await prompt(`Password for ${email}: `, { hidden: true });
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  const app = initializeApp(FIREBASE_CONFIG, `patch-calendar-events-${Date.now()}`);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}\n`);

  return {
    mode: 'client',
    db: getFirestore(app),
    admin: null,
  };
}

async function resolveDb(args) {
  const adminDb = await initAdminDb(args.credentials);
  if (adminDb) return adminDb;

  if (args.login) {
    return initClientDb(args.email);
  }

  throw new Error(CREDENTIAL_HELP);
}

async function fetchDocs(db, mode, id) {
  if (mode === 'admin') {
    if (id) {
      const snap = await db.collection(COLLECTION).doc(id).get();
      if (!snap.exists) {
        console.error(`No document with id "${id}".`);
        process.exit(1);
      }
      return [snap];
    }
    const snapshot = await db.collection(COLLECTION).where('isActive', '==', true).get();
    return snapshot.docs;
  }

  const { collection, doc, getDoc, getDocs, query, where } = await import('firebase/firestore');
  if (id) {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) {
      console.error(`No document with id "${id}".`);
      process.exit(1);
    }
    return [snap];
  }
  const snapshot = await getDocs(query(collection(db, COLLECTION), where('isActive', '==', true)));
  return snapshot.docs;
}

async function patchDoc(ctx, docSnap) {
  if (ctx.mode === 'admin') {
    await docSnap.ref.update({
      hideFromMainFeed: true,
      updatedAt: ctx.admin.default.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  await updateDoc(doc(ctx.db, COLLECTION, docSnap.id), {
    hideFromMainFeed: true,
    updatedAt: serverTimestamp(),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await resolveDb(args);
  const docs = await fetchDocs(ctx.db, ctx.mode, args.id);

  const candidates = docs.filter((docSnap) => needsPatch(docSnap.data()));

  if (candidates.length === 0) {
    console.log('No calendar events need hideFromMainFeed.');
    return;
  }

  console.log(`${args.fix ? 'Patching' : 'Would patch'} ${candidates.length} calendar event(s):\n`);

  let patched = 0;
  for (const docSnap of candidates) {
    const data = docSnap.data();
    const title = data.title || data.titleEn || docSnap.id;
    console.log(`  • ${title}`);
    console.log(`    id:       ${docSnap.id}`);
    console.log(`    dateType: ${data.dateType || '(none)'}`);
    console.log(`    reason:   ${matchReason(data)}`);
    if ((data.eventLink || '').trim()) console.log(`    link:     ${data.eventLink}`);
    if ((data.eventLocation || data.address || '').trim()) {
      console.log(`    location: ${data.eventLocation || data.address}`);
    }

    if (args.fix) {
      await patchDoc(ctx, docSnap);
      patched += 1;
      console.log('    ✓ updated hideFromMainFeed: true');
    }
    console.log('');
  }

  if (!args.fix) {
    console.log('Re-run with --fix to apply these updates.');
  } else {
    console.log(`Done. Patched ${patched} document(s).`);
    console.log('Tip: run `npm run build:snapshot` if you ship a static student feed snapshot.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
