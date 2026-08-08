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
    "en": "Get free clothes here every Friday from 11am to 2pm. You do not need an appointment or proof of income.",
    "es": "Consiga ropa gratis aquí todos los viernes de 11am a 2pm. No necesita cita ni prueba de ingresos."
  },
  "Central Community Church (Food Pantry)::food": {
    "en": "Get free fresh produce and food bags on Mondays. You can also make an appointment for emergency food help.",
    "es": "Consiga frutas, verduras y bolsas de comida gratis los lunes. También puede hacer una cita para recibir ayuda de comida de emergencia."
  },
  "Crossroads Family Center - Our Daily Bread Pantry::food": {
    "en": "Get free emergency food on Sundays and Wednesdays, 3pm to 4pm. Go to the white door on the side of the building. The first time, bring an ID for each person in your home and something with your address. A license, school ID, passport, birth certificate, or medical card all work, and a photo on your phone is fine. If you do not have them, they will still give you food this time.",
    "es": "Consiga comida de emergencia gratis los domingos y miércoles, de 3pm a 4pm. Vaya a la puerta blanca al lado del edificio. La primera vez, traiga una identificación para cada persona de su casa y algo con su dirección. Sirve una licencia, identificación escolar, pasaporte, acta de nacimiento o tarjeta médica, y una foto en su teléfono está bien. Si no las tiene, igual le dan comida esta vez."
  },
  "East Boston ABCD (SNAP Assistance)::food": {
    "en": "Get help applying for SNAP food benefits. Staff will help you fill out the application. Please bring your ID and income papers to your appointment.",
    "es": "Reciba ayuda para solicitar los beneficios de SNAP. El personal le ayudará a llenar la solicitud. Traiga su identificación y papeles de ingresos a su cita."
  },
  "East Boston ABCD APAC::money": {
    "en": "Get help with heating bills, food benefits, taxes, and citizenship papers. They also help you get a cheaper MBTA pass. Heating help runs from November to April.",
    "es": "Reciba ayuda con facturas de calefacción, beneficios de comida, impuestos y papeles de ciudadanía. También le ayudan a conseguir un pase de MBTA más barato. La ayuda con calefacción es de noviembre a abril."
  },
  "East Boston ABCD Clothing & Essentials::family": {
    "en": "Get free clothes and household basics like soap and shoes. Anyone can visit, and no proof of income is needed.",
    "es": "Consiga ropa y artículos básicos gratis como jabón y zapatos. Cualquiera puede ir y no se requiere prueba de ingresos."
  },
  "East Boston ABCD Mobile Food Pop‑Ups::food": {
    "en": "Get free groceries from a truck that goes to a different place each month. Call 617-208-8677 to find this month's date and place. There is an income limit, so ask when you call.",
    "es": "Consiga comida gratis de un camión que reparte comida en un lugar diferente cada mes. Llame al 617-208-8677 para saber la fecha y el lugar de este mes. Hay un límite de ingresos. Pregunte cuando llame."
  },
  "East Boston Soup Kitchen::food": {
    "en": "Get a free hot meal and bags of food every Tuesday. You do not need an appointment or proof of income.",
    "es": "Reciba una comida caliente gratis y bolsas de comida todos los martes. No necesita cita ni prueba de ingresos."
  },
  "Eastie Farm::food": {
    "en": "Get free or low-cost fruits and vegetables. Bring your own bags if you can. They accept SNAP and HIP benefits.",
    "es": "Consiga frutas y verduras gratis o a bajo costo. Traiga sus propias bolsas si puede. Aceptan beneficios de SNAP y HIP."
  },
  "EBNHC Women, Infants & Children (WIC)::family": {
    "en": "Get free healthy food and help feeding your family. It is for pregnant women, women who just had a baby, and children under 5. If you have MassHealth or SNAP, you already meet the money rules.",
    "es": "Consiga comida saludable gratis y ayuda para alimentar a su familia. Es para mujeres embarazadas, mujeres que acaban de tener un bebé y niños menores de 5 años. Si tiene MassHealth o SNAP, ya cumple con las reglas de ingresos."
  },
  "Family Nurturing Center::family": {
    "en": "Get free programs and support for parents raising young children. They offer playgroups, home visits, and classes to help your family.",
    "es": "Reciba programas y apoyo gratis para padres que crían niños pequeños. Ofrecen grupos de juego, visitas a casa y clases para ayudar a su familia."
  },
  "Ollie Diaper Depot::family": {
    "en": "Get free diapers and wipes once a month. You must sign up online each month to save your spot. Sign-up opens the last week of the month before.",
    "es": "Consiga pañales y toallitas gratis una vez al mes. Debe registrarse en línea cada mes para guardar su lugar. El registro abre la última semana del mes anterior."
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
    "en": "Get free groceries, baby supplies, and holiday help. They also have a safe after-school program for children from kindergarten to age 13.",
    "es": "Consiga comida, artículos para bebé y ayuda navideña gratis. También tienen un programa seguro después de la escuela para niños desde kínder hasta los 13 años."
  },
  "The Home for Little Wanderers – Family Resource Centers::family": {
    "en": "Get free parenting classes, English classes, and programs for children. You can also get free diapers, baby formula, and soap once a month.",
    "es": "Reciba clases de crianza, clases de inglés y programas para niños, todo gratis. También puede recibir pañales, leche de fórmula y jabón gratis una vez al mes."
  },
  "MA Department of Transitional Assistance (DTA)::money": {
    "en": "This state office helps you apply for SNAP food benefits, cash help, and job training. Call or apply online at DTAConnect.com.",
    "es": "Esta oficina del estado le ayuda a solicitar beneficios de comida (SNAP), ayuda en efectivo y capacitación laboral. Llame o solicite en línea en DTAConnect.com."
  },
  "Find Your Funds (Tax Help)::money": {
    "en": "Get free help to file your taxes and get money back. They show you which tax credits you can get. Help is in English and Spanish.",
    "es": "Reciba ayuda gratis para declarar sus impuestos y recuperar dinero. Le muestran qué créditos de impuestos puede recibir. La ayuda es en inglés y español."
  },
  "MA Department of Unemployment Assistance::jobs": {
    "en": "Get money for a short time if you lost your job. You need a work permit to qualify. Apply online.",
    "es": "Reciba dinero por un tiempo corto si perdió su trabajo. Necesita permiso de trabajo para calificar. Solicite en línea."
  },
  "East Boston Community Council::immigration": {
    "en": "Get local help with your green card, citizenship, and immigration papers. They also have English classes and GED classes in Spanish.",
    "es": "Reciba ayuda local con su green card, la ciudadanía y papeles de inmigración. También tienen clases de inglés y clases de GED en español."
  },
  "Agencia ALPHA::immigration": {
    "en": "Get help with immigration papers, citizenship classes, and health insurance. They also have an East Boston office at 70 White St, open Thursdays and Saturdays.",
    "es": "Reciba ayuda con papeles de inmigración, clases de ciudadanía y seguro de salud. También tienen una oficina en East Boston, en 70 White St, abierta jueves y sábados."
  },
  "Greater Boston Legal Services::legal-aid": {
    "en": "Free lawyers for problems with housing, work, family, and immigration. This is for low-income families. Call between 9:30am and 12:30pm. They cannot take every case.",
    "es": "Abogados gratis para problemas de vivienda, trabajo, familia e inmigración. Es para familias de bajos ingresos. Llame entre las 9:30am y las 12:30pm. No pueden tomar todos los casos."
  },
  "La Colaborativa::immigration": {
    "en": "Get help with immigration, food, housing, and workers' rights. They also offer mental health counseling for Latino families.",
    "es": "Reciba ayuda con inmigración, comida, vivienda y derechos de los trabajadores. También ofrecen consejería de salud mental para familias latinas."
  },
  "La Comunidad::immigration": {
    "en": "Get help with your green card, citizenship, taxes, and translating documents. Immigration help is free or low cost. They also have English classes and youth programs.",
    "es": "Reciba ayuda con su green card, la ciudadanía, los impuestos y la traducción de documentos. La ayuda de inmigración es gratis o de bajo costo. También tienen clases de inglés y programas para jóvenes."
  },
  "Lawyers for Civil Rights::legal-aid": {
    "en": "Get free legal help if you face discrimination at work or housing. They also offer free workshops for small businesses.",
    "es": "Reciba ayuda legal gratuita si enfrenta discriminación en el trabajo o la vivienda. También ofrecen talleres gratuitos para pequeños negocios."
  },
  "MassLegalHelp::legal-aid": {
    "en": "Read easy guides about your rights on housing, family, and help from the government. This website does not give you a lawyer.",
    "es": "Lea guías fáciles sobre sus derechos de vivienda, familia y ayuda del gobierno. Este sitio web no le da un abogado."
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
    "en": "Call the free helpline for information about immigration. They also hold free workshops to help you fill out citizenship forms.",
    "es": "Llame a la línea de ayuda gratuita para recibir orientación sobre inmigración. También organizan talleres gratuitos para ayudarle a llenar formularios de ciudadanía."
  },
  "Project Citizenship::immigration": {
    "en": "Get free help to apply for U.S. citizenship. They help you fill out the forms and practice for the test, and they work with groups that offer free English classes. Staff speak Spanish and other languages.",
    "es": "Reciba ayuda gratuita para solicitar la ciudadanía estadounidense. Le ayudan a llenar los formularios y a practicar para el examen, y trabajan con grupos que ofrecen clases de inglés gratis. El personal habla español y otros idiomas."
  },
  "Massachusetts Attorney General’s Office::legal-aid": {
    "en": "Report problems with the owner of your apartment, your boss, or a company that cheated you. They protect your rights, but they do not give you your own lawyer.",
    "es": "Reporte problemas con el dueño de su apartamento, su jefe o una compañía que lo engañó. Protegen sus derechos, pero no le dan un abogado propio."
  },
  "City Life/Vida Urbana::housing": {
    "en": "Join other renters to fight eviction and rent increases. They meet every week in East Boston on Wednesdays and in Jamaica Plain on Tuesdays, in English and Spanish.",
    "es": "Únase a otros inquilinos para luchar contra el desalojo y los aumentos de renta. Se reúnen cada semana en East Boston los miércoles y en Jamaica Plain los martes, en inglés y español."
  },
  "East Boston Adult Family Shelter (formerly Crossroads Family Center)::housing": {
    "en": "A shelter for families with no home. You cannot go there without a referral, because the state has to send you. Call 2-1-1 to start. Their food pantry is open to everyone.",
    "es": "Un refugio para familias sin hogar. No puede ir sin una referencia, porque el estado tiene que enviarlo. Llame al 2-1-1 para empezar. Su despensa de comida está abierta para todos."
  },
  "RAFT (Residential Assistance for Families in Transition)::housing": {
    "en": "Get up to $7,000 to pay rent you owe, moving costs, or light and gas bills, so you do not lose your home. Apply online or call 2-1-1.",
    "es": "Reciba hasta $7,000 para pagar renta atrasada, costos de mudanza o facturas de luz y gas, para no perder su casa. Solicite en línea o llame al 2-1-1."
  },
  "MA State Public Housing::housing": {
    "en": "Apply for low-cost apartments for families, older adults, and people with disabilities. Rent is based on what you earn. One form (CHAMP) covers the whole state. The wait can be long.",
    "es": "Solicite apartamentos de bajo costo para familias, personas mayores y personas con discapacidad. La renta depende de lo que usted gana. Una sola solicitud (CHAMP) sirve para todo el estado. La espera puede ser larga."
  },
  "Mayor’s Office of Housing – Office of Housing Stability::housing": {
    "en": "Get help to stop an eviction and stay in your home. They have free legal clinics most Tuesdays and can connect you with a volunteer lawyer.",
    "es": "Reciba ayuda para detener un desalojo y quedarse en su casa. Tienen consultas legales gratuitas casi todos los martes y lo conectan con un abogado voluntario."
  },
  "Neighborhood of Affordable Housing (NOAH)::housing": {
    "en": "Get help finding low-cost housing and buying a home. They also have free English classes at night and programs for young people.",
    "es": "Reciba ayuda para encontrar vivienda de bajo costo y comprar una casa. También tienen clases de inglés gratis por la noche y programas para jóvenes."
  },
  "Maverick Landing Community Services::housing": {
    "en": "Get free food, English classes, and job training. They give out fresh food every Wednesday and also help with housing and youth programs.",
    "es": "Consiga comida, clases de inglés y capacitación laboral gratis. Reparten comida fresca todos los miércoles y también ayudan con la vivienda y programas para jóvenes."
  },
  "Asian American Civic Association (AACA)::jobs": {
    "en": "Take job training courses and English classes. They also help you with career coaching and finding a job.",
    "es": "Tome cursos de capacitación laboral y clases de inglés. También le ofrecen asesoramiento de carrera y ayuda para buscar trabajo."
  },
  "BEST Hospitality Training::jobs": {
    "en": "Take free training for hotel and restaurant jobs. They also have free English, HSE, citizenship, and computer classes.",
    "es": "Tome capacitación gratuita para trabajos en hoteles y restaurantes. También tienen clases gratis de inglés, HSE, ciudadanía y computación."
  },
  "JVS Boston::jobs": {
    "en": "Get job training, career coaching, and English classes. Their English program meets 4 mornings a week, unless you already work 20 hours or more.",
    "es": "Reciba capacitación laboral, asesoramiento de carrera y clases de inglés. Su programa de inglés es 4 mañanas por semana, a menos que ya trabaje 20 horas o más."
  },
  "Bunker Hill Community College::college": {
    "en": "Go to college to earn a degree or a short certificate. They offer English support, financial aid, and career advisors.",
    "es": "Vaya al college para obtener un título o un certificado corto. Ofrecen apoyo en inglés, ayuda financiera y asesores de carrera."
  },
  "Center for Educational Documentation::college": {
    "en": "They check your school papers from another country for work or college. It costs $80 to $130, less than most services. They can read Spanish and Portuguese papers for $50 more.",
    "es": "Revisan sus papeles escolares de otro país para trabajar o ir al college. Cuesta entre $80 y $130, menos que otros servicios. Pueden leer papeles en español y portugués por $50 más."
  },
  "East Boston Head Start::family": {
    "en": "Get free preschool and childcare for children ages 3 to 5. They also give free meals and help for parents. It is free for families who qualify, so call to check.",
    "es": "Consiga preescolar y cuidado de niños gratis para niños de 3 a 5 años. También dan comidas gratis y ayuda para los padres. Es gratis para las familias que califican, llame para preguntar."
  },
  "Community Healing Response Network::health": {
    "en": "Get free, private support if you or your family have been hurt by community violence. Someone answers the line every day of the year.",
    "es": "Reciba apoyo privado y gratuito si usted o su familia han sufrido por la violencia comunitaria. Contestan la línea todos los días del año."
  },
  "NeighborHealth (formerly East Boston Neighborhood Health Center)::health": {
    "en": "Go to the doctor, dentist, or eye doctor. They see everyone, even if you have no insurance and no papers.",
    "es": "Vaya al médico, al dentista o al doctor de los ojos. Atienden a todos, aunque no tenga seguro ni papeles."
  },
  "Health Care For All Massachusetts::health": {
    "en": "Call the free hotline for help signing up for health insurance. They also help you keep your MassHealth. Help is in English, Spanish, and Portuguese.",
    "es": "Llame a la línea gratuita para que le ayuden a inscribirse en un seguro de salud. También le ayudan a mantener su MassHealth. Hay ayuda en inglés, español y portugués."
  },
  "Mayor’s Health Line::health": {
    "en": "Call for free help in many languages to sign up for health insurance or find a doctor near you.",
    "es": "Llame para recibir ayuda gratuita en muchos idiomas para inscribirse en un seguro de salud o buscar un médico cercano."
  },
  "988 Suicide & Crisis Lifeline::health": {
    "en": "Call or text 988 anytime for free, private support if you feel sad, stressed, or in crisis. You can get help in Spanish.",
    "es": "Llame o envíe un texto al 988 en cualquier momento para recibir apoyo gratis y confidencial si se siente triste, estresado o en crisis. Puede recibir ayuda en español."
  },
  "World Education Services (WES)::college": {
    "en": "They check your diploma or grades from another country so U.S. schools and jobs will accept them. This costs money, about $118 to $214. Ask your advisor before you pay.",
    "es": "Revisan su diploma o calificaciones de otro país para que las escuelas y los trabajos de EE.UU. los acepten. Esto cuesta dinero, entre $118 y $214. Pregunte a su consejero antes de pagar."
  },
  "Roxbury Community College::college": {
    "en": "Go to college for a 2-year degree or a short certificate. They have classes in health, business, and technology, plus money help and advisors. The campus is at the Roxbury Crossing T stop.",
    "es": "Vaya al college para un título de 2 años o un certificado corto. Tienen clases de salud, negocios y tecnología, más ayuda con el dinero y asesores. El campus está en la estación Roxbury Crossing del T."
  },
  "Permission to Share Your Case Info (ICE/DHS)::immigration": {
    "en": "Sign this form so your family or a lawyer can ask the government about your immigration case. You choose to sign, you do not have to. It lasts 90 days and you can cancel it.",
    "es": "Firme este formulario para que su familia o un abogado pueda preguntar al gobierno sobre su caso de inmigración. Usted decide si lo firma, no está obligado. Dura 90 días y puede cancelarlo."
  },
  "Massachusetts HiSET::hse": {
    "en": "Make an account to sign up for the HiSET test. Pick where and when you want to test. You can change the date later and see your scores here.",
    "es": "Cree una cuenta para inscribirse en el examen HiSET. Elija dónde y cuándo quiere tomar el examen. Puede cambiar la fecha después y ver sus resultados aquí."
  },
  "Massachusetts Behavioral Health Help Line::health": {
    "en": "Call or text anytime to talk to someone about stress, sadness, worry, or drinking and drugs. It is free, private, and you do not need insurance. They speak your language.",
    "es": "Llame o envíe un texto en cualquier momento para hablar con alguien sobre estrés, tristeza, preocupación o el alcohol y las drogas. Es gratis, privado y no necesita seguro. Hablan su idioma."
  },
  "SafeLink Domestic Violence Hotline::family": {
    "en": "Call anytime if someone at home hurts you or scares you. It is free and private, and you do not have to give your name. They speak Spanish and many other languages.",
    "es": "Llame en cualquier momento si alguien en su casa le hace daño o le da miedo. Es gratis y privado, y no tiene que dar su nombre. Hablan español y muchos otros idiomas."
  },
  "Learn About the HSE Test (GED or HiSET)::hse": {
    "en": "Learn how to get your high school credential in Massachusetts. This page explains the two tests, GED and HiSET, and where you can take them. You can mix parts of both tests.",
    "es": "Aprenda cómo obtener su credencial de escuela secundaria en Massachusetts. Esta página explica los dos exámenes, GED y HiSET, y dónde puede tomarlos. Puede combinar partes de los dos exámenes."
  },
  "MassLINKS Free Online Classes::hse": {
    "en": "Take free classes online to study English or get ready for the HSE test. You can study at home and at your own speed.",
    "es": "Tome clases gratis en línea para estudiar inglés o prepararse para el examen HSE. Puede estudiar en casa y a su propio ritmo."
  },
  "Help Paying for College::college": {
    "en": "Community college is now free for Massachusetts residents, and there is money to help pay for other colleges. If you finish high school or your HSE in Massachusetts, you can get in-state prices and state money no matter your immigration status.",
    "es": "El community college ahora es gratis para residentes de Massachusetts, y hay dinero para ayudar a pagar otros colleges. Si termina la secundaria o su HSE en Massachusetts, puede pagar el precio del estado y recibir ayuda estatal sin importar su estado migratorio."
  },
  "MBTA Reduced Fare (Income-Eligible)::money": {
    "en": "Pay about half price on the T and the bus. You can get this if you are 18 to 64 and have SNAP, MassHealth, or other state help. ABCD can help you sign up.",
    "es": "Pague casi la mitad del precio en el T y el autobús. Puede recibirlo si tiene entre 18 y 64 años y tiene SNAP, MassHealth u otra ayuda del estado. ABCD le puede ayudar a inscribirse."
  },
  "MassHire Metro North Career Center (Chelsea)::jobs": {
    "en": "Get free help looking for a job. You can use computers, printers, and phones there for free, and talk to a job counselor. Just walk in.",
    "es": "Reciba ayuda gratis para buscar trabajo. Puede usar computadoras, impresoras y teléfonos gratis, y hablar con un consejero de empleo. Puede llegar sin cita."
  },
  "Agencia ALPHA - East Boston Office::immigration": {
    "en": "Get help with immigration papers and citizenship right here in East Boston. This office is open Thursdays and Saturdays.",
    "es": "Reciba ayuda con papeles de inmigración y ciudadanía aquí mismo en East Boston. Esta oficina abre los jueves y sábados."
  },
  "Boston Public Library - East Boston::college": {
    "en": "Use computers, wifi, and printing for free. They also have free English conversation groups where you can practice speaking. You do not need papers or money to join.",
    "es": "Use computadoras, wifi e impresión gratis. También tienen grupos gratuitos de conversación en inglés donde puede practicar. No necesita papeles ni dinero para participar."
  },
  "Rian Immigrant Center::immigration": {
    "en": "Get free help with citizenship and immigration papers. They have a free citizenship clinic every Wednesday morning. They help people from every country, not only Ireland.",
    "es": "Reciba ayuda gratuita con la ciudadanía y papeles de inmigración. Tienen una clínica de ciudadanía gratis todos los miércoles por la mañana. Ayudan a personas de todos los países, no solo de Irlanda."
  },
  "Mass 211::money": {
    "en": "Call 2-1-1 anytime if you need help but do not know where to start. They listen to your problem and tell you where to go. Free and in many languages.",
    "es": "Llame al 2-1-1 en cualquier momento si necesita ayuda pero no sabe por dónde empezar. Escuchan su problema y le dicen adónde ir. Es gratis y en muchos idiomas."
  },
  "Metro Housing Boston::housing": {
    "en": "This is the office that handles rent help (RAFT) for East Boston. Call them if you owe rent or are afraid of losing your home.",
    "es": "Esta es la oficina que maneja la ayuda con la renta (RAFT) para East Boston. Llame si debe renta o tiene miedo de perder su casa."
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

// The COPY entries already end in a period. Blindly appending another one
// produced "…if you have them.. Español: …" in the CSV, so only add terminal
// punctuation when it is actually missing.
function endPunctuated(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
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
    const newDesc = `${endPunctuated(copy.en)} Español: ${endPunctuated(copy.es)}`;
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
