#!/usr/bin/env node
/**
 * Weekly content-risk checker for live student resources.
 *
 * This does not decide whether a resource is accurate. It surfaces cards that
 * are likelier to go stale so an advisor can re-check them before students rely
 * on old hours, eligibility, prices, or seasonal instructions.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     node scripts/check-resource-content-risk.mjs [--json=out.json]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';

const CATEGORY_RECHECK_MONTHS = {
  food: 3,
  housing: 3,
  health: 3,
  'legal-aid': 3,
  immigration: 3,
  money: 4,
  jobs: 4,
  family: 4,
  'family-community': 4,
  consulates: 4,
  hse: 6,
  college: 6,
  general: 6,
  esol: 6,
};

const HIGH_RISK_CATEGORIES = new Set(['food', 'housing', 'health', 'legal-aid', 'immigration']);

const RISK_PATTERNS = [
  {
    id: 'specific-hours',
    priority: 'medium',
    regex: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon\.?|tue\.?|tues\.?|wed\.?|thu\.?|thur\.?|thurs\.?|fri\.?|sat\.?|sun\.?|\d{1,2}(?::\d{2})?\s*(am|pm))\b/i,
    reason: 'Mentions specific days or hours that can change.',
    advisorAction: 'Confirm hours on the official site or by phone.',
  },
  {
    id: 'dollar-amount',
    priority: 'high',
    regex: /\$\s?\d|\b\d+\s?dollars?\b/i,
    reason: 'Mentions a specific cost or dollar amount.',
    advisorAction: 'Confirm the current price or benefit amount.',
  },
  {
    id: 'seasonal',
    priority: 'medium',
    regex: /\b(seasonal|summer|winter|spring|fall|school year|holiday|november|december|january|february|march|april)\b/i,
    reason: 'Contains seasonal or date-window language.',
    advisorAction: 'Confirm this is still in season and update wording if needed.',
  },
  {
    id: 'call-to-confirm',
    priority: 'medium',
    regex: /\b(call to confirm|call for|appointment|by appointment|sign[- ]?up opens|register every month|walk[- ]?in)\b/i,
    reason: 'Depends on current intake, appointment, or registration rules.',
    advisorAction: 'Confirm the current intake or registration process.',
  },
  {
    id: 'eligibility',
    priority: 'medium',
    regex: /\b(qualif(y|ies)|eligible|income limit|resident|residents|work permit|immigration status|proof of income|id and proof)\b/i,
    reason: 'Mentions eligibility rules or required documents.',
    advisorAction: 'Confirm eligibility and document requirements.',
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

function monthsSince(yearMonth, now) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth || '').trim());
  if (!match) return null;
  return (now.getFullYear() - Number(match[1])) * 12 + (now.getMonth() + 1 - Number(match[2]));
}

function textForRisk(resource) {
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

function maxPriority(reasons) {
  const score = { low: 1, medium: 2, high: 3 };
  return reasons.reduce((max, reason) => score[reason.priority] > score[max] ? reason.priority : max, 'low');
}

function reviewForResource(resource, now) {
  const category = resource.resourceCategory || resource.category || 'general';
  const text = textForRisk(resource);
  const reasons = [];
  const threshold = CATEGORY_RECHECK_MONTHS[category] || 6;
  const verifiedAge = monthsSince(resource.lastVerified, now);

  if (!resource.lastVerified) {
    reasons.push({
      id: 'never-verified',
      priority: 'high',
      reason: 'No lastVerified date is recorded.',
      advisorAction: 'Verify the card and set lastVerified to YYYY-MM.',
    });
  } else if (verifiedAge === null) {
    reasons.push({
      id: 'bad-last-verified',
      priority: 'high',
      reason: `lastVerified is not YYYY-MM: ${resource.lastVerified}`,
      advisorAction: 'Fix lastVerified to YYYY-MM after review.',
    });
  } else if (verifiedAge >= threshold) {
    reasons.push({
      id: 'stale-verification',
      priority: HIGH_RISK_CATEGORIES.has(category) ? 'high' : 'medium',
      reason: `Last verified ${resource.lastVerified}; ${verifiedAge} months old for a ${threshold}-month category.`,
      advisorAction: 'Re-verify the card and refresh lastVerified.',
    });
  }

  if (HIGH_RISK_CATEGORIES.has(category)) {
    reasons.push({
      id: 'high-risk-category',
      priority: 'low',
      reason: 'High-risk category for student decisions.',
      advisorAction: 'Prioritize this card during manual review.',
    });
  }

  for (const pattern of RISK_PATTERNS) {
    if (pattern.regex.test(text)) {
      reasons.push({
        id: pattern.id,
        priority: pattern.priority,
        reason: pattern.reason,
        advisorAction: pattern.advisorAction,
      });
    }
  }

  if (!reasons.length) return null;

  return {
    id: resource.id,
    resource: resource.title,
    category,
    url: resource.url || '',
    lastVerified: resource.lastVerified || '',
    priority: maxPriority(reasons),
    reasons,
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

  const reviews = resources
    .map((resource) => reviewForResource(resource, now))
    .filter(Boolean)
    .sort((a, b) => {
      const score = { high: 3, medium: 2, low: 1 };
      return score[b.priority] - score[a.priority] || a.category.localeCompare(b.category) || a.resource.localeCompare(b.resource);
    });

  const report = {
    checkedAt: now.toISOString(),
    totals: {
      resources: resources.length,
      reviewItems: reviews.length,
      high: reviews.filter((item) => item.priority === 'high').length,
      medium: reviews.filter((item) => item.priority === 'medium').length,
      low: reviews.filter((item) => item.priority === 'low').length,
    },
    reviews,
  };

  console.log(`Checked ${resources.length} live resources for content risk.`);
  console.log(`Review queue: ${report.totals.high} high, ${report.totals.medium} medium, ${report.totals.low} low.`);
  for (const item of reviews.slice(0, 25)) {
    const reasons = item.reasons.map((reason) => reason.id).join(', ');
    console.log(`${item.priority.toUpperCase()}: [${item.category}] ${item.resource} (${reasons})`);
  }
  if (reviews.length > 25) console.log(`...and ${reviews.length - 25} more.`);

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`Wrote ${args.json}`);
  }
}

main().catch((error) => {
  console.error('Content risk check failed:', error.message || error);
  process.exit(1);
});
