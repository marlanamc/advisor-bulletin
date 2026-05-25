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

test.describe('Desktop resource shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedDesktopResources(page);
  });

  test('opens the resources view and shows every resource in the selected section', async ({ page }) => {
    await page.evaluate(() => window.bulletinBoard.openResourceShortcut('food'));

    await expect(page.locator('#resourcesView')).toHaveClass(/active/);
    await expect(page.locator('#resourcesView .back-home-btn')).toBeVisible();
    await expect(page.locator('#desktop-section-food')).toBeVisible();
    await expect(page.locator('#desktop-section-food')).toContainText('Food');
    await expect(page.locator('#desktop-section-food .mobile-resource-card')).toHaveCount(4);
    await expect(page.locator('#desktop-section-food .mobile-resource-card__phone').first()).toContainText('617-555-0101');
    await expect(page.locator('#desktop-section-food .mobile-resource-card__btn--primary')).toHaveCount(0);
    await expect(page.locator('#desktop-section-food')).toContainText('Weekend community supper');
    await expect(page.locator('#desktop-section-food [data-desktop-show-all="food"]')).toHaveCount(0);
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/open/);
  });
});
