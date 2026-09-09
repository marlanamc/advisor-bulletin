import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    classifyNonHttpUrl,
    classifyRequestError,
    classifyResponse,
    normalizeHost,
} from '../../scripts/check-resource-links.mjs';

test('a plain 200 with no redirect is ok', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/apply/intake',
        finalUrl: 'https://example.org/apply/intake',
        httpStatus: 200,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.domainChanged, false);
    assert.equal(result.finalUrl, undefined);
});

test('a redirect to another host is ok but flagged as moved', () => {
    const result = classifyResponse({
        requestedUrl: 'https://oldname.org/help',
        finalUrl: 'https://newname.org/help',
        httpStatus: 200,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.domainChanged, true);
    assert.equal(result.finalUrl, 'https://newname.org/help');
});

test('a www-only difference is not treated as a domain change', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/help',
        finalUrl: 'https://www.example.org/help',
        httpStatus: 200,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.domainChanged, false);
});

test('a deep link that collapses to the site root is flagged, not called ok', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/apply/esol-intake',
        finalUrl: 'https://example.org/',
        httpStatus: 200,
    });
    assert.equal(result.status, 'warn-path-collapsed');
    assert.equal(result.finalUrl, 'https://example.org/');
    assert.match(result.reason, /site root/);
});

test('a deep link that keeps a real path is ok even after redirecting', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/apply',
        finalUrl: 'https://example.org/apply/intake-form',
        httpStatus: 200,
    });
    assert.equal(result.status, 'ok');
    assert.equal(result.finalUrl, 'https://example.org/apply/intake-form');
});

test('a homepage url that stays on the homepage is not a path collapse', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/',
        finalUrl: 'https://example.org/',
        httpStatus: 200,
    });
    assert.equal(result.status, 'ok');
});

test('bot-blocks, rate limits and server errors are warnings, not breaks', () => {
    assert.equal(classifyResponse({ requestedUrl: 'https://mass.gov/x', httpStatus: 403 }).status, 'warn-forbidden');
    assert.equal(classifyResponse({ requestedUrl: 'https://example.org/x', httpStatus: 429 }).status, 'warn-rate-limited');
    assert.equal(classifyResponse({ requestedUrl: 'https://example.org/x', httpStatus: 503 }).status, 'warn-server-error');
});

test('genuine not-found statuses are broken', () => {
    assert.equal(classifyResponse({ requestedUrl: 'https://example.org/x', httpStatus: 404 }).status, 'broken');
    assert.equal(classifyResponse({ requestedUrl: 'https://example.org/x', httpStatus: 410 }).status, 'broken');
    assert.equal(classifyResponse({ requestedUrl: 'https://example.org/x', httpStatus: 400 }).status, 'broken');
});

test('a redirect into a bot challenge host is a warning', () => {
    const result = classifyResponse({
        requestedUrl: 'https://example.org/apply',
        finalUrl: 'https://validate.perfdrive.com/whatever',
        httpStatus: 200,
    });
    assert.equal(result.status, 'warn-bot-challenge');
});

test('mailto and tel links are validated by shape, never fetched', () => {
    assert.equal(classifyNonHttpUrl(new URL('mailto:help@ebhcs.org')).status, 'ok');
    assert.equal(classifyNonHttpUrl(new URL('mailto:not-an-email')).status, 'broken');
    assert.equal(classifyNonHttpUrl(new URL('tel:+1-617-555-0100')).status, 'ok');
    assert.equal(classifyNonHttpUrl(new URL('tel:xx')).status, 'broken');
});

test('unsupported protocols are broken and http(s) falls through to a fetch', () => {
    assert.equal(classifyNonHttpUrl(new URL('ftp://example.org/file')).status, 'broken');
    assert.equal(classifyNonHttpUrl(new URL('https://example.org/')), null);
    assert.equal(classifyNonHttpUrl(new URL('http://example.org/')), null);
});

test('host normalization strips www and lowercases', () => {
    assert.equal(normalizeHost('WWW.Example.ORG'), 'example.org');
    assert.equal(normalizeHost(''), '');
});

// The request layer: HEAD is cheap but unreliable, so a HEAD failure must never
// be trusted on its own. These run against a throwaway local server rather than
// the network, so they stay deterministic.
import { createServer } from 'node:http';
import { checkOne } from '../../scripts/check-resource-links.mjs';

function serve(handler) {
    const server = createServer(handler);
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ base: `http://127.0.0.1:${port}`, close: () => server.close() });
        });
    });
}

test('a HEAD-only 404 is rechecked with GET instead of being called broken', async () => {
    const seen = [];
    const s = await serve((req, res) => {
        seen.push(req.method);
        if (req.method === 'HEAD') { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>real page</html>');
    });
    try {
        const result = await checkOne(`${s.base}/apply/intake`);
        assert.equal(result.status, 'ok');
        assert.deepEqual(seen, ['HEAD', 'GET']);
    } finally { s.close(); }
});

test('a genuine 404 on both HEAD and GET stays broken', async () => {
    const s = await serve((req, res) => { res.writeHead(404); res.end(); });
    try {
        const result = await checkOne(`${s.base}/gone`);
        assert.equal(result.status, 'broken');
        assert.equal(result.httpStatus, 404);
    } finally { s.close(); }
});

test('a dropped HEAD connection is retried with GET before giving up', async () => {
    let first = true;
    const s = await serve((req, res) => {
        if (first) { first = false; req.destroy(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('ok');
    });
    try {
        const result = await checkOne(`${s.base}/flaky`);
        assert.equal(result.status, 'ok');
    } finally { s.close(); }
});

test('a deep link redirected to the site root is caught end to end', async () => {
    const s = await serve((req, res) => {
        if (req.url !== '/') { res.writeHead(302, { Location: '/' }); res.end(); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('homepage');
    });
    try {
        const result = await checkOne(`${s.base}/apply/esol-intake`);
        assert.equal(result.status, 'warn-path-collapsed');
        assert.equal(result.advisorAction, undefined, 'advisorAction is attached later by decorateResult');
    } finally { s.close(); }
});

test('an unreachable host is a warning, not a break', async () => {
    const s = await serve(() => {});
    const base = s.base;
    s.close();
    const result = await checkOne(`${base}/anything`);
    assert.equal(result.status, 'warn-unreachable');
});

test('an incomplete certificate chain is reported as a TLS issue, not an outage', () => {
    const error = new TypeError('fetch failed');
    error.cause = { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' };
    const result = classifyRequestError(error);
    assert.equal(result.status, 'warn-tls');
    assert.match(result.reason, /UNABLE_TO_VERIFY_LEAF_SIGNATURE/);
    assert.match(result.reason, /work for students/);
});

test('an expired certificate is also surfaced as a TLS issue', () => {
    const error = new TypeError('fetch failed');
    error.cause = { code: 'CERT_HAS_EXPIRED' };
    assert.equal(classifyRequestError(error).status, 'warn-tls');
});

test('a timeout and a dead host keep their own reasons', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    assert.equal(classifyRequestError(abort).status, 'warn-unreachable');
    assert.match(classifyRequestError(abort).reason, /^timeout/);

    const dns = new TypeError('fetch failed');
    dns.cause = { code: 'ENOTFOUND' };
    const result = classifyRequestError(dns);
    assert.equal(result.status, 'warn-unreachable');
    assert.match(result.reason, /ENOTFOUND/, 'the cause code beats a bare "fetch failed"');
});
