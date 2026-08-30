const WEB_PROTOCOLS = new Set(['http:', 'https:']);
const ACTION_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const PDF_PROTOCOLS = new Set(['http:', 'https:', 'data:']);

function hasExplicitScheme(value) {
    return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function hasUnsafeCharacters(value) {
    return /[\u0000-\u001f\u007f<>"'`]/.test(value);
}

function protocolAllowed(protocol, allowedProtocols) {
    return allowedProtocols.has(String(protocol || '').toLowerCase());
}

function isPdfDataUrl(value) {
    return /^data:application\/pdf(?:;[^,]*)?,/i.test(value);
}

export function normalizeSafeUrl(rawUrl, options = {}) {
    const {
        allowedProtocols = WEB_PROTOCOLS,
        defaultProtocol = 'https:',
        allowProtocolRelative = false,
        allowPdfDataUrl = false,
    } = options;

    const trimmed = String(rawUrl || '').trim();
    if (!trimmed || hasUnsafeCharacters(trimmed)) return '';

    if (allowPdfDataUrl && isPdfDataUrl(trimmed)) {
        return trimmed;
    }

    if (/^\/\//.test(trimmed)) {
        if (!allowProtocolRelative || !protocolAllowed(defaultProtocol, allowedProtocols)) return '';
        return `${defaultProtocol}${trimmed}`;
    }

    const candidate = hasExplicitScheme(trimmed) ? trimmed : `${defaultProtocol}//${trimmed}`;

    try {
        const parsed = new URL(candidate);
        if (!protocolAllowed(parsed.protocol, allowedProtocols)) return '';
        if (parsed.protocol === 'data:' && !(allowPdfDataUrl && isPdfDataUrl(trimmed))) return '';
        return parsed.href;
    } catch {
        return '';
    }
}

export function normalizeWebUrl(rawUrl) {
    return normalizeSafeUrl(rawUrl, {
        allowedProtocols: WEB_PROTOCOLS,
        defaultProtocol: 'https:',
    });
}

export function normalizeActionUrl(rawUrl) {
    return normalizeSafeUrl(rawUrl, {
        allowedProtocols: ACTION_PROTOCOLS,
        defaultProtocol: 'https:',
    });
}

export function normalizePdfUrl(rawUrl) {
    return normalizeSafeUrl(rawUrl, {
        allowedProtocols: PDF_PROTOCOLS,
        defaultProtocol: 'https:',
        allowPdfDataUrl: true,
    });
}
