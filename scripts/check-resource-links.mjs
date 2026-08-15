#!/usr/bin/env node
/**
 * Weekly link-liveness checker. Reads all `type: 'resource'` bulletins
 * straight from Firestore (one query — see the staleness lesson in
 * DEPLOYMENT.md) and issues a real HTTP request against each resource's
 * main `url` plus every `actionLinks[].url`, flagging anything that isn't
 * reachable. Deliberately does NOT judge whether a *better* page exists
 * (that needs human/AI reading of page content) — this only checks
 * "does this URL still resolve to something."
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-resource-links.mjs [--json=out.json] [--concurrency=5]
 *
 * Exit code is always 0 — this script reports, it doesn't fail the build.
 * The caller (CI workflow) decides what to do with the JSON output.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const TIMEOUT_MS = 10_000;

// Resources whose description states a dollar figure that the org sets
// independently and can change without breaking any link (so the link
// check above wouldn't catch it). Listed here so the weekly report
// surfaces a manual recheck reminder instead of the price silently going
// stale. Add an entry whenever a description is written with a specific
// cost — see feedback_chip_writing_style memory on why costs are kept
// rather than omitted.
const PRICE_CHECK_REMINDERS = [
  { id: 'uegVzotHOvMeJ2fmHVQt', title: 'Center for Educational Documentation', checkUrl: 'https://cedevaluations.com/' },
  { id: '0eVYeSFI5mYzoSfBwGnW', title: 'World Education Services (WES)', checkUrl: 'https://www.wes.org/' },
];

function parseArgs(argv) {
  const args = { json: null, concurrency: 5, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--json=')) args.json = arg.slice('--json='.length);
    else if (arg.startsWith('--concurrency=')) args.concurrency = Number(arg.slice('--concurrency='.length)) || 5;
    else if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
  }
  return args;
}

async function initAdminDb(credentialsPath) {
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
  return admin.default.firestore();
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EBHCS-LinkCheck/1.0)' },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function checkOne(url) {
  if (!url) return { url, status: 'skipped', reason: 'empty url' };
  try {
    let res;
    try {
      res = await fetchWithTimeout(url, 'HEAD');
      if (res.status === 405 || res.status === 501) {
        res = await fetchWithTimeout(url, 'GET');
      }
    } catch {
      res = await fetchWithTimeout(url, 'GET');
    }

    const finalHost = new URL(res.url || url).hostname;
    const originalHost = new URL(url).hostname;
    const domainChanged = finalHost !== originalHost;

    if (res.status >= 200 && res.status < 400) {
      return { url, status: 'ok', httpStatus: res.status, domainChanged, finalUrl: domainChanged ? res.url : undefined };
    }
    if (res.status === 403) {
      return { url, status: 'warn-forbidden', httpStatus: res.status, reason: 'Often a bot-block (e.g. mass.gov), not necessarily dead — verify manually.' };
    }
    return { url, status: 'broken', httpStatus: res.status };
  } catch (error) {
    return { url, status: 'broken', reason: error.name === 'AbortError' ? 'timeout' : (error.message || String(error)) };
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);

  const snapshot = await db.collection(COLLECTION).where('type', '==', 'resource').get();
  const resources = snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.titleEn || d.title || doc.id,
      url: d.url || '',
      actionLinks: Array.isArray(d.actionLinks) ? d.actionLinks : [],
      description: d.description || '',
    };
  });

  const priceReminders = PRICE_CHECK_REMINDERS.map((r) => {
    const match = resources.find((res) => res.id === r.id);
    return { ...r, currentDescription: match ? match.description : '(resource not found — id may have changed)' };
  });

  const checks = [];
  for (const r of resources) {
    checks.push({ resource: r.title, id: r.id, kind: 'main', url: r.url });
    for (const link of r.actionLinks) {
      const linkUrl = link.url || link.pdfUrl || '';
      checks.push({ resource: r.title, id: r.id, kind: `actionLink: ${link.labelEn || ''}`, url: linkUrl });
    }
  }

  console.log(`Checking ${checks.length} links across ${resources.length} resources...`);

  const results = await mapWithConcurrency(checks, args.concurrency, async (c) => {
    const outcome = await checkOne(c.url);
    return { ...c, ...outcome };
  });

  const broken = results.filter((r) => r.status === 'broken');
  const warned = results.filter((r) => r.status === 'warn-forbidden');
  const moved = results.filter((r) => r.status === 'ok' && r.domainChanged);
  const ok = results.filter((r) => r.status === 'ok' && !r.domainChanged);

  const report = {
    checkedAt: new Date().toISOString(),
    totals: { checked: results.length, ok: ok.length, movedDomain: moved.length, forbidden: warned.length, broken: broken.length },
    broken,
    movedDomain: moved,
    forbidden: warned,
    priceReminders,
  };

  console.log(`\nDone: ${ok.length} ok, ${moved.length} domain-moved (still resolving), ${warned.length} forbidden/possible-bot-block, ${broken.length} broken.\n`);
  for (const b of broken) console.log(`BROKEN: [${b.resource}] ${b.kind} → ${b.url} (${b.reason || b.httpStatus})`);
  for (const m of moved) console.log(`MOVED: [${m.resource}] ${m.kind} → ${m.url} now resolves to ${m.finalUrl}`);
  if (priceReminders.length) {
    console.log('\nPrice recheck reminders:');
    for (const p of priceReminders) console.log(`  [${p.title}] verify against ${p.checkUrl}\n    current: ${p.currentDescription}`);
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${args.json}`);
  }
}

main().catch((error) => {
  console.error('Link check failed:', error.message || error);
  process.exit(1);
});
