const { test, expect } = require('@playwright/test');

async function showSeededAdvisorDashboard(page) {
  await page.goto('/admin.html');
  await page.waitForSelector('#loginForm');
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('userAuthenticated', {
      detail: { username: 'jorge', email: 'jorge@ebhcs.org', name: 'Jorge' },
    }));
  });
  await page.waitForFunction(() => typeof window.adminPanel?.aggregateAnalytics === 'function');
  await page.evaluate(() => {
    const loading = document.getElementById('authLoadingScreen');
    const login = document.getElementById('loginRequired');
    const panel = document.getElementById('adminPanel');
    if (loading) loading.style.display = 'none';
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
      { postId: 'post-1', category: 'training', action: 'card_view', source: 'student' },
      { postId: 'post-1', category: 'training', action: 'detail_open', source: 'student' },
      { postId: 'post-1', category: 'training', action: 'link_click', source: 'student' },
      { postId: 'post-1', category: 'training', action: 'pdf_open', source: 'student' },
      { postId: 'post-2', category: 'job', action: 'share_click', source: 'student' },
    ];

    window.adminPanel.aggregateAnalytics();
    window.adminPanel.updateAdvisorDashboard();
    window.adminPanel.loadManageBulletins();
  });
}

async function isolateSeededReorderList(page) {
  await page.evaluate(() => {
    const resources = window.adminPanel.bulletins.filter(item => ['resource-1', 'resource-2', 'resource-3'].includes(item.id));
    window.adminPanel.bulletins = resources;
    window.adminPanel.loadManageBulletins = () => {
      window.adminPanel.renderResourceReorderView(document.getElementById('manageBulletins'), resources);
    };
    window.adminPanel.loadManageBulletins();
  });
}

async function seedAdvisorResources(page) {
  await showSeededAdvisorDashboard(page);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    window.adminPanel.currentUser = {
      username: 'jorge',
      name: 'Jorge',
      email: 'jorge@ebhcs.org',
      isAdmin: false,
    };
    window.adminPanel.bulletins = [
      {
        id: 'resource-1',
        type: 'resource',
        title: 'Find Your Funds',
        titleEn: 'Find Your Funds',
        resourceCategory: 'health',
        advisorName: 'Import',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 10,
      },
      {
        id: 'resource-2',
        type: 'resource',
        title: 'East Boston ABCD',
        titleEn: 'East Boston ABCD',
        resourceCategory: 'health',
        advisorName: 'Import',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 20,
      },
      {
        id: 'resource-3',
        type: 'resource',
        title: 'Central Community Church',
        titleEn: 'Central Community Church',
        resourceCategory: 'housing',
        advisorName: 'Import',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 10,
      },
    ];
    window.__savedResourceOrders = [];
    window.adminPanel.reorderResourcesInCategory = async (category, orderedIds) => {
      window.__savedResourceOrders.push({ category, orderedIds });
      orderedIds.forEach((id, index) => {
        const bulletin = window.adminPanel.bulletins.find(item => item.id === id);
        if (bulletin) bulletin.resourceOrder = (index + 1) * 10;
      });
    };
    window.adminPanel.loadManageBulletins();
  });
}

