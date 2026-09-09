const { test, expect } = require('@playwright/test');

const FLYER = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="2400"><rect width="800" height="2400" fill="#4488cc"/></svg>'
).toString('base64');

async function openPostWithFlyer(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate((image) => {
    const post = {
      id: 'post-flyer',
      type: 'post',
      title: 'Flyer Post',
      category: 'announcement',
      description: 'lorem ipsum dolor sit amet '.repeat(400),
      advisorName: 'Fabiola',
      postedBy: 'fabiola',
      datePosted: new Date().toISOString(),
      isActive: true,
      isPublished: true,
      dateType: 'event',
      eventDate: '2026-12-24',
      startTime: '09:30',
      endTime: '10:30',
      image,
    };
    window.bulletinBoard.bulletins = [post];
    window.bulletinBoard.displayBulletins([post]);
    window.bulletinBoard.showBulletinDetail('post-flyer');
  }, FLYER);
  await expect(page.locator('#bulletinDetailModal')).toBeVisible();
}

test.describe('Flyer lightbox on mobile', () => {
  test('closing full screen leaves nothing covering the post', async ({ page }) => {
    await openPostWithFlyer(page);

    await page.locator('.lightbox-trigger').click();
    await expect(page.locator('#imgLightbox')).toHaveClass(/open/);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('imgLightbox')).visibility))
      .toBe('visible');

    await page.locator('#imgLightboxClose').click();
    await expect(page.locator('#imgLightbox')).not.toHaveClass(/open/);
    // visibility is transitioned out at the end of the fade.
    await expect.poll(
      () => page.evaluate(() => getComputedStyle(document.getElementById('imgLightbox')).visibility),
      { timeout: 2000 },
    ).toBe('hidden');

    const state = await page.evaluate(() => {
      const scroller = document.querySelector('.bulletin-detail-content');
      scroller.scrollTop = 600;
      return {
        scrollTop: scroller.scrollTop,
        focusInsideLightbox: document.getElementById('imgLightbox').contains(document.activeElement),
        imgSrc: document.getElementById('imgLightboxImg').getAttribute('src'),
        frameScrollTop: document.querySelector('.img-lightbox-frame').scrollTop,
      };
    });

    expect(state.scrollTop).toBe(600);
    expect(state.focusInsideLightbox).toBe(false);
    expect(state.imgSrc).toBeNull();
    expect(state.frameScrollTop).toBe(0);
  });

  test('closing full screen does not unlock the post modal scroll lock', async ({ page }) => {
    await openPostWithFlyer(page);

    await page.locator('.lightbox-trigger').click();
    await expect(page.locator('#imgLightbox')).toHaveClass(/open/);
    // Below the image frame, where the backdrop is the top-most element.
    const frameBox = await page.locator('.img-lightbox-frame').boundingBox();
    const viewport = page.viewportSize();
    await page.mouse.click(viewport.width / 2, (frameBox.y + frameBox.height + viewport.height) / 2);
    await expect(page.locator('#imgLightbox')).not.toHaveClass(/open/);

    const lock = await page.evaluate(() => ({
      bodyClass: document.body.className,
      bodyOverflow: getComputedStyle(document.body).overflow,
      detailVisible: document.getElementById('bulletinDetailModal').style.display,
    }));

    expect(lock.bodyClass).toContain('modal-open');
    expect(lock.bodyOverflow).toBe('hidden');
    expect(lock.detailVisible).toBe('flex');
  });

  test('reopening the flyer shows it again', async ({ page }) => {
    await openPostWithFlyer(page);

    await page.locator('.lightbox-trigger').click();
    await page.locator('#imgLightboxClose').click();
    await expect(page.locator('#imgLightbox')).not.toHaveClass(/open/);

    await page.locator('.lightbox-trigger').click();
    await expect(page.locator('#imgLightbox')).toHaveClass(/open/);
    await expect(page.locator('#imgLightboxImg')).toHaveAttribute('src', FLYER);
  });
});
