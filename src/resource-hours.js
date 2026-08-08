const DAY_NAMES_EN = {
    sun: 'Sunday',
    sunday: 'Sunday',
    mon: 'Monday',
    monday: 'Monday',
    tue: 'Tuesday',
    tues: 'Tuesday',
    tuesday: 'Tuesday',
    wed: 'Wednesday',
    wednesday: 'Wednesday',
    thu: 'Thursday',
    thur: 'Thursday',
    thurs: 'Thursday',
    thursday: 'Thursday',
    fri: 'Friday',
    friday: 'Friday',
    sat: 'Saturday',
    saturday: 'Saturday',
};

const DAY_NAMES_ES = {
    sun: 'Domingo',
    sunday: 'Domingo',
    mon: 'Lunes',
    monday: 'Lunes',
    tue: 'Martes',
    tues: 'Martes',
    tuesday: 'Martes',
    wed: 'Miércoles',
    wednesday: 'Miércoles',
    thu: 'Jueves',
    thur: 'Jueves',
    thurs: 'Jueves',
    thursday: 'Jueves',
    fri: 'Viernes',
    friday: 'Viernes',
    sat: 'Sábado',
    saturday: 'Sábado',
};

const ORDINAL_WORDS_EN = {
    first: '1st',
    second: '2nd',
    third: '3rd',
    fourth: '4th',
    fifth: '5th',
};

const ORDINAL_WORDS_ES = {
    first: '1.º',
    second: '2.º',
    third: '3.º',
    fourth: '4.º',
    fifth: '5.º',
};

const ORDINAL_DAY_PATTERN = '(?:\\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|fifth)\\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)';

/** @typedef {{ en: string, es: string }} BilingualLabel */

/**
 * @param {string} en
 * @param {string} es
 * @returns {BilingualLabel}
 */
function bilingual(en, es) {
    return { en, es };
}

/**
 * @param {BilingualLabel | string} label
 * @param {(value: string) => string} escapeHtml
 * @returns {string}
 */
export function renderBilingualHoursLabel(label, escapeHtml) {
    if (typeof label === 'string') {
        return `<span class="en-text">${escapeHtml(label)}</span><span class="es-text">${escapeHtml(label)}</span>`;
    }
    return `<span class="en-text">${escapeHtml(label.en)}</span><span class="es-text">${escapeHtml(label.es)}</span>`;
}

/**
 * @param {string} dayPart
 * @param {Record<string, string>} dayNames
 * @returns {string}
 */
function formatDayLabelForLocale(dayPart, dayNames, locale = 'en') {
    const parts = dayPart.trim().toLowerCase().split(/[-–]/).map((d) => d.trim().replace(/s$/, '')).filter(Boolean);
    const labels = parts.map((part) => dayNames[part] || (part.charAt(0).toUpperCase() + part.slice(1)));
    if (labels.length <= 1) return labels[0] || dayPart.trim();
    const endLabel = locale === 'es'
        ? labels[labels.length - 1].toLocaleLowerCase('es')
        : labels[labels.length - 1];
    return `${labels[0]}–${endLabel}`;
}

/**
 * @param {string} dayPart
 * @returns {BilingualLabel}
 */
function formatDayLabelPair(dayPart) {
    return bilingual(
        formatDayLabelForLocale(dayPart, DAY_NAMES_EN, 'en'),
        formatDayLabelForLocale(dayPart, DAY_NAMES_ES, 'es')
    );
}

/**
 * @param {string} ordinalPart
 * @param {Record<string, string>} ordinalWords
 * @returns {string}
 */
function formatOrdinalForLocale(ordinalPart, ordinalWords) {
    const ord = ordinalPart.trim().toLowerCase();
    if (ordinalWords[ord]) return ordinalWords[ord];
    const numeric = ord.match(/^(\d{1,2})(st|nd|rd|th)$/i);
    if (numeric) {
        if (ordinalWords === ORDINAL_WORDS_ES) {
            return `${numeric[1]}.º`;
        }
        return `${numeric[1]}${numeric[2].toLowerCase()}`;
    }
    return ordinalPart.trim();
}

/**
 * @param {string} ordinalPart
 * @param {string} dayPart
 * @returns {BilingualLabel}
 */
