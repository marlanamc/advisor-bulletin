/**
 * Unified search scoring for the student board.
 *
 * Posts, events and help resources all live in the same `bulletins` array, so
 * one pass can rank them together. This module is deliberately DOM-free: it
 * takes plain objects and returns ranked results, which keeps the matching
 * rules testable on their own.
 *
 * Three rules drive it:
 *
 *   1. Every term must match somewhere. "food east boston" is three terms, and
 *      an item has to contain all three (in any field, in any order) to appear.
 *      The old search treated the whole string as one literal, so any two-word
 *      query returned nothing unless those words sat adjacent in one field.
 *   2. Where a term matches decides the score. A hit in the title outranks a
 *      hit in the advisor's name, so the best answer sorts to the top instead
 *      of whatever happened to be posted most recently.
 *   3. Whole words beat fragments. "art" should not rank an item titled
 *      "Start Here" above one whose chips literally say "art".
 */

import { normalizeSearchText } from './search-normalize.js';
import { translateResourceChipEs } from './resource-chip-labels.js';

/**
 * Field weights, highest signal first. `chips` covers the student-facing
 * summary labels, which are often the truest description of what a place
 * actually gives you.
 */
const WEIGHTS = {
    title: 10,
    chips: 7,
    description: 4,
    category: 3,
    place: 2,
    meta: 1,
};

const PHRASE_TITLE_BONUS = 8;
const WHOLE_WORD_BONUS = 3;
const TITLE_PREFIX_BONUS = 4;

/**
 * Function words carry no signal but, under AND semantics, would each become a
 * required term — "clases de ingles" would exclude an item that says "clases
 * para aprender ingles". Dropped unless the query is nothing but stopwords.
 */
const STOPWORDS = new Set([
    'the', 'a', 'an', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'at', 'is', 'it', 'my',
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o',
    'para', 'con', 'en', 'al', 'mi', 'me', 'que', 'por',
]);

/** Split a query into normalized, de-noised terms. */
export function tokenizeQuery(query) {
    const all = normalizeSearchText(query)
        .split(/[^a-z0-9$]+/)
        .filter((term) => term.length > 0);

    const meaningful = all.filter((term) => !STOPWORDS.has(term));
    return meaningful.length ? meaningful : all;
}

/**
 * Collect an item's searchable text into weighted buckets. Resources and posts
 * share most fields; the ones only one type has are simply absent.
 *
 * @param {Record<string, any>} item
 * @returns {Array<{ weight: number, text: string }>}
 */
/** The English chip labels, however this item happens to store them. */
function chipList(item) {
    const raw = item.serviceChips || item.services || item.highlights || '';
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    return list.map((chip) => String(chip).trim()).filter(Boolean);
}

function chipText(item) {
    return chipList(item).join(' ');
}

/**
 * Chips are stored in English and translated at render time, so without this
 * a student searching "vivienda" or "pañales" would miss the very labels shown
 * on the card in front of them.
 */
function spanishChipText(item) {
    return chipList(item)
        .map((chip) => {
            try {
                return translateResourceChipEs(chip);
            } catch {
                return '';
            }
        })
        .filter(Boolean)
        .join(' ');
}

function buildFields(item) {
    const join = (...values) => values.filter(Boolean).join(' ');

    return [
        {
            weight: WEIGHTS.title,
            text: normalizeSearchText(join(item.title, item.titleEn, item.titleEs, item.resourceTitleEs)),
        },
        {
            weight: WEIGHTS.chips,
            text: normalizeSearchText(join(chipText(item), spanishChipText(item))),
        },
        {
            weight: WEIGHTS.description,
            text: normalizeSearchText(join(item.description, item.summaryEs)),
        },
        {
            weight: WEIGHTS.category,
            text: normalizeSearchText(join(item.resourceCategory, item.category, item.classType)),
        },
        {
            weight: WEIGHTS.place,
            text: normalizeSearchText(join(item.address, item.company, item.eventLocation)),
        },
        {
            weight: WEIGHTS.meta,
            text: normalizeSearchText(join(item.phone, item.contact, item.advisorName, item.url, item.eventLink)),
        },
    ].filter((field) => field.text.length > 0);
}

/** True when `term` appears in `text` bounded by non-alphanumerics. */
function hasWholeWord(text, term) {
    let from = 0;
    for (;;) {
        const at = text.indexOf(term, from);
        if (at === -1) return false;
        const before = at === 0 ? '' : text[at - 1];
        const after = text[at + term.length] ?? '';
        const boundedBefore = before === '' || !/[a-z0-9]/.test(before);
        const boundedAfter = after === '' || !/[a-z0-9]/.test(after);
        if (boundedBefore && boundedAfter) return true;
        from = at + 1;
    }
}

/**
 * Score one item against pre-tokenized terms.
 *
 * @returns {number} 0 when any term is missing, otherwise a relevance score
 */
export function scoreItem(item, terms, normalizedQuery = '') {
    if (!terms.length) return 0;

    const fields = buildFields(item);
    if (!fields.length) return 0;

    const titleField = fields.find((field) => field.weight === WEIGHTS.title);
    let score = 0;

    for (const term of terms) {
        let best = 0;
        for (const field of fields) {
            if (!field.text.includes(term)) continue;
            const bonus = hasWholeWord(field.text, term) ? WHOLE_WORD_BONUS : 0;
            best = Math.max(best, field.weight + bonus);
        }
        // AND semantics: one missing term disqualifies the item entirely.
        if (best === 0) return 0;
        score += best;
    }

    if (titleField && normalizedQuery) {
        if (titleField.text.includes(normalizedQuery)) score += PHRASE_TITLE_BONUS;
        if (titleField.text.startsWith(normalizedQuery)) score += TITLE_PREFIX_BONUS;
    }

    return score;
}

/**
 * Rank a mixed list of posts and resources against a raw query string.
 *
 * @param {Array<Record<string, any>>} items
 * @param {string} query
 * @param {{ isResource: (item: any) => boolean, limit?: number }} options
 * @returns {{ terms: string[], resources: any[], posts: any[], total: number }}
 */
export function searchItems(items, query, { isResource, limit = 40 } = {}) {
    const terms = tokenizeQuery(query);
    const empty = { terms, resources: [], posts: [], total: 0 };
    if (!terms.length || !Array.isArray(items)) return empty;

    const normalizedQuery = normalizeSearchText(query).trim();
    const resources = [];
    const posts = [];

    for (const item of items) {
        const score = scoreItem(item, terms, normalizedQuery);
        if (score <= 0) continue;
        (isResource && isResource(item) ? resources : posts).push({ item, score });
    }

    // Ties fall back to the newest item so ordering stays stable and useful.
    const byScore = (a, b) => b.score - a.score
        || toTime(b.item.datePosted || b.item.createdAt) - toTime(a.item.datePosted || a.item.createdAt);

    resources.sort(byScore);
    posts.sort(byScore);

    return {
        terms,
        resources: resources.slice(0, limit).map((entry) => entry.item),
        posts: posts.slice(0, limit).map((entry) => entry.item),
        total: resources.length + posts.length,
    };
}

function toTime(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
}
