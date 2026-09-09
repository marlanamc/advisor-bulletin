/**
 * When a resource card is due for a human to re-check its details.
 *
 * Shared deliberately: the advisor portal's verification filter (Needs checking /
 * Verified) and `Verified today` button (src/admin-manage.js) and the monthly queue builder
 * (scripts/check-resource-content-risk.mjs) must agree on what "due" means,
 * or the portal would show a different list than the GitHub issue asks for.
 * Keep this module dependency-free so the Node script can import it directly
 * (same pattern as src/resource-chip-labels.js ← check-chip-translations.mjs).
 */

// How long a card in each category may go unverified. The 3-month tier is the
// set of categories where a stale hour or eligibility rule sends a student to
// a closed door, so it needs no separate "high risk" signal on top.
export const CATEGORY_RECHECK_MONTHS = {
    food: 3,
    housing: 3,
    health: 3,
    'legal-aid': 3,
    immigration: 3,
    money: 4,
    jobs: 4,
    family: 4,
    'family-community': 4,
    consulates: 4,
    hse: 6,
    college: 6,
    general: 6,
    esol: 6,
};

export const DEFAULT_RECHECK_MONTHS = 6;

export function recheckWindowFor(category) {
    return CATEGORY_RECHECK_MONTHS[category] || DEFAULT_RECHECK_MONTHS;
}

/** Whole months between a YYYY-MM stamp and now; null if unparseable. */
export function monthsSince(yearMonth, now) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(yearMonth || '').trim());
    if (!match) return null;
    return (now.getFullYear() - Number(match[1])) * 12 + (now.getMonth() + 1 - Number(match[2]));
}

/** The stamp the "Verified today" button writes. */
export function currentVerificationStamp(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Takes primitives rather than a resource object, because the portal and the
 * Node script hold different shapes for the same card.
 *
 * `overdueBy` exists for ordering: never-verified and unreadable dates sort
 * above everything with a real date, worst-overdue first.
 */
export function verificationStatus(category, lastVerified, now = new Date()) {
    const window = recheckWindowFor(category);
    const base = { window, monthsOld: null, overdueBy: 0, isDue: false };

    if (!lastVerified) {
        return { ...base, status: 'never-verified', overdueBy: Number.MAX_SAFE_INTEGER, isDue: true };
    }

    const monthsOld = monthsSince(lastVerified, now);
    if (monthsOld === null) {
        return { ...base, status: 'bad-date', overdueBy: Number.MAX_SAFE_INTEGER, isDue: true };
    }
    if (monthsOld >= window) {
        return { ...base, status: 'overdue', monthsOld, overdueBy: monthsOld - window, isDue: true };
    }
    return { ...base, status: 'ok', monthsOld };
}
