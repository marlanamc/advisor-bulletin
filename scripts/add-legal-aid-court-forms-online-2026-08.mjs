#!/usr/bin/env node
/**
 * Adds Court Forms Online (Suffolk Law's LIT Lab, MA Appeals Court-approved)
 * to the Legal-Aid category — a free, guided-interview tool for preparing
 * your own court forms, distinct from every other legal-aid card in that
 * it's an interactive self-filing tool rather than representation, a
 * guide, or a referral service.
 *
 * Usage:
 *   node scripts/add-legal-aid-court-forms-online-2026-08.mjs           # dry run
 *   node scripts/add-legal-aid-court-forms-online-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const NEW_RESOURCE = {
  titleEn: 'Court Forms Online',
  titleEs: 'Court Forms Online (Formularios de la Corte en Línea)',
  description: 'Fill out Massachusetts court forms online with step-by-step questions in plain language. The tool helps you choose and complete forms for problems like eviction, family court, restraining orders, court fees, and more. It creates the forms you need when you finish.',
  summaryEs: 'Complete formularios de la corte de Massachusetts en línea con preguntas paso a paso y en lenguaje sencillo. La herramienta le ayuda a elegir y completar formularios para problemas como desalojos, casos de familia, órdenes de protección, costos de la corte y más. Al terminar, prepara los formularios que necesita.',
  url: 'https://courtformsonline.org',
  services: ['Fill out court forms', 'Get a restraining order', 'Respond to an eviction or court case', 'Ask the court to waive fees'],
  resourceOrder: 6,
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
    resourceCategory: 'legal-aid',
    resourceIcon: 'scale',
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
    phone: '',
    phoneMode: 'call',
    hours: '',
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
    console.log(`   url: ${NEW_RESOURCE.url}`);
    return;
  }

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
