#!/usr/bin/env node
/**
 * Adds 4 housing resources researched from a caseworker's notes (MRVP, BHA
 * state-assisted housing, HomeBASE, Metrolist) and reorders the Housing
 * category to fit them in, weighted toward programs that work for
 * undocumented and mixed-status households.
 *
 * MRVP and CHAMP were folded into one card (MRVP is the program, CHAMP is
 * just how you apply to it) rather than two separate resources — same
 * pattern as the Project Bread / FoodSource Hotline cleanup.
 *
 * Skipped entirely: Section 8 (federal, still requires at least one
 * eligible-status household member, and BHA's own site says the tenant-based
 * voucher waitlist is currently closed anyway) — advisor's call to leave out.
 *
 * Usage:
 *   node scripts/add-housing-resources-2026-08.mjs           # dry run
 *   node scripts/add-housing-resources-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const NEW_RESOURCES = [
  {
    titleEn: 'Massachusetts Rental Voucher Program (MRVP)',
    titleEs: 'Programa de Vales de Alquiler de Massachusetts (MRVP)',
    description: 'A state-funded rental subsidy — households pay about 30% of income toward rent. Unlike federal programs, MRVP does not check immigration status, so undocumented and mixed-status households can apply. Apply through the CHAMP portal (link below).',
    summaryEs: 'Un subsidio de alquiler financiado por el estado — los hogares pagan aproximadamente el 30% de sus ingresos para el alquiler. A diferencia de los programas federales, MRVP no verifica el estatus migratorio, por lo que los hogares indocumentados o de estatus mixto pueden solicitar. Solicite a través del portal CHAMP (enlace abajo).',
    url: 'https://www.mass.gov/how-to/apply-for-the-massachusetts-rental-voucher-program-mrvp',
    services: ['No immigration status check', 'Rental subsidy', 'Apply via CHAMP'],
    actionLinks: [{
      labelEn: 'Apply via CHAMP',
      labelEs: 'Solicitar a través de CHAMP',
      url: 'https://publichousingapplication.ocd.state.ma.us/',
    }],
    resourceOrder: 2,
  },
  {
    titleEn: 'HomeBASE',
    titleEs: 'HomeBASE',
    description: 'Up to $30,000 over two years in shelter-diversion and rehousing help for families facing homelessness, plus a stabilization worker. Eligibility requires at least one household member — a U.S.-citizen child counts — to have qualifying immigration status. In East Boston/Chelsea this is administered through Metro Housing Boston, also in this list.',
    summaryEs: 'Hasta $30,000 durante dos años en ayuda para evitar el refugio y volver a alojarse para familias sin vivienda, más un trabajador de estabilización. La elegibilidad requiere que al menos un miembro del hogar — un niño ciudadano estadounidense cuenta — tenga estatus migratorio calificado. En East Boston/Chelsea esto se administra a través de Metro Housing Boston, también en esta lista.',
    url: 'https://www.mass.gov/info-details/homebase',
    phone: '866-584-0653',
    services: ['Shelter diversion', 'Rehousing assistance', 'Case management'],
    resourceOrder: 4,
  },
  {
    titleEn: 'Boston Housing Authority – State-Assisted Housing',
    titleEs: 'Autoridad de Vivienda de Boston – Vivienda Financiada por el Estado',
    description: "BHA's state-assisted developments (not Section 8/federal public housing, whose voucher waitlist is currently closed) don't require every household member to have immigration status — mixed-status families can apply, with the subsidy prorated to members with eligible status.",
    summaryEs: 'Las viviendas financiadas por el estado de BHA (no la Sección 8/vivienda pública federal, cuya lista de espera de vales está actualmente cerrada) no requieren que todos los miembros del hogar tengan estatus migratorio — las familias de estatus mixto pueden solicitar, con el subsidio prorrateado según los miembros con estatus elegible.',
    url: 'https://www.bostonhousing.org/en/Applications/Apply-for-Housing.aspx',
    phone: '617-988-4000',
    services: ['Mixed-status households OK', 'State-assisted units', 'Background screening applies'],
    resourceOrder: 7,
  },
  {
    titleEn: 'Metrolist',
    titleEs: 'Metrolist',
    description: "Boston's free search tool for income-restricted rental and ownership housing across Greater Boston. Screens on income, not immigration status. Sign up for weekly email alerts of new listings.",
    summaryEs: 'La herramienta de búsqueda gratuita de Boston para vivienda de alquiler y propiedad con restricción de ingresos en el área metropolitana de Boston. Evalúa por ingresos, no por estatus migratorio. Regístrese para recibir alertas semanales por correo electrónico de nuevos listados.',
    url: 'https://www.boston.gov/metrolist',
    phone: '617-635-3321',
    services: ['Housing search tool', 'Income-restricted listings', 'Free'],
    resourceOrder: 11,
  },
];

// Existing Housing docs shift to make room for the 4 new cards above.
// Final order: 1 NOAH, 2 MRVP*, 3 Metro Housing Boston, 4 HomeBASE*,
// 5 RAFT, 6 EB Adult Family Shelter, 7 BHA*, 8 MOH Housing Stability,
// 9 City Life/Vida Urbana, 10 Maverick Landing, 11 Metrolist*, 12 MA State
// Public Housing. (* = new)
const REORDER_EXISTING = [
  { id: 'rSncRxrz2yhcy4Rs4zfO', title: 'Metro Housing Boston', order: 3 },
  { id: '5v2i2ZzQJ6dGva2bBQw9', title: 'RAFT (Residential Assistance for Families in Transition)', order: 5 },
  { id: 'XrFRTpcTXKObO9GbwtGj', title: 'East Boston Adult Family Shelter', order: 6 },
  { id: 'kw2XSXtjJITiQLwFtFGn', title: "Mayor's Office of Housing – Office of Housing Stability", order: 8 },
  { id: 'yHcQps4ebiQYp1LCQ3ho', title: 'City Life/Vida Urbana', order: 9 },
  { id: '20nEfN1q1rjMstkDtizM', title: 'Maverick Landing Community Services', order: 10 },
  { id: '41UtfHEQqtsi4tMcD29o', title: 'MA State Public Housing', order: 12 },
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
    resourceCategory: 'housing',
    resourceIcon: 'home',
    resourceLogo: null,
    url: r.url,
    eventLink: r.url,
    description: r.description,
    summaryEs: r.summaryEs,
    highlights: r.services.join(', '),
    services: r.services,
    serviceChips: r.services,
    actionLinks: r.actionLinks || [],
    advisorName: 'Import',
    postedBy: 'admin',
    address: r.address || '',
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

  console.log('--- New resources ---');
  for (const r of NEW_RESOURCES) {
    if (!args.confirm) {
      console.log(`[dry-run] CREATE "${r.titleEn}" -> resourceOrder: ${r.resourceOrder}`);
      continue;
    }
    const doc = buildDoc(r);
    const ref = await db.collection(COLLECTION).add({
      ...doc,
      createdAt: FieldValue.serverTimestamp(),
      datePosted: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Created "${r.titleEn}" (${ref.id}) -> ${r.resourceOrder}`);
  }

  console.log('\n--- Reordering existing Housing resources ---');
  for (const u of REORDER_EXISTING) {
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

  console.log(
    args.confirm
      ? '\nDone: 4 resources created, 7 existing resources reordered.'
      : '\nDry run only — rerun with --confirm to write.'
  );
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
