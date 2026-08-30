const { test, expect } = require('@playwright/test');

const RESOURCE_CATEGORIES = [
  'jobs',
  'immigration',
  'housing',
  'food',
  'health',
  'family',
  'family-community',
  'money',
  'legal-aid',
  'hse',
  'college',
  'general',
  'consulates',
];

const CATEGORY_COUNTS = {
  jobs: 7,
  immigration: 8,
  housing: 10,
  food: 9,
  health: 7,
  family: 7,
  'family-community': 6,
  money: 6,
  'legal-aid': 7,
  hse: 5,
  college: 6,
  general: 4,
  consulates: 7,
};

const EXPECTED_RESOURCE_TOTAL = Object.values(CATEGORY_COUNTS).reduce((sum, count) => sum + count, 0);

async function seedLargeResourceDirectory(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(({ categories, counts }) => {
    const now = new Date().toISOString();
    const resources = [];
    let resourceIndex = 0;

    for (const category of categories) {
      const count = counts[category];
      for (let i = 1; i <= count; i += 1) {
        resourceIndex += 1;
        resources.push({
          id: `resource-smoke-${category}-${i}`,
          type: 'resource',
          title: `${category} Resource ${i}`,
          titleEn: `${category} Resource ${i}`,
          titleEs: `${category} Recurso ${i}`,
          category: 'resource',
          resourceCategory: category,
          url: `https://example.org/${category}/${i}`,
          eventLink: `https://example.org/${category}/${i}`,
          description: `Current help for ${category} resource ${i}.`,
          serviceChips: i % 2 === 0 ? ['Get help', 'Apply online'] : ['Find help'],
          address: i % 3 === 0 ? `${100 + i} Border St, Boston, MA 02128` : '',
          phone: i % 4 === 0 ? `617-555-${String(1000 + i).slice(-4)}` : '',
          actionLinks: i === 1 ? [{
            labelEn: 'Start application',
            labelEs: 'Comenzar solicitud',
            url: `https://example.org/${category}/${i}/apply`,
            pdfUrl: '',
          }] : [],
          advisorName: 'Resource Team',
          postedBy: 'resource-team',
          datePosted: now,
          isActive: true,
          isPublished: true,
          resourceOrder: resourceIndex,
          lastVerified: '2026-08',
        });
      }
    }

    window.bulletinBoard.bulletins = resources;
    window.bulletinBoard.displayBulletins(resources);
  }, { categories: RESOURCE_CATEGORIES, counts: CATEGORY_COUNTS });
}

test.describe('Resource directory smoke coverage', () => {
  test('renders all seeded resources through mobile category navigation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Large-resource smoke test runs once on the mobile resource layout.');

    await page.goto('/');
    await page.locator('.mobile-tab[data-app-view="resources"]').click();
    await seedLargeResourceDirectory(page);

    let visibleTotal = 0;
    const visibleResourceRows = page.locator('#resourcesList .mobile-resource-card, #resourcesList .help-sheet-row');
    for (const category of RESOURCE_CATEGORIES) {
      await page.evaluate((resourceCategory) => {
        window.bulletinBoard.switchView('resources', { skipRender: true });
        window.bulletinBoard.switchResourceCategory(resourceCategory);
        window.bulletinBoard.renderResourcesSections(window.bulletinBoard.getPublishedResources());
      }, category);
      await expect(page.locator('#resourceCategoryDetail')).toBeVisible();
      await expect(visibleResourceRows).toHaveCount(CATEGORY_COUNTS[category]);
      await expect(page.locator('#resourcesList')).toContainText(`${category} Resource 1`);
      visibleTotal += CATEGORY_COUNTS[category];

      await page.evaluate(() => {
        window.bulletinBoard.switchResourceCategory('all');
        window.bulletinBoard.renderResourcesSections(window.bulletinBoard.getPublishedResources());
      });
    }

    expect(visibleTotal).toBe(EXPECTED_RESOURCE_TOTAL);
  });

  test('renders desktop resource cards with usable action controls', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Action-control smoke test runs once on the desktop card layout.');

    await page.goto('/');
    await page.waitForFunction(() => window.bulletinBoard);
    await page.evaluate(() => window.bulletinBoard.openResourceShortcut('jobs'));
    await seedLargeResourceDirectory(page);
    await page.evaluate(() => window.bulletinBoard.openResourceShortcut('jobs'));

    await expect(page.locator('#desktop-section-jobs .mobile-resource-card')).toHaveCount(CATEGORY_COUNTS.jobs);
    const firstCard = page.locator('#desktop-section-jobs .mobile-resource-card').first();
    await expect(firstCard.locator('.mobile-resource-card__btn--secondary', { hasText: 'Website' })).toHaveAttribute('href', 'https://example.org/jobs/1');
    await expect(firstCard.locator('.mobile-resource-card__btn--action-link')).toHaveAttribute('href', 'https://example.org/jobs/1/apply');
    await expect(firstCard.locator('.mobile-resource-card__btn--action-link')).toContainText('Start application');

    const phoneCard = page.locator('#desktop-section-jobs .mobile-resource-card[data-resource-id="resource-smoke-jobs-4"]');
    await expect(phoneCard.locator('.mobile-resource-card__phone')).toContainText('617-555-1004');

    const directionsCard = page.locator('#desktop-section-jobs .mobile-resource-card[data-resource-id="resource-smoke-jobs-3"]');
    await expect(directionsCard.locator('.mobile-resource-card__btn--directions', { hasText: 'Directions' })).toHaveAttribute('href', /google\.com\/maps/);

    const badButtons = await page.locator('#desktop-section-jobs .mobile-resource-card__btn').evaluateAll((buttons) =>
      buttons
        .map((button) => ({
          text: button.textContent.trim(),
          href: button.getAttribute('href') || '',
        }))
        .filter((button) => !button.text || (button.href && button.href === '#'))
    );
    expect(badButtons).toEqual([]);
  });
});
