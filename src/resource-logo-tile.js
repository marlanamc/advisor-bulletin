/**
 * Pick a logo tile shape from the uploaded image aspect ratio so wide marks
 * and circular seals both display large enough without clipping.
 */

const TILE_CLASS_WIDE = 'mobile-resource-card__logo-tile--wide';
const TILE_CLASS_SQUARE = 'mobile-resource-card__logo-tile--square';
const TILE_CLASS_BALANCED = 'mobile-resource-card__logo-tile--balanced';

const WIDE_RATIO_MIN = 1.45;
const SQUARE_RATIO_MAX = 1.08;
const LOGO_TITLE_GAP_PX = 14;
const MIN_LOGO_CLEARANCE_PX = 64;

function syncCardLogoClearance(tile) {
    const card = tile?.closest?.('.mobile-resource-card');
    if (!card) return;

    const measure = () => {
        const bottom = tile.offsetTop + tile.offsetHeight;
        const clearance = Math.max(MIN_LOGO_CLEARANCE_PX, Math.ceil(bottom + LOGO_TITLE_GAP_PX));
        card.style.setProperty('--resource-logo-clearance', `${clearance}px`);
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(measure);
    } else {
        measure();
    }
}

export function applyResourceLogoTileLayout(img) {
    const tile = img?.closest?.('.mobile-resource-card__logo-tile');
    if (!tile) return;

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return;

    const ratio = width / height;
    tile.classList.remove(TILE_CLASS_WIDE, TILE_CLASS_SQUARE, TILE_CLASS_BALANCED);

    if (ratio >= WIDE_RATIO_MIN) {
        tile.classList.add(TILE_CLASS_WIDE);
    } else if (ratio <= SQUARE_RATIO_MAX) {
        tile.classList.add(TILE_CLASS_SQUARE);
    } else {
        tile.classList.add(TILE_CLASS_BALANCED);
    }

    syncCardLogoClearance(tile);
}

/** @param {ParentNode} [root] */
export function initResourceLogoTiles(root = document) {
    const scope = root instanceof Element || root instanceof DocumentFragment ? root : document;
    scope.querySelectorAll('.mobile-resource-card__logo-tile').forEach((tile) => {
        const img = tile.querySelector('img');
        if (img) {
            if (img.complete && img.naturalWidth) {
                applyResourceLogoTileLayout(img);
            } else {
                img.addEventListener('load', () => applyResourceLogoTileLayout(img), { once: true });
            }
            return;
        }
        syncCardLogoClearance(tile);
    });
}

if (typeof globalThis !== 'undefined') {
    globalThis.applyResourceLogoTileLayout = applyResourceLogoTileLayout;
}
