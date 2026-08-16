#!/usr/bin/env node
/**
 * Adds 5 resources from the Aug 2026 gap-map review — needs identified by
 * comparing the live directory against common needs for immigrant families
 * in East Boston that weren't covered by any existing card: ESOL classes
 * specifically for immigrants (not buried as a side offering in 7 other
 * cards), consulate services, child care financial assistance, domestic
 * worker rights, and senior/elder services.
 *
 * A 6th candidate (driver's license access regardless of immigration
 * status) was deliberately dropped after Marlie flagged that ICE has used
 * driver's license data to target immigrants — not published here or
 * anywhere in the app.
 *
 * Usage:
 *   node scripts/add-gap-map-resources-2026-08.mjs           # dry run
 *   node scripts/add-gap-map-resources-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const NEW_RESOURCES = [
  {
    titleEn: 'International Institute of New England (IINE)',
    titleEs: 'International Institute of New England (IINE)',
    description: 'Take free or low-cost English classes for adults, from beginner to advanced levels. IINE also helps immigrants and refugees with jobs, citizenship, and other services.',
    summaryEs: 'Tome clases de inglés gratis o de bajo costo para adultos, desde nivel principiante hasta avanzado. IINE también ayuda a inmigrantes y refugiados con empleo, ciudadanía y otros servicios.',
    url: 'https://iine.org/what-we-do/education/english-for-speakers-of-other-languages-esol/',
    services: ['Take English classes', 'Get help finding a job', 'Get immigration help'],
    resourceCategory: 'family',
    resourceIcon: 'globe',
    resourceOrder: 10,
  },
  {
    titleEn: 'Consulate General of El Salvador — East Boston',
    titleEs: 'Consulado General de El Salvador — East Boston',
    description: 'Get help with Salvadoran documents like passports, national IDs (DUI), and other consular services. You can make an appointment online or call for help.',
    summaryEs: 'Reciba ayuda con documentos salvadoreños como pasaportes, documentos de identidad (DUI) y otros servicios consulares. Puede hacer una cita en línea o llamar para recibir ayuda.',
    url: 'https://consuladoelsalvadorenusa.us/boston/',
    phone: '1-888-301-1130',
    hours: 'Monday-Friday 6am-6pm; weekends 8am-12pm',
    services: ['Get a Salvadoran passport', 'Get or renew my DUI', 'Get help with Salvadoran documents'],
    resourceCategory: 'immigration',
    resourceIcon: 'shield',
    resourceOrder: 11,
  },
  {
    titleEn: 'Child Care Financial Assistance (EEC)',
    titleEs: 'Ayuda Financiera para el Cuidado Infantil (EEC)',
    description: 'Get help paying for child care through the state. Depending on your income and family, you may pay less or nothing at all. There may be a waitlist.',
    summaryEs: 'Reciba ayuda del estado para pagar el cuidado infantil. Dependiendo de sus ingresos y su familia, puede pagar menos o no pagar nada. Puede haber una lista de espera.',
    url: 'https://childcare.mass.gov/families/frequently-asked-questions',
    services: ['Get help paying for child care'],
    resourceCategory: 'family',
    resourceIcon: 'globe',
    resourceOrder: 11,
  },
  {
    titleEn: "Matahari Women Workers' Center",
    titleEs: "Matahari Women Workers' Center",
    description: 'Learn about your rights as a nanny, house cleaner, or home caregiver. Get help with problems at work and learn how Massachusetts law protects domestic workers.',
    summaryEs: 'Conozca sus derechos como niñera, trabajadora de limpieza o cuidadora en el hogar. Reciba ayuda con problemas en el trabajo y aprenda cómo la ley de Massachusetts protege a las trabajadoras del hogar.',
    url: 'http://www.matahariboston.org/mission',
    services: ['Learn your rights as a domestic worker', 'Get help with a work problem', 'Join a workshop'],
    resourceCategory: 'jobs',
    resourceIcon: 'briefcase',
    resourceOrder: 7,
  },
  {
    titleEn: 'Boston ElderINFO (Ethos)',
    titleEs: 'Boston ElderINFO (Ethos)',
    description: 'Get help finding services for older adults, including home care, meals, transportation, and other support. Call to talk with someone about what you or an older family member may qualify for. Help is available in many languages.',
    summaryEs: 'Reciba ayuda para encontrar servicios para adultos mayores, como cuidado en el hogar, comidas, transporte y otros apoyos. Llame para hablar con alguien sobre los servicios para los que usted o un familiar mayor puede calificar. Hay ayuda en varios idiomas.',
    url: 'https://www.ethocare.org/resources/boston-elderinfo/',
    phone: '617-292-6211',
    hours: 'Monday-Friday 9am-5pm',
    services: ['Find help for an older adult', 'Get help with care at home'],
    resourceCategory: 'family',
    resourceIcon: 'globe',
    resourceOrder: 12,
  },
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
    resourceCategory: r.resourceCategory,
    resourceIcon: r.resourceIcon,
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

  for (const r of NEW_RESOURCES) {
    if (!args.confirm) {
      console.log(`[dry-run] CREATE "${r.titleEn}" -> category: ${r.resourceCategory}, order: ${r.resourceOrder}`);
      console.log(`   chips: ${JSON.stringify(r.services)}`);
      continue;
    }
    const doc = buildDoc(r);
    const ref = await db.collection(COLLECTION).add({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      datePosted: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Created "${r.titleEn}" (${ref.id}) -> ${r.resourceCategory}/${r.resourceOrder}`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
