import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { firebaseConfig } from './lib/firebase-config.mjs';

const TARGETS = [
  { id: 'lgregory', displayName: 'Leah',   email: 'lgregory@ebhcs.org', isAdmin: true },
  { id: 'mcreed',   displayName: 'Marlie', email: 'mcreed@ebhcs.org',   isAdmin: true },
];

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    if (hidden) {
      const onData = (char) => {
        const s = char.toString();
        if (s === '\n' || s === '\r' || s === '\r\n' || s === '') return;
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
  const password = await prompt('Password for mcreed@ebhcs.org: ', { hidden: true });

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithEmailAndPassword(auth, 'mcreed@ebhcs.org', password);
  console.log('Signed in as mcreed@ebhcs.org');

  for (const target of TARGETS) {
    const ref = doc(db, 'advisors', target.id);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : {};
    const next = {
      ...existing,
      displayName: target.displayName,
      email: target.email,
      isAdmin: target.isAdmin,
    };
    await setDoc(ref, next, { merge: true });
    console.log(`Updated advisors/${target.id} → isAdmin=${target.isAdmin}`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
