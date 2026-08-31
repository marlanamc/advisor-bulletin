#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTENT_SECURITY_POLICY } from '../config/csp.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const HTML_FILES = ['index.html', 'admin.html'];
const HOSTING_SOURCES = ['/', '/index.html', '/admin', '/admin.html'];

function readText(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function fail(message) {
  console.error(`CSP sync check failed: ${message}`);
  process.exitCode = 1;
}

function getHtmlCsp(file) {
  const html = readText(file);
  const match = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i);
  return match?.[1] ?? null;
}

function getHostingCspValues() {
  const config = JSON.parse(readText('firebase.json'));
  const hosting = config.hosting;
  const entries = Array.isArray(hosting) ? hosting : [hosting];
  const values = [];

  for (const entry of entries) {
    for (const headerBlock of entry?.headers ?? []) {
      if (!HOSTING_SOURCES.includes(headerBlock.source)) continue;
      const cspHeader = (headerBlock.headers ?? []).find((header) => header.key === 'Content-Security-Policy');
      values.push({ source: headerBlock.source, value: cspHeader?.value ?? null });
    }
  }

  return values;
}

for (const file of HTML_FILES) {
  const value = getHtmlCsp(file);
  if (value !== CONTENT_SECURITY_POLICY) {
    fail(`${file} Content-Security-Policy meta tag does not match config/csp.mjs`);
  }
}

const hostingValues = getHostingCspValues();
for (const source of HOSTING_SOURCES) {
  const matches = hostingValues.filter((entry) => entry.source === source);
  if (matches.length !== 1) {
    fail(`firebase.json should have exactly one Content-Security-Policy header for ${source}`);
    continue;
  }
  if (matches[0].value !== CONTENT_SECURITY_POLICY) {
    fail(`firebase.json Content-Security-Policy for ${source} does not match config/csp.mjs`);
  }
}

if (!process.exitCode) {
  console.log(`OK: CSP is in sync across ${HTML_FILES.length} HTML meta tags and ${HOSTING_SOURCES.length} Firebase Hosting headers`);
}
