/**
 * Canonical post categories for advisor bulletins (not resource listings).
 * Stored in Firestore as bulletin.category. Student filters use the same ids.
 */
export const POST_CATEGORIES = [
    {
        id: 'job',
        adminLabel: 'Job Opportunity',
        displayLabel: 'Job Opportunity',
        filterLabelEn: 'Job Help',
        filterLabelEs: 'Ayuda con empleo',
        emoji: '💼',
        pickerShort: 'Job',
    },
    {
        id: 'training',
        adminLabel: 'Training / Workshop',
        displayLabel: 'Training / Workshop',
        filterLabelEn: 'Training',
        filterLabelEs: 'Capacitación',
        emoji: '📚',
        pickerShort: 'Training',
    },
    {
        id: 'immigration',
        adminLabel: 'Immigration',
        displayLabel: 'Immigration',
        filterLabelEn: 'Immigration',
        filterLabelEs: 'Inmigración',
        emoji: '🌎',
        pickerShort: 'Immigration',
    },
    {
        id: 'housing',
        adminLabel: 'Housing',
        displayLabel: 'Housing',
        filterLabelEn: 'Housing',
        filterLabelEs: 'Vivienda',
        emoji: '🏠',
        pickerShort: 'Housing',
    },
    {
        id: 'health',
        adminLabel: 'Health',
        displayLabel: 'Health',
        filterLabelEn: 'Health',
        filterLabelEs: 'Salud',
        emoji: '❤️',
        pickerShort: 'Health',
    },
    {
        id: 'food',
        adminLabel: 'Food',
        displayLabel: 'Food',
        filterLabelEn: 'Food',
        filterLabelEs: 'Comida',
        emoji: '🍽️',
        pickerShort: 'Food',
    },
    {
        id: 'esol',
        adminLabel: 'English Class (ESOL)',
        displayLabel: 'English Class',
        filterLabelEn: 'English class',
        filterLabelEs: 'Inglés',
        emoji: '🗣️',
        pickerShort: 'ESOL',
    },
    {
        id: 'college',
        adminLabel: 'College & GED',
        displayLabel: 'College & GED',
        filterLabelEn: 'College & GED',
        filterLabelEs: 'Colegio',
        emoji: '🎓',
        pickerShort: 'College',
    },
    {
        id: 'money',
        adminLabel: 'Money Help',
        displayLabel: 'Money Help',
        filterLabelEn: 'Money help',
        filterLabelEs: 'Dinero',
        emoji: '💵',
        pickerShort: 'Money',
    },
    {
        id: 'career-fair',
        adminLabel: 'Career Fair',
        displayLabel: 'Career Fair',
        filterLabelEn: 'Career fair',
        filterLabelEs: 'Feria de empleo',
        emoji: '🤝',
        pickerShort: 'Fair',
    },
    {
        id: 'announcement',
        adminLabel: 'Announcement',
        displayLabel: 'Announcement',
        filterLabelEn: 'Announcements',
        filterLabelEs: 'Anuncios',
        emoji: '📣',
        pickerShort: 'News',
    },
];

/** Legacy / alternate values mapped to canonical ids when filtering or displaying. */
export const POST_CATEGORY_ALIASES = {
    jobs: 'job',
    'job opportunity': 'job',
    healthcare: 'health',
    'health care': 'health',
    english: 'esol',
    'english class': 'esol',
    esol: 'esol',
    famlit: 'esol',
    family: 'childcare',
    childcare: 'childcare',
    'legal-aid': 'legal-aid',
    'legal aid': 'legal-aid',
    resource: 'resource',
    hse: 'college',
};

const POST_CATEGORY_BY_ID = Object.fromEntries(POST_CATEGORIES.map((c) => [c.id, c]));

export function normalizePostCategory(category) {
    const raw = String(category || 'all').trim().toLowerCase();
    if (!raw || raw === 'all') {
        return 'all';
    }
    if (POST_CATEGORY_ALIASES[raw]) {
        return POST_CATEGORY_ALIASES[raw];
    }
    if (POST_CATEGORY_BY_ID[raw]) {
        return raw;
    }
    return raw;
}

export function getPostCategoryMeta(category) {
    const id = normalizePostCategory(category);
    return POST_CATEGORY_BY_ID[id] || null;
}

export function getPostCategoryDisplay(category) {
    const meta = getPostCategoryMeta(category);
    if (meta) {
        return meta.displayLabel;
    }
    if (normalizePostCategory(category) === 'resource') {
        return 'Resource / Service';
    }
    return category || '';
}

export function isPostCategoryId(category) {
    return Boolean(POST_CATEGORY_BY_ID[normalizePostCategory(category)]);
}
