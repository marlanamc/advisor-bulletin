import { db, auth, storage } from './src/firebase.js'
import { STUDENT_ADVISOR_DIRECTORY } from './src/advisor-directory.js'
import { installClientErrorLogger } from './src/error-logger.js'
import { normalizePostCategory, getPostCategoryDisplay } from './src/feed-categories.js'
import {
    normalizeEventSessions,
    parseSessionEntry,
    formatSessionsDetailLines,
    getMultiSessionFeedSortMs,
    getNextSessionStartMs,
    getSessionEndMs,
    sessionsShareSameTime,
} from './src/event-sessions.js'
import {
    applyInlineFormatting as applyRichTextInlineFormatting,
    formatRichTextInline as renderRichTextInline,
    getRichTextPlainLength,
    normalizeRichTextMarkers,
    truncateRichText,
} from './src/rich-text.js'
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'

installClientErrorLogger('student')

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

function getDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
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
        device: getDeviceType(),
        contentType: payload.contentType || (action === 'category_click' ? 'category' : 'post')
    };

    if (payload.postId) {
        event.postId = String(payload.postId).slice(0, 160);
    }

    if (payload.category) {
        event.category = String(payload.category).slice(0, 80);
    }

    // Advisor analytics are intentionally sourced from Firestore analyticsEvents.
    return addDoc(collection(db, 'analyticsEvents'), event).catch((error) => {
        console.debug('Student analytics skipped:', error && error.code ? error.code : error);
    });
}

window.trackStudentEvent = trackStudentEvent;

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

const STORY_BUBBLE_PREVIEW_CATEGORIES = ['immigration', 'jobs', 'housing', 'health', 'food'];
const RESOURCE_TILE_CATEGORIES = ['jobs', 'immigration', 'housing', 'health', 'food', 'family', 'hse', 'college', 'legal-aid', 'money'];

