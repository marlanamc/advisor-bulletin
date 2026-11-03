// Spanish flyer PDFs are kept as their own downloadable file (pdfUrlEs), and
// students reading in Spanish open that file instead of the English PDF.
const { test, expect } = require('@playwright/test');

// The publish test writes a real post, which would replace the student test's
// seeded feed if both ran at once.
test.describe.configure({ mode: 'serial' });

// Production CSP deliberately excludes local emulators.
test.use({ bypassCSP: true });

function onePagePdf(label) {
  const stream = `BT /F1 24 Tf 72 700 Td (${label}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = body.length;
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test('student View PDF opens the PDF matching the reading language', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate(() => {
    const now = new Date().toISOString();
    const bulletins = [
      { id: 'pdf-both', type: 'post', title: 'Both flyers', category: 'food', description: 'x',
        pdfUrl: 'https://example.org/flyer-en.pdf', pdfUrlEs: 'https://example.org/flyer-es.pdf',
        advisorName: 'Test', datePosted: now, isActive: true },
      { id: 'pdf-es-only', type: 'post', title: 'Spanish flyer only', category: 'food', description: 'x',
        pdfUrlEs: 'https://example.org/only-es.pdf', advisorName: 'Test', datePosted: now, isActive: true },
    ];
    // Other specs write real posts to the shared emulator and the live feed
    // listener can't be paused, so pin the seeded posts in place.
    Object.defineProperty(window.bulletinBoard, 'bulletins', { get: () => bulletins, set: () => {}, configurable: true });
    window.bulletinBoard.bulletinsHydrated = true;
    window.bulletinBoard.displayBulletins(bulletins);
    window.__opened = [];
    window.open = (url) => { window.__opened.push(url); return {}; };
  });

  const openPdf = async (id) => {
    await page.evaluate((id) => window.bulletinBoard.showBulletinDetail(id), id);
    const before = await page.evaluate(() => window.__opened.length);
    await page.locator('#bulletinDetailBody [data-detail-action="open-pdf"]').dispatchEvent('click');
    // Opening the PDF is async; wait for window.open before reading it.
    await page.waitForFunction((n) => window.__opened.length > n, before);
    await page.locator('#closeBulletinDetail').dispatchEvent('click');
    return page.evaluate(() => window.__opened.at(-1));
  };

  expect(await openPdf('pdf-both')).toBe('https://example.org/flyer-en.pdf');
  // A post with only a Spanish PDF still offers it, even in English.
  expect(await openPdf('pdf-es-only')).toBe('https://example.org/only-es.pdf');

  await page.locator('[data-lang-switch="ES"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-lang', 'ES');
  expect(await openPdf('pdf-both')).toBe('https://example.org/flyer-es.pdf');
});

test('publishing with English and Spanish PDF flyers stores both PDFs', async ({ page, request }) => {
  test.setTimeout(90000);
  const email = 'pdftester@ebhcs.org';
  const password = 'pdf-testing-only';
  const authBase = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
  let account = await (await request.post(`${authBase}/accounts:signUp?key=test`, { data: { email, password, returnSecureToken: true } })).json();
  if (!account.localId) account = await (await request.post(`${authBase}/accounts:signInWithPassword?key=test`, { data: { email, password, returnSecureToken: true } })).json();
  await request.post(`${authBase}/accounts:update?key=test`, { headers: { Authorization: 'Bearer owner' }, data: { localId: account.localId, emailVerified: true } });
  await request.patch('http://127.0.0.1:8080/v1/projects/ebhcs-bulletin-board/databases/(default)/documents/advisors/pdftester', {
    headers: { Authorization: 'Bearer owner' }, data: { fields: { displayName: { stringValue: 'PDF Tester' }, email: { stringValue: email } } },
  });

  await page.goto('/admin.html');
  await page.evaluate(async ({ email, password }) => {
    const { auth } = await import('/src/firebase.js');
    const { signInWithEmailAndPassword } = await import('/node_modules/.vite/deps/firebase_auth.js');
    await signInWithEmailAndPassword(auth, email, password);
  }, { email, password });
  await expect(page.locator('#apNavCreate')).toBeVisible();
  await page.locator('#apNavCreate').click();

  // The pinned Playwright Chromium can't run pdfjs-dist 6's worker, so stand
  // in for only the page-1 -> image conversion. The real PDF files still go
  // through the upload path under test.
  await page.evaluate(() => {
    window.adminPanel.prepareFlyerSourceFile = async (file) => {
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 160;
      canvas.getContext('2d').fillRect(0, 0, 120, 160);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      return { uploadFile: new File([blob], file.name.replace(/\.pdf$/, '.png'), { type: 'image/png' }), pdfPageCount: 1 };
    };
  });
  await page.locator('#cxTitle').fill('Bilingual PDF flyer');
  await page.evaluate(() => document.querySelector('[data-cat="announcement"]')?.click());
  await page.locator('#cxDescEditor').fill('Flyer in both languages.');
  await page.locator('#_cxUploadEn').setInputFiles({ name: 'flyer-en.pdf', mimeType: 'application/pdf', buffer: onePagePdf('English') });
  await page.locator('#_cxUploadEs').setInputFiles({ name: 'flyer-es.pdf', mimeType: 'application/pdf', buffer: onePagePdf('Espanol') });
  await page.waitForFunction(() => window.adminPanel.pendingImageData && window.adminPanel.pendingImageEsData);
  await page.evaluate(() => {
    window.__toasts = [];
    const show = window.adminPanel.showTemporaryMessage.bind(window.adminPanel);
    window.adminPanel.showTemporaryMessage = (message, type) => { window.__toasts.push(message); return show(message, type); };
  });
  await page.locator('#cxSubmitBtn').dispatchEvent('click');
  await page.waitForFunction(() => window.__toasts.some((m) => /saved successfully|published/i.test(m)), null, { timeout: 30000 });
  // Both flyers' PDFs were uploaded (English, then Spanish).
  expect(await page.evaluate(() => window.__toasts.filter((m) => m === 'Uploading PDF...').length)).toBe(2);

  await page.evaluate(() => window.adminPanel.loadManageBulletins());
  await page.waitForFunction(() => (window.adminPanel.bulletins || []).some((b) => b.title === 'Bilingual PDF flyer' && b.isActive), null, { timeout: 15000 });
  const saved = await page.evaluate(() => window.adminPanel.bulletins.find((b) => b.title === 'Bilingual PDF flyer'));
  const str = (name) => saved[name] || '';
  expect(str('pdfUrl')).toBeTruthy();
  expect(str('pdfUrlEs')).toBeTruthy();
  expect(str('pdfUrl')).not.toBe(str('pdfUrlEs'));
  expect(decodeURIComponent(str('pdfUrlEs'))).toMatch(/_es\.pdf/);
  expect(decodeURIComponent(str('pdfUrl'))).not.toMatch(/_es\.pdf/);
  expect(str('image')).toBeTruthy();
  expect(str('imageEs')).toBeTruthy();
});
