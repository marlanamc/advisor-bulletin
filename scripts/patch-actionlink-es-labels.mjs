#!/usr/bin/env node
/**
 * Patches labelEs onto the 36 actionLinks added by apply-audit-links.mjs
 * (which only set labelEn). Firestore's arrayUnion/arrayRemove need the
 * exact prior object to remove it, so this does a two-step write per
 * resource: remove the old {labelEn, url} entry, then add it back with
 * labelEs included. Both are writes only — safe while reads are
 * quota-exhausted, since read/write quotas are billed separately.
 *
 * Usage:
 *   node scripts/patch-actionlink-es-labels.mjs           # dry run
 *   node scripts/patch-actionlink-es-labels.mjs --confirm # write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

// Same {id, title, addActionLink} entries from apply-audit-links.mjs,
// minus the 2 setUrl-only entries (Maverick Landing, East Boston Soup Kitchen).
const ENTRIES = [
  { id: '6JdhXrCbfJM4dbc6lfJu', title: 'Ollie Diaper Depot', labelEn: 'Sign up for diapers', url: 'https://forms.gle/rW4fFvN6pcLXx6LP9' },
  { id: '5v2i2ZzQJ6dGva2bBQw9', title: 'RAFT (Residential Assistance for Families in Transition)', labelEn: 'Apply for RAFT rental assistance', url: 'https://www.mass.gov/how-to/apply-for-raft-emergency-help-for-housing-costs' },
  { id: '41UtfHEQqtsi4tMcD29o', title: 'MA State Public Housing', labelEn: 'Apply for state public housing', url: 'https://www.mass.gov/how-to/apply-for-state-funded-public-housing' },
  { id: 'kw2XSXtjJITiQLwFtFGn', title: 'Mayor’s Office of Housing – Office of Housing Stability', labelEn: 'Get eviction & housing stability help', url: 'https://www.boston.gov/departments/housing/office-housing-stability' },
  { id: 'e8ZdCGj1ws7PIWJQpfLJ', title: 'Neighborhood of Affordable Housing (NOAH)', labelEn: 'See affordable & rental housing', url: 'https://noahcdc.org/real-estate-development--housing' },
  { id: 'yHcQps4ebiQYp1LCQ3ho', title: 'City Life/Vida Urbana', labelEn: 'Weekly meeting times & locations', url: 'https://www.clvu.org/meeting_info' },
  { id: 'eQwUy0g8u4c36n5PicxY', title: 'MA Department of Transitional Assistance (DTA)', labelEn: 'Apply for SNAP / cash benefits online', url: 'https://dtaconnect.eohhs.mass.gov/apply' },
  { id: 'zWD5bDlxTgckNSQCX55X', title: 'MA Department of Unemployment Assistance', labelEn: 'Apply for unemployment benefits online', url: 'https://www.mass.gov/how-to/apply-for-unemployment-insurance-benefits' },
  { id: 'JPm9kgAHjf1ltg4QyHKD', title: 'Find Your Funds (Tax Help)', labelEn: 'Start free tax filing now', url: 'https://www.getyourrefund.org/fyf' },
  { id: 'pkizk5s5rUJ4ZVAah624', title: 'JVS Boston', labelEn: 'Apply for job training & career help', url: 'https://www.jvs-boston.org/uif-program-applications/?tfa_524=front-page-application' },
  { id: 'ipBCBYM0hh7s6ZW66wOf', title: 'BEST Hospitality Training', labelEn: 'See job seeker training programs', url: 'https://besthtc.org/job-seekers#classes' },
  { id: 'kY1Qv7hP5P3FLP2U09hW', title: 'Asian American Civic Association (AACA)', labelEn: 'See job training programs', url: 'https://www.aaca-boston.org/training-program' },
  { id: 'OxkqctNYJZlJkkmH9hKm', title: 'Massachusetts Attorney General’s Office', labelEn: 'File a consumer complaint', url: 'https://www.mass.gov/how-to/file-a-consumer-complaint' },
  { id: 'd7e0iokDWH8Rg3Rangep', title: 'Mass Legal Resource Finder', labelEn: 'Start legal help search', url: 'https://masslrf.org/en/triage' },
  { id: 'Gpa30JCZ52KT3sTtpgtv', title: 'MassLegalHelp', labelEn: 'Find immigration legal help near you', url: 'https://www.masslegalhelp.org/immigration/know-your-rights/immigration-help-referral-list' },
  { id: 'aql8YOrvxHJErHNBi0z0', title: 'Lawyers for Civil Rights', labelEn: 'Get legal help', url: 'https://lawyersforcivilrights.org/gethelp' },
  { id: 'z8etC01nAXNPcZ0wuHo0', title: 'Greater Boston Legal Services', labelEn: 'Get free legal help', url: 'https://www.gbls.org/get-legal-help' },
  { id: '2ARioOYAVid5tF3Jw7PI', title: 'Project Citizenship', labelEn: 'Apply for free citizenship help', url: 'https://projectcitizenship.org/apply-with-project-citizenship/' },
  { id: 'JQwr3MbZChtEjReg1Qyb', title: "Mayor's Office for Immigrant Advancement (MOIA)", labelEn: 'Sign up for free legal consultation', url: 'https://www.boston.gov/departments/immigrant-advancement/free-immigration-consultations' },
  { id: 'e7aGhmTIECOBwS3KlAjp', title: 'La Comunidad', labelEn: 'See immigration services', url: 'https://lacomunidadinc.org/services-servicios' },
  { id: 'ftfx4zJIL11IfQjhSKIo', title: 'East Boston Community Council', labelEn: 'Contact EBCC for immigration help', url: 'https://ebecc.org/contact-us/' },
  { id: 'HgjucUkz7dxNFnAPqvKS', title: 'La Colaborativa', labelEn: 'Get stabilization services & intake', url: 'https://la-colaborativa.org/what-we-do/stabilization-services/' },
  { id: 'uegVzotHOvMeJ2fmHVQt', title: 'Center for Educational Documentation', labelEn: 'Start your evaluation application', url: 'https://apply.cedevaluations.com/product/application-form/' },
  { id: 'NZf1fVhk0LQJiJI9kpWL', title: 'Bunker Hill Community College', labelEn: 'Apply now', url: 'https://www.bhcc.edu/futurestudents/applynow/' },
  { id: '7JJfDHjpcnpksXd4WeCi', title: 'East Boston Head Start', labelEn: 'Fill out Head Start pre-registration', url: 'https://bostonabcd.org/wp-content/themes/abcd2016/head-start-pre-registration/' },
  { id: 'mHFOMRnEplWcwOCalTKf', title: 'East Boston ABCD Clothing & Essentials', labelEn: 'East Boston office hours & contact', url: 'https://bostonabcd.org/location/east-boston/' },
  { id: 'eFM0C58XW3ggLkz3wtXM', title: 'The Home for Little Wanderers – Family Resource Centers', labelEn: 'Request help from The Home', url: 'https://www.thehome.org/get-help/' },
  { id: 'esQ9KOR0Bicmf6eqLF8o', title: 'EBNHC Women, Infants & Children (WIC)', labelEn: 'Apply for WIC online', url: 'https://www.mass.gov/forms/apply-for-wic-online' },
  { id: 'rhimw0Eete9pY9qKwbOf', title: 'NeighborHealth (formerly East Boston Neighborhood Health Center)', labelEn: 'Become a new patient', url: 'https://www.neighborhealth.com/en/patients-and-visitors/new-patients/' },
  { id: '7CsAmPepfWdAFnYUL5XL', title: '988 Suicide & Crisis Lifeline', labelEn: 'Chat now for crisis support', url: 'https://chat.988lifeline.org/' },
  { id: 'N71pr8wPfU2aCNHlAcnT', title: 'Health Care For All Massachusetts', labelEn: 'Call the free HelpLine', url: 'https://hcfama.org/hcfas-helpline/' },
  { id: 'AFJD1xzk8OBGa5KWD784', title: 'Massachusetts HiSET', labelEn: 'MA HiSET requirements & registration info', url: 'https://hiset.org/massachusetts/' },
  { id: 'lTmhiEkakugMzF3ENoeZ', title: 'Project Bread FoodSource Hotline', labelEn: 'Call or text the FoodSource Hotline', url: 'https://projectbread.org/foodsource-hotline' },
  { id: 'GYzJeniWH0opHwWchmUw', title: 'Eastie Farm', labelEn: 'Get free food & distribution info', url: 'https://eastiefarm.com/food/' },
  { id: 'fjkODcHh2e36UWlTkCpD', title: 'Central Community Church (Food Pantry)', labelEn: 'Food pantry hours & details', url: 'https://www.bostonccc.org/more-about-the-food-pantry.html' },
  { id: 'n0gKQbe1gvueQfkDaWdU', title: 'Central Community Church (Clothing)', labelEn: 'See clothing pantry hours', url: 'https://www.bostonccc.org/ministries.html' },
];

const ES_LABELS_PATH = '/private/tmp/claude-501/-Users-marlanacreed-Downloads-Projects-advisor-bulletin/59caf936-5ac0-4f33-955f-70373af91a90/scratchpad/es-labels.json';
const ES_LABELS = JSON.parse(readFileSync(ES_LABELS_PATH, 'utf8'));

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

  const missing = ENTRIES.filter((e) => !ES_LABELS[e.labelEn]);
  if (missing.length) {
    console.error('Missing ES translation for:', missing.map((m) => m.labelEn));
    process.exit(1);
  }

  if (!args.confirm) {
    for (const e of ENTRIES) {
      console.log(`[dry-run] ${e.title}`);
      console.log(`  EN: "${e.labelEn}"`);
      console.log(`  ES: "${ES_LABELS[e.labelEn]}"`);
    }
    console.log(`\n${ENTRIES.length} labelEs patches ready — rerun with --confirm to write.`);
    return;
  }

  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();

  for (const e of ENTRIES) {
    const ref = db.collection(COLLECTION).doc(e.id);
    const oldEntry = { labelEn: e.labelEn, url: e.url };
    const newEntry = { labelEn: e.labelEn, url: e.url, labelEs: ES_LABELS[e.labelEn] };

    await ref.update({ actionLinks: admin.firestore.FieldValue.arrayRemove(oldEntry) });
    await ref.update({ actionLinks: admin.firestore.FieldValue.arrayUnion(newEntry) });
    console.log(`✓ ${e.title} → "${newEntry.labelEs}"`);
  }

  console.log(`\nPatched labelEs on ${ENTRIES.length} actionLinks.`);
}

main().catch((error) => {
  console.error('Patch failed:', error.message || error);
  process.exit(1);
});
