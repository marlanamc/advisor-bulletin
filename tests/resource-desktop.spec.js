const { test, expect } = require('@playwright/test');

async function seedDesktopResources(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const resources = [
      ['desktop-resource-1', 'Hot meals and groceries', '617-555-0101', 'Food support this week.', 10],
      ['desktop-resource-2', 'Find a free pantry near you', '', 'Neighborhood pantry lookup and referrals.', 20],
      ['desktop-resource-3', 'Call to find food today', '', 'Daily hotline for emergency food.', 30],
      ['desktop-resource-4', 'Weekend community supper', '', 'Shared meals on Saturday evenings.', 40],
    ].map(([id, title, phone, description, resourceOrder]) => ({
      id,
      type: 'resource',
      title,
      titleEn: title,
      titleEs: title,
      category: 'resource',
      resourceCategory: 'food',
      resourceIcon: 'food',
      url: 'https://example.org/food',
      description,
      phone,
      advisorName: 'Fabiola',
      postedBy: 'fabiola',
      datePosted: now,
      isActive: true,
      isPublished: true,
      resourceOrder,
    }));

    window.bulletinBoard.bulletins = resources;
    window.bulletinBoard.displayBulletins(resources);
  });
}

test.describe('Desktop resource shortcut panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedDesktopResources(page);
  });

  test('opens as a centered desktop panel with top three resources', async ({ page }) => {
    await page.evaluate(() => window.bulletinBoard.openResourceShortcut('food'));

    const sheet = page.locator('#catDetailSheet');
    await expect(sheet).toHaveClass(/open/);
    await expect(sheet).toHaveClass(/cat-detail-sheet--desktop/);
    await expect(sheet).not.toHaveClass(/cat-detail-sheet--bottom/);
    await expect(page.locator('#catDetailTitle')).toContainText('Food');
    await expect(page.locator('#catOrgList .cat-org-card')).toHaveCount(3);
    await expect(page.locator('#catOrgList')).not.toContainText('Weekend community supper');
    await expect(page.locator('[data-cat-show-all="food"]')).toBeVisible();
    await expect.poll(async () => {
      return sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return Math.round(rect.left + rect.width / 2 - window.innerWidth / 2);
      });
    }).toBe(0);
  });

  test('expands and dismisses without reverting to the full-page panel', async ({ page }) => {
    await page.evaluate(() => window.bulletinBoard.openResourceShortcut('food'));
    await page.locator('[data-cat-show-all="food"]').click();

    await expect(page.locator('#catOrgList .cat-org-card')).toHaveCount(4);
    await expect(page.locator('#catOrgList')).toContainText('Weekend community supper');

    await page.locator('#catDetailBackdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#catDetailSheet')).toHaveClass(/cat-detail-sheet--desktop/);
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/cat-detail-sheet--desktop/, { timeout: 1000 });
  });
});
