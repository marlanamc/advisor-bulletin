import { db, auth, storage } from './src/firebase.js'
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'

const STUDENT_ANALYTICS_ACTIONS = new Set([
    'card_view',
    'detail_open',
    'link_click',
    'pdf_open',
    'share_click',
    'category_click',
    'resource_open'
]);

function getAnalyticsDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function trackStudentEvent(action, payload = {}) {
    if (!STUDENT_ANALYTICS_ACTIONS.has(action) || typeof db === 'undefined') {
        return Promise.resolve();
    }

    const event = {
        action,
        createdAt: serverTimestamp(),
        dayKey: getAnalyticsDayKey(),
        source: 'student',
        contentType: payload.contentType || (action === 'category_click' ? 'category' : 'post')
    };

    if (payload.postId) {
        event.postId = String(payload.postId).slice(0, 160);
    }

    if (payload.category) {
        event.category = String(payload.category).slice(0, 80);
    }

    return addDoc(collection(db, 'analyticsEvents'), event).catch((error) => {
        console.debug('Student analytics skipped:', error && error.code ? error.code : error);
    });
}

window.trackStudentEvent = trackStudentEvent;

/** Public advisor directory for the student site. Email local parts match advisor usernames. */
const STUDENT_ADVISOR_DIRECTORY = [
    { name: 'Leah',      role: 'Coordinator/Educator', email: 'lgregory@ebhcs.org' },
    { name: 'Carmen',    role: 'Advisor',               email: 'vlalin@ebhcs.org' },
    { name: 'Fabiola',   role: 'Advisor',               email: 'fvaquerano@ebhcs.org' },
    { name: 'Felipe',    role: 'Advisor',               email: 'fgallego@ebhcs.org' },
    { name: 'Jerome',    role: 'Advisor',               email: 'jkiley@ebhcs.org' },
    { name: 'Jorge',     role: 'Advisor',               email: 'rocha@ebhcs.org' },
    { name: 'Leidy',     role: 'Advisor',               email: 'lalzate@ebhcs.org' },
    { name: 'Mike K.',   role: 'Advisor',               email: 'mkelsen@ebhcs.org' },
    { name: 'Simonetta', role: 'Advisor',               email: 'spiergentili@ebhcs.org' }
];

/** Optional synthetic items merged into student calendar / upcoming — not stored in Firestore. */
const SCHOOL_CALENDAR_ANCHORS = [];

function withSchoolCalendarAnchors(bulletins) {
    return [...SCHOOL_CALENDAR_ANCHORS, ...(bulletins || [])];
}

