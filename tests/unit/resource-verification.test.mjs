import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CATEGORY_RECHECK_MONTHS,
    currentVerificationStamp,
    monthsSince,
    recheckWindowFor,
    verificationStatus,
} from '../../src/resource-verification.js';

const NOW = new Date('2026-09-09T12:00:00Z');

// This module is imported by BOTH the advisor portal's "Needs verification"
// filter and the monthly queue builder. If the two ever disagreed about "due",
// the portal would show a different list than the GitHub issue asks about, so
// the shared definition is pinned here rather than in either caller.

test('the categories students act on fastest get the tightest window', () => {
    for (const c of ['food', 'housing', 'health', 'legal-aid', 'immigration']) {
        assert.equal(recheckWindowFor(c), 3, `${c} should be 3 months`);
    }
    for (const c of ['money', 'jobs', 'family', 'family-community', 'consulates']) {
        assert.equal(recheckWindowFor(c), 4, `${c} should be 4 months`);
    }
    for (const c of ['hse', 'college', 'general', 'esol']) {
        assert.equal(recheckWindowFor(c), 6, `${c} should be 6 months`);
    }
});

test('an unknown or missing category falls back to the longest window', () => {
    assert.equal(recheckWindowFor('brand-new-category'), 6);
    assert.equal(recheckWindowFor(''), 6);
    assert.equal(recheckWindowFor(undefined), 6);
});

test('every configured window is a sane number of months', () => {
    for (const [category, months] of Object.entries(CATEGORY_RECHECK_MONTHS)) {
        assert.ok(Number.isInteger(months) && months >= 1 && months <= 12, `${category}: ${months}`);
    }
});

test('monthsSince only accepts YYYY-MM', () => {
    assert.equal(monthsSince('2026-09', NOW), 0);
    assert.equal(monthsSince('2026-03', NOW), 6);
    assert.equal(monthsSince('2025-09', NOW), 12);
    assert.equal(monthsSince('2026-9', NOW), null);
    assert.equal(monthsSince('2026-09-09', NOW), null);
    assert.equal(monthsSince('', NOW), null);
    assert.equal(monthsSince(null, NOW), null);
});

test('a card inside its window is not due', () => {
    const v = verificationStatus('food', '2026-08', NOW);
    assert.equal(v.status, 'ok');
    assert.equal(v.isDue, false);
    assert.equal(v.monthsOld, 1);
});

test('a card is due the month it reaches its window, not before', () => {
    assert.equal(verificationStatus('food', '2026-07', NOW).isDue, false, '2 of 3 months');
    const due = verificationStatus('food', '2026-06', NOW);
    assert.equal(due.isDue, true);
    assert.equal(due.status, 'overdue');
    assert.equal(due.monthsOld, 3);
    assert.equal(due.overdueBy, 0, 'just crossed the line');
});

test('the same date is due in one category and fine in another', () => {
    assert.equal(verificationStatus('food', '2026-05', NOW).isDue, true, 'food: 3-month window');
    assert.equal(verificationStatus('college', '2026-05', NOW).isDue, false, 'college: 6-month window');
});

test('a never-verified or unreadable card is due and sorts above everything', () => {
    const never = verificationStatus('college', '', NOW);
    const bad = verificationStatus('college', 'last spring', NOW);
    const ancient = verificationStatus('food', '2020-01', NOW);

    assert.equal(never.status, 'never-verified');
    assert.equal(bad.status, 'bad-date');
    assert.ok(never.isDue && bad.isDue && ancient.isDue);
    assert.ok(never.overdueBy > ancient.overdueBy, 'never-verified outranks even a very old date');
    assert.ok(bad.overdueBy > ancient.overdueBy);
});

test('overdueBy orders the queue worst-first', () => {
    const items = [
        ['food', '2026-06'],    // 3 months old, 3-month window -> overdue by 0
        ['food', '2025-01'],    // 20 months old, 3-month window -> overdue by 17
        ['college', ''],        // never verified -> sorts above every real date
        ['college', '2026-01'], // 8 months old, 6-month window -> overdue by 2
        ['college', '2026-06'], // 3 months old, 6-month window -> not due at all
    ].map(([c, v]) => ({ c, v, ...verificationStatus(c, v, NOW) }));

    const order = items.filter((i) => i.isDue).sort((a, b) => b.overdueBy - a.overdueBy).map((i) => i.v);
    assert.deepEqual(order, ['', '2025-01', '2026-01', '2026-06']);
    assert.equal(items.filter((i) => !i.isDue).length, 1, 'the fresh college card stays out of the queue');
});

test('the stamp is the YYYY-MM the queue parses back', () => {
    assert.equal(currentVerificationStamp(new Date('2026-09-09T12:00:00Z')), '2026-09');
    assert.equal(currentVerificationStamp(new Date('2026-01-31T12:00:00Z')), '2026-01');
    assert.equal(currentVerificationStamp(new Date('2026-12-01T12:00:00Z')), '2026-12');

    // Round-trip: pressing the button must clear the card from the queue.
    const stamp = currentVerificationStamp(NOW);
    assert.equal(verificationStatus('food', stamp, NOW).isDue, false);
    assert.equal(monthsSince(stamp, NOW), 0);
});
