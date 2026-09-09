/**
 * Unit tests for the "Add to Google Calendar" link behind a dated bulletin.
 *
 * The cases mirror the five dateType shapes advisors actually post
 * (deadline / event / range / sessions / recurring), plus the two things one
 * Google link cannot do on its own: start on more than one date, and repeat
 * on an irregular schedule.
 *
 * Run: npm run test:unit
 */

// Pinned so the DST case below is a real seven-day-minus-an-hour gap rather
// than a no-op on a UTC machine. Must be set before the first Date use.
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBulletinCalendarLink,
    buildCalendarOccurrences,
    buildGoogleCalendarUrl,
    buildWeeklyRecurrenceRule,
    pickLinkOccurrenceIndex,
} from '../../src/calendar-export.js';

const at = (iso) => new Date(iso).getTime();
const params = (href) => new URL(href).searchParams;
const weekly = (dates, startTime = '18:00', endTime = '20:00') =>
    dates.map((date) => ({ date, startTime, endTime }));

// ---------------------------------------------------------------- occurrences

test('a single-day event keeps its start and end time', () => {
    assert.deepEqual(
        buildCalendarOccurrences({ dateType: 'event', eventDate: '2027-10-15', startTime: '18:00', endTime: '20:30' }),
        [{ date: '2027-10-15', startTime: '18:00', endTime: '20:30' }]
    );
});

test('a deadline becomes an all-day entry, never a timed block', () => {
    const occurrences = buildCalendarOccurrences({
        dateType: 'deadline',
        eventDate: '2027-11-01',
        startTime: '17:00',
    });

    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0].allDay, true);
});

test('a multi-week range is one all-day span, not a long timed block', () => {
    const occurrences = buildCalendarOccurrences({
        dateType: 'range',
        startDate: '2027-09-14',
        endDate: '2027-12-18',
        startTime: '18:00',
        endTime: '20:00',
    });

    assert.equal(occurrences.length, 1);
    assert.equal(occurrences[0].allDay, true);
    assert.equal(occurrences[0].endDate, '2027-12-18');
});

test('a range collapsed to a single day is a normal timed event', () => {
    assert.deepEqual(
        buildCalendarOccurrences({
            dateType: 'range',
            startDate: '2027-09-14',
            endDate: '2027-09-14',
            startTime: '10:00',
            endTime: '11:00',
        }),
        [{ date: '2027-09-14', startTime: '10:00', endTime: '11:00' }]
    );
});

test('sessions fall back to the bulletin-level time when a row has none', () => {
    assert.deepEqual(
        buildCalendarOccurrences({ dateType: 'sessions', startTime: '13:00', endTime: '14:00' }, [{ date: '2027-09-15' }]),
        [{ date: '2027-09-15', startTime: '13:00', endTime: '14:00' }]
    );
});

test('the session count is capped at what the feed is willing to show', () => {
    const sessions = Array.from({ length: 26 }, (_, i) => ({ date: `2027-10-${String(i + 1).padStart(2, '0')}` }));
    assert.equal(buildCalendarOccurrences({ dateType: 'sessions' }, sessions).length, 20);
});

test('bulletins with no usable date produce nothing', () => {
    assert.deepEqual(buildCalendarOccurrences({ dateType: 'event' }), []);
    assert.deepEqual(buildCalendarOccurrences({ dateType: 'event', eventDate: 'soon' }), []);
    assert.deepEqual(buildCalendarOccurrences({ dateType: 'range' }), []);
    assert.deepEqual(buildCalendarOccurrences({ dateType: 'sessions' }, []), []);
    assert.deepEqual(buildCalendarOccurrences(null), []);
    assert.equal(buildBulletinCalendarLink({ bulletin: { id: 'a1' }, title: 'No date' }), null);
});

test('an impossible calendar date is rejected rather than rolled forward', () => {
    // new Date(2027, 1, 31) would silently become March 3rd.
    assert.deepEqual(buildCalendarOccurrences({ dateType: 'event', eventDate: '2027-02-31' }), []);
});

test('an untyped bulletin still exports whichever date it carries', () => {
    assert.deepEqual(buildCalendarOccurrences({ eventDate: '2027-10-15' }), [
        { date: '2027-10-15', startTime: '', endTime: '' },
    ]);
    assert.deepEqual(buildCalendarOccurrences({ startDate: '2027-10-16' }), [
        { date: '2027-10-16', startTime: '', endTime: '' },
    ]);
});

// ------------------------------------------------------- which date to link

test('the link starts on the next date that has not happened yet', () => {
    const occurrences = weekly(['2027-03-02', '2027-03-09', '2027-03-16']);
    assert.equal(pickLinkOccurrenceIndex(occurrences, at('2027-03-05T12:00:00')), 1);
});

