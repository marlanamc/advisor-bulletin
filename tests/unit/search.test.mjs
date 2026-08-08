/**
 * Unit tests for unified search scoring.
 *
 * These lock in the four rules the search promises: all terms must match,
 * field weight decides rank, whole words beat fragments, and Spanish reaches
 * the same results as English.
 *
 * Run: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchItems, tokenizeQuery, scoreItem } from '../../src/search.js';

const isResource = (item) => item.type === 'resource';

const resource = (over) => ({
    type: 'resource',
    id: over.id,
    title: over.title,
    titleEn: over.title,
    resourceCategory: over.resourceCategory || 'food',
    description: over.description || '',
    summaryEs: over.summaryEs || '',
    serviceChips: over.serviceChips || [],
    address: over.address || '',
    advisorName: over.advisorName || 'Import',
    datePosted: '2026-08-01T00:00:00.000Z',
    ...over,
});

const ITEMS = [
    resource({
        id: 'soup',
        title: 'East Boston Soup Kitchen',
        description: 'Get a free hot meal and bags of food every Tuesday.',
        summaryEs: 'Reciba una comida caliente gratis y bolsas de comida todos los martes.',
        serviceChips: ['Get a hot meal', 'Get groceries'],
        address: '28 Paris Street, East Boston, MA 02128',
    }),
    resource({
        id: 'raft',
        title: 'RAFT Rent Help',
        resourceCategory: 'housing',
        description: 'Get up to $7,000 to pay rent you owe.',
        summaryEs: 'Reciba hasta $7,000 para pagar renta atrasada.',
        serviceChips: ['Get rent help', 'Get housing help'],
    }),
    resource({
        id: 'diapers',
        title: 'Ollie Diaper Depot',
        resourceCategory: 'family',
        description: 'Get free diapers and wipes once a month.',
        summaryEs: 'Consiga pañales y toallitas gratis una vez al mes.',
        serviceChips: ['Get diapers', 'Get baby supplies'],
    }),
    {
        type: 'post',
        id: 'drive',
        title: 'Food Drive in East Boston',
        titleEs: 'Colecta de comida en East Boston',
        description: 'Bring canned food to the front office.',
        advisorName: 'Marlana',
        datePosted: '2026-08-02T00:00:00.000Z',
    },
];

const run = (query) => searchItems(ITEMS, query, { isResource });
const ids = (list) => list.map((item) => item.id);

test('tokenizer drops stopwords but keeps meaning', () => {
    assert.deepEqual(tokenizeQuery('clases de ingles'), ['clases', 'ingles']);
    assert.deepEqual(tokenizeQuery('  RENT   help '), ['rent', 'help']);
    // A query made only of stopwords keeps them rather than matching everything.
    assert.deepEqual(tokenizeQuery('de la'), ['de', 'la']);
});

test('one query returns both resources and posts', () => {
    const result = run('food');
    assert.ok(result.resources.length >= 1);
    assert.ok(result.posts.length >= 1);
    assert.equal(result.total, result.resources.length + result.posts.length);
});

test('every term must match somewhere', () => {
    assert.equal(run('diapers rent').total, 0);
    assert.ok(run('rent help').total > 0);
});

test('multi-word queries match across separate fields', () => {
    // "food" is in the description, "paris" only in the address.
    assert.deepEqual(ids(run('food paris').resources), ['soup']);
});

test('a title match outranks a description mention', () => {
    assert.equal(ids(run('rent').resources)[0], 'raft');
});

test('whole words beat fragments', () => {
    const whole = scoreItem(ITEMS[1], ['rent'], 'rent');
    const fragment = scoreItem(ITEMS[1], ['ren'], 'ren');
    assert.ok(whole > fragment, `expected whole-word ${whole} > fragment ${fragment}`);
});

test('accent-free Spanish finds accented text', () => {
    assert.deepEqual(ids(run('panales').resources), ['diapers']);
    assert.deepEqual(ids(run('comida').resources), ['soup']);
});

test('translated Spanish chip labels are searchable', () => {
    // "vivienda" appears only in the Spanish rendering of "Get housing help".
    assert.deepEqual(ids(run('vivienda').resources), ['raft']);
});

test('no query and no match return empty results', () => {
    assert.equal(run('').total, 0);
    assert.equal(run('   ').total, 0);
    assert.equal(run('zzzqqq').total, 0);
});

test('results are capped by limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => resource({
        id: `r${i}`, title: `Food Place ${i}`, description: 'food',
    }));
    const result = searchItems(many, 'food', { isResource, limit: 5 });
    assert.equal(result.resources.length, 5);
    assert.equal(result.total, 30);
});
