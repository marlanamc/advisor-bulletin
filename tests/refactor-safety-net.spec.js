/**
 * Refactor safety net (Stage 0 of the "split large files" plan).
 *
 * These specs pin behaviour that the file-splitting refactor must not
 * change: student bulletin detail / share / language / PDF, and the admin
 * create / delete / validation / workforce flows that the existing
 * advisor-redesign.spec.js does not already cover.
 *
 * Seeding follows the patterns already used in feed-category.spec.js and
 * advisor-redesign.spec.js: drive window.bulletinBoard / window.adminPanel
 * directly and stub the Firestore write methods to capture payloads.
 */
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Student board
// ---------------------------------------------------------------------------

async function seedStudentFeed(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const bulletins = [
      {
        id: 'sn-post-1',
        type: 'post',
        title: 'Resume workshop this Friday',
        category: 'job',
        description: 'Bring a draft resume and questions for the career advisor.',
        advisorName: 'Marlana',
        datePosted: now,
        isActive: true,
      },
      {
        id: 'sn-resource-doc-1',
        type: 'resource',
        resourceKind: 'document',
        title: 'Housing rights form',
        titleEn: 'Housing rights form',
        resourceCategory: 'housing',
        description: 'Download the tenant rights worksheet.',
        pdfUrl: 'https://example.org/housing-rights.pdf',
        advisorName: 'Import',
        datePosted: now,
        isActive: true,
        isPublished: true,
        resourceOrder: 10,
      },
    ];
    window.bulletinBoard.bulletins = bulletins;
    window.bulletinBoard.bulletinsHydrated = true;
    window.bulletinBoard.displayBulletins(bulletins);
  });
  await expect(page.locator('#bulletinGrid')).toContainText('Resume workshop this Friday');
}

test.describe('Student board — refactor safety net', () => {
  test('opens and closes a bulletin detail modal', async ({ page }) => {
    await seedStudentFeed(page);

    await page.evaluate(() => window.bulletinBoard.showBulletinDetail('sn-post-1'));

    const modal = page.locator('#bulletinDetailModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#bulletinDetailBody')).toContainText('Resume workshop this Friday');
    await expect(page.locator('#bulletinDetailBody')).toContainText('Bring a draft resume');

    await page.locator('#closeBulletinDetail').click();
    await expect(modal).toBeHidden();
  });

  test('language toggle flips document state and button pressed state', async ({ page }) => {
    await seedStudentFeed(page);

    await page.locator('[data-lang-switch="ES"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-lang', 'ES');
    await expect(page.locator('[data-lang-switch="ES"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-lang-switch="EN"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-lang-switch="EN"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-lang', 'EN');
    await expect(page.locator('[data-lang-switch="EN"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('share modal opens with a deep link + share options and closes', async ({ page }) => {
    await seedStudentFeed(page);

    await page.evaluate(() => window.shareBulletin('sn-post-1', 'Resume workshop this Friday'));

    const modal = page.locator('.share-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#shareLink')).toHaveValue(/#bulletin-sn-post-1$/);
    await expect(modal.locator('.share-option.whatsapp')).toBeVisible();
    await expect(modal.locator('.close-share')).toBeVisible();

    await page.evaluate(() => window.closeShareModal());
    await expect(page.locator('.share-modal')).toHaveCount(0);
  });

  test('copyLink selects the share link input without throwing', async ({ page }) => {
    await seedStudentFeed(page);
    await page.evaluate(() => window.shareBulletin('sn-post-1', 'Resume workshop this Friday'));

    await page.evaluate(() => window.copyLink());
    // copyLink() reads #shareLink, selects it, and relabels the copy button.
    await expect(page.locator('.share-modal .copy-btn')).toHaveText('Copied!');
  });

  test('opening a PDF resource invokes the PDF viewer path', async ({ page }) => {
    await seedStudentFeed(page);

    // Stub the actual viewer so the test does not fetch a real PDF; assert the
    // wiring from openPdfFromBulletin -> openResourcePdf is intact.
    await page.evaluate(() => {
      window.__pdfOpens = [];
      window.bulletinBoard.openResourcePdf = async (url, meta) => {
        window.__pdfOpens.push({ url, meta });
      };
    });
    await page.evaluate(() => window.bulletinBoard.openPdfFromBulletin('sn-resource-doc-1'));

    const opens = await page.evaluate(() => window.__pdfOpens);
    expect(opens).toHaveLength(1);
    expect(opens[0].url).toBe('https://example.org/housing-rights.pdf');
  });
});

// ---------------------------------------------------------------------------
// Advisor portal
// ---------------------------------------------------------------------------

async function showAdvisorPortal(page) {
  await page.goto('/admin.html');
  await page.waitForSelector('#googleSignInBtn');
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent('userAuthenticated', {
      detail: { username: 'rocha', email: 'rocha@ebhcs.org', name: 'Jorge' },
    }));
  });
  await page.waitForFunction(() => typeof window.adminPanel?.updateAdvisorDashboard === 'function');
  await page.evaluate(() => {
    for (const id of ['authLoadingScreen', 'loginRequired']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    const panel = document.getElementById('adminPanel');
    if (panel) panel.style.display = 'block';
    if (typeof window.adminPanel.bulletinsUnsubscribe === 'function') {
      window.adminPanel.bulletinsUnsubscribe();
      window.adminPanel.bulletinsUnsubscribe = null;
    }
    window.adminPanel.currentUser = { username: 'rocha', name: 'Jorge', email: 'rocha@ebhcs.org' };
    window.adminPanel.bulletins = [];
    window.adminPanel.updateAdvisorDashboard();
  });
}

