#!/usr/bin/env node
/**
 * One-time / batch import of curated resource rows from CSV into Firestore.
 *
 * Usage:
 *   node scripts/import-resources.mjs path/to/export.csv [--dry-run]
 *
 * Auth (pick one):
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
 *   --credentials=./service-account.json
 *   (fallback) prompts for admin@ebhcs.org password via client SDK
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const MAX_CHIPS = 6;

const TAB_CATEGORY_DEFAULTS = {
  'basic/misc. needs': 'food',
  'basic/misc needs': 'food',
  housing: 'housing',
  'workforce/training': 'jobs',
  workforce: 'jobs',
  education: 'college',
  'health & wellness': 'health',
  health: 'health',
  'immigration/legal': 'immigration',
  immigration: 'immigration',
  legal: 'legal-aid',
};

const CHIP_ALIASES = new Map([
  ['food stamp/snap', 'SNAP Help'],
  ['food stamps', 'SNAP Help'],
  ['snap', 'SNAP Help'],
  ['snap assistance', 'SNAP Help'],
  ['snap help', 'SNAP Help'],
  ['health insurance help', 'Health Insurance Help'],
  ['community service/immigration', 'Immigration Help'],
  ['immigration consultation', 'Immigration Help'],
  ['citizenship assistance', 'Citizenship Help'],
  ['grocery bags', 'Grocery Bags'],
  ['food pantry', 'Food Pantry'],
  ['free diapers & wipes', 'Free Diapers'],
  ['free diapers and wipes', 'Free Diapers'],
  ['housing advocacy', 'Housing Help'],
  ['housing support', 'Housing Help'],
  ['legal assistance', 'Legal Help'],
  ['legal support', 'Legal Help'],
  ['career center and language', 'Job Training'],
  ['tax prep', 'Tax Help'],
  ['vita', 'Tax Help'],
  ['free tax prep', 'Tax Help'],
]);

const VALID_CATEGORIES = new Set([
  'immigration', 'jobs', 'housing', 'health', 'food', 'family',
  'hse', 'college', 'legal-aid', 'money',
]);

const CATEGORY_ICONS = {
  immigration: 'shield',
  jobs: 'briefcase',
  housing: 'home',
  health: 'heart',
  'legal-aid': 'scale',
};

function prompt(question, { hidden = false } = {}) {
  return new Promise((resolvePrompt) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    if (hidden) {
      rl.stdoutMuted = true;
      rl._writeToOutput = (text) => {
        rl.output.write(rl.stdoutMuted ? '*' : text);
      };
      rl.question(question, (answer) => {
        stdout.write('\n');
        rl.close();
        resolvePrompt(answer);
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolvePrompt(answer);
      });
    }
  });
}

function parseArgs(argv) {
  const args = { dryRun: false, credentials: null, files: [] };
  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    else if (!arg.startsWith('-')) args.files.push(arg);
  }
  return args;
}

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

  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

function splitList(value) {
  if (!value) return [];
  return value.split(/[;,]/).map((part) => part.trim()).filter(Boolean);
}

function normalizeOrgName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizeChip(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  const alias = CHIP_ALIASES.get(trimmed.toLowerCase());
  if (alias) return alias;

  const withoutSchedule = trimmed
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$/i, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm).*$/i, '')
    .trim();

  return withoutSchedule || trimmed;
}

function resolveCategory(row) {
  const override = (row.resourceCategory || '').trim().toLowerCase();
  if (override && VALID_CATEGORIES.has(override)) return override;

  const tabKey = (row.sheetTab || row.sourceName || '').trim().toLowerCase();
  const fromTab = TAB_CATEGORY_DEFAULTS[tabKey];
  if (fromTab) return fromTab;

  throw new Error(`Unknown category for source "${row.sheetTab || row.sourceName}" — set resourceCategory on row for org "${row.orgName}"`);
}

function normalizeUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// CSV "description" cells are written as
//   "English summary. Español: Resumen en español."
// We split them so the English half lands in `description` and the Spanish
// half lands in `summaryEs`. If the delimiter is missing, English absorbs the
// whole cell and Spanish stays blank.
function splitBilingualDescription(raw) {
  const text = String(raw || '').trim();
  if (!text) return { en: '', es: '' };
  const match = text.match(/\bEspañol\s*[:\-—]\s*/i);
  if (!match) return { en: text, es: '' };
  const en = text.slice(0, match.index).trim().replace(/[\s,;:.\-—]+$/, '');
  const es = text.slice(match.index + match[0].length).trim();
  return { en, es };
}

