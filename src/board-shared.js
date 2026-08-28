// Shared module-level helpers and content config for the student board,
// used by firebase-config.js and the src/board-*.js method modules.

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab/Shift+Tab cycling inside an open dialog instead of escaping to the page behind it.
export function trapTabFocus(container, event) {
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

// Moves focus into a just-opened dialog and returns the element that was
// focused beforehand, so it can be restored once the dialog closes.
export function focusDialogOpen(container) {
    const lastFocused = document.activeElement;
    const target = container.querySelector(FOCUSABLE_SELECTOR) || container;
    if (target && typeof target.focus === 'function') {
        target.focus();
    }
    return lastFocused;
}

export function focusDialogClose(lastFocused) {
    if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
        lastFocused.focus();
    }
}

export function recordStudentPerf(name, detail) {
    try {
        performance.mark(name, detail ? { detail } : undefined);
    } catch {}
    window.__ebhcsPerf = window.__ebhcsPerf || [];
    window.__ebhcsPerf.push({ name, at: Math.round(performance.now()), detail });
}

export function prefersInstantScroll() {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

export function getScrollBehavior(override) {
    if (override) {
        return override;
    }
    return prefersInstantScroll() ? 'auto' : 'smooth';
}

export function scrollWindowTo(top, behavior) {
    window.scrollTo({
        top: Math.max(0, top),
        behavior: getScrollBehavior(behavior)
    });
}

/** Pixels the fixed/sticky topbar occupies, for scroll-to-card math. */
export function getAppHeaderOffset() {
    const fromCss = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset')
    ) || 0;
    const topbar = document.querySelector('.app-topbar') || document.querySelector('header');
    const fromBox = topbar ? topbar.getBoundingClientRect().height : 0;
    return Math.max(fromCss, fromBox, 0);
}

/** Optional synthetic items merged into student calendar / upcoming — not stored in Firestore. */
export const SCHOOL_CALENDAR_ANCHORS = [];

export function withSchoolCalendarAnchors(bulletins) {
    return [...SCHOOL_CALENDAR_ANCHORS, ...(bulletins || [])];
}

export const RESOURCE_CATEGORY_CONFIG = {
    immigration: {
        labelEn: 'Immigration',
        labelEs: 'Inmigración',
        icon: 'globe',
        color: '#6d4aa8',
        tint: '#ece6f8'
    },
    jobs: {
        labelEn: 'Job Help',
        labelEs: 'Ayuda con empleo',
        icon: 'briefcase',
        color: '#1f3d7a',
        tint: '#e3eaf7'
    },
    housing: {
        labelEn: 'Housing',
        labelEs: 'Vivienda',
        icon: 'home',
        color: '#c2542e',
        tint: '#f8ded3'
    },
    health: {
        labelEn: 'Health',
        labelEs: 'Salud',
        icon: 'heart',
        color: '#d63f6f',
        tint: '#fbdde7'
    },
    food: {
        labelEn: 'Food',
        labelEs: 'Comida',
        icon: 'food',
        color: '#b9741c',
        tint: '#f8e8cf'
    },
    family: {
        labelEn: 'Child Care',
        labelEs: 'Cuidado de niños',
        icon: 'family',
        color: '#a8386c',
        tint: '#f6dced'
    },
    'family-community': {
        labelEn: 'Family & Community',
        labelEs: 'Familia y comunidad',
        icon: 'community',
        color: '#7d2f66',
        tint: '#f0dcee'
    },
    esol: {
        labelEn: 'English class',
        labelEs: 'Inglés',
        icon: 'abc',
        color: '#8050d1',
        tint: '#ece6f8'
    },
    hse: {
        labelEn: 'GED / HSE',
        labelEs: 'Equivalencia escolar',
        icon: 'abc',
        color: '#2f5fb3',
        tint: '#e6edfa'
    },
    college: {
        labelEn: 'College & Careers',
        labelEs: 'Universidad y carreras',
        icon: 'graduation',
        color: '#14315f',
        tint: '#e1e6f0'
    },
    'legal-aid': {
        labelEn: 'Legal Help',
        labelEs: 'Ayuda legal',
        icon: 'scale',
        color: '#55379e',
        tint: '#e8e2f7'
    },
    money: {
        labelEn: 'Financial Help',
        labelEs: 'Ayuda financiera',
        icon: 'money',
        color: '#1aa37a',
        tint: '#d7f0e6'
    },
    general: {
        labelEn: 'General Help',
        labelEs: 'Ayuda general',
        icon: 'handshake',
        color: '#566274',
        tint: '#e8ecf2'
    },
    consulates: {
        labelEn: 'Consulates',
        labelEs: 'Consulados',
        icon: 'flag',
        color: '#0f6f7a',
        tint: '#dbeff2'
    },
    announcement: {
        labelEn: 'Announcements',
        labelEs: 'Anuncios',
        icon: 'megaphone',
        color: '#317dea',
        tint: '#dbeafe'
    }
};

