#!/usr/bin/env node
/**
 * Adds the MA Attorney General's Fair Labor Hotline to the Jobs category —
 * the category had nothing for "I have a problem at work" (unpaid wages,
 * unsafe conditions, retaliation). This office doesn't ask about
 * immigration status and it's illegal for an employer to retaliate for
 * filing, which is the actual barrier for a lot of workers in this
 * situation, so that's surfaced as chips, not buried in the description.
 *
 * Placed second-to-last (order 5) per advisor request; MA Department of
 * Unemployment Assistance shifts from order 5 to 6.
 *
 * Usage:
 *   node scripts/add-jobs-fair-labor-2026-08.mjs           # dry run
 *   node scripts/add-jobs-fair-labor-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const NEW_RESOURCE = {
  titleEn: "MA Attorney General's Fair Labor Hotline",
  titleEs: "Línea Directa de Trabajo Justo del Fiscal General de MA",
  description: 'Report unpaid wages, unfair treatment, or unsafe conditions at work. This office does not ask about your immigration status and will not report you to immigration. It is against the law for your boss to fire you or call immigration because you filed a complaint. File online or call the hotline.',
  summaryEs: 'Reporte salarios no pagados, trato injusto o condiciones inseguras en el trabajo. Esta oficina no pregunta sobre su estatus migratorio y no lo reportará a inmigración. Es ilegal que su jefe lo despida o llame a inmigración porque usted presentó una queja. Presente su queja en línea o llame a la línea directa.',
  url: 'https://www.mass.gov/how-to/file-a-workplace-complaint',
  phone: '617-727-3465',
  hours: 'Monday-Friday 10am-4pm',
  services: ['Report unpaid wages', 'Protected from retaliation', 'No immigration questions asked'],
  resourceOrder: 5,
};

const SHIFT_EXISTING = [
  { id: 'zWD5bDlxTgckNSQCX55X', title: 'MA Department of Unemployment Assistance', order: 6 },
];

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
    resourceCategory: 'jobs',
    resourceIcon: 'briefcase',
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
    phone: r.phone || '',
    phoneMode: 'call',
    hours: r.hours || '',
    languages: ['ENG', 'ESP'],
    lastVerified: '2026-08',
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
    importSource: 'manual-research-2026-08',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  if (!args.confirm) {
    console.log(`[dry-run] CREATE "${NEW_RESOURCE.titleEn}" -> resourceOrder: ${NEW_RESOURCE.resourceOrder}`);
    console.log(`   chips: ${JSON.stringify(NEW_RESOURCE.services)}`);
    console.log(`   description: ${NEW_RESOURCE.description}`);
  } else {
    const doc = buildDoc(NEW_RESOURCE);
    const ref = await db.collection(COLLECTION).add({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      datePosted: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Created "${NEW_RESOURCE.titleEn}" (${ref.id}) -> ${NEW_RESOURCE.resourceOrder}`);
  }

  console.log('\n--- Shifting existing Jobs resources ---');
  for (const u of SHIFT_EXISTING) {
    if (!args.confirm) {
      console.log(`[dry-run] ${u.title} (${u.id}) -> resourceOrder: ${u.order}`);
      continue;
    }
    await db.collection(COLLECTION).doc(u.id).update({
      resourceOrder: u.order,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ ${u.title} -> ${u.order}`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
