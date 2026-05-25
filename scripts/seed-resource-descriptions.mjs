#!/usr/bin/env node
/**
 * Backfills description column on data/resource-import-template.csv with
 * 1-sentence English + Spanish summaries written at roughly a 7th-grade
 * reading level. Uses a hand-curated map keyed by "orgName::category".
 *
 * Run:
 *   node scripts/seed-resource-descriptions.mjs            # dry-run preview
 *   node scripts/seed-resource-descriptions.mjs --write    # writes CSV in place
 *
 * To push to Firestore without deleting + reimporting, use
 * scripts/update-imported-summaries.mjs after writing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSV_PATH = resolve('data/resource-import-template.csv');

// 7th-grade reading level: short words, plain verbs, no jargon. Each entry
// produces "<en>. Español: <es>." in the description column. The import
// script splits on "Español:" and stores each half separately.
export const COPY = {
  'BCYF Paris St::food': {
    en: 'Free grocery bags every Tuesday and Friday after noon at this East Boston community center',
    es: 'Bolsas de comida gratis cada martes y viernes después del mediodía en este centro comunitario de East Boston',
  },
  'Central Community Church::family': {
    en: 'Free clothes you can take home, open every Friday at this East Boston church',
    es: 'Ropa gratis para llevar, abierta cada viernes en esta iglesia de East Boston',
  },
  'Central Community Church::food': {
    en: 'Free fruits, veggies, and pantry food every Monday at 1pm; call ahead if you need emergency food',
    es: 'Frutas, verduras y comida gratis cada lunes a la 1pm; llama antes si necesitas comida de emergencia',
  },
  'Crossroads Family Center - Our Daily Bread Pantry::food': {
    en: 'Free emergency food every Wednesday from 3pm to 4pm; bring photo ID and a piece of mail if you can',
    es: 'Comida de emergencia gratis cada miércoles de 3pm a 4pm; trae una identificación con foto y un correo si puedes',
  },
  'East Boston ABCD::food': {
    en: 'Helps East Boston families sign up for SNAP food benefits',
    es: 'Ayuda a familias de East Boston a inscribirse en beneficios de comida SNAP',
  },
  'East Boston ABCD APAC::money': {
    en: 'Help with heating bills, electric bills, food stamps, taxes, and citizenship — all in one office',
    es: 'Ayuda con cuentas de calefacción, electricidad, cupones de comida, impuestos y ciudadanía — todo en una oficina',
  },
  'East Boston ABCD Clothing::family': {
    en: 'Free clothes and basics like soap, shoes, and household items for East Boston families',
    es: 'Ropa y artículos básicos gratis como jabón, zapatos y cosas para la casa para familias de East Boston',
  },
  'East Boston ABCD Mobile Food Pop Ups::food': {
    en: 'A truck that brings free groceries to different spots in East Boston each week',
    es: 'Un camión que trae comestibles gratis a distintos puntos de East Boston cada semana',
  },
  'East Boston Soup Kitchen::food': {
    en: 'Free hot meals every Tuesday morning, no questions asked',
    es: 'Comida caliente gratis cada martes por la mañana, sin preguntas',
  },
  'Eastie Farm::food': {
    en: 'Free food and cheap fruits and veggies from a local farm; bring bags if you have them',
    es: 'Comida gratis y frutas y verduras baratas de una granja local; trae bolsas si tienes',
  },
  'EBNHC Women Infants and Children (WIC)::family': {
    en: 'Free food and nutrition help for pregnant women, new moms, and kids under 5',
    es: 'Comida y ayuda con nutrición gratis para mujeres embarazadas, mamás recientes y niños menores de 5 años',
  },
  'Family Nurturing Center::family': {
    en: 'Classes and support for parents raising young kids',
    es: 'Clases y apoyo para padres que crían niños pequeños',
  },
  'Ollie Diaper Depot::family': {
    en: 'Free diapers and wipes once a month; sign up each month to save your spot',
    es: 'Pañales y toallitas gratis una vez al mes; inscríbete cada mes para guardar tu lugar',
  },
  'Project Bread::food': {
    en: 'Group that helps people across Massachusetts find food and sign up for SNAP',
    es: 'Grupo que ayuda a la gente en Massachusetts a encontrar comida e inscribirse en SNAP',
  },
  'Project Bread FoodSource Hotline::food': {
    en: 'Free phone line for help with food and SNAP, Monday through Saturday',
    es: 'Línea telefónica gratis para ayuda con comida y SNAP, de lunes a sábado',
  },
  'Salvation Army of Chelsea/East Boston::family': {
    en: 'Baby supplies and family help for people in Chelsea, East Boston, Winthrop, and Everett',
    es: 'Artículos para bebés y ayuda familiar para gente en Chelsea, East Boston, Winthrop y Everett',
  },
  'The Home for Little Wanderers Family Resource Center::family': {
    en: 'A family center in Chelsea that connects parents with help and programs',
    es: 'Un centro familiar en Chelsea que conecta a los padres con ayuda y programas',
  },
  'MA Department of Transitional Assistance::money': {
    en: 'State office where you can sign up for SNAP, cash help, and other benefits',
    es: 'Oficina estatal donde puedes inscribirte en SNAP, ayuda en efectivo y otros beneficios',
  },
  'Find Your Funds::money': {
    en: 'Free website that helps you find tax credits and money you may be owed',
    es: 'Sitio web gratis que te ayuda a encontrar créditos de impuestos y dinero que te pueden deber',
  },
  'MA Department of Unemployment Assistance::jobs': {
    en: 'State office for getting unemployment money if you lost your job',
    es: 'Oficina estatal para recibir dinero por desempleo si perdiste tu trabajo',
  },
  'East Boston Community Council::immigration': {
    en: 'Local help with green cards, citizenship, and other immigration paperwork',
    es: 'Ayuda local con la tarjeta verde, la ciudadanía y otros papeles de inmigración',
  },
  'Agencia Alpha::immigration': {
    en: 'Citizenship classes, immigration help, and free legal clinics for immigrant families',
    es: 'Clases de ciudadanía, ayuda con inmigración y clínicas legales gratis para familias inmigrantes',
  },
  'Greater Boston Legal Services::legal-aid': {
    en: 'Free lawyers for low-income families — housing, immigration, family, and work problems',
    es: 'Abogados gratis para familias de bajos ingresos — problemas de vivienda, inmigración, familia y trabajo',
  },
  'La Colaborativa::immigration': {
    en: 'Chelsea group that helps Latino families with immigration and other community needs',
    es: 'Grupo en Chelsea que ayuda a familias latinas con inmigración y otras necesidades comunitarias',
  },
  'La Comunidad::immigration': {
    en: 'Group in Everett that helps Latino families with immigration and support',
    es: 'Grupo en Everett que ayuda a familias latinas con inmigración y apoyo',
  },
  'Lawyers for Civil Rights::legal-aid': {
    en: 'Free lawyers for civil rights and immigration cases in Massachusetts',
    es: 'Abogados gratis para casos de derechos civiles e inmigración en Massachusetts',
  },
  'Mass Legal Help::legal-aid': {
    en: 'Easy-to-read website that explains your rights around housing, family, and benefits',
    es: 'Sitio web fácil de leer que explica tus derechos sobre vivienda, familia y beneficios',
  },
  'Mass Legal Resource Finder::legal-aid': {
    en: 'Online list to find free or low-cost legal help anywhere in Massachusetts',
    es: 'Lista en línea para encontrar ayuda legal gratis o de bajo costo en cualquier parte de Massachusetts',
  },
  "Mayor's Office for Immigrant Advancement::immigration": {
    en: 'Boston city office that helps immigrant families with services and questions',
    es: 'Oficina de la ciudad de Boston que ayuda a familias inmigrantes con servicios y preguntas',
  },
  'MIRA Coalition::immigration': {
    en: 'Group that fights for the rights of immigrants and refugees and helps them find resources',
    es: 'Grupo que lucha por los derechos de inmigrantes y refugiados y les ayuda a encontrar recursos',
  },
  'Project Citizenship::immigration': {
    en: 'Free help for green card holders who want to become U.S. citizens',
    es: 'Ayuda gratis para personas con tarjeta verde que quieren hacerse ciudadanos de EE.UU.',
  },
  'Massachusetts Attorney General Office::legal-aid': {
    en: 'State office that helps with renter, worker, and consumer problems',
    es: 'Oficina estatal que ayuda con problemas de inquilinos, trabajadores y consumidores',
  },
  'City Life/Vida Urbana::housing': {
    en: 'Helps renters fight eviction and rent hikes; weekly meetings in English and Spanish',
    es: 'Ayuda a inquilinos a luchar contra desalojos y subidas de alquiler; reuniones semanales en inglés y español',
  },
  'Crossroads Family Center::housing': {
    en: 'Family shelter in East Boston with housing and other support for families',
    es: 'Refugio familiar en East Boston con vivienda y otro apoyo para familias',
  },
  'RAFT Emergency Help for Housing Costs::housing': {
    en: 'Emergency money for renters facing eviction or having their utilities cut off; call 211',
    es: 'Dinero de emergencia para inquilinos que enfrentan desalojo o corte de servicios; llama al 211',
  },
  'MA State Public Housing::housing': {
    en: 'State program offering low-cost housing for low-income families',
    es: 'Programa estatal que ofrece vivienda de bajo costo para familias de bajos ingresos',
  },
  "Mayor's Office of Housing::housing": {
    en: 'Boston city office that helps people find housing and pay for it',
    es: 'Oficina de la ciudad de Boston que ayuda a la gente a encontrar y pagar vivienda',
  },
  'Neighborhood of Affordable Housing::housing': {
    en: 'East Boston group that helps with affordable housing and offers English classes',
    es: 'Grupo en East Boston que ayuda con vivienda asequible y ofrece clases de inglés',
  },
  'Maverick Landing Community Services::housing': {
    en: 'Housing help and family support based at Maverick Landing in East Boston',
    es: 'Ayuda con vivienda y apoyo familiar con sede en Maverick Landing, East Boston',
  },
  'Asian American Civic Association::jobs': {
    en: 'Job training and English classes for Asian American families',
    es: 'Capacitación laboral y clases de inglés para familias asiático-americanas',
  },
  'BEST Hospitality Training::jobs': {
    en: 'Job training for hotel and restaurant work, with help finding a job',
    es: 'Capacitación laboral para trabajos de hotel y restaurante, con ayuda para encontrar empleo',
  },
  'JVS Boston::jobs': {
    en: 'Job training, career coaching, and English classes — strong in health care and finance jobs',
    es: 'Capacitación laboral, coaching de carrera y clases de inglés — fuertes en trabajos de salud y finanzas',
  },
  'Bunker Hill Community College::college': {
    en: 'Public community college with two-year degrees and short certificate programs',
    es: 'Universidad comunitaria pública con títulos de dos años y certificados cortos',
  },
  'Center for Educational Documentation::college': {
    en: 'Reviews school papers from other countries and translates documents for school or work',
    es: 'Revisa papeles de escuela de otros países y traduce documentos para estudiar o trabajar',
  },
  'East Boston Head Start::family': {
    en: 'Free preschool and childcare for young kids; ask Carmen Lalin about signing up',
    es: 'Preescolar y cuidado de niños gratis para niños pequeños; pregunta a Carmen Lalin sobre cómo inscribirse',
  },
  'Community Healing Response Network::health': {
    en: "Free, private support if you've been hurt by violence in your community",
    es: 'Apoyo gratis y privado si te ha lastimado la violencia en tu comunidad',
  },
  'NeighborHealth::health': {
    en: 'East Boston health center with doctors, dentists, and mental health visits',
    es: 'Centro de salud en East Boston con médicos, dentistas y citas de salud mental',
  },
  'Healthcare for All MA::health': {
    en: 'Helps people in Massachusetts find and keep health insurance',
    es: 'Ayuda a la gente de Massachusetts a encontrar y mantener seguro de salud',
  },
  "Mayor's Health Line::health": {
    en: 'Free phone help in many languages to sign up for health insurance and find a doctor',
    es: 'Ayuda telefónica gratis en muchos idiomas para inscribirte en seguro de salud y encontrar un médico',
  },
  'The 988 Suicide and Crisis Lifeline::health': {
    en: 'Free, private mental health and crisis help by phone or text — open 24 hours, every day',
    es: 'Ayuda gratis y privada para salud mental y crisis por teléfono o texto — abierto las 24 horas, todos los días',
  },
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      field = '';
      if (char === '\r') i += 1;
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text === '') return '';
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function serialize(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n';
}

function main() {
  const write = process.argv.includes('--write');
  const text = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(text);
  const headers = rows[0];
  const orgIdx = headers.indexOf('orgName');
  const catIdx = headers.indexOf('resourceCategory');
  const descIdx = headers.indexOf('description');

  let updated = 0;
  let missing = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const key = `${row[orgIdx]}::${row[catIdx]}`;
    const copy = COPY[key];
    if (!copy) {
      missing.push(key);
      continue;
    }
    const newDesc = `${copy.en}. Español: ${copy.es}.`;
    if (row[descIdx] !== newDesc) {
      row[descIdx] = newDesc;
      updated += 1;
    }
  }

  console.log(`Rows updated: ${updated}`);
  if (missing.length) {
    console.log(`No copy mapped for ${missing.length} row(s):`);
    missing.forEach((key) => console.log(`  - ${key}`));
  }

  if (!write) {
    console.log('\nDry run — pass --write to update the CSV.');
    return;
  }

  writeFileSync(CSV_PATH, serialize(rows), 'utf8');
  console.log(`\nWrote ${CSV_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