export const STORY_BUBBLE_PREVIEW_CATEGORIES = ['immigration', 'jobs', 'housing', 'health', 'food'];
// RESOURCE_TILE_CATEGORIES is imported from src/resource-categories.js — single
// source of truth, mirrored by firestore.rules and verified by
// scripts/check-resource-categories-sync.mjs.

export const FEED_CATEGORY_CONTENT = {
    all: {
        icon: '✨',
        title: 'Main Feed',
        titleEs: 'Página principal',
        description: 'New help, classes, jobs, and community support from your advisors.',
        chips: ['New', 'Free help', 'This week']
    },
    housing: {
        icon: '🏠',
        title: 'Housing Help',
        titleEs: 'Ayuda con vivienda',
        description: 'Find apartments, shelters, rent help, and housing support.',
        chips: ['Emergency Housing', 'Apartments', 'Rent Help', 'Tenant Rights']
    },
    job: {
        icon: '💼',
        title: 'Job Help',
        titleEs: 'Ayuda con empleo',
        description: 'See advisor posts about job openings, hiring notices, resumes, and career support.',
        chips: ['Hiring Now', 'Resume Help', 'Career Support']
    },
    jobs: {
        icon: '💼',
        title: 'Job Help',
        titleEs: 'Ayuda con empleo',
        description: 'See advisor posts about job openings, hiring notices, resumes, and career support.',
        chips: ['Hiring Now', 'Resume Help', 'Career Support']
    },
    immigration: {
        icon: '🌎',
        title: 'Immigration Help',
        titleEs: 'Ayuda de inmigración',
        description: 'Find legal help, citizenship support, and trusted local organizations.',
        chips: ['Citizenship', 'Legal Help', 'Know Your Rights', 'Green Card']
    },
    health: {
        icon: '❤️',
        title: 'Health Support',
        titleEs: 'Apoyo de salud',
        description: 'Find clinics, health information, mental health support, and care nearby.',
        chips: ['Clinics', 'Mental Health', 'Insurance', 'Urgent Help']
    },
    food: {
        icon: '🥕',
        title: 'Food Help',
        titleEs: 'Ayuda con comida',
        description: 'Find food pantries, meal programs, and grocery help for families.',
        chips: ['Food Pantry', 'Meals', 'Delivery', 'Family Help']
    },
    esol: {
        icon: '📘',
        title: 'English class',
        titleEs: 'Inglés',
        description: 'Find English classes, conversation groups, and ESOL support.',
        chips: ['English Class', 'Conversation', 'ESOL']
    },
    college: {
        icon: '🎓',
        title: 'College Pathways',
        titleEs: 'Caminos universitarios',
        description: 'Find college, GED, certificates, and next-step education support.',
        chips: ['GED', 'Certificates', 'Financial Aid', 'College Help']
    },
    money: {
        icon: '💵',
        title: 'Money Help',
        titleEs: 'Ayuda con dinero',
        description: 'Find financial coaching, benefits, tax help, and low-cost support.',
        chips: ['Benefits', 'Tax Help', 'Budgeting', 'Free Support']
    },
    childcare: {
        icon: '👨‍👩‍👧',
        title: 'Family Support',
        titleEs: 'Apoyo familiar',
        description: 'Find child care, family programs, youth support, and parent help.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    family: {
        icon: '👨‍👩‍👧',
        title: 'Family Support',
        titleEs: 'Apoyo familiar',
        description: 'Find child care, family programs, youth support, and parent help.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    training: {
        icon: '🧰',
        title: 'Training Posts',
        titleEs: 'Publicaciones de capacitación',
        description: 'See advisor posts about workshops, skills training, certificates, and programs.',
        chips: ['Workshops', 'Certificates', 'Career Skills', 'Programs']
    },
    'career-fair': {
        icon: '📍',
        title: 'Career Fairs',
        titleEs: 'Ferias de empleo',
        description: 'Find hiring events, job fairs, and places to meet employers.',
        chips: ['Hiring Events', 'Employers', 'Resume', 'Interviews']
    },
    announcement: {
        icon: '📢',
        title: 'Announcements',
        titleEs: 'Anuncios',
        description: 'School news, reminders, and general updates from your advisors.',
        chips: ['School News', 'Reminders', 'Updates', 'Events']
    }
};

