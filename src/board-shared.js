// Shared module-level helpers and content config for the student board,
// used by firebase-config.js and the src/board-*.js method modules.

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
        color: '#0d9488'
    },
    jobs: {
        labelEn: 'Job Help',
        labelEs: 'Ayuda con empleo',
        icon: 'briefcase',
        color: '#24498f'
    },
    housing: {
        labelEn: 'Housing',
        labelEs: 'Vivienda',
        icon: 'home',
        color: '#df6b4a'
    },
    health: {
        labelEn: 'Health',
        labelEs: 'Salud',
        icon: 'heart',
        color: '#df477f'
    },
    food: {
        labelEn: 'Food',
        labelEs: 'Comida',
        icon: 'food',
        color: '#2f934f'
    },
    family: {
        labelEn: 'Child Care',
        labelEs: 'Cuidado de niños',
        icon: 'family',
        color: '#c99035'
    },
    esol: {
        labelEn: 'English class',
        labelEs: 'Inglés',
        icon: 'abc',
        color: '#8050d1'
    },
    hse: {
        labelEn: 'GED / HSE',
        labelEs: 'Equivalencia escolar',
        icon: 'abc',
        color: '#2563eb'
    },
    college: {
        labelEn: 'College & Careers',
        labelEs: 'Universidad y carreras',
        icon: 'graduation',
        color: '#0a1d3a'
    },
    'legal-aid': {
        labelEn: 'Legal Help',
        labelEs: 'Ayuda legal',
        icon: 'scale',
        color: '#7c3aed'
    },
    money: {
        labelEn: 'Financial Help',
        labelEs: 'Ayuda financiera',
        icon: 'money',
        color: '#1fa77e'
    },
    announcement: {
        labelEn: 'Announcements',
        labelEs: 'Anuncios',
        icon: 'megaphone',
        color: '#317dea'
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
        description: 'New help, classes, jobs, and community support from your advisors.',
        chips: ['New', 'Free help', 'This week']
    },
    housing: {
        icon: '🏠',
        title: 'Housing Help',
        description: 'Find apartments, shelters, rent help, and housing support.',
        chips: ['Emergency Housing', 'Apartments', 'Rent Help', 'Tenant Rights']
    },
    job: {
        icon: '💼',
        title: 'Job Help',
        description: 'See advisor posts about job openings, hiring notices, resumes, and career support.',
        chips: ['Hiring Now', 'Resume Help', 'Career Support']
    },
    jobs: {
        icon: '💼',
        title: 'Job Help',
        description: 'See advisor posts about job openings, hiring notices, resumes, and career support.',
        chips: ['Hiring Now', 'Resume Help', 'Career Support']
    },
    immigration: {
        icon: '🌎',
        title: 'Immigration Help',
        description: 'Find legal help, citizenship support, and trusted local organizations.',
        chips: ['Citizenship', 'Legal Help', 'Know Your Rights', 'Green Card']
    },
    health: {
        icon: '❤️',
        title: 'Health Support',
        description: 'Find clinics, health information, mental health support, and care nearby.',
        chips: ['Clinics', 'Mental Health', 'Insurance', 'Urgent Help']
    },
    food: {
        icon: '🥕',
        title: 'Food Help',
        description: 'Find food pantries, meal programs, and grocery help for families.',
        chips: ['Food Pantry', 'Meals', 'Delivery', 'Family Help']
    },
    esol: {
        icon: '📘',
        title: 'Free Classes',
        description: 'Find English classes, adult education, GED, and student support.',
        chips: ['English Class', 'GED', 'Conversation', 'Career English']
    },
    college: {
        icon: '🎓',
        title: 'College Pathways',
        description: 'Find college, GED, certificates, and next-step education support.',
        chips: ['GED', 'Certificates', 'Financial Aid', 'College Help']
    },
    money: {
        icon: '💵',
        title: 'Money Help',
        description: 'Find financial coaching, benefits, tax help, and low-cost support.',
        chips: ['Benefits', 'Tax Help', 'Budgeting', 'Free Support']
    },
    childcare: {
        icon: '👨‍👩‍👧',
        title: 'Family Support',
        description: 'Find child care, family programs, youth support, and parent help.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    family: {
        icon: '👨‍👩‍👧',
        title: 'Family Support',
        description: 'Find child care, family programs, youth support, and parent help.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    training: {
        icon: '🧰',
        title: 'Training Posts',
        description: 'See advisor posts about workshops, skills training, certificates, and programs.',
        chips: ['Workshops', 'Certificates', 'Career Skills', 'Programs']
    },
    'career-fair': {
        icon: '📍',
        title: 'Career Fairs',
        description: 'Find hiring events, job fairs, and places to meet employers.',
        chips: ['Hiring Events', 'Employers', 'Resume', 'Interviews']
    },
    announcement: {
        icon: '📢',
        title: 'Announcements',
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
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M18 22h28c5 0 8 3 8 8v18c0 5-3 8-8 8H18c-5 0-8-3-8-8V30c0-5 3-8 8-8Z"/>
            <path fill="#fff" d="M24 20c0-5 3-8 8-8s8 3 8 8v4h-7v-4c0-1-.3-1.4-1-1.4s-1 .4-1 1.4v4h-7v-4Z"/>
            <path fill="#dce3ec" d="M10 34h44v9H10z"/>
            <circle cx="32" cy="39" r="4.2" fill="#ffc857"/>
        </svg>
    `,
    home: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M10 31 32 11l22 20v23H10V31Z"/>
            <path fill="#df6b4a" d="M26 39c0-3.3 2.7-6 6-6s6 2.7 6 6v15H26V39Z"/>
            <circle cx="34.5" cy="46" r="1.7" fill="#ffc857"/>
        </svg>
    `,
    heart: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M32 55C18 44 11 35.8 11 25.5 11 17 17.7 11 25.3 11c4.2 0 7.2 2 8.7 4.2C35.5 13 38.5 11 42.7 11 50.3 11 57 17 57 25.5 57 35.8 50 44 32 55Z"/>
            <path fill="#df477f" d="M28 23h8v9h9v8h-9v9h-8v-9h-9v-8h9v-9Z"/>
        </svg>
    `,
    food: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M17 22h30l-4 30H21l-4-30Z"/>
            <path fill="#fff" d="M24 21c.6-6 4-9 8-9s7.4 3 8 9h-6c-.4-2.4-1-3-2-3s-1.6.6-2 3h-6Z"/>
            <path fill="#2f934f" d="M21 22h22l-.8 6H21.8L21 22Z" opacity=".22"/>
            <circle cx="32" cy="39" r="6.2" fill="#df6b4a"/>
        </svg>
    `,
    family: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="26" cy="18" r="8" fill="#fff"/>
            <circle cx="47" cy="25" r="7" fill="#fff"/>
            <path fill="#fff" d="M10 53c1-10.5 7.2-16.5 16-16.5S41 42.5 42 53H10Z"/>
            <path fill="#fff" d="M39 53c.8-7.5 4.9-12 10.5-12S59.2 45.5 60 53H39Z"/>
        </svg>
    `,
    abc: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M12 14h37c5.5 0 9 3.5 9 9v16c0 5.5-3.5 9-9 9H31L18 59V48h-6c-5.5 0-9-3.5-9-9V23c0-5.5 3.5-9 9-9Z"/>
            <text x="13" y="38" fill="#8050d1" font-family="Arial, sans-serif" font-size="18" font-weight="900">ABC</text>
            <circle cx="52" cy="52" r="7.5" fill="#c9b5ff"/>
        </svg>
    `,
    graduation: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M4 25 32 13l28 12-28 12L4 25Z"/>
            <path fill="#fff" d="M17 33v13c8.5 5.4 21.5 5.4 30 0V33l-15 6.5L17 33Z"/>
            <path fill="#ffc857" d="M53 28h5v19h-5z"/>
            <circle cx="55.5" cy="29" r="4.2" fill="#ffc857"/>
        </svg>
    `,
    handshake: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M9 34c8-2 15-4 22-6 3-1 6 0 8 2l5 5c3 3 1 8-3 8H25c-6 0-11-2-16-5v-4Z"/>
            <path fill="#fff" d="M55 34c-8-2-15-4-22-6-3-1-6 0-8 2l-5 5c-3 3-1 8 3 8h16c6 0 11-2 16-5v-4Z" opacity=".95"/>
            <circle cx="32" cy="37" r="7" fill="#f08b1f"/>
            <circle cx="32" cy="37" r="3" fill="#fff"/>
        </svg>
    `,
    money: `
        <svg viewBox="0 0 64 64" aria-hidden="true">
            <path fill="#fff" d="M14 20c8-5 28-5 36 0v27c-8 5-28 5-36 0V20Z"/>
            <text x="27" y="30" fill="#1fa77e" font-family="Arial, sans-serif" font-size="19" font-weight="900">$</text>
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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 4v15.5"></path>
            <path d="M7 7.5h10"></path>
            <path d="m7 7.5-3 5h6l-3-5Z"></path>
            <path d="m17 7.5-3 5h6l-3-5Z"></path>
            <path d="M8.5 20.5h7"></path>
        </svg>
    `,
    globe: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5"></circle>
            <path d="M3.75 12h16.5"></path>
            <path d="M12 3.75c2.75 2.55 4.25 5.3 4.25 8.25S14.75 17.7 12 20.25c-2.75-2.55-4.25-5.3-4.25-8.25S9.25 6.3 12 3.75Z"></path>
        </svg>
    `
};
