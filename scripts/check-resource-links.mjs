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
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 EBHCS-LinkCheck/1.0',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};
const BOT_CHALLENGE_HOSTS = new Set(['validate.perfdrive.com']);

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

const STATUS_ACTIONS = {
  broken: 'Replace URL, archive the card, or confirm the resource should stay live.',
  'warn-forbidden': 'Open in a browser; if the page works, no card edit is needed.',
  'warn-rate-limited': 'Open in a browser; if the page works, no card edit is needed.',
  'warn-server-error': 'Recheck in a browser; update the card only if the page is still down.',
  'warn-unreachable': 'Open in a browser; if it works, treat this as automation blocking.',
  'warn-bot-challenge': 'Open in a browser; if the official page works, no card edit is needed.',
};

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
      headers: REQUEST_HEADERS,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function checkOne(url) {
  if (!url) return { url, status: 'skipped', reason: 'empty url' };
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'mailto:') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.pathname)
        ? { url, status: 'ok', protocol: 'mailto' }
        : { url, status: 'broken', reason: 'invalid email address' };
    }
    if (parsed.protocol === 'tel:') {
      return /^[+()\d\s.-]{3,}$/.test(parsed.pathname)
        ? { url, status: 'ok', protocol: 'tel' }
        : { url, status: 'broken', reason: 'invalid phone number' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { url, status: 'broken', reason: `unsupported protocol: ${parsed.protocol}` };
    }

    let res;
    try {
      res = await fetchWithTimeout(url, 'HEAD');
      if (res.status === 405 || res.status === 501) {
        res = await fetchWithTimeout(url, 'GET');
      }
    } catch {
      res = await fetchWithTimeout(url, 'GET');
    }

    const finalHost = normalizeHost(new URL(res.url || url).hostname);
    const originalHost = normalizeHost(parsed.hostname);
    const domainChanged = finalHost !== originalHost;

    if (BOT_CHALLENGE_HOSTS.has(finalHost)) {
      return { url, status: 'warn-bot-challenge', httpStatus: res.status, reason: `Automation was redirected to bot challenge host ${finalHost}.` };
    }

    if (res.status >= 200 && res.status < 400) {
      return { url, status: 'ok', httpStatus: res.status, domainChanged, finalUrl: domainChanged ? res.url : undefined };
    }
    if (res.status === 403) {
      return { url, status: 'warn-forbidden', httpStatus: res.status, reason: 'Often a bot-block (e.g. mass.gov), not necessarily dead — verify manually.' };
    }
    if (res.status === 429) {
      return { url, status: 'warn-rate-limited', httpStatus: res.status, reason: 'Rate-limited by the site; verify manually if it persists.' };
    }
    if (res.status >= 500 && res.status < 600) {
      return { url, status: 'warn-server-error', httpStatus: res.status, reason: 'Remote site returned a server error; verify manually if it persists.' };
    }
    return { url, status: 'broken', httpStatus: res.status };
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'timeout' : (error.message || String(error));
    return { url, status: 'warn-unreachable', reason: `${reason}; verify manually if it persists.` };
  }
}

function normalizeHost(hostname) {
  return String(hostname || '').replace(/^www\./i, '').toLowerCase();
}

function decorateResult(result) {
  const issueKey = `${result.id || 'unknown'}|${result.kind || 'unknown'}|${result.url || ''}`;
  return {
    ...result,
    issueKey,
    advisorAction: STATUS_ACTIONS[result.status] || '',
  };
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
      isActive: d.isActive !== false,
      isPublished: d.isPublished !== false,
    };
  }).filter((resource) => resource.isActive && resource.isPublished);

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
    return decorateResult({ ...c, ...outcome });
  });

  const broken = results.filter((r) => r.status === 'broken');
  const warned = results.filter((r) => r.status && r.status.startsWith('warn-'));
  const moved = results.filter((r) => r.status === 'ok' && r.domainChanged);
  const ok = results.filter((r) => r.status === 'ok' && !r.domainChanged);

  const report = {
    checkedAt: new Date().toISOString(),
    totals: { checked: results.length, ok: ok.length, movedDomain: moved.length, needsManualCheck: warned.length, broken: broken.length },
    broken,
    movedDomain: moved,
    needsManualCheck: warned,
    priceReminders,
  };

  console.log(`\nDone: ${ok.length} ok, ${moved.length} domain-moved (still resolving), ${warned.length} needs manual check, ${broken.length} broken.\n`);
  for (const b of broken) console.log(`BROKEN: [${b.resource}] ${b.kind} → ${b.url} (${b.reason || b.httpStatus})`);
  for (const w of warned) console.log(`CHECK: [${w.resource}] ${w.kind} → ${w.url} (${w.reason || w.httpStatus})`);
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
