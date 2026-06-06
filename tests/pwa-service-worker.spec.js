const { test, expect } = require('@playwright/test');

const DEPLOY_VERSION_STORAGE_KEY = 'ebhcs_student_deploy_version';
const DEPLOY_RELOAD_GUARD_KEY = 'ebhcs_student_reload_version';

async function resetPwaState(page) {
  await page.goto('/googlecb709123fbf8d92e.html');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    sessionStorage.clear();
    localStorage.removeItem('ebhcs_bulletins_v1');
    localStorage.removeItem('ebhcs_student_deploy_version');
  });
}

async function registerReadyServiceWorker(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        const timeoutId = setTimeout(resolve, 1000);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(timeoutId);
          resolve();
        }, { once: true });
      });
    }
    return registration.scope;
  });
}

async function mockDeployVersion(page, getVersion) {
  await page.route('**/version.json', async (route) => {
    const version = typeof getVersion === 'function' ? getVersion() : getVersion;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ v: version }),
    });
  });
}

async function waitForStoredDeployVersion(page, expectedVersion) {
  await page.waitForFunction(
    ({ key, expected }) => localStorage.getItem(key) === expected,
    { key: DEPLOY_VERSION_STORAGE_KEY, expected: expectedVersion }
  );
}

function countStudentDocumentRequests(page) {
  let count = 0;
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === 'document' && url.pathname === '/') {
      count += 1;
    }
  });
  return () => count;
}

