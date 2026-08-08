/**
 * Unit tests for the open-now schedule parser.
 *
 * Every case here is real advisor-entered text from
 * data/resource-import-template.csv, because the parser's whole job is coping
 * with how people actually write schedules.
 *
 * Run: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpenNow } from '../../src/resource-hours.js';

// August 2026 reference days:
//   9th Sun · 10th Mon · 11th Tue · 12th Wed (2nd of month) · 13th Thu
//   14th Fri · 15th Sat · 26th Wed (4th of month)
const at = (iso) => new Date(iso);

test('single day with a range', () => {
    assert.equal(isOpenNow('Friday 11am-2pm', at('2026-08-14T12:00:00')), true);
    assert.equal(isOpenNow('Friday 11am-2pm', at('2026-08-14T15:00:00')), false);
    assert.equal(isOpenNow('Friday 11am-2pm', at('2026-08-13T12:00:00')), false);
});

test('two days joined by "and" share one range', () => {
    const hours = 'Sunday and Wednesday 3pm-4pm';
    assert.equal(isOpenNow(hours, at('2026-08-09T15:30:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-12T15:30:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-11T15:30:00')), false);
});

test('plural day names parse — the bug that broke "Wednesdays 3pm-4pm"', () => {
    assert.equal(isOpenNow('Wednesdays 3pm-4pm', at('2026-08-12T15:30:00')), true);
    assert.equal(isOpenNow('Mondays 1pm-5pm', at('2026-08-10T14:00:00')), true);
});

test('wednesday and saturday parse — stems that are not prefix + "day"', () => {
    assert.equal(isOpenNow('Wednesday 9am-5pm', at('2026-08-12T12:00:00')), true);
    assert.equal(isOpenNow('Saturday 10am-2pm', at('2026-08-15T12:00:00')), true);
});

test('day ranges expand', () => {
    const hours = 'Monday 9am-3pm; Tuesday-Thursday 10am-7pm; Friday 9am-1pm; Saturday 10am-2pm';
    assert.equal(isOpenNow(hours, at('2026-08-13T18:00:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-15T11:00:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-15T15:00:00')), false);
});

test('leading labels are ignored', () => {
    assert.equal(isOpenNow('Walk-in Wednesday 10am-12:30pm', at('2026-08-12T11:00:00')), true);
    assert.equal(
        isOpenNow('Pantry Tuesday and Thursday 10am-1pm; office Monday-Thursday 9am-2pm', at('2026-08-13T11:00:00')),
        true,
    );
    assert.equal(
        isOpenNow('Phone intake Monday-Friday 9:30am-12:30pm; walk-in Monday and Thursday 1:30pm-4pm', at('2026-08-13T14:00:00')),
        true,
    );
});

test('ordinal weekdays only match the right week', () => {
    const hours = '2nd Wednesday 10am-1pm and 4th Wednesday 3pm-6pm';
    assert.equal(isOpenNow(hours, at('2026-08-12T11:00:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-26T11:00:00')), false);
    assert.equal(isOpenNow(hours, at('2026-08-26T16:00:00')), true);
});

test('always-open phrasing', () => {
    assert.equal(isOpenNow('Call anytime, 7 days a week', at('2026-08-13T03:00:00')), true);
    assert.equal(isOpenNow('Call or text 988 anytime', at('2026-08-13T03:00:00')), true);
    assert.equal(isOpenNow('Call anytime, 24 hours a day', at('2026-08-13T03:00:00')), true);
});

test('unparseable text yields undefined so no badge is shown', () => {
    assert.equal(isOpenNow('', at('2026-08-13T14:00:00')), undefined);
    assert.equal(isOpenNow('Call to schedule an appointment', at('2026-08-13T14:00:00')), undefined);
    assert.equal(isOpenNow('Monday 1pm until food runs out', at('2026-08-10T13:30:00')), undefined);
    assert.equal(isOpenNow('Open when volunteers are available', at('2026-08-10T13:30:00')), undefined);
});

test('a non-schedule prefix does not suppress the real schedule', () => {
    assert.equal(isOpenNow('By appointment only; Monday-Friday 8:30am-4:30pm', at('2026-08-13T14:00:00')), true);
    assert.equal(
        isOpenNow('Seasonal: Friday 1pm-3pm; Thursday 4pm-7pm. Call to confirm.', at('2026-08-14T14:00:00')),
        true,
    );
});

test('multiple windows on the same day', () => {
    const hours = 'Tuesday 9am-11am; Tuesday 12pm-2pm; Tuesday 5pm-7pm';
    assert.equal(isOpenNow(hours, at('2026-08-11T10:00:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-11T11:30:00')), false);
    assert.equal(isOpenNow(hours, at('2026-08-11T17:30:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-11T19:30:00')), false);
});

test('ranges that wrap past midnight', () => {
    assert.equal(isOpenNow('Friday 8pm-2am', at('2026-08-14T23:00:00')), true);
    assert.equal(isOpenNow('Friday 8pm-2am', at('2026-08-14T19:00:00')), false);
});

test('minutes are respected', () => {
    const hours = 'Friday 9am-3:45pm';
    assert.equal(isOpenNow(hours, at('2026-08-14T15:30:00')), true);
    assert.equal(isOpenNow(hours, at('2026-08-14T15:50:00')), false);
});
