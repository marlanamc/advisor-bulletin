#!/usr/bin/env node
/**
 * Applies the August 30, 2026 live resource-link corrections found while
 * preparing the advisor presentation.
 *
 * Usage:
 *   node scripts/fix-resource-links-2026-08-30.mjs --credentials=service-account.json
 *   node scripts/fix-resource-links-2026-08-30.mjs --credentials=service-account.json --confirm
 */

import { readFileSync, existsSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const UPDATES = [
  {
    id: '41UtfHEQqtsi4tMcD29o',
    title: 'MA State Public Housing',
    url: 'https://www.mass.gov/orgs/public-housing-programs',
  },
  {
    id: '7JJfDHjpcnpksXd4WeCi',
    title: 'East Boston Head Start',
    url: 'https://bostonabcd.org/location/east-boston-head-start/',
    replaceActionLinks: [
      {
        labelEn: 'Fill out Head Start pre-registration',
        labelEs: 'Complete la preinscripción de Head Start',
        url: 'https://bostonabcd.org/head-start-pre-registration/',
      },
    ],
  },
  {
    id: 'kY1Qv7hP5P3FLP2U09hW',
    title: 'Asian American Civic Association (AACA)',
    url: 'https://www.aaca-boston.org/',
  },
  {
    id: 'lTmhiEkakugMzF3ENoeZ',
    title: 'Project Bread FoodSource Hotline',
    url: 'https://projectbread.org/get-help',
  },
  {
    id: 'vlcPsxj2UaqtQJv6DIjB',
    title: 'Consulate General of Peru — Boston',
    url: 'https://www.consulado.pe/es/boston/paginas/inicio.aspx',
  },
  {
    id: 'yZm4YeBksjz9am97cMn2',
    title: 'Salvation Army of Chelsea/East Boston',
    url: 'https://easternusa.salvationarmy.org/massachusetts/chelsea/',
  },
  {
    id: 'JnjjgXSrgyo7a1OmHOgl',
    title: 'Consulate General of Guatemala — Providence, RI',
    url: 'https://www.minex.gob.gt/detalle_sede/87',
  },
  {
    id: 'RoebAitHXGz2tvLx4OKw',
    title: 'Consulate General of Brazil — Boston',
    url: 'https://www.gov.br/mre/pt-br/consulado-boston/informacoes-gerais',
  },
  {
    id: 'nnaMculsnndTpOWtnqF6',
    title: 'MassLINKS Free Online Classes',
    url: 'https://www.masslinks.org/',
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

function mergeActionLinks(existing, replacements) {
  if (!replacements) return existing;
  const byLabel = new Map(replacements.map((link) => [link.labelEn, link]));
  const next = existing.map((link) => byLabel.get(link.labelEn) || link);
  for (const replacement of replacements) {
    if (!next.some((link) => link.labelEn === replacement.labelEn)) next.push(replacement);
  }
  return next;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const admin = await initAdmin(args.credentials);
  const db = admin.firestore();

  for (const update of UPDATES) {
    const ref = db.collection(COLLECTION).doc(update.id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`${update.title} (${update.id}) not found`);

    const current = snap.data();
    const patch = {};
    if (update.url && current.url !== update.url) {
      patch.url = update.url;
      patch.eventLink = update.url;
    }
    if (update.replaceActionLinks) {
      const actionLinks = mergeActionLinks(Array.isArray(current.actionLinks) ? current.actionLinks : [], update.replaceActionLinks);
      if (JSON.stringify(actionLinks) !== JSON.stringify(current.actionLinks || [])) patch.actionLinks = actionLinks;
    }

    if (!Object.keys(patch).length) {
      console.log(`${update.title}: already current`);
      continue;
    }

    console.log(`${args.confirm ? 'Updating' : '[dry-run]'} ${update.title}`);
    for (const [field, value] of Object.entries(patch)) {
      console.log(`  ${field}: ${JSON.stringify(current[field] || '')} -> ${JSON.stringify(value)}`);
    }

    if (args.confirm) {
      await ref.update({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
}

main().catch((error) => {
  console.error('Fix failed:', error.message || error);
  process.exit(1);
});
