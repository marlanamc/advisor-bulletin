const { test, expect } = require('@playwright/test');
// Production CSP deliberately excludes local emulators.
test.use({ bypassCSP: true });

test('manual draft save, reload, validation and same-ID publication', async ({ page, request }) => {
  const email = 'drafttester@ebhcs.org';
  const password = 'draft-testing-only';
  const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
  let account = await (await request.post(`${authBase}/accounts:signUp?key=test`, { data: { email, password, returnSecureToken: true } })).json();
  if (!account.localId) account = await (await request.post(`${authBase}/accounts:signInWithPassword?key=test`, { data: { email, password, returnSecureToken: true } })).json();
  await request.post(`${authBase}/accounts:update?key=test`, { headers: { Authorization: 'Bearer owner' }, data: { localId: account.localId, emailVerified: true } });
  await request.patch('http://127.0.0.1:8080/v1/projects/ebhcs-bulletin-board/databases/(default)/documents/advisors/drafttester', {
    headers: { Authorization: 'Bearer owner' }, data: { fields: { displayName: { stringValue: 'Draft Tester' }, email: { stringValue: email } } },
  });
  await page.goto('/admin.html');
  await page.evaluate(async ({ email, password }) => {
    const { auth } = await import('/src/firebase.js');
    const { signInWithEmailAndPassword } = await import('/node_modules/.vite/deps/firebase_auth.js');
    await signInWithEmailAndPassword(auth, email, password);
  }, { email, password });
  await expect(page.locator('#apNavCreate')).toBeVisible();
  await page.locator('#apNavCreate').click();
  await page.locator('#cxTitle').fill('');
  await page.locator('#saveDraftBtn').click();
  await page.waitForFunction(() => window.adminPanel.draftId && !window.adminPanel.isSubmitting);
  const id = await page.evaluate(() => window.adminPanel.draftId);
  await page.locator('#cxTitle').fill('Unfinished private post');
  // Input does not save: the saved list remains untitled until the explicit click.
  expect(await page.evaluate(id => window.adminPanel.drafts.find(d => d.id === id).title, id)).toBe('');
  await page.locator('#saveDraftBtn').click();
  await page.waitForFunction(() => !window.adminPanel.isSubmitting);
  expect(await page.evaluate(() => window.adminPanel.draftId)).toBe(id);
  await page.reload();
  await page.locator('#apNavDrafts').click();
  await expect(page.locator('#myDraftsList')).toContainText('Unfinished private post');
  await page.locator(`[data-draft-id="${id}"][data-action="edit"]`).click();
  await expect(page.locator('#cxTitle')).toHaveValue('Unfinished private post');
  await page.locator('#cxSubmitBtn').click();
  await page.waitForFunction(() => !window.adminPanel.isSubmitting);
  expect(await page.evaluate(() => window.adminPanel.draftId)).toBe(id);
  await page.evaluate(() => {
    const category = document.querySelector('[data-cat="announcement"]');
    if (category) category.click();
  });
  await page.locator('#cxDesc').fill('A saved announcement.');
  await page.locator('#cxSubmitBtn').click();
  await page.waitForFunction(id => window.adminPanel.bulletins.some(b => b.id === id && b.isActive), id);
  expect(await page.evaluate(id => window.adminPanel.drafts.some(d => d.id === id), id)).toBe(false);
  expect(await page.evaluate(id => window.adminPanel.bulletins.find(b => b.id === id).draftData, id)).toBeUndefined();
  await page.waitForFunction(() => !window.adminPanel.isSubmitting);
  await page.evaluate(id => window.adminPanel.editBulletin(id), id);
  await page.locator('#apNavCreate').click();
  await expect(page.locator('#saveDraftBtn')).toBeHidden();
  await page.evaluate(() => window.adminPanel.resetForm({ stayOnCreate: true }));
  await page.locator('#apNavCreate').click();
  await expect(page.locator('#saveDraftBtn')).toBeVisible();
  await page.locator('#saveDraftBtn').click();
  await page.waitForFunction(() => window.adminPanel.draftId && !window.adminPanel.isSubmitting);
  const otherId = await page.evaluate(() => window.adminPanel.draftId);
  expect(otherId).not.toBe(id);
  await page.locator('#apNavDrafts').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator(`[data-draft-id="${otherId}"][data-action="delete"]`).click();
  await expect(page.locator(`[data-draft-id="${otherId}"]`)).toHaveCount(0);
  expect(await page.evaluate(id => window.adminPanel.bulletins.some(b => b.id === id && b.isActive), id)).toBe(true);
});
