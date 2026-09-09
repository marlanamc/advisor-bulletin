const { test, expect } = require('@playwright/test');

// Dates are far enough out that nothing here trips the "expired" path, and
// far enough apart that "next upcoming" is unambiguous.
const EVENT_BULLETIN = {
  id: 'post-job-fair',
  type: 'post',
  title: 'Harborside Job Fair',
  category: 'job',
  description: 'Bring your ID; resumes welcome.',
  address: '312 Border St, East Boston, MA',
  phone: '(617) 555-0142',
  advisorName: 'Marlana',
  dateType: 'event',
  eventDate: '2027-03-18',
  startTime: '17:00',
  endTime: '19:30',
  isActive: true,
};

const WEEKLY_BULLETIN = {
  id: 'post-esol-sessions',
  type: 'post',
  title: 'Evening ESOL Conversation',
  category: 'esol',
  description: 'Practice speaking.',
  advisorName: 'Marlana',
  dateType: 'sessions',
  eventDate: '2027-06-01',
  eventDates: [
    { date: '2027-06-01', startTime: '18:00', endTime: '20:00' },
    { date: '2027-06-08', startTime: '18:00', endTime: '20:00' },
    { date: '2027-06-15', startTime: '18:00', endTime: '20:00' },
  ],
  isActive: true,
};

const IRREGULAR_BULLETIN = {
  id: 'post-dropin',
  type: 'post',
  title: 'Drop-in Computer Help',
  category: 'training',
  description: 'Bring your questions.',
  advisorName: 'Leah',
  dateType: 'sessions',
  eventDate: '2027-06-02',
  eventDates: [
    { date: '2027-06-02', startTime: '14:00', endTime: '16:00' },
    { date: '2027-06-17', startTime: '14:00', endTime: '16:00' },
  ],
  isActive: true,
};

const DEADLINE_BULLETIN = {
  id: 'post-scholarship',
  type: 'post',
  title: 'CNA Scholarship',
  category: 'training',
  description: 'Apply through the front office.',
  advisorName: 'Carol',
  dateType: 'deadline',
  eventDate: '2027-04-01',
  startTime: '17:00',
  isActive: true,
};

const UNDATED_BULLETIN = {
  id: 'post-announcement',
  type: 'post',
  title: 'Office Moved Upstairs',
  category: 'announcement',
  description: 'Room 204 from now on.',
  advisorName: 'Marlana',
  isActive: true,
};

async function seed(page, bulletins) {
  await page.waitForFunction(() => window.bulletinBoard);
  await page.evaluate((posts) => {
    const stamped = posts.map((post) => ({ ...post, datePosted: new Date().toISOString() }));
    window.bulletinBoard.bulletins = stamped;
    window.bulletinBoard.bulletinsHydrated = true;
    window.bulletinBoard.displayBulletins(stamped);
  }, bulletins);
}

async function openDetail(page, bulletinId) {
  await page.evaluate((id) => window.bulletinBoard.showBulletinDetail(id), bulletinId);
  await expect(page.locator('#bulletinDetailModal')).toBeVisible();
}

const calendarLink = (page) =>
  page.locator('#bulletinDetailBody a.post-detail-action--outline[href*="calendar.google.com"]');

/** The link is never clicked in tests — following it would leave the site. */
async function calendarParams(page) {
  const href = await calendarLink(page).getAttribute('href');
  return new URL(href).searchParams;
}

test.describe('Add to Google Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a dated event links to a prefilled Google Calendar event', async ({ page }) => {
    await seed(page, [EVENT_BULLETIN]);
    await openDetail(page, EVENT_BULLETIN.id);

    await expect(calendarLink(page)).toBeVisible();
    await expect(calendarLink(page).locator('strong .en-text')).toHaveText('Add to Google Calendar');
    await expect(calendarLink(page).locator('small .en-text')).toHaveText('Saves the date');

    const q = await calendarParams(page);
    expect(q.get('action')).toBe('TEMPLATE');
    expect(q.get('text')).toBe('Harborside Job Fair');
    expect(q.get('dates')).toBe('20270318T170000/20270318T193000');
    expect(q.get('ctz')).toBe('America/New_York');
    expect(q.get('location')).toBe('312 Border St, East Boston, MA');
    expect(q.get('details')).toContain('Bring your ID; resumes welcome.');
    expect(q.get('details')).toContain('#bulletin-post-job-fair');
  });

  test('the link opens in a new tab so the post stays put', async ({ page }) => {
    await seed(page, [EVENT_BULLETIN]);
    await openDetail(page, EVENT_BULLETIN.id);

    await expect(calendarLink(page)).toHaveAttribute('target', '_blank');
    await expect(calendarLink(page)).toHaveAttribute('rel', /noopener/);
  });

  test('a weekly class carries all of its dates in one repeat rule', async ({ page }) => {
    await seed(page, [WEEKLY_BULLETIN]);
    await openDetail(page, WEEKLY_BULLETIN.id);

    await expect(calendarLink(page).locator('small .en-text')).toHaveText('Saves all 3 dates');

    const q = await calendarParams(page);
    expect(q.get('dates')).toBe('20270601T180000/20270601T200000');
    expect(q.get('recur')).toBe('RRULE:FREQ=WEEKLY;COUNT=3');
  });

  test('irregular dates save only the next one, and the label says so', async ({ page }) => {
    await seed(page, [IRREGULAR_BULLETIN]);
    await openDetail(page, IRREGULAR_BULLETIN.id);

    await expect(calendarLink(page).locator('small .en-text')).toHaveText('Saves the next date');

    const q = await calendarParams(page);
    expect(q.get('recur')).toBeNull();
    expect(q.get('dates')).toBe('20270602T140000/20270602T160000');
  });

  test('a deadline links an all-day reminder labelled as a deadline', async ({ page }) => {
    await seed(page, [DEADLINE_BULLETIN]);
    await openDetail(page, DEADLINE_BULLETIN.id);

    await expect(calendarLink(page).locator('small .en-text')).toHaveText('Saves the deadline');

    const q = await calendarParams(page);
    expect(q.get('text')).toBe('Deadline: CNA Scholarship');
    expect(q.get('dates')).toBe('20270401/20270402');
    expect(q.get('ctz')).toBeNull();
    expect(q.get('details')).toContain('Due by 5:00 PM');
  });

  test('an undated post gets no calendar button', async ({ page }) => {
    await seed(page, [UNDATED_BULLETIN]);
    await openDetail(page, UNDATED_BULLETIN.id);

    await expect(page.locator('#bulletinDetailBody')).toContainText('Office Moved Upstairs');
    await expect(calendarLink(page)).toHaveCount(0);
  });

  test('the Spanish labels are present for the language toggle', async ({ page }) => {
    await seed(page, [WEEKLY_BULLETIN]);
    await openDetail(page, WEEKLY_BULLETIN.id);

    await expect(calendarLink(page).locator('strong .es-text')).toHaveText('Agregar a Google Calendar');
    await expect(calendarLink(page).locator('small .es-text')).toHaveText('Guarda las 3 fechas');
  });
});
