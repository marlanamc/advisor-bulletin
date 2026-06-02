const { test, expect } = require('@playwright/test');

async function showSeededAdvisorDashboard(page) {
  await page.goto('/admin.html');
  await page.waitForSelector('#loginForm');
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('userAuthenticated', {
      detail: { username: 'jorge', email: 'jorge@ebhcs.org', name: 'Jorge' },
    }));
  });
  await page.waitForFunction(() => typeof window.adminPanel?.updateAdvisorDashboard === 'function');
  await page.evaluate(() => {
    const loading = document.getElementById('authLoadingScreen');
    const login = document.getElementById('loginRequired');
    const panel = document.getElementById('adminPanel');
    if (loading) loading.style.display = 'none';
    if (login) login.style.display = 'none';
    if (panel) panel.style.display = 'block';

    if (typeof window.adminPanel.bulletinsUnsubscribe === 'function') {
      window.adminPanel.bulletinsUnsubscribe();
      window.adminPanel.bulletinsUnsubscribe = null;
    }

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
        deadline: '2027-05-30',
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

async function seedAdvisorEditFixtures(page) {
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
        id: 'edit-bulletin-1',
        type: 'post',
        title: 'Resume workshop this Friday',
        category: 'job',
        description: 'Bring a draft resume and questions for the career advisor.',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
      },
      {
        id: 'edit-event-1',
        type: 'post',
        title: 'College FAFSA night',
        category: 'announcement',
        dateType: 'event',
        eventDate: '2026-07-15',
        startTime: '17:30',
        endTime: '19:00',
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
      },
      {
        id: 'edit-resource-org-1',
        type: 'resource',
        resourceKind: 'organization',
        title: 'East Boston Family Center',
        titleEn: 'East Boston Family Center',
        titleEs: 'Centro Familiar de East Boston',
        resourceCategory: 'family',
        description: 'Help with childcare, family support, and referrals.',
        summaryEs: 'Ayuda con cuidado infantil, apoyo familiar y referidos.',
        url: 'https://example.org/family-center',
        phone: '617-555-0199',
        phoneMode: 'call',
        address: '10 Meridian St, East Boston',
        hours: 'Mon-Fri 9-5',
        serviceChips: ['Get childcare help', 'Talk to a family worker'],
        actionLinks: [
          {
            labelEn: 'Intake form',
            labelEs: 'Formulario',
            type: 'url',
            url: 'https://example.org/intake',
          },
        ],
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 10,
      },
      {
        id: 'edit-resource-doc-1',
        type: 'resource',
        resourceKind: 'document',
        title: 'Housing rights form',
        titleEn: 'Housing rights form',
        titleEs: 'Formulario de derechos de vivienda',
        resourceCategory: 'housing',
        description: 'Download the tenant rights worksheet.',
        summaryEs: 'Descarga la hoja de derechos del inquilino.',
        url: '',
        pdfUrl: 'https://example.org/housing-rights.pdf',
        serviceChips: ['Get housing help'],
        advisorName: 'Jorge',
        postedBy: 'jorge',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 20,
      },
    ];
    window.__capturedUpdates = [];
    window.adminPanel.updateBulletin = async function(formData, bulletinId) {
      const entries = {};
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          entries[key] = { name: value.name, size: value.size, type: value.type };
        } else if (Object.prototype.hasOwnProperty.call(entries, key)) {
          entries[key] = Array.isArray(entries[key]) ? [...entries[key], value] : [entries[key], value];
        } else {
          entries[key] = value;
        }
      }
      const bulletin = this.buildBulletinObject(formData);
      window.__capturedUpdates.push({
        bulletinId,
        contentMode: this.contentMode,
        contentType: this.contentType,
        entries,
        bulletin,
      });
    };
    window.adminPanel.loadManageBulletins();
  });
}

