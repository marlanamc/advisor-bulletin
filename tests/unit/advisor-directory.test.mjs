/**
 * The student advisor directory sorts leadership titles above plain advisors.
 * The title is free text typed on the Advisors tab, so the check has to
 * survive the ways a human actually types it — a stray "advisor " must not
 * read as a leadership title and land Carol's slot at the top of the page.
 *
 * Run: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLeadershipRole, STUDENT_ADVISOR_DIRECTORY } from '../../src/advisor-directory.js';

test('leadership titles sort above advisors', () => {
    assert.equal(isLeadershipRole('Director'), true);
    assert.equal(isLeadershipRole('Coordinator/Educator'), true);
    assert.equal(isLeadershipRole('Coordinator'), true);
});

test('plain advisors are not leadership, however the title is typed', () => {
    assert.equal(isLeadershipRole('Advisor'), false);
    assert.equal(isLeadershipRole('advisor'), false);
    assert.equal(isLeadershipRole('ADVISOR'), false);
    assert.equal(isLeadershipRole('  Advisor  '), false);
});

test('a blank title means Advisor, matching the publish default', () => {
    assert.equal(isLeadershipRole(''), false);
    assert.equal(isLeadershipRole('   '), false);
    assert.equal(isLeadershipRole(undefined), false);
    assert.equal(isLeadershipRole(null), false);
});

test('the static fallback list leads with Carol and Leah', () => {
    const leaders = STUDENT_ADVISOR_DIRECTORY.filter((a) => isLeadershipRole(a.role));
    assert.deepEqual(leaders.map((a) => `${a.name} — ${a.role}`), [
        'Carol — Director',
        'Leah — Coordinator/Educator',
    ]);
    // Leadership must come first, so the fallback matches what publishing produces.
    assert.deepEqual(
        STUDENT_ADVISOR_DIRECTORY.slice(0, leaders.length).map((a) => a.name),
        leaders.map((a) => a.name)
    );
});

test('every fallback login id is the prefix of its email', () => {
    for (const advisor of STUDENT_ADVISOR_DIRECTORY) {
        assert.equal(
            advisor.email.split('@')[0],
            advisor.loginUsername,
            `${advisor.name}: loginUsername must match the email prefix used for Google sign-in`
        );
    }
});
