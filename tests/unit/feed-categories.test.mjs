/**
 * English class is its own topic. Training posts must not ride along
 * just because they still have an ESOL classType or a loose tag.
 *
 * Run: npm run test:unit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulletinMatchesPostCategory, getPostCategoryMeta } from '../../src/feed-categories.js';

test('English class filter label stays English class, not Free Classes', () => {
    const meta = getPostCategoryMeta('esol');
    assert.equal(meta.filterLabelEn, 'English class');
});

test('English class matches ESOL posts and legacy english aliases', () => {
    assert.equal(bulletinMatchesPostCategory({ category: 'esol' }, 'esol'), true);
    assert.equal(bulletinMatchesPostCategory({ category: 'english class' }, 'esol'), true);
    assert.equal(bulletinMatchesPostCategory({ category: 'english' }, 'esol'), true);
});

test('English class does not match training posts with leftover classType or tags', () => {
    const training = {
        category: 'training',
        classType: 'esol',
        tags: ['english', 'Free Classes'],
    };
    assert.equal(bulletinMatchesPostCategory(training, 'esol'), false);
    assert.equal(bulletinMatchesPostCategory(training, 'training'), true);
});
