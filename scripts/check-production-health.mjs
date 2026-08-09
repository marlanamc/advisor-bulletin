#!/usr/bin/env node
/**
 * Production liveness check. Everything else in CI validates the build and
 * the deploy step succeeding — nothing actually loads the live site
 * afterward to confirm it renders. This does: launches headless Chromium
 * against the real production URLs (not the emulator, not localhost),
 * loads each page, and fails the check if the page doesn't render, the
 * title is wrong, or the browser throws a console/page error while
 * loading — which is also what would happen if Firestore reads started
 * failing (e.g. a quota-exceeded day) or a bad deploy shipped a broken
 * bundle.
 *
 * Usage:
 *   node scripts/check-production-health.mjs [--json=out.json]
 *
 * Exit code is always 0 — this script reports, it doesn't fail the build.
 * The caller (CI workflow) decides what to do with the JSON output.
 */

import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const TIMEOUT_MS = 20_000;
const SETTLE_MS = 4_000;
const MIN_BODY_TEXT_LENGTH = 200;

const PAGES = [
  {
    name: 'Student board',
    url: 'https://ebhcsjobboard.web.app/',
    expectedTitle: /Bulletin Board/i,
  },
  {
    name: 'Advisor portal login',
    url: 'https://ebhcsjobboard.web.app/admin',
    expectedTitle: /Admin/i,
  },
];

function parseArgs(argv) {
  const args = { json: null };
  for (const arg of argv) {
    if (arg.startsWith('--json=')) args.json = arg.slice('--json='.length);
  }
  return args;
}

async function checkPage(browser, page) {
  const context = await browser.newContext();
  const tab = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  tab.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });
  tab.on('pageerror', (err) => {
    pageErrors.push(String(err.message || err).slice(0, 300));
  });

  const result = { name: page.name, url: page.url, ok: false, reasons: [], consoleErrors, pageErrors };

  try {
    const response = await tab.goto(page.url, { timeout: TIMEOUT_MS, waitUntil: 'load' });
    result.httpStatus = response ? response.status() : null;
    if (!response || !response.ok()) {
      result.reasons.push(`HTTP ${result.httpStatus ?? 'no response'}`);
    }

    await tab.waitForTimeout(SETTLE_MS);

    const title = await tab.title();
    result.title = title;
    if (!page.expectedTitle.test(title)) {
      result.reasons.push(`Unexpected title: "${title}"`);
    }

    const bodyText = await tab.evaluate(() => document.body?.innerText?.trim() || '');
    result.bodyTextLength = bodyText.length;
    if (bodyText.length < MIN_BODY_TEXT_LENGTH) {
      result.reasons.push(`Page body looks empty (${bodyText.length} chars of text)`);
    }

    if (consoleErrors.length) result.reasons.push(`${consoleErrors.length} console error(s)`);
    if (pageErrors.length) result.reasons.push(`${pageErrors.length} uncaught page error(s)`);

    result.ok = result.reasons.length === 0;
  } catch (error) {
    result.reasons.push(`Failed to load: ${error.message || error}`);
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch();

  const results = [];
  for (const page of PAGES) {
    results.push(await checkPage(browser, page));
  }
  await browser.close();

  const allOk = results.every((r) => r.ok);
  const report = { checkedAt: new Date().toISOString(), allOk, results };

  for (const r of results) {
    console.log(`${r.ok ? 'OK' : 'FAIL'} — ${r.name} (${r.url})`);
    if (!r.ok) r.reasons.forEach((reason) => console.log(`  - ${reason}`));
  }

  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    console.log(`\nWrote report to ${args.json}`);
  }
}

main().catch((error) => {
  console.error('Production health check failed to run:', error.message || error);
  process.exit(1);
});