test.describe('Advisor redesign', () => {
  test('renders the redesigned advisor login screen', async ({ page }) => {
    await page.goto('/admin.html');

    await expect(page.locator('#loginForm')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.advisor-login-card')).toBeVisible();
    await expect(page.locator('.advisor-login-card')).toContainText('Advisor Portal');
    await expect(page.locator('.advisor-login-card')).toContainText('mcreed@ebhcs.org');
  });

  test('keeps the advisor toast hidden on the mobile login screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin.html');

    await expect(page.locator('#loginForm')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.advisor-login-card')).toBeVisible();
    await expect(page.locator('#apToast')).not.toBeVisible();
    await expect(page.locator('#apToastMsg')).toHaveText('Post published!');

    const toastBox = await page.locator('#apToast').boundingBox();
    const toastStyle = await page.locator('#apToast').evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { opacity: style.opacity, position: style.position };
    });
    expect(toastBox).toBeTruthy();
    expect(toastStyle).toEqual({ opacity: '0', position: 'fixed' });
    expect(toastBox.y).toBeGreaterThan(700);
  });

  test('shows dashboard stats, insights, and per-post analytics', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await expect(page.locator('.ap-portal')).toBeVisible();
    await expect(page.locator('#statLivePosts')).toBeVisible();
    await expect(page.locator('#statStudentClicks')).toContainText('2');
    await expect(page.locator('#analyticsActionList')).toContainText('Detail opens');
    await expect(page.locator('#analyticsTopPosts')).toContainText('Free CNA class starts in June');
    await expect(page.locator('.manage-analytics-strip').first()).toContainText('3');
    await expect(page.locator('.manage-analytics-strip').first()).toContainText('engaged');
  });

  test('lets advisors change the analytics time period', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await expect(page.locator('#analyticsRangeInlineLabel')).toContainText('last 30 days');
    await page.locator('#analyticsRangeSelect').selectOption('90');

    await expect(page.locator('#analyticsRangeInlineLabel')).toContainText('last 90 days');
    await expect(page.locator('#analyticsRangeStatsLabel')).toContainText('last 90 days');
    await expect(page.locator('#analyticsRangeTopPostsLabel')).toContainText('Last 90 days');
    await expect(page.locator('#statStudentClicks')).toContainText('0');
  });

  test('category picker stays in sync with bulletin category field', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await page.locator('#apNavCreate').click();
    await page.locator('[data-category-pick="job"]').click();
    await page.locator('#title').fill('Hotel housekeeping interviews');
    await page.locator('#description').fill('Bring your resume and meet the hiring manager.');

    await expect(page.locator('[data-category-pick="job"]')).toHaveClass(/active/);
    await expect(page.locator('#category')).toHaveValue('job');
    await expect(page.locator('#title')).toHaveValue('Hotel housekeeping interviews');
  });

  test('uses the redesigned advisor portal on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await showSeededAdvisorDashboard(page);

    await expect(page.locator('#mobApp')).toHaveCount(0);
    await expect(page.locator('.ap-portal')).toBeVisible();
    await expect(page.locator('.ap-sidebar')).toBeVisible();
    await expect(page.locator('#apNavCreate')).toBeVisible();
    await expect(page.locator('#statLivePosts')).toBeVisible();

    const mobileShell = await page.evaluate(() => {
      const portal = document.querySelector('.ap-portal').getBoundingClientRect();
      const sidebar = document.querySelector('.ap-sidebar').getBoundingClientRect();
      const firstNav = document.querySelector('#apNavCreate').getBoundingClientRect();
      return {
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        portalWidth: portal.width,
        sidebarWidth: sidebar.width,
        firstNavLeft: firstNav.left,
        firstNavWidth: firstNav.width,
        viewportWidth: window.innerWidth,
        portalLeft: portal.left,
        portalRadius: window.getComputedStyle(document.querySelector('.ap-portal')).borderRadius,
        portalPadding: window.getComputedStyle(document.querySelector('.ap-portal')).paddingTop,
        portalMargin: window.getComputedStyle(document.querySelector('.ap-portal')).marginTop,
      };
    });
    expect(mobileShell.hasHorizontalOverflow).toBe(false);
    expect(mobileShell.portalWidth).toBeLessThanOrEqual(mobileShell.viewportWidth + 1);
    expect(mobileShell.portalWidth).toBeGreaterThanOrEqual(mobileShell.viewportWidth - 1);
    expect(mobileShell.portalLeft).toBeGreaterThanOrEqual(-1);
    expect(mobileShell.portalLeft).toBeLessThanOrEqual(1);
    expect(mobileShell.sidebarWidth).toBeLessThanOrEqual(mobileShell.viewportWidth + 1);
    expect(mobileShell.firstNavLeft).toBeGreaterThanOrEqual(0);
    expect(mobileShell.firstNavWidth).toBeGreaterThan(44);
    expect(mobileShell.portalRadius).toBe('0px');
    expect(mobileShell.portalPadding).toBe('0px');
    expect(mobileShell.portalMargin).toBe('0px');
  });

  test('reorders resources by dragging on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAdvisorResources(page);

    await page.locator('#apNavResources').click();
    await page.locator('#manageReorderToggle').click();
    await isolateSeededReorderList(page);

    const healthSection = page.locator('.reorder-section[data-category="health"]');
    await expect(healthSection).toBeVisible();
    expect(await page.evaluate(() => Boolean(document.getElementById('manageBulletins')._resourceReorderPointerBound))).toBe(true);
    await expect(healthSection.locator('.reorder-touch-controls')).toHaveCount(0);
    await expect(healthSection.locator('.reorder-handle').first()).toBeVisible();
    expect(await page.evaluate(() => window.matchMedia('(max-width: 768px)').matches)).toBe(true);
    await expect(healthSection.locator('.reorder-card').first()).toContainText('Find Your Funds');
    await healthSection.locator('.reorder-card').first().scrollIntoViewIfNeeded();

    const firstHandle = healthSection.locator('.reorder-card').first().locator('.reorder-handle');
    const secondCard = healthSection.locator('.reorder-card').nth(1);
    await secondCard.scrollIntoViewIfNeeded();
    const handleBox = await firstHandle.boundingBox();
    const secondBox = await secondCard.boundingBox();
    expect(handleBox).toBeTruthy();
    expect(secondBox).toBeTruthy();
    expect(await page.evaluate(({ x, y }) => {
      return document.elementFromPoint(x, y)?.closest?.('.reorder-handle') !== null;
    }, {
      x: handleBox.x + handleBox.width / 2,
      y: handleBox.y + handleBox.height / 2,
    })).toBe(true);

    await firstHandle.dispatchEvent('mousedown', {
      button: 0,
      clientX: handleBox.x + handleBox.width / 2,
      clientY: handleBox.y + handleBox.height / 2,
    });
    expect(await page.evaluate(() => document.body.classList.contains('is-resource-reordering'))).toBe(true);
    await page.evaluate(({ x, y }) => {
      document.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }));
      document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }));
    }, {
      x: secondBox.x + secondBox.width / 2,
      y: secondBox.y + secondBox.height * 0.75,
    });

    await expect(healthSection.locator('.reorder-card').first()).toContainText('East Boston ABCD');
    await expect(healthSection.locator('.reorder-card').nth(1)).toContainText('Find Your Funds');
    await page.waitForFunction(() => window.__savedResourceOrders?.length === 1);

    const savedOrders = await page.evaluate(() => window.__savedResourceOrders);
    expect(savedOrders).toEqual([
      { category: 'health', orderedIds: ['resource-2', 'resource-1'] },
    ]);
  });
});
