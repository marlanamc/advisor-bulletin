#!/usr/bin/env node
/**
 * Adds the Massachusetts Access to Counsel Initiative (MACI) to the
 * Immigration category: a single statewide intake line (MIRA + CPCS) that
 * screens people in removal proceedings and refers eligible callers to a
 * contracted legal provider. Distinct from MOIA (consultations) and the MIRA
 * helpline (information) because it is the route to court representation.
 *
 * Phone verified 2026-10-11 against miracoalition.org/resources/massachusetts-
 * access-to-counsel-initiative-maci/ and the MACI flyer: (508) 505-4588.
 *
 * Slots in at resourceOrder 5, next to MOIA; existing cards at 5+ shift down one.
 *
 * Usage:
 *   node scripts/archive/add-immigration-maci-2026-10.mjs           # dry run
 *   node scripts/archive/add-immigration-maci-2026-10.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const NEW_RESOURCE = {
  titleEn: 'Massachusetts Access to Counsel Initiative (MACI)',
  titleEs: 'Massachusetts Access to Counsel Initiative (MACI)',
  description: 'Call if you have a case in immigration court and need a lawyer. They ask you some questions and may connect you with a lawyer. They speak Spanish and can get an interpreter for other languages.',
  summaryEs: 'Llame si tiene un caso en la corte de inmigración y necesita un abogado. Le hacen algunas preguntas y es posible que le conecten con un abogado. Hablan español y pueden conseguir un intérprete para otros idiomas.',
  url: 'https://miracoalition.org/resources/massachusetts-access-to-counsel-initiative-maci/',
  phone: '508-505-4588',
  services: ['Find a lawyer for immigration court', 'Help if someone is detained'],
  resourceOrder: 5,
};

function parseArgs(argv) {
  const args = { confirm: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

async function initAdmin(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or pass --credentials=...');
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return admin.default;
}

function buildDoc(r) {
  return {
    type: 'resource',
    title: r.titleEn,
    titleEn: r.titleEn,
    titleEs: r.titleEs,
    category: 'resource',
    resourceCategory: 'immigration',
    resourceIcon: 'shield',
    resourceLogo: null,
    url: r.url,
    eventLink: r.url,
    description: r.description,
    summaryEs: r.summaryEs,
    highlights: r.services.join(', '),
    services: r.services,
    serviceChips: r.services,
    actionLinks: [],
    advisorName: 'Import',
    postedBy: 'admin',
    address: '',
    phone: r.phone,
    phoneMode: 'call',
    hours: '',
    languages: ['ENG', 'ESP'],
    lastVerified: '2026-10',
    isActive: true,
    isPublished: true,
    isPinned: false,
    resourceOrder: r.resourceOrder,
    company: '',
    contact: '',
    dateType: '',
    eventDate: '',
    eventDates: [],
    startDate: '',
    endDate: '',
    deadline: '',
    startTime: '',
    endTime: '',
    eventLocation: '',
    classType: '',
    image: null,
    pdfUrl: null,
    importSource: 'manual-research-2026-10',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const snap = await db.collection(COLLECTION).where('resourceCategory', '==', 'immigration').get();
  const existing = snap.docs.filter((d) => d.data().type === 'resource');
  if (existing.some((d) => /access to counsel|\bMACI\b/i.test(d.data().titleEn || d.data().title || ''))) {
    console.log('MACI card already exists — nothing to do.');
    return;
  }
  const toShift = existing
    .filter((d) => typeof d.data().resourceOrder === 'number' && d.data().resourceOrder >= NEW_RESOURCE.resourceOrder)
    .sort((a, b) => a.data().resourceOrder - b.data().resourceOrder);

  if (!args.confirm) {
    for (const d of toShift) console.log(`[dry-run] SHIFT "${d.data().titleEn || d.data().title}" ${d.data().resourceOrder} -> ${d.data().resourceOrder + 1}`);
    console.log(`[dry-run] CREATE "${NEW_RESOURCE.titleEn}" -> resourceOrder: ${NEW_RESOURCE.resourceOrder}`);
    console.log(`   chips: ${JSON.stringify(NEW_RESOURCE.services)}`);
    console.log(`   description: ${NEW_RESOURCE.description}`);
    console.log(`   url: ${NEW_RESOURCE.url}`);
    console.log(`   phone: ${NEW_RESOURCE.phone}`);
    return;
  }

  const batch = db.batch();
  for (const d of toShift) {
    batch.update(d.ref, { resourceOrder: d.data().resourceOrder + 1, updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  console.log(`✓ Shifted ${toShift.length} cards down one`);

  const doc = buildDoc(NEW_RESOURCE);
  const ref = await db.collection(COLLECTION).add({
    ...doc,
    createdAt: FieldValue.serverTimestamp(),
    datePosted: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Created "${NEW_RESOURCE.titleEn}" (${ref.id}) -> ${NEW_RESOURCE.resourceOrder}`);
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
