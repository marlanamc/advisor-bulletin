const { test, expect } = require('@playwright/test');

async function seedFeedPosts(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const posts = [
      {
        id: 'post-esol',
        type: 'post',
        title: 'Online English Conversation Groups',
        category: 'esol',
        description: 'Practice English on Zoom.',
        advisorName: 'Marlana',
        datePosted: now,
        isActive: true,
      },
      {
        id: 'post-training',
        type: 'post',
        title: 'Phlebotomy Training at Bunker Hill',
        category: 'training',
        classType: 'esol',
        tags: ['english'],
        description: 'Hospital job training.',
        advisorName: 'Marlana',
        datePosted: now,
        isActive: true,
      },
    ];
    window.bulletinBoard.bulletins = posts;
    window.bulletinBoard.displayBulletins(posts);
  });
}

test.describe('Feed category filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedFeedPosts(page);
  });

  test('English class shows its own label and hides training posts', async ({ page }) => {
    await page.locator('#feedCategorySelect').selectOption('esol');

    await expect(page.locator('#feedCategoryTitle')).toHaveText('English class');
    await expect(page.locator('#feedCategorySelect')).toHaveValue('esol');
    await expect(page.locator('#bulletinGrid')).toContainText('Online English Conversation Groups');
    await expect(page.locator('#bulletinGrid')).not.toContainText('Phlebotomy Training at Bunker Hill');
  });
});
