import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeActionUrl,
    normalizePdfUrl,
    normalizeWebUrl,
} from '../../src/url-safety.js';
import {
    normalizeActionLinkUrl,
    normalizeResourceActionLinks,
} from '../../src/resource-action-links.js';

test('web urls default to https and keep explicit http or https', () => {
    assert.equal(normalizeWebUrl('example.org/help'), 'https://example.org/help');
    assert.equal(normalizeWebUrl('http://example.org/help'), 'http://example.org/help');
    assert.equal(normalizeWebUrl('https://example.org/help'), 'https://example.org/help');
});

test('web urls reject unsafe or malformed protocols', () => {
    assert.equal(normalizeWebUrl('javascript:alert(1)'), '');
    assert.equal(normalizeWebUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(normalizeWebUrl('https://example.org/" onclick="alert(1)'), '');
    assert.equal(normalizeWebUrl('not a url'), '');
});

test('action links allow web, mail, and phone links only', () => {
    assert.equal(normalizeActionLinkUrl('example.org/intake'), 'https://example.org/intake');
    assert.equal(normalizeActionLinkUrl('mailto:intake@example.org'), 'mailto:intake@example.org');
    assert.equal(normalizeActionLinkUrl('tel:+16175551212'), 'tel:+16175551212');
    assert.equal(normalizeActionLinkUrl('sms:+16175551212'), '');
    assert.equal(normalizeActionLinkUrl('javascript:alert(1)'), '');
});

test('pdf urls allow https and application/pdf data urls only', () => {
    const pdfDataUrl = 'data:application/pdf;base64,JVBERi0xLjQ=';
    assert.equal(normalizePdfUrl('https://example.org/form.pdf'), 'https://example.org/form.pdf');
    assert.equal(normalizePdfUrl(pdfDataUrl), pdfDataUrl);
    assert.equal(normalizePdfUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(normalizePdfUrl('javascript:alert(1)'), '');
});

test('resource action links drop blank, duplicate, and unsafe links', () => {
    const links = normalizeResourceActionLinks([
        { labelEn: 'Apply', labelEs: 'Aplicar', url: 'example.org/apply' },
        { labelEn: 'Duplicate', labelEs: 'Duplicado', url: 'https://example.org/apply' },
        { labelEn: 'Unsafe', labelEs: 'No seguro', url: 'javascript:alert(1)' },
        { labelEn: 'PDF', labelEs: 'PDF', pdfUrl: 'data:application/pdf;base64,JVBERi0xLjQ=' },
        { labelEn: '', labelEs: 'Blank', url: 'example.org/blank' },
    ]);

    assert.deepEqual(links, [
        {
            labelEn: 'Apply',
            labelEs: 'Aplicar',
            url: 'https://example.org/apply',
            pdfUrl: '',
        },
        {
            labelEn: 'PDF',
            labelEs: 'PDF',
            url: '',
            pdfUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
        },
    ]);
});
