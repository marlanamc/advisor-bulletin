export const RESOURCE_KIND_ORGANIZATION = 'organization';
export const RESOURCE_KIND_DOCUMENT = 'document';

export const RESOURCE_KINDS = [
    RESOURCE_KIND_ORGANIZATION,
    RESOURCE_KIND_DOCUMENT,
];

export function normalizeResourceKind(value) {
    const kind = String(value || '').trim().toLowerCase();
    return kind === RESOURCE_KIND_DOCUMENT ? RESOURCE_KIND_DOCUMENT : RESOURCE_KIND_ORGANIZATION;
}

export function isDocumentResource(resource) {
    return normalizeResourceKind(resource?.resourceKind) === RESOURCE_KIND_DOCUMENT;
}

export const DOCUMENT_TILE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';

export const OPEN_FORM_ICON_SVG = DOCUMENT_TILE_ICON_SVG;