test.describe('Advisor portal — refactor safety net', () => {
  test('creates a bulletin and routes the payload through createBulletin', async ({ page }) => {
    await showAdvisorPortal(page);
    await page.waitForFunction(() => typeof window.PostComposer?.selectComposerType === 'function');

    await page.evaluate(() => {
      window.__created = [];
      window.adminPanel.createBulletin = async function (formData) {
        window.__created.push(this.buildBulletinObject(formData));
        return 'new-id';
      };
    });

    await page.locator('#apNavCreate').click();
    await page.locator('[data-cx-type="bulletin"]').click();
    await page.locator('#cxCatBtn').click();
    await page.locator('#cxCatPop .cx-cat[data-cat="job"]').click();
    await page.locator('#cxTitle').fill('Warehouse hiring event');
    await page.locator('#cxDesc').fill('Walk-in interviews Thursday 10am to 2pm.');
    await page.locator('#cxSubmitBtn').click();

    await page.waitForFunction(() => window.__created?.length > 0);
    const created = await page.evaluate(() => window.__created.at(-1));
    expect(created).toMatchObject({
      type: 'post',
      title: 'Warehouse hiring event',
      category: 'job',
      description: 'Walk-in interviews Thursday 10am to 2pm.',
    });
  });

  test('deleteBulletin opens a confirm dialog; cancel dismisses it, confirm runs onConfirm', async ({ page }) => {
    await showAdvisorPortal(page);
    await page.evaluate(() => {
      // showConfirmDialog is the shared primitive; wrap it to record the
      // onConfirm callback so we can assert the confirm path without a real
      // Firestore write.
      const original = window.adminPanel.showConfirmDialog.bind(window.adminPanel);
      window.__confirmRan = 0;
      window.adminPanel.showConfirmDialog = (title, body, onConfirm) =>
        original(title, body, async () => { window.__confirmRan += 1; await onConfirm().catch(() => {}); });
      window.adminPanel.showTemporaryMessage = () => {};
    });

    // Cancel path
    await page.evaluate(() => window.adminPanel.deleteBulletin('del-cancel'));
    await expect(page.locator('#inlineConfirmDialog')).toBeVisible();
    await page.locator('#confirmDialogCancel').click();
    await expect(page.locator('#inlineConfirmDialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.__confirmRan)).toBe(0);

    // Confirm path
    await page.evaluate(() => window.adminPanel.deleteBulletin('del-ok'));
    await expect(page.locator('#inlineConfirmDialog')).toBeVisible();
    await page.locator('#confirmDialogOk').click();
    await expect(page.locator('#inlineConfirmDialog')).toHaveCount(0);
    await page.waitForFunction(() => window.__confirmRan === 1);
  });

  test('content moderation flags scam-pattern content and passes clean content', async ({ page }) => {
    await showAdvisorPortal(page);

    const dirty = await page.evaluate(() =>
      window.adminPanel.validateBulletinContent({
        title: 'GUARANTEED INCOME NOW!!!!!!',
        description: 'No experience required $5000 per week work from home, click here now money.',
      }),
    );
    expect(dirty.isClean).toBe(false);
    expect(dirty.warnings.length).toBeGreaterThan(0);

    const clean = await page.evaluate(() =>
      window.adminPanel.validateBulletinContent({
        title: 'Resume workshop this Friday',
        description: 'Bring a draft resume and questions for the career advisor.',
      }),
    );
    expect(clean.isClean).toBe(true);
  });

  test('workforce report page renders from fixture data without error', async ({ page }) => {
    await page.route('**/data/workforce/workforce-report.json', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          generated_on: '2026-08-01',
          stats: { students_analyzed: 120, gave_career_goal: 90, industries_represented: 14, top3_share_pct: 55 },
          program_fit_stats: { candidate_programs: 8, strong_fit: 5, needs_attention: 2, blocked: 1 },
          analysis_summary: ['Most students named healthcare or education goals.'],
          program_fit_summary: ['Two programs need review for prerequisite gaps.'],
          industries: [],
          programs: [],
        }),
      }),
    );

    await showAdvisorPortal(page);
    await page.evaluate(() => {
      const btn = document.getElementById('apNavWorkforce') || document.getElementById('workforceRailBtn');
      if (btn) btn.style.display = '';
      window.apShowPage('workforce');
    });

    await expect(page.locator('#workforceContent')).toBeVisible();
    await expect(page.locator('#workforceBannerMeta')).toContainText('updated 2026-08-01');
    await expect(page.locator('#workforceAnalysisSummary')).toContainText('healthcare or education');
  });
});
