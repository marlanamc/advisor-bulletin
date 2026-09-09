#!/usr/bin/env node
/**
 * Weekly link-liveness checker. Reads all `type: 'resource'` bulletins
 * straight from Firestore (one query — see the staleness lesson in
 * DEPLOYMENT.md) and issues a real HTTP request against each resource's
 * main `url` plus every `actionLinks[].url`, flagging anything that isn't
 * reachable. Deliberately does NOT judge whether a *better* page exists
 * (that needs human/AI reading of page content) — this only checks
 * "does this URL still resolve to something useful."
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-resource-links.mjs [--json=out.json] [--concurrency=5]
 *
 * Link findings never fail the run — a `broken` link is reported, not thrown.
 * The caller (CI workflow) decides what to do with the JSON output. The script
 * does exit 1 if it cannot do its job at all (missing credentials, Firestore
 * unreachable), because that is a broken check rather than a broken link.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
// Budget for the authoritative GET. Deliberately generous: these are
// underfunded nonprofit and agency sites, and a real page on one of them was
// measured at 8.2s, which made the old 10s ceiling a coin flip.
const TIMEOUT_MS = 20_000;
// HEAD is only a cheap probe, so it gets a short leash. Some hosts never answer
// a HEAD at all (bostonabcd.org hangs past 30s on one path while GET returns
// 200), and waiting the full budget for that is pure dead time.
const HEAD_TIMEOUT_MS = 5_000;
// One retry after a thrown request (timeout/reset). Transient network noise was
// the single biggest source of false `warn-unreachable` entries in the report.
const RETRY_DELAY_MS = 1_000;
// Requests to the same host are serialized with this gap between them. Global
// concurrency alone let every link belonging to one org fire at once, which is
// what produced most of the `warn-rate-limited` bucket.
const MIN_HOST_INTERVAL_MS = 500;
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 EBHCS-LinkCheck/1.0',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};
const BOT_CHALLENGE_HOSTS = new Set(['validate.perfdrive.com']);
// Node is stricter about certificate chains than any browser: it will not chase
// a missing intermediate the way browsers and curl do. Several real resource
// sites (bhcc.edu, consulado.pe) serve an incomplete chain, so Node reports a
// bare "fetch failed" for a page students can open without trouble. Called out
// as its own status so those stop reading as mystery outages every week.
const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
]);

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
  'warn-path-collapsed': 'The deep link now redirects to the site homepage — the specific page is probably gone. Find the new page or drop the action link.',
  'warn-tls': 'Open in a browser. If the page loads normally, no card edit is needed — the site is just serving an incomplete certificate chain, which browsers repair and Node will not. If the browser shows a certificate warning, students see that warning too: tell the org or drop the link.',
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeHost(hostname) {
  return String(hostname || '').replace(/^www\./i, '').toLowerCase();
}

function hasMeaningfulPath(parsed) {
  return parsed.pathname !== '' && parsed.pathname !== '/';
}

/**
 * mailto:/tel:/unsupported protocols never get fetched — they are validated by
 * shape instead. Returns null for http(s) urls, which do get fetched.
 */
export function classifyNonHttpUrl(parsed) {
  if (parsed.protocol === 'mailto:') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.pathname)
      ? { status: 'ok', protocol: 'mailto' }
      : { status: 'broken', reason: 'invalid email address' };
  }
  if (parsed.protocol === 'tel:') {
    return /^[+()\d\s.-]{3,}$/.test(parsed.pathname)
      ? { status: 'ok', protocol: 'tel' }
      : { status: 'broken', reason: 'invalid phone number' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { status: 'broken', reason: `unsupported protocol: ${parsed.protocol}` };
  }
  return null;
}

/**
 * Pure status mapping, split out from the request so it can be unit tested.
 *
 * The path-collapse rule is the important one: a deleted deep link very often
 * 301s to its own site root, which returns 200 on the same host and would
 * otherwise be counted as perfectly healthy. Since the whole point of an
 * actionLink is landing a student on the application page rather than a
 * homepage, that silently defeats the card. Reported as a warning rather than
 * `broken` because a site can legitimately redirect a canonical path.
 */