function mergeResources(map, row) {
  const orgName = (row.orgName || '').trim();
  const category = resolveCategory(row);
  const key = `${normalizeOrgName(orgName)}::${category}`;

  const chips = splitList(row.serviceChips).map(normalizeChip).filter(Boolean);
  const url = normalizeUrl(row.url);
  const address = (row.address || '').trim();
  const phone = (row.phone || '').trim();
  const hours = (row.hours || '').trim();
  const { en: description, es: summaryEs } = splitBilingualDescription(row.description);
  const advisorName = (row.advisorName || '').trim() || 'Import';

  if (!orgName) throw new Error('Row missing orgName');
  if (!chips.length && !description) {
    throw new Error(`Row for "${orgName}" needs serviceChips or description`);
  }
  if (!url && !address && !phone) {
    throw new Error(`Row for "${orgName}" needs url, address, or phone`);
  }

  const existing = map.get(key);
  if (!existing) {
    map.set(key, {
      orgName,
      resourceCategory: category,
      services: [...new Set(chips)].slice(0, MAX_CHIPS),
      url,
      address,
      phone,
      hours,
      description,
      summaryEs,
      advisorName,
      sourceRows: 1,
      resourceOrder: row.resourceOrder || '',
    });
    return;
  }

  existing.sourceRows += 1;
  const mergedChips = [...new Set([...existing.services, ...chips])].slice(0, MAX_CHIPS);
  existing.services = mergedChips;
  if (!existing.url && url) existing.url = url;
  if (!existing.address && address) existing.address = address;
  if (!existing.phone && phone) existing.phone = phone;
  if (!existing.hours && hours) existing.hours = hours;
  if (description) {
    existing.description = existing.description
      ? `${existing.description}\n\n${description}`
      : description;
  }
  if (summaryEs) {
    existing.summaryEs = existing.summaryEs
      ? `${existing.summaryEs}\n\n${summaryEs}`
      : summaryEs;
  }
}

function buildFirestoreDoc(resource) {
  const services = resource.services.slice(0, MAX_CHIPS);
  const url = resource.url || '';
  return {
    type: 'resource',
    title: resource.orgName,
    titleEn: resource.orgName,
    titleEs: resource.orgName,
    category: 'resource',
    resourceCategory: resource.resourceCategory,
    resourceIcon: CATEGORY_ICONS[resource.resourceCategory] || 'globe',
    resourceLogo: null,
    url,
    eventLink: url,
    description: resource.description || '',
    summaryEs: resource.summaryEs || '',
    highlights: services.join(', '),
    services,
    serviceChips: services,
    advisorName: resource.advisorName,
    postedBy: 'admin',
    address: resource.address || '',
    phone: resource.phone || '',
    phoneMode: 'call',
    hours: resource.hours || '',
    isActive: true,
    isPublished: true,
    isPinned: false,
    resourceOrder: resource.resourceOrder !== undefined && String(resource.resourceOrder).trim() !== '' ? Number(resource.resourceOrder) : null,
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
    importSource: 'csv-import',
  };
}

async function initAdminDb(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    return null;
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  return admin.default.firestore();
}

