const { test, expect } = require('@playwright/test');

async function resetPwaState(page) {
  await page.goto('/googlecb709123fbf8d92e.html');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    sessionStorage.clear();
    localStorage.removeItem('ebhcs_bulletins_v1');
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
      const cached = await cache.match('/index.html');

      return {
        ok: message?.ok,
        cachedStatus: cached?.status || 0,
      };
    });

    expect(result).toEqual({ ok: true, cachedStatus: 200 });
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
