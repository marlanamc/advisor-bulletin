export function normalizeRichTextMarkers(text) {
    if (!text) {
        return '';
    }

    return String(text)
        .replace(/\*\*\s*([\s\S]+?)\s*\*\*/g, (_, inner) => `**${inner.trim()}**`)
        .replace(/\+\+\s*([\s\S]+?)\s*\+\+/g, (_, inner) => `++${inner.trim()}++`)
        .replace(/\*{3,}/g, '**')
        .replace(/\*\*([^*]+)\*\*(?=[A-Za-z0-9])/g, '**$1** ');
}

export function stripDanglingRichTextMarkers(text) {
    let result = normalizeRichTextMarkers(text);

    const boldMarkers = (result.match(/\*\*/g) || []).length;
    if (boldMarkers % 2 === 1) {
        result = result.replace(/\*\*([\s\S]*)$/, '$1');
    }

    const underlineMarkers = (result.match(/\+\+/g) || []).length;
    if (underlineMarkers % 2 === 1) {
        result = result.replace(/\+\+([\s\S]*)$/, '$1');
    }

    let singleStars = 0;
    for (let i = 0; i < result.length; i += 1) {
        if (result[i] === '*' && result[i - 1] !== '*' && result[i + 1] !== '*') {
            singleStars += 1;
        }
    }
    if (singleStars % 2 === 1) {
        result = result.replace(/(?<!\*)\*(?!\*)([\s\S]*)$/, '$1');
    }

    return result.replace(/\s+$/g, '');
}

export function getRichTextPlainLength(text) {
    return normalizeRichTextMarkers(text)
        .replace(/\*\*/g, '')
        .replace(/\+\+/g, '')
        .replace(/(?<!\*)\*(?!\*)/g, '')
        .length;
}

export function truncateRichText(rawText, maxPlainLength) {
    const text = normalizeRichTextMarkers(String(rawText || ''));
    if (getRichTextPlainLength(text) <= maxPlainLength) {
        return text;
    }

    for (let end = text.length; end > 0; end -= 1) {
        const candidate = stripDanglingRichTextMarkers(text.slice(0, end));
        if (getRichTextPlainLength(candidate) <= maxPlainLength) {
            return candidate;
        }
    }

    return '';
}

export function applyInlineFormatting(html) {
    return (html || '')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
}

export function formatRichTextInline(rawText) {
    if (!rawText) {
        return '';
    }

    const normalized = normalizeRichTextMarkers(rawText);
    const div = document.createElement('div');
    div.textContent = normalized;
    return applyInlineFormatting(div.innerHTML).replace(/\n/g, '<br>');
}

export function formatRichTextPreview(rawText, maxPlainLength = 110) {
    if (!rawText) {
        return '';
    }

    const needsEllipsis = getRichTextPlainLength(rawText) > maxPlainLength;
    const truncated = truncateRichText(rawText, needsEllipsis ? maxPlainLength - 1 : maxPlainLength);
    return formatRichTextInline(truncated) + (needsEllipsis ? '…' : '');
}