async function getLastCapturedUpdate(page) {
  await page.waitForFunction(() => window.__capturedUpdates?.length > 0);
  return page.evaluate(() => window.__capturedUpdates.at(-1));
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

  test('shows dashboard content stats and status insights', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await expect(page.locator('.ap-portal')).toBeVisible();
    await expect(page.locator('#statLivePosts')).toBeVisible();
    await expect(page.locator('#statLivePosts')).toContainText('2');
    await expect(page.locator('#statResources')).toContainText('0');
    await expect(page.locator('#statUpcomingEvents')).toContainText('0');
    await expect(page.locator('#statusBreakdownList')).toContainText('Expiring soon');
    await expect(page.locator('#contentHealthList')).toContainText('Live posts');
    await expect(page.locator('.manage-analytics-strip')).toHaveCount(0);
  });

  test('shows content stats page without engagement analytics', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await page.locator('#apNavStats').click();
    await expect(page.locator('#statsPublished')).toContainText('2');
    await expect(page.locator('#statsViews')).toContainText('0');
    await expect(page.locator('#statsUpcomingEvents')).toContainText('0');
    await expect(page.locator('#apPageStats .ap-top-posts')).toContainText('Free CNA class starts in June');
    await expect(page.locator('#analyticsRangeSelect')).toHaveCount(0);
    await expect(page.locator('#statsCatChart')).toContainText('Training');
    await expect(page.locator('#statsCatChart')).toContainText('Job Opp.');
    await expect(page.locator('#statsCatChart')).not.toContainText('Resource');
    await expect(page.locator('#statsPostCatChart')).toContainText('No content data yet');
    const donutSegments = await page.locator('#statsDonutSvg circle[data-segment]').evaluateAll(nodes =>
      nodes.map(node => ({
        dasharray: node.getAttribute('stroke-dasharray'),
        dashoffset: node.getAttribute('stroke-dashoffset'),
        opacity: node.style.opacity,
      }))
    );
    expect(donutSegments[0]).toEqual({ dasharray: '100 0', dashoffset: '-25', opacity: '1' });
    expect(donutSegments[1].opacity).toBe('0');
    expect(donutSegments[2].opacity).toBe('0');
  });

  test('stats page splits bulletin and resource category charts', async ({ page }) => {
    await seedAdvisorResources(page);

    await page.locator('#apNavStats').click();
    await expect(page.locator('#statsCatChart')).toContainText('No content data yet');
    await expect(page.locator('#statsCatChart')).not.toContainText('Resource');
    await expect(page.locator('#statsPostCatChart')).toContainText('Health / Salud');
    await expect(page.locator('#statsPostCatChart')).toContainText('Housing / Vivienda');
  });

  test('category picker stays in sync with bulletin category field', async ({ page }) => {
    await showSeededAdvisorDashboard(page);

    await page.locator('#apNavCreate').click();
    await page.locator('#cxCatBtn').click();
    await page.locator('#cxCatPop .cx-cat[data-cat="job"]').click();
    await page.locator('#cxTitle').fill('Hotel housekeeping interviews');
    await page.locator('#cxDesc').fill('Bring your resume and meet the hiring manager.');

    await expect(page.locator('#cxCatBtn')).toContainText('Job');
    await expect(page.locator('#bulletinForm [name="category"]')).toHaveValue('job');
    await expect(page.locator('#bulletinForm [name="title"]')).toHaveValue('Hotel housekeeping interviews');
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
    await expect(page.locator('#manageStatusPills')).toBeHidden();
    await expect(page.locator('#manageFilterSelect')).toBeHidden();
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

  test('shows the resource card preview when editing a resource', async ({ page }) => {
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
          id: 'resource-preview-1',
          type: 'resource',
          resourceKind: 'organization',
          title: 'East Boston Family Center',
          titleEn: 'East Boston Family Center',
          titleEs: 'Centro Familiar de East Boston',
          resourceCategory: 'family',
          description: 'Help with childcare, family support, and referrals.',
          summaryEs: 'Ayuda con cuidado infantil, apoyo familiar y referidos.',
          url: 'https://example.org/family-center',
          phone: '617-555-0199',
          phoneMode: 'call',
          address: '10 Meridian St, East Boston',
          serviceChips: ['Get childcare help', 'Talk to a family worker'],
          advisorName: 'Jorge',
          postedBy: 'jorge',
          datePosted: now,
          isActive: true,
          isPublished: true,
          resourceOrder: 10,
        },
      ];
      window.adminPanel.loadManageBulletins();
    });

    await page.locator('#apNavResources').click();
    const card = page.locator('#manage-card-resource-preview-1');
    await expect(card).toBeVisible();
    await card.locator('.edit-btn').click();

    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toBeVisible();
    await expect(page.locator('.ap-preview-card .ap-preview-pc')).toHaveCount(0);
    await expect(page.locator('.ap-preview-card .mobile-resource-card__title')).toContainText('East Boston Family Center');
    await expect(page.locator('.ap-preview-card .mobile-resource-card__summary')).toContainText('Help with childcare');
    await expect(page.locator('[data-preview-nav="resources"]')).toHaveClass(/active/);
  });

  test('edits a regular bulletin with post preview, synced mirrors, and post payload', async ({ page }) => {
    await seedAdvisorEditFixtures(page);

    await page.locator('#apNavBulletins').click();
    const card = page.locator('#manage-card-edit-bulletin-1');
    await expect(card).toBeVisible();
    await card.locator('.edit-btn').click();

    await expect(page.locator('[data-cx-type="bulletin"]')).toHaveClass(/active/);
    await expect(page.locator('#cxCatBtn')).toContainText('Job');
    await expect(page.locator('#cxTitle')).toHaveValue('Resume workshop this Friday');
    await expect(page.locator('#cxDesc')).toHaveValue('Bring a draft resume and questions for the career advisor.');
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('post');
    await expect(page.locator('#bulletinForm [name="category"]')).toHaveValue('job');
    await expect(page.locator('#bulletinForm [name="title"]')).toHaveValue('Resume workshop this Friday');
    await expect(page.locator('#bulletinForm [name="description"]')).toHaveValue('Bring a draft resume and questions for the career advisor.');
    await expect(page.locator('.ap-preview-card .ap-preview-pc')).toBeVisible();
    await expect(page.locator('.ap-preview-card .ap-preview-event-card')).toHaveCount(0);
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toHaveCount(0);
    await expect(page.locator('.ap-preview-card #previewTitle')).toContainText('Resume workshop this Friday');
    await expect(page.locator('[data-preview-nav="home"]')).toHaveClass(/active/);

    await page.locator('#cxSubmitBtn').click();
    const update = await getLastCapturedUpdate(page);
    expect(update.bulletinId).toBe('edit-bulletin-1');
    expect(update.contentMode).toBe('post');
    expect(update.bulletin).toMatchObject({
      type: 'post',
      title: 'Resume workshop this Friday',
      category: 'job',
      description: 'Bring a draft resume and questions for the career advisor.',
    });
    await expect(page.locator('#apNavBulletins')).toHaveClass(/active/);
  });

  test('edits a calendar event with event preview, date mirrors, and event submit routing', async ({ page }) => {
    await seedAdvisorEditFixtures(page);

    await page.locator('#apNavEvents').click();
    const card = page.locator('#manage-card-edit-event-1');
    await expect(card).toBeVisible();
    await card.locator('.edit-btn').click();

    await expect(page.locator('[data-cx-type="event"]')).toHaveClass(/active/);
    await expect(page.locator('#cxTitle')).toHaveValue('College FAFSA night');
    await expect(page.locator('#cxEvType')).toHaveValue('event');
    await expect(page.locator('#cxEvDate')).toHaveValue('2026-07-15');
    await expect(page.locator('#cxEvStart')).toHaveValue('17:30');
    await expect(page.locator('#cxEvEndTime')).toHaveValue('19:00');
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('post');
    await expect(page.locator('#bulletinForm [name="category"]')).toHaveValue('announcement');
    await expect(page.locator('#bulletinForm [name="dateType"]')).toHaveValue('event');
    await expect(page.locator('#bulletinForm [name="eventDate"]')).toHaveValue('2026-07-15');
    await expect(page.locator('#bulletinForm [name="startTime"]')).toHaveValue('17:30');
    await expect(page.locator('#bulletinForm [name="endTime"]')).toHaveValue('19:00');
    await expect(page.locator('.ap-preview-card .ap-preview-event-card')).toBeVisible();
    await expect(page.locator('.ap-preview-card .ap-preview-event-title')).toContainText('College FAFSA night');
    await expect(page.locator('.ap-preview-card .ap-preview-pc').filter({ hasNot: page.locator('.ap-preview-event-card') })).toHaveCount(0);
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toHaveCount(0);
    await expect(page.locator('[data-preview-nav="calendar"]')).toHaveClass(/active/);

    await page.locator('#cxSubmitBtn').click();
    const update = await getLastCapturedUpdate(page);
    expect(update.bulletinId).toBe('edit-event-1');
    expect(update.contentMode).toBe('event');
    expect(update.bulletin).toMatchObject({
      type: 'post',
      title: 'College FAFSA night',
      category: 'announcement',
      dateType: 'event',
      eventDate: '2026-07-15',
      startTime: '17:30',
      endTime: '19:00',
    });
    await expect(page.locator('#apNavEvents')).toHaveClass(/active/);
  });

  test('edits an organization resource with synced service/action mirrors and resource payload', async ({ page }) => {
    await seedAdvisorEditFixtures(page);

    await page.locator('#apNavResources').click();
    const card = page.locator('#manage-card-edit-resource-org-1');
    await expect(card).toBeVisible();
    await card.locator('.edit-btn').click();

    await expect(page.locator('[data-cx-type="resource"]')).toHaveClass(/active/);
    await expect(page.locator('[data-cx-reskind="organization"]')).toHaveClass(/sel/);
    await expect(page.locator('#cxCatBtn')).toContainText('Family');
    await expect(page.locator('#cxTitle')).toHaveValue('East Boston Family Center');
    await expect(page.locator('#cxDesc')).toHaveValue('Help with childcare, family support, and referrals.');
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('resource');
    await expect(page.locator('#bulletinForm [name="resourceKind"]')).toHaveValue('organization');
    await expect(page.locator('#bulletinForm [name="resourceCategory"]')).toHaveValue('family');
    await expect(page.locator('#bulletinForm [name="resourceTitleEn"]')).toHaveValue('East Boston Family Center');
    await expect(page.locator('#bulletinForm [name="resourceDescription"]')).toHaveValue('Help with childcare, family support, and referrals.');
    await expect(page.locator('#bulletinForm [name="resourceHighlights"]')).toHaveValue(/Get childcare help/);
    await expect(page.locator('#bulletinForm [name="resourceActionLink1LabelEn"]')).toHaveValue('Intake form');
    await expect(page.locator('#bulletinForm [name="resourceActionLink1Url"]')).toHaveValue('https://example.org/intake');
    await expect(page.locator('#cxBlocks [data-cx-block="extras"]')).toBeVisible();
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toBeVisible();
    await expect(page.locator('.ap-preview-card .mobile-resource-card__title')).toContainText('East Boston Family Center');
    await expect(page.locator('[data-preview-nav="resources"]')).toHaveClass(/active/);

    await page.locator('#cxSubmitBtn').click();
    const update = await getLastCapturedUpdate(page);
    expect(update.bulletinId).toBe('edit-resource-org-1');
    expect(update.contentMode).toBe('resource');
    expect(update.bulletin).toMatchObject({
      type: 'resource',
      resourceKind: 'organization',
      title: 'East Boston Family Center',
      titleEn: 'East Boston Family Center',
      resourceCategory: 'family',
      url: 'https://example.org/family-center',
      phone: '617-555-0199',
      address: '10 Meridian St, East Boston',
      isPublished: true,
    });
    expect(update.bulletin.serviceChips).toContain('Get childcare help');
    expect(update.bulletin.actionLinks).toEqual([
      expect.objectContaining({
        labelEn: 'Intake form',
        url: 'https://example.org/intake',
      }),
    ]);
    await expect(page.locator('#apNavResources')).toHaveClass(/active/);
  });

  test('edits a document resource with document UI, resource preview, and document payload', async ({ page }) => {
    await seedAdvisorEditFixtures(page);

    await page.locator('#apNavResources').click();
    const card = page.locator('#manage-card-edit-resource-doc-1');
    await expect(card).toBeVisible();
    await card.locator('.edit-btn').click();

    await expect(page.locator('[data-cx-type="resource"]')).toHaveClass(/active/);
    await expect(page.locator('[data-cx-reskind="document"]')).toHaveClass(/sel/);
    await expect(page.locator('#cxResourceHero')).toContainText('Drop the PDF or form');
    await expect(page.locator('#cxResourceHero')).toContainText('Choose PDF');
    await expect(page.locator('#cxCatBtn')).toContainText('Housing');
    await expect(page.locator('#cxTitle')).toHaveValue('Housing rights form');
    await expect(page.locator('#cxDesc')).toHaveValue('Download the tenant rights worksheet.');
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('resource');
    await expect(page.locator('#bulletinForm [name="resourceKind"]')).toHaveValue('document');
    await expect(page.locator('#bulletinForm [name="resourceCategory"]')).toHaveValue('housing');
    await expect(page.locator('#bulletinForm [name="resourceUrl"]')).toHaveValue('');
    await expect(page.locator('#bulletinForm [name="resourceAddress"]')).toHaveValue('');
    await expect(page.locator('#bulletinForm [name="resourcePhone"]')).toHaveValue('');
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toBeVisible();
    await expect(page.locator('.ap-preview-card .mobile-resource-card__title')).toContainText('Housing rights form');
    await expect(page.locator('.ap-preview-card .ap-preview-pc')).toHaveCount(0);
    await expect(page.locator('[data-preview-nav="resources"]')).toHaveClass(/active/);

    await page.locator('#cxSubmitBtn').click();
    const update = await getLastCapturedUpdate(page);
    expect(update.bulletinId).toBe('edit-resource-doc-1');
    expect(update.contentMode).toBe('resource');
    expect(update.bulletin).toMatchObject({
      type: 'resource',
      resourceKind: 'document',
      title: 'Housing rights form',
      resourceCategory: 'housing',
      url: '',
      address: '',
      phone: '',
      phoneMode: 'call',
    });
    expect(update.bulletin.serviceChips).toContain('Get housing help');
    await expect(page.locator('#apNavResources')).toHaveClass(/active/);
  });

  test('switches between edit targets without stale composer mode or preview state', async ({ page }) => {
    await seedAdvisorEditFixtures(page);

    await page.locator('#apNavResources').click();
    await page.locator('#manage-card-edit-resource-doc-1 .edit-btn').click();
    await expect(page.locator('[data-cx-type="resource"]')).toHaveClass(/active/);
    await expect(page.locator('[data-cx-reskind="document"]')).toHaveClass(/sel/);
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toBeVisible();

    await page.locator('#apNavEvents').click();
    await page.locator('#manage-card-edit-event-1 .edit-btn').click();
    await expect(page.locator('[data-cx-type="event"]')).toHaveClass(/active/);
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('post');
    await expect(page.locator('#bulletinForm [name="resourceKind"]')).toHaveValue('organization');
    await expect(page.locator('#bulletinForm [name="resourceHighlights"]')).toHaveValue('');
    await expect(page.locator('#cxTitle')).toHaveValue('College FAFSA night');
    await expect(page.locator('.ap-preview-card .ap-preview-event-card')).toBeVisible();
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toHaveCount(0);
    await expect(page.locator('[data-preview-nav="calendar"]')).toHaveClass(/active/);

    await page.locator('#apNavBulletins').click();
    await page.locator('#manage-card-edit-bulletin-1 .edit-btn').click();
    await expect(page.locator('[data-cx-type="bulletin"]')).toHaveClass(/active/);
    await expect(page.locator('#bulletinForm [name="contentType"]')).toHaveValue('post');
    await expect(page.locator('#bulletinForm [name="category"]')).toHaveValue('job');
    await expect(page.locator('#cxTitle')).toHaveValue('Resume workshop this Friday');
    await expect(page.locator('.ap-preview-card .ap-preview-pc')).toBeVisible();
    await expect(page.locator('.ap-preview-card .ap-preview-event-card')).toHaveCount(0);
    await expect(page.locator('.ap-preview-card .mobile-resource-card.ap-preview-resource-mock')).toHaveCount(0);
    await expect(page.locator('[data-preview-nav="home"]')).toHaveClass(/active/);
  });
});
