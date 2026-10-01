const { test, expect } = require('@playwright/test');

// The pinned Help-topic row shrinks its bubbles once you scroll into the feed.
// It used to shrink the feed along with them: the browser re-anchored the
// scroll by the height the row had just lost, the corrected scrollY fell back
// under the threshold that expands the row, and the bubbles flipped between
// sizes for as long as you kept scrolling. Both tests below pin the property
// that stops that — collapsing must not change how tall the page is.

const ROW = '#feedView > .story-row-wrap.story-row-wrap--bilingual';

async function openFeed(page) {
  // This is a layout test: keep a fixed, scrollable feed on screen. The
  // checked-in snapshot expires, and an empty emulator has no posts to scroll.
  // Keep live hydration from replacing these snapshot fixtures mid-gesture.
  await page.route('**/src/firebase-config.js*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export {};',
  }));
  await page.route('**/student-feed-snapshot.json', route => route.fulfill({
    json: {
      generatedAt: new Date().toISOString(),
      items: Array.from({ length: 12 }, (_, i) => ({
        id: `scroll-post-${i}`, type: 'post', category: 'announcement',
        title: `Community announcement ${i + 1}`,
        description: 'A community update for students and families.',
        datePosted: new Date().toISOString(), isActive: true,
      })),
    },
  }));
  await page.goto('/');
  await page.locator(ROW).waitFor();
  await expect(page.locator('#bulletinGrid [data-bulletin-id]')).toHaveCount(12);
  await page.evaluate(() => document.body.setAttribute('data-current-view', 'feed'));
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await expect(page.locator(ROW)).toHaveCSS('--story-row-collapse-offset', /px$/);
}

function isCompact(page) {
  return page.evaluate((row) => document.querySelector(row).classList.contains('story-row-wrap--compact'), ROW);
}

async function scrollState(page) {
  return page.locator(ROW).evaluate(el => ({
    scrollY: window.scrollY,
    pageHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    offset: el.style.getPropertyValue('--story-row-collapse-offset'),
    rowHeight: el.getBoundingClientRect().height,
  }));
}

test.describe('Pinned story row collapse', () => {
  test('reserves space even when the body minimum height hides the row height change', async ({ page }) => {
    await openFeed(page);
    await page.addStyleTag({ content: 'body { min-height: 10000px !important; }' });
    // A width change remeasures the row, as on an orientation change. Body
    // height now stays fixed in both states, which used to produce a zero offset.
    const viewport = page.viewportSize();
    await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
    await expect.poll(() => page.locator(ROW).evaluate(el =>
      parseFloat(el.style.getPropertyValue('--story-row-collapse-offset'))
    )).toBeGreaterThan(2);

    const contentTop = () => page.locator('#feedView > .desktop-home-shell').evaluate(el =>
      el.getBoundingClientRect().top + window.scrollY
    );
    const expanded = await contentTop();
    await page.locator(ROW).evaluate(el => el.classList.add('story-row-wrap--compact'));
    await page.waitForTimeout(500);
    expect(Math.abs(await contentTop() - expanded)).toBeLessThanOrEqual(2);
  });

  test('collapsing the row leaves the page the same height', async ({ page }) => {
    await openFeed(page);

    const expanded = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate((row) => document.querySelector(row).classList.add('story-row-wrap--compact'), ROW);
    // Long enough for the 0.24s size transitions to finish.
    await page.waitForTimeout(500);
    const compact = await page.evaluate(() => document.documentElement.scrollHeight);

    expect(Math.abs(compact - expanded)).toBeLessThanOrEqual(2);
  });

  test('small scrolls near the threshold do not flip the bubbles back and forth', async ({ page }) => {
    await openFeed(page);

    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(500);
    expect(await isCompact(page), JSON.stringify(await scrollState(page))).toBe(true);

    // Nudging up and down across the collapse threshold used to toggle the row
    // on every single nudge.
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, i % 2 ? 8 : -8);
      await page.waitForTimeout(90);
      expect(await isCompact(page), JSON.stringify(await scrollState(page))).toBe(true);
    }
  });
});
