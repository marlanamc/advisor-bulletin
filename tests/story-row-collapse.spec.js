const { test, expect } = require('@playwright/test');

// The pinned Help-topic row shrinks its bubbles once you scroll into the feed.
// It used to shrink the feed along with them: the browser re-anchored the
// scroll by the height the row had just lost, the corrected scrollY fell back
// under the threshold that expands the row, and the bubbles flipped between
// sizes for as long as you kept scrolling. Both tests below pin the property
// that stops that — collapsing must not change how tall the page is.

const ROW = '#feedView > .story-row-wrap.story-row-wrap--bilingual';

async function openFeed(page) {
  await page.goto('/');
  await page.locator(ROW).waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await expect(page.locator(ROW)).toHaveCSS('--story-row-collapse-offset', /px$/);
}

function isCompact(page) {
  return page.evaluate((row) => document.querySelector(row).classList.contains('story-row-wrap--compact'), ROW);
}

test.describe('Pinned story row collapse', () => {
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
    expect(await isCompact(page)).toBe(true);

    // Nudging up and down across the collapse threshold used to toggle the row
    // on every single nudge.
    for (let i = 0; i < 20; i++) {
      await page.mouse.wheel(0, i % 2 ? 8 : -8);
      await page.waitForTimeout(90);
      expect(await isCompact(page)).toBe(true);
    }
  });
});
