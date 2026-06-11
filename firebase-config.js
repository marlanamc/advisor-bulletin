import { db } from './src/firebase-student.js'
import { STUDENT_ADVISOR_DIRECTORY } from './src/advisor-directory.js'
import { installClientErrorLogger } from './src/error-logger.js'
import { normalizePostCategory, getPostCategoryDisplay } from './src/feed-categories.js'
import { RESOURCE_TILE_CATEGORIES } from './src/resource-categories.js'
import {
    getActionResourceChipLabel,
    MAX_RESOURCE_SERVICE_CHIPS,
    parseResourceServiceChips,
    translateResourceChipEs,
} from './src/resource-chip-labels.js'
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
    formatRichTextPlainPreview,
    toRichTextPlainText,
    getRichTextPlainLength,
    normalizeRichTextMarkers,
    truncateRichText,
} from './src/rich-text.js'
import { formatResourceHoursHtml } from './src/resource-hours.js'
import {
    normalizeResourceActionLinks,
    RESOURCE_ACTION_LINK_ICON_SVG,
    RESOURCE_ACTION_LINK_PDF_ICON_SVG,
} from './src/resource-action-links.js'
import {
    DOCUMENT_TILE_ICON_SVG,
    isDocumentResource,
    normalizeResourceKind,
    OPEN_FORM_ICON_SVG,
    RESOURCE_KIND_DOCUMENT,
} from './src/resource-kinds.js'
import { initResourceLogoTiles } from './src/resource-logo-tile.js'
import { collection, doc, getDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore'

installClientErrorLogger('student')

import { applyMethods } from './src/apply-methods.js'
import {
    recordStudentPerf,
    getScrollBehavior,
    scrollWindowTo,
    SCHOOL_CALENDAR_ANCHORS,
    RESOURCE_CATEGORY_CONFIG,
    FEED_CATEGORY_CONTENT,
    RESOURCE_ICON_SVGS,
} from './src/board-shared.js'
import { BoardCalendarMethods } from './src/board-calendar.js'
import { BoardResourcesMethods } from './src/board-resources.js'
import { BoardDetailMethods } from './src/board-detail.js'


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
        this.expandedDesktopResourceSections = new Set();
        this.mobileResourceCategoryReturnView = 'categories';
        this.resourceSearchQuery = '';
        this.currentResourceNeedChip = '';
        this.resourceNeedExpanded = false;
        this.resourceSortMode = 'default';
        this.datesViewMode = 'list';
        this.isSearchLayerOpen = false;
        this.trackedCardViews = new Set();
        this.activeDetailBulletinId = null;
        this.bulletinsHydrated = false;
        this.firestoreFirstSnapshotRecorded = false;
        // Static fallback until config/studentDirectory loads from Firestore.
        this.advisorDirectory = STUDENT_ADVISOR_DIRECTORY;
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
        this.loadAdvisorDirectory();
        this.switchView('feed', { skipRender: true, preserveDetail: true });
        this.closeSearchLayer({ preserveScroll: true, silent: true });
        window.addEventListener('hashchange', this.handleHashChange);
    }

    /**
     * Replace the static advisor directory with the one published from the
     * admin Advisors tab (config/studentDirectory). Falls back silently to
     * src/advisor-directory.js when the doc is missing or unreadable.
     */
    async loadAdvisorDirectory() {
        try {
            const snap = await getDoc(doc(db, 'config', 'studentDirectory'));
            const advisors = snap.exists() ? snap.data().advisors : null;
            if (!Array.isArray(advisors) || advisors.length === 0) return;
            const cleaned = advisors
                .filter((a) => a && typeof a.name === 'string' && a.name.trim())
                .map((a) => ({
                    name: String(a.name).trim(),
                    role: String(a.role || 'Advisor').trim(),
                    email: String(a.email || '').trim(),
                    loginUsername: String(a.loginUsername || '').trim(),
                }));
            if (cleaned.length === 0) return;
            this.advisorDirectory = cleaned;
            const aboutList = document.getElementById('aboutAdvisorList');
            if (aboutList) delete aboutList.dataset.rendered;
            this.renderStudentAdvisorDirectory();
            this.renderAboutAdvisorList();
        } catch (error) {
            console.error('Error loading advisor directory:', error);
        }
    }

    // --- bulletin cache helpers ---
    // Persist across browser sessions so returning students see the last feed
    // immediately while Firestore refreshes in the background.
    static CACHE_KEY = 'ebhcs_bulletins_v1';
    static CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

    _readCache() {
        try {
            const raw = localStorage.getItem(FirebaseBulletinBoard.CACHE_KEY)
                || sessionStorage.getItem(FirebaseBulletinBoard.CACHE_KEY);
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
            const payload = JSON.stringify({ ts: Date.now(), bulletins });
            localStorage.setItem(FirebaseBulletinBoard.CACHE_KEY, payload);
            sessionStorage.setItem(FirebaseBulletinBoard.CACHE_KEY, payload);
        } catch {
            // Storage full or unavailable — skip silently.
        }
    }

    showBulletinsLoading() {
        const grid = document.getElementById('bulletinGrid');
        const emptyState = document.getElementById('feedEmptyState');
        if (grid?.getAttribute('data-snapshot-rendered') === 'true') {
            return;
        }
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        if (grid) {
            grid.innerHTML = `
                <div class="feed-loading-state" role="status" aria-live="polite">
                    <p>Loading posts…</p>
                    <p class="empty-state-bilingual">Cargando publicaciones…</p>
                </div>
            `;
        }
    }

    applyBulletinSnapshot(snapshot) {
        if (!this.firestoreFirstSnapshotRecorded) {
            this.firestoreFirstSnapshotRecorded = true;
            recordStudentPerf('ebhcs:firestore-first-snapshot', { size: snapshot.size });
        }
        const next = [];
        snapshot.forEach((docSnap) => {
            next.push({
                id: docSnap.id,
                ...this.normalizeBulletin(docSnap.data()),
            });
        });

        this.bulletins = next;
        this.bulletinsHydrated = true;
        this._writeCache(this.bulletins);
        this.populateAdvisorFilters();
        this.renderResourceCategoryFilters();
        this.displayBulletins();
        recordStudentPerf('ebhcs:cards-rendered', { count: this.bulletins.length });
    }

    setupRealtimeListener() {
        // Render from cache immediately so the feed appears before Firestore responds.
        const cached = this._readCache();
        if (cached && cached.length > 0) {
            this.bulletins = cached;
            this.bulletinsHydrated = true;
            this.populateAdvisorFilters();
            this.renderResourceCategoryFilters();
            this.displayBulletins();
            recordStudentPerf('ebhcs:cards-rendered', { source: 'bulletin-cache', count: this.bulletins.length });
        } else {
            this.showBulletinsLoading();
        }

        const q = query(collection(db, 'bulletins'), where('isActive', '==', true), orderBy('datePosted', 'desc'));
        onSnapshot(q, (snapshot) => {
            // Ignore empty cache-only snapshots while the server response is still pending.
            if (snapshot.empty && snapshot.metadata.fromCache && !this.bulletinsHydrated) {
                return;
            }
            this.applyBulletinSnapshot(snapshot);
        }, (error) => {
            console.error('Error loading bulletins:', error);
            this.bulletinsHydrated = true;
            const grid = document.getElementById('bulletinGrid');
            if (grid) {
                if (this.bulletins.length > 0) {
                    this.displayBulletins();
                    return;
                }
                // Keep snapshot cards on screen if they already rendered —
                // slightly stale posts beat an error card.
                if (grid.getAttribute('data-snapshot-rendered') === 'true') {
                    return;
                }
                grid.innerHTML = '<div class="feed-load-error" role="alert"><p>Could not load posts. Check your connection and try again.</p><p class="empty-state-bilingual">No se pudieron cargar las publicaciones. Comprueba tu conexión.</p><button type="button" class="feed-load-retry" onclick="window.location.reload()">Try again / Intentar de nuevo</button></div>';
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
            const firstSession = sessions[0];
            const firstParsed = this.parseStoredYmdLocal(firstSession.date);
            const firstLabel = firstParsed
                ? firstParsed.toLocaleDateString(this.getLocale(), { month: 'short', day: 'numeric' })
                : firstSession.date;
            return isEs
                ? `${formatted.length} sesiones desde el ${firstLabel}`
                : `${formatted.length} sessions starting ${firstLabel}`;
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
        const prefix = isEs ? 'Comienza el' : 'From';
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
                        scrollWindowTo(0);
                    }
                }
            });
        });

        const aboutAdvisorTrigger = document.querySelector('.about-advisor-accordion-trigger');
        const isDesktopAboutAdvisorNav = () => window.matchMedia('(min-width: 769px)').matches;
        if (aboutAdvisorTrigger) {
            aboutAdvisorTrigger.addEventListener('click', (event) => {
                if (!isDesktopAboutAdvisorNav()) return;
                event.preventDefault();
                this.switchView('advisors');
                scrollWindowTo(0);
            });

            aboutAdvisorTrigger.addEventListener('keydown', (event) => {
                if (!isDesktopAboutAdvisorNav() || !['Enter', ' '].includes(event.key)) return;
                event.preventDefault();
                this.switchView('advisors');
                scrollWindowTo(0);
            });
        }

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
                if (this.currentResourceNeedChip) {
                    this.currentResourceNeedChip = '';
                }
                this.openResourceShortcut(category);
            });
        }

        const resourceNeedSection = document.getElementById('resourceNeedSearch');
        if (resourceNeedSection) {
            resourceNeedSection.addEventListener('click', (event) => {
                const chip = event.target.closest('[data-need-chip]');
                if (chip) {
                    const label = chip.getAttribute('data-need-chip') || '';
                    this.setResourceNeedChip(label);
                    return;
                }
                if (event.target.closest('#resourceNeedChange')) {
                    this.setResourceNeedChip('');
                    return;
                }
                if (event.target.closest('#resourceNeedToggle')) {
                    this.toggleResourceNeedDirectory();
                }
            });
        }

        document.addEventListener('click', (event) => {
            const shortcut = event.target.closest('[data-resource-shortcut]');
            if (!shortcut) {
                return;
            }

            const category = shortcut.getAttribute('data-resource-shortcut');
            if (category) {
                this.openResourceShortcut(category);
            }
        });

        const feedCategoryClear = document.getElementById('feedCategoryClear');
        if (feedCategoryClear) {
            feedCategoryClear.addEventListener('click', () => this.setFeedCategory('all'));
        }

        this.setupResourceDetailSheet();

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
            if (showAll) {
                const category = showAll.getAttribute('data-cat-show-all');
                if (category) {
                    this.closeResourceDetailSheet();
                    this.navigateToResourceCategory(category, { expandDesktop: true });
                }
                return;
            }

            const moreBtn = event.target.closest('[data-resource-more]');
            if (moreBtn) {
                event.preventDefault();
                this.openResourceFromSheet(moreBtn.getAttribute('data-resource-more'));
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
            scrollWindowTo(0);
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

        if (view === 'resources' && previousView !== 'resources' && !options.preserveResourceNavigation) {
            this.currentDesktopResourceTopic = 'all';
            this.currentResourceCategory = 'all';
            this.expandedDesktopResourceSections.clear();
        }

        // Leaving Help: reset the in-page category drill so the next visit lands on tiles.
        if (previousView === 'resources' && view !== 'resources') {
            this.currentResourceCategory = 'all';
            this.currentDesktopResourceTopic = 'all';
            this.expandedDesktopResourceSections.clear();
            this.mobileResourceCategoryReturnView = 'categories';
            document.body.classList.remove('resource-category-detail-open');
        }

        if (view === 'advisors') {
            this.renderStudentAdvisorDirectory();
        }

        if (view === 'about') {
            this.renderAboutAdvisorList();
        }

        if (window.matchMedia('(max-width: 768px)').matches) {
            scrollWindowTo(0);
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

        list.innerHTML = this.advisorDirectory.map((advisor, index) => {
            const name = this.escapeHtml(advisor.name);
            const role = this.escapeHtml(advisor.role);
            const email = this.escapeHtml(advisor.email || '');
            const initials = this.escapeHtml(this.getAdvisorInitials(advisor.name));
            const avatarColor = this.getAdvisorAvatarColor(index, this.advisorDirectory.length);
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

    renderAboutAdvisorList() {
        const list = document.getElementById('aboutAdvisorList');
        if (!list) {
            return;
        }
        if (list.dataset.rendered === 'true') {
            return;
        }

        list.innerHTML = this.advisorDirectory.map((advisor, index) => {
            const name = this.escapeHtml(advisor.name);
            const role = this.escapeHtml(advisor.role);
            const email = this.escapeHtml(advisor.email || '');
            const initials = this.escapeHtml(this.getAdvisorInitials(advisor.name));
            const avatarColor = this.getAdvisorAvatarColor(index, this.advisorDirectory.length);
            return `
                <a class="about-advisor-row" href="mailto:${email}" aria-label="Email ${name} at ${email}">
                    <span class="about-advisor-row-avatar" style="background:${avatarColor.background};color:${avatarColor.color}" aria-hidden="true">${initials}</span>
                    <span class="about-advisor-row-text">
                        <span class="about-advisor-row-name">${name}</span>
                        <span class="about-advisor-row-role">${role}</span>
                    </span>
                    <svg class="about-advisor-row-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                        <path d="m3 7 9 6 9-6"></path>
                    </svg>
                </a>
            `;
        }).join('');
        list.dataset.rendered = 'true';
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
        this.refreshOpenBulletinDetail();
    }

    refreshOpenBulletinDetail() {
        const detailModal = document.getElementById('bulletinDetailModal');
        if (this.activeDetailBulletinId && detailModal?.style.display === 'flex') {
            this.showBulletinDetail(this.activeDetailBulletinId);
        }
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

        if (!this.bulletinsHydrated) {
            this.showBulletinsLoading();
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
        grid.innerHTML = bulletins.map((bulletin, idx) => this.createBulletinCard(bulletin, idx)).join('');
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
        if (isDocumentResource(resource)) {
            return DOCUMENT_TILE_ICON_SVG;
        }

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
        targetCard.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });

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

        const bulletin = this.bulletins.find((b) => b.id === bulletinId)
            || SCHOOL_CALENDAR_ANCHORS.find((b) => b.id === bulletinId);

        if (!bulletin) {
            body.innerHTML = `<div class="detail-card"><p>This bulletin is no longer available.</p></div>`;
        } else {
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
        document.body.style.overflow = '';

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
        if (bulletins.length === 1) {
            this.showBulletinDetail(bulletins[0].id);
            return;
        }
        this.showDayEvents(bulletins);
    }

    getCatMeta(category) {
        const map = {
            job:           { accent: '#1e40af', tint: '#dbeafe', grad: 'linear-gradient(145deg,#bfdbfe 0%,#dbeafe 100%)', label: 'Job Help',     labelEs: 'Ayuda con empleo', badge: 'HELP',         emoji: '💼' },
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

    getSchoolBoatIconSvg() {
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4.5v10.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M12 4.5 19 14.5H12Z" fill="rgba(255,255,255,0.18)" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><path d="M12 9 5 16h14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 16c1.35 2.35 3.55 3.5 6 3.5s4.65-1.15 6-3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M4 19.5h16" stroke="#c9a84c" stroke-width="1.6" stroke-linecap="round"/></svg>`;
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
        const descPreview = formatRichTextPlainPreview(desc, 150);
        const descHtml = this.escapeHtml(descPreview);

        const dateLabelHtml = this.formatFeedDateDisplayHtml(bulletin);

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

        // If the card is in the top 3 cards (above-the-fold), load it with high priority
        // Otherwise, lazy-load it to prevent bandwidth starvation
        const imageAttributes = index < 3
            ? 'decoding="async" fetchpriority="high"'
            : 'decoding="async" loading="lazy"';

        return `
    <article class="pc ${isExpired ? 'pc--expired' : ''}" id="bulletin-${bulletin.id}" data-bulletin-id="${bulletin.id}" role="button" tabindex="0" style="cursor:pointer">
      ${chipsBar}
      <div class="pc__top ${hasImage ? 'pc__top--image' : ''}" style="background:${hasImage ? '#f8fafc' : meta.grad}">
        ${hasImage
          ? `<div class="pc__image-stage"><img class="pc__poster-image" src="${this.escapeAttribute(displayImage)}" alt="" ${imageAttributes}></div>`
          : `<div class="pc__icon-wrap"><div class="pc__icon-box" style="background:${meta.accent}">${this.getCardIconSvg(bulletin.category)}</div></div>
        <div class="pc__title-overlay">${this.escapeHtml(titleShort)} —</div>`}
      </div>

      <div class="pc__body">
        <h3 class="pc__title">${this.escapeHtml(title)}</h3>
        <p class="pc__desc">${descHtml}</p>

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

    // Filter and Search Methods
    applyFilters() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // If on resources view, use context-aware search for resources
        if (this.currentView === 'resources') {
            this.resourceSearchQuery = searchTerm;
            this.renderResourcesSections(this.getPublishedResources());
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
            const bulletin = this.bulletins.find(b => b.id === bulletinId);

            if (!bulletin) {
                throw new Error('Bulletin not found.');
            }

            if (!bulletin.pdfUrl) {
                throw new Error('PDF not found for this bulletin.');
            }

            await this.openResourcePdf(bulletin.pdfUrl);
        } catch (error) {
            console.error('Error opening PDF:', error);
            alert('Failed to open PDF: ' + error.message);
        }
    }

    async openResourcePdf(pdfUrl) {
        if (!pdfUrl) {
            throw new Error('PDF not found.');
        }

        if (pdfUrl.startsWith('data:')) {
            if (!window.fetch || !window.URL || !window.URL.createObjectURL) {
                throw new Error('Your browser does not support PDF viewing. Please try a modern browser.');
            }

            const response = await fetch(pdfUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open(blobUrl, '_blank');

            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            if (!newWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }
            return;
        }

        const newWindow = window.open(pdfUrl, '_blank');
        if (!newWindow) {
            throw new Error('Popup blocked. Please allow popups for this site.');
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

        const formatted = renderRichTextInline(rawText, { wrapParagraphs: true });

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

applyMethods(FirebaseBulletinBoard, BoardCalendarMethods)
applyMethods(FirebaseBulletinBoard, BoardResourcesMethods)
applyMethods(FirebaseBulletinBoard, BoardDetailMethods)

// Share functionality
function shareBulletin(bulletinId, bulletinTitle) {
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

function initBulletinBoard() {
    if (window.bulletinBoard) {
        return;
    }
    bulletinBoard = new FirebaseBulletinBoard();
    window.bulletinBoard = bulletinBoard;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBulletinBoard, { once: true });
} else {
    initBulletinBoard();
}
