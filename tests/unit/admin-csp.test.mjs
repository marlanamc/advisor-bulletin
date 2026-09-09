import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('admin page has no inline scripts blocked by its CSP', () => {
    const html = readFileSync(new URL('../../admin.html', import.meta.url), 'utf8');
    const scriptTags = html.match(/<script\b[^>]*>/gi) || [];

    assert.ok(scriptTags.length > 0, 'admin page should load its external application script');
    assert.ok(
        scriptTags.every((tag) => /\bsrc\s*=/.test(tag)),
        'all admin scripts must be external because the production CSP forbids inline scripts',
    );
});
