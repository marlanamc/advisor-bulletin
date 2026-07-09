#!/usr/bin/env node
/**
 * Delete every resource document that came from the CSV importer.
 *
 * Targets only docs with `importSource == 'csv-import'`. Anything an advisor
 * created by hand in the portal is left untouched.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/delete-imported-resources.mjs --dry-run
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/delete-imported-resources.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const IMPORT_SOURCE = 'csv-import';
const BATCH_SIZE = 400;

function parseArgs(argv) {
  const args = { dryRun: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    if (hidden) {
      rl.stdoutMuted = true;
      rl._writeToOutput = (text) => {
        rl.output.write(rl.stdoutMuted ? '*' : text);
      };
      rl.question(question, (answer) => {
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
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    return null;
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

async function initClientDb() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
    authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
    projectId: PROJECT_ID,
    storageBucket: 'ebhcs-bulletin-uploads-us',
    messagingSenderId: '556649154585',
    appId: '1:556649154585:web:3a3f49d2056aa507088288',
  };

  const password = await prompt('Password for mcreed@ebhcs.org: ', { hidden: true });
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, 'mcreed@ebhcs.org', password);
  console.log('Signed in as mcreed@ebhcs.org (client SDK)');
  return getFirestore(app);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const adminDb = await initAdminDb(args.credentials);
  const useAdmin = !!adminDb;
  
  if (!useAdmin) {
    console.log('No service account found — using client SDK auth.');
  }
  
  const db = adminDb || (await initClientDb());

  if (useAdmin) {
    const snapshot = await db.collection(COLLECTION)
      .where('importSource', '==', IMPORT_SOURCE)
      .get();

    if (snapshot.empty) {
      console.log('No imported resources found — nothing to delete.');
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} imported resource(s).`);

    if (args.dryRun) {
      snapshot.forEach((doc) => {
        const d = doc.data();
        console.log(`[dry-run] would delete ${d.titleEn || d.title || doc.id} (${d.resourceCategory || '?'})`);
      });
      console.log(`\nDry run — ${snapshot.size} resource(s) would be deleted.`);
      process.exit(0);
    }

    const docs = snapshot.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const slice = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      slice.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      slice.forEach((doc) => {
        const d = doc.data();
        console.log(`Deleted ${d.titleEn || d.title || doc.id}`);
      });
      deleted += slice.length;
    }

    console.log(`\nDeleted ${deleted} resource(s).`);
  } else {
    const { collection, query, where, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    const q = query(collection(db, COLLECTION), where('importSource', '==', IMPORT_SOURCE));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('No imported resources found — nothing to delete.');
      process.exit(0);
    }

    console.log(`Found ${querySnapshot.size} imported resource(s).`);

    if (args.dryRun) {
      querySnapshot.forEach((document) => {
        const d = document.data();
        console.log(`[dry-run] would delete ${d.titleEn || d.title || document.id} (${d.resourceCategory || '?'})`);
      });
      console.log(`\nDry run — ${querySnapshot.size} resource(s) would be deleted.`);
      process.exit(0);
    }

    let deleted = 0;
    for (const document of querySnapshot.docs) {
      await deleteDoc(doc(db, COLLECTION, document.id));
      console.log(`Deleted ${document.data().titleEn || document.data().title || document.id}`);
      deleted += 1;
    }

    console.log(`\nDeleted ${deleted} resource(s).`);
  }
}

main().catch((error) => {
  console.error('Delete failed:', error.message || error);
  process.exit(1);
});
