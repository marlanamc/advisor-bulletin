#!/usr/bin/env node
/**
 * Applies the August 2026 "Find Help" reorder audit's recommended
 * resourceOrder values.
 *
 * Writes are targeted by known Firestore document ID (pulled from
 * public/student-feed-snapshot.json, generated 2026-07-09) so this needs
 * zero Firestore reads — safe to run while the project's daily read quota
 * is exhausted, since reads and writes are billed separately. Same pattern
 * as scripts/apply-audit-links.mjs.
 *
 * The snapshot is otherwise unsafe to audit against (scripts/README.md:
 * "Never audit against the snapshot" — it can be stale by weeks). That
 * warning is about content staleness; it doesn't apply to ID-targeted
 * writes like this one, since a doc ID from Jul 9 is still valid today
 * unless that specific resource was deleted and recreated since.
 *
 * NOT covered here: resources added/edited after the Jul 9 snapshot (the
 * live resource count is 64; only 53 of those have known doc IDs below).
 * Those are listed in PENDING_LOOKUP at the bottom — resolve their doc IDs
 * with scripts/dump-live-resources.mjs (a read) once the quota resets,
 * then move them into RESOURCE_ORDER and rerun.
 *
 * Usage:
 *   node scripts/apply-resource-order-audit.mjs           # dry run (default)
 *   node scripts/apply-resource-order-audit.mjs --confirm # actually write
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const RESOURCE_ORDER = [
  // Job Help
  { id: 'pkizk5s5rUJ4ZVAah624', title: 'JVS Boston', order: 2 },
  { id: 'kY1Qv7hP5P3FLP2U09hW', title: 'Asian American Civic Association (AACA)', order: 3 },
  { id: 'ipBCBYM0hh7s6ZW66wOf', title: 'BEST Hospitality Training', order: 4 },
  { id: 'zWD5bDlxTgckNSQCX55X', title: 'MA Department of Unemployment Assistance', order: 5 },

  // Housing
  { id: 'e8ZdCGj1ws7PIWJQpfLJ', title: 'Neighborhood of Affordable Housing (NOAH)', order: 1 },
  { id: '5v2i2ZzQJ6dGva2bBQw9', title: 'RAFT (Residential Assistance for Families in Transition)', order: 3 },
  { id: 'XrFRTpcTXKObO9GbwtGj', title: 'East Boston Adult Family Shelter (formerly Crossroads Family Center)', order: 4 },
  { id: 'kw2XSXtjJITiQLwFtFGn', title: "Mayor's Office of Housing – Office of Housing Stability", order: 5 },
  { id: 'yHcQps4ebiQYp1LCQ3ho', title: 'City Life/Vida Urbana', order: 6 },
  { id: '20nEfN1q1rjMstkDtizM', title: 'Maverick Landing Community Services', order: 7 },
  { id: '41UtfHEQqtsi4tMcD29o', title: 'MA State Public Housing', order: 8 },

  // Health
  { id: 'rhimw0Eete9pY9qKwbOf', title: 'NeighborHealth (formerly East Boston Neighborhood Health Center)', order: 1 },
  { id: '7CsAmPepfWdAFnYUL5XL', title: '988 Suicide & Crisis Lifeline', order: 2 },
  { id: 'adVC7hL5kgoIwEqrZlTP', title: 'Community Healing Response Network', order: 5 },
  { id: 's5IIOgQvt2YoLXfyJZI9', title: "Mayor's Health Line", order: 6 },
  { id: 'N71pr8wPfU2aCNHlAcnT', title: 'Health Care For All Massachusetts', order: 7 },

  // Food
  { id: 'GYzJeniWH0opHwWchmUw', title: 'Eastie Farm', order: 1 },
  { id: 'pvlMYEM1KKdB4rmS1j0J', title: 'East Boston Soup Kitchen', order: 2 },
  { id: '3Z4kOOvc9CKKrCjKvF5u', title: 'BCYF Paris Street', order: 3 },
  { id: 'fjkODcHh2e36UWlTkCpD', title: 'Central Community Church (Food Pantry)', order: 4 },
  { id: 'rVB5pS7wdbfg2YFq5xnN', title: 'East Boston Adult Family Shelter – Our Daily Bread Pantry (formerly Crossroads Family Center)', order: 5 },
  { id: 'FdXxAGjLxT1AjhqycvTB', title: 'East Boston ABCD Mobile Food Pop-Ups', order: 6 },
  { id: 'lTmhiEkakugMzF3ENoeZ', title: 'Project Bread FoodSource Hotline', order: 7 },
  { id: 'RZM8G22VAVJ4C9ywlksI', title: 'East Boston ABCD (SNAP Assistance)', order: 8 },

  // Family
  { id: 'esQ9KOR0Bicmf6eqLF8o', title: 'EBNHC Women, Infants & Children (WIC)', order: 1 },
  { id: '7JJfDHjpcnpksXd4WeCi', title: 'East Boston Head Start', order: 2 },
  { id: '6JdhXrCbfJM4dbc6lfJu', title: 'Ollie Diaper Depot', order: 4 },
  { id: 'eFM0C58XW3ggLkz3wtXM', title: 'The Home for Little Wanderers – Family Resource Centers', order: 5 },
  { id: 'm5is5IAec1EYNmsJ4O0X', title: 'Family Nurturing Center', order: 6 },
  { id: 'yZm4YeBksjz9am97cMn2', title: 'Salvation Army of Chelsea/East Boston', order: 7 },
  { id: 'mHFOMRnEplWcwOCalTKf', title: 'East Boston ABCD Clothing & Essentials', order: 8 },
  { id: 'n0gKQbe1gvueQfkDaWdU', title: 'Central Community Church (Clothing)', order: 9 },

  // HSE
  { id: 'AFJD1xzk8OBGa5KWD784', title: 'Massachusetts HiSET', order: 3 },

  // College
  { id: 'NZf1fVhk0LQJiJI9kpWL', title: 'Bunker Hill Community College', order: 1 },
  { id: 'OxBuTnTY0jKB5LluTMRy', title: 'Roxbury Community College', order: 3 },
  { id: 'uegVzotHOvMeJ2fmHVQt', title: 'Center for Educational Documentation', order: 4 },
  { id: '0eVYeSFI5mYzoSfBwGnW', title: 'World Education Services (WES)', order: 5 },

  // Legal Aid (audit: no changes, order confirmed as-is)
  { id: 'z8etC01nAXNPcZ0wuHo0', title: 'Greater Boston Legal Services', order: 1 },
  { id: 'aql8YOrvxHJErHNBi0z0', title: 'Lawyers for Civil Rights', order: 2 },
  { id: 'Gpa30JCZ52KT3sTtpgtv', title: 'MassLegalHelp', order: 3 },
  { id: 'd7e0iokDWH8Rg3Rangep', title: 'Mass Legal Resource Finder', order: 4 },
  { id: 'OxkqctNYJZlJkkmH9hKm', title: "Massachusetts Attorney General's Office", order: 5 },

  // Money
  { id: 'xNjwFMQNy9PdEXHOtmtt', title: 'East Boston ABCD APAC', order: 1 },
  { id: 'eQwUy0g8u4c36n5PicxY', title: 'MA Department of Transitional Assistance (DTA)', order: 2 },
  { id: 'JPm9kgAHjf1ltg4QyHKD', title: 'Find Your Funds (Tax Help)', order: 3 },

  // Immigration
  { id: 'ftfx4zJIL11IfQjhSKIo', title: 'East Boston Community Council', order: 1 },
  { id: 'gYOXKXHLeyVKwAKryXfA', title: 'Agencia ALPHA', order: 2 },
  { id: 'HgjucUkz7dxNFnAPqvKS', title: 'La Colaborativa', order: 4 },
  { id: '2ARioOYAVid5tF3Jw7PI', title: 'Project Citizenship', order: 5 },
  { id: 'oFe0iexVA1riSpg1zG2D', title: 'MIRA Coalition', order: 6 },
  { id: 'e7aGhmTIECOBwS3KlAjp', title: 'La Comunidad', order: 7 },
  { id: 'JQwr3MbZChtEjReg1Qyb', title: "Mayor's Office for Immigrant Advancement (MOIA)", order: 8 },
  { id: 'mPDgv7Ap1o8vhzYlF5Nh', title: 'Permission to Share Your Case Info (ICE/DHS)', order: 9 },
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

  for (const u of RESOURCE_ORDER) {
    if (!args.confirm) {
      console.log(`[dry-run] ${u.title} (${u.id}) -> resourceOrder: ${u.order}`);
      continue;
    }

    await db.collection(COLLECTION).doc(u.id).update({ resourceOrder: u.order });
    console.log(`✓ ${u.title} -> ${u.order}`);
  }

  console.log(
    args.confirm
      ? `\nApplied ${RESOURCE_ORDER.length} of the audit's reorder recommendations.`
      : `\n${RESOURCE_ORDER.length} updates ready — rerun with --confirm to write.`
  );

  if (PENDING_LOOKUP.length) {
    console.log(`\n${PENDING_LOOKUP.length} resources from the audit are NOT in this script — no known doc ID yet:`);
    for (const p of PENDING_LOOKUP) console.log(`  - [${p.category}] ${p.title} (recommend: ${p.recommend})`);
    console.log('Resolve doc IDs (a Firestore read) once the daily quota resets, then add them above.');
  }
}

// Resources the audit recommends ranking, added/edited after the Jul 9
// snapshot — no doc ID known without a live Firestore read.
const PENDING_LOOKUP = [
  { category: 'jobs', title: 'MassHire Metro North Career Center', recommend: 1 },
  { category: 'housing', title: 'Metro Housing Boston', recommend: 2 },
  { category: 'health', title: 'MA Behavioral Health Help Line', recommend: 3 },
  { category: 'health', title: 'SafeLink Domestic Violence Hotline', recommend: 4 },
  { category: 'health', title: 'Community Care Van Clinics in Chelsea', recommend: 'verify still running first' },
  { category: 'health', title: 'EBSC Annual Community Baby Shower', recommend: 'likely expired — archive, not reorder' },
  { category: 'family', title: 'Boston Public Library – East Boston', recommend: 3 },
  { category: 'hse', title: 'Learn About the HSE Test (DESE)', recommend: 1 },
  { category: 'hse', title: 'MassLINKS Free Online Classes', recommend: 2 },
  { category: 'college', title: 'Help Paying for College (OSFA)', recommend: 2 },
  { category: 'college', title: 'Early Childhood Educator Scholarship', recommend: 6 },
  { category: 'money', title: 'MBTA Reduced Fare', recommend: 4 },
  { category: 'immigration', title: 'Rian Immigrant Center', recommend: 3 },
  { category: 'immigration', title: 'Free Immigration Consultation', recommend: 'check duplicate of MOIA first' },
  { category: 'immigration', title: 'Citizenship Exam Prep Online Class — Summer 2026', recommend: 'likely expired — archive, not reorder' },
  { category: 'general', title: 'Mass 211', recommend: 1 },
];

main().catch((error) => {
  console.error('Apply failed:', error.message || error);
  process.exit(1);
});