function formatOrdinalWeekdayLabelPair(ordinalPart, dayPart) {
    const dayToken = dayPart.trim().toLowerCase().replace(/s$/, '');
    const dayEn = DAY_NAMES_EN[dayToken] || formatDayLabelForLocale(dayPart, DAY_NAMES_EN);
    const dayEs = DAY_NAMES_ES[dayToken] || formatDayLabelForLocale(dayPart, DAY_NAMES_ES);
    return bilingual(
        `${formatOrdinalForLocale(ordinalPart, ORDINAL_WORDS_EN)} ${dayEn}`,
        `${formatOrdinalForLocale(ordinalPart, ORDINAL_WORDS_ES)} ${dayEs}`
    );
}

function formatTimeToken(timeStr) {
    const trimmed = timeStr.trim();
    const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i)
        || trimmed.match(/^(\d{1,2})(?::(\d{2}))(a\.?m\.?|p\.?m\.?)$/i);
    if (!match) return trimmed;
    const minutes = match[2] ? `:${match[2]}` : '';
    const period = (match[3] || '').replace(/\./g, '').toUpperCase();
    return `${match[1]}${minutes}${period ? ` ${period}` : ''}`;
}

function formatTimeRange(openStr, closeStr) {
    return `${formatTimeToken(openStr)} – ${formatTimeToken(closeStr)}`;
}

