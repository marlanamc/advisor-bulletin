#!/usr/bin/env node
/**
 * Applies the August 2026 "Find Help" reorder audit's recommended
 * resourceOrder values.
 *
 * 2026-08-11 update: quota reset, so doc IDs were re-resolved against a live
 * scripts/dump-live-resources.mjs pull (66 resources) rather than trusting
 * the Jul 9 snapshot blind. That surfaced two things worth knowing:
 *   - Agencia ALPHA's doc was deleted and recreated since Jul 9 — the old
 *     hardcoded id (gYOXKXHLeyVKwAKryXfA) 404s now; fixed below to the
 *     current id.
 *   - "Family Preparedness" (immigration) exists live with no audit
 *     coverage at all — not in the Jul 9 snapshot or the Aug 8 additions
 *     CSV. No recommended rank exists for it; left untouched here.
 * 14 of the original 16 PENDING_LOOKUP resources now have known ids and
 * were folded into RESOURCE_ORDER below. The remaining 2 (a Chelsea pop-up
 * clinic and a "Summer 2026" class, both already flagged as likely expired)
 * are no longer live at all — nothing to order.
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
  { id: '4ONjF1DgFQ0pG2eCh9l5', title: 'MassHire Metro North Career Center (Chelsea)', order: 1 },
  { id: 'pkizk5s5rUJ4ZVAah624', title: 'JVS Boston', order: 2 },
  { id: 'kY1Qv7hP5P3FLP2U09hW', title: 'Asian American Civic Association (AACA)', order: 3 },
  { id: 'ipBCBYM0hh7s6ZW66wOf', title: 'BEST Hospitality Training', order: 4 },
  { id: 'zWD5bDlxTgckNSQCX55X', title: 'MA Department of Unemployment Assistance', order: 5 },

  // Housing
  { id: 'e8ZdCGj1ws7PIWJQpfLJ', title: 'Neighborhood of Affordable Housing (NOAH)', order: 1 },
  { id: 'rSncRxrz2yhcy4Rs4zfO', title: 'Metro Housing Boston', order: 2 },
  { id: '5v2i2ZzQJ6dGva2bBQw9', title: 'RAFT (Residential Assistance for Families in Transition)', order: 3 },
  { id: 'XrFRTpcTXKObO9GbwtGj', title: 'East Boston Adult Family Shelter (formerly Crossroads Family Center)', order: 4 },
  { id: 'kw2XSXtjJITiQLwFtFGn', title: "Mayor's Office of Housing – Office of Housing Stability", order: 5 },
  { id: 'yHcQps4ebiQYp1LCQ3ho', title: 'City Life/Vida Urbana', order: 6 },
  { id: '20nEfN1q1rjMstkDtizM', title: 'Maverick Landing Community Services', order: 7 },
  { id: '41UtfHEQqtsi4tMcD29o', title: 'MA State Public Housing', order: 8 },

  // Health
  { id: 'rhimw0Eete9pY9qKwbOf', title: 'NeighborHealth (formerly East Boston Neighborhood Health Center)', order: 1 },
  { id: '7CsAmPepfWdAFnYUL5XL', title: '988 Suicide & Crisis Lifeline', order: 2 },
  { id: 'FGVi15mOY87toPVemNgK', title: 'Massachusetts Behavioral Health Help Line', order: 3 },
  { id: 'zLiCrfxgtMGs80hPA6Ey', title: 'SafeLink Domestic Violence Hotline', order: 4 },
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
  { id: 'h0qazDzNhQd0uaPFjAMJ', title: 'Boston Public Library - East Boston', order: 3 },
  { id: '6JdhXrCbfJM4dbc6lfJu', title: 'Ollie Diaper Depot', order: 4 },
  { id: 'eFM0C58XW3ggLkz3wtXM', title: 'The Home for Little Wanderers – Family Resource Centers', order: 5 },
  { id: 'm5is5IAec1EYNmsJ4O0X', title: 'Family Nurturing Center', order: 6 },
  { id: 'yZm4YeBksjz9am97cMn2', title: 'Salvation Army of Chelsea/East Boston', order: 7 },
  { id: 'mHFOMRnEplWcwOCalTKf', title: 'East Boston ABCD Clothing & Essentials', order: 8 },
  { id: 'n0gKQbe1gvueQfkDaWdU', title: 'Central Community Church (Clothing)', order: 9 },

  // HSE
  { id: 'v1y3hzvIONtX9BLeJ188', title: 'Learn About the HSE Test (DESE)', order: 1 },
  { id: 'nnaMculsnndTpOWtnqF6', title: 'MassLINKS Free Online Classes', order: 2 },
  { id: 'AFJD1xzk8OBGa5KWD784', title: 'Massachusetts HiSET', order: 3 },

  // College
  { id: 'NZf1fVhk0LQJiJI9kpWL', title: 'Bunker Hill Community College', order: 1 },
  { id: 'Wr5OxhlYHI2AVqLSbjDa', title: 'Help Paying for College (OSFA)', order: 2 },
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
  { id: 'NUCy4trgIRW9XKpXg482', title: 'MBTA Reduced Fare (Income-Eligible)', order: 4 },

  // Immigration
  // NOTE: 'Agencia ALPHA' doc was recreated after the Jul 9 snapshot the audit
  // used — old id gYOXKXHLeyVKwAKryXfA no longer exists live, replaced below
  // with the current id (confirmed via scripts/dump-live-resources.mjs).
  { id: 'ftfx4zJIL11IfQjhSKIo', title: 'East Boston Community Council', order: 1 },
  { id: 'Z6nHAJNi8iGKv2TsYreE', title: 'Agencia ALPHA', order: 2 },
  { id: 'c1CzwnEaMjgyo6VVUB2k', title: 'Rian Immigrant Center', order: 3 },
  { id: 'HgjucUkz7dxNFnAPqvKS', title: 'La Colaborativa', order: 4 },
  { id: '2ARioOYAVid5tF3Jw7PI', title: 'Project Citizenship', order: 5 },
  { id: 'oFe0iexVA1riSpg1zG2D', title: 'MIRA Coalition', order: 6 },
  { id: 'e7aGhmTIECOBwS3KlAjp', title: 'La Comunidad', order: 7 },
  { id: 'JQwr3MbZChtEjReg1Qyb', title: "Mayor's Office for Immigrant Advancement (MOIA)", order: 8 },
  { id: 'mPDgv7Ap1o8vhzYlF5Nh', title: 'Permission to Share Your Case Info (ICE/DHS)', order: 9 },

  // General
  { id: 'eWEm0kaRoE5fLCgUEGB4', title: 'Mass 211', order: 1 },
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

// Resources the audit flagged that still need a human decision rather than
// a mechanical resourceOrder write. Not resolved by this script.
const PENDING_LOOKUP = [
  // No longer live as of the 2026-08-11 dump — presumably already
  // archived/removed. Nothing to order; listed for the record only.
  { category: 'health', title: 'Community Care Van Clinics in Chelsea', recommend: 'was: verify still running first — now gone from live data' },
  { category: 'health', title: 'EBSC Annual Community Baby Shower', recommend: 'was: likely expired — now gone from live data' },
  { category: 'immigration', title: 'Free Immigration Consultation', recommend: 'was: check duplicate of MOIA — now gone from live data' },
  { category: 'immigration', title: 'Citizenship Exam Prep Online Class — Summer 2026', recommend: 'was: likely expired — now gone from live data' },
  // Live but never covered by the Aug 2026 audit — no recommended rank exists.
  { category: 'college', title: 'Early Childhood Educator Scholarship', recommend: 'not live as of 2026-08-11 dump either — check if intentionally unpublished' },
  { category: 'immigration', title: 'Family Preparedness', recommend: 'NEW, not in audit at all — needs a human call on where it ranks' },
];

main().catch((error) => {
  console.error('Apply failed:', error.message || error);
  process.exit(1);
});
