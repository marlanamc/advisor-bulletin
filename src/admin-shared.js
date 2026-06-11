// Admin-side category display data and file-type helpers, shared by
// firebase-admin.js and the src/admin-*.js method modules.
import { AUTHORABLE_RESOURCE_CATEGORIES, AUTHORABLE_RESOURCE_CATEGORY_SET } from './resource-categories.js'

// Admin-specific display data (label, emoji, icon) keyed by the canonical
// resource categories from src/resource-categories.js. The dropdown order
// below is the order advisors see in the form. The key set is asserted at
// module load against AUTHORABLE_RESOURCE_CATEGORIES so a category added to
// the canonical list cannot silently be missing from the admin form.
export const ADMIN_RESOURCE_CATEGORY_DATA = {
    immigration: ['Immigration / Inmigración', '🌎', 'shield'],
    jobs:        ['Job Help / Ayuda con empleo', '💼', 'briefcase'],
    food:        ['Food / Comida', '🍽️', 'food'],
    family:      ['Child Care / Cuidado de niños', '👨‍👩‍👧', 'family'],
    health:      ['Health / Salud', '❤️', 'heart'],
    housing:     ['Housing / Vivienda', '🏠', 'home'],
    'legal-aid': ['Legal Help / Ayuda legal', '⚖️', 'scale'],
    money:       ['Financial Help / Ayuda financiera', '💵', 'money'],
    esol:        ['English Class / Inglés', '🗣️', 'abc'],
    hse:         ['GED / HSE / Equivalencia escolar', '📚', 'abc'],
    college:     ['College & Careers / Universidad y carreras', '🎓', 'graduation'],
};

// Sync assertion — fails fast at module load if the canonical list and the
// admin display data drift apart.
{
    const displayKeys = new Set(Object.keys(ADMIN_RESOURCE_CATEGORY_DATA));
    const missingFromAdmin = AUTHORABLE_RESOURCE_CATEGORIES.filter((k) => !displayKeys.has(k));
    const extraInAdmin = [...displayKeys].filter((k) => !AUTHORABLE_RESOURCE_CATEGORY_SET.has(k));
    if (missingFromAdmin.length || extraInAdmin.length) {
        throw new Error(
            `ADMIN_RESOURCE_CATEGORY_DATA out of sync with AUTHORABLE_RESOURCE_CATEGORIES — ` +
            `missing: [${missingFromAdmin.join(', ')}], extra: [${extraInAdmin.join(', ')}]`
        );
    }
}

// Preserves the existing [key, label, emoji, icon] tuple shape used by the
// rest of firebase-admin.js (dropdown rendering, preset lookups, etc.).
export const ADMIN_RESOURCE_CATEGORIES = Object.entries(ADMIN_RESOURCE_CATEGORY_DATA)
    .map(([key, [label, emoji, icon]]) => [key, label, emoji, icon]);

export const ADMIN_RESOURCE_CATEGORY_LABELS = Object.fromEntries(
    ADMIN_RESOURCE_CATEGORIES.map(([key, label]) => [key, label])
);

export const ADMIN_RESOURCE_CATEGORY_ICONS = Object.fromEntries(
    ADMIN_RESOURCE_CATEGORIES.map(([key, , , icon]) => [key, icon])
);

export const ADMIN_RESOURCE_ICON_LABELS = {
    auto: 'Auto',
    shield: 'Shield',
    briefcase: 'Briefcase',
    home: 'Home',
    heart: 'Health',
    scale: 'Legal Aid',
    globe: 'Globe'
};

export function isPdfFile(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

export function isFlyerImageFile(file) {
    if (!file) return false;
    if (isPdfFile(file)) return true;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.type && allowedTypes.includes(file.type)) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(file.name || '');
}

export function isImageOnlyFile(file) {
    if (!file) return false;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.type && allowedTypes.includes(file.type)) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(file.name || '');
}

