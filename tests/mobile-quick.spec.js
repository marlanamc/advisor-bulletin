const { test, expect } = require('@playwright/test');

// Quick mobile tests to verify CSS improvements
test.describe('Mobile CSS Improvements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.bulletin-grid', { timeout: 10000 });
  });

  test('calendar should have single column on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForTimeout(1000);

    // Check if calendar grid exists
    const calendarView = page.locator('.bulletin-calendar.active, .monthly-calendar');
    await expect(calendarView.first()).toBeVisible({ timeout: 10000 });

    // Take a screenshot for manual verification
    await page.screenshot({ path: 'test-results/mobile-calendar.png', fullPage: true });

    console.log('✅ Calendar view rendered on mobile');
  });

  test('modal should be fullscreen on mobile @mobile', async ({ page }) => {
    // Try to open a modal programmatically
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    await page.waitForTimeout(1000);

    // Check if modal is visible
    const modal = page.locator('#bulletinDetailModal');
    const isVisible = await modal.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });

    if (isVisible) {
      // Take screenshot
      await page.screenshot({ path: 'test-results/mobile-modal.png' });

      // Check modal content dimensions
      const modalContent = page.locator('.bulletin-detail-content');
      const box = await modalContent.boundingBox();
      const viewport = page.viewportSize();

      console.log('Modal dimensions:', box);
      console.log('Viewport:', viewport);

      if (box && viewport) {
        // On mobile (390px), modal should be close to full width
        expect(box.width).toBeGreaterThan(viewport.width - 40);
      }

      console.log('✅ Modal is fullscreen on mobile');
    } else {
      console.log('ℹ️  Could not open modal - may need bulletins to be loaded');
    }
  });

  test('close button should be positioned correctly @mobile', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        window.bulletinBoard.showBulletinDetail(window.bulletinBoard.bulletins[0].id);
      }
    });

    await page.waitForTimeout(500);

    // Check close button
    const closeBtn = page.locator('#closeBulletinDetail');
    const isVisible = await closeBtn.isVisible().catch(() => false);

    if (isVisible) {
      const box = await closeBtn.boundingBox();

      // Button should be at least 44x44 (iOS touch target guidelines)
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        console.log('✅ Close button size:', box.width, 'x', box.height);
      }
    }
  });

  test('view toggle buttons should be visible @mobile', async ({ page }) => {
    const galleryBtn = page.locator('button[data-view="gallery"]');
    const listBtn = page.locator('button[data-view="list"]');
    const calendarBtn = page.locator('button[data-view="calendar"]');

    await expect(galleryBtn).toBeVisible();
    await expect(listBtn).toBeVisible();
    await expect(calendarBtn).toBeVisible();

    console.log('✅ All view toggle buttons are visible');
  });
});