const RESOURCE_CATEGORY_CONFIG = {
    immigration: {
        labelEn: 'Immigration',
        labelEs: 'Inmigración',
        icon: 'globe',
        color: '#0d9488'
    },
    jobs: {
        labelEn: 'Jobs',
        labelEs: 'Empleos',
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
        labelEn: 'Family',
        labelEs: 'Familia',
        icon: 'family',
        color: '#c99035'
    },
    esol: {
        labelEn: 'English class',
        labelEs: 'Inglés',
        icon: 'abc',
        color: '#8050d1'
    },
    college: {
        labelEn: 'College & GED',
        labelEs: 'Universidad',
        icon: 'graduation',
        color: '#0a1d3a'
    },
    'career-fair': {
        labelEn: 'Career Fair',
        labelEs: 'Feria',
        icon: 'handshake',
        color: '#f08b1f'
    },
    money: {
        labelEn: 'Money help',
        labelEs: 'Dinero',
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

const STORY_BUBBLE_PREVIEW_CATEGORIES = ['immigration', 'jobs', 'housing', 'health', 'food'];
const RESOURCE_TILE_CATEGORIES = ['jobs', 'immigration', 'housing', 'health', 'food', 'family', 'esol', 'college', 'career-fair', 'money'];

const FEED_CATEGORY_CONTENT = {
    all: {
        icon: '✨',
        title: 'Main Feed',
        description: 'New help, classes, jobs, and community resources from your advisors.',
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
        title: 'Jobs Hiring Now',
        description: 'Find job openings, training, resumes, and career support.',
        chips: ['Hiring Now', 'Training', 'Resume Help', 'Career Fair']
    },
    jobs: {
        icon: '💼',
        title: 'Jobs Hiring Now',
        description: 'Find job openings, training, resumes, and career support.',
        chips: ['Hiring Now', 'Training', 'Resume Help', 'Career Fair']
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
        title: 'Food Resources',
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
        description: 'Find child care, family programs, youth support, and parent resources.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    family: {
        icon: '👨‍👩‍👧',
        title: 'Family Support',
        description: 'Find child care, family programs, youth support, and parent resources.',
        chips: ['Child Care', 'Family Programs', 'Youth', 'Parent Help']
    },
    training: {
        icon: '🧰',
        title: 'New Programs',
        description: 'Find skills training, certificates, and programs that can lead to work.',
        chips: ['Certificate', 'Short Program', 'Career Skills', 'Free']
    },
    'career-fair': {
        icon: '📍',
        title: 'Career Fairs',
        description: 'Find hiring events, job fairs, and places to meet employers.',
        chips: ['Hiring Events', 'Employers', 'Resume', 'Interviews']
    }
};

const RESOURCE_ICON_SVGS = {
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

const DEMO_RESOURCES = [
    {
        id: 'demo-project-citizenship',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'immigration',
        resourceOrder: 1,
        title: 'Project Citizenship',
        titleEn: 'Project Citizenship',
        titleEs: 'Proyecto Ciudadania',
        description: 'Free help with your citizenship paperwork.',
        url: 'https://projectcitizenship.org',
        phone: '617-694-5949',
        tel: 'tel:6176945949',
        websiteLabel: 'projectcitizenship.org',
        languages: ['EN', 'ES', 'HT', 'PT']
    },
    {
        id: 'demo-eb-ecumenical',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'immigration',
        resourceOrder: 2,
        title: 'East Boston Ecumenical',
        titleEn: 'East Boston Ecumenical',
        titleEs: 'Concilio Ecumenico',
        description: 'Free legal help. Walk-ins on Tuesday.',
        url: 'https://ebecc.org',
        phone: '617-567-3092',
        tel: 'tel:6175673092',
        address: '50 Meridian St',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=50+Meridian+St+East+Boston+MA',
        languages: ['EN', 'ES']
    },
    {
        id: 'demo-mira',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'immigration',
        resourceOrder: 3,
        title: 'MIRA Coalition',
        titleEn: 'MIRA Coalition',
        titleEs: 'Coalicion MIRA',
        description: 'Help with green card, asylum, and citizenship.',
        url: 'https://miracoalition.org',
        phone: '617-350-5480',
        tel: 'tel:6173505480',
        languages: ['EN', 'ES', 'PT']
    },
    {
        id: 'demo-masshire',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'jobs',
        resourceOrder: 1,
        title: 'MassHire Career Center',
        titleEn: 'MassHire Career Center',
        titleEs: 'Centro de Empleo MassHire',
        description: 'Job search, resumes, training referrals, and hiring events.',
        phone: '617-561-2222',
        tel: 'tel:6175612222',
        address: '215 Bremen St',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=215+Bremen+St+East+Boston+MA',
        languages: ['EN', 'ES']
    },
    {
        id: 'demo-jvs',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'jobs',
        resourceOrder: 2,
        title: 'JVS Boston',
        titleEn: 'JVS Boston',
        titleEs: 'JVS Boston',
        description: 'Career coaching, English for work, and skills training.',
        url: 'https://www.jvs-boston.org',
        phone: '617-399-3131',
        tel: 'tel:6173993131',
        languages: ['EN', 'ES']
    },
    {
        id: 'demo-housing-families',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'housing',
        resourceOrder: 1,
        title: 'Housing Families',
        titleEn: 'Housing Families',
        titleEs: 'Ayuda de Vivienda',
        description: 'Eviction prevention and housing stability support.',
        phone: '781-322-9119',
        tel: 'tel:7813229119',
        languages: ['EN', 'ES', 'HT']
    },
    {
        id: 'demo-ebnhc',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'health',
        resourceOrder: 1,
        title: 'East Boston Neighborhood Health',
        titleEn: 'East Boston Neighborhood Health',
        titleEs: 'Clinica de East Boston',
        description: 'Primary care, urgent care, dental, and pharmacy services.',
        phone: '617-569-5800',
        tel: 'tel:6175695800',
        address: '10 Gove St',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=10+Gove+St+East+Boston+MA',
        languages: ['EN', 'ES', 'PT', 'HT']
    },
    {
        id: 'demo-food-source',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'food',
        resourceOrder: 1,
        title: 'ABCD Food Access',
        titleEn: 'ABCD Food Access',
        titleEs: 'Comida con ABCD',
        description: 'Food delivery and pantry referrals for nearby families.',
        phone: '617-348-6000',
        tel: 'tel:6173486000',
        languages: ['EN', 'ES']
    },
    {
        id: 'demo-family-center',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'family',
        resourceOrder: 1,
        title: 'East Boston Social Centers',
        titleEn: 'East Boston Social Centers',
        titleEs: 'Centros Sociales',
        description: 'Child care, youth programs, and family support.',
        phone: '617-569-3221',
        tel: 'tel:6175693221',
        address: '68 Central Square',
        mapUrl: 'https://www.google.com/maps/search/?api=1&query=68+Central+Square+East+Boston+MA',
        languages: ['EN', 'ES']
    },
    {
        id: 'demo-esol-harborside',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'esol',
        resourceOrder: 1,
        title: 'Harborside English Classes',
        titleEn: 'Harborside English Classes',
        titleEs: 'Clases de Ingles',
        description: 'Free ESOL classes and student advising.',
        phone: '617-635-5114',
        tel: 'tel:6176355114',
        languages: ['EN', 'ES', 'PT']
    },
    {
        id: 'demo-bhcc',
        type: 'resource',
        isPublished: true,
        isDemo: true,
        resourceCategory: 'college',
        resourceOrder: 1,
        title: 'Bunker Hill Community College',
        titleEn: 'Bunker Hill Community College',
        titleEs: 'Bunker Hill',
        description: 'Admissions, financial aid, certificates, and college pathways.',
        phone: '617-228-2000',
        tel: 'tel:6172282000',
        languages: ['EN', 'ES']
    }
];

// Firebase-enabled Bulletin Board System
class FirebaseBulletinBoard {
    constructor() {
        this.currentUser = null;
        this.bulletins = [];
        this.filteredPosts = [];
        this.lastHashHighlight = null;
        this.currentView = 'feed';
        this.currentFeedCategory = 'all';
        this.currentResourceCategory = 'all';
        this.resourceSearchQuery = '';
        this.resourceSortMode = 'default';
        this.datesViewMode = 'list';
        this.isSearchLayerOpen = false;
        this.trackedCardViews = new Set();
        this.handleHashChange = this.handleHashRouting.bind(this);
        this.handleDescriptionToggle = this.handleDescriptionToggle.bind(this);
        this.init();
    }

    init() {
        this.currentCalendarMonth = new Date().getMonth();
        this.currentCalendarYear = new Date().getFullYear();
        this.bindEvents();
        this.loadBulletins();
        this.checkAutoLogin();
        this.setupRealtimeListener();
        this.switchView('feed', { skipRender: true, preserveDetail: true });
        this.closeSearchLayer({ preserveScroll: true, silent: true });
        window.addEventListener('hashchange', this.handleHashChange);
    }

    setupRealtimeListener() {
        const q = query(collection(db, 'bulletins'), where('isActive', '==', true), orderBy('datePosted', 'desc'))
        onSnapshot(q, (snapshot) => {
            this.bulletins = [];
            snapshot.forEach((doc) => {
                this.bulletins.push({
                    id: doc.id,
                    ...this.normalizeBulletin(doc.data())
                });
            });
            this.populateAdvisorFilters();
            this.renderResourceCategoryFilters();
            this.displayBulletins();
        }, (error) => {
            console.error('Error loading bulletins:', error);
        });
    }

    normalizeBulletin(data) {
        const type = data.type || 'post';
        const normalized = {
            ...data,
            type
        };

        if (type === 'resource') {
            normalized.isPublished = data.isPublished !== false;
        }

        return normalized;
    }

    populateAdvisorFilters() {
        const advisorNames = [...new Set(this.getPostBulletins(this.bulletins).map(b => b.advisorName).filter(name => name))];
        advisorNames.sort();
        
        const postedByChips = document.getElementById('postedByChips');
        if (!postedByChips) return;
        
        // Clear existing chips
        postedByChips.innerHTML = '';
        
        // Create a chip for each advisor
        advisorNames.forEach(advisorName => {
            const chip = document.createElement('button');
            chip.className = 'filter-chip postedby-chip';
            chip.setAttribute('data-postedby', advisorName);
            chip.textContent = `👤 ${advisorName}`;
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'postedby'));
            postedByChips.appendChild(chip);
        });

        // Update "All" count badge in category bar
        const allCount = document.getElementById('catAllCount');
        if (allCount) allCount.textContent = this.getPostBulletins(this.bulletins).length;
    }

    bindEvents() {
        document.querySelectorAll('[data-app-view]').forEach((button) => {
            button.addEventListener('click', (event) => {
                if (button.tagName === 'A') {
                    event.preventDefault();
                }
                const nextView = button.getAttribute('data-app-view');
                if (nextView) {
                    this.switchView(nextView);
                    if (button.hasAttribute('data-scroll-home')) {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
            });
        });

        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearFilters = document.getElementById('clearFilters');

        if (searchInput) searchInput.addEventListener('input', () => this.applyFilters());
        if (searchBtn) searchBtn.addEventListener('click', () => this.applyFilters());
        if (clearFilters) clearFilters.addEventListener('click', () => this.clearFilters());

        // Hero search bar
        const heroInput = document.getElementById('heroSearchInput');
        const heroBtn = document.getElementById('heroSearchBtn');
        const syncHero = () => {
            if (searchInput && heroInput) searchInput.value = heroInput.value;
            this.applyFilters();
        };
        if (heroInput) {
            heroInput.addEventListener('input', syncHero);
            heroInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') syncHero(); });
        }
        if (heroBtn) heroBtn.addEventListener('click', syncHero);

        // Desktop header search bar
        const desktopSearchInput = document.getElementById('desktopTopbarSearchInput');
        const desktopSearchBtn = document.getElementById('desktopTopbarSearchBtn');
        const syncDesktopSearch = () => {
            if (searchInput && desktopSearchInput) searchInput.value = desktopSearchInput.value;
            if (heroInput && desktopSearchInput) heroInput.value = desktopSearchInput.value;
            this.applyFilters();
        };
        if (desktopSearchInput) {
            desktopSearchInput.addEventListener('input', syncDesktopSearch);
            desktopSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') syncDesktopSearch();
            });
        }
        if (desktopSearchBtn) desktopSearchBtn.addEventListener('click', syncDesktopSearch);

        // Popular search chips
        document.querySelectorAll('.feed-popular-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const term = chip.getAttribute('data-search-term') || '';
                if (heroInput) heroInput.value = term;
                if (searchInput) searchInput.value = term;
                if (desktopSearchInput) desktopSearchInput.value = term;
                this.applyFilters();
            });
        });

        // Category bar (single-select)
        document.querySelectorAll('.cat-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const filter = chip.getAttribute('data-cat-filter');
                this.setFeedCategory(filter === 'all' ? 'all' : filter);
            });
        });

        const toggleFiltersBtn = document.getElementById('toggleFilters');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', () => {
                this.toggleFiltersPanel();
            });
        }

        const mobileSearchTrigger = document.getElementById('mobileSearchTrigger');
        if (mobileSearchTrigger) {
            mobileSearchTrigger.addEventListener('click', () => this.toggleSearchLayer());
        }

        document.querySelectorAll('[data-close-search-layer]').forEach((element) => {
            element.addEventListener('click', () => this.closeSearchLayer());
        });

        const closeSearchLayer = document.getElementById('closeSearchLayer');
        if (closeSearchLayer) {
            closeSearchLayer.addEventListener('click', () => this.closeSearchLayer());
        }

        this.selectedCategories = [];
        this.selectedPostedDates = [];
        this.selectedDeadlines = [];
        this.selectedClassTypes = [];
        this.selectedPostedBy = [];

        // Bind filter chip events
        document.querySelectorAll('.filter-chip[data-category]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'category'));
        });

        document.querySelectorAll('.filter-chip[data-posted]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'posted'));
        });

        document.querySelectorAll('.filter-chip[data-deadline]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'deadline'));
        });

        document.querySelectorAll('.filter-chip[data-classtype]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'classtype'));
        });

        document.querySelectorAll('.filter-chip[data-postedby]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'postedby'));
        });

        // Show expired toggle
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        if (showExpiredToggle) {
            showExpiredToggle.addEventListener('change', () => this.applyFilters());
        }

        const resourceCategoryFilters = document.getElementById('resourceCategoryFilters');
        if (resourceCategoryFilters) {
            resourceCategoryFilters.addEventListener('click', (event) => {
                const chip = event.target.closest('.resource-category-chip, .resource-category-tile');
                if (!chip) {
                    return;
                }

                const category = chip.getAttribute('data-resource-category') || 'all';
                if (category !== 'all') {
                    trackStudentEvent('category_click', {
                        category,
                        contentType: 'category'
                    });
                }
                this.openResourceShortcut(category);
            });
        }

        document.addEventListener('click', (event) => {
            const shortcut = event.target.closest('[data-resource-shortcut]');
            if (!shortcut) {
                return;
            }

            const category = shortcut.getAttribute('data-resource-shortcut');
            if (category) {
                trackStudentEvent('category_click', {
                    category,
                    contentType: 'category'
                });
                this.openResourceShortcut(category);
            }
        });

        const feedCategoryClear = document.getElementById('feedCategoryClear');
        if (feedCategoryClear) {
            feedCategoryClear.addEventListener('click', () => this.setFeedCategory('all'));
        }

        document.addEventListener('click', (event) => {
            const analyticsTarget = event.target.closest('[data-analytics-action]');
            if (!analyticsTarget) return;

            trackStudentEvent(analyticsTarget.getAttribute('data-analytics-action'), {
                postId: analyticsTarget.getAttribute('data-analytics-post-id') || '',
                category: analyticsTarget.getAttribute('data-analytics-category') || '',
                contentType: analyticsTarget.getAttribute('data-analytics-content-type') || 'post'
            });
        });

        const closeDetailBtn = document.getElementById('closeBulletinDetail');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => this.closeBulletinDetail());
        }

        const detailModal = document.getElementById('bulletinDetailModal');
        if (detailModal) {
            detailModal.addEventListener('click', (event) => {
                if (event.target === detailModal) {
                    this.closeBulletinDetail();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                if (this.isSearchLayerOpen) {
                    this.closeSearchLayer();
                    return;
                }
                const detailModalEl = document.getElementById('bulletinDetailModal');
                if (detailModalEl && detailModalEl.style.display === 'flex') {
                    this.closeBulletinDetail();
                }
            }
        });

        document.addEventListener('click', this.handleDescriptionToggle);

        // Resource sort
        this.setupResourceSort();

        // Copy link buttons
        this.setupCopyLinks();

        // Back to top button
        this.setupBackToTop();

        document.querySelectorAll('[data-dates-view]').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-dates-view');
                if (!mode) return;
                this.datesViewMode = mode;
                this.renderCalendar(this.filteredPosts.length > 0 ? this.filteredPosts : this.getPostBulletins(this.bulletins));
            });
        });
    }

    setupResourceSort() {
        const sortBtns = document.querySelectorAll('.resource-sort-btn');

        sortBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                sortBtns.forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                this.resourceSortMode = btn.dataset.sort;
                this.renderResourceList(this.getPublishedResources());
            });
        });
    }

    setupCopyLinks() {
        document.addEventListener('click', async (e) => {
            const copyBtn = e.target.closest('.resource-copy-btn');
            if (!copyBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const url = copyBtn.dataset.url;

            try {
                await navigator.clipboard.writeText(url);
                copyBtn.classList.add('copied');

                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    }

    setupBackToTop() {
        const btn = document.getElementById('backToTop');
        if (!btn) return;

        let ticking = false;

        const checkScroll = () => {
            const shouldShow = window.scrollY > 400;
            btn.classList.toggle('visible', shouldShow);
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(checkScroll);
                ticking = true;
            }
        }, { passive: true });

        btn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    switchView(view, options = {}) {
        const validViews = ['feed', 'calendar', 'resources', 'about', 'advisors'];
        if (!validViews.includes(view)) {
            return;
        }

        this.currentView = view;
        document.body.setAttribute('data-current-view', view);

        if (view === 'advisors') {
            this.renderStudentAdvisorDirectory();
        }

        if (window.matchMedia('(max-width: 768px)').matches) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        document.querySelectorAll('[data-view-panel]').forEach((panel) => {
            panel.classList.toggle('active', panel.getAttribute('data-view-panel') === view);
        });

        document.querySelectorAll('[data-app-view]').forEach((button) => {
            const isActive = button.getAttribute('data-app-view') === view;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
            if (button.classList.contains('mobile-tab')) {
                button.setAttribute('aria-current', isActive ? 'page' : 'false');
            }
        });

        if (view !== 'feed' && !options.preserveDetail) {
            this.closeBulletinDetail(false);
        }

        // Close search layer when leaving feed/resources views
        if (view !== 'feed' && view !== 'resources') {
            this.closeSearchLayer({ preserveScroll: true, silent: true });
        }

        this.syncHeaderSearchButton();
        this.updateSearchPlaceholder();

        if (!options.skipRender && view !== 'advisors') {
            if (this.filteredPosts.length > 0 || this.bulletins.length === 0) {
                this.displayBulletins(this.filteredPosts);
            } else {
                this.applyFilters();
            }
        }
    }

    renderStudentAdvisorDirectory() {
        const list = document.getElementById('advisorsDirectoryList');
        if (!list) {
            return;
        }

        list.innerHTML = STUDENT_ADVISOR_DIRECTORY.map((advisor) => {
            const name = this.escapeHtml(advisor.name);
            const role = this.escapeHtml(advisor.role);
            const email = this.escapeHtml(advisor.email || `${advisor.username}@ebhcs.org`);
            return `
                <article class="advisor-dir-card">
                    <div class="advisor-dir-card-text">
                        <h2 class="advisor-dir-name">${name}</h2>
                        <p class="advisor-dir-role">${role}</p>
                    </div>
                    <a class="advisor-dir-email" href="mailto:${email}">${email}</a>
                </article>
            `;
        }).join('');
    }

    displayBulletins(filteredBulletins = null) {
        if (filteredBulletins === null) {
            this.applyFilters();
            return;
        }

        const postBulletins = filteredBulletins.filter((bulletin) => !this.isResourceBulletin(bulletin));
        const resources = this.getPublishedResources();

        this.filteredPosts = postBulletins;
        this.updateFeedCategoryHeader();
        this.updateActiveCategoryState();
        this.updateResultsInfo(postBulletins);
        const feedPosts = postBulletins.filter((bulletin) => this.isVisibleOnMainFeed(bulletin));
        this.renderFeed(feedPosts);
        this.renderCalendar(postBulletins);
        this.renderHomeUpcomingEvents(postBulletins);
        this.renderResourcesSections(resources);
        this.syncHeaderSearchButton();
        this.handleHashRouting();
    }

    updateResultsInfo(posts) {
        const resultsInfo = document.getElementById('resultsInfo');
        if (!resultsInfo) {
            return;
        }

        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        const categoryOnly = (this.currentFeedCategory || 'all') !== 'all'
            && !searchTerm
            && this.selectedPostedDates.length === 0
            && this.selectedDeadlines.length === 0
            && this.selectedClassTypes.length === 0
            && this.selectedPostedBy.length === 0;

        if (categoryOnly) {
            resultsInfo.style.display = 'none';
            return;
        }

        if (this.areFiltersApplied()) {
            resultsInfo.textContent = `Showing ${posts.length} of ${this.getPostBulletins(this.bulletins).length} bulletins`;
            resultsInfo.style.display = 'block';
            return;
        }

        resultsInfo.style.display = 'none';
    }

    updateFeedCategoryHeader() {
        const header = document.getElementById('feedCategoryHeader');
        const icon = document.getElementById('feedCategoryIcon');
        const kicker = document.getElementById('feedCategoryKicker');
        const title = document.getElementById('feedCategoryTitle');
        const description = document.getElementById('feedCategoryDescription');
        const chips = document.getElementById('feedCategoryChips');
        const resourcesContainer = document.getElementById('feedCategoryResources');
        if (!header || !icon || !kicker || !title || !description || !chips || !resourcesContainer) {
            return;
        }

        const category = this.currentFeedCategory || 'all';
        const content = FEED_CATEGORY_CONTENT[category] || FEED_CATEGORY_CONTENT.all;
        const isAll = category === 'all';

        header.hidden = isAll;
        icon.textContent = content.icon;
        kicker.textContent = `Showing: ${content.title}`;
        title.textContent = content.title;
        description.textContent = content.description;
        chips.innerHTML = content.chips.map((chip) => `<span>${this.escapeHtml(chip)}</span>`).join('');
        resourcesContainer.innerHTML = this.createFeedCategoryResourcesHtml(category);
    }

    createFeedCategoryResourcesHtml(category) {
        if (category === 'all') {
            return '';
        }

        const resourceCategory = category === 'job' ? 'jobs' : category === 'childcare' ? 'family' : category;
        const resources = this.getPublishedResources()
            .filter((resource) => this.resourceMatchesCategory(resource, resourceCategory))
            .slice(0, 3);

        if (resources.length === 0) {
            return `
                <div class="feed-category-resource-empty">
                    <strong>Ask an advisor for help with this topic.</strong>
                    <span>More trusted places can be added here.</span>
                </div>
            `;
        }

        return `
            <div class="feed-category-resource-heading">
                <span>Trusted places</span>
                <small>Call, visit, or open the website</small>
            </div>
            <div class="feed-category-resource-grid">
                ${resources.map((resource) => this.createFeedCategoryResourceCard(resource)).join('')}
            </div>
        `;
    }

    createFeedCategoryResourceCard(resource) {
        const { titleEn } = this.getResourceTitles(resource);
        const description = resource.description ? this.escapeHtml(resource.description) : '';
        const url = this.getResourceUrl(resource);
        const phone = resource.phone || '';
        const tel = resource.tel || (phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '');
        const address = resource.address || '';
        const mapUrl = resource.mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
        const actionUrl = tel || (url !== '#' ? url : mapUrl);
        const actionLabel = tel ? 'Call' : url !== '#' ? 'Website' : 'Directions';

        return `
            <article class="feed-category-resource-card">
                <h3>${this.escapeHtml(titleEn)}</h3>
                ${description ? `<p>${description}</p>` : ''}
                ${address ? `<small>${this.escapeHtml(address)}</small>` : ''}
                <div class="feed-category-resource-actions">
                    ${actionUrl ? `<a href="${this.escapeAttribute(actionUrl)}" ${actionUrl.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${actionLabel}</a>` : ''}
                    ${mapUrl ? `<a href="${this.escapeAttribute(mapUrl)}" target="_blank" rel="noopener">Directions</a>` : ''}
                </div>
            </article>
        `;
    }

    updateActiveCategoryState() {
        const category = this.currentFeedCategory || 'all';
        const resourceCategory = category === 'job' ? 'jobs' : category === 'childcare' ? 'family' : category;

        document.querySelectorAll('.cat-chip').forEach((chip) => {
            const chipCategory = chip.getAttribute('data-cat-filter') || 'all';
            chip.classList.toggle('active', chipCategory === category || (category === 'all' && chipCategory === 'all'));
        });

        document.querySelectorAll('.story-bubble[data-app-view-cat]').forEach((bubble) => {
            const bubbleCategory = this.normalizeFeedCategory(bubble.getAttribute('data-app-view-cat') || 'all');
            bubble.classList.toggle('active', bubbleCategory === category);
            bubble.setAttribute('aria-pressed', String(bubbleCategory === category));
        });

        document.querySelectorAll('[data-resource-shortcut], [data-resource-category]').forEach((button) => {
            const value = button.getAttribute('data-resource-shortcut') || button.getAttribute('data-resource-category') || '';
            button.classList.toggle('active', this.normalizeFeedCategory(value) === category || value === resourceCategory);
        });
    }

    toggleSearchLayer() {
        if (this.isSearchLayerOpen) {
            this.closeSearchLayer();
        } else {
            this.openSearchLayer();
        }
    }

    openSearchLayer() {
        if (this.currentView !== 'feed') {
            this.switchView('feed', { skipRender: true, preserveDetail: true });
        }

        this.isSearchLayerOpen = true;
        const searchLayer = document.getElementById('searchLayer');
        if (searchLayer) {
            searchLayer.classList.add('open');
            searchLayer.setAttribute('aria-hidden', 'false');
        }

        document.body.classList.add('search-layer-open');
        this.syncHeaderSearchButton();

        if (window.matchMedia('(max-width: 768px)').matches) {
            window.setTimeout(() => {
                document.getElementById('searchInput')?.focus();
            }, 180);
        }
    }

    closeSearchLayer(options = {}) {
        this.isSearchLayerOpen = false;
        const searchLayer = document.getElementById('searchLayer');
        if (searchLayer) {
            searchLayer.classList.remove('open');
            searchLayer.setAttribute('aria-hidden', 'true');
        }

        document.body.classList.remove('search-layer-open');
        if (!options.silent) {
            this.syncHeaderSearchButton();
        }
    }

    syncHeaderSearchButton() {
        const trigger = document.getElementById('mobileSearchTrigger');
        if (!trigger) {
            return;
        }

        // Show search on feed and resources views
        const shouldShow = this.currentView === 'feed' || this.currentView === 'resources';
        trigger.hidden = !shouldShow;

        const hasActiveSearch = this.currentView === 'resources'
            ? this.resourceSearchQuery && this.resourceSearchQuery.trim() !== ''
            : this.areFiltersApplied();

        trigger.classList.toggle('active', shouldShow && (this.isSearchLayerOpen || hasActiveSearch));
        trigger.setAttribute('aria-expanded', shouldShow && this.isSearchLayerOpen ? 'true' : 'false');
    }

    updateSearchPlaceholder() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;

        if (this.currentView === 'resources') {
            searchInput.placeholder = 'Search resources / Buscar recursos';
        } else {
            searchInput.placeholder = 'Search the feed / Buscar publicaciones';
        }
    }

    renderFeed(bulletins) {
        const grid = document.getElementById('bulletinGrid');
        const emptyState = document.getElementById('feedEmptyState');
        if (!grid || !emptyState) {
            return;
        }

        if (bulletins.length === 0) {
            grid.innerHTML = '';
            emptyState.innerHTML = this.areFiltersApplied()
                ? '<h3>No bulletins found</h3><p>Try adjusting your search or filter criteria.</p>'
                : '<h3>No bulletins posted yet</h3><p>Advisors can log in to post job opportunities, training sessions, and important announcements.</p>';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        grid.innerHTML = this.createCuratedFeedHtml(bulletins);
        this.trackRenderedCardViews(bulletins);
    }

    createCuratedFeedHtml(bulletins) {
        const sections = this.getCuratedFeedSections(bulletins);
        if (sections.length === 0) {
            return bulletins.map((bulletin, index) => this.createBulletinCard(bulletin, index)).join('');
        }

        return sections.map((section) => {
            const cards = section.items.map((bulletin, index) => this.createBulletinCard(bulletin, index)).join('');
            const showSoftHeading = section.title !== 'Jobs Hiring Now' && section.title !== 'More Resources';
            const headingHtml = showSoftHeading
                ? `
                <div class="feed-soft-section">
                    <div class="feed-soft-heading">
                        <span>${this.escapeHtml(section.icon)}</span>
                        <h3>${this.escapeHtml(section.title)}</h3>
                    </div>
                </div>
                `
                : '';
            return `${headingHtml}${cards}`;
        }).join('');
    }

    getCuratedFeedSections(bulletins) {
        if ((this.currentFeedCategory || 'all') !== 'all') {
            const content = FEED_CATEGORY_CONTENT[this.currentFeedCategory] || FEED_CATEGORY_CONTENT.all;
            return [{ title: content.title, icon: content.icon, items: bulletins }];
        }

        const definitions = [
            { title: 'Popular This Week', icon: '✨', categories: ['announcement', 'food', 'health'] },
            { title: 'Jobs Hiring Now', icon: '💼', categories: ['job', 'career-fair', 'training'] },
            { title: 'Free Classes', icon: '📘', categories: ['esol', 'college'] },
            { title: 'Immigration Help', icon: '🌎', categories: ['immigration'] },
            { title: 'New Programs', icon: '🧰', categories: ['housing', 'money', 'childcare'] }
        ];

        const used = new Set();
        const sections = definitions.map((definition) => {
            const items = bulletins.filter((bulletin) => {
                if (used.has(bulletin.id)) return false;
                const matches = definition.categories.some((category) => this.bulletinMatchesCategory(bulletin, category));
                if (matches) used.add(bulletin.id);
                return matches;
            });
            return { ...definition, items };
        }).filter((section) => section.items.length > 0);

        const remaining = bulletins.filter((bulletin) => !used.has(bulletin.id));
        if (remaining.length > 0) {
            sections.push({ title: 'More Resources', icon: '📌', items: remaining });
        }

        return sections;
    }

    trackRenderedCardViews(bulletins) {
        bulletins.forEach((bulletin) => {
            if (!bulletin.id || this.trackedCardViews.has(bulletin.id)) {
                return;
            }

            this.trackedCardViews.add(bulletin.id);
            trackStudentEvent('card_view', {
                postId: bulletin.id,
                category: bulletin.category,
                contentType: bulletin.type || 'post'
            });
        });
    }

    renderCalendar(bulletins) {
        const calendar = document.getElementById('bulletinCalendar');
        const emptyState = document.getElementById('calendarEmptyState');
        if (!calendar || !emptyState) {
            return;
        }

        const mergedBulletins = withSchoolCalendarAnchors(bulletins);
        const datedBulletins = mergedBulletins.filter((bulletin) => bulletin.deadline || bulletin.eventDate || bulletin.startDate);
        if (datedBulletins.length === 0) {
            calendar.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        this.updateDatesViewToggle();
        calendar.innerHTML = this.datesViewMode === 'calendar'
            ? this.createCalendarView(mergedBulletins)
            : this.createDatesListView(datedBulletins);
    }

    renderHomeUpcomingEvents(bulletins) {
        const container = document.getElementById('homeUpcomingEvents');
        if (!container) {
            return;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const mergedBulletins = withSchoolCalendarAnchors(bulletins);
        const events = mergedBulletins
            .map((bulletin) => {
                const rawDate = bulletin.eventDate || bulletin.startDate || bulletin.deadline;
                const timestamp = this.getTimestampValue(rawDate);
                return { bulletin, timestamp };
            })
            .filter((item) => item.timestamp && item.timestamp >= now.getTime())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3);

        if (events.length === 0) {
            container.innerHTML = '<div class="side-empty">Events with dates will appear here.</div>';
            return;
        }

        container.innerHTML = events.map(({ bulletin, timestamp }) => {
            const date = new Date(timestamp);
            const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = date.toLocaleDateString('en-US', { day: 'numeric' });
            const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
            const time = bulletin.startTime || '';
            const meta = [weekday, time].filter(Boolean).join(' · ');

            return `
                <button class="side-event" type="button" onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${bulletin.id}')">
                    <div class="side-date"><span>${month}</span><strong>${day}</strong></div>
                    <div>
                        <p class="side-event-title">${this.escapeHtml(bulletin.title || 'Upcoming event')}</p>
                        <p class="side-event-meta">${this.escapeHtml(meta || 'Date posted')}</p>
                    </div>
                    <span class="side-event-arrow" aria-hidden="true">›</span>
                </button>
            `;
        }).join('');
    }

    updateDatesViewToggle() {
        document.querySelectorAll('[data-dates-view]').forEach((button) => {
            const isActive = button.getAttribute('data-dates-view') === this.datesViewMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    renderResourcesSections(resources) {
        const storyBubbleResources = this.getStoryBubbleResources(resources);
        this.renderResourceStoryRow('headerResourceStoryRow', 'headerResourceEmpty', storyBubbleResources);
        this.renderResourceStoryRow('feedDesktopResourceRow', null, storyBubbleResources);
        this.renderResourceStoryRow('resourceStoryRow', 'resourceStoryEmpty', storyBubbleResources);
        this.renderResourceStoryRow('resourceStoryRowPage', null, storyBubbleResources);
        this.renderHeroResources(resources);
        this.renderResourceCategoryFilters();
        this.renderResourceList(resources);
    }

    renderHeroResources(resources) {
        const container = document.getElementById('heroResourcesGrid');
        if (!container) {
            return;
        }

        // Show category cards for all categories that have resources, or show preview categories
        const categoriesWithResources = new Set();
        resources.forEach((resource) => {
            const category = this.getResourceCategoryKey(resource);
            if (category) {
                categoriesWithResources.add(category);
            }
        });

        // If no resources, show the preview categories
        const categoriesToShow = categoriesWithResources.size > 0
            ? Array.from(categoriesWithResources)
            : STORY_BUBBLE_PREVIEW_CATEGORIES;

        const heroCards = categoriesToShow.map((category) => {
            const config = RESOURCE_CATEGORY_CONFIG[category];
            if (!config) {
                return '';
            }

            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

            return `
                <button
                    type="button"
                    class="hero-resource-card resource-${category}"
                    data-resource-category="${category}"
                    aria-label="View ${config.labelEn} resources"
                >
                    <span class="hero-resource-icon" aria-hidden="true">
                        ${iconSvg}
                    </span>
                    <span class="hero-resource-label">
                        ${config.labelEn}
                        <small>${config.labelEs}</small>
                    </span>
                </button>
            `;
        }).join('');

        container.innerHTML = heroCards || '<p class="hero-resources-empty">No resources available yet.</p>';

        // Add click handlers
        container.querySelectorAll('.hero-resource-card').forEach((card) => {
            card.addEventListener('click', () => {
                const category = card.dataset.resourceCategory;
                this.openResourceShortcut(category);
            });
        });
    }

    renderResourceStoryRow(rowId, emptyId, resources) {
        const row = document.getElementById(rowId);
        if (!row) {
            return;
        }

        row.innerHTML = resources.map((resource) => this.createResourceStoryBubble(resource)).join('');

        if (!emptyId) {
            row.style.display = resources.length > 0 ? 'flex' : 'none';
            return;
        }

        const emptyState = document.getElementById(emptyId);
        if (!emptyState) {
            return;
        }

        const hasResources = resources.length > 0;
        row.style.display = hasResources ? 'flex' : 'none';
        emptyState.style.display = hasResources ? 'none' : 'block';
    }

    renderResourceCategoryFilters() {
        const container = document.getElementById('resourceCategoryFilters');
        if (!container) {
            return;
        }

        const resources = this.getPublishedResources();
        const tiles = RESOURCE_TILE_CATEGORIES
            .map((key) => {
                const config = RESOURCE_CATEGORY_CONFIG[key];
                if (!config) return '';
                const count = resources.filter((resource) => this.getResourceCategoryKey(resource) === key).length;
                const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;
                const placesLabelEn = count === 1 ? 'place' : 'places';
                const placesLabelEs = count === 1 ? 'lugar' : 'lugares';
                return `
            <button
                type="button"
                class="resource-category-tile resource-tile-${key}"
                data-resource-category="${key}"
                aria-label="${this.escapeAttribute(`${config.labelEn} / ${config.labelEs}, ${count} ${placesLabelEn}`)}"
            >
                <span class="resource-category-tile-icon" style="background:${config.color}" aria-hidden="true">
                    ${iconSvg}
                </span>
                <span class="resource-category-tile-copy">
                    <strong>
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </strong>
                    <small>
                        <span class="en-text">${count} ${placesLabelEn}</span>
                        <span class="es-text">${count} ${placesLabelEs}</span>
                    </small>
                </span>
            </button>
        `;
            })
            .join('');

        container.innerHTML = tiles;
    }

    renderResourceList(resources) {
        const container = document.getElementById('resourcesList');
        const emptyState = document.getElementById('resourceEmptyState');
        const sortBar = document.getElementById('resourceSortBar');
        if (!container || !emptyState) {
            return;
        }

        // Resources tab: keep category tiles as the landing view. Show the grid only when
        // searching or when an explicit category filter is active — not merely because
        // the Resources view is open (tiles already open category detail sheets on tap).
        const exploring =
            (this.currentResourceCategory && this.currentResourceCategory !== 'all') ||
            (this.resourceSearchQuery && this.resourceSearchQuery.trim() !== '');

        if (!exploring) {
            container.innerHTML = '';
            container.style.display = 'none';
            container.setAttribute('aria-hidden', 'true');
            emptyState.style.display = 'none';
            if (sortBar) {
                sortBar.hidden = true;
            }
            return;
        }

        container.style.display = '';
        container.setAttribute('aria-hidden', 'false');
        if (sortBar) {
            sortBar.hidden = false;
        }

        // Filter by category
        let visibleResources = this.currentResourceCategory === 'all'
            ? resources
            : resources.filter((resource) => this.resourceMatchesCategory(resource, this.currentResourceCategory));

        // Apply search filter
        visibleResources = this.filterResourcesBySearch(visibleResources, this.resourceSearchQuery);

        // Apply sort
        visibleResources = this.sortResources(visibleResources, this.resourceSortMode);

        if (visibleResources.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            const isSearching = this.resourceSearchQuery && this.resourceSearchQuery.trim() !== '';
            emptyState.innerHTML = isSearching
                ? '<h3>No results found</h3><p>Try a different search term or clear filters.</p><p class="empty-state-bilingual">No se encontraron resultados. Pruebe un término diferente o borre los filtros.</p>'
                : resources.length === 0
                    ? '<h3>No resources published yet</h3><p>Advisors can add quick links in the admin portal so they appear here for students.</p>'
                    : '<h3>No resources in this category</h3><p>Try another category to see more support links.</p>';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        container.innerHTML = visibleResources.map((resource) => this.createResourceCard(resource)).join('');
    }

    filterResourcesBySearch(resources, query) {
        if (!query || query.trim() === '') {
            return resources;
        }

        const normalizedQuery = query.toLowerCase().trim();

        return resources.filter((resource) => {
            const { titleEn, titleEs } = this.getResourceTitles(resource);
            const description = resource.description || '';
            const category = this.getResourceCategoryKey(resource);

            return (
                titleEn.toLowerCase().includes(normalizedQuery) ||
                titleEs.toLowerCase().includes(normalizedQuery) ||
                description.toLowerCase().includes(normalizedQuery) ||
                category.toLowerCase().includes(normalizedQuery)
            );
        });
    }

    sortResources(resources, sortMode) {
        const sorted = [...resources];

        switch (sortMode) {
            case 'newest':
                return sorted.sort((a, b) => {
                    const dateA = this.getTimestampValue(a.datePosted || a.createdAt);
                    const dateB = this.getTimestampValue(b.datePosted || b.createdAt);
                    return dateB - dateA;
                });
            case 'az':
                return sorted.sort((a, b) => {
                    const { titleEn: titleA } = this.getResourceTitles(a);
                    const { titleEn: titleB } = this.getResourceTitles(b);
                    return titleA.localeCompare(titleB);
                });
            default:
                // Respect the advisor-defined resourceOrder, then fall back to newest
                return sorted.sort((a, b) => {
                    const orderA = this.getResourceOrder(a);
                    const orderB = this.getResourceOrder(b);
                    if (orderA !== orderB) return orderA - orderB;
                    return this.getTimestampValue(b.datePosted || b.createdAt) - this.getTimestampValue(a.datePosted || a.createdAt);
                });
        }
    }

    switchResourceCategory(category) {
        this.currentResourceCategory = category;
        this.renderResourcesSections(this.getPublishedResources());
    }

    openResourceShortcut(category) {
        const keyMap = {
            job: 'jobs',
            childcare: 'family',
            money: 'money',
            esol: 'esol',
            college: 'college',
            'career-fair': 'career-fair',
        };
        const resourceKey = keyMap[category] || category;
        this.openResourceDetailSheet(resourceKey);
    }

    setFeedCategory(category = 'all') {
        const normalizedCategory = this.normalizeFeedCategory(category);
        this.currentFeedCategory = normalizedCategory;
        this.selectedCategories = normalizedCategory === 'all' ? [] : [normalizedCategory];
        this.updateFeedCategoryHeader();
        this.updateActiveCategoryState();
        this.applyFilters();
    }

    normalizeFeedCategory(category) {
        const key = String(category || 'all');
        const aliases = {
            jobs: 'job',
            family: 'childcare',
            resource: 'all'
        };
        return aliases[key] || key;
    }

    openResourceDetailSheet(category) {
        const config = RESOURCE_CATEGORY_CONFIG[category];
        const sheet = document.getElementById('catDetailSheet');
        const titleEl = document.getElementById('catDetailTitle');
        const iconEl = document.getElementById('catDetailIcon');
        const listEl = document.getElementById('catOrgList');
        if (!config || !sheet || !listEl) return;

        const resources = this.getPublishedResources()
            .filter((resource) => this.getResourceCategoryKey(resource) === category);
        const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

        if (titleEl) {
            titleEl.innerHTML = `
                <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                <small>
                    <span class="en-text">${resources.length} ${resources.length === 1 ? 'resource' : 'resources'}</span>
                    <span class="es-text">${resources.length} ${resources.length === 1 ? 'recurso' : 'recursos'}</span>
                </small>
            `;
        }

        if (iconEl) {
            iconEl.style.background = config.color;
            iconEl.innerHTML = iconSvg;
        }

        sheet.style.setProperty('--cat-accent', config.color);
        listEl.innerHTML = resources.map((resource) => this.createResourceDetailCard(resource, config)).join('');

        sheet.classList.add('open');
        sheet.setAttribute('aria-hidden', 'false');
        const scroll = sheet.querySelector('.cat-detail-scroll');
        if (scroll) scroll.scrollTop = 0;
    }

    createResourceDetailCard(resource, config) {
        const { titleEn } = this.getResourceTitles(resource);
        const description = resource.description ? this.escapeHtml(resource.description) : '';
        const url = this.getResourceUrl(resource);
        const displayUrl = resource.websiteLabel || this.formatLinkLabel(url, this.getResourceCategoryKey(resource));
        const phone = resource.phone || '';
        const tel = resource.tel || (phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '');
        const address = resource.address || '';
        const mapUrl = resource.mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
        const languages = Array.isArray(resource.languages)
            ? resource.languages
            : this.parseResourceHighlights(resource.highlights);
        const languageHtml = languages.length > 0
            ? `<div class="cat-org-langs">${languages.slice(0, 5).map((lang) => `<span class="cat-org-lang-tag">${this.escapeHtml(lang)}</span>`).join('')}</div>`
            : '';
        const callHtml = phone && tel
            ? `<a href="${this.escapeAttribute(tel)}" class="cat-org-btn cat-org-btn--call">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                    <span><strong>Call</strong><small>${this.escapeHtml(phone)}</small></span>
                </a>`
            : '';
        const websiteHtml = url && url !== '#'
            ? `<a href="${this.escapeAttribute(url)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--website">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                    <span><strong>Website</strong><small>${this.escapeHtml(displayUrl)}</small></span>
                </a>`
            : '';
        const directionsHtml = mapUrl
            ? `<a href="${this.escapeAttribute(mapUrl)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--directions">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    <span><strong>Directions</strong><small>${this.escapeHtml(address)}</small></span>
                </a>`
            : '';

        const actionCount = [callHtml, websiteHtml || directionsHtml].filter(Boolean).length;

        return `
            <article class="cat-org-card" style="--cat-accent:${config.color}">
                <h3 class="cat-org-name">${this.escapeHtml(titleEn)}</h3>
                ${description ? `<p class="cat-org-description">${description}</p>` : ''}
                ${address ? `<p class="cat-org-address">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#758299" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    ${this.escapeHtml(address)}
                </p>` : ''}
                ${languageHtml}
                <div class="cat-org-actions ${actionCount === 1 || (websiteHtml && callHtml && !directionsHtml) ? 'cat-org-actions--stack' : ''}">
                    ${callHtml}
                    ${websiteHtml || directionsHtml}
                </div>
            </article>
        `;
    }

    scrollElementBelowHeader(element, options = {}) {
        if (!element) {
            return;
        }

        const header = document.querySelector('header');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const gap = options.gap ?? 20;
        const top = window.scrollY + element.getBoundingClientRect().top - headerHeight - gap;

        window.scrollTo({
            top: Math.max(0, top),
            behavior: options.behavior || 'smooth'
        });
    }

    getStoryBubbleResources(resources) {
        // Show one bubble per category (Immigration, Jobs, Housing, etc.) using category labels.
        // This keeps the header consistent instead of swapping "Immigration" for the first resource's title.
        const bubbles = [];

        STORY_BUBBLE_PREVIEW_CATEGORIES.forEach((category) => {
            const config = RESOURCE_CATEGORY_CONFIG[category];
            if (!config) {
                return;
            }

            bubbles.push({
                id: `bubble-${category}`,
                type: 'resource',
                title: config.labelEn,
                titleEn: config.labelEn,
                titleEs: config.labelEs,
                category: 'resource',
                resourceCategory: category,
                resourceIcon: config.icon,
                isPreviewBubble: true
            });
        });

        return bubbles;
    }

    createResourceStoryBubble(resource) {
        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const isPreviewBubble = resource.isPreviewBubble === true;
        const categoryKey = this.getResourceCategoryKey(resource);
        const url = this.getResourceUrl(resource);
        const description = this.escapeHtml(resource.description || '');

        if (isPreviewBubble) {
            return `
                <button
                    type="button"
                    class="resource-story-bubble preview-story-bubble story-${categoryKey}"
                    data-resource-shortcut="${this.escapeAttribute(categoryKey)}"
                    title="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                    aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                >
                    <span class="resource-story-ring">
                        <span class="resource-story-icon" aria-hidden="true">
                            ${this.getResourceIconSvg(resource)}
                        </span>
                    </span>
                    <span class="resource-story-copy">
                        <strong>${this.escapeHtml(titleEn)}</strong>
                        <small>${this.escapeHtml(titleEs)}</small>
                    </span>
                </button>
            `;
        }

        return `
            <a
                class="resource-story-bubble story-${categoryKey}"
                href="${this.escapeAttribute(url)}"
                target="_blank"
                rel="noopener"
                title="${this.escapeAttribute(titleEn)}"
                aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
            >
                <span class="resource-story-ring">
                    <span class="resource-story-icon" aria-hidden="true">
                        ${this.getResourceIconSvg(resource)}
                    </span>
                </span>
                <span class="resource-story-copy">
                    <strong>${this.escapeHtml(titleEn)}</strong>
                    <small>${this.escapeHtml(titleEs)}</small>
                </span>
                ${description ? `<span class="sr-only">${description}</span>` : ''}
            </a>
        `;
    }

    createResourceCard(resource) {
        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const categoryKey = this.getResourceCategoryKey(resource);
        const categoryConfig = this.getResourceCategoryConfig(resource);
        const description = resource.description ? this.escapeHtml(resource.description) : '';
        const url = this.getResourceUrl(resource);

        // Parse highlights for quick-scan bullet points
        const highlights = this.parseResourceHighlights(resource.highlights);
        const highlightsHtml = highlights.length > 0
            ? `<span class="resource-card-highlights">
                ${highlights.map(h => `<span class="resource-card-highlight">${this.escapeHtml(h)}</span>`).join('')}
               </span>`
            : '';

        return `
            <div class="resource-card-wrapper">
                <a
                    class="resource-card resource-card-${categoryKey}"
                    href="${this.escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener"
                    data-analytics-action="resource_open"
                    data-analytics-post-id="${this.escapeAttribute(resource.id || '')}"
                    data-analytics-category="${this.escapeAttribute(categoryKey)}"
                    data-analytics-content-type="resource"
                    aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                >
                    <span class="resource-card-icon" aria-hidden="true">
                        ${this.getResourceIconSvg(resource)}
                    </span>
                    <span class="resource-card-body">
                        <span class="resource-card-category">
                            <span class="resource-card-category-pill">${this.escapeHtml(categoryConfig.labelEn)}</span>
                            <span class="resource-card-category-pill">${this.escapeHtml(categoryConfig.labelEs)}</span>
                        </span>
                        <span class="resource-card-title">${this.escapeHtml(titleEn)}</span>
                        <span class="resource-card-subtitle">${this.escapeHtml(titleEs)}</span>
                        ${description ? `<span class="resource-card-description">${description}</span>` : ''}
                        ${highlightsHtml}
                    </span>
                    <span class="resource-card-link" aria-hidden="true">Open</span>
                </a>
                <button
                    type="button"
                    class="resource-copy-btn"
                    data-url="${this.escapeAttribute(url)}"
                    aria-label="Copy link"
                    title="Copy link"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    parseResourceHighlights(highlights) {
        if (!highlights) return [];
        if (Array.isArray(highlights)) return highlights.slice(0, 3);
        if (typeof highlights === 'string') {
            return highlights.split(',').map(h => h.trim()).filter(Boolean).slice(0, 3);
        }
        return [];
    }

    getPostBulletins(bulletins = this.bulletins) {
        return bulletins.filter((bulletin) => !this.isResourceBulletin(bulletin));
    }

    /** Posts hidden from the default main feed still appear on Calendar / Home upcoming when they have dates. */
    isMainFeedDiscoveryOverridden() {
        const category = this.currentFeedCategory || 'all';
        if (category !== 'all') {
            return true;
        }
        return this.areFiltersApplied();
    }

    isVisibleOnMainFeed(bulletin) {
        if (!bulletin || bulletin.hideFromMainFeed !== true) {
            return true;
        }
        return this.isMainFeedDiscoveryOverridden();
    }

    getPublishedResources() {
        const publishedResources = [...this.bulletins]
            .filter((bulletin) => this.isResourceBulletin(bulletin) && bulletin.isPublished !== false)
            .sort((a, b) => {
                if ((a.isPinned ? 1 : 0) !== (b.isPinned ? 1 : 0)) {
                    return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
                }

                const orderA = this.getResourceOrder(a);
                const orderB = this.getResourceOrder(b);
                if (orderA !== orderB) {
                    return orderA - orderB;
                }

                return this.getTimestampValue(b.datePosted || b.createdAt) - this.getTimestampValue(a.datePosted || a.createdAt);
            });

        const existingIds = new Set(publishedResources.map((resource) => resource.id));
        const demoResources = DEMO_RESOURCES.filter((resource) => !existingIds.has(resource.id));
        return [...demoResources, ...publishedResources];
    }

    isResourceBulletin(bulletin) {
        return bulletin && bulletin.type === 'resource';
    }

    getResourceOrder(resource) {
        if (resource.resourceOrder === '' || resource.resourceOrder === null || resource.resourceOrder === undefined) {
            return Number.MAX_SAFE_INTEGER;
        }

        const numericOrder = Number(resource.resourceOrder);
        return Number.isFinite(numericOrder) ? numericOrder : Number.MAX_SAFE_INTEGER;
    }

    /**
     * Parse HTML date fields stored as YYYY-MM-DD in the user's local calendar.
     * `new Date('YYYY-MM-DD')` alone is UTC midnight and shifts the weekday in US timezones.
     */
    parseStoredYmdLocal(value) {
        if (!value || typeof value !== 'string') {
            return null;
        }
        const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) {
            return null;
        }
        const y = Number(m[1]);
        const month = Number(m[2]) - 1;
        const d = Number(m[3]);
        const date = new Date(y, month, d);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    getTimestampValue(value) {
        if (!value) {
            return 0;
        }

        if (typeof value.toDate === 'function') {
            return value.toDate().getTime();
        }

        if (typeof value === 'string') {
            const localDay = this.parseStoredYmdLocal(value);
            if (localDay) {
                return localDay.getTime();
            }
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    }

    formatPostedDate(value) {
        const timestamp = this.getTimestampValue(value);
        if (!timestamp) {
            return 'Recently posted';
        }

        return new Date(timestamp).toLocaleDateString();
    }

    getResourceCategoryKey(resource) {
        return RESOURCE_CATEGORY_CONFIG[resource.resourceCategory] ? resource.resourceCategory : 'resource';
    }

    getResourceCategoryKeys(resource) {
        const rawValues = [
            resource.resourceCategory,
            resource.category,
            ...(Array.isArray(resource.categories) ? resource.categories : []),
            ...(Array.isArray(resource.tags) ? resource.tags : [])
        ];

        if (typeof resource.categories === 'string') {
            rawValues.push(...resource.categories.split(','));
        }

        if (typeof resource.tags === 'string') {
            rawValues.push(...resource.tags.split(','));
        }

        return [...new Set(rawValues
            .filter(Boolean)
            .map((value) => {
                const normalized = this.normalizeFeedCategory(String(value).trim().toLowerCase());
                return normalized === 'job' ? 'jobs' : normalized === 'childcare' ? 'family' : normalized;
            })
            .filter(Boolean))];
    }

    resourceMatchesCategory(resource, category) {
        const normalized = this.normalizeFeedCategory(category);
        const resourceCategory = normalized === 'job' ? 'jobs' : normalized === 'childcare' ? 'family' : normalized;
        return this.getResourceCategoryKeys(resource).includes(resourceCategory);
    }

    getBulletinCategoryKeys(bulletin) {
        const rawValues = [
            bulletin.category,
            bulletin.resourceCategory,
            bulletin.classType,
            ...(Array.isArray(bulletin.categories) ? bulletin.categories : []),
            ...(Array.isArray(bulletin.tags) ? bulletin.tags : [])
        ];

        if (typeof bulletin.categories === 'string') {
            rawValues.push(...bulletin.categories.split(','));
        }

        if (typeof bulletin.tags === 'string') {
            rawValues.push(...bulletin.tags.split(','));
        }

        const normalized = rawValues
            .filter(Boolean)
            .map((value) => this.normalizeFeedCategory(String(value).trim().toLowerCase()))
            .filter(Boolean);

        if (normalized.includes('training')) {
            normalized.push('job');
        }
        if (normalized.includes('healthcare')) {
            normalized.push('health');
        }
        if (normalized.includes('english') || normalized.includes('english class')) {
            normalized.push('esol');
        }
        if (normalized.includes('career-fair')) {
            normalized.push('job');
        }

        return [...new Set(normalized)];
    }

    bulletinMatchesCategory(bulletin, category) {
        const normalizedCategory = this.normalizeFeedCategory(category);
        return this.getBulletinCategoryKeys(bulletin).includes(normalizedCategory);
    }

    getResourceCategoryConfig(resource) {
        return RESOURCE_CATEGORY_CONFIG[this.getResourceCategoryKey(resource)] || {
            labelEn: 'Resource',
            labelEs: 'Recurso',
            icon: 'globe'
        };
    }

    getResourceTitles(resource) {
        const categoryConfig = this.getResourceCategoryConfig(resource);
        const titleEn = resource.titleEn || resource.title || categoryConfig.labelEn;
        const titleEs = resource.titleEs || resource.subtitle || categoryConfig.labelEs || titleEn;
        return { titleEn, titleEs };
    }

    getResourceUrl(resource) {
        const rawUrl = (resource.url || resource.eventLink || '').trim();
        if (!rawUrl) {
            return '#';
        }

        return /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    }

    getResourceIconSvg(resource) {
        const categoryConfig = this.getResourceCategoryConfig(resource);
        const iconKey = resource.resourceIcon && resource.resourceIcon !== 'auto'
            ? resource.resourceIcon
            : categoryConfig.icon;

        return RESOURCE_ICON_SVGS[iconKey] || RESOURCE_ICON_SVGS.globe;
    }

    handleHashRouting() {
        const hash = window.location.hash;

        if (hash && hash.startsWith('#bulletin-')) {
            const bulletinId = hash.replace('#bulletin-', '');
            if (this.currentView !== 'feed') {
                this.switchView('feed', { skipRender: true, preserveDetail: true });
            }
            this.focusBulletinFromHash();
            this.showBulletinDetail(bulletinId);
        } else {
            this.closeBulletinDetail(false);
        }
    }

    focusBulletinFromHash() {
        const hash = window.location.hash;
        if (!hash || !hash.startsWith('#bulletin-')) {
            return;
        }

        const targetCard = document.querySelector(hash);
        if (!targetCard) {
            return;
        }

        // Apply highlight effect
        targetCard.classList.add('hash-highlight');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            targetCard.classList.remove('hash-highlight');
        }, 2800);

        this.lastHashHighlight = hash;
    }

    showBulletinDetail(bulletinId) {
        const modal = document.getElementById('bulletinDetailModal');
        const body = document.getElementById('bulletinDetailBody');
        if (!modal || !body) {
            return;
        }

        const bulletin = this.getPostBulletins(this.bulletins).find(b => b.id === bulletinId)
            || SCHOOL_CALENDAR_ANCHORS.find((b) => b.id === bulletinId);

        if (!bulletin) {
            body.innerHTML = `<div class="detail-card"><p>This bulletin is no longer available.</p></div>`;
        } else {
            if (!bulletin.isSchoolCalendarAnchor) {
                trackStudentEvent('detail_open', {
                    postId: bulletin.id,
                    category: bulletin.category,
                    contentType: bulletin.type || 'post'
                });
            }
            body.innerHTML = this.renderBulletinDetail(bulletin);
        }

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    closeBulletinDetail(updateHash = true) {
        const modal = document.getElementById('bulletinDetailModal');
        if (!modal) {
            return;
        }

        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');

        if (updateHash && window.location.hash.startsWith('#bulletin-')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    showDayEvents(bulletins) {
        const modal = document.getElementById('bulletinDetailModal');
        const body = document.getElementById('bulletinDetailBody');
        if (!modal || !body) {
            return;
        }

        // Create a list view of all events for this day
        const bulletinsList = bulletins.map(bulletin => {
            const isExpired = this.isBulletinExpired(bulletin);
            return `
                <div class="day-event-item ${isExpired ? 'expired' : ''}" onclick="event.stopPropagation(); bulletinBoard.showBulletinDetail('${bulletin.id}')">
                    <div class="day-event-header">
                        <h3 class="day-event-title">${this.escapeHtml(bulletin.title)}</h3>
                        <span class="category-badge category-${bulletin.category}">${this.getCategoryDisplay(bulletin.category)}</span>
                    </div>
                    ${bulletin.description ? `<p class="day-event-description">${this.escapeHtml(bulletin.description.substring(0, 150))}${bulletin.description.length > 150 ? '...' : ''}</p>` : ''}
                    <p class="day-event-meta">Posted by ${this.escapeHtml(bulletin.advisorName)}</p>
                    ${isExpired ? '<span class="expired-label">EXPIRED</span>' : ''}
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div class="detail-card">
                <h2 style="margin-bottom: 20px;">Events on this day (${bulletins.length})</h2>
                <div class="day-events-list">
                    ${bulletinsList}
                </div>
                <div class="detail-actions" style="margin-top: 24px;">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    getCatMeta(category) {
        const map = {
            job:           { accent: '#1f3d7a', tint: '#dbeafe', grad: 'linear-gradient(145deg,#c7deff 0%,#e8f2ff 100%)', label: 'Jobs',         labelEs: 'Empleos',        badge: 'JOBS' },
            training:      { accent: '#7b4ec7', tint: '#ede9fe', grad: 'linear-gradient(145deg,#ddd6fe 0%,#ede9fe 100%)', label: 'Training',      labelEs: 'Capacitación',   badge: 'FREE' },
            college:       { accent: '#0a1d3a', tint: '#dde2eb', grad: 'linear-gradient(145deg,#c9d4e8 0%,#dde2eb 100%)', label: 'College',       labelEs: 'Universidad',    badge: 'APPLY' },
            immigration:   { accent: '#0d8a7a', tint: '#ccfbf1', grad: 'linear-gradient(145deg,#99f6e4 0%,#ccfbf1 100%)', label: 'Immigration',   labelEs: 'Inmigración',    badge: 'FREE' },
            housing:       { accent: '#b91c1c', tint: '#fee2e2', grad: 'linear-gradient(145deg,#fca5a5 0%,#fecaca 100%)', label: 'Housing',       labelEs: 'Vivienda',       badge: 'FREE HELP' },
            health:        { accent: '#be185d', tint: '#fce7f3', grad: 'linear-gradient(145deg,#f9a8d4 0%,#fce7f3 100%)', label: 'Health',        labelEs: 'Salud',          badge: 'FREE' },
            food:          { accent: '#166534', tint: '#dcfce7', grad: 'linear-gradient(145deg,#86efac 0%,#dcfce7 100%)', label: 'Food',          labelEs: 'Comida',         badge: 'FREE' },
            childcare:     { accent: '#92400e', tint: '#fef3c7', grad: 'linear-gradient(145deg,#fde68a 0%,#fef3c7 100%)', label: 'Family',        labelEs: 'Familia',        badge: 'FREE' },
            esol:          { accent: '#6d28d9', tint: '#ede9fe', grad: 'linear-gradient(145deg,#c4b5fd 0%,#ede9fe 100%)', label: 'ESOL',          labelEs: 'Inglés',         badge: 'FREE' },
            'career-fair': { accent: '#b45309', tint: '#ffedd5', grad: 'linear-gradient(145deg,#fed7aa 0%,#ffedd5 100%)', label: 'Career Fair',   labelEs: 'Feria de Empleo',badge: 'FREE' },
            money:         { accent: '#065f46', tint: '#d1fae5', grad: 'linear-gradient(145deg,#6ee7b7 0%,#d1fae5 100%)', label: 'Money Help',    labelEs: 'Ayuda Económica',badge: 'FREE' },
            announcement:  { accent: '#1d4ed8', tint: '#dbeafe', grad: 'linear-gradient(145deg,#93c5fd 0%,#dbeafe 100%)', label: 'Announcements', labelEs: 'Anuncios',       badge: 'INFO' },
            resource:      { accent: '#1d4ed8', tint: '#dbeafe', grad: 'linear-gradient(145deg,#93c5fd 0%,#dbeafe 100%)', label: 'Resource',      labelEs: 'Recurso',        badge: 'INFO' },
        };
        return map[category] || { accent: '#1d4ed8', tint: '#dbeafe', grad: 'linear-gradient(145deg,#93c5fd 0%,#dbeafe 100%)', label: category, labelEs: category, badge: 'INFO' };
    }

    getCardIconSvg(category) {
        const icons = {
            job: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`,
            immigration: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
            housing: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
            health: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
            food: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
            esol: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            training: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
            college: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
            'career-fair': `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            money: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
            childcare: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
            announcement: `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="38" height="38"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
        };
        return icons[category] || icons.announcement;
    }

    createHeroSvg(category) {
        const palettes = {
            job:           { top: '#7eb1ff', bot: '#e1e9f7', sun: '#ffc857', fg1: '#1f3d7a', fg2: '#5a7bb7' },
            training:      { top: '#b89bea', bot: '#ece4f9', sun: '#fff',    fg1: '#7b4ec7', fg2: '#c4afe7' },
            college:       { top: '#5a7bb7', bot: '#dde2eb', sun: '#ffc857', fg1: '#0a1d3a', fg2: '#3a4f78' },
            immigration:   { top: '#5fc4b3', bot: '#cfeee8', sun: '#fff',    fg1: '#0d8a7a', fg2: '#7fd4c6' },
            housing:       { top: '#f0a78f', bot: '#fbdcd1', sun: '#fff8eb', fg1: '#d96a4a', fg2: '#f5b7a3' },
            health:        { top: '#f0a3bd', bot: '#fbd6e3', sun: '#fff',    fg1: '#e0497d', fg2: '#f0a3bd' },
            food:          { top: '#7cc795', bot: '#cfead9', sun: '#ffc857', fg1: '#2d8a4a', fg2: '#9bd5af' },
            childcare:     { top: '#e0bb7a', bot: '#f5e3c4', sun: '#fff',    fg1: '#c08a3e', fg2: '#e0bb7a' },
            esol:          { top: '#b89bea', bot: '#ece4f9', sun: '#fff',    fg1: '#7b4ec7', fg2: '#c4afe7' },
            'career-fair': { top: '#f5c285', bot: '#fbe6cc', sun: '#fff',    fg1: '#e88a2a', fg2: '#f5c285' },
            money:         { top: '#6dcfa9', bot: '#cfeee0', sun: '#ffc857', fg1: '#1aa37a', fg2: '#9fdcc4' },
            announcement:  { top: '#a9c8ff', bot: '#dde9ff', sun: '#fff8eb', fg1: '#7eb1ff', fg2: '#dde9ff' },
            resource:      { top: '#a9c8ff', bot: '#dde9ff', sun: '#fff8eb', fg1: '#7eb1ff', fg2: '#dde9ff' },
        };
        const p = palettes[category] || palettes.announcement;
        const id = `hg-${category}-${Math.random().toString(36).slice(2, 6)}`;
        return `<svg viewBox="0 0 400 160" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%" preserveAspectRatio="xMidYMid slice">
            <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${p.top}"/><stop offset="100%" stop-color="${p.bot}"/></linearGradient></defs>
            <rect width="400" height="160" fill="url(#${id})"/>
            <circle cx="320" cy="44" r="22" fill="${p.sun}" opacity="0.9"/>
            <path d="M0 110 Q80 88 160 104 T320 104 T480 100 L480 160 L0 160 Z" fill="${p.fg1}"/>
            <path d="M0 128 Q100 112 200 122 T400 118 L400 160 L0 160 Z" fill="${p.fg2}"/>
        </svg>`;
    }

    createBulletinCard(bulletin, index = 0) {
        const meta = this.getCatMeta(bulletin.category);
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);
        const postedAgo = this.formatPostedDate(bulletin.datePosted);
        const title = bulletin.title || '';
        const titleShort = title.length > 40 ? title.substring(0, 38) + '…' : title;
        const desc = bulletin.description || '';
        const descShort = desc.length > 110 ? desc.substring(0, 108) + '…' : desc;

        const dateLabel = (() => {
            if (bulletin.deadline) {
                const d = this.parseStoredYmdLocal(String(bulletin.deadline).split('T')[0]) || new Date(bulletin.deadline);
                const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return `Apply by ${label}`;
            }
            if (bulletin.eventDate) {
                const d = this.parseStoredYmdLocal(String(bulletin.eventDate).split('T')[0]) || new Date(bulletin.eventDate);
                return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) + (bulletin.startTime ? ` · ${bulletin.startTime}` : '');
            }
            return null;
        })();

        const openHandler = `window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${bulletin.id}')`;

        const featuredClass = !bulletin.image && index % 7 === 0 ? 'pc--featured' : '';

        return `
    <article class="pc ${featuredClass} ${isExpired ? 'pc--expired' : ''}" id="bulletin-${bulletin.id}" data-bulletin-id="${bulletin.id}" onclick="${openHandler}" role="button" tabindex="0" style="cursor:pointer">
      <div class="pc__top ${bulletin.image ? 'pc__top--image' : ''}" style="background:${bulletin.image ? '#f8fafc' : meta.grad}">
        ${bulletin.image
          ? `<div class="pc__image-stage"><img class="pc__poster-image lightbox-trigger" data-lightbox-src="${this.escapeAttribute(bulletin.image)}" src="${this.escapeAttribute(bulletin.image)}" alt=""></div>`
          : `<div class="pc__icon-wrap"><div class="pc__icon-box" style="background:${meta.accent}">${this.getCardIconSvg(bulletin.category)}</div></div>
        <div class="pc__title-overlay">${this.escapeHtml(titleShort)} —</div>`}
      </div>

      <div class="pc__body">
        <div class="pc__chips" role="list">
          <span class="pc__chip pc__chip--category" role="listitem" style="--chip-accent:${meta.accent};--chip-tint:${meta.tint}">
            <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
            <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
          </span>
          ${isExpired ? '<span class="pc__chip pc__chip--expired" role="listitem">Expired</span>' : ''}
        </div>
        <h3 class="pc__title">${this.escapeHtml(title)}</h3>
        <p class="pc__desc">${this.escapeHtml(descShort)}</p>

        ${dateLabel ? `
        <div class="pc__date ${isDeadlineClose && !isExpired ? 'pc__date--urgent' : ''}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>${this.escapeHtml(dateLabel)}</span>
        </div>` : ''}

        <div class="pc__footer">
          <div class="pc__foot-left">
            <span class="pc__foot-name">${this.escapeHtml(bulletin.advisorName || 'Advisor')} · ${postedAgo}</span>
          </div>
          <span class="pc__open-btn" style="color:${meta.accent}">Open →</span>
        </div>
      </div>
    </article>
        `;
    }

    _unused_createBulletinCard_v1(bulletin) {
        const postedDate = this.formatPostedDate(bulletin.datePosted);
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);

        const descriptionHtml = this.renderFormattedDescription(bulletin.description || '', bulletin.id, true);

        return `
            <div class="bulletin-card ${isExpired ? 'expired-bulletin' : ''}" id="bulletin-v1-${bulletin.id}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
                <div class="bulletin-actions">
                    <div class="bulletin-action-buttons">
                        ${bulletin.pdfUrl ? `
                            <button type="button" class="pdf-btn" title="View PDF document" aria-label="View PDF document for ${this.escapeHtml(bulletin.title)}" onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}')">
                                📄 View PDF
                            </button>
                        ` : ''}
                        <button class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    renderBulletinDetail(bulletin) {
        const meta = this.getCatMeta(bulletin.category);
        const postedDate = this.formatPostedDate(bulletin.datePosted);
        const importantDate = this.getDetailImportantDate(bulletin);
        const isDeadlineClose = importantDate && importantDate.kind === 'deadline' && this.isDeadlineClose(importantDate.raw);
        const isExpired = this.isBulletinExpired(bulletin);
        const initial = (bulletin.advisorName || '?').charAt(0).toUpperCase();
        const omitAuthorPostedDate =
            importantDate && (importantDate.kind === 'event' || importantDate.kind === 'start');
        const authorHtml = bulletin.isSchoolCalendarAnchor
            ? '<strong>School Calendar</strong>'
            : omitAuthorPostedDate
                ? `<strong>${this.escapeHtml(bulletin.advisorName || 'Advisor')}</strong>`
                : `<strong>${this.escapeHtml(bulletin.advisorName || 'Advisor')}</strong> · ${postedDate}`;
        const descriptionHtml = bulletin.description ? this.renderFormattedDescription(bulletin.description, `${bulletin.id}-detail`) : '';
        const tagValues = [bulletin.classType ? this.getClassTypeDisplay(bulletin.classType) : '', bulletin.company || '', bulletin.eventLocation || '']
            .filter(Boolean)
            .slice(0, 3);
        const contactAction = this.getDetailContactAction(bulletin);
        const heroContent = bulletin.image
            ? `<img class="post-detail-hero-image lightbox-trigger" data-lightbox-src="${this.escapeAttribute(bulletin.image)}" src="${this.escapeAttribute(bulletin.image)}" alt="">`
            : `<div class="post-detail-hero-art" style="--detail-accent:${meta.accent};--detail-tint:${meta.tint}">
                <div class="post-detail-sun"></div>
                <div class="post-detail-wave post-detail-wave-one"></div>
                <div class="post-detail-wave post-detail-wave-two"></div>
                <div class="post-detail-icon" style="background:${meta.accent}">${this.getCardIconSvg(bulletin.category)}</div>
            </div>`;

        return `
            <article class="post-detail-page" style="--detail-accent:${meta.accent};--detail-tint:${meta.tint}">
                <section class="post-detail-hero ${bulletin.image ? 'post-detail-hero--image' : 'post-detail-hero--art-only'}" aria-hidden="true">
                    ${heroContent}
                </section>
                <section class="post-detail-panel">
                    <p class="post-detail-category" style="color:${meta.accent}">
                        <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
                    </p>
                    <h2>${this.escapeHtml(bulletin.title || '')}</h2>
                    ${isExpired ? '<p class="post-detail-expired">Expired</p>' : ''}
                    <div class="post-detail-author">
                        <span class="post-detail-avatar" style="background:${meta.accent}">${this.escapeHtml(initial)}</span>
                        <span>${authorHtml}</span>
                    </div>
                    ${importantDate ? `
                        <div class="post-detail-date ${isDeadlineClose && !isExpired ? 'post-detail-date--urgent' : ''}">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            <span>
                                <strong>Important date</strong>
                                <small>${this.escapeHtml(importantDate.label)}</small>
                            </span>
                        </div>
                    ` : ''}
                    ${descriptionHtml ? `<div class="post-detail-description">${descriptionHtml}</div>` : ''}
                    ${tagValues.length ? `<div class="post-detail-tags">${tagValues.map((tag) => `<span>${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    ${bulletin.contact ? `<div class="post-detail-contact-note">${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}</div>` : ''}
                    <div class="post-detail-actions">
                        ${contactAction ? `
                            <a href="${this.escapeAttribute(contactAction.href)}" class="post-detail-action post-detail-action--primary">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                                <span><strong>${this.escapeHtml(contactAction.label)}</strong><small>${this.escapeHtml(contactAction.value)}</small></span>
                            </a>
                        ` : ''}
                        ${bulletin.pdfUrl ? `
                            <button type="button" class="post-detail-action post-detail-action--outline" onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}')">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                                <span><strong>View PDF</strong><small>Open attachment</small></span>
                            </button>
                        ` : ''}
                        ${bulletin.eventLink ? `
                            <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener" class="post-detail-action post-detail-action--outline" data-analytics-action="link_click" data-analytics-post-id="${this.escapeAttribute(bulletin.id)}" data-analytics-category="${this.escapeAttribute(bulletin.category)}" data-analytics-content-type="post">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                                <span><strong>${this.escapeHtml(this.getDetailLinkActionLabel(bulletin.category))}</strong><small>${this.escapeHtml(this.getDisplayHost(bulletin.eventLink))}</small></span>
                            </a>
                        ` : ''}
                        <button type="button" class="post-detail-action post-detail-action--share" onclick="shareBulletin('${bulletin.id}','${this.escapeHtml(bulletin.title || '').replace(/'/g,"&#39;")}')">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                            <strong>Share with a friend</strong>
                        </button>
                    </div>
                </section>
            </article>
        `;
    }

    getDetailImportantDate(bulletin) {
        const item = this.getDatesListItem(bulletin);
        if (!item) return null;

        return {
            raw: item.rawDate,
            date: item.date,
            kind: item.kind,
            label: item.label
        };
    }

    getDetailContactAction(bulletin) {
        const source = [bulletin.phone, bulletin.contact].filter(Boolean).join(' ');
        const phoneMatch = source.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

        if (!phoneMatch) return null;

        const phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
        const tel = phone.replace(/[^0-9+]/g, '');

        return {
            href: `tel:${tel}`,
            label: bulletin.category === 'job' ? 'Call hiring' : 'Call',
            value: phone
        };
    }

    getDetailLinkActionLabel(category) {
        const labels = {
            job: 'Apply online',
            training: 'Sign up online',
            college: 'Apply online',
            'career-fair': 'Event details',
            resource: 'Open resource',
            announcement: 'More info'
        };

        return labels[category] || 'Open link';
    }

    getDisplayHost(url) {
        if (!url) return '';

        try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '');
        } catch (error) {
            return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        }
    }

    _unused_renderBulletinDetail_v1(bulletin) {
        const isExpired = this.isBulletinExpired(bulletin);
        return `
            <article class="detail-card ${isExpired ? 'expired-bulletin' : ''}" id="detail-${bulletin.id}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
                <div class="detail-header">
                    <div>
                        <div class="detail-title">${this.escapeHtml(bulletin.title)}</div>
                    </div>
                    <span class="category-badge category-${bulletin.category}">${this.getCategoryDisplay(bulletin.category)}</span>
                </div>

                ${bulletin.image ? `
                    <div class="detail-image">
                        <img class="lightbox-trigger" data-lightbox-src="${bulletin.image}" src="${bulletin.image}" alt="Bulletin image for ${this.escapeHtml(bulletin.title)}">
                    </div>
                ` : ''}

                <div class="detail-body">
                    ${bulletin.description ? this.renderFormattedDescription(bulletin.description, `${bulletin.id}-detail`) : ''}

                        ${bulletin.company ? `
                            <p><strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}</p>
                        ` : ''}

                        ${bulletin.eventTime ? `
                            <p><strong>Time:</strong> ${this.escapeHtml(this.formatEventTime(bulletin.eventTime))}</p>
                        ` : ''}

                        ${bulletin.classType ? `
                            <p><strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}</p>
                        ` : ''}

                        ${bulletin.contact ? `
                            <p><strong>Contact:</strong><br>${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}</p>
                        ` : ''}

                        ${bulletin.eventLink ? `
                            <p><strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(bulletin.eventLink, bulletin.category))}</a></p>
                        ` : ''}
                    </div>

                <div class="detail-meta">
                    ${this.renderDetailDateInfo(bulletin)}
                    <div><strong>Posted:</strong> ${postedDate}</div>
                </div>

                <div class="detail-actions">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                    ${bulletin.pdfUrl ? `
                        <button type="button" class="pdf-btn" title="View PDF" onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}')">
                            📄 PDF
                        </button>
                    ` : ''}
                    <button type="button" class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">📤 Share</button>
                </div>
            </article>
        `;
    }

    // Filter and Search Methods
    applyFilters() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // If on resources view, use context-aware search for resources
        if (this.currentView === 'resources') {
            this.resourceSearchQuery = searchTerm;
            this.renderResourceList(this.getPublishedResources());
            this.syncHeaderSearchButton();
            return;
        }

        let filteredBulletins = this.getPostBulletins(this.bulletins);

        if (this.selectedCategories.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedCategories.some((category) => this.bulletinMatchesCategory(b, category));
            });
        }

        if (this.selectedPostedDates.length > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedPostedDates.some(postedFilter => {
                    const postedDate = new Date(b.datePosted.toDate ? b.datePosted.toDate() : b.datePosted);
                    const postedDateOnly = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate());
                    const timeDiff = today.getTime() - postedDateOnly.getTime();
                    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                    switch (postedFilter) {
                        case 'today':
                            return daysDiff === 0;
                        case 'thisweek':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'lastweek':
                            return daysDiff > 7 && daysDiff <= 14;
                        case 'thismonth':
                            return daysDiff <= 30 && daysDiff >= 0;
                        case 'lastmonth':
                            return daysDiff > 30 && daysDiff <= 60;
                        default:
                            return true;
                    }
                });
            });
        }

        if (this.selectedDeadlines.length > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedDeadlines.some(deadlineFilter => {
                    if (deadlineFilter === 'nodate') {
                        return !b.deadline;
                    }

                    if (!b.deadline) return false;

                    const deadline = this.parseStoredYmdLocal(String(b.deadline).split('T')[0]) || new Date(b.deadline);
                    const timeDiff = deadline.getTime() - today.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    switch (deadlineFilter) {
                        case 'soon':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'thisweek':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'thismonth':
                            return daysDiff <= 30 && daysDiff >= 0;
                        default:
                            return true;
                    }
                });
            });
        }

        if (this.selectedClassTypes.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedClassTypes.includes(b.classType);
            });
        }

        if (this.selectedPostedBy.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedPostedBy.includes(b.advisorName);
            });
        }

        if (searchTerm) {
            filteredBulletins = filteredBulletins.filter(b => {
                const description = (b.description || '').toLowerCase();
                const company = (b.company || '').toLowerCase();
                const contact = (b.contact || '').toLowerCase();
                const eventLink = (b.eventLink || '').toLowerCase();
                const advisorName = (b.advisorName || '').toLowerCase();
                const title = (b.title || '').toLowerCase();
                return (
                    title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    company.includes(searchTerm) ||
                    contact.includes(searchTerm) ||
                    eventLink.includes(searchTerm) ||
                    advisorName.includes(searchTerm)
                );
            });
        }

        const showExpiredToggle = document.getElementById('showExpiredToggle');

        if (showExpiredToggle && !showExpiredToggle.checked) {
            filteredBulletins = filteredBulletins.filter(b => {
                return !this.isBulletinExpired(b);
            });
        }

        this.displayBulletins(filteredBulletins);
    }

    clearFilters() {
        const searchInput = document.getElementById('searchInput');
        const heroInput = document.getElementById('heroSearchInput');
        const desktopSearchInput = document.getElementById('desktopTopbarSearchInput');
        if (searchInput) searchInput.value = '';
        if (heroInput) heroInput.value = '';
        if (desktopSearchInput) desktopSearchInput.value = '';

        // If on resources view, clear resource search
        if (this.currentView === 'resources') {
            this.resourceSearchQuery = '';
            this.renderResourceList(this.getPublishedResources());
            this.syncHeaderSearchButton();
            return;
        }

        // Clear multi-select filters
        this.selectedCategories = [];
        this.selectedPostedDates = [];
        this.selectedDeadlines = [];
        this.selectedClassTypes = [];
        this.selectedPostedBy = [];

        // Reset expired toggle
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        if (showExpiredToggle) {
            showExpiredToggle.checked = false;
        }

        // Remove active class from all chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });

        this.updateFilterCount();
        this.displayBulletins();
        this.updateToggleFiltersLabel(false);
    }

    toggleFiltersPanel() {
        const filterControls = document.getElementById('filterControls');
        
        if (filterControls) {
            const isVisible = filterControls.style.display !== 'none';
            
            if (isVisible) {
                filterControls.style.display = 'none';
                this.updateToggleFiltersLabel(false);
            } else {
                filterControls.style.display = 'block';
                this.updateToggleFiltersLabel(true);
            }
        }
    }

    // Multi-select filter chip handler
    toggleFilterChip(chip, type) {
        chip.classList.toggle('active');

        const value = chip.dataset[type];

        if (type === 'category') {
            const index = this.selectedCategories.indexOf(value);
            if (index > -1) {
                this.selectedCategories.splice(index, 1);
            } else {
                this.selectedCategories.push(value);
            }
        } else if (type === 'posted') {
            const index = this.selectedPostedDates.indexOf(value);
            if (index > -1) {
                this.selectedPostedDates.splice(index, 1);
            } else {
                this.selectedPostedDates.push(value);
            }
        } else if (type === 'deadline') {
            const index = this.selectedDeadlines.indexOf(value);
            if (index > -1) {
                this.selectedDeadlines.splice(index, 1);
            } else {
                this.selectedDeadlines.push(value);
            }
        } else if (type === 'classtype') {
            const index = this.selectedClassTypes.indexOf(value);
            if (index > -1) {
                this.selectedClassTypes.splice(index, 1);
            } else {
                this.selectedClassTypes.push(value);
            }
        } else if (type === 'postedby') {
            const index = this.selectedPostedBy.indexOf(value);
            if (index > -1) {
                this.selectedPostedBy.splice(index, 1);
            } else {
                this.selectedPostedBy.push(value);
            }
        }

        this.updateFilterCount();
        this.applyFilters();
    }

    updateFilterCount() {
        const total = this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length + this.selectedPostedBy.length;
        const countElement = document.getElementById('filterCount');
        const countContainer = document.getElementById('activeFiltersCount');
        const toggleBtn = document.getElementById('toggleFilters');

        if (countElement && countContainer) {
            countElement.textContent = total;
            countContainer.style.display = total > 0 ? 'inline' : 'none';
        }

        // Update toggle button state
        if (toggleBtn) {
            if (total > 0) {
                toggleBtn.classList.add('active');
            } else {
                toggleBtn.classList.remove('active');
            }
        }
    }

    updateToggleFiltersLabel(isOpen) {
        const toggleBtn = document.getElementById('toggleFilters');
        if (!toggleBtn) {
            return;
        }

        const countMarkup = `
            <span id="activeFiltersCount" class="active-filters-count" style="${this.getActiveFilterCount() > 0 ? '' : 'display: none;'}">
                (<span id="filterCount">${this.getActiveFilterCount()}</span>)
            </span>
        `;

        toggleBtn.innerHTML = `<span>🔧</span> ${isOpen ? 'Hide Filters' : 'Filters'} ${countMarkup}`;
    }

    getActiveFilterCount() {
        return this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length + this.selectedPostedBy.length;
    }

    areFiltersApplied() {
        // Check if any filters are active
        const hasCategoryFilters = this.selectedCategories.length > 0;
        const hasPostedDateFilters = this.selectedPostedDates.length > 0;
        const hasDeadlineFilters = this.selectedDeadlines.length > 0;
        const hasClassTypeFilters = this.selectedClassTypes.length > 0;
        const hasPostedByFilters = this.selectedPostedBy.length > 0;
        const hasSearchTerm = document.getElementById('searchInput').value.trim() !== '';
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        // Only consider expired toggle as a filter when it's turned ON (showing expired items)
        // When OFF (default), it's the normal behavior, not a filter
        const hasExpiredFilter = showExpiredToggle && showExpiredToggle.checked;


        return hasCategoryFilters || hasPostedDateFilters || hasDeadlineFilters || hasClassTypeFilters || hasPostedByFilters || hasSearchTerm || hasExpiredFilter;
    }

    loadBulletins() {
        // This is now handled by the real-time listener
        // but we keep this method for compatibility
    }

    // Utility Methods
    getCategoryDisplay(category) {
        const categories = {
            'job': 'Job Opportunity',
            'training': 'Training/Workshop',
            'college': 'College/University',
            'career-fair': 'Career Fair',
            'immigration': 'Immigration',
            'announcement': 'General Announcement',
            'resource': 'Resource/Service'
        };
        return categories[category] || category;
    }

    getClassTypeDisplay(classType) {
        const classTypes = {
            'esol': 'ESOL (English for Speakers of Other Languages)',
            'hse': 'HSE (High School Equivalency)',
            'famlit': 'FamLit (Family Literacy)'
        };
        return classTypes[classType] || classType;
    }

    isDeadlineClose(deadline) {
        const deadlineDate = this.parseStoredYmdLocal(String(deadline).split('T')[0]) || new Date(deadline);
        const today = new Date();
        const timeDiff = deadlineDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        return daysDiff <= 7 && daysDiff >= 0;
    }

    isBulletinExpired(bulletin) {
        const now = new Date();

        // Check start/end date range expiration FIRST (highest priority)
        // This handles events that run over a period of time
        if (bulletin.startDate && bulletin.endDate) {
            const endDate = this.parseStoredYmdLocal(String(bulletin.endDate).split('T')[0]) || new Date(bulletin.endDate);
            const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
            return endOfDay < now;
        }

        // Check event-based expiration (with end time)
        if (bulletin.eventDate && bulletin.endTime) {
            // endTime is stored in 24-hour format (e.g., "14:00")
            const eventDateTime = new Date(`${bulletin.eventDate}T${bulletin.endTime}:00`);
            return eventDateTime < now;
        }

        // Check event-based expiration (without end time, assume end of day)
        if (bulletin.eventDate && !bulletin.endTime) {
            const eventDate = this.parseStoredYmdLocal(String(bulletin.eventDate).split('T')[0]) || new Date(bulletin.eventDate);
            const endOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59);
            return endOfDay < now;
        }

        // Check deadline-based expiration (lowest priority, only if no date range exists)
        if (bulletin.deadline) {
            const deadlineDay = this.parseStoredYmdLocal(String(bulletin.deadline).split('T')[0]) || new Date(bulletin.deadline);
            const endOfDay = new Date(deadlineDay.getFullYear(), deadlineDay.getMonth(), deadlineDay.getDate(), 23, 59, 59);
            return endOfDay < now;
        }

        // Not expired if no date/time information
        return false;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convert data URL to blob URL for better browser compatibility
    dataUrlToBlobUrl(dataUrl) {
        try {
            // Convert data URL to blob
            const response = fetch(dataUrl);
            return response.then(res => res.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    return blobUrl;
                });
        } catch (error) {
            console.error('Error converting data URL to blob URL:', error);
            return dataUrl; // Fallback to original data URL
        }
    }

    // Open PDF from bulletin ID by looking up the bulletin data
    async openPdfFromBulletin(bulletinId) {
        try {
            console.log('=== PDF OPENING DEBUG START ===');
            console.log('Opening PDF for bulletin ID:', bulletinId);
            console.log('Total bulletins loaded:', this.bulletins.length);

            // Find the bulletin in our current data
            const bulletin = this.bulletins.find(b => b.id === bulletinId);
            console.log('Found bulletin:', bulletin ? 'YES' : 'NO');
            
            if (!bulletin) {
                console.error('Bulletin not found in this.bulletins array');
                throw new Error('Bulletin not found.');
            }
            
            if (!bulletin.pdfUrl) {
                console.error('No PDF URL in bulletin object');
                throw new Error('PDF not found for this bulletin.');
            }

            trackStudentEvent('pdf_open', {
                postId: bulletin.id,
                category: bulletin.category,
                contentType: bulletin.type || 'post'
            });
            
            console.log('Found bulletin with PDF URL:', bulletin.pdfUrl);
            
            // Check if it's a Firebase Storage URL or base64 data URL
            if (bulletin.pdfUrl && bulletin.pdfUrl.startsWith('data:')) {
                // Handle old base64 data URLs
                console.log('Processing base64 data URL, length:', bulletin.pdfUrl.length);
                
                // Check for browser support
                if (!window.fetch || !window.URL || !window.URL.createObjectURL) {
                    throw new Error('Your browser does not support PDF viewing. Please try a modern browser.');
                }
                
                console.log('Attempting to fetch data URL...');
                const response = await fetch(bulletin.pdfUrl);
                console.log('Fetch response status:', response.status);
                console.log('Fetch response ok:', response.ok);
                
                const blob = await response.blob();
                console.log('Blob created, size:', blob.size, 'type:', blob.type);
                
                // Create blob URL
                const blobUrl = URL.createObjectURL(blob);
                console.log('Created blob URL:', blobUrl);
                
                // Open in new tab
                console.log('Attempting to open new window...');
                const newWindow = window.open(blobUrl, '_blank');
                
                // Clean up blob URL after a delay
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    console.log('Blob URL revoked');
                }, 10000);
                
                if (!newWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site.');
                }
            } else {
                // Handle Firebase Storage URLs (direct download)
                console.log('Opening Firebase Storage URL directly');
                const newWindow = window.open(bulletin.pdfUrl, '_blank');
                
                if (!newWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site.');
                }
                
                console.log('New window opened successfully');
            }
            
            console.log('=== PDF OPENING DEBUG END ===');
            
        } catch (error) {
            console.error('=== PDF OPENING ERROR ===');
            console.error('Error opening PDF:', error);
            console.error('Error stack:', error.stack);
            alert('Failed to open PDF: ' + error.message);
        }
    }

    // Legacy method - keeping for compatibility
    async openPdfFromDataUrl(dataUrl) {
        try {
            console.log('Opening PDF from data URL, length:', dataUrl.length);
            
            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Create blob URL
            const blobUrl = URL.createObjectURL(blob);
            console.log('Created blob URL:', blobUrl);
            
            // Open in new tab
            const newWindow = window.open(blobUrl, '_blank');
            
            // Clean up blob URL after a delay (browser should have loaded it by then)
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 10000); // 10 seconds
            
            if (!newWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }
            
        } catch (error) {
            console.error('Error opening PDF:', error);
            alert('Failed to open PDF. Please try again or check your browser settings.');
        }
    }

    escapeAttribute(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatLinkLabel(url, category) {
        if (!url) return '';

        const labels = {
            'job': 'Job Posting Link',
            'training': 'Training Link',
            'college': 'College/University Link',
            'career-fair': 'Event Link',
            'announcement': 'More Information',
            'resource': 'Resource Link'
        };

        return labels[category] || 'More Information';
    }

    formatEventTime(timeString) {
        if (!timeString) return '';
        try {
            const [hourStr, minuteStr] = timeString.split(':');
            let hour = parseInt(hourStr, 10);
            const minute = minuteStr || '00';
            if (isNaN(hour)) return timeString;
            const period = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${minute.padStart(2, '0')} ${period}`;
        } catch (error) {
            return timeString;
        }
    }

    renderFormattedDescription(rawText, bulletinId, collapsed = false) {
        if (!rawText) {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = rawText || '';
        const safeText = div.innerHTML;

        const formatted = this.applyInlineFormatting(safeText)
            .split(/\n{2,}/)
            .map(segment => `<p>${segment.replace(/\n/g, '<br>')}</p>`)
            .join('');

        if (!collapsed) {
            return `<div class="description-content expanded">${formatted}</div>`;
        }

        const id = bulletinId;

        return `
            <div class="description-wrapper" data-bulletin="${id}">
                <div class="description-content">${formatted}</div>
                <button type="button" class="toggle-description" data-bulletin="${id}" aria-expanded="false">Read more</button>
            </div>
        `;
    }

    formatRichText(rawText) {
        const div = document.createElement('div');
        div.textContent = rawText || '';
        return this.applyInlineFormatting(div.innerHTML);
    }

    applyInlineFormatting(html) {
        return (html || '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
    }

    handleDescriptionToggle(event) {
        const button = event.target.closest('.toggle-description');
        if (!button) {
            return;
        }

        // Get the bulletin ID and open the full modal
        const bulletinId = button.getAttribute('data-bulletin');
        if (bulletinId) {
            this.showBulletinDetail(bulletinId);
        }
    }

    renderDateInfo(bulletin) {
        // Prioritize new date structure over backward compatibility
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.startDate && bulletin.endDate))) {
            return this.renderNewDateInfo(bulletin);
        }

        // Backward compatibility - show deadline if it exists
        if (bulletin.deadline) {
            const isDeadlineClose = this.isDeadlineClose(bulletin.deadline);
            return `
                <div class="meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                    <strong>Deadline:</strong> ${this.formatDateLocal(bulletin.deadline)}
                    ${isDeadlineClose ? ' (Soon!)' : ''}
                </div>
            `;
        }

        return '';
    }

    renderNewDateInfo(bulletin) {
        const dateType = bulletin.dateType;
        let dateHtml = '';

        if (dateType === 'deadline') {
            const isClose = this.isDeadlineClose(bulletin.eventDate);
            dateHtml = `
                <div class="meta-item ${isClose ? 'deadline-warning' : ''}">
                    <strong>Application Deadline:</strong> ${this.formatDateLocal(bulletin.eventDate)}
                    ${isClose ? ' (Soon!)' : ''}
                </div>
            `;
        } else if (dateType === 'event') {
            const isClose = this.isDeadlineClose(bulletin.eventDate);
            let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            dateHtml = `
                <div class="meta-item ${isClose ? 'deadline-warning' : ''}">
                    <strong>Event Date:</strong> ${this.formatDateLocal(bulletin.eventDate)}${timeInfo ? ` at ${timeInfo}` : ''}
                    ${isClose ? ' (Soon!)' : ''}
                </div>
            `;
        } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
            let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            dateHtml = `
                <div class="meta-item">
                    <strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}
                </div>
            `;
        }

        // Add event location if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
            const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                               bulletin.eventLocation === 'online' ? 'Online' :
                               bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
            dateHtml += `
                <div class="meta-item">
                    <strong>Format:</strong> ${locationText}
                </div>
            `;
        }

        return dateHtml;
    }

    renderDetailDateInfo(bulletin) {
        // Prioritize new date structure
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.startDate && bulletin.endDate))) {
            const dateType = bulletin.dateType;
            let dateHtml = '';

            if (dateType === 'deadline') {
                const isClose = this.isDeadlineClose(bulletin.eventDate);
                dateHtml = `<div><strong>Application Deadline:</strong> <span class="${isClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.eventDate)}${isClose ? ' (Soon!)' : ''}</span></div>`;
            } else if (dateType === 'event') {
                const isClose = this.isDeadlineClose(bulletin.eventDate);
                let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
                dateHtml = `<div><strong>Event Date:</strong> <span class="${isClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.eventDate)}${timeInfo ? ` at ${timeInfo}` : ''}${isClose ? ' (Soon!)' : ''}</span></div>`;
            } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
                let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
                dateHtml = `<div><strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}</div>`;
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
                const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                                   bulletin.eventLocation === 'online' ? 'Online' :
                                   bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
                dateHtml += `<div><strong>Format:</strong> ${locationText}</div>`;
            }

            return dateHtml;
        }

        // Backward compatibility
        if (bulletin.deadline) {
            const isDeadlineClose = this.isDeadlineClose(bulletin.deadline);
            return `
                <div><strong>Deadline:</strong> <span class="${isDeadlineClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.deadline)}${isDeadlineClose ? ' (Soon!)' : ''}</span></div>
            `;
        }

        return '';
    }

    formatDateLocal(dateString) {
        if (!dateString) return '';

        const ymd = String(dateString).split('T')[0].trim();
        const local = this.parseStoredYmdLocal(ymd);
        if (local) {
            return local.toLocaleDateString();
        }

        const date = new Date(dateString);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }

    formatTimeRange(startTime, endTime) {
        if (!startTime && !endTime) return '';

        if (startTime && endTime) {
            return `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`;
        } else if (startTime) {
            return this.formatTime(startTime);
        }

        return '';
    }

    formatTime(timeString) {
        if (!timeString) return '';

        // Convert 24-hour format to 12-hour format
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    createBulletinListItem(bulletin) {
        const postedDate = new Date(bulletin.datePosted?.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);
        const descriptionHtml = this.renderFormattedDescription(bulletin.description || '', bulletin.id, true);

        return `
            <div class="bulletin-list-item ${isExpired ? 'expired-bulletin' : ''}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
                <div class="bulletin-list-category">
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                </div>

                <div class="bulletin-list-content">
                    <div class="bulletin-list-header">
                        <div class="bulletin-list-title">${this.escapeHtml(bulletin.title)}</div>
                    </div>

                    <div class="bulletin-list-description">
                        ${descriptionHtml}
                    </div>

                    <div class="bulletin-list-meta">
                        ${bulletin.company ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                            </div>
                        ` : ''}

                        ${bulletin.classType ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}
                            </div>
                        ` : ''}

                        ${bulletin.contact ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}
                            </div>
                        ` : ''}

                        ${bulletin.eventLink ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(bulletin.eventLink, bulletin.category))}</a>
                            </div>
                        ` : ''}

                        ${this.renderDateInfo(bulletin)}

                        ${bulletin.deadline ? `
                            <div class="bulletin-list-meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                                <strong>Deadline:</strong> ${this.formatDateLocal(bulletin.deadline)}
                                ${isDeadlineClose ? ' (Soon!)' : ''}
                            </div>
                        ` : ''}

                        <div class="bulletin-list-meta-item">
                            <strong>Posted:</strong> ${postedDate}
                        </div>

                        <div class="bulletin-list-meta-item">
                            <strong>By:</strong> ${this.escapeHtml(bulletin.advisorName)}
                        </div>
                    </div>

                    <div class="bulletin-list-actions">
                        ${bulletin.pdfUrl ? `
                            <button type="button" class="pdf-btn" aria-label="View PDF document for ${this.escapeHtml(bulletin.title)}" onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}')">
                                📄 View PDF
                            </button>
                        ` : ''}
                        <button type="button" class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title || '').replace(/'/g, "&#39;")}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createDatesListView(bulletins) {
        const datedItems = bulletins
            .map((bulletin) => this.getDatesListItem(bulletin))
            .filter(Boolean)
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const groups = [
            { key: 'this-week', labelEn: 'This week', labelEs: 'Esta semana', items: [] },
            { key: 'next-week', labelEn: 'Next week', labelEs: 'Próxima semana', items: [] },
            { key: 'upcoming', labelEn: 'Upcoming', labelEs: 'Próximos', items: [] },
            { key: 'past', labelEn: 'Past dates', labelEs: 'Fechas pasadas', items: [] }
        ];

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endThisWeek = new Date(todayStart);
        endThisWeek.setDate(todayStart.getDate() + (6 - todayStart.getDay()));
        endThisWeek.setHours(23, 59, 59, 999);
        const endNextWeek = new Date(endThisWeek);
        endNextWeek.setDate(endThisWeek.getDate() + 7);

        datedItems.forEach((item) => {
            if (item.date < todayStart) {
                groups[3].items.push(item);
            } else if (item.date <= endThisWeek) {
                groups[0].items.push(item);
            } else if (item.date <= endNextWeek) {
                groups[1].items.push(item);
            } else {
                groups[2].items.push(item);
            }
        });

        const visibleGroups = groups.filter((group) => group.items.length > 0);
        if (visibleGroups.length === 0) {
            return '';
        }

        return `
            <div class="dates-list-view">
                ${visibleGroups.map((group) => `
                    <section class="dates-list-group" aria-label="${this.escapeAttribute(group.labelEn)}">
                        <h2>
                            <span class="en-text">${this.escapeHtml(group.labelEn)}</span>
                            <span class="es-text">${this.escapeHtml(group.labelEs)}</span>
                        </h2>
                        <div class="dates-list-items">
                            ${group.items.map((item) => this.createDatesListCard(item)).join('')}
                        </div>
                    </section>
                `).join('')}
            </div>
        `;
    }

    getDatesListItem(bulletin) {
        let rawDate = '';
        let kind = 'date';

        if (bulletin.dateType === 'deadline' && bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'deadline';
        } else if (bulletin.dateType === 'event' && bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'event';
        } else if (bulletin.dateType === 'range' && bulletin.startDate) {
            rawDate = bulletin.startDate;
            kind = 'start';
        } else if (bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'event';
        } else if (bulletin.startDate) {
            rawDate = bulletin.startDate;
            kind = 'start';
        } else if (bulletin.deadline) {
            rawDate = bulletin.deadline;
            kind = 'deadline';
        }

        if (!rawDate) return null;

        const date = this.parseDateOnly(rawDate);
        if (!date) return null;

        return {
            bulletin,
            rawDate,
            date,
            kind,
            label: this.getDatesListLabel(bulletin, date, kind)
        };
    }

    parseDateOnly(rawDate) {
        if (!rawDate) return null;
        if (rawDate instanceof Date) return rawDate;
        if (typeof rawDate.toDate === 'function') return rawDate.toDate();
        const normalized = String(rawDate);
        const date = normalized.includes('T') ? new Date(normalized) : new Date(`${normalized}T12:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    getDatesListLabel(bulletin, date, kind) {
        const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const timeRange = this.formatTimeRange(bulletin.startTime, bulletin.endTime);

        if (kind === 'deadline') {
            return `Apply by ${dateLabel}`;
        }

        if (kind === 'start') {
            return `Starts ${dateLabel}${timeRange ? ` · ${timeRange}` : ''}`;
        }

        return `${dayLabel}${timeRange ? ` · ${timeRange}` : ''}`;
    }

    createDatesListCard(item) {
        const { bulletin, date, kind, label } = item;
        const meta = this.getCatMeta(bulletin.category);
        const title = bulletin.title || '';
        const badgeTop = kind === 'deadline' ? 'BY' : date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const badgeMain = date.getDate();
        const dotColor = kind === 'deadline' ? '#f08b1f' : meta.accent;

        return `
            <article
                class="dates-list-card"
                style="--date-accent:${meta.accent};--date-tint:${meta.tint};--date-dot:${dotColor}"
                role="button"
                tabindex="0"
                onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')}"
            >
                <div class="dates-list-badge" aria-hidden="true">
                    <span>${this.escapeHtml(badgeTop)}</span>
                    <strong>${badgeMain}</strong>
                </div>
                <div class="dates-list-copy">
                    <p class="dates-list-category" style="color:${meta.accent}">
                        <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
                    </p>
                    <h3>${this.escapeHtml(title)}</h3>
                    <p class="dates-list-label">${this.escapeHtml(label)}</p>
                </div>
                <span class="dates-list-dot" aria-hidden="true"></span>
            </article>
        `;
    }

    createCalendarView(bulletins) {
        // Filter to only show bulletins with deadlines or events
        const calendarBulletins = bulletins.filter(bulletin => {
            return bulletin.deadline || bulletin.eventDate || bulletin.startDate;
        });

        // Group bulletins by date - use event date if available, otherwise deadline
        const bulletinsByDate = {};
        calendarBulletins.forEach(bulletin => {
            let date;

            // Use event date if available, otherwise use deadline
            if (bulletin.eventDate) {
                // Add time component to prevent timezone shift
                date = new Date(bulletin.eventDate + 'T12:00:00');
            } else if (bulletin.startDate) {
                // Add time component to prevent timezone shift
                date = new Date(bulletin.startDate + 'T12:00:00');
            } else if (bulletin.deadline) {
                date = new Date(bulletin.deadline + 'T12:00:00');
            } else {
                // Skip bulletins without deadlines or events
                return;
            }

            const dateKey = date.toDateString();
            if (!bulletinsByDate[dateKey]) {
                bulletinsByDate[dateKey] = [];
            }
            bulletinsByDate[dateKey].push(bulletin);
        });

        // Get current month and year (use stored values if available)
        const today = new Date();
        const currentMonth = this.currentCalendarMonth !== undefined ? this.currentCalendarMonth : today.getMonth();
        const currentYear = this.currentCalendarYear !== undefined ? this.currentCalendarYear : today.getFullYear();
        
        // Get first day of month and number of days
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Create calendar header
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let calendarHTML = `
            <div class="monthly-calendar">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" onclick="bulletinBoard.previousMonth()" title="Previous Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <h2 class="calendar-month">${monthNames[currentMonth]} ${currentYear}</h2>
                    <button class="calendar-nav-btn" onclick="bulletinBoard.nextMonth()" title="Next Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="calendar-weekdays">
                    ${dayNames.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                </div>
                <div class="calendar-days">
        `;

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            calendarHTML += `<div class="calendar-day empty"></div>`;
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dateKey = date.toDateString();
            const dayBulletins = bulletinsByDate[dateKey] || [];
            const isToday = date.toDateString() === today.toDateString();
            
            calendarHTML += this.createMonthlyCalendarDay(day, dayBulletins, isToday);
        }

        calendarHTML += `
                </div>
            </div>
        `;

        return calendarHTML;
    }

    createMonthlyCalendarDay(day, bulletins, isToday) {
        const bulletinCount = bulletins.length;
        const hasBulletins = bulletinCount > 0;
        const clickHandler = hasBulletins ? `onclick="bulletinBoard.showDayEvents(${JSON.stringify(bulletins).replace(/"/g, '&quot;')})"` : '';

        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasBulletins ? 'has-bulletins' : ''}"
                 data-bulletin-count="${bulletinCount}"
                 ${clickHandler}
                 style="${hasBulletins ? 'cursor: pointer;' : ''}">
                <div class="calendar-day-number">
                    <span>${day}</span>
                    ${bulletinCount > 0 ? `<span class="event-count-badge">${bulletinCount}</span>` : ''}
                </div>
                <div class="calendar-day-content">
                    ${hasBulletins ? `
                        <div class="calendar-bulletins">
                            ${bulletins.slice(0, 3).map(bulletin => this.createMonthlyBulletinItem(bulletin)).join('')}
                            ${bulletins.length > 3 ? `<div class="more-bulletins">+${bulletins.length - 3} more</div>` : ''}
                        </div>
                    ` : ''}
                </div>
                ${isToday ? '<div class="today-indicator"></div>' : ''}
            </div>
        `;
    }

    createCalendarDay(date, bulletins) {
        const isToday = date.toDateString() === new Date().toDateString();
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNumber = date.getDate();

        return `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-header">
                    <div class="calendar-day-date">${dayNumber}</div>
                    <div class="calendar-day-weekday">${dayOfWeek}</div>
                </div>
                <div class="calendar-day-bulletins">
                    ${bulletins.map(bulletin => this.createCalendarBulletinItem(bulletin)).join('')}
                </div>
                ${isToday ? '<div class="today-badge">Today</div>' : ''}
            </div>
        `;
    }

    createMonthlyBulletinItem(bulletin) {
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="monthly-bulletin-item" onclick="bulletinBoard.showBulletinDetail('${bulletin.id}')">
                <div class="monthly-bulletin-category category-${bulletin.category}"></div>
                <div class="monthly-bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                ${displayDate ? `
                    <div class="monthly-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                        ${displayDate}
                    </div>
                ` : ''}
            </div>
        `;
    }

    createCalendarBulletinItem(bulletin) {
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                <div class="calendar-bulletin-category">${this.getCategoryDisplay(bulletin.category)}</div>
                <div class="calendar-bulletin-description">${this.escapeHtml(bulletin.description || '').substring(0, 100)}${bulletin.description && bulletin.description.length > 100 ? '...' : ''}</div>
                <div class="calendar-bulletin-meta">
                    ${displayDate ? `
                        <div class="calendar-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                            ${displayDate}
                            ${isDeadlineClose ? ' (Soon!)' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    checkAutoLogin() {
        // Not needed for public viewing page
    }

    // Calendar Navigation Methods
    previousMonth() {
        this.currentCalendarMonth--;
        if (this.currentCalendarMonth < 0) {
            this.currentCalendarMonth = 11;
            this.currentCalendarYear--;
        }
        console.log('📅 Previous month:', this.currentCalendarMonth, this.currentCalendarYear);
        this.displayBulletins();
    }

    nextMonth() {
        this.currentCalendarMonth++;
        if (this.currentCalendarMonth > 11) {
            this.currentCalendarMonth = 0;
            this.currentCalendarYear++;
        }
        console.log('📅 Next month:', this.currentCalendarMonth, this.currentCalendarYear);
        this.displayBulletins();
    }
}

// Share functionality
function shareBulletin(bulletinId, bulletinTitle) {
    if (window.bulletinBoard) {
        const bulletin = window.bulletinBoard.bulletins.find((item) => item.id === bulletinId);
        trackStudentEvent('share_click', {
            postId: bulletinId,
            category: bulletin ? bulletin.category : '',
            contentType: bulletin ? (bulletin.type || 'post') : 'post'
        });
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}#bulletin-${bulletinId}`;
    fallbackShare(bulletinTitle, shareUrl);
}

function fallbackShare(title, url) {
    // Ensure any existing share modal is closed before opening a new one
    closeShareModal();

    // Create share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <h3>Share This Opportunity</h3>
            <div class="share-options">
                <button onclick="shareVia('whatsapp', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option whatsapp">
                    📱 WhatsApp
                </button>
                <button onclick="shareVia('facebook', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option facebook">
                    📘 Facebook
                </button>
                <button onclick="shareVia('email', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option email">
                    ✉️ Email
                </button>
                <button onclick="shareVia('sms', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option sms">
                    💬 Text Message
                </button>
            </div>
            <div class="share-link">
                <input type="text" value="${url}" id="shareLink" readonly>
                <button onclick="copyLink()" class="copy-btn">Copy Link</button>
            </div>
            <button onclick="closeShareModal()" class="close-share">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
}

function shareVia(platform, title, url) {
    const shareUrls = {
        whatsapp: `https://wa.me/?text=${title}%20${url}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        email: `mailto:?subject=${title}&body=Check out this opportunity: ${url}`,
        sms: `sms:?body=${title} ${url}`
    };

    window.open(shareUrls[platform], '_blank');
    closeShareModal();
}

function copyLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        const copyBtn = document.querySelector('.copy-btn');
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#27ae60';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
            copyBtn.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

function closeShareModal() {
    const modal = document.querySelector('.share-modal');
    if (modal) modal.remove();
}

// Inline handlers (onclick="...") resolve on `window`; this file is an ES module, so export explicitly.
window.shareBulletin = shareBulletin;
window.shareVia = shareVia;
window.copyLink = copyLink;
window.closeShareModal = closeShareModal;

// Initialize the bulletin board when page loads
let bulletinBoard;
document.addEventListener('DOMContentLoaded', () => {
    bulletinBoard = new FirebaseBulletinBoard();
    // Expose for global access after initialization
    window.bulletinBoard = bulletinBoard;
});
