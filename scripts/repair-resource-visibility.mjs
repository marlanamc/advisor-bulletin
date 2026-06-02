#!/usr/bin/env node
/**
 * Diagnose and optionally repair a resource that is hidden from students.
 *
 * Finds a resource by title (partial, case-insensitive) and reports all
 * public-render predicates. With --fix it sets isPublished: true and
 * isActive: true if either is wrong.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/repair-resource-visibility.mjs --title="MA Department of Unemployment"
 *
 *   # add --fix to actually write the repair
 *   node scripts/repair-resource-visibility.mjs \
 *     --title="MA Department of Unemployment" --fix
 *
 *   # pass service account path explicitly
 *   node scripts/repair-resource-visibility.mjs \
 *     --credentials=/path/to/sa.json \
 *     --title="MA Department of Unemployment" --fix
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

function parseArgs(argv) {
  const args = { fix: false, credentials: null, title: '' };
  for (const arg of argv) {
    if (arg === '--fix') args.fix = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (arg.startsWith('--title=')) args.title = arg.slice('--title='.length);
  }
  return args;
}

async function initAdminDb(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error(
      'No service account found. Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=/path/to/sa.json'
    );
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return { db: admin.default.firestore(), admin: admin.default };
}

function checkVisibility(data) {
  const issues = [];
  if (data.type !== 'resource') issues.push(`type is "${data.type}" — expected "resource"`);
  if (data.isActive !== true) issues.push(`isActive is ${JSON.stringify(data.isActive)} — expected true`);
  if (data.isPublished !== true) issues.push(`isPublished is ${JSON.stringify(data.isPublished)} — expected true`);
  if (!data.resourceCategory) issues.push('resourceCategory is missing or empty');
  if (!data.title && !data.titleEn) issues.push('title/titleEn is missing');
  return issues;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.title) {
    console.error('Error: --title is required. Example: --title="MA Department of Unemployment"');
    process.exit(1);
  }

  const { db, admin } = await initAdminDb(args.credentials);
  const needle = args.title.toLowerCase();

  const snapshot = await db.collection(COLLECTION)
    .where('type', '==', 'resource')
    .get();

  const matches = snapshot.docs.filter((doc) => {
    const d = doc.data();
    const t = (d.titleEn || d.title || '').toLowerCase();
    return t.includes(needle);
  });

  if (matches.length === 0) {
    console.log(`No resource found matching "${args.title}".`);
    console.log('Try a shorter search term or check the title in the admin panel.');
    process.exit(0);
  }

  for (const docSnap of matches) {
    const data = docSnap.data();
    const docTitle = data.titleEn || data.title || docSnap.id;
    console.log(`\n─── ${docTitle} (id: ${docSnap.id}) ───`);
    console.log(`  type:             ${data.type}`);
    console.log(`  isActive:         ${data.isActive}`);
    console.log(`  isPublished:      ${data.isPublished}`);
    console.log(`  resourceCategory: ${data.resourceCategory}`);
    console.log(`  url/eventLink:    ${data.url || data.eventLink || '(none)'}`);
    console.log(`  resourceLogo:     ${data.resourceLogo ? `(${data.resourceLogo.length} chars)` : '(none)'}`);

    const issues = checkVisibility(data);
    if (issues.length === 0) {
      console.log('\n  ✓ All visibility predicates look correct — resource should appear to students.');
      console.log('    If it is still missing, check the student page filter logic or browser cache.');
    } else {
      console.log('\n  Issues found:');
      issues.forEach((issue) => console.log(`    ✗ ${issue}`));

      if (args.fix) {
        const patch = { updatedAt: admin.default.firestore.FieldValue.serverTimestamp() };
        if (data.isPublished !== true) patch.isPublished = true;
        if (data.isActive !== true) patch.isActive = true;
        await docSnap.ref.update(patch);
        console.log(`\n  ✓ Repaired: ${Object.keys(patch).filter(k => k !== 'updatedAt').join(', ')}`);
      } else {
        console.log('\n  Re-run with --fix to repair automatically.');
      }
    }
  }
}

main().catch((error) => {
  console.error('Script failed:', error.message || error);
  process.exit(1);
});
