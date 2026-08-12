#!/usr/bin/env node
/**
 * Rewrites the 4 housing resources added in
 * scripts/add-housing-resources-2026-08.mjs to a simpler (~6th grade)
 * reading level, with no em dashes anywhere (including the BHA title,
 * which had one).
 *
 * Usage:
 *   node scripts/simplify-housing-resource-copy-2026-08.mjs           # dry run
 *   node scripts/simplify-housing-resource-copy-2026-08.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: 'tzZSsuElGbd1jNgnEsWN',
    title: 'Massachusetts Rental Voucher Program (MRVP)',
    description: 'MRVP is a Massachusetts program that helps pay your rent. You pay about 30% of your income. MRVP does not ask about immigration status. This means undocumented families can apply too. Use the button below to apply through CHAMP.',
    summaryEs: 'MRVP es un programa de Massachusetts que ayuda a pagar el alquiler. Usted paga cerca del 30% de sus ingresos. MRVP no pregunta sobre el estatus migratorio. Esto significa que las familias indocumentadas también pueden solicitar. Use el botón de abajo para solicitar a través de CHAMP.',
  },
  {
    id: '6yofpUiJxpWMgaltCe7n',
    title: 'HomeBASE',
    description: 'HomeBASE helps families who are homeless or about to lose their home. It can give up to $30,000 over two years. You also get a helper called a stabilization worker. One person in your family must have legal immigration status to qualify. A child born in the U.S. counts. In East Boston and Chelsea, Metro Housing Boston runs this program.',
    summaryEs: 'HomeBASE ayuda a las familias que no tienen hogar o están a punto de perderlo. Puede dar hasta $30,000 en dos años. También le dan un ayudante llamado trabajador de estabilización. Una persona en su familia debe tener estatus migratorio legal para calificar. Un niño nacido en los Estados Unidos cuenta. En East Boston y Chelsea, Metro Housing Boston maneja este programa.',
  },
  {
    id: 'nWNbF0kTMBqkUOnn9BAX',
    title: 'Boston Housing Authority (State-Assisted Housing)',
    description: 'BHA has housing that is paid for by the state. Not every family member needs legal immigration status. Families with mixed status can still apply. You get rent help only for the members who have legal status. This is different from Section 8, which is closed right now. A background check is required.',
    summaryEs: 'BHA tiene viviendas pagadas por el estado. No todos los miembros de la familia necesitan estatus migratorio legal. Las familias con estatus mixto pueden solicitar. Usted recibe ayuda con el alquiler solo para los miembros con estatus legal. Esto es diferente de la Sección 8, que está cerrada ahora mismo. Se requiere una verificación de antecedentes.',
  },
  {
    id: 'xY4Cpj9SJn6Ml4AZ82Lw',
    title: 'Metrolist',
    description: 'Metrolist is a free website where you can search for affordable homes and apartments in Boston. You must show proof of your income, not your immigration status. You can also sign up for weekly emails about new homes.',
    summaryEs: 'Metrolist es un sitio web gratuito donde puede buscar casas y apartamentos económicos en Boston. Debe mostrar prueba de sus ingresos, no de su estatus migratorio. También puede recibir correos semanales sobre casas nuevas.',
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  for (const u of UPDATES) {
    if (!args.confirm) {
      console.log(`[dry-run] ${u.id} -> title: "${u.title}"`);
      console.log(`           description: "${u.description}"`);
      continue;
    }
    await db.collection(COLLECTION).doc(u.id).update({
      title: u.title,
      titleEn: u.title,
      description: u.description,
      summaryEs: u.summaryEs,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Updated ${u.title} (${u.id})`);
  }

  console.log(args.confirm ? '\nDone.' : '\nDry run only — rerun with --confirm to write.');
}

main().catch((error) => {
  console.error('Failed:', error.message || error);
  process.exit(1);
});