test.describe('PWA service worker', () => {
  test('first and repeat loads keep the student shell usable', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-topbar')).toBeVisible();
    await expect(page.locator('[data-app-view="resources"]').first()).toBeAttached();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-topbar')).toBeVisible();
    await expect(page.locator('[data-app-view="calendar"]').first()).toBeAttached();
  });

  test('student page registers the service worker with update cache bypassed', async ({ page }) => {
    await resetPwaState(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.updateViaCache === 'none';
    });

    const updateViaCache = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return registration?.updateViaCache;
    });

    expect(updateViaCache).toBe('none');
  });

  test('deploy version check records first version without reloading', async ({ page }) => {
    await resetPwaState(page);
    await mockDeployVersion(page, 'deploy-v1');
    const documentRequestCount = countStudentDocumentRequests(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForStoredDeployVersion(page, 'deploy-v1');
    await page.waitForTimeout(300);

    expect(documentRequestCount()).toBe(1);
  });

  test('changed deploy version triggers one automatic student reload', async ({ page }) => {
    await resetPwaState(page);
    let deployVersion = 'deploy-v1';
    await mockDeployVersion(page, () => deployVersion);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForStoredDeployVersion(page, 'deploy-v1');

    const documentRequestCount = countStudentDocumentRequests(page);
    deployVersion = 'deploy-v2';
    await page.reload({ waitUntil: 'domcontentloaded' });

    await waitForStoredDeployVersion(page, 'deploy-v2');
    await expect.poll(documentRequestCount, { timeout: 5000 }).toBe(2);
    await page.waitForTimeout(500);

    const reloadGuard = await page.evaluate((key) => sessionStorage.getItem(key), DEPLOY_RELOAD_GUARD_KEY);
    expect(reloadGuard).toBe('deploy-v2');
    expect(documentRequestCount()).toBe(2);
  });

  test('deploy reload guard prevents a loop for the same changed version', async ({ page }) => {
    await resetPwaState(page);
    await mockDeployVersion(page, 'deploy-v2');
    await page.addInitScript(({ versionKey, guardKey }) => {
      localStorage.setItem(versionKey, 'deploy-v1');
      sessionStorage.setItem(guardKey, 'deploy-v2');
    }, {
      versionKey: DEPLOY_VERSION_STORAGE_KEY,
      guardKey: DEPLOY_RELOAD_GUARD_KEY,
    });
    const documentRequestCount = countStudentDocumentRequests(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForStoredDeployVersion(page, 'deploy-v2');
    await page.waitForTimeout(500);

    expect(documentRequestCount()).toBe(1);
  });

  test('fresh-shell update message caches the student shell before reload', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    const result = await page.evaluate(async () => {
      const controller = navigator.serviceWorker.controller;
      const channel = new MessageChannel();
      const response = new Promise((resolve) => {
        channel.port1.onmessage = (event) => resolve(event.data);
      });

      controller.postMessage({ type: 'PREPARE_FRESH_SHELL' }, [channel.port2]);
      const message = await response;
      const cacheNames = await caches.keys();
      const cache = await caches.open(cacheNames.find((name) => name.startsWith('ebhcs-bulletin-')));
      const cachedRoot = await cache.match('/');
      const cachedAlias = await cache.match('/index.html');

      return {
        ok: message?.ok,
        cachedRootStatus: cachedRoot?.status || 0,
        cachedAliasStatus: cachedAlias?.status || 0,
      };
    });

    expect(result).toEqual({ ok: true, cachedRootStatus: 200, cachedAliasStatus: 200 });
  });

  test('student navigation avoids caching or serving redirect-followed shell responses', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    await page.route('**/index.html', async (route) => {
      await route.fulfill({
        status: 301,
        headers: { Location: '/' },
        body: 'Redirecting',
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-topbar')).toBeVisible();

    const cacheState = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const cacheName = cacheNames.find((name) => name.startsWith('ebhcs-bulletin-'));
      const cache = await caches.open(cacheName);
      const cachedRoot = await cache.match('/');
      const cachedIndex = await cache.match('/index.html');

      return {
        hasRoot: Boolean(cachedRoot),
        hasIndex: Boolean(cachedIndex),
        rootRedirected: cachedRoot?.redirected || false,
        indexRedirected: cachedIndex?.redirected || false,
      };
    });

    expect(cacheState.hasRoot).toBe(true);
    expect(cacheState.hasIndex).toBe(true);
    expect(cacheState.rootRedirected).toBe(false);
    expect(cacheState.indexRedirected).toBe(false);
  });

  test('?sw=off bypasses the service worker for recovery loads', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    let swIntercepted = false;
    await page.evaluate(() => {
      navigator.serviceWorker.addEventListener('message', () => {});
    });

    const registration = await page.evaluate(async () => navigator.serviceWorker.getRegistration());
    expect(registration).toBeTruthy();

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('sw') === 'off' && route.request().resourceType() === 'document') {
        swIntercepted = true;
      }
      await route.continue();
    });

    await page.goto('/?sw=off', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app-topbar')).toBeVisible();
    expect(swIntercepted).toBe(true);
  });

  test('/admin and /admin.html use the admin shell, not the student shell', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/Admin|Advisor|Sign In|Dashboard/i);

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/Admin|Advisor|Sign In|Dashboard/i);
    await expect(page.locator('.mobile-tab[data-app-view="feed"]')).toHaveCount(0);
  });

  test('admin navigation bypasses stale cached admin html in the service worker', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const cacheName = cacheNames.find((name) => name.startsWith('ebhcs-bulletin-'));
      const cache = await caches.open(cacheName);
      const stale = new Response('<!doctype html><title>Stale</title><h1>Stale Admin Shell</h1>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      await cache.put('/admin.html', stale.clone());
      await cache.put('/admin', stale.clone());
    });

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText('Stale Admin Shell');
    await expect(page.locator('body')).toContainText(/Admin|Advisor|Sign In|Dashboard/i);
  });

  test('student navigation prefers network html over stale cached shell', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const cacheName = cacheNames.find((name) => name.startsWith('ebhcs-bulletin-'));
      const cache = await caches.open(cacheName);
      const stale = new Response('<!doctype html><title>Stale Student</title><body><h1>Stale Student Shell</h1></body>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
      await cache.put('/index.html', stale.clone());
      await cache.put('/', stale.clone());
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText('Stale Student Shell');
    await expect(page.locator('.app-topbar')).toBeVisible();
  });

  test('admin load unregisters the PWA service worker for future visits', async ({ page }) => {
    await resetPwaState(page);
    await registerReadyServiceWorker(page);

    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const cacheNames = await caches.keys();
      return registrations.length === 0 && !cacheNames.some((name) => name.startsWith('ebhcs-bulletin-'));
    });
  });
});
