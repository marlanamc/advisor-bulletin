/**
 * Search text folding shared by the student feed search and the resource search.
 *
 * Students type the way it is easiest to type. On a phone that means no accents
 * ("inmigracion", "clinica", "medico") and a straight apostrophe, while the
 * stored data uses the real characters - "inmigracion" with an accent,
 * "Mayor's Health Line" with U+2019, "Pop-Ups" with a U+2011 non-breaking
 * hyphen. Comparing raw strings makes those searches return nothing, which
 * reads to the student as "this app has nothing for me".
 *
 * Folding both the query and the haystack through normalizeSearchText() keeps
 * them matching. Decomposing to NFD and dropping the combining marks also maps
 * n-with-tilde to n, so "espanol" finds the accented spelling.
 *
 * Escape sequences are used instead of literal characters below: several of
 * these are invisible or combining, and an editor re-encoding the file would
 * silently break the character class without showing anything in the diff.
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const APOSTROPHES = /[\u2018\u2019\u201a\u201b\u02bc\u02b9\u00b4\u0060]/g;
const QUOTES = /[\u201c\u201d\u201e\u201f\u00ab\u00bb]/g;
const DASHES = /[\u2010-\u2015\u2212]/g;
const SPACES = /[\u00a0\u2007\u2009\u202f]/g;

/**
 * @param {unknown} value
 * @returns {string} lowercased, accent-stripped, punctuation-flattened text
 */
export function normalizeSearchText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .replace(APOSTROPHES, "'")
        .replace(QUOTES, '"')
        .replace(DASHES, '-')
        .replace(SPACES, ' ')
        .toLowerCase();
}

/**
 * Folded substring test. `normalizedQuery` must already have been through
 * normalizeSearchText() - callers normalize the query once and reuse it across
 * every field and every row.
 *
 * @param {unknown} haystack
 * @param {string} normalizedQuery
 * @returns {boolean}
 */
export function searchTextIncludes(haystack, normalizedQuery) {
    if (!normalizedQuery) return true;
    return normalizeSearchText(haystack).includes(normalizedQuery);
}
