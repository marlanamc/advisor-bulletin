#!/usr/bin/env node
/**
 * Data-integrity check for the resource directory.
 *
 * A directory of community services rots quietly: an organisation moves, a
 * pantry changes its day, a site restructures its URLs, and nothing in the app
 * notices. The August 2026 audit found several links that had been dead long
 * enough that nobody could say when they broke.
 *
 * This reports on the CSV so that decay is visible before students hit it.
 * It exits non-zero only for problems that would actually break a card, so it
 * is safe to run in prebuild; staleness is reported as a warning.
 *
 * Usage:
 *   node scripts/check-resource-freshness.mjs
 *   node scripts/check-resource-freshness.mjs --stale-months=18
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSV_PATH = resolve('data/resource-import-template.csv');
const DEFAULT_STALE_MONTHS = 12;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); if (row.some((x) => x.trim() !== '')) rows.push(row); }
  return rows;
}

function monthsSince(yearMonth, now) {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!match) return null;
  const then = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

const staleArg = process.argv.find((a) => a.startsWith('--stale-months='));
const staleMonths = staleArg ? Number(staleArg.split('=')[1]) : DEFAULT_STALE_MONTHS;
const now = new Date();

const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
const headers = rows[0];
const idx = Object.fromEntries(headers.map((h, i) => [h, i]));

const errors = [];
const warnings = [];
const seen = new Map();

for (const row of rows.slice(1)) {
  if ((row[idx.include] || '').trim().toUpperCase() !== 'Y') continue;

  const org = (row[idx.orgName] || '').trim();
  const category = (row[idx.resourceCategory] || '').trim();
  const key = `${org}::${category}`;
  const url = (row[idx.url] || '').trim();
  const address = (row[idx.address] || '').trim();
  const phone = (row[idx.phone] || '').trim();
  const chips = (row[idx.serviceChips] || '').trim();
  const description = (row[idx.description] || '').trim();

  // Breaks a card outright.
  if (!org) errors.push('Row with no orgName');
  if (!category) errors.push(`${key}: missing resourceCategory`);
  if (!url && !address && !phone) errors.push(`${key}: no url, address or phone — students cannot act on it`);
  if (!chips && !description) errors.push(`${key}: no serviceChips and no description`);
  if (url && !/^https?:\/\//i.test(url)) errors.push(`${key}: url is missing a scheme (${url})`);
  if (url && /^http:\/\//i.test(url)) warnings.push(`${key}: link is plain http, not https`);

  if (seen.has(key)) errors.push(`${key}: duplicate row (also at row ${seen.get(key)})`);
  else seen.set(key, rows.indexOf(row) + 1);

  // Decay signals.
  const verified = (row[idx.lastVerified] || '').trim();
  if (!verified) {
    warnings.push(`${key}: never verified`);
  } else {
    const age = monthsSince(verified, now);
    if (age === null) warnings.push(`${key}: lastVerified "${verified}" is not YYYY-MM`);
    else if (age >= staleMonths) warnings.push(`${key}: last verified ${verified} (${age} months ago)`);
  }

  const status = (row[idx.verificationStatus] || '').trim();
  if (status.startsWith('needs-review')) warnings.push(`${key}: still marked ${status}`);
}

const total = rows.length - 1;
console.log(`Checked ${total} resource row(s) in ${CSV_PATH}\n`);

if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach((w) => console.log(`  ! ${w}`));
  console.log('');
}

if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach((e) => console.error(`  x ${e}`));
  process.exit(1);
}

console.log(`OK: no blocking problems. ${warnings.length} warning(s).`);
