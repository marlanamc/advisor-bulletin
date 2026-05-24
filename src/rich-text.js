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

function escapeHtmlText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatInlineSegment(rawText) {
    return applyInlineFormatting(escapeHtmlText(normalizeRichTextMarkers(rawText)));
}

export function normalizeInlineBullets(text) {
    if (!text) {
        return '';
    }

    return String(text)
        .split('\n')
        .map((line) => {
            if (/^\s*-\s+/.test(line)) {
                return line;
            }

            const parts = line.split(/\s-\s+/);
            if (parts.length < 2) {
                return line;
            }

            let intro = parts[0].trim();
            let items = parts.slice(1).map((item) => item.trim()).filter(Boolean);

            if (intro.startsWith('-')) {
                const firstItem = intro.replace(/^-\s*/, '').trim();
                if (firstItem) {
                    items.unshift(firstItem);
                }
                intro = '';
            }

            const rows = [];
            if (intro) {
                rows.push(intro);
            }
            items.forEach((item) => rows.push(`- ${item}`));
            return rows.join('\n');
        })
        .join('\n');
}

export function formatRichTextInline(rawText, options = {}) {
    if (!rawText) {
        return '';
    }

    const wrapParagraphs = options.wrapParagraphs === true;
    const normalized = normalizeRichTextMarkers(normalizeInlineBullets(String(rawText)));
    const lines = normalized.split('\n');
    const parts = [];
    let bulletLines = [];
    let textBuffer = [];

    const flushBullets = () => {
        if (!bulletLines.length) {
            return;
        }

        parts.push(
            `<ul>${bulletLines.map((line) => `<li>${formatInlineSegment(line)}</li>`).join('')}</ul>`
        );
        bulletLines = [];
    };

    const flushText = () => {
        if (!textBuffer.length) {
            return;
        }

        const inner = textBuffer.map((line) => formatInlineSegment(line)).join('<br>');
        parts.push(wrapParagraphs ? `<p>${inner}</p>` : inner);
        textBuffer = [];
    };

    lines.forEach((line) => {
        const bulletMatch = line.match(/^-\s+(.*)$/);
        if (bulletMatch) {
            flushText();
            bulletLines.push(bulletMatch[1]);
            return;
        }

        flushBullets();

        if (line.trim() === '') {
            flushText();
            return;
        }

        textBuffer.push(line);
    });

    flushText();
    flushBullets();
    return parts.join('');
}

export function toRichTextPlainText(rawText) {
    if (!rawText) {
        return '';
    }

    return normalizeRichTextMarkers(String(rawText))
        .replace(/\*\*/g, '')
        .replace(/\+\+/g, '')
        .replace(/(?<!\*)\*(?!\*)/g, '')
        .split('\n')
        .map((line) => line.replace(/^\s*-\s+/, '').trim())
        .filter(Boolean)
        .join(' • ');
}

export function formatRichTextPlainPreview(rawText, maxPlainLength = 140) {
    const plain = toRichTextPlainText(rawText);
    if (!plain) {
        return '';
    }
    if (plain.length <= maxPlainLength) {
        return plain;
    }
    const slice = plain.slice(0, maxPlainLength);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > maxPlainLength * 0.6 ? slice.slice(0, lastSpace) : slice;
    return `${cut.replace(/[\s,.;:•-]+$/, '')}…`;
}

export function formatRichTextPreview(rawText, maxPlainLength = 110) {
    if (!rawText) {
        return '';
    }

    const needsEllipsis = getRichTextPlainLength(rawText) > maxPlainLength;
    const truncated = truncateRichText(rawText, needsEllipsis ? maxPlainLength - 1 : maxPlainLength);
    return formatRichTextInline(truncated) + (needsEllipsis ? '…' : '');
}
