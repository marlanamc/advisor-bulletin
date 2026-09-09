#!/usr/bin/env node
/**
 * Adds the YMCA Free Grocery Bags resource — one card covering the four
 * East Boston pickup sites the YMCA runs (Revival Church, Church Faro de
 * Luz, Paris Street BCYF, Grace Federated Church).
 *
 * It is one program with four distribution points, so it is one resource,
 * not four cards flooding the Food section. The per-site schedule lives in
 * `hours` (renders as four plain rows on the card) and is repeated in
 * Spanish in `summaryEs` — plain hours rows don't auto-translate, and the
 * import guide says schedules belong in `hours` or the description.
 *
 * No `address` / `mapUrl`: with four sites a single map pin would send a
 * student to the wrong door. Website + Call buttons still render.
 *
 * Paris Street BCYF also has its own "BCYF Paris Street" food card. The
 * small overlap is deliberate — this card is the one place a student sees
 * every YMCA grocery-bag pickup in Eastie together.
 *
 * Usage:
 *   node scripts/add-ymca-grocery-bags-2026-08.mjs           # dry run
 *   node scripts/add-ymca-grocery-bags-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const RESOURCE = {
  titleEn: 'YMCA Free Grocery Bags',
  titleEs: 'Bolsas de comida gratis del YMCA',
  description:
    'Get a free bag of groceries at any of four East Boston pickup sites. '
    + 'Go during that site’s hours — you do not need an appointment or proof of income. '
    + 'Sites and times: Revival Church, 965 Bennington St — Tuesdays 9–10 AM. '
    + 'Church Faro de Luz, 282 Meridian St — every other Tuesday, 12–1 PM. '
    + 'Paris Street BCYF, 112 Paris St — Tuesdays and Fridays, 12–2 PM. '
    + 'Grace Federated Church, 760 Saratoga St — 1st and 2nd Saturday, 7–9 AM. '
    + 'Schedules can change — call the East Boston YMCA to check before you go.',
  summaryEs:
    'Consiga una bolsa de comida gratis en cualquiera de los cuatro puntos de entrega en East Boston. '
    + 'Vaya durante el horario de ese lugar — no necesita cita ni prueba de ingresos. '
    + 'Lugares y horarios: Revival Church, 965 Bennington St — martes de 9 a 10 AM. '
    + 'Church Faro de Luz, 282 Meridian St — un martes sí y otro no, de 12 a 1 PM. '
    + 'Paris Street BCYF, 112 Paris St — martes y viernes, de 12 a 2 PM. '
    + 'Grace Federated Church, 760 Saratoga St — el 1.º y 2.º sábado, de 7 a 9 AM. '
    + 'Los horarios pueden cambiar — llame al YMCA de East Boston para confirmar antes de ir.',
  url: 'https://ymcaboston.org/eastboston/',
  phone: '617-569-9622',
  hours: [
    'Revival Church, 965 Bennington St: Tuesday 9am-10am',
    'Church Faro de Luz, 282 Meridian St: every other Tuesday 12pm-1pm',
    'Paris Street BCYF, 112 Paris St: Tuesday & Friday 12pm-2pm',
    'Grace Federated Church, 760 Saratoga St: 1st & 2nd Saturday 7am-9am',
  ].join('\n'),
  services: ['Get groceries', 'No appointment needed'],
  resourceCategory: 'food',
  resourceIcon: 'globe',
  resourceOrder: 8,
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

  if (!args.confirm) {
    console.log(`[dry-run] CREATE "${RESOURCE.titleEn}" -> ${RESOURCE.resourceCategory}/${RESOURCE.resourceOrder}`);
    console.log(`   chips: ${JSON.stringify(RESOURCE.services)}`);
    console.log(`   hours:\n${RESOURCE.hours.split('\n').map((l) => `      ${l}`).join('\n')}`);
    console.log('\nDry run only — rerun with --confirm to write.');
    return;
  }

  const doc = buildDoc(RESOURCE);
  const ref = await db.collection(COLLECTION).add({
    ...doc,
    createdAt: FieldValue.serverTimestamp(),
    datePosted: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ Created "${RESOURCE.titleEn}" (${ref.id}) -> ${RESOURCE.resourceCategory}/${RESOURCE.resourceOrder}`);
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
