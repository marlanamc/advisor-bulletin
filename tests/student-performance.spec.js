const { test, expect } = require('@playwright/test');

async function resetStudentState(page) {
  await page.goto('/googlecb709123fbf8d92e.html');
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    localStorage.removeItem('ebhcs_bulletins_v1');
    localStorage.removeItem('ebhcs_student_feed_snapshot_v1');
    sessionStorage.clear();
  });
}

async function waitForSnapshotCards(page, timeout = 5000) {
  const started = Date.now();
  await page.waitForFunction(() => {
    const grid = document.getElementById('bulletinGrid');
    return grid?.getAttribute('data-snapshot-rendered') === 'true'
      && grid.querySelectorAll('[data-bulletin-id]').length > 0;
  }, { timeout });
  return Date.now() - started;
}

test.describe('student fast-load path', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Performance contract runs once.');
  });

  test('cold load renders student snapshot without waiting for Firebase', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await resetStudentState(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = await waitForSnapshotCards(page);

    await expect(page.locator('#bulletinGrid [data-bulletin-id]').first()).toBeVisible();
    expect(elapsed).toBeLessThan(5000);

    await context.close();
  });

  test('repeat PWA load can render snapshot from storage/cache', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      serviceWorkers: 'allow',
    });
    const page = await context.newPage();
    await resetStudentState(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForSnapshotCards(page);
    await page.waitForFunction(() => localStorage.getItem('ebhcs_student_feed_snapshot_v1'));

    await page.reload({ waitUntil: 'domcontentloaded' });
    const elapsed = await waitForSnapshotCards(page);

    await expect(page.locator('#bulletinGrid [data-bulletin-id]').first()).toBeVisible();
    expect(elapsed).toBeLessThan(5000);

    await context.close();
  });

  test('throttled mobile conditions still show useful cards within five seconds', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1.6 * 1024 * 1024 / 8,
      uploadThroughput: 750 * 1024 / 8,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    await resetStudentState(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const elapsed = await waitForSnapshotCards(page);

    await expect(page.locator('#bulletinGrid [data-bulletin-id]').first()).toBeVisible();
    expect(elapsed).toBeLessThan(5000);

    await context.close();
  });
});
