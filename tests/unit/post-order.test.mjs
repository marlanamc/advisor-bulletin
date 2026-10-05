import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparePostsNewestFirst, getPostPublicationMs } from '../../src/post-order.js';
import { buildCalendarOccurrences } from '../../src/calendar-export.js';
import { normalizeEventSessions, expandRecurringWeeklySessions } from '../../src/event-sessions.js';

test('new announcements precede older repeating posts despite completed and upcoming sessions', () => {
    const posts = [
        { id: 'consultation', datePosted: '2026-09-01', dateType: 'sessions',
            eventDates: ['2026-09-02', '2026-10-07', '2026-10-21'], updatedAt: '2026-10-05' },
        { id: 'market', datePosted: '2026-09-02', dateType: 'recurring',
            startDate: '2026-09-02', endDate: '2026-10-28', recurringWeekday: '3' },
        { id: 'news', datePosted: '2026-10-04' },
        { id: 'latest', datePosted: '2026-10-05' },
    ];
    const before = structuredClone(posts);
    assert.deepEqual([...posts].sort(comparePostsNewestFirst).map(p => p.id),
        ['latest', 'news', 'market', 'consultation']);
    assert.deepEqual(posts, before);
    assert.equal(buildCalendarOccurrences(posts[0], normalizeEventSessions(posts[0].eventDates)).length, 3);
    assert.equal(buildCalendarOccurrences(posts[1], expandRecurringWeeklySessions(posts[1])).length, 9);
});

test('event dates never break publication-date ties', () => {
    const first = { datePosted: '2026-09-01', dateType: 'sessions', eventDates: ['2026-10-21'] };
    const second = { datePosted: '2026-09-01', dateType: 'sessions', eventDates: ['2026-10-07'] };
    assert.equal(comparePostsNewestFirst(first, second), 0);
});

test('live Firestore timestamps and serialized snapshot timestamps produce the same order', () => {
    const iso = '2026-10-05T14:00:00.000Z';
    assert.equal(getPostPublicationMs({ datePosted: { toDate: () => new Date(iso) } }),
        getPostPublicationMs({ datePosted: iso }));
    assert.equal(getPostPublicationMs({ createdAt: iso }), Date.parse(iso));
    assert.equal(getPostPublicationMs({ datePosted: '2026-09-01', createdAt: iso }),
        new Date(2026, 8, 1).getTime());
    assert.equal(getPostPublicationMs({}), 0);
    assert.equal(getPostPublicationMs({ datePosted: 'invalid' }), 0);
});
