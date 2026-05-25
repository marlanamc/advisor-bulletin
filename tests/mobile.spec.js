const { test, expect } = require('@playwright/test');

async function seedDemoContent(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const post = {
      id: 'post-1',
      type: 'post',
      title: 'Spring Job Fair',
      category: 'career-fair',
      description: 'Meet local employers and practice quick introductions.',
      advisorName: 'Jorge',
      postedBy: 'jorge',
      datePosted: now,
      isActive: true,
      isPublished: true,
      dateType: 'event',
      eventDate: '2026-03-20',
      startTime: '10:00',
      endTime: '13:00',
      eventLink: 'https://example.org/job-fair'
    };

    const resources = [
      {
      id: 'resource-1',
      type: 'resource',
      title: 'Free Health Clinic',
      titleEn: 'Free Health Clinic',
      titleEs: 'Clinica Gratis',
      category: 'resource',
      resourceCategory: 'health',
      resourceIcon: 'heart',
      url: 'https://example.org/clinic',
      eventLink: 'https://example.org/clinic',
      description: 'Walk-in care and interpreter support.',
      advisorName: 'Jorge',
      postedBy: 'jorge',
      datePosted: now,
      isActive: true,
      isPublished: true,
      phone: '617-555-0101',
      resourceOrder: 10
      },
      {
        id: 'resource-2',
        type: 'resource',
        title: 'Neighborhood Health Access',
        titleEn: 'Neighborhood Health Access',
        titleEs: 'Acceso de Salud',
        category: 'resource',
        resourceCategory: 'health',
        resourceIcon: 'heart',
        url: 'https://example.org/health-access',
        description: 'Help finding appointments and basic care.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 20
      },
      {
        id: 'resource-3',
        type: 'resource',
        title: 'Family Wellness Line',
        titleEn: 'Family Wellness Line',
        titleEs: 'Linea de Bienestar',
        category: 'resource',
        resourceCategory: 'health',
        resourceIcon: 'heart',
        url: 'https://example.org/wellness',
        description: 'Free support by phone.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 30
      },
      {
        id: 'resource-4',
        type: 'resource',
        title: 'East Boston Vaccines',
        titleEn: 'East Boston Vaccines',
        titleEs: 'Vacunas en East Boston',
        category: 'resource',
        resourceCategory: 'health',
        resourceIcon: 'heart',
        url: 'https://example.org/vaccines',
        description: 'Seasonal vaccine information.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 40
      }
    ];

    window.bulletinBoard.bulletins = [post, ...resources];
    window.bulletinBoard.populateAdvisorFilters();
    window.bulletinBoard.displayBulletins([post, ...resources]);
  });
}

