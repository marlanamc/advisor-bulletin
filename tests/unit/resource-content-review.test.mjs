import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildReport,
    checkHintsFor,
    monthsSince,
    recheckWindowFor,
    reviewForResource,
} from '../../scripts/check-resource-content-risk.mjs';

const NOW = new Date('2026-09-09T12:00:00Z');

const resource = (o = {}) => ({
    id: o.id || 'r1',
    title: o.title || 'Food Pantry',
    resourceCategory: o.category ?? 'food',
    url: 'https://example.org',
    description: o.description || '',
    highlights: o.highlights || '',
    hours: o.hours || '',
    actionLinks: o.actionLinks || [],
    lastVerified: o.lastVerified ?? '2026-09',
});

test('recheck windows are tightest for the categories students act on fastest', () => {
    for (const c of ['food', 'housing', 'health', 'legal-aid', 'immigration']) {
        assert.equal(recheckWindowFor(c), 3, `${c} should be a 3-month category`);
    }
    assert.equal(recheckWindowFor('jobs'), 4);
    assert.equal(recheckWindowFor('college'), 6);
    assert.equal(recheckWindowFor('something-new'), 6, 'unknown categories fall back to 6');
});

test('monthsSince reads YYYY-MM and rejects anything else', () => {
    assert.equal(monthsSince('2026-09', NOW), 0);
    assert.equal(monthsSince('2026-06', NOW), 3);
    assert.equal(monthsSince('2025-09', NOW), 12);
    assert.equal(monthsSince('2026-9', NOW), null);
    assert.equal(monthsSince('September 2026', NOW), null);
    assert.equal(monthsSince('', NOW), null);
});

test('a recently verified card is not in the queue', () => {
    assert.equal(reviewForResource(resource({ lastVerified: '2026-09' }), NOW), null);
    assert.equal(reviewForResource(resource({ lastVerified: '2026-08' }), NOW), null);
});

test('a card is queued only once it passes its own window', () => {
    // food = 3 months
    assert.equal(reviewForResource(resource({ lastVerified: '2026-07' }), NOW), null, '2 months is still fresh');
    const due = reviewForResource(resource({ lastVerified: '2026-06' }), NOW);
    assert.equal(due.status, 'overdue');
    assert.equal(due.monthsOld, 3);
    assert.equal(due.window, 3);

    // college = 6 months, so the same date is still fine there
    assert.equal(reviewForResource(resource({ category: 'college', lastVerified: '2026-06' }), NOW), null);
});

test('a missing or malformed date is queued', () => {
    assert.equal(reviewForResource(resource({ lastVerified: '' }), NOW).status, 'never-verified');
    assert.equal(reviewForResource(resource({ lastVerified: 'last summer' }), NOW).status, 'bad-date');
});

test('being in a high-risk category is not itself a finding', () => {
    // This is the double-count that flagged 46 resources in the old version:
    // the category already sets the 3-month window, so a fresh food resource
    // must produce nothing at all.
    assert.equal(reviewForResource(resource({ category: 'food', lastVerified: '2026-09' }), NOW), null);
});

test('mentioning hours, prices or eligibility is not itself a finding', () => {
    const chatty = resource({
        lastVerified: '2026-09',
        description: 'Open Monday 9:00 AM - 5:00 PM. Costs $25. You must qualify and show proof of income.',
        highlights: 'Walk-in, by appointment',
    });
    assert.equal(reviewForResource(chatty, NOW), null, 'a verified card stays out of the queue however it is worded');
});

test('those signals become "what to check" once a card is actually due', () => {
    const hints = checkHintsFor(resource({
        description: 'Open Monday 9:00 AM. Costs $25. You must qualify with proof of income. Summer only.',
        highlights: 'by appointment',
    }));
    assert.deepEqual(
        hints.sort(),
        ['eligibility and required documents', 'hours', 'intake or appointment rules', 'seasonal timing', 'the stated cost'].sort()
    );

    const due = reviewForResource(resource({ lastVerified: '', description: 'Open Monday 9:00 AM. Costs $25.' }), NOW);
    assert.match(due.advisorAction, /Check hours, the stated cost/);
    assert.match(due.advisorAction, /Verified today/, 'the action names the portal button that clears it');
});

test('a card with no volatile wording still gets a plain action', () => {
    const due = reviewForResource(resource({ lastVerified: '', description: 'A community organization.' }), NOW);
    assert.deepEqual(due.checkHints, []);
    assert.match(due.advisorAction, /quick look/);
    assert.match(due.advisorAction, /Verified today/);
});

test('the queue is ordered worst-first, never-verified at the top', () => {
    const report = buildReport([
        resource({ id: 'fresh', lastVerified: '2026-09' }),
        resource({ id: 'slightly', lastVerified: '2026-06' }),
        resource({ id: 'ancient', lastVerified: '2024-01' }),
        resource({ id: 'unknown', lastVerified: '' }),
    ], NOW);

    assert.deepEqual(report.due.map((d) => d.id), ['unknown', 'ancient', 'slightly']);
    assert.equal(report.totals.resources, 4);
    assert.equal(report.totals.due, 3);
    assert.equal(report.totals.neverVerified, 1);
    assert.equal(report.totals.overdue, 2);
});

test('every queue entry carries a stable key for week-over-week diffing', () => {
    const report = buildReport([resource({ id: 'abc', lastVerified: '' })], NOW);
    assert.equal(report.due[0].issueKey, 'abc|content');
});