async function initClientDb() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
    authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
    projectId: PROJECT_ID,
    storageBucket: 'ebhcs-bulletin-uploads-us',
    messagingSenderId: '556649154585',
    appId: '1:556649154585:web:3a3f49d2056aa507088288',
  };

  const password = await prompt('Password for admin@ebhcs.org: ', { hidden: true });
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, 'admin@ebhcs.org', password);
  console.log('Signed in as admin@ebhcs.org (client SDK)');
  return getFirestore(app);
}

async function writeResources(db, resources, { dryRun, useAdmin }) {
  let written = 0;
  let adminModule = null;
  if (useAdmin) {
    adminModule = (await import('firebase-admin')).default;
  }

  for (const resource of resources) {
    const doc = buildFirestoreDoc(resource);
    if (dryRun) {
      const enPreview = doc.description ? `${doc.description.slice(0, 60)}${doc.description.length > 60 ? '…' : ''}` : '(no description)';
      const esPreview = doc.summaryEs ? `${doc.summaryEs.slice(0, 60)}${doc.summaryEs.length > 60 ? '…' : ''}` : '(no summaryEs)';
      console.log(`[dry-run] ${doc.titleEn} (${doc.resourceCategory})`);
      console.log(`           chips: ${doc.services.join(', ')}`);
      console.log(`           hours: ${doc.hours || '(none)'}`);
      console.log(`           EN: ${enPreview}`);
      console.log(`           ES: ${esPreview}`);
      written += 1;
      continue;
    }

    if (useAdmin) {
      const ref = await db.collection(COLLECTION).add({
        ...doc,
        datePosted: adminModule.firestore.FieldValue.serverTimestamp(),
        createdAt: adminModule.firestore.FieldValue.serverTimestamp(),
        updatedAt: adminModule.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Wrote ${doc.titleEn} → ${ref.id}`);
    } else {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const ref = await addDoc(collection(db, COLLECTION), {
        ...doc,
        datePosted: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`Wrote ${doc.titleEn} → ${ref.id}`);
    }
    written += 1;
  }
  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.files.length) {
    console.error('Usage: node scripts/import-resources.mjs <csv-file> [--dry-run] [--credentials=path]');
    process.exit(1);
  }

  const csvPath = resolve(args.files[0]);
  const csvText = readFileSync(csvPath, 'utf8');
  const records = parseCsv(csvText);

  const merged = new Map();
  const skipped = [];
  const errors = [];

  for (const row of records) {
    if ((row.include || '').trim().toUpperCase() !== 'Y') {
      skipped.push(row.orgName || '(blank org)');
      continue;
    }
    try {
      mergeResources(merged, row);
    } catch (error) {
      errors.push(error.message);
    }
  }

  const resources = [...merged.values()];
  console.log(`\nFile: ${basename(csvPath)}`);
  console.log(`Rows marked include=Y: ${records.filter((r) => (r.include || '').trim().toUpperCase() === 'Y').length}`);
  console.log(`Skipped (include≠Y): ${skipped.length}`);
  console.log(`Merged resources: ${resources.length}`);
  if (errors.length) {
    console.error('\nRow errors:');
    errors.forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  if (!resources.length) {
    console.log('Nothing to import.');
    process.exit(0);
  }

  if (args.dryRun) {
    await writeResources(null, resources, { dryRun: true });
    console.log(`\nDry run complete — ${resources.length} resource(s) ready to import (all unpublished).`);
    console.log('Review in Advisor Portal → My Posts → publish by category when ready.');
    process.exit(0);
  }

  const adminDb = await initAdminDb(args.credentials);
  if (adminDb) {
    await writeResources(adminDb, resources, { dryRun: false, useAdmin: true });
  } else {
    console.log('No service account found — using client SDK auth.');
    const clientDb = await initClientDb();
    await writeResources(clientDb, resources, { dryRun: false, useAdmin: false });
  }

  console.log(`\nImport complete — ${resources.length} unpublished resource(s) written.`);
  console.log('Next: Advisor Portal → My Posts → review chips/contact → publish by category.');
}

main().catch((error) => {
  console.error('Import failed:', error.message || error);
  process.exit(1);
});
