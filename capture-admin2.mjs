import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5174/admin.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const loginReq = document.getElementById('loginRequired');
  if (loginReq) loginReq.style.display = 'none';
  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) adminPanel.style.display = '';
  const msg = document.getElementById('welcomeMessage');
  if (msg) msg.textContent = 'Hi, Marlie 👋';
  const s1 = document.getElementById('statLivePosts'); if (s1) s1.textContent = '15';
  const s2 = document.getElementById('statResources'); if (s2) s2.textContent = '1';
  const s3 = document.getElementById('statStudentClicks'); if (s3) s3.textContent = '0';
  const s4 = document.getElementById('statExpiringSoon'); if (s4) s4.textContent = '0';
});
await page.waitForTimeout(500);
// Crop just the top portion
await page.screenshot({ path: '/tmp/admin-top.png', clip: { x: 0, y: 60, width: 1440, height: 500 } });
await browser.close();
console.log('Done');