export const RESOURCE_ICON_SVGS = {
    shield: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M32 5 13 13v16c0 13.5 8 24.8 19 30 11-5.2 19-16.5 19-30V13L32 5Z"/>
            <path fill="#ffc857" d="m25 32 5 5 10-12 5 4-14 17-11-10 5-4Z"/>
        </svg>
    `,
    briefcase: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="2.5" y="7" width="19" height="13" rx="2.4"/>
            <path d="M9 6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V8h-2.2V6.6h-1.6V8H9Z"/>
            <rect x="9.6" y="11.6" width="4.8" height="2.6" rx="1" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    home: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2.6 22 11l-1.6 1.9-1.4-1.2V21H5V11.7l-1.4 1.2L2 11Z"/>
            <rect x="9.9" y="14" width="4.2" height="7" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    heart: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 21.5C4.2 15.6 1.8 9.6 1.8 6.6 1.8 3.6 4.2 1.6 7 1.6c2.1 0 3.8 1.2 4.6 2.9.1.3.3.7.4 1 .1-.3.3-.7.4-1 .8-1.7 2.5-2.9 4.6-2.9 2.8 0 5.2 2 5.2 5 0 3-2.4 9-10.2 14.9Z"/>
            <rect x="10.3" y="8.4" width="3.4" height="8.8" rx="1.2" fill="var(--icon-cut, #fff)"/>
            <rect x="7.6" y="11.1" width="8.8" height="3.4" rx="1.2" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    food: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4.6 7.5h14.8l-1.3 13.9H5.9Z"/>
            <path d="M8.4 8.6V6.4a3.6 3.6 0 0 1 7.2 0v2.2h-2.2V6.4a1.4 1.4 0 0 0-2.8 0v2.2Z"/>
            <circle cx="12" cy="14.4" r="2.6" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    family: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="6.2" r="3.4"/>
            <path d="M2.8 21c0-4.2 2.3-7.4 5.2-7.4S13.2 16.8 13.2 21Z"/>
            <circle cx="17.4" cy="11.6" r="2.4"/>
            <path d="M13.6 21c0-3 1.7-5.2 3.8-5.2S21.2 18 21.2 21Z"/>
        </svg>
    `,
    abc: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M12 14h37c5.5 0 9 3.5 9 9v16c0 5.5-3.5 9-9 9H31L18 59V48h-6c-5.5 0-9-3.5-9-9V23c0-5.5 3.5-9 9-9Z"/>
            <text x="13" y="38" fill="#8050d1" font-family="Arial, sans-serif" font-size="18" font-weight="900">ABC</text>
            <circle cx="52" cy="52" r="7.5" fill="#c9b5ff"/>
        </svg>
    `,
    community: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="6" r="3.2"/>
            <circle cx="4.6" cy="9.4" r="2.6"/>
            <circle cx="19.4" cy="9.4" r="2.6"/>
            <path d="M6.2 21c0-3.7 2.6-6.4 5.8-6.4S17.8 17.3 17.8 21Z"/>
            <path d="M.6 21c0-3 1.7-5 4-5 .7 0 1.3.2 1.9.5-1 1.2-1.6 2.7-1.7 4.5Z"/>
            <path d="M23.4 21c0-3-1.7-5-4-5-.7 0-1.3.2-1.9.5 1 1.2 1.6 2.7 1.7 4.5Z"/>
        </svg>
    `,
    graduation: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3.4 23 9l-11 5.6L1 9Z"/>
            <path d="M5.6 12.4 12 15.7l6.4-3.3v4.1c0 1.9-2.9 3.4-6.4 3.4s-6.4-1.5-6.4-3.4Z"/>
            <rect x="21.2" y="9.8" width="1.8" height="6.4" rx=".9"/>
        </svg>
    `,
    handshake: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M9.4 9.2a2.7 2.7 0 1 1 3.6 2.5c-.7.3-1 .9-1 1.6v.3"/>
            <circle cx="12" cy="17.4" r="1.2" fill="currentColor" stroke="none"/>
        </svg>
    `,
    money: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="1.6" y="5.4" width="20.8" height="13.2" rx="2.4"/>
            <circle cx="12" cy="12" r="4" fill="var(--icon-cut, #fff)"/>
            <text x="12" y="15" text-anchor="middle" font-size="8" font-weight="900"
                  fill="currentColor" font-family="Outfit, sans-serif">$</text>
        </svg>
    `,
    megaphone: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M9 28 44 13v38L9 36v-8Z"/>
            <rect x="40" y="26" width="16" height="14" rx="4" fill="#fff"/>
            <circle cx="58" cy="33" r="5" fill="#ffc857"/>
        </svg>
    `,
    scale: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="10.9" y="3" width="2.2" height="17" rx="1.1"/>
            <rect x="4" y="5.6" width="16" height="2.2" rx="1.1"/>
            <path d="M6.4 7.4 2.4 15.4h8Z"/>
            <path d="M17.6 7.4l-4 8h8Z"/>
            <rect x="6.6" y="19.4" width="10.8" height="2.2" rx="1.1"/>
        </svg>
    `,
    globe: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="4.5" y="2.5" width="15" height="19" rx="2.4"/>
            <circle cx="12" cy="10" r="3.6" fill="var(--icon-cut, #fff)"/>
            <rect x="8" y="16.4" width="8" height="1.9" rx=".95" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    flag: `
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="3.4" y="2.2" width="2.3" height="19.6" rx="1.15"/>
            <path d="M7.4 3.6h11.9a.9.9 0 0 1 .73 1.43L17.4 8.4l2.63 3.37a.9.9 0 0 1-.73 1.43H7.4Z"/>
            <rect x="9.6" y="6.4" width="6.4" height="1.6" rx=".8" fill="var(--icon-cut, #fff)"/>
            <rect x="9.6" y="9.4" width="4.4" height="1.6" rx=".8" fill="var(--icon-cut, #fff)"/>
        </svg>
    `,
    'all-topics': `
        <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <rect x="3" y="3" width="7.5" height="7.5" rx="2"/>
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/>
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>
        </svg>
    `
};