test('a date happening today still counts as upcoming', () => {
    const occurrences = weekly(['2027-03-02', '2027-03-09']);
    assert.equal(pickLinkOccurrenceIndex(occurrences, at('2027-03-02T22:00:00')), 0);
});

test('a bulletin whose dates have all passed falls back to the last one', () => {
    const occurrences = weekly(['2027-03-02', '2027-03-09']);
    assert.equal(pickLinkOccurrenceIndex(occurrences, at('2027-06-01T12:00:00')), 1);
});

test('no dates means no date to link', () => {
    assert.equal(pickLinkOccurrenceIndex([], Date.now()), -1);
    assert.equal(pickLinkOccurrenceIndex(null, Date.now()), -1);
});

// ------------------------------------------------------------ the repeat rule

test('an evenly weekly class becomes one repeat rule', () => {
    const rule = buildWeeklyRecurrenceRule(weekly(['2027-06-01', '2027-06-08', '2027-06-15']), 0);
    assert.equal(rule, 'RRULE:FREQ=WEEKLY;COUNT=3');
});

test('the rule only counts the dates still ahead', () => {
    const rule = buildWeeklyRecurrenceRule(weekly(['2027-06-01', '2027-06-08', '2027-06-15']), 1);
    assert.equal(rule, 'RRULE:FREQ=WEEKLY;COUNT=2');
});

test('a week across the spring DST change is still a week', () => {
    // 2027-03-14 is when America/New_York springs forward, making this gap
    // 167 hours rather than 168.
    const rule = buildWeeklyRecurrenceRule(weekly(['2027-03-07', '2027-03-14', '2027-03-21']), 0);
    assert.equal(rule, 'RRULE:FREQ=WEEKLY;COUNT=3');
});

test('irregular dates get no rule, so the link will not promise them', () => {
    assert.equal(buildWeeklyRecurrenceRule(weekly(['2027-06-01', '2027-06-08', '2027-06-24']), 0), '');
    assert.equal(buildWeeklyRecurrenceRule(weekly(['2027-06-01', '2027-06-03']), 0), '');
});

test('sessions at different times of day get no rule', () => {
    const uneven = [
        { date: '2027-06-01', startTime: '18:00', endTime: '20:00' },
        { date: '2027-06-08', startTime: '17:30', endTime: '19:30' },
    ];
    assert.equal(buildWeeklyRecurrenceRule(uneven, 0), '');
});

test('a lone date needs no rule', () => {
    assert.equal(buildWeeklyRecurrenceRule(weekly(['2027-06-01']), 0), '');
    assert.equal(buildWeeklyRecurrenceRule([], 0), '');
});

// ------------------------------------------------------------------- the URL

test('a timed event pins the East Boston timezone', () => {
    const href = buildGoogleCalendarUrl({
        occurrence: { date: '2027-10-15', startTime: '17:00', endTime: '19:30' },
        title: 'Harborside Job Fair',
    });
    const q = params(href);

    assert.ok(href.startsWith('https://calendar.google.com/calendar/render?'));
    assert.equal(q.get('action'), 'TEMPLATE');
    assert.equal(q.get('dates'), '20271015T170000/20271015T193000');
    assert.equal(q.get('ctz'), 'America/New_York');
    assert.equal(q.get('text'), 'Harborside Job Fair');
});

test('an event with no end time gets a one-hour block', () => {
    const q = params(buildGoogleCalendarUrl({ occurrence: { date: '2027-10-15', startTime: '09:15' } }));
    assert.equal(q.get('dates'), '20271015T091500/20271015T101500');
});

test('an evening event running past midnight ends on the next day', () => {
    const q = params(buildGoogleCalendarUrl({
        occurrence: { date: '2027-12-31', startTime: '21:00', endTime: '01:00' },
    }));
    assert.equal(q.get('dates'), '20271231T210000/20280101T010000');
});

test('an all-day entry ends on the following day, and carries no timezone', () => {
    const q = params(buildGoogleCalendarUrl({ occurrence: { date: '2027-10-15', allDay: true } }));
    assert.equal(q.get('dates'), '20271015/20271016');
    assert.equal(q.get('ctz'), null);
});

test('an all-day span covers the whole range', () => {
    const q = params(buildGoogleCalendarUrl({
        occurrence: { date: '2027-09-14', endDate: '2027-12-18', allDay: true },
    }));
    assert.equal(q.get('dates'), '20270914/20271219');
});

test('an event with no time at all becomes an all-day entry', () => {
    const q = params(buildGoogleCalendarUrl({ occurrence: { date: '2027-10-15' } }));
    assert.equal(q.get('dates'), '20271015/20271016');
});

test('a bad date yields no link rather than a broken one', () => {
    assert.equal(buildGoogleCalendarUrl({ occurrence: { date: 'whenever' } }), '');
    assert.equal(buildGoogleCalendarUrl({}), '');
});

