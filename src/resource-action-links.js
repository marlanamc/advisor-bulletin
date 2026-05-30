export const MAX_RESOURCE_ACTION_LINKS = 5;

export function normalizeActionLinkUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        // eslint-disable-next-line no-new
        new URL(withProtocol);
        return withProtocol;
    } catch {
        return '';
    }
}

export function getActionLinkType(link) {
    if (!link || typeof link !== 'object') return 'url';
    return String(link.pdfUrl || '').trim() ? 'pdf' : 'url';
}

export function normalizeResourceActionLinks(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [];
    const normalized = [];
    const seen = new Set();

    list.forEach((item) => {
        if (normalized.length >= MAX_RESOURCE_ACTION_LINKS) return;
        if (!item || typeof item !== 'object') return;

        const labelEn = String(item.labelEn || item.label || '').trim();
        const labelEs = String(item.labelEs || labelEn).trim();
        const url = normalizeActionLinkUrl(item.url);
        const pdfUrl = String(item.pdfUrl || '').trim();
        if (!labelEn || (!url && !pdfUrl)) return;

        const key = (pdfUrl || url).toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        normalized.push({
            labelEn,
            labelEs: labelEs || labelEn,
            url: pdfUrl ? '' : url,
            pdfUrl: pdfUrl || '',
        });
    });

    return normalized;
}

export function parseResourceActionLinkSlotsFromForm(formData, options = {}) {
    const removedPdfSlots = options.removedPdfSlots || new Set();
    const existingLinks = normalizeResourceActionLinks(options.existingLinks || []);
    const links = [];

    for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
        const labelEn = (formData.get(`resourceActionLink${slot}LabelEn`) || '').trim();
        const labelEs = (formData.get(`resourceActionLink${slot}LabelEs`) || '').trim();
        const type = (formData.get(`resourceActionLink${slot}Type`) || 'url').trim() === 'pdf' ? 'pdf' : 'url';
        const urlRaw = (formData.get(`resourceActionLink${slot}Url`) || '').trim();
        const existingPdfUrl = removedPdfSlots.has(slot)
            ? ''
            : String(formData.get(`resourceActionLink${slot}ExistingPdfUrl`) || '').trim();
        const pdfFile = formData.get(`resourceActionLink${slot}Pdf`);
        const hasNewPdf = Boolean(pdfFile?.size);

        if (!labelEn && !labelEs && !urlRaw && !existingPdfUrl && !hasNewPdf) {
            continue;
        }

        if (!labelEn) {
            throw new Error(`Action link ${slot} needs an English label.`);
        }

        if (type === 'url') {
            const url = normalizeActionLinkUrl(urlRaw);
            if (!url) {
                throw new Error(`Action link ${slot} needs a URL.`);
            }
            links.push({
                labelEn,
                labelEs: labelEs || labelEn,
                url,
                pdfUrl: '',
            });
            continue;
        }

        const preservedPdfUrl = hasNewPdf ? '' : (existingPdfUrl || existingLinks[links.length]?.pdfUrl || '');
        if (!hasNewPdf && !preservedPdfUrl) {
            throw new Error(`Action link ${slot} needs a PDF upload.`);
        }

        links.push({
            labelEn,
            labelEs: labelEs || labelEn,
            url: '',
            pdfUrl: preservedPdfUrl,
            _slot: slot,
            _pendingPdfUpload: hasNewPdf,
        });
    }

    return links;
}

/** @deprecated use parseResourceActionLinkSlotsFromForm */
export function parseResourceActionLinksFromForm(formData) {
    return parseResourceActionLinkSlotsFromForm(formData)
        .map(({ labelEn, labelEs, url, pdfUrl }) => ({ labelEn, labelEs, url, pdfUrl }));
}

/** CSV cell: `Label En|Label Es|URL` — separate multiple links with `;`. */
export function parseActionLinksCsvCell(value) {
    if (!value) return [];

    const entries = String(value)
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);

    const links = entries.map((entry) => {
        const parts = entry.split('|').map((part) => part.trim());
        if (parts.length >= 3) {
            return {
                labelEn: parts[0],
                labelEs: parts[1] || parts[0],
                url: parts[2],
            };
        }
        if (parts.length === 2) {
            return { labelEn: parts[0], labelEs: parts[0], url: parts[1] };
        }
        return null;
    }).filter(Boolean);

    return normalizeResourceActionLinks(links);
}

export function getResourceActionLinkFieldValues(actionLinks) {
    const normalized = normalizeResourceActionLinks(actionLinks);
    const values = {};

    for (let index = 1; index <= MAX_RESOURCE_ACTION_LINKS; index += 1) {
        const link = normalized[index - 1];
        values[`resourceActionLink${index}LabelEn`] = link?.labelEn || '';
        values[`resourceActionLink${index}LabelEs`] = link?.labelEs || '';
        values[`resourceActionLink${index}Url`] = link?.url || '';
        values[`resourceActionLink${index}ExistingPdfUrl`] = link?.pdfUrl || '';
        values[`resourceActionLink${index}Type`] = getActionLinkType(link);
    }

    return values;
}

export function stripActionLinkUploadMeta(links) {
    return normalizeResourceActionLinks(links);
}

export const RESOURCE_ACTION_LINK_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';

export const RESOURCE_ACTION_LINK_PDF_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';
