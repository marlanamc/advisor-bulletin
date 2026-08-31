#!/usr/bin/env node
/**
 * Builds out the new `consulates` category.
 *
 * Two things happen here:
 *   1. The existing "Consulate General of El Salvador — East Boston" card moves
 *      from `immigration` to `consulates`. Nothing else about it changes.
 *   2. Nine more consulate cards are created, one per country, ordered
 *      alphabetically so no country reads as favored over another.
 *
 * Ecuador is deliberately absent: the Boston-area listing is an *honorary*
 * consulate in Needham, which generally cannot issue passports or cédulas.
 * Marlana is confirming where Ecuadorians in Massachusetts are actually served.
 *
 * Every card is a consulate a student can physically reach: Massachusetts or
 * Rhode Island only. Countries whose nearest consulate is in New York or
 * Washington — and Venezuela, which has no U.S. consulate at all — are left
 * out rather than shown as a card a student cannot act on.
 *
 * Addresses and phone numbers were re-checked against official and public
 * listings in August 2026 and all matched. Hours are the least stable field
 * and several consulates publish them only inside an appointment portal, so
 * new cards are still created UNPUBLISHED — an advisor confirms hours by
 * phone before students see them, because a wrong consulate hour costs a
 * student a day off work. Pass --publish once verified.
 *
 * Usage:
 *   node scripts/add-consulates-2026-08.mjs                     # dry run
 *   node scripts/add-consulates-2026-08.mjs --confirm            # write drafts
 *   node scripts/add-consulates-2026-08.mjs --confirm --publish  # write live
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

// The card that already exists — it only changes category and order.
const EL_SALVADOR = {
  titleEn: 'Consulate General of El Salvador — East Boston',
  resourceOrder: 5,
};

// Alphabetical by country. resourceOrder is the student-facing order inside
// the Consulates category.
const NEW_RESOURCES = [
  {
    resourceOrder: 1,
    titleEn: 'Consulate General of Brazil — Boston',
    titleEs: 'Consulado General de Brasil — Boston',
    description: 'Get help with Brazilian documents like passports, CPF, and other consular services. Every in-person visit starts online in e-Consular, and questions are answered by email, not phone.',
    summaryEs: 'Ayuda con documentos brasileños como pasaportes, CPF y otros trámites consulares. Todo trámite presencial empieza en línea en e-Consular, y contestan preguntas por correo, no por teléfono.',
    url: 'https://www.gov.br/mre/pt-br/consulado-boston',
    phone: '617-542-4000',
    address: '175 Purchase St, Boston, MA 02110',
    hours: 'Monday-Friday 8:30am-12:30pm; every in-person service starts online in e-Consular',
    hoursEs: 'Lunes-viernes 8:30am-12:30pm; todo trámite presencial empieza en línea en e-Consular',
    languages: ['POR', 'ENG'],
    services: ['Get a Brazilian passport', 'Get my CPF or Brazilian ID', 'Get help with Brazilian documents'],
    actionLinks: [
      {
        labelEn: 'Start an appointment in e-Consular',
        labelEs: 'Empiece una cita en e-Consular',
        url: 'https://ec-boston.itamaraty.gov.br/',
        pdfUrl: '',
      },
    ],
  },
  {
    resourceOrder: 2,
    titleEn: 'Consulate General of Cape Verde — Quincy',
    titleEs: 'Consulado General de Cabo Verde — Quincy',
    description: 'Get help with Cape Verdean documents like passports, national IDs, and other consular services. This office is in Quincy, not Boston. Call before you go to ask which papers to bring.',
    summaryEs: 'Ayuda con documentos caboverdianos como pasaportes, identificaciones nacionales y otros trámites consulares. Esta oficina está en Quincy, no en Boston. Llame antes de ir para preguntar qué papeles llevar.',
    url: '',
    phone: '617-353-0014',
    address: '300 Congress St, Suite 204, Quincy, MA 02169',
    hours: 'Monday-Friday 9am-1pm',
    hoursEs: 'Lunes-viernes 9am-1pm',
    languages: ['POR', 'ENG'],
    services: ['Get a Cape Verdean passport', 'Get my Cape Verdean ID', 'Get help with Cape Verdean documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 3,
    titleEn: 'Consulate General of Colombia — Boston',
    titleEs: 'Consulado General de Colombia — Boston',
    description: 'Get help with Colombian documents like passports, national IDs (cédula), and other consular services. Book an appointment online, or take a walk-in number between 8am and 12pm.',
    summaryEs: 'Ayuda con documentos colombianos como pasaportes, cédulas y otros trámites consulares. Reserve una cita en línea, o tome un turno sin cita entre las 8am y las 12pm.',
    url: 'https://boston.consulado.gov.co/',
    phone: '617-536-6222',
    address: '31 St James Ave, Suite 960, Boston, MA 02116',
    hours: 'Monday-Friday 7:30am-1:30pm; walk-in numbers given 8am-12pm, document pickup 9am-2pm',
    hoursEs: 'Lunes-viernes 7:30am-1:30pm; turnos sin cita de 8am-12pm, entrega de documentos de 9am-2pm',
    languages: ['ESP', 'ENG'],
    services: ['Get a Colombian passport', 'Get or renew my Colombian cédula', 'Get help with Colombian documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 4,
    titleEn: 'Consulate General of the Dominican Republic — Boston',
    titleEs: 'Consulado General de la República Dominicana — Boston',
    description: 'Get help with Dominican documents like passports, national IDs (cédula), and other consular services. Call before you go to ask which papers to bring.',
    summaryEs: 'Ayuda con documentos dominicanos como pasaportes, cédulas y otros trámites consulares. Llame antes de ir para preguntar qué papeles llevar.',
    url: 'https://usa.mirex.gob.do/consular/boston/',
    phone: '617-482-8121',
    address: '20 Park Plaza, Suite 601, Boston, MA 02116',
    hours: 'Monday-Friday 9am-4:30pm',
    hoursEs: 'Lunes-viernes 9am-4:30pm',
    languages: ['ESP', 'ENG'],
    services: ['Get a Dominican passport', 'Get or renew my Dominican cédula', 'Get help with Dominican documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 6,
    titleEn: 'Consulate General of Guatemala — Providence, RI',
    titleEs: 'Consulado General de Guatemala — Providence, RI',
    description: 'Get help with Guatemalan documents like passports, national IDs (DPI), and other consular services. The closest office is in Providence, Rhode Island — there is none in Boston. Call to make an appointment.',
    summaryEs: 'Ayuda con documentos guatemaltecos como pasaportes, identificaciones (DPI) y otros trámites consulares. La oficina más cercana está en Providence, Rhode Island — no hay en Boston. Llame para hacer una cita.',
    url: 'https://www.minex.gob.gt/din/3116-Consulado-General-de-Guatemala-en-Providence-Rhode-Island-Estados-Unidos',
    phone: '401-270-6345',
    address: '555 Valley St, Building 61-321, Providence, RI 02908',
    hours: 'Monday-Friday 8am-3pm; appointment required; serves Massachusetts, Rhode Island, New Hampshire, Vermont, and Maine',
    hoursEs: 'Lunes-viernes 8am-3pm; se necesita cita; atiende a Massachusetts, Rhode Island, New Hampshire, Vermont y Maine',
    languages: ['ESP', 'ENG'],
    services: ['Get a Guatemalan passport', 'Get or renew my DPI', 'Get help with Guatemalan documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 7,
    titleEn: 'Consulate General of Haiti — Boston',
    titleEs: 'Consulado General de Haití — Boston',
    description: 'Get help with Haitian documents like passports, national IDs, and other consular services. Staff speak Haitian Creole and French. Call before you go to ask which papers to bring.',
    summaryEs: 'Ayuda con documentos haitianos como pasaportes, identificaciones nacionales y otros trámites consulares. El personal habla creole haitiano y francés. Llame antes de ir para preguntar qué papeles llevar.',
    url: 'https://www.cghaitiboston.org/',
    phone: '617-266-3660',
    address: '333 Washington St, Suite 851, Boston, MA 02108',
    hours: 'Monday-Friday 9am-4pm',
    hoursEs: 'Lunes-viernes 9am-4pm',
    languages: ['HAT', 'FRA', 'ENG'],
    services: ['Get a Haitian passport', 'Get my Haitian ID', 'Get help with Haitian documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 8,
    titleEn: 'Consulate of Honduras — Chelsea',
    titleEs: 'Consulado de Honduras — Chelsea',
    description: 'Get help with Honduran documents like passports, national IDs (DNI), and other consular services. This office is in Chelsea, close to East Boston. You must make an appointment before you go.',
    summaryEs: 'Ayuda con documentos hondureños como pasaportes, identificaciones (DNI) y otros trámites consulares. Esta oficina está en Chelsea, cerca de East Boston. Debe hacer una cita antes de ir.',
    url: '',
    phone: '617-571-7974',
    address: '90 Everett Ave, 3rd Floor, Chelsea, MA 02150',
    hours: 'Monday-Friday 9am-3pm; appointment required',
    hoursEs: 'Lunes-viernes 9am-3pm; se necesita cita',
    languages: ['ESP', 'ENG'],
    services: ['Get a Honduran passport', 'Get or renew my Honduran DNI', 'Get help with Honduran documents'],
    actionLinks: [],
  },
  {
    resourceOrder: 9,
    titleEn: 'Consulate General of Mexico — Boston',
    titleEs: 'Consulado General de México — Boston',
    description: 'Get help with Mexican documents like passports, the matrícula consular, and other consular services. Make an appointment through MEXITEL before you go.',
    summaryEs: 'Ayuda con documentos mexicanos como pasaportes, la matrícula consular y otros trámites consulares. Haga una cita por MEXITEL antes de ir.',
    url: 'https://consulmex.sre.gob.mx/boston/',
    phone: '617-426-4181',
    address: '55 Franklin St, Boston, MA 02110',
    hours: 'Monday-Friday 9am-2pm; appointment required through MEXITEL',
    hoursEs: 'Lunes-viernes 9am-2pm; se necesita cita por MEXITEL',
    languages: ['ESP', 'ENG'],
    services: ['Get a Mexican passport', 'Get my matrícula consular', 'Get help with Mexican documents'],
    actionLinks: [
      {
        labelEn: 'Make a MEXITEL appointment',
        labelEs: 'Haga una cita en MEXITEL',
        url: 'https://citas.sre.gob.mx/',
        pdfUrl: '',
      },
    ],
  },
  {
    resourceOrder: 10,
    titleEn: 'Consulate General of Peru — Boston',
    titleEs: 'Consulado General del Perú — Boston',
    description: 'Get help with Peruvian documents like passports, national IDs (DNI), and other consular services. You can make an appointment online or call for help.',
    summaryEs: 'Ayuda con documentos peruanos como pasaportes, identificaciones (DNI) y otros trámites consulares. Puede hacer una cita en línea o llamar para pedir ayuda.',
    url: 'https://www.consulado.pe/es/Boston/Paginas/Inicio.aspx',
    phone: '617-338-2227',
    address: '20 Park Plaza, Suite 511, Boston, MA 02116',
    hours: 'Monday-Friday 8:30am-3pm; most services need an appointment',
    hoursEs: 'Lunes-viernes 8:30am-3pm; la mayoría de los trámites necesitan cita',
    languages: ['ESP', 'ENG'],
    services: ['Get a Peruvian passport', 'Get or renew my Peruvian DNI', 'Get help with Peruvian documents'],
    actionLinks: [],
  },
];

function parseArgs(argv) {
  const args = { confirm: false, publish: false, credentials: null };
  for (const arg of argv) {
    if (arg === '--confirm') args.confirm = true;
    else if (arg === '--publish') args.publish = true;
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

function buildDoc(r, isPublished) {
  return {
    type: 'resource',
    title: r.titleEn,
    titleEn: r.titleEn,
    titleEs: r.titleEs,
    resourceTitleEs: r.titleEs,
    category: 'resource',
    resourceCategory: 'consulates',
    resourceIcon: 'flag',
    resourceLogo: null,
    url: r.url,
    eventLink: r.url,
    description: r.description,
    summaryEs: r.summaryEs,
    highlights: r.services.join(', '),
    services: r.services,
    serviceChips: r.services,
    actionLinks: r.actionLinks,
    advisorName: 'Import',
    postedBy: 'admin',
    address: r.address,
    mapUrl: '',
    phone: r.phone,
    phoneMode: 'call',
    hours: r.hours,
    hoursEs: r.hoursEs || '',
    languages: r.languages,
    lastVerified: '2026-08',
    isActive: true,
    isPublished,
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

async function findElSalvador(db) {
  const snapshot = await db
    .collection(COLLECTION)
    .where('type', '==', 'resource')
    .where('titleEn', '==', EL_SALVADOR.titleEn)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isPublished = args.publish;

  if (!args.confirm) {
    console.log(`[dry-run] MOVE "${EL_SALVADOR.titleEn}"`);
    console.log(`   resourceCategory: immigration -> consulates, resourceOrder -> ${EL_SALVADOR.resourceOrder}\n`);
    for (const r of NEW_RESOURCES) {
      console.log(`[dry-run] CREATE "${r.titleEn}" -> consulates #${r.resourceOrder} (${isPublished ? 'published' : 'draft'})`);
      console.log(`   chips: ${JSON.stringify(r.services)}`);
      console.log(`   contact: ${[r.phone, r.address].filter(Boolean).join(' · ') || '(none — informational card)'}`);
      console.log(`   hours: ${r.hours}`);
      if (r.url) console.log(`   url: ${r.url}`);
      for (const link of r.actionLinks) console.log(`   button: ${link.labelEn} -> ${link.url}`);
      console.log('');
    }
    console.log(`${NEW_RESOURCES.length} new cards, ${isPublished ? 'PUBLISHED' : 'unpublished drafts'}. Re-run with --confirm to write.`);
    return;
  }

  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const elSalvador = await findElSalvador(db);
  if (elSalvador) {
    await elSalvador.ref.update({
      resourceCategory: 'consulates',
      resourceIcon: 'flag',
      resourceOrder: EL_SALVADOR.resourceOrder,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Moved "${EL_SALVADOR.titleEn}" (${elSalvador.id}) -> consulates #${EL_SALVADOR.resourceOrder}`);
  } else {
    console.warn(`! Could not find "${EL_SALVADOR.titleEn}" — move it by hand in the Advisor Portal.`);
  }

  for (const r of NEW_RESOURCES) {
    const ref = await db.collection(COLLECTION).add({
      ...buildDoc(r, isPublished),
      createdAt: FieldValue.serverTimestamp(),
      datePosted: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Created "${r.titleEn}" (${ref.id}) -> consulates #${r.resourceOrder}${isPublished ? '' : ' [draft]'}`);
  }

  if (!isPublished) {
    console.log('\nNew cards are drafts. Verify each address, phone, and hours against the');
    console.log('consulate\'s own site, then publish them from the Advisor Portal.');
  }
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