const FEED_CATEGORY_CONTENT = {
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
        title: 'Job Posts',
        description: 'See advisor posts about job openings, hiring notices, resumes, and career support.',
        chips: ['Hiring Now', 'Resume Help', 'Career Support']
    },
    jobs: {
        icon: '💼',
        title: 'Job Posts',
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
        this.currentDesktopResourceTopic = 'all';
        this.resourceSearchQuery = '';
        this.resourceSortMode = 'default';
        this.datesViewMode = 'list';
        this.isSearchLayerOpen = false;
        this.trackedCardViews = new Set();
        this.activeDetailBulletinId = null;
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

    // --- bulletin cache helpers ---
    // Cache key includes the origin so localhost and prod never share state.
    static CACHE_KEY = 'ebhcs_bulletins_v1';
    static CACHE_TTL = 30 * 60 * 1000; // 30 minutes

    _readCache() {
        try {
            const raw = sessionStorage.getItem(FirebaseBulletinBoard.CACHE_KEY);
            if (!raw) return null;
            const { ts, bulletins } = JSON.parse(raw);
            if (Date.now() - ts > FirebaseBulletinBoard.CACHE_TTL) return null;
            return bulletins;
        } catch {
            return null;
        }
    }

    _writeCache(bulletins) {
        try {
            sessionStorage.setItem(
                FirebaseBulletinBoard.CACHE_KEY,
                JSON.stringify({ ts: Date.now(), bulletins })
            );
        } catch {
            // sessionStorage full or unavailable — skip silently
        }
    }

    setupRealtimeListener() {
        // Render from cache immediately so the feed appears before Firestore responds.
        const cached = this._readCache();
        if (cached && cached.length > 0) {
            this.bulletins = cached;
            this.populateAdvisorFilters();
            this.renderResourceCategoryFilters();
            this.displayBulletins();
        }

        const q = query(collection(db, 'bulletins'), where('isActive', '==', true), orderBy('datePosted', 'desc'))
        onSnapshot(q, (snapshot) => {
            this.bulletins = [];
            snapshot.forEach((doc) => {
                this.bulletins.push({
                    id: doc.id,
                    ...this.normalizeBulletin(doc.data())
                });
            });
            this._writeCache(this.bulletins);
            this.populateAdvisorFilters();
            this.renderResourceCategoryFilters();
            this.displayBulletins();
        }, (error) => {
            console.error('Error loading bulletins:', error);
            const grid = document.getElementById('bulletinGrid');
            if (grid) {
                grid.innerHTML = '<div class="feed-load-error" role="alert"><p>Could not load posts. Check your connection and try again.</p><p class="empty-state-bilingual">No se pudieron cargar las publicaciones. Comprueba tu conexión.</p></div>';
            }
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

        if (normalized.dateType === 'sessions') {
            const fallbackStart = data.startTime || '';
            const fallbackEnd = data.endTime || '';
            if (Array.isArray(data.eventDates) && data.eventDates.length) {
                normalized.eventDates = normalizeEventSessions(data.eventDates, fallbackStart, fallbackEnd);
            } else if (data.eventDate) {
                normalized.eventDates = normalizeEventSessions([data.eventDate], fallbackStart, fallbackEnd);
            } else {
                normalized.eventDates = [];
            }
            normalized.eventDate = normalized.eventDates[0]?.date || data.eventDate || '';
        }

        return normalized;
    }

    getBulletinEventSessions(bulletin) {
        if (!bulletin || bulletin.dateType !== 'sessions') return [];
        const fallbackStart = bulletin.startTime || '';
        const fallbackEnd = bulletin.endTime || '';
        if (Array.isArray(bulletin.eventDates) && bulletin.eventDates.length) {
            return normalizeEventSessions(bulletin.eventDates, fallbackStart, fallbackEnd);
        }
        if (bulletin.eventDate) {
            return normalizeEventSessions([bulletin.eventDate], fallbackStart, fallbackEnd);
        }
        return [];
    }

    getBulletinEventDates(bulletin) {
        if (!bulletin) return [];

        if (bulletin.dateType === 'sessions') {
            return this.getBulletinEventSessions(bulletin).map((session) => session.date);
        }

        if (bulletin.eventDate) {
            return [String(bulletin.eventDate).split('T')[0]];
        }
        if (bulletin.startDate) {
            return [String(bulletin.startDate).split('T')[0]];
        }
        if (bulletin.deadline) {
            return [String(bulletin.deadline).split('T')[0]];
        }

        return [];
    }

    formatEventDatesDisplay(bulletin) {
        if (bulletin.dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            if (!sessions.length) return null;

            if (sessions.length === 1) {
                const date = this.parseDateOnly(sessions[0].date);
                if (!date) return null;
                return this.getDatesListLabel(bulletin, date, 'event', { session: sessions[0] });
            }

            const locale = this.getLocale();
            const formatted = sessions.map((session) => {
                const parsed = this.parseStoredYmdLocal(session.date);
                const dateLabel = parsed
                    ? parsed.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
                    : session.date;
                const timeLabel = this.formatTimeRange(session.startTime, session.endTime);
                return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
            });

            if (formatted.length === 2) {
                return `${formatted[0]} & ${formatted[1]}`;
            }

            const isEs = this.getCurrentLang() === 'ES';
            return isEs ? `${formatted.length} sesiones` : `${formatted.length} sessions`;
        }

        const item = this.getDatesListItem(bulletin);
        return item ? item.label : null;
    }

    isApplicationDeadline(bulletin) {
        if (bulletin.dateType === 'deadline') {
            const raw = bulletin.eventDate || bulletin.deadline;
            return raw ? this.isDeadlineClose(raw) : false;
        }

        if (!bulletin.dateType && bulletin.deadline && !bulletin.eventDate && !bulletin.startDate) {
            return this.isDeadlineClose(bulletin.deadline);
        }

        return false;
    }

    formatStartDateLabelHtml(date, bulletin) {
        const locale = this.getLocale();
        const isEs = this.getCurrentLang() === 'ES';
        const dateLabel = date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
        const dayLabel = date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
        const timeRange = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
        const timeSuffix = timeRange ? ` · ${this.escapeHtml(timeRange)}` : '';
        const prefix = isEs ? 'Comienza el' : 'Starts';
        const datePart = isEs ? dayLabel : dateLabel;

        return `<strong class="date-label-prefix">${this.escapeHtml(prefix)}</strong> ${this.escapeHtml(datePart)}${timeSuffix}`;
    }

    formatFeedDateDisplayHtml(bulletin) {
        if (bulletin.dateType === 'sessions') {
            const label = this.formatEventDatesDisplay(bulletin);
            return label ? this.escapeHtml(label) : '';
        }

        const item = this.getDatesListItem(bulletin);
        if (!item) return '';

        if (item.kind === 'start') {
            return this.formatStartDateLabelHtml(item.date, bulletin);
        }

        return this.escapeHtml(item.label);
    }

    formatSessionDatesDetailLabel(bulletin) {
        const sessions = this.getBulletinEventSessions(bulletin);
        if (!sessions.length) return '';

        if (sessions.length === 1) {
            const session = sessions[0];
            const parsed = this.parseStoredYmdLocal(session.date);
            const dateLabel = parsed
                ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : session.date;
            const timeLabel = this.formatTimeRange(session.startTime, session.endTime);
            return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
        }

        const sameTime = sessionsShareSameTime(sessions);
        const timeLabel = sameTime ? this.formatTimeRange(sessions[0].startTime, sessions[0].endTime) : '';
        if (timeLabel) {
            return `${sessions.length} sessions · ${timeLabel}`;
        }
        return `${sessions.length} sessions`;
    }

    buildSessionDatesDetailHtml(bulletin) {
        const sessions = this.getBulletinEventSessions(bulletin);
        if (!sessions.length) return '';

        const formatDate = (date) => {
            const parsed = this.parseStoredYmdLocal(date);
            return parsed
                ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : date;
        };

        if (sessions.length === 1) {
            const session = sessions[0];
            const timeLabel = this.formatTimeRange(session.startTime, session.endTime);
            const line = timeLabel
                ? `${formatDate(session.date)} · ${timeLabel}`
                : formatDate(session.date);
            return `<small>${this.escapeHtml(line)}</small>`;
        }

        const sameTime = sessionsShareSameTime(sessions);
        const sharedTime = sameTime ? this.formatTimeRange(sessions[0].startTime, sessions[0].endTime) : '';
        const items = sessions.map((session) => {
            const dateLabel = formatDate(session.date);
            if (sameTime) {
                return `<li>${this.escapeHtml(dateLabel)}</li>`;
            }
            const timeLabel = this.formatTimeRange(session.startTime, session.endTime);
            if (!timeLabel) {
                return `<li>${this.escapeHtml(dateLabel)}</li>`;
            }
            return `<li><span class="post-detail-session-date">${this.escapeHtml(dateLabel)}</span><span class="post-detail-session-time">${this.escapeHtml(timeLabel)}</span></li>`;
        }).join('');

        const sharedTimeHtml = sharedTime
            ? `<p class="post-detail-session-shared-time">${this.escapeHtml(sharedTime)} each session</p>`
            : '';

        return `
            ${sharedTimeHtml}
            <ul class="post-detail-session-list">${items}</ul>
        `;
    }

    bulletinHasCalendarDates(bulletin) {
        return Boolean(
            bulletin.deadline
            || bulletin.eventDate
            || bulletin.startDate
            || (bulletin.dateType === 'sessions' && Array.isArray(bulletin.eventDates) && bulletin.eventDates.length)
        );
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

        document.querySelectorAll('[data-lang-switch]').forEach((button) => {
            button.addEventListener('click', () => {
                const lang = button.getAttribute('data-lang-switch') || 'EN';
                this.setLanguage(lang);
            });
        });

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

        // Post category chips filter the feed. Resource category chips use
        // data-resource-shortcut and are handled separately.
        document.querySelectorAll('.cat-chip[data-cat-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                const filter = chip.getAttribute('data-cat-filter') || 'all';
                this.setFeedCategory(filter);
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

        // Search layer category buttons — filter feed and close the panel
        document.querySelectorAll('.sl-cat-btn[data-cat-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-cat-filter') || 'all';
                this.setFeedCategory(cat);
                this.updateSearchLayerCatState(cat);
                this.closeSearchLayer();
            });
        });

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

        this.setupResourceDetailSheet();

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
                if (typeof window.isImageLightboxOpen === 'function' && window.isImageLightboxOpen()) {
                    return;
                }
                if (this.isSearchLayerOpen) {
                    this.closeSearchLayer();
                    return;
                }
                const resourceSheet = document.getElementById('catDetailSheet');
                if (resourceSheet && resourceSheet.classList.contains('open')) {
                    this.closeResourceDetailSheet();
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


        // Re-render desktop resources on viewport resize across the 768px breakpoint
        let _lastWasDesktop = window.matchMedia('(min-width: 768px)').matches;
        window.addEventListener('resize', () => {
            const isDesktop = window.matchMedia('(min-width: 768px)').matches;
            if (isDesktop !== _lastWasDesktop) {
                _lastWasDesktop = isDesktop;
                this.renderResourcesSections(this.getPublishedResources());
            }
        });

        // Re-render calendar across the 1024px breakpoint (single-pane vs split)
        let _lastWasCalSplit = window.matchMedia('(min-width: 1024px)').matches;
        window.addEventListener('resize', () => {
            const isCalSplit = window.matchMedia('(min-width: 1024px)').matches;
            if (isCalSplit !== _lastWasCalSplit) {
                _lastWasCalSplit = isCalSplit;
                this.renderCalendar(this.filteredPosts.length > 0 ? this.filteredPosts : this.getPostBulletins(this.bulletins));
            }
        });
    }

    setupResourceDetailSheet() {
        const sheet = document.getElementById('catDetailSheet');
        const backdrop = document.getElementById('catDetailBackdrop');
        const backBtn = document.getElementById('catDetailBack');
        const closeBtn = document.getElementById('catDetailClose');
        if (!sheet) return;

        [backBtn, closeBtn, backdrop].forEach((element) => {
            if (element) {
                element.addEventListener('click', () => this.closeResourceDetailSheet());
            }
        });

        document.addEventListener('click', (event) => {
            if (event.target.closest('#catDetailClose, #catDetailBack, #catDetailBackdrop')) {
                event.preventDefault();
                event.stopPropagation();
                this.closeResourceDetailSheet();
            }
        }, true);

        sheet.addEventListener('click', (event) => {
            const showAll = event.target.closest('[data-cat-show-all]');
            if (!showAll) return;

            const category = showAll.getAttribute('data-cat-show-all');
            if (category) {
                this.openResourceDetailSheet(category, { showAll: true });
            }
        });

        let dragStartY = 0;
        let dragCurrentY = 0;
        let isDragging = false;
        let pointerId = null;

        const resetDrag = () => {
            isDragging = false;
            pointerId = null;
            sheet.style.removeProperty('--cat-sheet-drag-y');
            sheet.classList.remove('is-dragging');
        };

        sheet.addEventListener('pointerdown', (event) => {
            if (!window.matchMedia('(max-width: 767px)').matches) return;
            if (event.target.closest('button, a')) return;
            const canStart = event.target.closest('.cat-detail-topbar');
            if (!canStart) return;

            pointerId = event.pointerId;
            dragStartY = event.clientY;
            dragCurrentY = event.clientY;
            isDragging = true;
            sheet.classList.add('is-dragging');
            sheet.setPointerCapture(pointerId);
        });

        const startDrag = (clientY) => {
            dragStartY = clientY;
            dragCurrentY = clientY;
            isDragging = true;
            pointerId = 'fallback';
            sheet.classList.add('is-dragging');
        };

        const updateDrag = (clientY) => {
            if (!isDragging) return;
            dragCurrentY = clientY;
            const delta = Math.max(0, dragCurrentY - dragStartY);
            sheet.style.setProperty('--cat-sheet-drag-y', `${delta}px`);
        };

        const endDrag = () => {
            if (!isDragging) return;
            const delta = Math.max(0, dragCurrentY - dragStartY);
            resetDrag();
            if (delta > 78) {
                this.closeResourceDetailSheet();
            }
        };

        sheet.addEventListener('mousedown', (event) => {
            if (!window.matchMedia('(max-width: 767px)').matches) return;
            if (event.target.closest('button, a')) return;
            if (!event.target.closest('.cat-detail-topbar')) return;
            startDrag(event.clientY);
        });

        document.addEventListener('mousemove', (event) => {
            if (pointerId !== 'fallback') return;
            updateDrag(event.clientY);
        });

        document.addEventListener('mouseup', () => {
            if (pointerId !== 'fallback') return;
            endDrag();
        });

        sheet.addEventListener('touchstart', (event) => {
            if (!window.matchMedia('(max-width: 767px)').matches) return;
            if (event.target.closest('button, a')) return;
            if (!event.target.closest('.cat-detail-topbar')) return;
            startDrag(event.touches[0].clientY);
        }, { passive: true });

        document.addEventListener('touchmove', (event) => {
            if (pointerId !== 'fallback' || event.touches.length === 0) return;
            updateDrag(event.touches[0].clientY);
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (pointerId !== 'fallback') return;
            endDrag();
        });

        const handlePointerMove = (event) => {
            if (!isDragging || event.pointerId !== pointerId) return;
            dragCurrentY = event.clientY;
            const delta = Math.max(0, dragCurrentY - dragStartY);
            sheet.style.setProperty('--cat-sheet-drag-y', `${delta}px`);
        };

        const handlePointerUp = (event) => {
            if (!isDragging || event.pointerId !== pointerId) return;
            const delta = Math.max(0, dragCurrentY - dragStartY);
            resetDrag();
            if (delta > 78) {
                this.closeResourceDetailSheet();
            }
        };

        sheet.addEventListener('pointermove', handlePointerMove);
        sheet.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);

        sheet.addEventListener('pointercancel', resetDrag);
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

        const previousView = this.currentView;
        this.currentView = view;
        document.body.setAttribute('data-current-view', view);

        if (view === 'resources' && previousView !== 'resources') {
            this.currentDesktopResourceTopic = 'all';
        }

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

    getAdvisorInitials(name = '') {
        return name
            .trim()
            .split(/\s+/)
            .map((part) => part[0] || '')
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }

    getAdvisorAvatarColor(index /*, total */) {
        // Saturated tiles matching the resource category bubbles (RESOURCE_CATEGORY_CONFIG).
        // White initials sit on top, same as the icons in the category rail.
        const palette = [
            '#24498f',   // jobs
            '#0d9488',   // immigration
            '#df6b4a',   // housing
            '#df477f',   // health
            '#2f934f',   // food
            '#c99035',   // family / child care
            '#2563eb',   // hse
            '#0a1d3a',   // college
            '#7c3aed',   // legal-aid
            '#1fa77e',   // money
            '#8050d1',   // esol
            '#317dea'    // announcement
        ];
        const i = ((Number(index) || 0) % palette.length + palette.length) % palette.length;
        return { background: palette[i], color: '#ffffff' };
    }

    renderStudentAdvisorDirectory() {
        const list = document.getElementById('advisorsDirectoryList');
        if (!list) {
            return;
        }

        list.innerHTML = STUDENT_ADVISOR_DIRECTORY.map((advisor, index) => {
            const name = this.escapeHtml(advisor.name);
            const role = this.escapeHtml(advisor.role);
            const email = this.escapeHtml(advisor.email || '');
            const initials = this.escapeHtml(this.getAdvisorInitials(advisor.name));
            const avatarColor = this.getAdvisorAvatarColor(index, STUDENT_ADVISOR_DIRECTORY.length);
            return `
                <article class="advisor-dir-card">
                    <div class="advisor-dir-avatar" style="background:${avatarColor.background};color:${avatarColor.color}" aria-hidden="true">${initials}</div>
                    <div class="advisor-dir-card-body">
                        <h2 class="advisor-dir-name">${name}</h2>
                        <p class="advisor-dir-role">${role}</p>
                    </div>
                    <a class="advisor-dir-email-btn" href="mailto:${email}" aria-label="Email ${name} at ${email}">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                            <path d="m3 7 9 6 9-6"></path>
                        </svg>
                        <span class="en-text">Email</span>
                        <span class="es-text">Correo</span>
                    </a>
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
        const feedPosts = postBulletins
            .filter((bulletin) => !this.isCalendarEventBulletin(bulletin))
            .sort((a, b) => this.compareFeedPosts(a, b));
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
        resourcesContainer.innerHTML = '';
        resourcesContainer.hidden = true;
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
                    <strong>No help links listed yet for this topic.</strong>
                    <span>Ask your advisor — they can point you to trusted places.</span>
                </div>
            `;
        }

        return `
            <div class="feed-category-resource-heading">
                <span>Trusted places nearby</span>
                <small>Call or visit for free help</small>
            </div>
            <div class="feed-category-resource-grid">
                ${resources.map((resource) => this.createFeedCategoryResourceCard(resource)).join('')}
            </div>
        `;
    }

    createFeedCategoryResourceCard(resource) {
        const { titleEn } = this.getResourceTitles(resource);
        const description = resource.description ? this.formatRichTextInline(resource.description) : '';
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

    updateSearchLayerCatState(category) {
        const normalized = this.normalizeFeedCategory(category);
        document.querySelectorAll('.sl-cat-btn[data-cat-filter]').forEach(btn => {
            const val = btn.getAttribute('data-cat-filter');
            const isAll = val === 'all';
            const matches = isAll ? normalized === 'all' : this.normalizeFeedCategory(val) === normalized;
            btn.classList.toggle('active', matches);
        });
    }

    updateActiveCategoryState() {
        const category = this.currentFeedCategory || 'all';

        document.querySelectorAll('.cat-chip[data-cat-filter]').forEach((chip) => {
            const chipCategory = this.normalizeFeedCategory(chip.getAttribute('data-cat-filter') || 'all');
            chip.classList.toggle('active', chipCategory === category || (category === 'all' && chipCategory === 'all'));
        });

        document.querySelectorAll('.story-bubble[data-app-view-cat]').forEach((bubble) => {
            const bubbleCategory = this.normalizeFeedCategory(bubble.getAttribute('data-app-view-cat') || 'all');
            bubble.classList.toggle('active', bubbleCategory === category);
            bubble.setAttribute('aria-pressed', String(bubbleCategory === category));
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

    setLanguage(lang) {
        const normalized = lang === 'ES' ? 'ES' : 'EN';
        document.body.setAttribute('data-lang', normalized);
        document.documentElement.setAttribute('data-lang', normalized);

        document.querySelectorAll('[data-lang-switch]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-lang-switch') === normalized);
        });

        this.updateSearchPlaceholder();

        if (this.currentView === 'resources') {
            this.renderResourcesSections(this.getPublishedResources());
        } else {
            this.applyFilters();
        }

        const detailModal = document.getElementById('bulletinDetailModal');
        if (this.activeDetailBulletinId && detailModal?.style.display === 'flex') {
            this.showBulletinDetail(this.activeDetailBulletinId);
        }
    }

    updateSearchPlaceholder() {
        const searchInput = document.getElementById('searchInput');
        const desktopSearchInput = document.getElementById('desktopTopbarSearchInput');
        const mobileInlineSearchInput = document.getElementById('mobileInlineSearchInput');

        const isSpanish = document.body.getAttribute('data-lang') === 'ES';
        const isResourcesView = this.currentView === 'resources';
        const desktopPlaceholder = isResourcesView
            ? (isSpanish ? 'Busca ayuda...' : 'Search help...')
            : (isSpanish
                ? 'Busca ayuda, anuncios y eventos...'
                : 'Search for help, announcements, and events...');
        const mobilePlaceholder = isResourcesView
            ? (isSpanish ? 'Busca ayuda...' : 'Search help...')
            : (isSpanish
                ? '¿Con qué necesitas ayuda?'
                : 'What do you need help with?');

        if (desktopSearchInput) {
            desktopSearchInput.placeholder = desktopPlaceholder;
        }

        [searchInput, mobileInlineSearchInput].filter(Boolean).forEach((input) => {
            input.placeholder = mobilePlaceholder;
        });
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
        grid.innerHTML = bulletins.map((bulletin, index) => this.createBulletinCard(bulletin, index)).join('');
        this.trackRenderedCardViews(bulletins);
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
        const desktopGrid = document.getElementById('bulletinCalendarDesktopGrid');
        if (!calendar || !emptyState) {
            return;
        }

        const mergedBulletins = withSchoolCalendarAnchors(bulletins);
        const datedBulletins = mergedBulletins.filter((bulletin) => this.bulletinHasCalendarDates(bulletin));
        if (datedBulletins.length === 0) {
            calendar.innerHTML = '';
            if (desktopGrid) desktopGrid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        this.updateDatesViewToggle();

        const isDesktopSplit = window.matchMedia('(min-width: 1024px)').matches;

        if (isDesktopSplit) {
            // Two-pane: list left, month grid right (toggle ignored)
            calendar.innerHTML = this.createDatesListView(datedBulletins);
            if (desktopGrid) {
                desktopGrid.innerHTML = this.createCalendarView(mergedBulletins, { navigatorMode: true });
                this.bindCalendarDayScroll(desktopGrid);
            }
        } else {
            // Single-pane: respect toggle
            calendar.innerHTML = this.datesViewMode === 'calendar'
                ? this.createCalendarView(mergedBulletins)
                : this.createDatesListView(datedBulletins);
            if (desktopGrid) desktopGrid.innerHTML = '';
        }
    }

    bindCalendarDayScroll(gridEl) {
        // Clicking a day with events scrolls the list to that date's card.
        gridEl.querySelectorAll('[data-calendar-day]').forEach((dayEl) => {
            dayEl.addEventListener('click', () => {
                const iso = dayEl.getAttribute('data-calendar-day');
                if (!iso) return;
                const target = document.querySelector(`[data-list-date="${iso}"]`);
                if (!target) return;
                const headerOffset = parseInt(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--app-header-offset') || '70', 10
                );
                const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 16;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                target.classList.add('list-card-pulse');
                setTimeout(() => target.classList.remove('list-card-pulse'), 1400);
            });
        });
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
            .flatMap((bulletin) => {
                if (bulletin.dateType === 'sessions') {
                    return this.getBulletinEventDates(bulletin).map((rawDate) => ({
                        bulletin,
                        rawDate,
                        timestamp: this.getTimestampValue(rawDate)
                    }));
                }

                const rawDate = bulletin.eventDate || bulletin.startDate || bulletin.deadline;
                return [{
                    bulletin,
                    rawDate,
                    timestamp: this.getTimestampValue(rawDate)
                }];
            })
            .filter((item) => item.timestamp && item.timestamp >= now.getTime())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3);

        if (events.length === 0) {
            container.innerHTML = '<div class="side-empty">Events with dates will appear here.</div>';
            return;
        }

        container.innerHTML = events.map(({ bulletin, rawDate, timestamp }) => {
            const date = new Date(timestamp);
            const locale = this.getLocale();
            const month = date.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
            const day = date.toLocaleDateString(locale, { day: 'numeric' });
            const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
            const time = bulletin.startTime || '';
            const meta = [weekday, time].filter(Boolean).join(' · ');

            return `
                <button class="side-event" type="button" onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${bulletin.id}')">
                    <div class="side-date"><span>${month}</span><strong>${day}</strong></div>
                    <div>
                        <p class="side-event-title">${this.escapeHtml(this.getPostTitle(bulletin) || (this.getCurrentLang() === 'ES' ? 'Próximo evento' : 'Upcoming event'))}</p>
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
        // Also populate the desktop layout whenever resources update
        if (document.querySelector('.resources-desktop-layout')) {
            this.renderResourcesDesktop(resources);
        }
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
                    aria-label="View ${config.labelEn} help"
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

        container.innerHTML = heroCards || '<p class="hero-resources-empty">No help links available yet.</p>';

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
                const placesLabelEn = this.getResourceCountNoun(count, 'en');
                const placesLabelEs = this.getResourceCountNoun(count, 'es');
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
                    ? '<h3>No help links published yet</h3><p>Advisors can add quick links in the admin portal so they appear here for students.</p>'
                    : '<h3>No help links in this category</h3><p>Try another category to see more support links.</p>';
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

    // ─── Quick-Filter helpers ────────────────────────────────────────

    isResourceFree(resource) {
        if (resource.isFree === true || resource.free === true) return true;
        const text = [
            resource.highlights, resource.description, resource.title,
            resource.titleEn, resource.titleEs
        ].join(' ').toLowerCase();
        return /\bfree\b|\bgratis\b|\bgratuito\b/.test(text);
    }

    isResourceWalkIn(resource) {
        if (resource.isWalkIn === true || resource.walkIn === true) return true;
        const text = [
            resource.highlights, resource.description, resource.title,
            resource.titleEn, resource.titleEs
        ].join(' ').toLowerCase();
        return /walk[\s-]?in|sin cita|drop[\s-]?in/.test(text);
    }

    isResourceSpanishSpoken(resource) {
        if (Array.isArray(resource.languages)) {
            const langs = resource.languages.join(' ').toLowerCase();
            if (/spanish|español|espanol/.test(langs)) return true;
        }
        if (resource.bilingual === true) return true;
        const text = [
            resource.highlights, resource.description
        ].join(' ').toLowerCase();
        return /spanish|español|espanol|se habla/.test(text);
    }

    isResourceOpenNow(resource) {
        const hoursText = (
            resource.hours || resource.hoursOfOperation || resource.schedule || ''
        ).toLowerCase().trim();
        if (!hoursText) return false;
        if (/24\/7|open 24/.test(hoursText)) return true;

        const now = new Date();
        const dayIndex = now.getDay(); // 0=Sun..6=Sat
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const DAY_ALIASES = {
            sun: 0, sunday: 0,
            mon: 1, monday: 1,
            tue: 2, tues: 2, tuesday: 2,
            wed: 3, wednesday: 3,
            thu: 4, thur: 4, thurs: 4, thursday: 4,
            fri: 5, friday: 5,
            sat: 6, saturday: 6
        };

        const parseTime12 = (s) => {
            const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2] || '0', 10);
            const period = (m[3] || '').toLowerCase();
            if (period === 'pm' && h !== 12) h += 12;
            if (period === 'am' && h === 12) h = 0;
            return h * 60 + min;
        };

        const segments = hoursText.split(/[,;|]/);
        for (const segment of segments) {
            const rangeParts = segment.match(
                /([a-z]+(?:[\s-][a-z]+)?)[:\s]*([\d:]+\s*(?:am|pm)?)\s*[-–]\s*([\d:]+\s*(?:am|pm)?)/i
            );
            if (!rangeParts) continue;
            const dayPart = rangeParts[1].trim().toLowerCase();
            const openMin = parseTime12(rangeParts[2]);
            const closeMin = parseTime12(rangeParts[3]);
            if (openMin === null || closeMin === null) continue;

            // Resolve day range (e.g. "Mon-Fri")
            const dayRange = dayPart.split(/[-–]/).map(d => DAY_ALIASES[d.trim()]);
            const startDay = dayRange[0] ?? -1;
            const endDay = dayRange[1] ?? startDay;
            if (startDay === -1) continue;
            if (dayIndex < startDay || dayIndex > endDay) continue;

            if (closeMin > openMin) {
                if (currentMinutes >= openMin && currentMinutes < closeMin) return true;
            } else {
                // Wraps midnight (e.g. 10pm–2am)
                if (currentMinutes >= openMin || currentMinutes < closeMin) return true;
            }
        }
        return false;
    }

    getResourceBadgesHtml(resource) {
        const badges = [];
        if (this.isResourceFree(resource)) {
            badges.push('<span class="badge badge--free"><span class="en-text">Free</span><span class="es-text">Gratis</span></span>');
        }
        if (this.isResourceWalkIn(resource)) {
            badges.push('<span class="badge badge--walkin"><span class="en-text">Walk-in</span><span class="es-text">Sin cita</span></span>');
        }
        if (this.isResourceOpenNow(resource)) {
            badges.push('<span class="badge badge--open"><span class="en-text">Open now</span><span class="es-text">Abierto</span></span>');
        } else if (resource.hours || resource.hoursOfOperation) {
            badges.push('<span class="badge badge--closed"><span class="en-text">Closed</span><span class="es-text">Cerrado</span></span>');
        }
        if (badges.length === 0) return '';
        return `<div class="resource-badges-container">${badges.join('')}</div>`;
    }

    formatCompactAddress(address = '') {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const street = parts[0];
            const city = parts[1].replace(/\s+[A-Z]{2}(\s+\d{5}(?:-\d{4})?)?$/i, '').trim() || parts[1];
            return `${street} · ${city}`;
        }
        return address.trim();
    }

    getResourceSheetSubtitle(resource) {
        const { titleEn } = this.getResourceTitles(resource);
        const company = (resource.company || '').trim();
        const address = (resource.address || '').trim();
        const shortAddress = address ? this.formatCompactAddress(address) : '';

        if (shortAddress) {
            if (company && company !== titleEn) {
                return `${company} · ${shortAddress.split(' · ').pop()}`;
            }
            return shortAddress;
        }

        if (company && company !== titleEn) {
            return company;
        }

        const description = (resource.description || '').trim();
        if (!description) {
            return '';
        }

        if (description.length <= 72) {
            return description;
        }

        const cut = description.slice(0, 72);
        const lastSpace = cut.lastIndexOf(' ');
        return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    }

    // ─── Desktop Resources Rendering ────────────────────────────────

    getResourceCountNoun(count, lang = 'en') {
        if (lang === 'es') {
            return count === 1 ? 'recurso' : 'recursos';
        }
        return count === 1 ? 'resource' : 'resources';
    }

    getResourceCountText(count, lang = 'en') {
        return `${count} ${this.getResourceCountNoun(count, lang)}`;
    }

    renderResourcesDesktop(allResources) {
        const navContainer = document.getElementById('desktopCategoryNav');
        const sectionsContainer = document.getElementById('resourcesDesktopSections');
        const emptyEl = document.getElementById('resourceDesktopEmptyState');
        if (!navContainer || !sectionsContainer) return;

        // Apply search query
        const searchQuery = document.getElementById('searchInput')?.value ||
                            document.getElementById('desktopTopbarSearchInput')?.value || '';
        const filtered = this.filterResourcesBySearch(allResources, searchQuery);

        // Build per-category map
        const catMap = {};
        RESOURCE_TILE_CATEGORIES.forEach(key => { catMap[key] = []; });
        filtered.forEach(r => {
            const key = this.getResourceCategoryKey(r);
            if (catMap[key]) catMap[key].push(r);
        });

        // Render sidebar nav
        const activeTopic = this.currentDesktopResourceTopic || 'all';
        const allButtonHtml = `
            <button
                type="button"
                class="desktop-cat-btn desktop-cat-btn--all${activeTopic === 'all' ? ' active' : ''}"
                data-desktop-cat="all"
                style="--topic-color:#e0e7ff;--topic-text:#0a1d3a"
                aria-label="All topics / Todos los temas"
            >
                <span class="desktop-cat-icon desktop-cat-icon--all" style="background:#0a1d3a" aria-hidden="true">✨</span>
                <span class="desktop-cat-label">
                    <span class="en-text">All</span>
                    <span class="es-text">Todo</span>
                </span>
                ${filtered.length > 0 ? `<span class="desktop-cat-count" style="background:#e0e7ff;color:#0a1d3a">${filtered.length}</span>` : ''}
            </button>
        `;

        navContainer.innerHTML = allButtonHtml + RESOURCE_TILE_CATEGORIES.map(key => {
            const config = RESOURCE_CATEGORY_CONFIG[key];
            if (!config) return '';
            const count = (catMap[key] || []).length;
            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;
            return `
                <button
                    type="button"
                    class="desktop-cat-btn${activeTopic === key ? ' active' : ''}"
                    data-desktop-cat="${key}"
                    style="--topic-color:${config.color}20;--topic-text:${config.color}"
                    aria-label="${this.escapeAttribute(config.labelEn + ' / ' + config.labelEs)}"
                >
                    <span class="desktop-cat-icon" style="background:${config.color}" aria-hidden="true">${iconSvg}</span>
                    <span class="desktop-cat-label">
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </span>
                    ${count > 0 ? `<span class="desktop-cat-count" style="background:${config.color}20;color:${config.color}">${count}</span>` : ''}
                </button>
            `;
        }).join('');

        const setActiveDesktopTopic = (topic) => {
            this.currentDesktopResourceTopic = topic || 'all';
            navContainer.querySelectorAll('.desktop-cat-btn').forEach((button) => {
                const buttonTopic = button.dataset.desktopCat || 'all';
                button.classList.toggle('active', buttonTopic === this.currentDesktopResourceTopic);
            });
        };

        // Bind sidebar button clicks → scroll to section, not open sheet
        navContainer.querySelectorAll('.desktop-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.desktopCat;
                if (!cat) return;

                setActiveDesktopTopic(cat);

                const headerOffset = parseInt(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--app-header-offset') || '70', 10
                );

                if (cat === 'all') {
                    const scrollTarget = sectionsContainer.closest('.resources-desktop-main') || sectionsContainer;
                    const top = window.scrollY + scrollTarget.getBoundingClientRect().top - headerOffset - 16;
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                    return;
                }

                const target = document.getElementById(`desktop-section-${cat}`);
                if (target) {
                    const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 16;
                    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                }
            });
        });

        // Render main categorized sections
        const categoriesWithResources = RESOURCE_TILE_CATEGORIES.filter(k => (catMap[k] || []).length > 0);

        if (categoriesWithResources.length === 0) {
            sectionsContainer.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        sectionsContainer.innerHTML = categoriesWithResources.map(key => {
            const config = RESOURCE_CATEGORY_CONFIG[key];
            if (!config) return '';
            const resources = catMap[key];
            const preview = resources.slice(0, 3);
            const hasMore = resources.length > 3;
            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

            const cardsHtml = preview.map(r => this.createResourceDetailCard(r, config, { compact: false })).join('');
            const showAllBtn = hasMore ? `
                <button class="cat-org-show-all desktop-section-see-all" type="button"
                    data-desktop-show-all="${this.escapeAttribute(key)}"
                    style="--cat-accent:${config.color}">
                    <span class="en-text">See all ${this.escapeHtml(config.labelEn.toLowerCase())} — ${this.getResourceCountText(resources.length, 'en')}</span>
                    <span class="es-text">Ver ${this.getResourceCountText(resources.length, 'es')}</span>
                    <span aria-hidden="true">&rarr;</span>
                </button>
            ` : '';

            return `
                <section class="desktop-resource-section" id="desktop-section-${key}" style="--cat-accent:${config.color}">
                    <div class="desktop-section-header">
                        <span class="desktop-section-icon" style="background:${config.color}" aria-hidden="true">${iconSvg}</span>
                        <div class="desktop-section-title-group">
                            <h2 class="desktop-section-title">
                                <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                                <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                            </h2>
                            <p class="desktop-section-count">
                                <span class="en-text">${this.getResourceCountText(resources.length, 'en')}</span>
                                <span class="es-text">${this.getResourceCountText(resources.length, 'es')}</span>
                            </p>
                        </div>
                    </div>
                    <div class="desktop-section-grid">
                        ${cardsHtml}
                    </div>
                    ${showAllBtn}
                </section>
            `;
        }).join('');

        // Bind "See all" buttons in desktop sections
        sectionsContainer.querySelectorAll('[data-desktop-show-all]').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.desktopShowAll;
                if (cat) this.openResourceDetailSheet(cat, { showAll: true });
            });
        });
    }

    // ─── Speech Synthesis ────────────────────────────────────────────

    handleResourceSpeech(text, button) {
        if (!window.speechSynthesis) return;

        // If the same button is already speaking, cancel it
        if (button.classList.contains('speaking')) {
            window.speechSynthesis.cancel();
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
            return;
        }

        // Stop any currently speaking button
        window.speechSynthesis.cancel();
        document.querySelectorAll('.resource-audio-btn.speaking').forEach(b => {
            b.classList.remove('speaking');
            b.setAttribute('aria-label', 'Read aloud');
        });

        // Detect language
        const isSpanish = document.documentElement.getAttribute('data-lang') === 'ES' ||
                          document.body.classList.contains('lang-es');
        const lang = isSpanish ? 'es-US' : 'en-US';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Prefer a matching voice
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.lang === lang) ||
                      voices.find(v => v.lang.startsWith(lang.split('-')[0]));
        if (match) utterance.voice = match;

        button.classList.add('speaking');
        button.setAttribute('aria-label', 'Stop reading');

        utterance.onend = () => {
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
        };
        utterance.onerror = () => {
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
        };

        window.speechSynthesis.speak(utterance);
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
            'legal-aid': 'legal-aid',
        };
        const resourceKey = keyMap[category] || category;
        this.openResourceDetailSheet(resourceKey);
    }

    setFeedCategory(category = 'all') {
        const normalizedCategory = this.normalizeFeedCategory(category);
        if (this.currentView !== 'feed') {
            this.switchView('feed', { skipRender: true, preserveDetail: true });
        }
        this.currentFeedCategory = normalizedCategory;
        this.selectedCategories = normalizedCategory === 'all' ? [] : [normalizedCategory];
        this.updateFeedCategoryHeader();
        this.updateActiveCategoryState();
        this.updateSearchLayerCatState(normalizedCategory);
        this.updateFilterCount();
        this.applyFilters();
    }

    normalizeFeedCategory(category) {
        return normalizePostCategory(category);
    }

    openResourceDetailSheet(category, options = {}) {
        const config = RESOURCE_CATEGORY_CONFIG[category];
        const sheet = document.getElementById('catDetailSheet');
        const titleEl = document.getElementById('catDetailTitle');
        const iconEl = document.getElementById('catDetailIcon');
        const listEl = document.getElementById('catOrgList');
        if (!config || !sheet || !listEl) return;

        const resources = this.getPublishedResources()
            .filter((resource) => this.getResourceCategoryKey(resource) === category);
        const isMobileSheet = window.matchMedia('(max-width: 767px)').matches;
        const shouldLimit = !options.showAll;
        const visibleResources = shouldLimit ? resources.slice(0, 3) : resources;
        const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

        if (titleEl) {
            titleEl.innerHTML = `
                <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                <small>
                    <span class="en-text">${this.getResourceCountText(resources.length, 'en')}</span>
                    <span class="es-text">${this.getResourceCountText(resources.length, 'es')}</span>
                </small>
            `;
        }

        if (iconEl) {
            iconEl.style.background = config.color;
            iconEl.innerHTML = iconSvg;
        }

        sheet.style.setProperty('--cat-accent', config.color);
        const emptyHtml = `
            <div class="cat-org-empty">
                <strong>No help links listed yet.</strong>
                <span>Ask your advisor for trusted places nearby.</span>
            </div>
        `;
        const showAllHtml = shouldLimit && resources.length > visibleResources.length
            ? this.createResourceSheetShowAllButton(category, config, resources.length)
            : '';
        listEl.innerHTML = visibleResources.length > 0
            ? visibleResources.map((resource) => this.createResourceDetailCard(resource, config, { compact: isMobileSheet })).join('')
            : emptyHtml;

        // Place the "See all" button in the sticky footer (outside the scroll area)
        const footerEl = document.getElementById('catSheetFooter');
        if (footerEl) {
            footerEl.innerHTML = showAllHtml;
            footerEl.style.display = showAllHtml ? '' : 'none';
        }


        if (this.resourceSheetCloseTimer) {
            window.clearTimeout(this.resourceSheetCloseTimer);
            this.resourceSheetCloseTimer = null;
        }

        sheet.classList.add('open');
        sheet.classList.toggle('cat-detail-sheet--bottom', isMobileSheet);
        sheet.classList.toggle('cat-detail-sheet--desktop', !isMobileSheet);
        sheet.classList.toggle('cat-detail-sheet--expanded', !shouldLimit);
        sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('resource-sheet-open');
        const scroll = sheet.querySelector('.cat-detail-scroll');
        if (scroll) scroll.scrollTop = 0;
    }

    closeResourceDetailSheet() {
        const sheet = document.getElementById('catDetailSheet');
        if (sheet) {
            const wasBottomSheet = sheet.classList.contains('cat-detail-sheet--bottom');
            const wasDesktopSheet = sheet.classList.contains('cat-detail-sheet--desktop');
            sheet.classList.remove('open', 'is-dragging');
            sheet.setAttribute('aria-hidden', 'true');
            sheet.style.removeProperty('--cat-sheet-drag-y');

            if (wasBottomSheet || wasDesktopSheet) {
                if (this.resourceSheetCloseTimer) {
                    window.clearTimeout(this.resourceSheetCloseTimer);
                }
                this.resourceSheetCloseTimer = window.setTimeout(() => {
                    this.resourceSheetCloseTimer = null;
                    if (!sheet.classList.contains('open')) {
                        sheet.classList.remove('cat-detail-sheet--bottom', 'cat-detail-sheet--desktop', 'cat-detail-sheet--expanded');
                    }
                }, 280);
            } else {
                sheet.classList.remove('cat-detail-sheet--bottom', 'cat-detail-sheet--desktop', 'cat-detail-sheet--expanded');
            }
        }
        document.body.classList.remove('resource-sheet-open');
    }

    createResourceSheetShowAllButton(category, config, count) {
        return `
            <button class="cat-org-show-all" type="button" data-cat-show-all="${this.escapeAttribute(category)}" style="--cat-accent:${config.color}">
                <span class="en-text">See all ${this.escapeHtml(config.labelEn.toLowerCase())} — ${this.getResourceCountText(count, 'en')}</span>
                <span class="es-text">Ver ${this.getResourceCountText(count, 'es')}</span>
                <span aria-hidden="true">&rarr;</span>
            </button>
        `;
    }

    createResourceDetailCard(resource, config, options = {}) {
        const { titleEn } = this.getResourceTitles(resource);
        const isCompact = options.compact === true;
        const description = isCompact
            ? this.getResourceSheetSubtitle(resource)
            : (resource.description || '');
        const escapedDescription = description
            ? (isCompact
                ? this.escapeHtml(description)
                : this.formatRichTextInline(resource.description || ''))
            : '';
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

        const primaryActionHtml = options.compact ? (callHtml || websiteHtml || directionsHtml) : '';
        const actionCount = [callHtml, websiteHtml || directionsHtml].filter(Boolean).length;
        const logoHtml = resource.resourceLogo
            ? `<div class="cat-org-logo"><img src="${this.escapeAttribute(resource.resourceLogo)}" alt="${this.escapeAttribute(titleEn)} logo" loading="lazy"></div>`
            : '';

        const badgesHtml = isCompact ? '' : this.getResourceBadgesHtml(resource);

        return `
            <article class="cat-org-card" style="--cat-accent:${config.color}">
                ${logoHtml}
                <div class="cat-org-main">
                    <h3 class="cat-org-name">${this.escapeHtml(titleEn)}</h3>
                    ${badgesHtml}
                    ${escapedDescription ? `<p class="cat-org-description">${escapedDescription}</p>` : ''}
                </div>
                ${!isCompact && address ? `<p class="cat-org-address">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#758299" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    ${this.escapeHtml(address)}
                </p>` : ''}
                ${languageHtml}
                <div class="cat-org-actions ${actionCount === 1 || (websiteHtml && callHtml && !directionsHtml) ? 'cat-org-actions--stack' : ''}">
                    ${options.compact ? primaryActionHtml : `${callHtml}${websiteHtml || directionsHtml}`}
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
        const description = resource.description ? this.formatRichTextInline(resource.description) : '';

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

        const logo = resource.resourceLogo || '';
        const storyInnerHtml = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" class="resource-story-logo" loading="lazy">`
            : `<span class="resource-story-icon" aria-hidden="true">${this.getResourceIconSvg(resource)}</span>`;
        const ringClass = logo ? 'resource-story-ring resource-story-ring--logo' : 'resource-story-ring';

        return `
            <a
                class="resource-story-bubble story-${categoryKey}"
                href="${this.escapeAttribute(url)}"
                target="_blank"
                rel="noopener"
                title="${this.escapeAttribute(titleEn)}"
                aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
            >
                <span class="${ringClass}">
                    ${storyInnerHtml}
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
        const description = resource.description ? this.formatRichTextInline(resource.description) : '';
        const url = this.getResourceUrl(resource);
        const logo = resource.resourceLogo || '';

        // Parse highlights for quick-scan bullet points
        const highlights = this.parseResourceHighlights(resource.highlights);
        const highlightsHtml = highlights.length > 0
            ? `<span class="resource-card-highlights">
                ${highlights.map(h => `<span class="resource-card-highlight">${this.escapeHtml(h)}</span>`).join('')}
               </span>`
            : '';
        const iconContents = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" class="resource-card-logo" loading="lazy">`
            : this.getResourceIconSvg(resource);
        const iconClass = logo ? 'resource-card-icon resource-card-icon--logo' : 'resource-card-icon';

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
                    <span class="${iconClass}" aria-hidden="true">
                        ${iconContents}
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

    /** Simple dated labels (Event Date tab) — calendar/upcoming only, not main feed cards. */
    isCalendarEventBulletin(bulletin) {
        if (!bulletin || this.isResourceBulletin(bulletin)) return false;

        const dt = bulletin.dateType;
        if (dt !== 'event' && dt !== 'range' && dt !== 'sessions') return false;

        const hasBody = Boolean(
            (bulletin.description || '').trim()
            || (bulletin.company || '').trim()
            || (bulletin.contact || '').trim()
            || (bulletin.eventLink || '').trim()
            || bulletin.image
            || bulletin.pdfUrl
        );

        return bulletin.category === 'announcement' && !hasBody;
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

        return publishedResources;
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

    getFeedSortTimestamp(bulletin) {
        const postedMs = this.getTimestampValue(bulletin.datePosted || bulletin.createdAt);
        if (!bulletin || bulletin.dateType !== 'sessions') {
            return postedMs;
        }

        const sessions = this.getBulletinEventSessions(bulletin);
        return getMultiSessionFeedSortMs(sessions, postedMs);
    }

    compareFeedPosts(a, b) {
        const sortA = this.getFeedSortTimestamp(a);
        const sortB = this.getFeedSortTimestamp(b);
        if (sortB !== sortA) {
            return sortB - sortA;
        }

        if (a.dateType === 'sessions' && b.dateType === 'sessions') {
            const nextA = getNextSessionStartMs(this.getBulletinEventSessions(a));
            const nextB = getNextSessionStartMs(this.getBulletinEventSessions(b));
            if (nextA !== nextB) {
                return nextA - nextB;
            }
        }

        return this.getTimestampValue(b.datePosted || b.createdAt) - this.getTimestampValue(a.datePosted || a.createdAt);
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
            .filter((value) => value && value !== 'all');

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
        this.activeDetailBulletinId = bulletinId;
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
        this.activeDetailBulletinId = null;
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
                        <h3 class="day-event-title">${this.escapeHtml(this.getPostTitle(bulletin))}</h3>
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

    showDayEventsByIds(ids) {
        const bulletins = ids.map(id => this.bulletins.find(b => b.id === id)).filter(Boolean);
        this.showDayEvents(bulletins);
    }

    getCatMeta(category) {
        const map = {
            job:           { accent: '#1e40af', tint: '#dbeafe', grad: 'linear-gradient(145deg,#bfdbfe 0%,#dbeafe 100%)', label: 'Jobs',         labelEs: 'Empleos',        badge: 'JOBS',         emoji: '💼' },
            training:      { accent: '#7b4ec7', tint: '#ede9fe', grad: 'linear-gradient(145deg,#ddd6fe 0%,#ede9fe 100%)', label: 'Training',      labelEs: 'Capacitación',   badge: 'FREE',         emoji: '📚' },
            college:       { accent: '#4338ca', tint: '#e0e7ff', grad: 'linear-gradient(145deg,#c7d2fe 0%,#e0e7ff 100%)', label: 'College',       labelEs: 'Universidad',    badge: 'APPLY',        emoji: '🎓' },
            immigration:   { accent: '#0d8a7a', tint: '#ccfbf1', grad: 'linear-gradient(145deg,#99f6e4 0%,#ccfbf1 100%)', label: 'Immigration',   labelEs: 'Inmigración',    badge: 'FREE',         emoji: '🌍' },
            housing:       { accent: '#b91c1c', tint: '#fee2e2', grad: 'linear-gradient(145deg,#fca5a5 0%,#fecaca 100%)', label: 'Housing',       labelEs: 'Vivienda',       badge: 'FREE HELP',    emoji: '🏠' },
            health:        { accent: '#be185d', tint: '#fce7f3', grad: 'linear-gradient(145deg,#f9a8d4 0%,#fce7f3 100%)', label: 'Health',        labelEs: 'Salud',          badge: 'FREE',         emoji: '❤️' },
            food:          { accent: '#166534', tint: '#dcfce7', grad: 'linear-gradient(145deg,#86efac 0%,#dcfce7 100%)', label: 'Food',          labelEs: 'Comida',         badge: 'FREE',         emoji: '🍎' },
            childcare:     { accent: '#92400e', tint: '#fef3c7', grad: 'linear-gradient(145deg,#fde68a 0%,#fef3c7 100%)', label: 'Family',        labelEs: 'Familia',        badge: 'FREE',         emoji: '👨‍👩‍👧' },
            esol:          { accent: '#6d28d9', tint: '#ede9fe', grad: 'linear-gradient(145deg,#c4b5fd 0%,#ede9fe 100%)', label: 'ESOL',          labelEs: 'Inglés',         badge: 'FREE',         emoji: '🗣️' },
            'career-fair': { accent: '#b45309', tint: '#ffedd5', grad: 'linear-gradient(145deg,#fed7aa 0%,#ffedd5 100%)', label: 'Career Fair',   labelEs: 'Feria de Empleo',badge: 'FREE',         emoji: '🤝' },
            money:         { accent: '#065f46', tint: '#d1fae5', grad: 'linear-gradient(145deg,#6ee7b7 0%,#d1fae5 100%)', label: 'Money Help',    labelEs: 'Ayuda Económica',badge: 'FREE',         emoji: '💰' },
            announcement:  { accent: '#0284c7', tint: '#e0f2fe', grad: 'linear-gradient(145deg,#bae6fd 0%,#e0f2fe 100%)', label: 'Announcements', labelEs: 'Anuncios',       badge: 'INFO',         emoji: '📢' },
            resource:      { accent: '#0e7490', tint: '#cffafe', grad: 'linear-gradient(145deg,#a5f3fc 0%,#cffafe 100%)', label: 'Resource',      labelEs: 'Recurso',        badge: 'INFO',         emoji: '🔗' },
        };
        return map[category] || { accent: '#475569', tint: '#f1f5f9', grad: 'linear-gradient(145deg,#e2e8f0 0%,#f1f5f9 100%)', label: category, labelEs: category, badge: 'INFO', emoji: '📌' };
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
            college:       { top: '#a5b4fc', bot: '#e0e7ff', sun: '#ffc857', fg1: '#4338ca', fg2: '#818cf8' },
            immigration:   { top: '#5fc4b3', bot: '#cfeee8', sun: '#fff',    fg1: '#0d8a7a', fg2: '#7fd4c6' },
            housing:       { top: '#f0a78f', bot: '#fbdcd1', sun: '#fff8eb', fg1: '#d96a4a', fg2: '#f5b7a3' },
            health:        { top: '#f0a3bd', bot: '#fbd6e3', sun: '#fff',    fg1: '#e0497d', fg2: '#f0a3bd' },
            food:          { top: '#7cc795', bot: '#cfead9', sun: '#ffc857', fg1: '#2d8a4a', fg2: '#9bd5af' },
            childcare:     { top: '#e0bb7a', bot: '#f5e3c4', sun: '#fff',    fg1: '#c08a3e', fg2: '#e0bb7a' },
            esol:          { top: '#b89bea', bot: '#ece4f9', sun: '#fff',    fg1: '#7b4ec7', fg2: '#c4afe7' },
            'career-fair': { top: '#f5c285', bot: '#fbe6cc', sun: '#fff',    fg1: '#e88a2a', fg2: '#f5c285' },
            money:         { top: '#6dcfa9', bot: '#cfeee0', sun: '#ffc857', fg1: '#1aa37a', fg2: '#9fdcc4' },
            announcement:  { top: '#7dd3fc', bot: '#e0f2fe', sun: '#fff8eb', fg1: '#0284c7', fg2: '#bae6fd' },
            resource:      { top: '#67e8f9', bot: '#cffafe', sun: '#fff8eb', fg1: '#0e7490', fg2: '#a5f3fc' },
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
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
        const isExpired = this.isBulletinExpired(bulletin);
        const postedAgo = this.formatPostedDate(bulletin.datePosted);
        const title = this.getPostTitle(bulletin);
        const titleShort = title.length > 40 ? title.substring(0, 38) + '…' : title;
        const desc = this.getPostDescription(bulletin);
        const truncatedDesc = truncateRichText(desc, 109);
        const descHtml = renderRichTextInline(truncatedDesc) + (getRichTextPlainLength(desc) > 110 ? '…' : '');

        const dateLabelHtml = this.formatFeedDateDisplayHtml(bulletin);

        const openHandler = `window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${bulletin.id}')`;

        const featuredClass = !bulletin.image && index % 7 === 0 ? 'pc--featured' : '';

        const currentLang = document.body.getAttribute('data-lang') || 'EN';
        const displayImage = (currentLang === 'ES' && bulletin.imageEs) ? bulletin.imageEs : bulletin.image;
        const hasImage = Boolean(displayImage);

        const chipsBar = `
      <div class="pc__chip-bar" style="--chip-accent:${meta.accent};--chip-tint:${meta.tint}">
        <div class="pc__chips" role="list" aria-label="Post labels">
          ${isExpired ? '<span class="pc__chip pc__chip--expired" role="listitem">⏰ Expired</span>' : ''}
          <span class="pc__chip pc__chip--category" role="listitem">
            <span class="pc__chip-emoji" aria-hidden="true">${meta.emoji}</span>
            <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
            <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
          </span>
        </div>
      </div>`;

        return `
    <article class="pc ${featuredClass} ${isExpired ? 'pc--expired' : ''}" id="bulletin-${bulletin.id}" data-bulletin-id="${bulletin.id}" onclick="${openHandler}" role="button" tabindex="0" style="cursor:pointer">
      ${chipsBar}
      <div class="pc__top ${hasImage ? 'pc__top--image' : ''}" style="background:${hasImage ? '#f8fafc' : meta.grad}">
        ${hasImage
          ? `<div class="pc__image-stage"><img class="pc__poster-image" src="${this.escapeAttribute(displayImage)}" alt=""></div>`
          : `<div class="pc__icon-wrap"><div class="pc__icon-box" style="background:${meta.accent}">${this.getCardIconSvg(bulletin.category)}</div></div>
        <div class="pc__title-overlay">${this.escapeHtml(titleShort)} —</div>`}
      </div>

      <div class="pc__body">
        <h3 class="pc__title">${this.escapeHtml(title)}</h3>
        <p class="pc__desc">${descHtml}${getRichTextPlainLength(desc) > 110 ? '…' : ''}</p>

        ${dateLabelHtml ? `
        <div class="pc__date ${isDeadlineClose && !isExpired ? 'pc__date--urgent' : ''}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>${dateLabelHtml}</span>
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
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
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
        const sessionCount = bulletin.dateType === 'sessions' ? this.getBulletinEventSessions(bulletin).length : 0;
        const isMultiSessionDetail = sessionCount > 1;
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
        const postDescription = this.getPostDescription(bulletin);
        const descriptionHtml = postDescription ? this.renderFormattedDescription(postDescription, `${bulletin.id}-detail`) : '';
        const tagValues = [bulletin.classType ? this.getClassTypeDisplay(bulletin.classType) : '', bulletin.company || '', bulletin.eventLocation || '']
            .filter(Boolean)
            .slice(0, 3);
        const contactAction = this.getDetailContactAction(bulletin);
        const showDetailInfoGrid = this.hasDetailInfoGridContent(bulletin);
        const currentLang = document.body.getAttribute('data-lang') || 'EN';
        const displayImage = (currentLang === 'ES' && bulletin.imageEs) ? bulletin.imageEs : bulletin.image;

        const heroContent = displayImage
            ? `<button type="button" class="post-detail-hero-zoom lightbox-trigger" data-lightbox-src="${this.escapeAttribute(displayImage)}" aria-label="View full size flyer">
                <img class="post-detail-hero-image" src="${this.escapeAttribute(displayImage)}" alt="">
                <span class="post-detail-hero-zoom-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>
                    <span class="en-text">Tap to zoom</span>
                    <span class="es-text">Toca para ampliar</span>
                </span>
            </button>`
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
                    <h2>${this.escapeHtml(this.getPostTitle(bulletin))}</h2>
                    ${isExpired ? '<p class="post-detail-expired">Expired</p>' : ''}
                    <div class="post-detail-author">
                        <span class="post-detail-avatar" style="background:${meta.accent}">${this.escapeHtml(initial)}</span>
                        <span>${authorHtml}</span>
                    </div>
                    ${importantDate ? `
                        <div class="post-detail-date ${isDeadlineClose && !isExpired ? 'post-detail-date--urgent' : ''}${isMultiSessionDetail ? ' post-detail-date--sessions' : ''}">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            <div class="post-detail-date-copy">
                                <strong>${isMultiSessionDetail ? 'Session dates' : 'Important date'}</strong>
                                ${isMultiSessionDetail
                                    ? this.buildSessionDatesDetailHtml(bulletin)
                                    : `<small>${this.escapeHtml(importantDate.label)}</small>`}
                            </div>
                        </div>
                    ` : ''}
                    ${descriptionHtml ? `<div class="post-detail-description">${descriptionHtml}</div>` : ''}
                    
                    ${showDetailInfoGrid ? `
                        <div class="post-detail-info-grid" style="margin-top: 24px; display: grid; gap: 16px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                            ${bulletin.address ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Location</strong><span style="font-size: 0.95rem;">${this.escapeHtml(bulletin.address)}</span></div>
                                </div>
                            ` : ''}
                            
                            ${bulletin.hours ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Hours</strong><span style="font-size: 0.95rem;">${this.escapeHtml(bulletin.hours)}</span></div>
                                </div>
                            ` : ''}

                            ${(bulletin.languages && (Array.isArray(bulletin.languages) ? bulletin.languages.length > 0 : bulletin.languages)) ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg></div>
                                    <div>
                                        <strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Languages</strong>
                                        <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
                                            ${this.getLanguageTagsHtml(bulletin.languages)}
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

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
        if (bulletin.dateType === 'sessions') {
            const items = this.expandBulletinDateItems(bulletin);
            if (!items.length) return null;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcoming = items
                .filter((item) => item.date >= today)
                .sort((a, b) => a.date.getTime() - b.date.getTime());
            const item = upcoming[0] || items[items.length - 1];

            return {
                raw: item.rawDate,
                date: item.date,
                kind: item.kind,
                label: this.formatSessionDatesDetailLabel(bulletin)
            };
        }

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
        const phone = bulletin.phone || '';
        const source = [phone, bulletin.contact].filter(Boolean).join(' ');
        const phoneMatch = source.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

        if (!phoneMatch) return null;

        const matchedPhone = phoneMatch[0].replace(/\s+/g, ' ').trim();
        const tel = matchedPhone.replace(/[^0-9+]/g, '');
        const mode = bulletin.phoneMode || 'call';

        let label = 'Call';
        let href = `tel:${tel}`;

        if (mode === 'text') {
            label = 'Text';
            href = `sms:${tel}`;
        } else if (mode === 'both') {
            label = 'Call or Text';
            // Default link to call, text mentioned in label
        }

        if (bulletin.category === 'job') {
            label = mode === 'text' ? 'Text hiring' : 'Call hiring';
        }

        return {
            href: href,
            label: label,
            value: matchedPhone
        };
    }

    getLanguageTagsHtml(languages) {
        if (!languages) return '';
        const langArray = Array.isArray(languages) ? languages : String(languages).split(',').map(s => s.trim()).filter(Boolean);
        
        const langNames = {
            ENG: 'English',
            ESP: 'Español',
            POR: 'Português',
            KRE: 'Kreyòl (Haitian Creole)',
            ARA: 'Arabic',
            VIE: 'Vietnamese',
            CHI: 'Chinese'
        };

        return langArray.map(lang => {
            const code = lang.toUpperCase();
            const fullName = langNames[code] || code;
            return `
                <span title="${this.escapeAttribute(fullName)}" style="display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; color: #475569; font-size: 10px; font-weight: 800; font-family: inherit; cursor: help;">
                    ${this.escapeHtml(code)}
                </span>
            `;
        }).join('');
    }

    hasDetailInfoGridContent(bulletin) {
        if (!bulletin) return false;
        if ((bulletin.address || '').trim()) return true;
        if ((bulletin.hours || '').trim()) return true;
        const languages = Array.isArray(bulletin.languages)
            ? bulletin.languages
            : String(bulletin.languages || '').split(',').map((s) => s.trim()).filter(Boolean);
        return languages.length > 0;
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
                        <div class="detail-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
                    </div>
                    <span class="category-badge category-${bulletin.category}">${this.getCategoryDisplay(bulletin.category)}</span>
                </div>

                ${bulletin.image ? `
                    <div class="detail-image">
                        <img class="lightbox-trigger" data-lightbox-src="${bulletin.image}" src="${bulletin.image}" alt="Bulletin image for ${this.escapeHtml(bulletin.title)}">
                    </div>
                ` : ''}

                <div class="detail-body">
                    ${this.getPostDescription(bulletin) ? this.renderFormattedDescription(this.getPostDescription(bulletin), `${bulletin.id}-detail`) : ''}

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
                const titleEs = (b.titleEs || '').toLowerCase();
                return (
                    title.includes(searchTerm) ||
                    titleEs.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    company.includes(searchTerm) ||
                    contact.includes(searchTerm) ||
                    eventLink.includes(searchTerm) ||
                    advisorName.includes(searchTerm)
                );
            });
        }

        const showExpiredToggle = document.getElementById('showExpiredToggle');

        const shouldShowExpired = showExpiredToggle && showExpiredToggle.checked;
        if (!shouldShowExpired) {
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
        this.currentFeedCategory = 'all';
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
        this.updateFeedCategoryHeader();
        this.updateActiveCategoryState();
        this.updateSearchLayerCatState('all');
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
        return getPostCategoryDisplay(category);
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

        if (bulletin.dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            if (!sessions.length) return false;

            const lastSession = sessions[sessions.length - 1];
            const lastEndMs = getSessionEndMs(lastSession, bulletin.endTime || '');
            return lastEndMs > 0 && lastEndMs < now.getTime();
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

    getPostDescription(bulletin) {
        const lang = document.body.getAttribute('data-lang') || 'EN';
        if (lang === 'ES') {
            const summaryEs = (bulletin.summaryEs || '').trim();
            if (summaryEs) {
                return summaryEs;
            }
        }
        return (bulletin.description || '').trim();
    }

    getCurrentLang() {
        return document.body.getAttribute('data-lang') === 'ES' ? 'ES' : 'EN';
    }

    getLocale() {
        return this.getCurrentLang() === 'ES' ? 'es-US' : 'en-US';
    }

    getPostTitle(bulletin) {
        if (this.getCurrentLang() === 'ES') {
            const titleEs = (bulletin.titleEs || '').trim();
            if (titleEs) {
                return titleEs;
            }
        }
        return (bulletin.title || '').trim();
    }

    formatRichTextInline(rawText) {
        return renderRichTextInline(rawText);
    }

    renderFormattedDescription(rawText, bulletinId, collapsed = false) {
        if (!rawText) {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = normalizeRichTextMarkers(rawText || '');
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
        return applyRichTextInlineFormatting(html)
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
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.eventDates && bulletin.eventDates.length) || (bulletin.startDate && bulletin.endDate))) {
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
        } else if (dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            if (sessions.length) {
                const lines = formatSessionsDetailLines(
                    sessions,
                    (date) => this.formatDateLocal(date),
                    (start, end) => this.formatTimeRange(start, end)
                );
                dateHtml = `
                    <div class="meta-item">
                        <strong>Session Dates:</strong>
                        ${lines.map((line) => `<div>${this.escapeHtml(line)}</div>`).join('')}
                    </div>
                `;
            }
        }

        // Add event location if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'sessions')) {
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
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.eventDates && bulletin.eventDates.length) || (bulletin.startDate && bulletin.endDate))) {
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
            } else if (dateType === 'sessions') {
                const sessions = this.getBulletinEventSessions(bulletin);
                if (sessions.length) {
                    const lines = formatSessionsDetailLines(
                        sessions,
                        (date) => this.formatDateLocal(date),
                        (start, end) => this.formatTimeRange(start, end)
                    );
                    dateHtml = `<div><strong>Session Dates:</strong> ${lines.map((line) => this.escapeHtml(line)).join('<br>')}</div>`;
                }
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'sessions')) {
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
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
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
                        <div class="bulletin-list-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
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
            .flatMap((bulletin) => this.expandBulletinDateItems(bulletin))
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

    expandBulletinDateItems(bulletin) {
        if (bulletin.dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            return sessions.map((session) => {
                const date = this.parseDateOnly(session.date);
                if (!date) return null;

                return {
                    bulletin,
                    rawDate: session.date,
                    date,
                    kind: 'event',
                    session,
                    label: this.getDatesListLabel(bulletin, date, 'event', { session })
                };
            }).filter(Boolean);
        }

        const item = this.getDatesListItem(bulletin);
        return item ? [item] : [];
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

    getDatesListLabel(bulletin, date, kind, options = {}) {
        const locale = this.getLocale();
        const isEs = this.getCurrentLang() === 'ES';
        const dateLabel = date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
        const dayLabel = date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
        const timeRange = options.session
            ? this.formatTimeRange(options.session.startTime, options.session.endTime)
            : this.formatTimeRange(bulletin.startTime, bulletin.endTime);

        if (kind === 'deadline') {
            return isEs ? `Postular antes del ${dateLabel}` : `Apply by ${dateLabel}`;
        }

        if (kind === 'start') {
            return isEs
                ? `Comienza el ${dayLabel}${timeRange ? ` · ${timeRange}` : ''}`
                : `Starts ${dateLabel}${timeRange ? ` · ${timeRange}` : ''}`;
        }

        return `${dayLabel}${timeRange ? ` · ${timeRange}` : ''}`;
    }

    createDatesListCard(item) {
        const { bulletin, date, kind, label } = item;
        const meta = this.getCatMeta(bulletin.category);
        const title = this.getPostTitle(bulletin);
        const locale = this.getLocale();
        const isEs = this.getCurrentLang() === 'ES';
        const badgeTop = kind === 'deadline'
            ? (isEs ? 'LÍM' : 'BY')
            : date.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
        const badgeMain = date.getDate();
        const dotColor = kind === 'deadline' ? '#f08b1f' : meta.accent;
        const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        return `
            <article
                class="dates-list-card"
                data-list-date="${isoDate}"
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
                    <p class="dates-list-label">${kind === 'start' ? this.formatStartDateLabelHtml(date, bulletin) : this.escapeHtml(label)}</p>
                </div>
                <span class="dates-list-dot" aria-hidden="true"></span>
            </article>
        `;
    }

    createCalendarView(bulletins, options = {}) {
        const navigatorMode = options.navigatorMode === true;
        // Filter to only show bulletins with deadlines or events
        const calendarBulletins = bulletins.filter((bulletin) => this.bulletinHasCalendarDates(bulletin));

        // Group bulletins by date - use event date if available, otherwise deadline
        const bulletinsByDate = {};
        calendarBulletins.forEach((bulletin) => {
            const rawDates = bulletin.dateType === 'sessions'
                ? this.getBulletinEventDates(bulletin)
                : [bulletin.eventDate || bulletin.startDate || bulletin.deadline].filter(Boolean);

            rawDates.forEach((rawDate) => {
                const date = new Date(String(rawDate).split('T')[0] + 'T12:00:00');
                if (Number.isNaN(date.getTime())) {
                    return;
                }

                const dateKey = date.toDateString();
                if (!bulletinsByDate[dateKey]) {
                    bulletinsByDate[dateKey] = [];
                }
                bulletinsByDate[dateKey].push(bulletin);
            });
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
            
            const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            calendarHTML += this.createMonthlyCalendarDay(day, dayBulletins, isToday, { navigatorMode, isoDate });
        }

        calendarHTML += `
                </div>
            </div>
        `;

        return calendarHTML;
    }

    createMonthlyCalendarDay(day, bulletins, isToday, options = {}) {
        const { navigatorMode = false, isoDate = '' } = options;
        const bulletinCount = bulletins.length;
        const hasBulletins = bulletinCount > 0;
        // In navigator mode (desktop split), click scrolls the list (bound separately).
        // In popup mode (mobile), click opens the day's events.
        const clickHandler = hasBulletins && !navigatorMode
            ? `onclick="bulletinBoard.showDayEventsByIds(${JSON.stringify(bulletins.map(b => b.id))})"`
            : '';
        const dayAttr = hasBulletins && navigatorMode ? `data-calendar-day="${isoDate}"` : '';

        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasBulletins ? 'has-bulletins' : ''}"
                 data-bulletin-count="${bulletinCount}"
                 ${dayAttr}
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
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
        
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
                <div class="monthly-bulletin-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
                ${displayDate ? `
                    <div class="monthly-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                        ${displayDate}
                    </div>
                ` : ''}
            </div>
        `;
    }

    createCalendarBulletinItem(bulletin) {
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
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
