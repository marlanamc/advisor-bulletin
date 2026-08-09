const { test, expect } = require('@playwright/test');

/**
 * Fixtures chosen to exercise the rules unified search actually promises:
 * accent-free typing, multi-word AND across fields, Spanish chip labels, and
 * posts and resources coming back from one query.
 */
async function seedSearchData(page) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();

    const resources = [
      {
        id: 'res-soup',
        title: 'East Boston Soup Kitchen',
        resourceCategory: 'food',
        description: 'Get a free hot meal and bags of food every Tuesday.',
        summaryEs: 'Reciba una comida caliente gratis y bolsas de comida todos los martes.',
        serviceChips: ['Get a hot meal', 'Get groceries'],
      },
      {
        id: 'res-moia',
        title: 'Mayor Office for Immigrant Advancement',
        resourceCategory: 'immigration',
        description: 'Get free legal advice from immigration lawyers by phone.',
        summaryEs: 'Reciba asesoría legal gratuita de abogados de inmigración por teléfono.',
        serviceChips: ['Get immigration help', 'Apply for citizenship'],
      },
      {
        id: 'res-raft',
        title: 'RAFT Rent Help',
        resourceCategory: 'housing',
        description: 'Get up to $7,000 to pay rent you owe.',
        summaryEs: 'Reciba hasta $7,000 para pagar renta atrasada.',
        serviceChips: ['Get rent help', 'Get housing help'],
      },
      {
        id: 'res-diapers',
        title: 'Ollie Diaper Depot',
        resourceCategory: 'family',
        description: 'Get free diapers and wipes once a month.',
        summaryEs: 'Consiga pañales y toallitas gratis una vez al mes.',
        serviceChips: ['Get diapers', 'Get baby supplies'],
      },
    ].map((r) => ({
      ...r,
      type: 'resource',
      titleEn: r.title,
      titleEs: r.title,
      category: 'resource',
      url: 'https://example.org',
      advisorName: 'Import',
      datePosted: now,
      isActive: true,
      isPublished: true,
    }));

    const posts = [
      {
        id: 'post-clinic',
        type: 'post',
        title: 'Free Immigration Consultation',
        titleEs: 'Consulta de inmigración gratis',
        category: 'announcement',
        description: 'Talk to a lawyer at the school on Friday.',
        advisorName: 'Marlana',
        datePosted: now,
        isActive: true,
      },
      {
        id: 'post-food-drive',
        type: 'post',
        title: 'Food Drive in East Boston',
        titleEs: 'Colecta de comida en East Boston',
        category: 'announcement',
        description: 'Bring canned food to the front office all week.',
        advisorName: 'Marlana',
        datePosted: now,
        isActive: true,
      },
    ];

    const all = [...resources, ...posts];
    window.bulletinBoard.bulletins = all;
    window.bulletinBoard.displayBulletins(all);
  });
}

async function openSearch(page, query) {
  await page.evaluate(() => window.bulletinBoard.openSearchLayer({ focusInput: false }));
  await page.locator('#searchInput').fill(query);
  await page.waitForTimeout(200);
}

function resultTitles(page) {
  return page.locator('.search-result__title .en-text').allTextContents();
}

test.describe('Unified search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await seedSearchData(page);
  });

  test('one query returns help and posts together, grouped with help first', async ({ page }) => {
    await openSearch(page, 'immigration');

    await expect(page.locator('[data-search-group="help"]')).toBeVisible();
    await expect(page.locator('[data-search-group="posts"]')).toBeVisible();

    const groups = await page.locator('.search-result-group').evaluateAll(
      (nodes) => nodes.map((n) => n.getAttribute('data-search-group')),
    );
    expect(groups[0]).toBe('help');
    await expect(page.locator('#searchResultsStatus')).toContainText('2 results');
  });

  test('typing without accents finds accented Spanish text', async ({ page }) => {
    await openSearch(page, 'inmigracion');
    expect(await resultTitles(page)).toContain('Mayor Office for Immigrant Advancement');
  });

  test('typing without tildes finds Spanish chip labels', async ({ page }) => {
    // "panales" -> "pañales", which only appears in the Spanish summary and the
    // translated chip, never in the English text.
    await openSearch(page, 'panales');
    expect(await resultTitles(page)).toContain('Ollie Diaper Depot');
  });

  test('multi-word query matches across separate fields', async ({ page }) => {
    await openSearch(page, 'food east boston');
    const titles = await resultTitles(page);
    expect(titles).toContain('East Boston Soup Kitchen');
    expect(titles).toContain('Food Drive in East Boston');
  });

  test('every word must match, so unrelated words return nothing', async ({ page }) => {
    await openSearch(page, 'diapers immigration');
    await expect(page.locator('.search-results-empty')).toBeVisible();
  });

  test('a title match outranks a passing mention', async ({ page }) => {
    await openSearch(page, 'rent');
    const titles = await resultTitles(page);
    expect(titles[0]).toBe('RAFT Rent Help');
  });

  test('stopwords do not exclude results', async ({ page }) => {
    await openSearch(page, 'ayuda de renta');
    expect(await resultTitles(page)).toContain('RAFT Rent Help');
  });

  test('clearing the search query hides results', async ({ page }) => {
    await openSearch(page, 'rent');
    await expect(page.locator('#searchResults')).toBeVisible();

    await page.locator('#searchInput').fill('');
    await page.waitForTimeout(200);
    await expect(page.locator('#searchResults')).toBeHidden();
  });

  test('no-match query shows the bilingual empty state', async ({ page }) => {
    await openSearch(page, 'zzzqqqxyz');
    await expect(page.locator('.search-results-empty')).toBeVisible();
    await expect(page.locator('#searchResultsStatus')).toContainText('No results');
  });

  test('opening a resource result jumps to its card and closes the overlay', async ({ page }) => {
    await openSearch(page, 'soup kitchen');
    const resourceId = await page.locator('.search-result').first().getAttribute('data-search-result-id');
    await page.locator('.search-result').first().click();
    await expect(page.locator('#searchLayer')).not.toHaveClass(/open/);
    await expect(page.locator('#bulletinDetailModal')).toBeHidden();
    await expect(page.locator(`[data-resource-id="${resourceId}"]`).first()).toBeVisible();
  });

  test('closing search restores browsing and clears every box', async ({ page }) => {
    await openSearch(page, 'rent');
    await page.evaluate(() => window.bulletinBoard.closeSearchLayer());

    await expect(page.locator('#searchLayer')).not.toHaveClass(/open/);
    await expect(page.locator('#searchInput')).toHaveValue('');
    expect(await page.evaluate(() => window.bulletinBoard.searchQuery)).toBe('');
  });

  test('searching from Help does not bounce the student back to the feed', async ({ page }) => {
    await page.evaluate(() => window.bulletinBoard.switchView('resources'));
    await openSearch(page, 'rent');

    await expect(page.locator('.search-result').first()).toBeVisible();
    expect(await page.evaluate(() => window.bulletinBoard.currentView)).toBe('resources');
  });

  test('browsing is never filtered by the search text', async ({ page }) => {
    const before = await page.evaluate(() => window.bulletinBoard.filteredPosts.length);
    await openSearch(page, 'rent');
    const during = await page.evaluate(() => window.bulletinBoard.filteredPosts.length);
    expect(during).toBe(before);
  });
});
