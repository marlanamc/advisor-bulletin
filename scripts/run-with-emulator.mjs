#!/usr/bin/env node
/**
 * Wraps a test command with a live Firebase emulator (Firestore/Auth/
 * Storage) so Playwright/CI never touches production Firestore. Added
 * August 2026 after CI's real onSnapshot listeners (fired on every
 * page.goto in every spec, times 2-4 browser projects) turned out to be
 * burning most of the daily 50K-read Spark quota on a single push.
 *
 * Usage:
 *   node scripts/run-with-emulator.mjs -- playwright test [...args]
 */

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const sepIndex = args.indexOf('--');
if (sepIndex === -1) {
  console.error('Usage: node scripts/run-with-emulator.mjs -- <command...>');
  process.exit(1);
}
const command = args.slice(sepIndex + 1).join(' ');

const result = spawnSync(
  'npx',
  ['firebase-tools', 'emulators:exec', '--project', 'ebhcs-bulletin-board', command],
  {
    stdio: 'inherit',
    env: { ...process.env, VITE_USE_FIREBASE_EMULATOR: 'true' },
    shell: process.platform === 'win32',
  }
);

process.exit(result.status ?? 1);
