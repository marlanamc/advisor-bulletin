const { test, expect } = require('@playwright/test');

async function showSeededAdvisorDashboard(page) {
  await page.goto('/admin.html');
  await page.waitForFunction(() => window.adminPanel);
  await page.evaluate(() => {
    const login = document.getElementById('loginRequired');
    const panel = document.getElementById('adminPanel');
    if (login) login.style.display = 'none';
    if (panel) panel.style.display = 'block';

    window.adminPanel.currentUser = {
      username: 'jorge',
      name: 'Jorge',
      email: 'jorge@ebhcs.org',
    };

    window.adminPanel.bulletins = [
      {
        id: 'post-1',
        type: 'post',
        title: 'Free CNA class starts in June',
        category: 'training',
        description: 'Become a Certified Nursing Assistant. 8 weeks. Free.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: new Date().toISOString(),
        deadline: '2026-05-30',
        isActive: true,
      },
      {
        id: 'post-2',
        type: 'post',
        title: 'Hotel Housekeeping',
        category: 'job',
        description: 'Hyatt is hiring.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: new Date().toISOString(),
        isActive: true,
      },
    ];

    window.adminPanel.analyticsEvents = [
      { postId: 'post-1', category: 'training', action: 'detail_open', source: 'student' },
      { postId: 'post-1', category: 'training', action: 'link_click', source: 'student' },
      { postId: 'post-2', category: 'job', action: 'share_click', source: 'student' },
    ];

    window.adminPanel.aggregateAnalytics();
    window.adminPanel.updateAdvisorDashboard();
    window.adminPanel.loadManageBulletins();
  });
}

test.describe('Advisor redesign', () => {
  test('renders the redesigned advisor login screen', async ({ page }) => {
    await page.goto('/admin.html');

    await expect(page.locator('.advisor-login-card')).toBeVisible();
    await expect(page.locator('.advisor-login-card')).toContainText('Advisor Portal');
    await expect(page.locator('.advisor-login-card')).toContainText('mcreed@ebhcs.org');
  });

  test('shows dashboard stats, insights, and per-post analytics', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await expect(page.locator('.advisor-shell')).toBeVisible();
    await expect(page.locator('#statLivePosts')).toContainText('2');
    await expect(page.locator('#statStudentClicks')).toContainText('3');
    await expect(page.locator('#analyticsActionList')).toContainText('Detail opens');
    await expect(page.locator('#analyticsTopPosts')).toContainText('Free CNA class starts in June');
    await expect(page.locator('.manage-analytics-strip').first()).toContainText('opens');
  });

  test('category picker stays in sync with bulletin category field', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await page.locator('[data-category-pick="job"]').click();
    await page.locator('#title').fill('Hotel housekeeping interviews');
    await page.locator('#description').fill('Bring your resume and meet the hiring manager.');

    await expect(page.locator('[data-category-pick="job"]')).toHaveClass(/active/);
    await expect(page.locator('#category')).toHaveValue('job');
    await expect(page.locator('#title')).toHaveValue('Hotel housekeeping interviews');
  });
});
