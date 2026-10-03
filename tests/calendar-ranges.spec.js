const { test, expect } = require('@playwright/test');

// A closure week ("February Vacation Week - No Classes", Feb 15–19) used to show
// as "From Mon, Feb 15", mark only the 15th on the month grid, and drop into
// "Past dates" the day after it started.

const vacationWeek = {
  id: 'feb-vacation',
  type: 'post',
  title: 'February Vacation Week - No Classes',
  category: 'no-classes',
  dateType: 'range',
  startDate: '2027-02-15',
  endDate: '2027-02-19',
  isActive: true,
  isPublished: true,
  hideFromMainFeed: true,
};

// Long programmes keep marking only their start day.
const farmersMarket = {
  id: 'farmers-market',
  type: 'post',
  title: 'East Boston Farmers Market',
  category: 'food',
  dateType: 'range',
  startDate: '2027-02-03',
  endDate: '2027-05-26',
  isActive: true,
  isPublished: true,
};

test.describe('date ranges on the calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2027-02-17T10:00:00'));
    await page.goto('/');
    await page.waitForFunction(() => window.bulletinBoard);
  });

  test('a closure week marks every day it covers', async ({ page }) => {
    const marked = await page.evaluate(([a, b]) => {
      const board = window.bulletinBoard;
      board.currentCalendarMonth = 1;
      board.currentCalendarYear = 2027;
      const host = document.createElement('div');
      host.innerHTML = board.createCalendarView([a, b], { navigatorMode: true });
      return [...host.querySelectorAll('[data-calendar-day]')].map((el) => el.getAttribute('data-calendar-day'));
    }, [vacationWeek, farmersMarket]);

    expect(marked).toEqual(['2027-02-03', '2027-02-15', '2027-02-16', '2027-02-17', '2027-02-18', '2027-02-19']);
  });

  test('the list shows the whole range and keeps it current until it ends', async ({ page }) => {
    const result = await page.evaluate((b) => {
      const host = document.createElement('div');
      host.innerHTML = window.bulletinBoard.createDatesListView([b]);
      return {
        group: host.querySelector('.dates-list-group')?.getAttribute('aria-label'),
        label: host.querySelector('.dates-list-label')?.textContent.trim(),
      };
    }, vacationWeek);

    expect(result.group).toBe('This week');
    expect(result.label).toBe('Mon, Feb 15 – Fri, Feb 19');
  });
});
