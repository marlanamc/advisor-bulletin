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
  "BCYF Paris Street::food": {
    "en": "Get free grocery bags at this community center. You do not need to make an appointment. Please bring your own bags if you have them.",
    "es": "Consiga bolsas de comida gratis en este centro comunitario. No necesita hacer una cita. Traiga sus propias bolsas si las tiene."
  },
  "Central Community Church (Clothing)::family": {
    "en": "Get free clothes here. The clothing rack is open every Friday. You do not need an appointment or proof of income.",
    "es": "Consiga ropa gratis aquí. El perchero de ropa está abierto todos los viernes. No necesita cita ni prueba de ingresos."
  },
  "Central Community Church (Food Pantry)::food": {
    "en": "Get free fresh produce and food bags on Mondays. You can also make an appointment for emergency food help.",
    "es": "Consiga frutas, verduras y bolsas de comida gratis los lunes. También puede hacer una cita para recibir ayuda de comida de emergencia."
  },
  "Crossroads Family Center - Our Daily Bread Pantry::food": {
    "en": "Get free emergency food on Wednesdays. Please bring a photo ID and a piece of mail showing you live in East Boston.",
    "es": "Consiga comida de emergencia gratis los miércoles. Traiga una identificación con foto y una carta que muestre que vive en East Boston."
  },
  "East Boston ABCD (SNAP Assistance)::food": {
    "en": "Get help applying for SNAP food benefits. Staff will help you fill out the application. Please bring your ID and income papers to your appointment.",
    "es": "Reciba ayuda para solicitar los beneficios de SNAP. El personal le ayudará a llenar la solicitud. Traiga su identificación y papeles de ingresos a su cita."
  },
  "East Boston ABCD APAC::money": {
    "en": "Get help with heating bills, food benefits, tax prep, and citizenship applications. They also help you apply for cheaper MBTA transit passes.",
    "es": "Reciba ayuda con facturas de calefacción, beneficios de comida, impuestos y ciudadanía. También le ayudan a solicitar pases de transporte baratos de la MBTA."
  },
  "East Boston ABCD Clothing & Essentials::family": {
    "en": "Get free clothes and household basics like soap and shoes. Anyone can visit, and no proof of income is needed.",
    "es": "Consiga ropa y artículos básicos gratis como jabón y zapatos. Cualquiera puede ir y no se requiere prueba de ingresos."
  },
  "East Boston ABCD Mobile Food Pop‑Ups::food": {
    "en": "Get free groceries from a mobile food truck at different locations. You must register first, but anyone can get food.",
    "es": "Consiga comestibles gratis de un camión de comida móvil en diferentes lugares. Debe registrarse primero, pero cualquiera puede recibir comida."
  },
  "East Boston Soup Kitchen::food": {
    "en": "Get free ready‑to‑eat hot meals and groceries every Tuesday. You do not need an appointment or proof of income.",
    "es": "Reciba comida caliente y comestibles gratis todos los martes. No necesita cita ni prueba de ingresos."
  },
  "Eastie Farm::food": {
    "en": "Get free or low-cost fruits and vegetables. Bring your own bags if you can. They accept SNAP and HIP benefits.",
    "es": "Consiga frutas y verduras gratis o a bajo costo. Traiga sus propias bolsas si puede. Aceptan beneficios de SNAP y HIP."
  },
  "EBNHC Women, Infants & Children (WIC)::family": {
    "en": "Get free healthy food and nutrition support for pregnant women, new mothers, and children under age 5. You qualify automatically if you have MassHealth or SNAP.",
    "es": "Consiga alimentos saludables y ayuda de nutrición gratis para mujeres embarazadas, madres nuevas y niños menores de 5 años. Califica automáticamente si tiene MassHealth o SNAP."
  },
  "Family Nurturing Center::family": {
    "en": "Get free programs and support for parents raising young children. They offer playgroups, home visits, and classes to help your family.",
    "es": "Reciba programas y apoyo gratis para padres que crían niños pequeños. Ofrecen grupos de juego, visitas a casa y clases para ayudar a su familia."
  },
  "Ollie Diaper Depot::family": {
    "en": "Get free diapers and wipes once a month. You must sign up online each month to save your spot.",
    "es": "Consiga pañales y toallitas gratis una vez al mes. Debe registrarse en línea cada mes para guardar su lugar."
  },
  "Project Bread::food": {
    "en": "This group helps people find food resources and sign up for benefits. They do not run a food pantry, but they can help you find one near you.",
    "es": "Este grupo ayuda a las personas a encontrar comida y registrarse en programas de ayuda. No tienen despensa de alimentos, pero le ayudan a encontrar una cercana."
  },
  "Project Bread FoodSource Hotline::food": {
    "en": "Call 1-800-645-8333 for free, private help finding food. They can help you apply for SNAP in many languages.",
    "es": "Llame al 1-800-645-8333 para recibir ayuda de comida gratuita y confidencial. Le ayudan a solicitar SNAP en muchos idiomas."
  },
  "Salvation Army of Chelsea/East Boston::family": {
    "en": "Get free groceries, baby supplies, and holiday help. They also offer a safe after-school program for kids ages 5 to 12.",
    "es": "Consiga comestibles, artículos para bebé y ayuda navideña gratis. También ofrecen un programa extracurricular seguro para niños de 5 a 12 años."
  },
  "The Home for Little Wanderers – Family Resource Centers::family": {
    "en": "Get free help with parenting classes, English classes, and children's programs. You can also get free diapers, formula, and hygiene supplies once a month.",
    "es": "Reciba ayuda gratuita con clases de crianza, clases de inglés y programas infantiles. También puede recibir pañales, fórmula y artículos de higiene gratis una vez al mes."
  },
  "MA Department of Transitional Assistance (DTA)::money": {
    "en": "This state office helps you apply for SNAP food benefits, cash help, and job training. Call 877-382-2363 to apply.",
    "es": "Esta oficina del estado le ayuda a solicitar beneficios de comida de SNAP, ayuda en efectivo y capacitación de trabajo. Llame al 877-382-2363 para solicitar."
  },
  "Find Your Funds (Tax Help)::money": {
    "en": "Get free help to file your taxes. They help you get tax credits and refunds back. Services are in English and Spanish.",
    "es": "Reciba ayuda gratuita para declarar sus impuestos. Le ayudan a recibir créditos fiscales y devoluciones de dinero. El servicio es en inglés y español."
  },
  "MA Department of Unemployment Assistance::jobs": {
    "en": "Get temporary money if you lost your job. You can apply online to see if you qualify.",
    "es": "Reciba dinero temporal si perdió su trabajo. Puede solicitar en línea para ver si califica."
  },
  "East Boston Community Council::immigration": {
    "en": "Get local help with green cards, citizenship, and immigration papers. They also offer English classes and youth programs.",
    "es": "Reciba ayuda local con tarjetas verdes, ciudadanía y papeles de inmigración. También ofrecen clases de inglés y programas para jóvenes."
  },
  "Agencia ALPHA::immigration": {
    "en": "Get help with immigration papers, citizenship classes, and health insurance. They also run free legal clinics.",
    "es": "Reciba ayuda con papeles de inmigración, clases de ciudadanía y seguro de salud. También ofrecen clínicas legales gratuitas."
  },
  "Greater Boston Legal Services::legal-aid": {
    "en": "Get free lawyers to help with housing, work, family, and immigration problems. This service is for low-income families.",
    "es": "Consiga abogados gratis para ayudar con problemas de vivienda, trabajo, familia e inmigración. Este servicio es para familias de bajos ingresos."
  },
  "La Colaborativa::immigration": {
    "en": "Get help with immigration, food, housing, and workers' rights. They also offer mental health counseling for Latino families.",
    "es": "Reciba ayuda con inmigración, comida, vivienda y derechos de los trabajadores. También ofrecen consejería de salud mental para familias latinas."
  },
  "La Comunidad::immigration": {
    "en": "Get help with green cards, citizenship, tax filing, and document translation. They also offer English classes and youth programs.",
    "es": "Reciba ayuda con tarjetas verdes, ciudadanía, declaración de impuestos y traducción de documentos. También ofrecen clases de inglés y programas para jóvenes."
  },
  "Lawyers for Civil Rights::legal-aid": {
    "en": "Get free legal help if you face discrimination at work or housing. They also offer free workshops for small businesses.",
    "es": "Reciba ayuda legal gratuita si enfrenta discriminación en el trabajo o la vivienda. También ofrecen talleres gratuitos para pequeños negocios."
  },
  "MassLegalHelp::legal-aid": {
    "en": "Read easy guides to learn your rights about housing, family law, and public benefits. This website does not give you a lawyer.",
    "es": "Lea guías fáciles para conocer sus derechos sobre vivienda, leyes familiares y beneficios públicos. Este sitio web no le da un abogado."
  },
  "Mass Legal Resource Finder::legal-aid": {
    "en": "Use this free online tool to find free or cheap legal help in Massachusetts. Enter your location and problem to get matches.",
    "es": "Use esta herramienta gratuita en línea para encontrar ayuda legal barata o gratis en Massachusetts. Ingrese su ubicación y problema para ver opciones."
  },
  "Mayor's Office for Immigrant Advancement (MOIA)::immigration": {
    "en": "Get free legal advice from immigration lawyers by phone. They also help you apply for U.S. citizenship.",
    "es": "Reciba asesoría legal gratuita de abogados de inmigración por teléfono. También le ayudan a solicitar la ciudadanía estadounidense."
  },
  "MIRA Coalition::immigration": {
    "en": "Call the free helpline for advice about immigration. They also host free workshops to help you fill out citizenship forms.",
    "es": "Llame a la línea de ayuda gratuita para consejos sobre inmigración. También organizan talleres gratuitos para ayudarle a llenar formularios de ciudadanía."
  },
  "Project Citizenship::immigration": {
    "en": "Get free help to apply for U.S. citizenship. They help you fill out forms, practice for the test, and offer free English classes. Staff speak Spanish, French, and other languages.",
    "es": "Reciba ayuda gratuita para solicitar la ciudadanía estadounidense. Le ayudan a llenar formularios, practicar para el examen y ofrecen clases de inglés gratis. El personal habla español, francés y otros idiomas."
  },
  "Massachusetts Attorney General’s Office::legal-aid": {
    "en": "Report problems with landlords, boss issues, or consumer scams. They protect your rights but do not give you a personal lawyer.",
    "es": "Reporte problemas con propietarios, problemas de trabajo o estafas. Protegen sus derechos pero no le dan un abogado personal."
  },
  "City Life/Vida Urbana::housing": {
    "en": "Join other renters to fight eviction and rent increases. They host weekly bilingual meetings in English and Spanish.",
    "es": "Únase a otros inquilinos para luchar contra el desalojo y los aumentos de renta. Tienen reuniones bilingües semanales en inglés y español."
  },
  "East Boston Adult Family Shelter (formerly Crossroads Family Center)::housing": {
    "en": "This is a family shelter that helps families experiencing homelessness find housing. They also offer parenting classes, job help, and a food pantry.",
    "es": "Este es un refugio familiar que ayuda a familias sin hogar a encontrar vivienda. También ofrecen clases de crianza, ayuda de trabajo y una despensa de alimentos."
  },
  "RAFT (Residential Assistance for Families in Transition)::housing": {
    "en": "Get up to $7,000 to help pay for back rent, moving costs, or utilities to avoid eviction. Apply online or call 2-1-1.",
    "es": "Reciba hasta $7,000 para ayudar a pagar renta atrasada, costos de mudanza o facturas de servicios para evitar el desalojo. Solicite en línea o llame al 2-1-1."
  },
  "MA State Public Housing::housing": {
    "en": "Apply for low-cost apartments for families, seniors, and people with disabilities. Rent is based on your income.",
    "es": "Solicite apartamentos de bajo costo para familias, personas mayores y personas con discapacidades. La renta se basa en sus ingresos."
  },
  "Mayor’s Office of Housing – Office of Housing Stability::housing": {
    "en": "Get help to stop an eviction and stay in your home. They offer free legal clinics and connect you with volunteer lawyers.",
    "es": "Reciba ayuda para detener un desalojo y quedarse en su casa. Ofrecen clínicas legales gratuitas y lo conectan con abogados voluntarios."
  },
  "Neighborhood of Affordable Housing (NOAH)::housing": {
    "en": "Get help finding affordable housing and buying a home. They also offer free evening English classes and youth programs.",
    "es": "Reciba ayuda para encontrar vivienda asequible y comprar una casa. También ofrecen clases gratuitas de inglés por la noche y programas juveniles."
  },
  "Maverick Landing Community Services::housing": {
    "en": "Get free groceries, English classes, and job training. They also offer youth programs and help with housing.",
    "es": "Consiga comestibles, clases de inglés y capacitación laboral gratis. También ofrecen programas para jóvenes y ayuda con la vivienda."
  },
  "Asian American Civic Association (AACA)::jobs": {
    "en": "Take job training courses and English classes. They also help you with career coaching and finding a job.",
    "es": "Tome cursos de capacitación laboral y clases de inglés. También le ofrecen asesoramiento de carrera y ayuda para buscar trabajo."
  },
  "BEST Hospitality Training::jobs": {
    "en": "Take free training for hotel and restaurant jobs. They help you get union jobs and practice your work skills.",
    "es": "Tome capacitación gratuita para trabajos en hoteles y restaurantes. Le ayudan a conseguir trabajos del sindicato y practicar sus habilidades de trabajo."
  },
  "JVS Boston::jobs": {
    "en": "Get help with job training, career coaching, and English classes. They help you find a job, especially in healthcare.",
    "es": "Reciba ayuda con capacitación laboral, asesoramiento de carrera y clases de inglés. Le ayudan a buscar trabajo, especialmente en el área de salud."
  },
  "Bunker Hill Community College::college": {
    "en": "Go to college to earn a degree or a short certificate. They offer English support, financial aid, and career advisors.",
    "es": "Vaya al college para obtener un título o un certificado corto. Ofrecen apoyo en inglés, ayuda financiera y asesores de carrera."
  },
  "Center for Educational Documentation::college": {
    "en": "Get your school diploma or transcripts from another country evaluated for work or college. They also translate school documents.",
    "es": "Obtenga una evaluación de su diploma escolar o notas de otro país para trabajar o ir al college. También traducen documentos escolares."
  },
  "East Boston Head Start::family": {
    "en": "Get free preschool and childcare for children ages 3 to 5. They also provide free meals and family support.",
    "es": "Consiga preescolar y cuidado infantil gratis para niños de 3 a 5 años. También ofrecen comidas gratuitas y apoyo familiar."
  },
  "Community Healing Response Network::health": {
    "en": "Get free, private support if you or your family have been hurt by community violence.",
    "es": "Reciba apoyo privado y gratuito si usted o su familia han sufrido por la violencia comunitaria."
  },
  "NeighborHealth (formerly East Boston Neighborhood Health Center)::health": {
    "en": "Go to the doctor, dentist, or eye doctor. They treat all patients regardless of insurance or immigration status.",
    "es": "Vaya al médico, dentista u oftalmólogo. Atienden a todos los pacientes sin importar su seguro o estado migratorio."
  },
  "Health Care For All Massachusetts::health": {
    "en": "Call the free hotline to get help signing up for health insurance. They help you keep your MassHealth coverage.",
    "es": "Llame a la línea de ayuda gratuita para recibir ayuda al inscribirse en un seguro de salud. Le ayudan a mantener su cobertura de MassHealth."
  },
  "Mayor’s Health Line::health": {
    "en": "Call for free help in many languages to sign up for health insurance or find a doctor near you.",
    "es": "Llame para recibir ayuda gratuita en muchos idiomas para inscribirse en un seguro de salud o buscar un médico cercano."
  },
  "988 Suicide & Crisis Lifeline::health": {
    "en": "Call or text 988 anytime for free, private support if you are feeling sad, stressed, or in crisis.",
    "es": "Llame o envíe un texto al 988 en cualquier momento para apoyo confidencial y gratuito si se siente triste, estresado o en crisis."
  }
};;;;

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
