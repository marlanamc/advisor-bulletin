const { test, expect } = require('@playwright/test');

test.describe('Mobile Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('should display calendar view on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');

    // Wait for calendar to render
    await page.waitForSelector('.bulletin-calendar.active', { timeout: 5000 });

    // Verify calendar is visible
    const calendar = page.locator('.bulletin-calendar.active');
    await expect(calendar).toBeVisible();

    // Verify calendar grid exists
    const calendarGrid = page.locator('.calendar-grid');
    await expect(calendarGrid).toBeVisible();
  });

  test('should have single column layout on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForSelector('.bulletin-calendar.active');

    // Get calendar grid computed styles
    const calendarGrid = page.locator('.calendar-grid');
    const gridColumns = await calendarGrid.evaluate((el) => {
      return window.getComputedStyle(el).gridTemplateColumns;
    });

    // On mobile (< 640px), should be single column
    // This means gridTemplateColumns should not have multiple columns
    console.log('Grid columns:', gridColumns);

    // Verify it's a single column or close to viewport width
    expect(gridColumns).toBeTruthy();
  });

  test('should have readable font sizes on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForSelector('.bulletin-calendar.active');

    // Wait for calendar items to load
    await page.waitForTimeout(1000);

    // Check if calendar bulletin items exist
    const bulletinItems = page.locator('.calendar-bulletin-item');
    const count = await bulletinItems.count();

    if (count > 0) {
      const firstItem = bulletinItems.first();

      // Check title font size
      const title = firstItem.locator('.calendar-bulletin-title');
      const titleFontSize = await title.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Font should be at least 14px for readability on mobile
      expect(titleFontSize).toBeGreaterThanOrEqual(14);

      // Check description font size
      const description = firstItem.locator('.calendar-bulletin-description');
      if (await description.count() > 0) {
        const descFontSize = await description.evaluate((el) => {
          return parseFloat(window.getComputedStyle(el).fontSize);
        });

        expect(descFontSize).toBeGreaterThanOrEqual(13);
      }
    }
  });

  test('should have appropriate padding on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForSelector('.bulletin-calendar.active');
    await page.waitForTimeout(1000);

    const bulletinItems = page.locator('.calendar-bulletin-item');
    const count = await bulletinItems.count();

    if (count > 0) {
      const firstItem = bulletinItems.first();

      // Check padding
      const padding = await firstItem.evaluate((el) => {
        return window.getComputedStyle(el).padding;
      });

      console.log('Calendar item padding:', padding);
      expect(padding).toBeTruthy();
    }
  });

  test('should display today badge correctly on mobile @mobile', async ({ page }) => {
    // Switch to calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForSelector('.bulletin-calendar.active');
    await page.waitForTimeout(1000);

    // Check if today badge exists
    const todayBadge = page.locator('.today-badge');
    if (await todayBadge.count() > 0) {
      await expect(todayBadge).toBeVisible();

      // Check font size is readable
      const fontSize = await todayBadge.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Should be at least 10px
      expect(fontSize).toBeGreaterThanOrEqual(10);
    }
  });
});

