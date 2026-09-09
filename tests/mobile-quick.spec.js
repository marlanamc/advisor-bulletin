const { test, expect } = require('@playwright/test');

async function seedDemoContent(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const post = {
      id: 'post-quick',
      type: 'post',
      title: 'Housing Workshop',
      category: 'announcement',
      description: 'Bring your questions for a short housing information session.',
      advisorName: 'Fabiola',
      postedBy: 'fabiola',
      datePosted: now,
      isActive: true,
      isPublished: true,
      dateType: 'event',
      eventDate: '2026-03-24',
      startTime: '09:30',
      endTime: '10:30'
    };

    const resource = {
      id: 'resource-quick',
      type: 'resource',
      title: 'Legal Help',
      titleEn: 'Legal Help',
      titleEs: 'Ayuda Legal',
      category: 'resource',
      resourceCategory: 'legal-aid',
      resourceIcon: 'scale',
      url: 'https://example.org/legal',
      eventLink: 'https://example.org/legal',
      hoursRows: [
        { day: 'Revival Church, 965 Bennington St: Tuesday', time: '9am–10am' },
        { day: 'Church Faro de Luz, 282 Meridian St: every other Tuesday', time: '12pm–1pm' },
        { day: 'Paris Street BCYF, 112 Paris St: Tuesday & Friday', time: '12pm–2pm' },
        { day: 'Grace Federated Church, 760 Saratoga St: 1st & 2nd Saturday', time: '7am–9am' }
      ],
      description: 'Know-your-rights information and referrals.',
      advisorName: 'Fabiola',
      postedBy: 'fabiola',
      datePosted: now,
      isActive: true,
      isPublished: true
    };

    window.bulletinBoard.bulletins = [post, resource];
    window.bulletinBoard.populateAdvisorFilters();
    window.bulletinBoard.displayBulletins([post, resource]);
  });
}

test.describe('Quick mobile checks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedDemoContent(page);
  });

  test('resources view shows category chips and cards', async ({ page }) => {
    await page.locator('.mobile-tab[data-app-view="resources"]').click();
    await expect(page.locator('.resource-category-tile')).toHaveCount(13);
    await page.evaluate(() => window.bulletinBoard.switchResourceCategory('legal-aid'));
    await expect(page.locator('.resource-card, .mobile-resource-card').first()).toBeVisible();
  });

  test('Help chips do not create a horizontal scroller on mobile', async ({ page }) => {
    await page.locator('.mobile-tab[data-app-view="resources"]').click();

    const layout = await page.evaluate(() => {
      const chipRail = document.querySelector('#resourcesView .resource-need__top');
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        chipRailWidth: chipRail?.scrollWidth ?? 0,
        chipRailViewport: chipRail?.clientWidth ?? 0
      };
    });

    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.chipRailWidth).toBeLessThanOrEqual(layout.chipRailViewport + 1);
  });

  test('Help schedule rows wrap long locations without horizontal overflow', async ({ page }) => {
    await page.locator('.mobile-tab[data-app-view="resources"]').click();
    await page.evaluate(() => {
      const resource = {
        id: 'location-layout-test',
        type: 'resource',
        category: 'resource',
        title: 'YMCA Grocery Bag Distribution',
        titleEn: 'YMCA Grocery Bag Distribution',
        titleEs: 'Bolsas de comida gratis del YMCA',
        resourceCategory: 'food',
        description: 'Get free grocery bags at several East Boston locations.',
        hoursRows: [
          { day: 'Revival Church, 965 Bennington St: Tuesday', time: '9am–10am' },
          { day: 'Church Faro de Luz, 282 Meridian St: every other Tuesday', time: '12pm–1pm' },
          { day: 'Paris Street BCYF, 112 Paris St: Tuesday & Friday', time: '12pm–2pm' },
          { day: 'Grace Federated Church, 760 Saratoga St: 1st & 2nd Saturday', time: '7am–9am' }
        ]
      };
      const host = document.createElement('div');
      host.id = 'location-layout-test-host';
      host.style.maxWidth = '100%';
      host.innerHTML = window.bulletinBoard.createHelpResourceCard(resource);
      document.body.append(host);
    });

    const resourceCard = page.locator('#location-layout-test-host [data-resource-id="location-layout-test"]');
    await expect(resourceCard.locator('.mobile-resource-card__hours--locations')).toBeVisible();
    await expect(resourceCard.locator('.mobile-resource-card__hours-label')).toContainText('Pickup locations');
    const scheduleRow = resourceCard.locator('.mobile-resource-card__hours-row').first();
    await expect(scheduleRow).toBeVisible();
    const dimensions = await scheduleRow.evaluate((row) => ({
      contentWidth: row.scrollWidth,
      visibleWidth: row.clientWidth,
      locationTop: row.querySelector('.mobile-resource-card__hours-days')?.offsetTop ?? 0,
      timeTop: row.querySelector('.mobile-resource-card__hours-times')?.offsetTop ?? 0,
      timeWidth: row.querySelector('.mobile-resource-card__hours-times')?.clientWidth ?? 0
    }));

    expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.visibleWidth + 1);
    expect(dimensions.timeTop).toBeGreaterThan(dimensions.locationTop);
    expect(dimensions.timeWidth).toBeGreaterThan(0);
  });

  test('feed bulletin detail modal still opens on mobile', async ({ page }) => {
    await page.evaluate(() => {
      window.bulletinBoard.showBulletinDetail('post-quick');
    });

    await expect(page.locator('#bulletinDetailModal')).toBeVisible();
    await expect(page.locator('#bulletinDetailBody')).toContainText('Housing Workshop');
  });

  test('mobile header search opens the search sheet', async ({ page }) => {
    await page.locator('#mobileSearchTrigger').click();
    await expect(page.locator('#searchLayer')).toHaveClass(/open/);
    await expect(page.locator('#searchInput')).toBeVisible();
  });

  test('mobile tab bar keeps touch-size buttons', async ({ page }) => {
    const firstTab = page.locator('.mobile-tab').first();
    const box = await firstTab.boundingBox();

    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
