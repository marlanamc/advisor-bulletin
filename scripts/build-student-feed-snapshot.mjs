#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'ebhcs-bulletin-board';
const COLLECTION = 'bulletins';
const OUT_PATH = resolve(process.cwd(), 'public/student-feed-snapshot.json');
const MAX_ITEMS = 120;
const MAX_POST_ITEMS = 72;
const MAX_RESOURCE_ITEMS = 16;

function parseArgs(argv) {
  const args = { credentials: null, allowClient: true };
  for (const arg of argv) {
    if (arg.startsWith('--credentials=')) args.credentials = arg.slice('--credentials='.length);
    if (arg === '--no-client') args.allowClient = false;
  }
  return args;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

function toPlainDateValue(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }
  return value;
}

function compactString(value, max = 320) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function compactUrl(value, { allowImages = false } = {}) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('data:')) return '';
  if (url.length > 500) return '';
  if (!allowImages) return url;
  return /^https?:\/\//i.test(url) ? url : '';
}

function normalizeItem(id, data) {
  const type = data.type || 'post';
  const item = {
    id,
    type,
    category: data.category || data.resourceCategory || 'announcement',
    title: compactString(data.title || data.resourceTitleEn || data.titleEn || '', 180),
    titleEs: compactString(data.titleEs || data.resourceTitleEs || data.summaryEs || '', 180),
    description: compactString(data.description || data.resourceDescription || data.summary || '', 420),
    summaryEs: compactString(data.summaryEs || data.descriptionEs || '', 420),
    advisorName: compactString(data.advisorName || data.createdBy || 'Advisor', 80),
    datePosted: toPlainDateValue(data.datePosted || data.createdAt),
    createdAt: toPlainDateValue(data.createdAt),
    dateType: data.dateType || '',
    eventDate: data.eventDate || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    deadline: data.deadline || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    eventDates: Array.isArray(data.eventDates) ? data.eventDates.slice(0, 12) : [],
    image: compactUrl(data.image, { allowImages: true }),
    imageEs: compactUrl(data.imageEs, { allowImages: true }),
    eventLink: compactUrl(data.eventLink || data.url),
    pdfUrl: compactUrl(data.pdfUrl),
  };

  if (type === 'resource') {
    item.resourceCategory = data.resourceCategory || data.category || 'resource';
    item.titleEn = compactString(data.resourceTitleEn || data.titleEn || data.title || '', 180);
    item.resourceTitleEs = compactString(data.resourceTitleEs || data.titleEs || '', 180);
    item.resourceOrder = data.resourceOrder ?? '';
    item.isPublished = data.isPublished !== false;
    item.isPinned = Boolean(data.isPinned);
    item.url = compactUrl(data.url || data.eventLink);
    item.phone = data.phone || '';
    item.address = data.address || '';
    item.mapUrl = compactUrl(data.mapUrl);
    item.resourceLogo = '';
    item.highlights = data.highlights || '';
    item.actionLinks = Array.isArray(data.actionLinks) ? data.actionLinks.slice(0, 3) : [];
  }

  return item;
}

function sortItems(items) {
  return items.sort((a, b) => {
    const pinned = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
    if (pinned) return pinned;
    return toMillis(b.datePosted || b.createdAt) - toMillis(a.datePosted || a.createdAt);
  });
}

async function fetchWithAdmin(credentialsPath) {
  const admin = await import('firebase-admin');
  const path = credentialsPath || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path || !existsSync(path)) {
    throw new Error('No service account credentials found.');
  }
  if (!admin.default.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(path, 'utf8'));
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  }
  const db = admin.default.firestore();
  const snapshot = await db.collection(COLLECTION)
    .where('isActive', '==', true)
    .orderBy('datePosted', 'desc')
    .limit(MAX_ITEMS)
    .get();
  return snapshot.docs.map((doc) => normalizeItem(doc.id, doc.data()));
}

async function fetchWithClientSdk() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const app = initializeApp({
    apiKey: 'AIzaSyBGaONCeB5MQCYdp3Gv8eUKPvLsBGFnXgY',
    authDomain: 'ebhcs-bulletin-board.firebaseapp.com',
    projectId: PROJECT_ID,
    storageBucket: 'ebhcs-bulletin-uploads-us',
    messagingSenderId: '556649154585',
    appId: '1:556649154585:web:3a3f49d2056aa507088288',
  }, `snapshot-build-${Date.now()}`);
  const db = getFirestore(app);
  const q = query(
    collection(db, COLLECTION),
    where('isActive', '==', true),
    orderBy('datePosted', 'desc'),
    limit(MAX_ITEMS)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => normalizeItem(doc.id, doc.data()));
}

function writeSnapshot(items, source) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Refusing to write empty student snapshot from ${source}.`);
  }
  const sorted = sortItems(items);
  const posts = sorted.filter((item) => item.type !== 'resource').slice(0, MAX_POST_ITEMS);
  const resources = sorted.filter((item) => item.type === 'resource').slice(0, MAX_RESOURCE_ITEMS);
  const payload = {
    generatedAt: new Date().toISOString(),
    source,
    items: [...posts, ...resources],
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(payload)}\n`);
  console.log(`Wrote ${payload.items.length} student snapshot items to ${OUT_PATH}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const items = await fetchWithAdmin(args.credentials);
    writeSnapshot(items, 'firestore-admin');
    return;
  } catch (adminError) {
    console.warn(`[snapshot] Admin fetch skipped: ${adminError.message || adminError}`);
  }

  if (args.allowClient) {
    try {
      const items = await fetchWithClientSdk();
      writeSnapshot(items, 'firestore-client');
      return;
    } catch (clientError) {
      console.warn(`[snapshot] Client fetch failed: ${clientError.message || clientError}`);
    }
  }

  if (existsSync(OUT_PATH)) {
    const existing = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
    if (Array.isArray(existing.items) && existing.items.length > 0) {
      console.warn(`[snapshot] Keeping existing snapshot with ${existing.items.length} items.`);
      return;
    }
  }

  throw new Error('Could not build student snapshot and no usable existing snapshot exists.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`[snapshot] ${error.message || error}`);
    process.exit(1);
  });
