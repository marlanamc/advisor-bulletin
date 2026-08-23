/**
 * Unit tests for action-chip parsing and Spanish translation.
 *
 * Chips are stored as one comma-joined string per resource, which is fine
 * until a chip label itself contains a comma ("Study health, business, or
 * tech") — the cases below are real chip strings from live resources.
 *
 * Run: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getCanonicalResourceChipCatalog,
    parseResourceServiceChips,
    translateResourceChipEs,
} from '../../src/resource-chip-labels.js';

test('splits a plain comma-joined chip string', () => {
    assert.deepEqual(
        parseResourceServiceChips('Get food help, Get childcare licensing support, Join community activities'),
        ['Get food help', 'Get childcare licensing support', 'Join community activities'],
    );
});

test('keeps commas that belong inside one chip label', () => {
    // Roxbury Community College / the Attorney General's Office: a lowercase
    // fragment is the tail of the chip before it, not a chip of its own.
    assert.deepEqual(
        parseResourceServiceChips('Go to college, Study health, business, or tech'),
        ['Go to college', 'Study health, business, or tech'],
    );
    assert.deepEqual(
        parseResourceServiceChips('Report a problem, Landlord, job, or business issues'),
        ['Report a problem', 'Landlord, job, or business issues'],
    );
});

test('semicolons are the only separator when present (CSV imports)', () => {
    assert.deepEqual(
        parseResourceServiceChips('Take classes online; Take English classes; Get training'),
        ['Take classes online', 'Take English classes', 'Get training'],
    );
    assert.deepEqual(
        parseResourceServiceChips('Use free computers, wifi, or printing; Get training'),
        ['Use free computers, wifi, or printing', 'Get training'],
    );
});

test('trims blanks and honours the max', () => {
    assert.deepEqual(parseResourceServiceChips('  Get groceries ,, Get a hot meal '), ['Get groceries', 'Get a hot meal']);
    assert.deepEqual(parseResourceServiceChips('A, B, C', 2), ['A', 'B']);
    assert.deepEqual(parseResourceServiceChips(''), []);
    assert.deepEqual(parseResourceServiceChips(['Get groceries', ' ', 'Get a hot meal']), ['Get groceries', 'Get a hot meal']);
});

test('a comma-carrying chip keeps its Spanish translation', () => {
    const [, chip] = parseResourceServiceChips('Go to college, Study health, business, or tech');
    assert.equal(translateResourceChipEs(chip), 'Estudiar salud, negocios o tecnología');
});

test('service keywords map to an action label before translating', () => {
    assert.equal(translateResourceChipEs('food pantry'), 'Conseguir comida');
    assert.equal(translateResourceChipEs('tenant rights'), 'Ayuda con vivienda');
});

test('every catalog chip has Spanish', () => {
    const untranslated = getCanonicalResourceChipCatalog()
        .filter((chip) => translateResourceChipEs(chip) === chip);
    assert.deepEqual(untranslated, [], `Add these to RESOURCE_CHIP_ES: ${untranslated.join(' | ')}`);
});