test('titles, notes and addresses survive URL encoding intact', () => {
    const q = params(buildGoogleCalendarUrl({
        occurrence: { date: '2027-10-15', startTime: '17:00' },
        title: 'Job Fair & Résumé Help',
        details: 'Bring your ID; a resume helps.\n\nAsk for Carol.',
        location: '312 Border St, East Boston, MA',
    }));

    assert.equal(q.get('text'), 'Job Fair & Résumé Help');
    assert.equal(q.get('details'), 'Bring your ID; a resume helps.\n\nAsk for Carol.');
    assert.equal(q.get('location'), '312 Border St, East Boston, MA');
});

// ------------------------------------------------------- the assembled link

test('a deadline is titled as one and keeps its cutoff time in the notes', () => {
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'deadline', eventDate: '2027-11-01', startTime: '17:00' },
        title: 'CNA scholarship application',
        timeLabel: '5:00 PM',
        now: at('2027-10-01T12:00:00'),
    });
    const q = params(link.href);

    assert.equal(q.get('text'), 'Deadline: CNA scholarship application');
    assert.equal(q.get('dates'), '20271101/20271102');
    assert.match(q.get('details'), /Due by 5:00 PM/);
    assert.equal(link.savedCount, 1);
});

test('a class time on a multi-week range survives in the notes', () => {
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'range', startDate: '2027-09-14', endDate: '2027-12-18' },
        title: 'Evening ESOL Level 2',
        timeLabel: '6:00 PM - 8:00 PM',
        now: at('2027-09-01T12:00:00'),
    });

    assert.match(params(link.href).get('details'), /Time: 6:00 PM - 8:00 PM/);
});

test('a timed event does not repeat its own clock in the notes', () => {
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'event', eventDate: '2027-10-15', startTime: '17:00', endTime: '19:00' },
        title: 'Job Fair',
        timeLabel: '5:00 PM - 7:00 PM',
        now: at('2027-10-01T12:00:00'),
    });

    assert.doesNotMatch(params(link.href).get('details') || '', /Time:/);
});

test('the bulletin link is included so students can get back to the post', () => {
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'event', eventDate: '2027-10-15' },
        title: 'Job Fair',
        url: 'https://example.org/#bulletin-a1',
        now: at('2027-10-01T12:00:00'),
    });

    assert.match(params(link.href).get('details'), /Details: https:\/\/example\.org\/#bulletin-a1/);
});

test('a weekly class saves every date still ahead of it', () => {
    const sessions = weekly(['2027-06-01', '2027-06-08', '2027-06-15', '2027-06-22']);
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'sessions' },
        sessions,
        title: 'Evening ESOL',
        now: at('2027-06-03T12:00:00'),
    });

    // June 1st has passed, so the link starts on the 8th and repeats three times.
    assert.equal(params(link.href).get('dates'), '20270608T180000/20270608T200000');
    assert.equal(params(link.href).get('recur'), 'RRULE:FREQ=WEEKLY;COUNT=3');
    assert.equal(link.savedCount, 3);
    assert.equal(link.remainingCount, 3);
    assert.equal(link.coversAllDates, true);
});

test('irregular sessions save only the next date, and say so', () => {
    const sessions = weekly(['2027-06-01', '2027-06-08', '2027-06-24']);
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'sessions' },
        sessions,
        title: 'Drop-in Help',
        now: at('2027-05-01T12:00:00'),
    });

    assert.equal(params(link.href).get('recur'), null);
    assert.equal(params(link.href).get('dates'), '20270601T180000/20270601T200000');
    assert.equal(link.savedCount, 1);
    assert.equal(link.remainingCount, 3);
    assert.equal(link.coversAllDates, false);
});

test('a recurring weekly bulletin repeats from its next session', () => {
    const sessions = weekly(['2027-03-07', '2027-03-14', '2027-03-21'], '10:00', '11:30');
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'recurring' },
        sessions,
        title: 'Tuesday Conversation Group',
        now: at('2027-03-01T12:00:00'),
    });

    assert.equal(params(link.href).get('recur'), 'RRULE:FREQ=WEEKLY;COUNT=3');
    assert.equal(params(link.href).get('dates'), '20270307T100000/20270307T113000');
});

test('a finished multi-session bulletin still links its last date', () => {
    const sessions = weekly(['2027-06-01', '2027-06-08']);
    const link = buildBulletinCalendarLink({
        bulletin: { id: 'a1', dateType: 'sessions' },
        sessions,
        title: 'Evening ESOL',
        now: at('2027-09-01T12:00:00'),
    });

    assert.equal(params(link.href).get('dates'), '20270608T180000/20270608T200000');
    assert.equal(link.savedCount, 1);
    assert.equal(link.remainingCount, 1);
});
