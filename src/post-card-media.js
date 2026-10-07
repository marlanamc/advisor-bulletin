// Top section of a student feed card (.pc), shared by the live board
// (firebase-config.js) and the instant-paint snapshot (student-snapshot.js)
// so both renderers produce identical markup.
//
// Posts with an image show the whole flyer (object-fit: contain) with the
// title below it. Posts without one get a typographic announcement panel:
// category icon + label, then the post title as the card's headline. Image
// cards also carry the panel, hidden, so feed-card-events.js can swap to it
// if the image fails to load.

const ICON_PATHS = {
    job: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>',
    immigration: '<circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    housing: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    health: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    food: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>',
    esol: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    training: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    college: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    'career-fair': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    childcare: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    announcement: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'no-classes': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="10" y1="14" x2="14" y2="18"/><line x1="14" y1="14" x2="10" y2="18"/>',
};

// Neutral "pinned note" for categories without their own icon.
const FALLBACK_ICON_PATH = '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>';

// Neutral slate palette for unknown categories (matches getCatMeta()'s fallback).
export const POST_CARD_FALLBACK_COLORS = { accent: '#566274', tint: '#e8ecf2' };

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function getPostCardIconSvg(category) {
    const paths = ICON_PATHS[category] || FALLBACK_ICON_PATH;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// Long titles step down a size so a whole row of panels stays balanced;
// they still wrap freely and the panel grows rather than clipping.
function getTitleSizeClass(title) {
    const length = title.length;
    if (length > 90) return 'pc__panel-title--xlong';
    if (length > 55) return 'pc__panel-title--long';
    return '';
}

/**
 * @param {object} options
 * @param {string} options.category   raw category key (picks the icon)
 * @param {string} options.label      English category label
 * @param {string} options.labelEs    Spanish category label
 * @param {string} options.title      post title in the current language
 * @param {string} [options.image]    image URL for the current language
 * @param {boolean} [options.isExpired]
 * @param {string} [options.imageAttributes] loading hints for the <img>
 * @returns {{ hasImage: boolean, mediaHtml: string, bodyHeadHtml: string }}
 */
export function renderPostCardMedia({ category, label, labelEs, title, image, isExpired = false, imageAttributes = '' }) {
    const hasImage = Boolean(image);
    const safeLabel = escapeHtml(String(label || 'Post').toUpperCase());
    const safeLabelEs = escapeHtml(String(labelEs || label || 'Publicación').toUpperCase());
    const expiredChip = isExpired
        ? '<span class="pc__chip pc__chip--expired"><span class="en-text">Expired</span><span class="es-text">Vencido</span></span>'
        : '';
    const eyebrow = (modifier = '') => `
        <div class="pc__eyebrow${modifier}">
          <span class="pc__eyebrow-icon">${getPostCardIconSvg(category)}</span>
          <span class="pc__eyebrow-label"><span class="en-text">${safeLabel}</span><span class="es-text">${safeLabelEs}</span></span>
          ${expiredChip}
        </div>`;
    const titleClass = ['pc__panel-title', getTitleSizeClass(title)].filter(Boolean).join(' ');

    const panelHtml = `
      <div class="pc__panel">
        ${eyebrow()}
        <h3 class="${titleClass}">${escapeHtml(title)}</h3>
      </div>`;

    const mediaHtml = `
      <div class="pc__media">
        ${hasImage ? `<div class="pc__image-stage"><img class="pc__poster-image" src="${escapeHtml(image)}" alt="" ${imageAttributes}></div>` : ''}
        ${panelHtml}
      </div>`;

    // Image cards keep the title (and a compact category line) below the
    // image. Panel cards show the title only once, inside the panel.
    const bodyHeadHtml = hasImage
        ? `<div class="pc__body-head">${eyebrow(' pc__eyebrow--compact')}<h3 class="pc__title">${escapeHtml(title)}</h3></div>`
        : '';

    return { hasImage, mediaHtml, bodyHeadHtml };
}

// Called when a card's image fails to load: fall back to the panel.
export function showPostCardPanelFallback(card) {
    if (!card || !card.classList.contains('pc--image')) return;
    card.classList.remove('pc--image');
    card.classList.add('pc--panel', 'pc--image-failed');
}