function parseTimeRangeText(timesRaw) {
    const text = timesRaw.trim();
    if (!text) return '';
    const rangeMatch = text.match(
        /^([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)\s*[-–]\s*([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)$/i
    );
    if (rangeMatch) return formatTimeRange(rangeMatch[1], rangeMatch[2]);
    return formatTimeToken(text);
}

function isHoursHeaderLine(text) {
    return /^(?:open\s+)?(?:each|every)\s+month\s*:?\s*$/i.test(text.trim());
}

function formatHoursHeaderLabelPair() {
    return bilingual('Open each month', 'Abierto cada mes');
}

/**
 * @param {string} segment
 * @returns {{ days: BilingualLabel, times: string } | { header: BilingualLabel } | { plain: BilingualLabel } | null}
 */
export function parseResourceHoursSegment(segment) {
    const text = segment.trim();
    if (!text) return null;

    if (isHoursHeaderLine(text)) {
        return { header: formatHoursHeaderLabelPair() };
    }

    const monthlyMatch = text.match(
        new RegExp(
            `^(?:(\\d{1,2}(?:st|nd|rd|th)|first|second|third|fourth|fifth))\\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\\s*(?:\\(\\s*([^)]+)\\s*\\)|\\s+(.+))?$`,
            'i'
        )
    );
    if (monthlyMatch) {
        const timesRaw = (monthlyMatch[3] || monthlyMatch[4] || '').trim();
        return {
            days: formatOrdinalWeekdayLabelPair(monthlyMatch[1], monthlyMatch[2]),
            times: parseTimeRangeText(timesRaw),
        };
    }

    const rangeMatch = text.match(
        /^([a-z]+(?:[\s-–][a-z]+)?)\s+([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)\s*[-–]\s*([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)$/i
    );
    if (rangeMatch) {
        return {
            days: formatDayLabelPair(rangeMatch[1]),
            times: formatTimeRange(rangeMatch[2], rangeMatch[3]),
        };
    }

    const dayThenRest = text.match(/^([a-z]+(?:[\s-–][a-z]+)?)\s+(.+)$/i);
    const firstDayToken = dayThenRest
        ? dayThenRest[1].trim().toLowerCase().split(/[-–]/)[0].replace(/s$/, '')
        : '';
    if (dayThenRest && DAY_NAMES_EN[firstDayToken]) {
        const rest = dayThenRest[2].trim();
        const embeddedRange = rest.match(
            /^([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)\s*[-–]\s*([\d:]+\s*(?:a\.?m\.?|p\.?m\.?)?)$/i
        );
        return {
            days: formatDayLabelPair(dayThenRest[1]),
            times: embeddedRange
                ? formatTimeRange(embeddedRange[1], embeddedRange[2])
                : parseTimeRangeText(rest),
        };
    }

    const plain = text;
    return { plain: bilingual(plain, plain) };
}

function splitHoursSegments(normalized) {
    return normalized
        .split(new RegExp(`\\n+|[;|]|\\s+and\\s+(?=${ORDINAL_DAY_PATTERN})`, 'i'))
        .map((segment) => segment.trim())
        .filter(Boolean);
}

/**
 * @param {string} hoursText
 * @returns {Array<{ days: BilingualLabel, times: string } | { header: BilingualLabel } | { plain: BilingualLabel }>}
 */
export function parseResourceHours(hoursText) {
    const raw = (hoursText || '').trim().replace(/\r\n/g, '\n');
    const compact = raw.replace(/\s+/g, ' ').trim();
    if (!raw) return [];

    if (/24\s*\/\s*7|24\s*hours|open\s*24|any\s*time|anytime|always\s*open|24\s*hr/i.test(compact)) {
        return [{ plain: bilingual('Open 24 hours', 'Abierto 24 horas') }];
    }

    return splitHoursSegments(raw)
        .map((segment) => parseResourceHoursSegment(segment))
        .filter(Boolean);
}

/**
 * @param {string} hoursText
 * @param {(value: string) => string} escapeHtml
 * @returns {string}
 */
export function formatResourceHoursHtml(hoursText, escapeHtml) {
    const normalized = (hoursText || '').trim();
    if (!normalized) return '';

    const rows = parseResourceHours(hoursText);
    if (rows.length === 0) {
        return `<p class="mobile-resource-card__hours">${renderBilingualHoursLabel(normalized, escapeHtml)}</p>`;
    }
    if (rows.length === 1 && rows[0].plain) {
        return `<p class="mobile-resource-card__hours">${renderBilingualHoursLabel(rows[0].plain, escapeHtml)}</p>`;
    }

    const structured = rows.filter((row) => row.days);
    if (structured.length === 0) {
        return `<p class="mobile-resource-card__hours">${renderBilingualHoursLabel(normalized, escapeHtml)}</p>`;
    }

    const items = rows.map((row) => {
        if (row.header) {
            return `<li class="mobile-resource-card__hours-row mobile-resource-card__hours-row--header">${renderBilingualHoursLabel(row.header, escapeHtml)}</li>`;
        }
        if (row.plain) {
            return `<li class="mobile-resource-card__hours-row mobile-resource-card__hours-row--plain">${renderBilingualHoursLabel(row.plain, escapeHtml)}</li>`;
        }
        if (!row.times) {
            return `<li class="mobile-resource-card__hours-row mobile-resource-card__hours-row--plain">${renderBilingualHoursLabel(row.days, escapeHtml)}</li>`;
        }
        return `<li class="mobile-resource-card__hours-row">
            <span class="mobile-resource-card__hours-days">${renderBilingualHoursLabel(row.days, escapeHtml)}</span>
            <span class="mobile-resource-card__hours-times">${escapeHtml(row.times)}</span>
        </li>`;
    }).join('');

    return `<div class="mobile-resource-card__hours" role="group" aria-label="Hours / Horario">
        <ul class="mobile-resource-card__hours-list">${items}</ul>
    </div>`;
}

// ─── Open-now evaluation ─────────────────────────────────────────────
//
// The card badge ("Open now" / "Closed") reads real advisor-typed text, not a
// structured schedule, so this parser has to cope with what people actually
// write: "Sunday and Wednesday 3pm-4pm", "Pantry Tuesday and Thursday
// 10am-1pm", "2nd Wednesday 10am-1pm and 4th Wednesday 3pm-6pm".
//
// It returns a tri-state on purpose. `undefined` means "this text has no
// parseable schedule" and the caller shows no badge at all — silence is much
// better than telling a student a food pantry is closed when it is not.

const DAY_INDEX = {
    sun: 0, sunday: 0, sundays: 0,
    mon: 1, monday: 1, mondays: 1,
    tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
    wed: 3, weds: 3, wednesday: 3, wednesdays: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
    fri: 5, friday: 5, fridays: 5,
    sat: 6, saturday: 6, saturdays: 6,
};

const ORDINAL_WORD_INDEX = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };

// Spelled out longest-first. A "(?:day)?s?" suffix trick looks tidier but
// silently fails on "wednesday" and "saturday", whose stems are not a prefix
// plus "day" — which is exactly the class of bug this parser is replacing.
const DAY_WORD = '(?:sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?'
    + '|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)';
const TIME = '\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?';
const TIME_RANGE_RE = new RegExp(`(${TIME})\\s*[-‐-―]\\s*(${TIME})`, 'gi');
const DAY_RANGE_RE = new RegExp(`\\b(${DAY_WORD})\\s*[-‐-―]\\s*(${DAY_WORD})\\b`, 'gi');
const DAY_SINGLE_RE = new RegExp(`\\b(${DAY_WORD})\\b`, 'gi');
const ORDINAL_DAY_RE = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)\\s+(${DAY_WORD})\\b|\\b(first|second|third|fourth|fifth)\\s+(${DAY_WORD})\\b`, 'gi');
const ALWAYS_OPEN_RE = /24\s*\/\s*7|24\s*hours|24\s*hrs?\b|open\s*24|any\s*time|anytime|always\s*open|round\s*the\s*clock/i;

function toMinutes(raw) {
    const match = String(raw).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || '0', 10);
    const period = (match[3] || '').toLowerCase();
    if (hours > 23 || minutes > 59) return null;
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

/** Which occurrence of its weekday a date is — the 2 in "2nd Wednesday". */
function ordinalOfMonth(date) {
    return Math.floor((date.getDate() - 1) / 7) + 1;
}

/**
 * Split into parts that each hold at most one time range. "and" separates
 * parts only when both sides carry their own range — otherwise it is joining
 * days, as in "Tuesday and Thursday 10am-1pm".
 */
function splitScheduleParts(text) {
    const countRanges = (value) => (value.match(new RegExp(TIME_RANGE_RE.source, 'gi')) || []).length;

    return text
        .split(/[;|\n]|(?<=\.)\s+/)
        .flatMap((segment) => {
            if (countRanges(segment) < 2) return [segment];
            const pieces = segment.split(/\s+and\s+/i);
            return pieces.every((piece) => countRanges(piece) >= 1) ? pieces : [segment];
        })
        .map((part) => part.trim())
        .filter(Boolean);
}

/** Day indices named in a part, expanding "Monday-Friday" style ranges. */
function daysInPart(part) {
    const days = new Set();

    let match;
    DAY_RANGE_RE.lastIndex = 0;
    const consumed = [];
    while ((match = DAY_RANGE_RE.exec(part)) !== null) {
        const start = DAY_INDEX[match[1].toLowerCase()];
        const end = DAY_INDEX[match[2].toLowerCase()];
        if (start === undefined || end === undefined) continue;
        consumed.push(match[0].toLowerCase());
        for (let day = start; ; day = (day + 1) % 7) {
            days.add(day);
            if (day === end) break;
        }
    }

    // Remove the ranges already handled so their endpoints are not re-added.
    let rest = part.toLowerCase();
    consumed.forEach((phrase) => { rest = rest.replace(phrase, ' '); });

    DAY_SINGLE_RE.lastIndex = 0;
    while ((match = DAY_SINGLE_RE.exec(rest)) !== null) {
        const day = DAY_INDEX[match[1].toLowerCase()];
        if (day !== undefined) days.add(day);
    }

    return days;
}

/** Ordinal constraints such as "2nd Wednesday", as {day, nth} pairs. */
function ordinalsInPart(part) {
    const out = [];
    let match;
    ORDINAL_DAY_RE.lastIndex = 0;
    while ((match = ORDINAL_DAY_RE.exec(part)) !== null) {
        const nth = match[1] ? parseInt(match[1], 10) : ORDINAL_WORD_INDEX[(match[3] || '').toLowerCase()];
        const dayWord = (match[2] || match[4] || '').toLowerCase();
        const day = DAY_INDEX[dayWord];
        if (nth && day !== undefined) out.push({ day, nth });
    }
    return out;
}

/**
 * Is this resource open at `now`?
 *
 * @param {string} hoursText advisor-entered schedule text
 * @param {Date} [now]
 * @returns {boolean|undefined} true open, false closed, undefined unparseable
 */
export function isOpenNow(hoursText, now = new Date()) {
    const text = String(hoursText || '').trim();
    if (!text) return undefined;

    const hasRange = new RegExp(TIME_RANGE_RE.source, 'i').test(text);
    if (!hasRange && ALWAYS_OPEN_RE.test(text)) return true;

    const dayIndex = now.getDay();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const nthToday = ordinalOfMonth(now);

    let parsedAny = false;

    for (const part of splitScheduleParts(text)) {
        TIME_RANGE_RE.lastIndex = 0;
        const range = TIME_RANGE_RE.exec(part);
        if (!range) continue;

        const open = toMinutes(range[1]);
        const close = toMinutes(range[2]);
        if (open === null || close === null) continue;

        const days = daysInPart(part);
        if (!days.size) continue;

        parsedAny = true;
        if (!days.has(dayIndex)) continue;

        const ordinals = ordinalsInPart(part);
        if (ordinals.length) {
            const matchesToday = ordinals.some((o) => o.day === dayIndex && o.nth === nthToday);
            if (!matchesToday) continue;
        }

        const openNow = close > open
            ? minutesNow >= open && minutesNow < close
            : minutesNow >= open || minutesNow < close; // wraps past midnight
        if (openNow) return true;
    }

    return parsedAny ? false : undefined;
}
