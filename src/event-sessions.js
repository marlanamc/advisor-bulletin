/** @typedef {{ date: string, startTime?: string, endTime?: string }} EventSession */

export const MAX_EVENT_SESSIONS = 20;

/**
 * Parse a legacy date string or session object from Firestore.
 * @param {string | EventSession | null | undefined} entry
 * @param {string} [fallbackStart]
 * @param {string} [fallbackEnd]
 * @returns {EventSession | null}
 */
export function parseSessionEntry(entry, fallbackStart = '', fallbackEnd = '') {
    if (entry == null || entry === '') return null;

    if (typeof entry === 'string') {
        const date = entry.split('T')[0].trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        return {
            date,
            startTime: fallbackStart || '',
            endTime: fallbackEnd || '',
        };
    }

    if (typeof entry === 'object') {
        const date = String(entry.date || '').split('T')[0].trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        return {
            date,
            startTime: String(entry.startTime || fallbackStart || '').trim(),
            endTime: String(entry.endTime || fallbackEnd || '').trim(),
        };
    }

    return null;
}

/**
 * Normalize session rows for storage (dedupe by date, sorted, capped).
 * @param {Array<string | EventSession>} rawEntries
 * @param {string} [fallbackStart]
 * @param {string} [fallbackEnd]
 * @returns {EventSession[]}
 */
export function normalizeEventSessions(rawEntries, fallbackStart = '', fallbackEnd = '') {
    const seen = new Set();
    /** @type {EventSession[]} */
    const valid = [];

    (Array.isArray(rawEntries) ? rawEntries : [rawEntries]).forEach((entry) => {
        const session = parseSessionEntry(entry, fallbackStart, fallbackEnd);
        if (!session || seen.has(session.date)) return;
        seen.add(session.date);
        valid.push(session);
    });

    valid.sort((a, b) => a.date.localeCompare(b.date));
    return valid.slice(0, MAX_EVENT_SESSIONS);
}

/** @param {string | EventSession | null | undefined} entry */
export function getSessionDateString(entry) {
    const session = parseSessionEntry(entry);
    return session?.date || '';
}

/**
 * Build session objects from parallel form field arrays.
 * @param {string[]} dates
 * @param {string[]} starts
 * @param {string[]} ends
 */
export function sessionsFromFormRows(dates, starts, ends) {
    return normalizeEventSessions(
        dates.map((date, index) => ({
            date,
            startTime: starts[index] || '',
            endTime: ends[index] || '',
        }))
    );
}

/** @param {EventSession[]} sessions */
export function sessionsShareSameTime(sessions) {
    if (sessions.length < 2) return false;
    const first = sessions[0];
    return sessions.every(
        (session) => session.startTime === first.startTime && session.endTime === first.endTime
    );
}

/**
 * Read session rows from the bulletin form, honoring shared-time mode.
 * @param {FormData} formData
 */
export function sessionsFromFormData(formData) {
    const dates = formData.getAll('eventDates');
    const sameTime = formData.get('sessionSameTime') === 'on';
    const sharedStart = String(formData.get('sessionSharedStartTime') || '').trim();
    const sharedEnd = String(formData.get('sessionSharedEndTime') || '').trim();
    const rowStarts = formData.getAll('eventSessionStartTimes');
    const rowEnds = formData.getAll('eventSessionEndTimes');

    return normalizeEventSessions(
        dates.map((date, index) => ({
            date,
            startTime: sameTime ? sharedStart : String(rowStarts[index] || '').trim(),
            endTime: sameTime ? sharedEnd : String(rowEnds[index] || '').trim(),
        }))
    );
}

/**
 * @param {EventSession[]} sessions
 * @param {(date: string) => string} formatDate
 * @param {(start?: string, end?: string) => string} formatTimeRange
 */
export function formatSessionsDetailLines(sessions, formatDate, formatTimeRange) {
    return sessions.map((session) => {
        const dateLabel = formatDate(session.date);
        const timeLabel = formatTimeRange(session.startTime, session.endTime);
        return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
    });
}

/** @param {string} dateStr */
function parseYmdLocal(dateStr) {
    const date = String(dateStr || '').split('T')[0].trim();
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * @param {EventSession} session
 * @param {string} [fallbackEnd]
 */
export function getSessionEndMs(session, fallbackEnd = '') {
    const day = parseYmdLocal(session?.date);
    if (!day) return 0;

    const endTime = String(session.endTime || fallbackEnd || '').trim();
    if (endTime) {
        const [hours, minutes] = endTime.split(':').map((part) => Number(part));
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours || 0, minutes || 0, 0, 0).getTime();
    }

    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).getTime();
}

/**
 * @param {EventSession} session
 * @param {string} [fallbackStart]
 */
export function getSessionStartMs(session, fallbackStart = '') {
    const day = parseYmdLocal(session?.date);
    if (!day) return 0;

    const startTime = String(session.startTime || fallbackStart || '').trim();
    if (startTime) {
        const [hours, minutes] = startTime.split(':').map((part) => Number(part));
        return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours || 0, minutes || 0, 0, 0).getTime();
    }

    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0).getTime();
}

/**
 * Feed sort timestamp for multi-session bulletins.
 * After a session ends, bump the post toward the top until the next session passes.
 * @param {EventSession[]} sessions
 * @param {number} datePostedMs
 * @param {number} [now]
 */
export function getMultiSessionFeedSortMs(sessions, datePostedMs, now = Date.now()) {
    if (!sessions || sessions.length < 2 || !datePostedMs) {
        return datePostedMs || 0;
    }

    let lastCompletedEnd = 0;
    let hasUpcoming = false;

    sessions.forEach((session) => {
        const endMs = getSessionEndMs(session);
        if (!endMs) return;
        if (endMs <= now) {
            lastCompletedEnd = Math.max(lastCompletedEnd, endMs);
        } else {
            hasUpcoming = true;
        }
    });

    if (lastCompletedEnd > 0 && hasUpcoming) {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        return Math.max(datePostedMs, lastCompletedEnd, todayStart.getTime());
    }

    return datePostedMs;
}

/**
 * @param {EventSession[]} sessions
 * @param {number} [now]
 * @param {string} [fallbackStart]
 */
export function getNextSessionStartMs(sessions, now = Date.now(), fallbackStart = '') {
    if (!Array.isArray(sessions)) return Number.MAX_SAFE_INTEGER;

    for (const session of sessions) {
        const startMs = getSessionStartMs(session, fallbackStart);
        if (startMs > now) return startMs;
    }

    return Number.MAX_SAFE_INTEGER;
}