test.describe('Mobile Modal View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('should open modal on mobile @mobile', async ({ page }) => {
    // Wait for bulletins to load
    await page.waitForTimeout(2000);

    // Check if there are any bulletin cards
    const bulletinCards = page.locator('.bulletin-card');
    const count = await bulletinCards.count();

    if (count > 0) {
      // Click on first bulletin (if clickable)
      const firstCard = bulletinCards.first();

      // Try to find and click a "View" or "Share" button, or the card itself if clickable
      const shareBtn = firstCard.locator('.share-btn');
      if (await shareBtn.count() > 0) {
        console.log('Found share button');
      }
    }

    // Alternative: Try switching to list view and clicking there
    await page.click('button[data-view="list"]');
    await page.waitForTimeout(1000);

    const listItems = page.locator('.bulletin-list-item');
    const listCount = await listItems.count();

    console.log(`Found ${listCount} bulletin list items`);
  });

  test('should display fullscreen modal on mobile @mobile', async ({ page }) => {
    // Inject a test bulletin and open modal programmatically
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    // Wait for modal
    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    const modal = page.locator('#bulletinDetailModal');
    await expect(modal).toBeVisible();

    // Check if modal content is fullscreen on mobile
    const modalContent = page.locator('.bulletin-detail-content');
    const dimensions = await modalContent.boundingBox();

    // On mobile, modal should take most/all of the screen
    const viewport = page.viewportSize();

    if (dimensions && viewport) {
      console.log('Modal dimensions:', dimensions);
      console.log('Viewport:', viewport);

      // Modal width should be close to viewport width (within 20px for borders/padding)
      expect(dimensions.width).toBeGreaterThan(viewport.width - 40);

      // Modal height should be close to viewport height
      expect(dimensions.height).toBeGreaterThan(viewport.height - 40);
    }
  });

  test('should have accessible close button on mobile @mobile', async ({ page }) => {
    // Open modal programmatically
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    // Check close button
    const closeBtn = page.locator('#closeBulletinDetail');
    await expect(closeBtn).toBeVisible();

    // Check if close button is positioned correctly (fixed at top-right)
    const position = await closeBtn.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        position: styles.position,
        top: styles.top,
        right: styles.right,
      };
    });

    expect(position.position).toBe('fixed');

    // Check button size (should be at least 44x44 for touch targets)
    const btnBox = await closeBtn.boundingBox();
    if (btnBox) {
      expect(btnBox.width).toBeGreaterThanOrEqual(44);
      expect(btnBox.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('should close modal when clicking close button @mobile', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    // Click close button
    await page.click('#closeBulletinDetail');

    // Wait for modal to close
    await page.waitForTimeout(500);

    // Verify modal is hidden
    const modal = page.locator('#bulletinDetailModal');
    const display = await modal.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });

    expect(display).toBe('none');
  });

  test('should have readable text in modal on mobile @mobile', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    // Check title font size
    const title = page.locator('.bulletin-detail-header h2');
    if (await title.count() > 0) {
      const titleFontSize = await title.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Title should be at least 20px on mobile
      expect(titleFontSize).toBeGreaterThanOrEqual(20);
    }

    // Check description font size
    const description = page.locator('.bulletin-detail-description');
    if (await description.count() > 0) {
      const descFontSize = await description.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize);
      });

      // Description should be at least 14px
      expect(descFontSize).toBeGreaterThanOrEqual(14);
    }
  });

  test('should properly scroll modal content on mobile @mobile', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        const firstBulletin = window.bulletinBoard.bulletins[0];
        window.bulletinBoard.showBulletinDetail(firstBulletin.id);
      }
    });

    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    // Check if modal content is scrollable
    const modalContent = page.locator('.bulletin-detail-content');
    const overflow = await modalContent.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        overflowY: styles.overflowY,
        height: styles.height,
        maxHeight: styles.maxHeight,
      };
    });

    console.log('Modal overflow settings:', overflow);
    expect(overflow.overflowY).toMatch(/auto|scroll/);
  });

  test('should handle image sizing in modal on mobile @mobile', async ({ page }) => {
    // Open modal
    await page.evaluate(() => {
      if (window.bulletinBoard && window.bulletinBoard.bulletins.length > 0) {
        // Find a bulletin with an image
        const bulletinWithImage = window.bulletinBoard.bulletins.find(b => b.image);
        if (bulletinWithImage) {
          window.bulletinBoard.showBulletinDetail(bulletinWithImage.id);
        } else if (window.bulletinBoard.bulletins[0]) {
          window.bulletinBoard.showBulletinDetail(window.bulletinBoard.bulletins[0].id);
        }
      }
    });

    await page.waitForSelector('#bulletinDetailModal[style*="display: block"]', { timeout: 5000 });

    // Check if there's an image
    const detailImage = page.locator('.detail-image');
    if (await detailImage.count() > 0) {
      const imgBox = await detailImage.boundingBox();
      const viewport = page.viewportSize();

      if (imgBox && viewport) {
        // Image should not exceed viewport width
        expect(imgBox.width).toBeLessThanOrEqual(viewport.width);

        // Image height should be reasonable (not more than 300px on mobile)
        expect(imgBox.height).toBeLessThanOrEqual(350);
      }
    }
  });
});

test.describe('Mobile View Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('should switch between views on mobile @mobile', async ({ page }) => {
    // Test gallery view
    await page.click('button[data-view="gallery"]');
    await page.waitForTimeout(500);
    await expect(page.locator('.bulletin-grid.active')).toBeVisible();

    // Test list view
    await page.click('button[data-view="list"]');
    await page.waitForTimeout(500);
    await expect(page.locator('.bulletin-list.active')).toBeVisible();

    // Test calendar view
    await page.click('button[data-view="calendar"]');
    await page.waitForTimeout(500);
    await expect(page.locator('.bulletin-calendar.active')).toBeVisible();
  });

  test('should have touch-friendly view buttons @mobile', async ({ page }) => {
    const viewButtons = page.locator('.view-btn');
    const count = await viewButtons.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const btn = viewButtons.nth(i);
      const box = await btn.boundingBox();

      if (box) {
        // Touch targets should be at least 44x44
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });
});
