/** Correct Jorge's verified Google login; dry run unless --confirm is passed. */
import { readFileSync } from 'node:fs';
import admin from 'firebase-admin';
import { PROJECT_ID } from './lib/firebase-config.mjs';

const app = admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json', 'utf8'
  ))),
  projectId: PROJECT_ID,
});

try {
  const user = await admin.auth().getUserByEmail('jrocha@ebhcs.org');
  if (user.disabled || !user.emailVerified || !user.providerData.some(p => p.providerId === 'google.com')) {
    throw new Error('Expected an enabled, verified Google account for Jorge.');
  }
  const db = admin.firestore();
  const oldRef = db.doc('advisors/rocha');
  const newRef = db.doc('advisors/jrocha');
  const directoryRef = db.doc('config/studentDirectory');
  await db.runTransaction(async tx => {
    const [old, current, directory, posts] = await Promise.all([
      tx.get(oldRef), tx.get(newRef), tx.get(directoryRef),
      tx.get(db.collection('bulletins').where('postedBy', '==', 'rocha')),
    ]);
    if (!old.exists && current.exists && current.data().email === user.email) {
      console.log('Already corrected: advisors/jrocha exists.');
      return;
    }
    if (!old.exists || old.data().displayName !== 'Jorge' || old.data().email !== 'rocha@ebhcs.org' || current.exists) {
      throw new Error('Unexpected advisor records; refusing to overwrite.');
    }
    const entries = directory.data()?.advisors;
    if (!Array.isArray(entries) || entries.filter(a => a.loginUsername === 'rocha' && a.name === 'Jorge').length !== 1) {
      throw new Error('Expected exactly one old Jorge directory entry.');
    }
    if (posts.size > 400) throw new Error('Too many posts for this single transaction.');
    console.log(`Correct advisors/rocha → advisors/jrocha, directory email, and ${posts.size} post(s). Preserve existing advisor role.`);
    if (!process.argv.includes('--confirm')) {
      console.log('Dry run only.');
      return;
    }
    tx.create(newRef, { ...old.data(), email: user.email });
    tx.delete(oldRef);
    tx.update(directoryRef, {
      advisors: entries.map(a => a.loginUsername === 'rocha'
        ? { ...a, email: user.email, loginUsername: 'jrocha' } : a),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    for (const post of posts.docs) tx.update(post.ref, { postedBy: 'jrocha' });
  });
  console.log(process.argv.includes('--confirm') ? 'Correction committed.' : 'Review complete.');
} finally {
  await app.delete();
}
