import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createInterface } from 'node:readline';
import { stdin, stdout, argv } from 'node:process';

const firebaseConfig = {
  apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
  authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
  projectId: 'ebhcs-bulletin-board',
  storageBucket: 'ebhcs-bulletin-uploads-us',
  messagingSenderId: '556649154585',
  appId: '1:556649154585:web:3a3f49d2056aa507088288',
};

const ALWAYS_EXCLUDE = new Set(['admin', 'leah', 'mcreed']);

function parseArgs(args) {
  const opts = { dryRun: false, only: null, extraExclude: new Set() };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--only') opts.only = new Set((args[++i] || '').split(',').map(s => s.trim()).filter(Boolean));
    else if (a === '--exclude') (args[++i] || '').split(',').map(s => s.trim()).filter(Boolean).forEach(u => opts.extraExclude.add(u));
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/mark-password-change.mjs [options]

Sets users/{username}.requirePasswordChange = true so existing default-password
accounts are forced to rotate their password on next login.

Options:
  --only u1,u2      Only mark these usernames (comma-separated)
  --exclude u1,u2   Skip these usernames (in addition to admin, leah, mcreed)
  --dry-run         Show what would change without writing
`);
      process.exit(0);
    }
  }
  return opts;
}

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
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
        resolve(answer);
      });
    } else {
      rl.question(question, (answer) => { rl.close(); resolve(answer); });
    }
  });
}

async function main() {
  const opts = parseArgs(argv.slice(2));
  const password = await prompt('Password for admin@ebhcs.org: ', { hidden: true });

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, 'admin@ebhcs.org', password);
  console.log('Signed in as admin@ebhcs.org');

  const advisorsSnap = await getDocs(collection(db, 'advisors'));
  const advisors = advisorsSnap.docs.map(d => ({ username: d.id, ...d.data() }));

  const targets = advisors.filter(a => {
    if (opts.only) return opts.only.has(a.username);
    if (ALWAYS_EXCLUDE.has(a.username)) return false;
    if (opts.extraExclude.has(a.username)) return false;
    return true;
  });

  if (!targets.length) {
    console.log('No advisors matched. Nothing to do.');
    process.exit(0);
  }

  console.log(`\n${opts.dryRun ? '[dry-run] ' : ''}Marking ${targets.length} advisor(s) for password change:`);
  for (const t of targets) console.log(`  - ${t.username} (${t.displayName || '—'})`);

  if (opts.dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  let updated = 0;
  let alreadySet = 0;
  for (const t of targets) {
    const ref = doc(db, 'users', t.username);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().requirePasswordChange === true) {
      alreadySet++;
      console.log(`  skip  ${t.username} (flag already true)`);
      continue;
    }
    await setDoc(ref, {
      requirePasswordChange: true,
      requirePasswordChangeMarkedAt: serverTimestamp(),
    }, { merge: true });
    updated++;
    console.log(`  set   ${t.username}`);
  }

  console.log(`\nDone. Updated ${updated}, already set ${alreadySet}, skipped ${advisors.length - targets.length}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
