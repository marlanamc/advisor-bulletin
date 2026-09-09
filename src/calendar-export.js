// "Add to Google Calendar" link building for dated bulletins.
//
// A prefilled calendar.google.com/render URL, not a downloaded .ics file:
// students on this feed are not signed in to anything and many have never
// opened a download on their phone, so the flow that never produces a file
// is the one they can finish. Google shows a normal web page with a Save
// button; if the link is ignored or the student has no Google account,
// nothing breaks — they just land on a page they can close.
//
// Everything on this board happens in East Boston, so timed events pin
// ctz=America/New_York rather than trusting the viewer's calendar default.

/** @typedef {{ date: string, endDate?: string, startTime?: string, endTime?: string, allDay?: boolean }} CalendarOccurrence */

const GOOGLE_RENDER_URL = 'https://calendar.google.com/calendar/render';
const EVENT_TIMEZONE = 'America/New_York';
const DEFAULT_EVENT_MINUTES = 60;
const MAX_DETAIL_CHARS = 600;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Mirrors MAX_EVENT_SESSIONS in event-sessions.js — the feed never shows more. */
export const MAX_CALENDAR_OCCURRENCES = 20;

/** @param {string} value @returns {{ y: number, m: number, d: number } | null} */
function parseYmd(value) {
    const match = String(value || '').split('T')[0].trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    // Reject 2026-02-31 and friends: Date would roll them into the next month.
    const probe = new Date(y, m - 1, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
    return { y, m, d };
}

/** @param {string} value @returns {{ h: number, min: number } | null} */
function parseHm(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = Number(match[1]);
    const min = Number(match[2]);
    if (h > 23 || min > 59) return null;
    return { h, min };
}

const pad2 = (n) => String(n).padStart(2, '0');

/** @param {{ y: number, m: number, d: number }} ymd */
const formatCompact = (ymd) => `${ymd.y}${pad2(ymd.m)}${pad2(ymd.d)}`;

/** @param {{ y: number, m: number, d: number }} ymd */
const formatDashed = (ymd) => `${ymd.y}-${pad2(ymd.m)}-${pad2(ymd.d)}`;

/** @param {{ y: number, m: number, d: number }} ymd @param {number} days */
function addDays(ymd, days) {
    const date = new Date(ymd.y, ymd.m - 1, ymd.d + days);
    return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

/** Local wall-clock stamp; the ctz parameter says which zone it means. */
function formatCompactDateTime(ymd, minutesFromMidnight) {
    const dayOffset = Math.floor(minutesFromMidnight / 1440);
    const within = ((minutesFromMidnight % 1440) + 1440) % 1440;
    const day = dayOffset ? addDays(ymd, dayOffset) : ymd;
    return `${formatCompact(day)}T${pad2(Math.floor(within / 60))}${pad2(within % 60)}00`;
}

/**
 * Work out which calendar entries a bulletin describes.
 *
 * - `sessions` / `recurring`: one entry per occurrence the feed listed.
 * - `range` spanning more than a day: a single all-day entry across the span,
 *   because a six-week class is not a six-week-long timed block. Any
 *   start/end time belongs in the notes instead.
 * - `deadline`: an all-day entry — a banner on the day reads better than a
 *   5pm block. The cutoff time, if set, goes in the notes.
 * - `event` (and untyped bulletins carrying a date): a timed entry.
 *
 * @param {Record<string, any>} bulletin
 * @param {Array<{ date: string, startTime?: string, endTime?: string }>} [sessions]
 * @returns {CalendarOccurrence[]}
 */
export function buildCalendarOccurrences(bulletin, sessions = []) {
    if (!bulletin) return [];

    const dateType = bulletin.dateType || '';
    const startTime = String(bulletin.startTime || '').trim();
    const endTime = String(bulletin.endTime || '').trim();

    if (dateType === 'sessions' || dateType === 'recurring') {
        return (Array.isArray(sessions) ? sessions : [])
            .filter((session) => parseYmd(session?.date))
            .slice(0, MAX_CALENDAR_OCCURRENCES)
            .map((session) => ({
                date: String(session.date).split('T')[0].trim(),
                startTime: String(session.startTime || startTime || '').trim(),
                endTime: String(session.endTime || endTime || '').trim(),
            }));
    }

    if (dateType === 'deadline') {
        const deadline = bulletin.eventDate || bulletin.deadline;
        return parseYmd(deadline)
            ? [{ date: String(deadline).split('T')[0].trim(), allDay: true, startTime, endTime }]
            : [];
    }

    if (dateType === 'range') {
        const start = parseYmd(bulletin.startDate);
        if (!start) return [];
        const startDate = formatDashed(start);
        const end = parseYmd(bulletin.endDate);
        if (end && formatDashed(end) > startDate) {
            return [{ date: startDate, endDate: formatDashed(end), allDay: true, startTime, endTime }];
        }
        return [{ date: startDate, startTime, endTime }];
    }

    const single = parseYmd(bulletin.eventDate) || parseYmd(bulletin.startDate) || parseYmd(bulletin.deadline);
    if (!single) return [];
    return [{ date: formatDashed(single), startTime, endTime }];
}

/**
 * A single link can only start on one date, so start on the one the student
 * still cares about: the next occurrence that has not happened yet, falling
 * back to the last one for a bulletin whose dates have all passed.
 * @param {CalendarOccurrence[]} occurrences
 * @param {number} [now]
 * @returns {number} index into `occurrences`, or -1 when there are none
 */
export function pickLinkOccurrenceIndex(occurrences, now = Date.now()) {
    if (!Array.isArray(occurrences) || !occurrences.length) return -1;

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const upcoming = occurrences.findIndex((occurrence) => {
        const ymd = parseYmd(occurrence.date);
        return ymd && new Date(ymd.y, ymd.m - 1, ymd.d).getTime() >= startOfToday.getTime();
    });

    return upcoming === -1 ? occurrences.length - 1 : upcoming;
}

/**
 * Google's `recur` parameter takes one RRULE, which can carry the remaining
 * dates of a weekly class but cannot express an irregular list. So: emit a
 * weekly rule only when every remaining gap really is seven days, and let
 * anything else fall back to a single date rather than inventing a cadence.
 *
 * COUNT (rather than UNTIL) keeps the calendar showing exactly the dates the
 * feed showed, including the MAX_CALENDAR_OCCURRENCES cap.
 *
 * @param {CalendarOccurrence[]} occurrences
 * @param {number} fromIndex
 * @returns {string} an RRULE, or '' when the remaining dates are not weekly
 */
export function buildWeeklyRecurrenceRule(occurrences, fromIndex) {
    const remaining = (occurrences || []).slice(Math.max(fromIndex, 0));
    if (remaining.length < 2) return '';

    const times = remaining.map((occurrence) => {
        const ymd = parseYmd(occurrence.date);
        return ymd ? new Date(ymd.y, ymd.m - 1, ymd.d).getTime() : NaN;
    });
    if (times.some(Number.isNaN)) return '';

    const startTime = remaining[0].startTime || '';
    const endTime = remaining[0].endTime || '';

    for (let i = 1; i < times.length; i += 1) {
        // Two hours of slack because a week across a DST boundary is 167 or
        // 169 hours, not 168.
        if (Math.abs(times[i] - times[i - 1] - WEEK_MS) > 2 * 60 * 60 * 1000) return '';
        // A rule repeats one event, so the times have to match across dates.
        if ((remaining[i].startTime || '') !== startTime) return '';
        if ((remaining[i].endTime || '') !== endTime) return '';
    }

    return `RRULE:FREQ=WEEKLY;COUNT=${remaining.length}`;
}

/** @param {CalendarOccurrence} occurrence @returns {{ dates: string, timed: boolean } | null} */
function formatDatesParam(occurrence) {
    const start = parseYmd(occurrence?.date);
    if (!start) return null;

    const startHm = occurrence.allDay ? null : parseHm(occurrence.startTime);

    if (!startHm) {
        // Google reads the end of an all-day span as exclusive.
        const end = parseYmd(occurrence.endDate) || start;
        return { dates: `${formatCompact(start)}/${formatCompact(addDays(end, 1))}`, timed: false };
    }

    const startMinutes = startHm.h * 60 + startHm.min;
    const endHm = parseHm(occurrence.endTime);
    let endMinutes = endHm ? endHm.h * 60 + endHm.min : startMinutes + DEFAULT_EVENT_MINUTES;
    // An end at or before the start means it wrapped past midnight (7pm–1am).
    if (endMinutes <= startMinutes) endMinutes += 1440;

    return {
        dates: `${formatCompactDateTime(start, startMinutes)}/${formatCompactDateTime(start, endMinutes)}`,
        timed: true,
    };
}

/**
 * @param {{ occurrence: CalendarOccurrence, title?: string, details?: string, location?: string, recurrence?: string }} input
 * @returns {string} a calendar.google.com URL, or '' when the date is unusable
 */
export function buildGoogleCalendarUrl(input) {
    const { occurrence, title = '', details = '', location = '', recurrence = '' } = input || {};
    const dates = formatDatesParam(occurrence);
    if (!dates) return '';

    const params = new URLSearchParams({ action: 'TEMPLATE', dates: dates.dates });
    if (title) params.set('text', title);
    if (details) params.set('details', details);
    if (location) params.set('location', location);
    if (recurrence) params.set('recur', recurrence);
    if (dates.timed) params.set('ctz', EVENT_TIMEZONE);

    return `${GOOGLE_RENDER_URL}?${params.toString()}`;
}

/**
 * Assemble the calendar link for one bulletin.
 *
 * Counts are reported so the caller can label the button honestly:
 * `savedCount` is how many dates the link actually adds, out of
 * `remainingCount` dates still ahead. They differ when a multi-session
 * bulletin's dates are too irregular for one weekly repeat rule.
 *
 * @param {{ bulletin: Record<string, any>, sessions?: Array<any>, title?: string, notes?: string, timeLabel?: string, location?: string, url?: string, now?: number }} input
 * @returns {{ href: string, savedCount: number, remainingCount: number, coversAllDates: boolean } | null}
 */
export function buildBulletinCalendarLink(input) {
    const { bulletin, sessions = [], title = '', notes = '', timeLabel = '', location = '', url = '', now } = input || {};

    const occurrences = buildCalendarOccurrences(bulletin, sessions);
    const index = pickLinkOccurrenceIndex(occurrences, now);
    if (index === -1) return null;

    const occurrence = occurrences[index];
    const isDeadline = bulletin?.dateType === 'deadline';
    const recurrence = buildWeeklyRecurrenceRule(occurrences, index);
    const savedCount = recurrence ? occurrences.length - index : 1;

    // Timed entries carry their own clock, so only spell the time out where it
    // was dropped from the entry itself (all-day spans and deadlines).
    const needsTimeLine = timeLabel && occurrence.allDay;
    const details = [
        needsTimeLine ? (isDeadline ? `Due by ${timeLabel}` : `Time: ${timeLabel}`) : '',
        String(notes || '').trim().slice(0, MAX_DETAIL_CHARS),
        url ? `Details: ${url}` : '',
    ].filter(Boolean).join('\n\n');

    const href = buildGoogleCalendarUrl({
        occurrence,
        title: isDeadline && title ? `Deadline: ${title}` : (title || 'Event'),
        details,
        location,
        recurrence,
    });
    if (!href) return null;

    const remainingCount = occurrences.length - index;

    return {
        href,
        savedCount,
        remainingCount,
        coversAllDates: savedCount === remainingCount,
    };
}
