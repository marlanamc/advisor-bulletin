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

    const resource = {
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
      isPublished: true
    };

    window.bulletinBoard.bulletins = [post, resource];
    window.bulletinBoard.populateAdvisorFilters();
    window.bulletinBoard.displayBulletins([post]);
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
    await expect(page.locator('#catDetailTitle')).toContainText('Health');
    await expect(page.locator('#catOrgList')).toContainText('Free Health Clinic');
  });

  test('collapses the mobile header on scroll without hiding story shortcuts', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 300));

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