test.describe('Mobile app shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedDemoContent(page);
  });

  test('shows mobile bottom navigation with four tabs', async ({ page }) => {
    const tabBar = page.locator('.mobile-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'Home' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'Dates' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'Help' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'About' })).toBeVisible();
  });

  test('keeps resource bubbles prominent on the feed', async ({ page }) => {
    const storyBubble = page.locator('#feedStoryCats .story-bubble').first();
    await expect(storyBubble).toBeVisible();
    await expect(page.locator('#feedStoryCats')).toContainText('Immigration');
    await expect(page.locator('#feedStoryCats')).toContainText('Housing');
    await expect(page.locator('#feedStoryCats')).toContainText('Jobs');
    await expect(page.locator('#feedStoryCats')).toContainText('Health');
  });

  test('resource story bubbles open the category detail sheet', async ({ page }) => {
    await page.locator('#feedStoryCats [data-app-view-cat="health"]').click();

    await expect(page.locator('#catDetailSheet')).toHaveClass(/open/);
    await expect(page.locator('#catDetailSheet')).toHaveClass(/cat-detail-sheet--bottom/);
    await expect(page.locator('#catDetailTitle')).toContainText('Health');
    await expect(page.locator('#catOrgList')).toContainText('Free Health Clinic');
    await expect.poll(async () => {
      return page.locator('#catDetailSheet').evaluate((sheet) => Math.round(sheet.getBoundingClientRect().left));
    }).toBe(0);
  });

  test('resource sheet shows a compact subtitle instead of a clipped description', async ({ page }) => {
    await page.evaluate(() => {
      const now = new Date().toISOString();
      window.bulletinBoard.bulletins = [{
        id: 'resource-immigration-1',
        type: 'resource',
        title: 'La Colaborativa',
        titleEn: 'La Colaborativa',
        titleEs: 'La Colaborativa',
        category: 'resource',
        resourceCategory: 'immigration',
        resourceIcon: 'globe',
        description: 'Community support for immigrants and families in Greater Boston, including food support, classes, jobs, health resources, citizenship help, and community advocacy.',
        address: '318 Broadway, Chelsea, MA 02150',
        phone: '617-555-0101',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 10,
      }];
      window.bulletinBoard.displayBulletins(window.bulletinBoard.bulletins);
    });

    await page.locator('#feedStoryCats [data-app-view-cat="immigration"]').click();

    await expect(page.locator('#catOrgList .help-sheet-row__meta')).toContainText('318 Broadway · Chelsea');
    await expect(page.locator('#catOrgList .mobile-resource-card__description')).toHaveCount(0);
    await expect(page.locator('#catOrgList .cat-org-address')).toHaveCount(0);
  });

  test('resource sheet shows top three places and can expand', async ({ page }) => {
    await page.locator('#feedStoryCats [data-app-view-cat="health"]').click();

    await expect(page.locator('#catOrgList .help-sheet-row')).toHaveCount(3);
    await expect(page.locator('#catOrgList')).not.toContainText('East Boston Vaccines');
    await expect(page.locator('[data-cat-show-all="health"]')).toBeVisible();

    await page.locator('[data-cat-show-all="health"]').click();
    await expect(page.locator('#catOrgList .help-sheet-row')).toHaveCount(4);
    await expect(page.locator('#catOrgList')).toContainText('East Boston Vaccines');
  });

  test('resource sheet closes from x, backdrop, and swipe down while keeping feed active', async ({ page }) => {
    const openSheet = async () => {
      await page.locator('#feedStoryCats [data-app-view-cat="health"]').click();
      await expect(page.locator('#catDetailSheet')).toHaveClass(/open/);
    };

    await openSheet();
    await page.getByLabel('Close help').click();
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#feedView')).toHaveClass(/active/);

    await openSheet();
    await page.locator('#catDetailBackdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#catDetailSheet')).toHaveClass(/cat-detail-sheet--bottom/);
    await expect(page.locator('#feedView')).toHaveClass(/active/);
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/cat-detail-sheet--bottom/, { timeout: 1000 });

    await openSheet();
    await page.locator('#catDetailSheet .cat-detail-topbar').evaluate((topbar) => {
      topbar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientY: 100 }));
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: 220 }));
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientY: 220 }));
    });
    await expect(page.locator('#catDetailSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#feedView')).toHaveClass(/active/);
  });

  test('collapses the mobile header on scroll without hiding story shortcuts', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '1200px';
      window.scrollTo(0, 300);
      window.dispatchEvent(new Event('scroll'));
    });

    await expect(page.locator('header')).toHaveClass(/collapsed/);
    await expect(page.locator('#feedStoryCats .story-bubble').first()).toBeVisible();
  });

  test('opens search from the mobile header instead of showing an inline search bar', async ({ page }) => {
    const searchTrigger = page.locator('#mobileSearchTrigger');
    await expect(searchTrigger).toBeVisible();

    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toBeHidden();

    await searchTrigger.click();
    await expect(page.locator('#searchLayer')).toHaveClass(/open/);
    await expect(searchInput).toBeVisible();

    await page.locator('#closeSearchLayer').click();
    await expect(page.locator('#searchLayer')).not.toHaveClass(/open/);
  });

  test('switches to the dedicated resources view from bottom nav', async ({ page }) => {
    await page.locator('.mobile-tab[data-app-view="resources"]').click();
    await page.evaluate(() => window.bulletinBoard.switchResourceCategory('health'));

    await expect(page.locator('#resourcesView')).toHaveClass(/active/);
    await expect(page.locator('#resourcesList .resource-card').first()).toBeVisible();
    await expect(page.locator('#resourcesList')).toContainText('Free Health Clinic');
    await expect(page.locator('#resourcesList')).toContainText('Clinica Gratis');
  });

  test('switches to calendar and about views cleanly', async ({ page }) => {
    await page.getByRole('button', { name: 'Dates' }).click();
    await expect(page.locator('#calendarView')).toHaveClass(/active/);
    await expect(page.locator('#bulletinCalendar')).toBeVisible();
    await expect(page.locator('#bulletinCalendar')).toContainText('Spring Job Fair');

    await page.getByRole('button', { name: 'About' }).click();
    await expect(page.locator('#aboutView')).toHaveClass(/active/);
    await expect(page.locator('#aboutView')).toContainText('East Boston Harborside Community School');
    await expect(page.locator('#aboutView')).toContainText('Adult Education');
    await expect(page.locator('#aboutView')).toContainText('ebhcs.org');
    await expect(page.locator('#aboutView')).toContainText('312 Border Street');
  });
});