export function classifyResponse({ requestedUrl, finalUrl, httpStatus }) {
  const requested = new URL(requestedUrl);
  const landed = new URL(finalUrl || requestedUrl);
  const requestedHost = normalizeHost(requested.hostname);
  const finalHost = normalizeHost(landed.hostname);
  const domainChanged = finalHost !== requestedHost;
  const redirected = landed.href !== requested.href;

  if (BOT_CHALLENGE_HOSTS.has(finalHost)) {
    return { status: 'warn-bot-challenge', httpStatus, finalUrl: landed.href, reason: `Automation was redirected to bot challenge host ${finalHost}.` };
  }

  if (httpStatus >= 200 && httpStatus < 400) {
    if (!domainChanged && hasMeaningfulPath(requested) && !hasMeaningfulPath(landed)) {
      return {
        status: 'warn-path-collapsed',
        httpStatus,
        finalUrl: landed.href,
        reason: `Deep link redirects to the site root (${landed.href}); the specific page may be gone.`,
      };
    }
    return { status: 'ok', httpStatus, domainChanged, finalUrl: redirected ? landed.href : undefined };
  }
  if (httpStatus === 403) {
    return { status: 'warn-forbidden', httpStatus, reason: 'Often a bot-block (e.g. mass.gov), not necessarily dead — verify manually.' };
  }
  if (httpStatus === 429) {
    return { status: 'warn-rate-limited', httpStatus, reason: 'Rate-limited by the site; verify manually if it persists.' };
  }
  if (httpStatus >= 500 && httpStatus < 600) {
    return { status: 'warn-server-error', httpStatus, reason: 'Remote site returned a server error; verify manually if it persists.' };
  }
  return { status: 'broken', httpStatus };
}

async function fetchWithTimeout(url, method, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/**
 * HEAD first (cheap), but never trust a HEAD failure: plenty of WAF/CDN setups
 * reject HEAD outright while serving GET fine, so any >= 400 is re-checked with
 * GET before it can be called broken. A thrown request gets one delayed retry.
 * Healthy links still cost exactly one request.
 */
async function requestUrl(url) {
  let headResponse;
  try {
    headResponse = await fetchWithTimeout(url, 'HEAD', HEAD_TIMEOUT_MS);
  } catch {
    await sleep(RETRY_DELAY_MS);
    return fetchWithTimeout(url, 'GET');
  }
  if (headResponse.status >= 400) {
    try {
      return await fetchWithTimeout(url, 'GET');
    } catch {
      // GET retry failed too — fall back to what HEAD told us.
      return headResponse;
    }
  }
  return headResponse;
}

const hostGates = new Map();

/** Serialize requests per host with a fixed gap; different hosts stay parallel. */
function withHostGate(host, fn) {
  const prior = hostGates.get(host) || Promise.resolve();
  const run = prior.then(fn, fn);
  const released = run.then(() => sleep(MIN_HOST_INTERVAL_MS), () => sleep(MIN_HOST_INTERVAL_MS));
  hostGates.set(host, released);
  return run;
}

export async function checkOne(url) {
  if (!url) return { url, status: 'skipped', reason: 'empty url' };
  try {
    const parsed = new URL(url);
    const nonHttp = classifyNonHttpUrl(parsed);
    if (nonHttp) return { url, ...nonHttp };

    const res = await withHostGate(normalizeHost(parsed.hostname), () => requestUrl(url));
    return { url, ...classifyResponse({ requestedUrl: url, finalUrl: res.url, httpStatus: res.status }) };
  } catch (error) {
    return { url, ...classifyRequestError(error) };
  }
}

/**
 * A thrown request tells us more than "fetch failed" if we look at the cause
 * code, so keep it: it is the difference between a dead host and a site whose
 * only problem is a misconfigured certificate chain.
 */
export function classifyRequestError(error) {
  const code = (error && ((error.cause && error.cause.code) || error.code)) || '';
  if (TLS_ERROR_CODES.has(code)) {
    return {
      status: 'warn-tls',
      reason: `TLS certificate could not be verified (${code}). Browsers usually accept the chain that Node rejects, so the page may well work for students.`,
    };
  }
  const detail = (error && error.name === 'AbortError')
    ? 'timeout'
    : (code || (error && error.message) || String(error));
  return { status: 'warn-unreachable', reason: `${detail}; verify manually if it persists.` };
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

// Only run when invoked directly, so the classifiers above can be imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Link check failed:', error.message || error);
    process.exit(1);
  });
}
