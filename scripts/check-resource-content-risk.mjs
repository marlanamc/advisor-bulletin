#!/usr/bin/env node
/**
 * Monthly re-verification queue for live student resources.
 *
 * This does not decide whether a resource is accurate. It answers one question:
 * which cards are overdue for a human to re-check?
 *
 * The only thing that puts a card in the queue is the clock — `lastVerified`
 * missing, malformed, or older than its category's recheck window. Content
 * signals (exact hours, a dollar amount, seasonal wording, intake rules,
 * eligibility rules) do NOT create queue entries; they only say *what to look
 * at* on a card that is already due, and break ties in the ordering.
 *
 * That split is deliberate. The previous version emitted a finding for each
 * risk signal, which flagged 82 of 89 resources every week: 46 hits for being
 * in a high-risk category (a permanent attribute that is already encoded in
 * the 3-month window below, so it was double-counted), and 71 more for
 * mentioning hours, prices, eligibility or intake rules — all of which could
 * only be cleared by deleting the very information students need. 61 of the 82
 * could not be resolved by any action at all, and the remaining 21 needed a
 * `lastVerified` field that had no control anywhere in the advisor portal.
 * A queue nobody can empty is not a queue.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-resource-content-risk.mjs [--json=out.json]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// Shared with the advisor portal's "Needs verification" filter so the queue
// here and the list in the portal can never disagree about what "due" means.
import {
  monthsSince,
  recheckWindowFor,
  verificationStatus,
} from '../src/resource-verification.js';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

// Not findings — just "while you have this card open, look at these".
const CHECK_HINTS = [
  {
    id: 'hours',
    label: 'hours',
    regex: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon\.?|tue\.?|tues\.?|wed\.?|thu\.?|thur\.?|thurs\.?|fri\.?|sat\.?|sun\.?|\d{1,2}(?::\d{2})?\s*(am|pm))\b/i,
  },
  { id: 'cost', label: 'the stated cost', regex: /\$\s?\d|\b\d+\s?dollars?\b/i },
  {
    id: 'seasonal',
    label: 'seasonal timing',
    regex: /\b(seasonal|summer|winter|spring|fall|school year|holiday|november|december|january|february|march|april)\b/i,
  },
  {
    id: 'intake',
    label: 'intake or appointment rules',
    regex: /\b(call to confirm|call for|appointment|by appointment|sign[- ]?up opens|register every month|walk[- ]?in)\b/i,
  },
  {
    id: 'eligibility',
    label: 'eligibility and required documents',
    regex: /\b(qualif(y|ies)|eligible|income limit|resident|residents|work permit|immigration status|proof of income|id and proof)\b/i,
  },
];

function parseArgs(argv) {
  const args = { json: null, credentials: null };
  for (const arg of argv) {
    if (arg.startsWith('--json=')) args.json = arg.slice('--json='.length);
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

export { monthsSince, recheckWindowFor };

function textForHints(resource) {
  return [
    resource.title,
    resource.description,
    resource.descriptionEs,
    resource.summary,
    resource.summaryEs,
    resource.hours,
    resource.highlights,
    ...(Array.isArray(resource.actionLinks) ? resource.actionLinks.map((link) => `${link.labelEn || ''} ${link.labelEs || ''}`) : []),
  ].filter(Boolean).join(' ');
}

export function checkHintsFor(resource) {
  const text = textForHints(resource);
  return CHECK_HINTS.filter((hint) => hint.regex.test(text)).map((hint) => hint.label);
}

/**
 * Returns a queue entry only when the card is actually overdue, or null.
 */
export function reviewForResource(resource, now) {
  const category = resource.resourceCategory || resource.category || 'general';
  const { status, window, monthsOld, overdueBy, isDue } =
    verificationStatus(category, resource.lastVerified, now);
  if (!isDue) return null;
  const hints = checkHintsFor(resource);

  const reason = status === 'never-verified'
    ? 'Never verified — no date on record.'
    : status === 'bad-date'
      ? `Verified date is not YYYY-MM: ${resource.lastVerified}`
      : `Verified ${resource.lastVerified}, ${monthsOld} months ago; this category wants a check every ${window}.`;

  const advisorAction = hints.length
    ? `Check ${hints.join(', ')}, then press "Verified today" on the card in the portal.`
    : 'Give the card a quick look, then press "Verified today" on it in the portal.';

  return {
    id: resource.id,
    issueKey: `${resource.id}|content`,
    resource: resource.title,
    category,
    url: resource.url || '',
    lastVerified: resource.lastVerified || '',
    status,
    window,
    monthsOld,
    overdueBy,
    checkHints: hints,
    reason,
    advisorAction,
  };
}

export function buildReport(resources, now) {
  const due = resources
    .map((resource) => reviewForResource(resource, now))
    .filter(Boolean)
    .sort((a, b) => b.overdueBy - a.overdueBy
      || a.category.localeCompare(b.category)
      || a.resource.localeCompare(b.resource));

  return {
    checkedAt: now.toISOString(),
    totals: {
      resources: resources.length,
      due: due.length,
      neverVerified: due.filter((d) => d.status === 'never-verified').length,
      badDate: due.filter((d) => d.status === 'bad-date').length,
      overdue: due.filter((d) => d.status === 'overdue').length,
    },
    due,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = await initAdminDb(args.credentials);
  const now = new Date();
  const snapshot = await db.collection(COLLECTION).where('type', '==', 'resource').get();
  const resources = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.titleEn || data.title || doc.id,
      category: data.category,
      resourceCategory: data.resourceCategory,
      url: data.url || data.eventLink || '',
      description: data.description || '',
      descriptionEs: data.descriptionEs || '',
      summary: data.summary || '',
      summaryEs: data.summaryEs || '',
      hours: data.hours || '',
      highlights: data.highlights || '',
      actionLinks: Array.isArray(data.actionLinks) ? data.actionLinks : [],
      lastVerified: data.lastVerified || '',
      isActive: data.isActive !== false,
      isPublished: data.isPublished !== false,
    };
  }).filter((resource) => resource.isActive && resource.isPublished);

  const report = buildReport(resources, now);

  console.log(`Checked ${report.totals.resources} live resources.`);
  console.log(`Due for re-verification: ${report.totals.due} (${report.totals.neverVerified} never verified, ${report.totals.overdue} past their window, ${report.totals.badDate} with a bad date).`);
  for (const item of report.due.slice(0, 25)) {
    console.log(`${item.status.toUpperCase()}: [${item.category}] ${item.resource} — ${item.reason}`);
  }
  if (report.due.length > 25) console.log(`...and ${report.due.length - 25} more.`);

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`Wrote ${args.json}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Content review check failed:', error.message || error);
    process.exit(1);
  });
}
