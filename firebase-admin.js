import { db, auth, storage } from './src/firebase.js'
import { getPublicAdvisorEmail, STUDENT_ADVISOR_DIRECTORY } from './src/advisor-directory.js'
import { installClientErrorLogger } from './src/error-logger.js'
import { getPostCategoryDisplay } from './src/feed-categories.js'
import { AUTHORABLE_RESOURCE_CATEGORIES, AUTHORABLE_RESOURCE_CATEGORY_SET } from './src/resource-categories.js'
import {
    formatResourceServiceChipsInput,
    getSuggestedResourceChips,
    MAX_RESOURCE_SERVICE_CHIPS,
    parseResourceServiceChips,
} from './src/resource-chip-labels.js'
import {
    getResourceActionLinkFieldValues,
    MAX_RESOURCE_ACTION_LINKS,
    normalizeResourceActionLinks,
    parseResourceActionLinkSlotsFromForm,
    stripActionLinkUploadMeta,
} from './src/resource-action-links.js'
import { initAdminFieldHelp } from './src/admin-field-help.js'
import {
    isDocumentResource,
    normalizeResourceKind,
    RESOURCE_KIND_DOCUMENT,
} from './src/resource-kinds.js'
import {
    MAX_EVENT_SESSIONS,
    normalizeEventSessions,
    parseSessionEntry,
    sessionsFromFormData,
    sessionsShareSameTime,
    formatSessionsDetailLines,
    getMultiSessionFeedSortMs,
    getNextSessionStartMs,
} from './src/event-sessions.js'
import { initDescriptionFormatToolbars, refreshRichEditors, syncRichEditorsToForm, getRichTextFieldValue } from './src/description-format.js'
import { collection, doc, query, where, orderBy, onSnapshot, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore'

installClientErrorLogger('admin')
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

// Admin-specific display data (label, emoji, icon) keyed by the canonical
// resource categories from src/resource-categories.js. The dropdown order
// below is the order advisors see in the form. The key set is asserted at
// module load against AUTHORABLE_RESOURCE_CATEGORIES so a category added to
// the canonical list cannot silently be missing from the admin form.
const ADMIN_RESOURCE_CATEGORY_DATA = {
    immigration: ['Immigration / Inmigración', '🌎', 'shield'],
    jobs:        ['Jobs / Empleos', '💼', 'briefcase'],
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
const ADMIN_RESOURCE_CATEGORIES = Object.entries(ADMIN_RESOURCE_CATEGORY_DATA)
    .map(([key, [label, emoji, icon]]) => [key, label, emoji, icon]);

const ADMIN_RESOURCE_CATEGORY_LABELS = Object.fromEntries(
    ADMIN_RESOURCE_CATEGORIES.map(([key, label]) => [key, label])
);

const ADMIN_RESOURCE_CATEGORY_ICONS = Object.fromEntries(
    ADMIN_RESOURCE_CATEGORIES.map(([key, , , icon]) => [key, icon])
);

const ADMIN_RESOURCE_ICON_LABELS = {
    auto: 'Auto',
    shield: 'Shield',
    briefcase: 'Briefcase',
    home: 'Home',
    heart: 'Health',
    scale: 'Legal Aid',
    globe: 'Globe'
};

function isPdfFile(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

function isFlyerImageFile(file) {
    if (!file) return false;
    if (isPdfFile(file)) return true;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.type && allowedTypes.includes(file.type)) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(file.name || '');
}

function isImageOnlyFile(file) {
    if (!file) return false;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (file.type && allowedTypes.includes(file.type)) return true;
    return /\.(jpe?g|png|gif|webp)$/i.test(file.name || '');
}

// Firebase-enabled Admin Panel
class FirebaseAdminPanel {
    constructor() {
        this.currentUser = null;
        this.bulletins = [];
        this.pendingImageData = null;
        this.pendingImageEsData = null;
        this.pendingResourceLogoData = null;
        this.removeResourceLogo = false;
        this.removeResourcePdf = false;
        this.removedActionLinkPdfSlots = new Set();
        this.isSubmitting = false;
        this.contentType = 'post';
        this.contentMode = 'post';
        this.bulletinsUnsubscribe = null;
        this.advisors = STUDENT_ADVISOR_DIRECTORY.map(a => ({
            username: a.loginUsername,
            displayName: a.name,
            email: a.email,
            isAdmin: a.loginUsername === 'admin'
        }));
        this.authTransitionInProgress = false;
        this.resourceReorderMode = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setupOfflineHandling();
        this.setupRedesignEnhancements();
    }

    setupRealtimeListener() {
        if (this.bulletinsUnsubscribe) {
            return;
        }

        const q = query(collection(db, 'bulletins'), where('isActive', '==', true), orderBy('datePosted', 'desc'))
        this.bulletinsUnsubscribe = onSnapshot(q, (snapshot) => {
            this.bulletins = [];
            snapshot.forEach((doc) => {
                this.bulletins.push({
                    id: doc.id,
                    ...this.normalizeBulletin(doc.data())
                });
            });
            this.updateAdvisorDashboard();
            if (this.currentUser) {
                this.loadManageBulletins();
            }
            this.hideOfflineMessage();
        }, (error) => {
            console.error('Error loading bulletins:', error);
            this.showOfflineMessage('Unable to load bulletins. Please check your internet connection.');
        });
    }

    setupOfflineHandling() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.hideOfflineMessage();
            this.showTemporaryMessage('Connection restored! 🌊', 'success');
        });

        window.addEventListener('offline', () => {
            this.showOfflineMessage('You\'re offline. Some features may not work until connection is restored.');
        });
    }

    showOfflineMessage(message) {
        let offlineBar = document.getElementById('offlineBar');
        if (!offlineBar) {
            offlineBar = document.createElement('div');
            offlineBar.id = 'offlineBar';
            offlineBar.className = 'offline-bar';
            document.body.appendChild(offlineBar);
        }
        offlineBar.textContent = message;
        offlineBar.style.display = 'block';
    }

    hideOfflineMessage() {
        const offlineBar = document.getElementById('offlineBar');
        if (offlineBar) {
            offlineBar.style.display = 'none';
        }
    }

    bindEvents() {
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Login form is handled by enhanced-auth.js
        document.addEventListener('userAuthenticated', (event) => {
            this.handleUserAuthenticated(event.detail);
        });

        // Bulletin form
        document.getElementById('bulletinForm').addEventListener('submit', (e) => this.handleBulletinSubmit(e));

        document.querySelectorAll('.content-type-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const nextType = button.getAttribute('data-content-type');
                this.setContentType(nextType);
            });
        });

        this.populateResourceCategoryField();
        const resourceCategory = document.getElementById('resourceCategory');
        if (resourceCategory) {
            resourceCategory.addEventListener('change', (event) => {
                this.handleResourceCategoryChange(event.target.value);
                this.syncResourceCategoryPicker(event.target.value);
            });
        }

        // Form validation
        this.setupFormValidation();

        // Image upload preview — inputs may be dynamic (post-composer), so delegate from bulletinForm
        const bulletinFormEl = document.getElementById('bulletinForm');
        if (bulletinFormEl) {
            bulletinFormEl.addEventListener('change', (e) => {
                if (e.target.name === 'image') this.handleImagePreview(e, 'image');
                else if (e.target.name === 'imageEs') this.handleImagePreview(e, 'imageEs');
                else if (e.target.name === 'resourceLogo') this.handleImagePreview(e, 'resourceLogo');
            });
        }
        const resourceLogoInput = document.getElementById('resourceLogo');
        if (resourceLogoInput && !bulletinFormEl?.contains(resourceLogoInput)) {
            resourceLogoInput.addEventListener('change', (e) => this.handleImagePreview(e, 'resourceLogo'));
        }

        this.setupFileDropzone('.ap-visual-flyer-zone', 'image', 'image');
        this.setupFileDropzone('.ap-upload-dropzone-es', 'imageEs', 'imageEs');

        const addEventDateBtn = document.getElementById('addEventDateBtn');
        if (addEventDateBtn) {
            addEventDateBtn.addEventListener('click', () => this.addEventDateRow());
        }

        const sessionSameTimeToggle = document.getElementById('sessionSameTimeToggle');
        if (sessionSameTimeToggle) {
            sessionSameTimeToggle.addEventListener('change', () => this.syncSessionSameTimeUI({ fromToggle: true }));
        }
        ['sessionSharedStartTime', 'sessionSharedEndTime'].forEach((id) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    if (typeof window.syncAdminStudentPreview === 'function') {
                        window.syncAdminStudentPreview();
                    }
                });
                input.addEventListener('change', () => {
                    if (typeof window.syncAdminStudentPreview === 'function') {
                        window.syncAdminStudentPreview();
                    }
                });
            }
        });

        this.renderEventDatesList([{ date: '' }]);
        
        // PDF upload preview
        const pdfInput = document.getElementById('pdf');
        if (pdfInput) {
            pdfInput.addEventListener('change', (e) => this.handlePdfPreview(e));
        }

        const resourcePdfInput = document.getElementById('resourcePdf');
        if (resourcePdfInput) {
            resourcePdfInput.addEventListener('change', (e) => this.handleResourcePdfPreview(e));
        }

        document.querySelectorAll('input[name="resourceKind"]').forEach((input) => {
            input.addEventListener('change', () => this.syncResourceKindUI());
        });

        this.initResourceActionLinkSlots();
        initAdminFieldHelp(document.getElementById('bulletinForm'));

        const flyerEsToggle = document.getElementById('apFlyerEsToggle');
        if (flyerEsToggle) {
            flyerEsToggle.addEventListener('click', () => this.toggleSpanishFlyerPanel());
        }

        this.syncFlyerUploadUI();

        initDescriptionFormatToolbars();

        this.setContentType('post', { preserveFields: true, silent: true });

        // Manage tab: search, sort, filter
        const manageSearch = document.getElementById('manageSearchInput');
        const manageSort = document.getElementById('manageSortSelect');
        const manageFilter = document.getElementById('manageFilterSelect');
        const rerender = () => this.loadManageBulletins();
        const manageContentType = document.getElementById('manageContentTypeSelect');
        if (manageSearch) manageSearch.addEventListener('input', rerender);
        if (manageSort) manageSort.addEventListener('change', rerender);
        if (manageFilter) manageFilter.addEventListener('change', rerender);
        if (manageContentType) manageContentType.addEventListener('change', () => {
            if (manageContentType.value !== 'resource' && this.resourceReorderMode) {
                this.resourceReorderMode = false;
            }
            this.updateReorderToggleUI();
            rerender();
        });
        this.updateReorderToggleUI();

        document.querySelectorAll('[data-school-event-preset]').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.getAttribute('data-school-event-preset');
                this.applySchoolEventPreset(mode);
            });
        });
    }

    applySchoolEventPreset(mode, options = {}) {
        if (!options.keepContentMode) {
            this.setContentType('post', { preserveFields: true, silent: true });
        }

        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.value = 'announcement';
            categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
            this.syncCategoryPicker('announcement');
        }

        const dateTypeSelect = document.getElementById('dateType');
        if (dateTypeSelect) {
            dateTypeSelect.value = 'event';
            toggleDateFields();
            if (this.contentMode === 'event') {
                const eventDateLabel = document.querySelector('label[for="eventDate"]');
                if (eventDateLabel) eventDateLabel.textContent = 'Date';
            }
        }

        document.getElementById('eventDetailsSection')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }

    setupRedesignEnhancements() {
        document.querySelectorAll('[data-admin-tab-target]').forEach((button) => {
            button.addEventListener('click', (event) => {
                const tabName = event.currentTarget.getAttribute('data-admin-tab-target');
                this.showTab(tabName);
            });
        });

        document.querySelectorAll('[data-category-pick]').forEach((button) => {
            button.addEventListener('click', (event) => {
                const category = event.currentTarget.getAttribute('data-category-pick');
                const select = document.getElementById('category');
                if (!select) return;

                select.value = category;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                this.syncCategoryPicker(category);
                this.syncClassTypeForCategory(category);
            });
        });

        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            categorySelect.addEventListener('change', (event) => {
                this.syncClassTypeForCategory(event.target.value);
            });
        }

        this.updateAdvisorDashboard();
    }

    syncFlyerUploadUI() {
        const imageInput = document.getElementById('image');
        const imagePreview = document.getElementById('imagePreview');
        const pdfAddon = document.getElementById('apFlyerPdfAddon');
        const choosePdfButton = pdfAddon?.querySelector('.ap-flyer-pdf-choose');
        const sourcePdfAttach = pdfAddon?.querySelector('.ap-source-pdf-attach');
        const hasImagePreview = Boolean(imagePreview?.querySelector('.preview-image'));

        if (!pdfAddon) return;

        pdfAddon.removeAttribute('hidden');

        const file = imageInput?.files?.[0];
        const fromPdf = hasImagePreview && Boolean(this.pendingImageData?.convertedFromPdf || (file && isPdfFile(file)));

        if (fromPdf) {
            this.removePdfPreview();
            if (choosePdfButton) choosePdfButton.setAttribute('hidden', '');
            if (sourcePdfAttach) sourcePdfAttach.removeAttribute('hidden');
        } else {
            if (choosePdfButton) choosePdfButton.removeAttribute('hidden');
            if (sourcePdfAttach) sourcePdfAttach.setAttribute('hidden', '');
        }
    }

    assignFileToInput(input, file) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
    }

    setupFileDropzone(zoneSelector, inputId, fieldName) {
        const zone = document.querySelector(zoneSelector);
        const input = document.getElementById(inputId);
        if (!zone || !input) return;

        const acceptsFlyerPdf = fieldName === 'image' || fieldName === 'imageEs';
        const acceptFile = acceptsFlyerPdf ? isFlyerImageFile : isImageOnlyFile;
        const rejectMessage = acceptsFlyerPdf
            ? 'Please drop a PNG, JPG, or PDF under 10MB.'
            : 'Please drop a PNG or JPG under 10MB.';

        zone.addEventListener('click', (event) => {
            if (event.target.closest('.remove-image')) return;
            input.click();
        });

        zone.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                input.click();
            }
        });

        ['dragenter', 'dragover'].forEach((eventName) => {
            zone.addEventListener(eventName, (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = 'copy';
                }
                zone.classList.add('dragover');
            });
        });

        zone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            if (!zone.contains(event.relatedTarget)) {
                zone.classList.remove('dragover');
            }
        });

        zone.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
            zone.classList.remove('dragover');

            const file = Array.from(event.dataTransfer?.files || []).find(acceptFile);
            if (!file) {
                this.showTemporaryMessage(rejectMessage, 'error');
                return;
            }

            this.assignFileToInput(input, file);
            this.handleImagePreview({ target: input }, fieldName);
        });
    }

    toggleSpanishFlyerPanel(forceOpen) {
        const panel = document.getElementById('apFlyerEsPanel');
        const toggle = document.getElementById('apFlyerEsToggle');
        if (!panel || !toggle) return;

        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : panel.hasAttribute('hidden');

        if (shouldOpen) {
            panel.removeAttribute('hidden');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.textContent = '− Hide Spanish flyer (ES)';
        } else {
            panel.setAttribute('hidden', '');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = '+ Add Spanish flyer (ES)';
        }
    }

    // Authentication Methods
    setAuthView(view, message = 'Checking your session...') {
        const loadingEl = document.getElementById('authLoadingScreen');
        const loadingMsg = document.getElementById('authLoadingMessage');
        const loginRequired = document.getElementById('loginRequired');
        const adminPanel = document.getElementById('adminPanel');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loadingMsg) {
            loadingMsg.textContent = message;
        }

        if (view === 'loading') {
            if (loadingEl) {
                loadingEl.style.display = 'flex';
                loadingEl.setAttribute('aria-busy', 'true');
            }
            if (loginRequired) loginRequired.style.display = 'none';
            if (adminPanel) adminPanel.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            document.body.classList.remove('ap-portal-active');
            return;
        }

        if (loadingEl) {
            loadingEl.style.display = 'none';
            loadingEl.setAttribute('aria-busy', 'false');
        }

        if (view === 'login') {
            if (loginRequired) loginRequired.style.display = 'grid';
            if (adminPanel) adminPanel.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            document.body.classList.remove('ap-portal-active');
            return;
        }

        if (view === 'portal') {
            if (loginRequired) loginRequired.style.display = 'none';
        }
    }

    async handleUserAuthenticated(userDetails) {
        await this.applyAuthenticatedUser(userDetails);
    }

    async applyAuthenticatedUser(userDetails) {
        if (this.authTransitionInProgress) {
            return;
        }

        this.authTransitionInProgress = true;
        this.setAuthView('loading', 'Signing you in...');

        try {
            const username = userDetails.username;

            // Set current user immediately with whatever name we have so the
            // panel can open without waiting on Firestore.
            this.currentUser = {
                username,
                email: userDetails.email,
                name: userDetails.name || username,
                isAdmin: false
            };

            this.setAuthView('loading', `Welcome back, ${this.currentUser.name}!`);
            this.showAdminPanel();
            this.clearLoginForm();
            this.setupRealtimeListener();
            this.loadManageBulletins();

            // Load full advisor metadata in the background and patch the live UI.
            this.loadAdvisorsFromFirestore().then(() => {
                const advisor = this.advisors.find(a => a.username === username);
                if (advisor) {
                    this.currentUser.name = advisor.displayName || this.currentUser.name;
                    this.currentUser.isAdmin = advisor.isAdmin === true;
                    const welcome = document.getElementById('welcomeMessage');
                    if (welcome) welcome.textContent = `Welcome, ${this.currentUser.name}!`;

                    // Update admin tab visibility dynamically once loaded
                    const advisorsTabBtn = document.getElementById('advisorsTabBtn');
                    if (advisorsTabBtn) advisorsTabBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
                    const advisorsRailBtn = document.getElementById('advisorsRailBtn');
                    if (advisorsRailBtn) advisorsRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
                }
            }).catch(err => console.error('Error loading advisor metadata:', err));
        } catch (error) {
            console.error('Error signing in to advisor portal:', error);
            this.currentUser = null;
            this.setAuthView('login');
            throw error;
        } finally {
            this.authTransitionInProgress = false;
        }
    }

    handleSignedOut() {
        this.currentUser = null;
        if (this.bulletinsUnsubscribe) {
            this.bulletinsUnsubscribe();
            this.bulletinsUnsubscribe = null;
        }
        this.hideAdminPanel();
        this.clearLoginForm();
        this.setAuthView('login');
    }

    getUserDisplayName(username) {
        const fromFirestore = this.advisors.find(a => a.username === username);
        if (fromFirestore) return fromFirestore.displayName;
        return username;
    }

    async loadAdvisorsFromFirestore() {
        try {
            const snap = await getDocs(collection(db, 'advisors'));
            this.advisors = snap.docs.map(d => ({ username: d.id, ...d.data() }));
        } catch (e) {
            console.error('Error loading advisors:', e);
            this.advisors = [];
        }
    }

    checkAutoLogin() {
        if (typeof auth === 'undefined') {
            console.error('Firebase auth not initialized');
            this.setAuthView('login');
            return;
        }

        this.setAuthView('loading', 'Checking your session...');

        auth.authStateReady().catch((error) => {
            console.error('Auth readiness error:', error);
            this.setAuthView('login');
        });

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (this.authTransitionInProgress) {
                    return;
                }

                const username = user.email.split('@')[0];

                try {
                    const userDoc = await getDoc(doc(db, 'users', username));
                    if (userDoc.exists() && userDoc.data().requirePasswordChange === true) {
                        this.setAuthView('login');
                        if (window.enhancedAuth) {
                            window.enhancedAuth.showPasswordChangeModal(username);
                        }
                        return;
                    }
                } catch (error) {
                    console.error('Error checking user password status:', error);
                }

                if (!this.currentUser || this.currentUser.username !== username) {
                    await this.applyAuthenticatedUser({
                        username,
                        email: user.email,
                        name: this.getUserDisplayName(username)
                    });
                }
                return;
            }

            if (this.authTransitionInProgress) {
                return;
            }

            this.handleSignedOut();
        });
    }

    async logout() {
        try {
            if (typeof auth === 'undefined') {
                throw new Error('Firebase auth not initialized');
            }
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    clearLoginForm() {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    showAdminPanel() {
        this.setAuthView('portal');
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'block';
        document.body.classList.add('ap-portal-active');
        document.getElementById('welcomeMessage').textContent = `Welcome, ${this.currentUser.name}!`;

        // Show advisors tab only for admins
        const advisorsTabBtn = document.getElementById('advisorsTabBtn');
        if (advisorsTabBtn) advisorsTabBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
        const advisorsRailBtn = document.getElementById('advisorsRailBtn');
        if (advisorsRailBtn) advisorsRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';

        this.setContentType(this.contentType || 'post', { preserveFields: true, silent: true });
    }

    hideAdminPanel() {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
        document.body.classList.remove('ap-portal-active');
    }

    normalizeBulletin(data) {
        const normalized = {
            ...data,
            type: data.type || 'post',
            isPublished: data.isPublished !== false
        };

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

    getBulletinEventSessions(bulletin, fallbackStart = '', fallbackEnd = '') {
        if (!bulletin || bulletin.dateType !== 'sessions') return [];
        if (Array.isArray(bulletin.eventDates) && bulletin.eventDates.length) {
            return normalizeEventSessions(
                bulletin.eventDates,
                fallbackStart || bulletin.startTime || '',
                fallbackEnd || bulletin.endTime || ''
            );
        }
        if (bulletin.eventDate) {
            return normalizeEventSessions(
                [bulletin.eventDate],
                fallbackStart || bulletin.startTime || '',
                fallbackEnd || bulletin.endTime || ''
            );
        }
        return [];
    }

    getManagePostTimestamp(bulletin) {
        if (!bulletin?.datePosted) return 0;
        return bulletin.datePosted.toDate ? bulletin.datePosted.toDate().getTime() : new Date(bulletin.datePosted).getTime();
    }

    getManageSortTimestamp(bulletin) {
        const postedMs = this.getManagePostTimestamp(bulletin);
        if (!bulletin || bulletin.dateType !== 'sessions') {
            return postedMs;
        }

        return getMultiSessionFeedSortMs(this.getBulletinEventSessions(bulletin), postedMs);
    }

    compareManagePosts(a, b) {
        const sortA = this.getManageSortTimestamp(a);
        const sortB = this.getManageSortTimestamp(b);
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

        return this.getManagePostTimestamp(b) - this.getManagePostTimestamp(a);
    }

    normalizeEventDates(rawDates) {
        return normalizeEventSessions(rawDates).map((session) => session.date);
    }

    isSessionSameTimeEnabled() {
        return Boolean(document.getElementById('sessionSameTimeToggle')?.checked);
    }

    collectEventDatesFromDom() {
        const rows = document.querySelectorAll('#eventDatesList .event-session-row');
        return Array.from(rows).map((row) => ({
            date: row.querySelector('.event-session-date')?.value || '',
            startTime: row.querySelector('.event-session-start')?.value || '',
            endTime: row.querySelector('.event-session-end')?.value || '',
        }));
    }

    syncSessionSameTimeUI(options = {}) {
        const toggle = document.getElementById('sessionSameTimeToggle');
        const group = document.getElementById('sessionsDateGroup');
        const sharedRow = document.getElementById('sessionSharedTimeRow');
        const sharedStart = document.getElementById('sessionSharedStartTime');
        const sharedEnd = document.getElementById('sessionSharedEndTime');
        const enabled = this.isSessionSameTimeEnabled();

        group?.classList.toggle('is-same-time', enabled);
        if (sharedRow) sharedRow.hidden = !enabled;

        if (options.fromToggle && enabled) {
            const firstStart = document.querySelector('#eventDatesList .event-session-start')?.value || '';
            const firstEnd = document.querySelector('#eventDatesList .event-session-end')?.value || '';
            if (sharedStart && !sharedStart.value) sharedStart.value = firstStart;
            if (sharedEnd && !sharedEnd.value) sharedEnd.value = firstEnd;
        }

        if (options.fromToggle) {
            const sessions = this.collectEventDatesFromDom().map((session) => ({
                date: session.date,
                startTime: enabled
                    ? (sharedStart?.value || session.startTime)
                    : (session.startTime || sharedStart?.value || ''),
                endTime: enabled
                    ? (sharedEnd?.value || session.endTime)
                    : (session.endTime || sharedEnd?.value || ''),
            }));
            this.renderEventDatesList(sessions.length ? sessions : [{ date: '' }, { date: '' }], {}, { preserveSameTime: true });
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    renderEventDatesList(sessions = [{ date: '' }], fallback = {}, options = {}) {
        const list = document.getElementById('eventDatesList');
        const addBtn = document.getElementById('addEventDateBtn');
        if (!list) return;

        const sameTime = this.isSessionSameTimeEnabled();
        const rows = (sessions.length ? sessions : [{ date: '' }])
            .map((session, index) => this.buildEventDateRowHtml(session, index, fallback, { sameTime }));
        list.innerHTML = rows.join('');

        if (addBtn) {
            addBtn.style.display = sessions.length >= MAX_EVENT_SESSIONS ? 'none' : '';
        }
    }

    buildEventDateRowHtml(session = {}, index = 0, fallback = {}, options = {}) {
        const parsed = typeof session === 'string'
            ? parseSessionEntry(session, fallback.startTime, fallback.endTime)
            : parseSessionEntry(session, fallback.startTime, fallback.endTime);
        const dateValue = parsed?.date || '';
        const startValue = parsed?.startTime || '';
        const endValue = parsed?.endTime || '';
        const canRemove = index > 0;
        const sameTime = options.sameTime ?? this.isSessionSameTimeEnabled();
        const safeDate = this.escapeAttribute(dateValue);
        const safeStart = this.escapeAttribute(startValue);
        const safeEnd = this.escapeAttribute(endValue);
        const previewHandler = 'window.syncAdminStudentPreview && window.syncAdminStudentPreview()';

        const timeFields = sameTime ? '' : `
                <input
                    type="time"
                    name="eventSessionStartTimes"
                    class="recommended event-session-start"
                    value="${safeStart}"
                    aria-label="Session ${index + 1} start time"
                    onchange="${previewHandler}"
                    oninput="${previewHandler}"
                >
                <input
                    type="time"
                    name="eventSessionEndTimes"
                    class="recommended event-session-end"
                    value="${safeEnd}"
                    aria-label="Session ${index + 1} end time"
                    onchange="${previewHandler}"
                    oninput="${previewHandler}"
                >`;

        return `
            <div class="event-date-row event-session-row">
                <input
                    type="date"
                    name="eventDates"
                    class="recommended event-session-date"
                    value="${safeDate}"
                    aria-label="Session date ${index + 1}"
                    ${index === 0 ? 'data-session-first="true"' : ''}
                    onchange="${previewHandler}"
                    oninput="${previewHandler}"
                >
                ${timeFields}
                ${canRemove ? `<button type="button" class="event-date-remove-btn" onclick="adminPanel.removeEventDateRow(this)" aria-label="Remove session">&times;</button>` : ''}
            </div>
        `;
    }

    addEventDateRow() {
        const list = document.getElementById('eventDatesList');
        if (!list) return;

        const count = list.querySelectorAll('.event-date-row').length;
        if (count >= MAX_EVENT_SESSIONS) return;

        list.insertAdjacentHTML('beforeend', this.buildEventDateRowHtml({ date: '' }, count, {}, { sameTime: this.isSessionSameTimeEnabled() }));

        const addBtn = document.getElementById('addEventDateBtn');
        if (addBtn && count + 1 >= MAX_EVENT_SESSIONS) {
            addBtn.style.display = 'none';
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    removeEventDateRow(button) {
        button.closest('.event-date-row')?.remove();

        const addBtn = document.getElementById('addEventDateBtn');
        if (addBtn) {
            addBtn.style.display = '';
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    isResourceBulletin(bulletin) {
        return bulletin && bulletin.type === 'resource';
    }

    /** Simple dated announcements created via the Event Date tab (label + date, no body). */
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

    getManageContentKind(bulletin) {
        if (this.isResourceBulletin(bulletin)) return 'resource';
        if (this.isCalendarEventBulletin(bulletin)) return 'event';
        return 'bulletin';
    }

    getManagePageForContentKind(kind) {
        if (kind === 'resource') return 'resources';
        if (kind === 'event') return 'events';
        return 'bulletins';
    }

    getManagePageForContentMode(mode) {
        if (mode === 'resource') return 'resources';
        if (mode === 'event') return 'events';
        return 'bulletins';
    }

    getManagePageLabel(page) {
        return {
            resources: 'My Resources',
            events: 'My Events',
            bulletins: 'My Bulletins',
            posts: 'All Posts',
        }[page] || 'My Bulletins';
    }

    navigateToManagePage(page = 'bulletins') {
        if (typeof window.apShowPage === 'function') {
            window.apShowPage(page);
            return;
        }
        this.showTab('manage');
    }

    getCurrentContentLabel() {
        return this.contentType === 'resource' ? 'Resource' : 'Bulletin';
    }

    setSubmitButtonLabel(label) {
        const cxBtn = document.getElementById('cxSubmitBtn');
        if (cxBtn) cxBtn.textContent = label;
    }

    /** Set a bulletin form field — works with legacy inputs and composer mirror hiddens */
    setComposerMirror(name, value, options = {}) {
        if (typeof window.PostComposer?.setFormMirror === 'function') {
            window.PostComposer.setFormMirror(name, value ?? '');
        }

        const el = document.getElementById(name)
            || document.querySelector(`#bulletinForm [name="${name}"]`)
            || document.getElementById(`_cx_mirror_${name}`);
        if (!el) return;

        if (el.type === 'checkbox') {
            el.checked = value === true || value === 'on';
        } else {
            el.value = value ?? '';
        }

        if (options.dataset && el.dataset) {
            Object.entries(options.dataset).forEach(([key, datasetValue]) => {
                if (datasetValue === null || datasetValue === undefined) {
                    delete el.dataset[key];
                } else {
                    el.dataset[key] = datasetValue;
                }
            });
        }
    }

    writeSessionMirrorInputs(sessions = []) {
        const form = document.getElementById('bulletinForm');
        if (!form) return;
        form.querySelectorAll('input[data-cx-session]').forEach((node) => node.remove());
        sessions.forEach((session) => {
            const date = session?.date || '';
            if (!date) return;
            const startTime = session?.startTime || '';
            const endTime = session?.endTime || '';
            const d = document.createElement('input');
            d.type = 'hidden';
            d.name = 'eventDates';
            d.value = date;
            d.setAttribute('data-cx-session', '1');
            form.appendChild(d);
            const st = document.createElement('input');
            st.type = 'hidden';
            st.name = 'eventSessionStartTimes';
            st.value = startTime;
            st.setAttribute('data-cx-session', '1');
            form.appendChild(st);
            const et = document.createElement('input');
            et.type = 'hidden';
            et.name = 'eventSessionEndTimes';
            et.value = endTime;
            et.setAttribute('data-cx-session', '1');
            form.appendChild(et);
        });
    }

    getComposerFormFieldValue(name, formData) {
        const rich = getRichTextFieldValue(name).trim();
        if (rich) return rich;
        return String(formData.get(name) || '').trim();
    }

    setLabelPriority(label, priority) {
        if (!label) return;
        label.classList.remove('required', 'optional', 'recommended');
        if (priority) {
            label.classList.add(priority);
        }
    }

    syncFormFieldIndicators(mode = this.contentMode || 'post') {
        const isEvent = mode === 'event';
        const isResource = mode === 'resource';
        const eventFieldPriority = isEvent ? 'required' : 'recommended';

        const titleLabelText = document.getElementById('titleLabelText');
        if (titleLabelText) {
            titleLabelText.textContent = isEvent ? 'Label' : 'Title';
        }

        const basicSubtitle = document.getElementById('basicInfoStepSubtitle');
        if (basicSubtitle) {
            basicSubtitle.textContent = isEvent
                ? 'Required for the calendar — not shown on the home feed'
                : 'Required to publish on the student feed';
        }

        const resourceSubtitle = document.getElementById('resourceSectionSubtitle');
        if (resourceSubtitle) {
            resourceSubtitle.textContent = 'Required to publish a resource';
        }

        const eventBadge = document.getElementById('eventDetailsSectionBadge');
        if (eventBadge) {
            eventBadge.classList.toggle('optional', !isEvent);
            eventBadge.classList.toggle('required', isEvent);
            eventBadge.textContent = isEvent ? 'Required' : 'Optional';
        }

        const categoryLabel = document.querySelector('label[for="category"]');
        if (categoryLabel) {
            this.setLabelPriority(categoryLabel, isEvent ? 'optional' : 'required');
        }

        const categoryBlock = document.querySelector('.category-field-group');
        if (categoryBlock) {
            categoryBlock.hidden = isEvent;
        }

        [
            'dateType',
            'eventDate',
            'startDate',
            'endDate',
        ].forEach((fieldId) => {
            this.setLabelPriority(document.querySelector(`label[for="${fieldId}"]`), eventFieldPriority);
        });

        const sessionsLabel = document.querySelector('#sessionsDateGroup > label');
        if (sessionsLabel) {
            this.setLabelPriority(sessionsLabel, eventFieldPriority);
        }

        const descriptionLabel = document.querySelector('label[for="description"]');
        if (descriptionLabel && !isResource) {
            this.setLabelPriority(descriptionLabel, 'required');
        }
    }

    setContentType(type, options = {}) {
        const isEvent = type === 'event';
        const nextType = type === 'resource' ? 'resource' : 'post';
        const nextMode = isEvent ? 'event' : nextType;
        this.contentType = nextType;
        this.contentMode = nextMode;

        const hiddenInput = document.getElementById('contentType')
            || document.querySelector('#bulletinForm [name="contentType"]');
        if (hiddenInput) {
            hiddenInput.value = nextType;
        }

        const form = document.getElementById('bulletinForm');
        if (form) {
            form.dataset.contentMode = nextMode;
        }

        document.querySelectorAll('.content-type-btn').forEach((button) => {
            const btnType = button.getAttribute('data-content-type');
            const isActive = isEvent ? btnType === 'event' : btnType === nextType;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        document.querySelectorAll('.content-mode-section').forEach((section) => {
            const mode = section.getAttribute('data-content-mode');
            const isVisible = String(mode || '').split(/\s+/).includes(nextMode);
            section.style.display = isVisible ? '' : 'none';
        });

        document.querySelectorAll('[data-resource-required="true"]').forEach((field) => {
            field.required = nextType === 'resource';
        });

        const titleInput = document.getElementById('title');
        const categoryInput = document.getElementById('category');
        if (titleInput) titleInput.required = nextMode === 'post' || nextMode === 'event';
        if (categoryInput) categoryInput.required = false;
        const descriptionInput = document.getElementById('description');
        if (descriptionInput) descriptionInput.required = nextMode === 'post' || nextMode === 'event';

        const helper = document.getElementById('contentTypeHelper');
        if (helper) {
            helper.textContent = nextType === 'resource'
                ? 'Use Resources for important links students may need again later.'
                : isEvent
                    ? 'Adds to the calendar and upcoming dates. Not shown as a post on the home feed.'
                    : 'Use Posts for announcements, trainings, and opportunities on the home feed.';
        }

        const requiredTitle = document.querySelector('.form-section.required .form-section-title');
        const requiredSubtitle = document.querySelector('.form-section.required .form-section-subtitle');
        const titleHelp = document.querySelector('.title-field-group .input-help');
        if (requiredTitle) {
            requiredTitle.textContent = isEvent ? 'Event Label' : 'Required Information';
        }
        if (requiredSubtitle) {
            requiredSubtitle.textContent = isEvent
                ? 'Add the label students will see on the calendar.'
                : 'These fields are mandatory for all bulletins';
        }
        if (titleHelp) {
            titleHelp.textContent = isEvent
                ? 'Use the exact wording students should see, like “No School” or “Registration Deadline”.'
                : 'A clear, descriptive title helps students understand the opportunity';
        }
        if (!isEvent) {
            const eventDateLabel = document.querySelector('label[for="eventDate"]');
            if (eventDateLabel && eventDateLabel.childNodes.length === 1 && eventDateLabel.firstChild.nodeType === Node.TEXT_NODE) {
                eventDateLabel.firstChild.textContent = 'Event Date';
            } else if (eventDateLabel && !eventDateLabel.querySelector('[id]')) {
                eventDateLabel.textContent = 'Event Date';
            }
        }

        this.syncFormFieldIndicators(nextMode);

        const heading = document.querySelector('.post-form-container h4');

        if (heading) {
            if (this.isEditMode) {
                heading.textContent = nextType === 'resource' ? 'Edit Resource' : 'Edit Bulletin';
            } else {
                heading.textContent = nextType === 'resource' ? 'Create New Resource' : isEvent ? 'Add Event Date' : 'Create New Bulletin';
            }
        }

        if (this.isEditMode) {
            this.setSubmitButtonLabel(nextType === 'resource' ? 'Update Resource' : 'Update Bulletin');
        } else {
            this.setSubmitButtonLabel(
                nextType === 'resource' ? 'Publish Resource' : isEvent ? 'Add Event Date' : 'Post to Students'
            );
        }

        if (!options.preserveFields && nextType === 'resource') {
            const imgIn = document.getElementById('image');
            if (imgIn) imgIn.value = '';
            const pdfIn = document.getElementById('pdf');
            if (pdfIn) pdfIn.value = '';
            this.pendingImageData = null;
        }

        if (!options.silent) {
            this.showTemporaryMessage(`${nextType === 'resource' ? 'Resource' : isEvent ? 'Event date' : 'Post'} mode ready.`, 'info');
        }

        if (isEvent) {
            this.applySchoolEventPreset('calendar-only', { keepContentMode: true });
        }

        if (nextType === 'resource') {
            const category = document.getElementById('resourceCategory')?.value || '';
            this.renderResourceServicePresets(category);
            this.syncResourceKindUI();
        }

    }

    populateResourceCategoryField() {
        const select = document.getElementById('resourceCategory');
        const picker = document.getElementById('resourceCategoryPicker');
        if (!select) return;

        const current = select.value;
        select.innerHTML = '<option value="">Select a category</option>' +
            ADMIN_RESOURCE_CATEGORIES.map(([key, label]) => (
                `<option value="${this.escapeAttribute(key)}">${this.escapeHtml(label)}</option>`
            )).join('');
        if (current) {
            select.value = current;
        }

        if (picker) {
            picker.innerHTML = ADMIN_RESOURCE_CATEGORIES.map(([key, label, emoji]) => {
                const shortLabel = label.split(' / ')[0];
                return `<button type="button" data-resource-category-pick="${this.escapeAttribute(key)}">${emoji} ${this.escapeHtml(shortLabel)}</button>`;
            }).join('');

            picker.querySelectorAll('[data-resource-category-pick]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    const category = event.currentTarget.getAttribute('data-resource-category-pick');
                    if (!category) return;
                    select.value = category;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        }

        this.syncResourceCategoryPicker(select.value);
    }

    syncResourceCategoryPicker(category) {
        document.querySelectorAll('[data-resource-category-pick]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-resource-category-pick') === category);
        });
        if (category) {
            this.clearCategoryValidation('resourceCategory');
        }
    }

    handleResourceCategoryChange(category) {
        const categorySelect = document.getElementById('resourceCategory');
        if (!categorySelect || !category) return;

        categorySelect.dataset.suggestedIcon = ADMIN_RESOURCE_CATEGORY_ICONS[category] || 'globe';
        this.renderResourceServicePresets(category);
    }

    renderResourceServicePresets(category) {
        const container = document.getElementById('resourceServicePresets');
        const input = document.getElementById('resourceHighlights');
        const hint = document.getElementById('resourceChipSuggestionsHint');
        if (!container || !input) return;

        const presets = getSuggestedResourceChips(category);

        if (!presets.length) {
            container.innerHTML = '';
            if (hint) {
                hint.textContent = category
                    ? 'No suggestions for this category — type your own chips above'
                    : 'Pick a category above to see suggestions, or type your own chips';
            }
            return;
        }

        if (hint) {
            hint.textContent = 'Tap to add (up to 6)';
        }

        container.innerHTML = presets.map((label) => (
            `<button type="button" class="resource-service-preset-btn" data-service-preset="${this.escapeAttribute(label)}">${this.escapeHtml(label)}</button>`
        )).join('');

        container.querySelectorAll('[data-service-preset]').forEach((button) => {
            button.addEventListener('click', () => {
                const value = button.getAttribute('data-service-preset') || '';
                const current = parseResourceServiceChips(input.value);
                const currentKeys = new Set(current.map((part) => part.toLowerCase()));
                if (!value || currentKeys.has(value.toLowerCase()) || current.length >= MAX_RESOURCE_SERVICE_CHIPS) return;
                input.value = formatResourceServiceChipsInput([...current, value]);
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }

    // Tab Management
    showTab(tabName) {
        const v2PageMap = { post: 'create', manage: 'bulletins', advisors: 'advisors' };
        if (typeof window.apShowPage === 'function' && v2PageMap[tabName]) {
            window.apShowPage(v2PageMap[tabName]);
        }

        // Hide all tabs and update aria attributes
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-hidden', 'true');
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // Show selected tab and update aria attributes
        const selectedTab = document.getElementById(tabName + 'Tab');
        const selectedBtn = document.querySelector(`button[aria-controls="${tabName}Tab"]`);

        if (selectedTab) {
            selectedTab.classList.add('active');
            selectedTab.setAttribute('aria-hidden', 'false');
        }

        if (selectedBtn) {
            selectedBtn.classList.add('active');
            selectedBtn.setAttribute('aria-selected', 'true');
        }

        if (tabName === 'manage') {
            this.loadManageBulletins();
        }
        if (tabName === 'advisors') {
            this.loadAdvisors();
        }

        document.querySelectorAll('[data-admin-tab-target]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-admin-tab-target') === tabName);
        });
    }

    /** Upcoming dated posts/events — filtered in memory from already-loaded bulletins (no extra reads). */
    getUpcomingEventBulletins(limit = Infinity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = this.bulletins
            .filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive !== false)
            .filter((bulletin) => {
                const dateStr = bulletin.eventDate || bulletin.startDate;
                if (!dateStr) return false;
                const normalized = String(dateStr).split('T')[0];
                const eventDay = new Date(`${normalized}T00:00:00`);
                return !Number.isNaN(eventDay.getTime()) && eventDay >= today;
            })
            .sort((a, b) => {
                const aDay = new Date(`${String(a.eventDate || a.startDate).split('T')[0]}T00:00:00`);
                const bDay = new Date(`${String(b.eventDate || b.startDate).split('T')[0]}T00:00:00`);
                return aDay - bDay;
            });

        return Number.isFinite(limit) ? upcoming.slice(0, limit) : upcoming;
    }

    updateAdvisorDashboard() {
        const posts = this.bulletins.filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive);
        const livePosts = posts.filter((bulletin) => !this.isBulletinExpiredAdmin(bulletin));
        const expiringSoon = posts.filter((bulletin) => bulletin.deadline && this.isDeadlineClose(bulletin.deadline) && !this.isBulletinExpiredAdmin(bulletin));
        const resources = this.bulletins.filter((bulletin) => this.isResourceBulletin(bulletin) && bulletin.isActive);
        const upcomingEvents = this.getUpcomingEventBulletins();

        this.setText('statLivePosts', livePosts.length);
        this.setText('statResources', resources.length);
        this.setText('statUpcomingEvents', upcomingEvents.length);
        this.setText('statExpiringSoon', expiringSoon.length);

        this.renderUpcomingDashboardEvents();
    }

    renderUpcomingDashboardEvents() {
        const container = document.getElementById('dashUpcomingEvents');
        if (!container) return;

        const upcoming = this.getUpcomingEventBulletins(4);

        if (!upcoming.length) {
            container.innerHTML = '<p style="color:var(--ap-text-3);font-size:.82rem;">No upcoming events. Create a calendar event to see it here.</p>';
            return;
        }

        container.innerHTML = upcoming.map((bulletin) => {
            const dateStr = bulletin.eventDate || bulletin.startDate;
            const normalized = String(dateStr).split('T')[0];
            const eventDay = new Date(`${normalized}T00:00:00`);
            const month = eventDay.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = eventDay.getDate();
            const title = bulletin.title || 'Untitled event';
            const time = this.formatTimeRangeAdmin(bulletin.startTime, bulletin.endTime);

            return `
                <div class="ap-event-row">
                    <div class="ap-event-date-block">
                        <div class="ap-event-month">${this.escapeHtml(month)}</div>
                        <div class="ap-event-day">${day}</div>
                    </div>
                    <div class="ap-event-info">
                        <div class="ap-event-name">${this.escapeHtml(title)}</div>
                        <div class="ap-event-time">${time ? this.escapeHtml(time) : 'All day'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    }

    syncCategoryPicker(category) {
        document.querySelectorAll('[data-category-pick]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-category-pick') === category);
        });
        if (category) {
            this.clearCategoryValidation('category');
        }
    }

    clearCategoryValidation(selectId) {
        const select = document.getElementById(selectId);
        const block = select?.closest('.ap-category-picker-block');
        if (!select || !block) return;

        select.classList.remove('invalid');
        select.removeAttribute('aria-invalid');
        block.classList.remove('invalid');
    }

    validateRequiredCategorySelection(formData) {
        if (this.contentMode === 'event') {
            return true;
        }

        const submittedType = (formData.get('contentType') || this.contentType || 'post') === 'resource' ? 'resource' : 'post';
        const selectId = submittedType === 'resource' ? 'resourceCategory' : 'category';
        const category = (formData.get(selectId) || '').trim();

        if (category) {
            this.clearCategoryValidation(selectId);
            return true;
        }

        const select = document.getElementById(selectId);
        const block = select?.closest('.ap-category-picker-block');
        const message = submittedType === 'resource'
            ? 'Choose a resource category before publishing.'
            : 'Choose a bulletin category before posting.';

        if (select) {
            select.classList.add('invalid');
            select.setAttribute('aria-invalid', 'true');
        }

        if (block) {
            block.classList.add('invalid');
            block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        this.showTemporaryMessage(message, 'error');
        return false;
    }

    syncClassTypeForCategory(category) {
        const classTypeSelect = document.getElementById('classType');
        if (!classTypeSelect || classTypeSelect.value) {
            return;
        }
        if (category === 'esol') {
            classTypeSelect.value = 'esol';
        } else if (category === 'college') {
            classTypeSelect.value = 'hse';
        }
    }

    // Bulletin Management
    async handleBulletinSubmit(e) {
        e.preventDefault();

        if (this.isSubmitting) {
            return;
        }

        this.isSubmitting = true;

        // Show loading state on composer submit button
        const cxSubmitBtn = document.getElementById('cxSubmitBtn');
        if (cxSubmitBtn) { cxSubmitBtn.classList.add('btn-loading'); cxSubmitBtn.disabled = true; }

        try {
            syncRichEditorsToForm();
            const formData = new FormData(e.target);
            formData.set('description', this.getComposerFormFieldValue('description', formData));
            formData.set('summaryEs', this.getComposerFormFieldValue('summaryEs', formData));
            formData.set('resourceDescription', this.getComposerFormFieldValue('resourceDescription', formData));
            formData.set('resourceSummaryEs', this.getComposerFormFieldValue('resourceSummaryEs', formData));
            if (!this.validateRequiredCategorySelection(formData)) {
                return;
            }
            this.validateDocumentResourceInput(formData);
            if (this.contentMode === 'event') {
                const hasEndDate = Boolean((formData.get('endDate') || '').trim());
                formData.set('contentType', 'post');
                formData.set('category', 'announcement');
                formData.set('dateType', hasEndDate ? 'range' : 'event');
                if (hasEndDate && !formData.get('startDate')) {
                    formData.set('startDate', formData.get('eventDate') || '');
                }
            }
            const submittedType = (formData.get('contentType') || this.contentType || 'post') === 'resource' ? 'resource' : 'post';
            const submittedLabel = this.contentMode === 'event' ? 'Event date' : submittedType === 'resource' ? 'Resource' : 'Bulletin';

            let newBulletinId = null;
            const wasEditMode = this.isEditMode;
            if (this.isEditMode && this.editingBulletinId) {
                newBulletinId = this.editingBulletinId;
                await this.updateBulletin(formData, this.editingBulletinId);
            } else {
                newBulletinId = await this.createBulletin(formData);
            }

            // Reset form after successful submission
            this.pendingHighlightId = newBulletinId;
            const managePage = submittedType === 'resource'
                ? 'resources'
                : this.contentMode === 'event'
                    ? 'events'
                    : 'bulletins';
            this.resetForm({ managePage });

            const manageLabel = this.getManagePageLabel(managePage);
            let successMessage = wasEditMode
                ? `${submittedLabel} updated successfully!`
                : `${submittedLabel} saved successfully! Check ${manageLabel}.`;
            if (submittedType === 'post') {
                successMessage += ' It should appear on the student feed shortly.';
                if (formData.get('summaryEs')) {
                    successMessage += ' Students in Spanish see Spanish Summary instead of Description when a summary is filled in.';
                }
            }
            this.showTemporaryMessage(successMessage, 'success');
        } catch (error) {
            if (error && error.code === 'user-cancelled') {
                this.showTemporaryMessage('Post cancelled. You can review the content and try again.', 'info');
                throw error;
                
            }
            console.error('Error submitting bulletin:', error);
            let errorMessage = `Error saving ${this.getCurrentContentLabel().toLowerCase()}. Please try again.`;

            if (error.code === 'permission-denied') {
                errorMessage = 'Post blocked by security rules. Try signing out and back in. If it persists, contact an admin — your account email must match your @ebhcs.org login.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
            } else if (error.message?.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            this.showTemporaryMessage(errorMessage, 'error');
        } finally {
            // Reset loading state
            if (cxSubmitBtn) { cxSubmitBtn.classList.remove('btn-loading'); cxSubmitBtn.disabled = false; }
            this.setSubmitButtonLabel(
                this.isEditMode
                    ? (this.contentType === 'resource' ? 'Update Resource' : 'Update Bulletin')
                    : (this.contentType === 'resource' ? 'Publish Resource' : 'Post to Students')
            );
            this.isSubmitting = false;
        }
    }

    async handleImageUpload(file, bulletin, pdfFile = null, editingId = null, fieldName = 'image', options = {}) {
        try {
            const signature = this.getFileSignature(file);
            let processedImage = null;
            let usedCachedImage = false;
            const { pendingKey, label } = this.getImageFieldConfig(fieldName);

            if (this[pendingKey] && this[pendingKey].signature === signature) {
                processedImage = this[pendingKey];
                usedCachedImage = true;
            } else if ((fieldName === 'image' || fieldName === 'imageEs') && isPdfFile(file)) {
                const flyerSource = await this.prepareFlyerSourceFile(file, fieldName);
                processedImage = {
                    ...(await this.prepareImageForUpload(flyerSource.uploadFile, { mode: 'flyer' })),
                    signature,
                    convertedFromPdf: true,
                    pdfPageCount: flyerSource.pdfPageCount
                };
            } else {
                processedImage = await this.prepareImageForUpload(file, {
                    mode: fieldName === 'resourceLogo' ? 'logo' : 'flyer'
                });
            }

            // Ensure final encoded image is within safety limits (~4MB)
            if (processedImage.finalBytes > 4 * 1024 * 1024) {
                throw `Optimized ${label} is still larger than 4MB. Please upload a smaller image.`;
            }

            // Update the document with just the image field
            if (editingId) {
                const updateData = {};
                updateData[fieldName] = processedImage.dataUrl;
                await updateDoc(doc(db, 'bulletins', editingId), updateData);
            } else {
                // For new bulletins, add the image to the bulletin object
                bulletin[fieldName] = processedImage.dataUrl;
                await this.saveBulletin(bulletin, null);
            }

            // Attach the original PDF when a PDF flyer was uploaded, or when a separate PDF was added.
            if (fieldName === 'image') {
                const pdfToUpload = isPdfFile(file)
                    ? (options.attachSourcePdf === false ? null : file)
                    : (pdfFile && pdfFile.size > 0 ? pdfFile : null);
                if (pdfToUpload) {
                    await this.handlePdfUpload(pdfToUpload, bulletin, editingId);
                }
            }

            if (processedImage.infoMessage && !usedCachedImage) {
                this.showTemporaryMessage(processedImage.infoMessage, 'info');
            } else if (fieldName === 'image' && isPdfFile(file) && !usedCachedImage) {
                this.showTemporaryMessage('PDF flyer converted. Students will see page 1 on the board and can open the full PDF from the post.', 'success');
            } else if (fieldName === 'imageEs' && isPdfFile(file) && !usedCachedImage) {
                this.showTemporaryMessage('Spanish PDF flyer converted. Students will see page 1 when they switch to Spanish.', 'success');
            }
        } catch (error) {
            console.error('Image processing error:', error);
            const message = typeof error === 'string'
                ? error
                : ((fieldName === 'image' || fieldName === 'imageEs') && isPdfFile(file)
                    ? 'Flyer upload failed. Please try a different PDF or upload a JPG/PNG instead.'
                    : 'Image upload failed. Please try uploading a JPG/PNG under 10MB.');
            this.showTemporaryMessage(message, 'error');
            throw error; // Re-throw to prevent form reset on error
        }
    }

    async handlePdfUpload(file, bulletin, editingId = null) {
        try {

            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                throw 'PDF file too large. Please select a PDF under 10MB.';
            }

            // Check file type
            if (file.type !== 'application/pdf') {
                throw 'Please select a valid PDF file.';
            }

            // Ensure user is still authenticated and refresh token
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw 'Session expired. Please log in again.';
            }
            await currentUser.getIdToken(true);

            this.showTemporaryMessage('Uploading PDF...', 'info');

            // Generate unique filename using the bulletin ID
            const timestamp = Date.now();
            const bulletinId = editingId || 'unknown';
            const filename = `pdfs/${bulletinId}_${timestamp}.pdf`;

            // Create storage reference and upload with explicit content-type
            const fileRef = storageRef(storage, filename);
            const metadata = { contentType: 'application/pdf' };
            const snapshot = await uploadBytes(fileRef, file, metadata);

            // Get download URL
            const downloadUrl = await getDownloadURL(snapshot.ref);

            // Update the document with the PDF URL
            if (editingId) {
                await updateDoc(doc(db, 'bulletins', editingId), {
                    pdfUrl: downloadUrl
                });
                this.showTemporaryMessage('PDF uploaded successfully!', 'success');
                this.loadManageBulletins();
            } else {
                throw new Error('No bulletin ID available for PDF upload');
            }
        } catch (error) {
            console.error('PDF upload error:', error);
            
            let message = 'PDF upload failed. Please try again.';
            
            // Handle specific Firebase Storage errors
            if (error.code) {
                switch (error.code) {
                    case 'storage/unauthorized':
                        message = 'You do not have permission to upload files. Please check your login.';
                        break;
                    case 'storage/canceled':
                        message = 'PDF upload was canceled.';
                        break;
                    case 'storage/unknown':
                        message = 'An unknown error occurred during upload. Please try again.';
                        break;
                    case 'storage/invalid-format':
                        message = 'Invalid file format. Please upload a PDF file.';
                        break;
                    case 'storage/wrong-size':
                        message = 'File too large. Please upload a PDF under 10MB.';
                        break;
                }
            } else if (typeof error === 'string') {
                message = error;
            }
            
            this.showTemporaryMessage(message, 'error');
            throw error; // re-throw so the submit handler's finally block restores the button
        }
    }

    getImageFieldConfig(fieldName) {
        switch (fieldName) {
            case 'imageEs':
                return { previewId: 'imageEsPreview', pendingKey: 'pendingImageEsData', label: 'Spanish image' };
            case 'resourceLogo':
                return { previewId: 'resourceLogoPreview', pendingKey: 'pendingResourceLogoData', label: 'Organization logo' };
            case 'image':
            default:
                return { previewId: 'imagePreview', pendingKey: 'pendingImageData', label: 'English image' };
        }
    }

    updateResourceIconGroupState() {
        const group = document.getElementById('resourceIconGroup');
        if (!group) return;
        const hasLogo = Boolean(document.querySelector('#resourceLogoPreview .preview-image'));
        group.classList.toggle('is-logo-active', hasLogo);
    }

    populateResourceActionLinkFields(actionLinks) {
        this.removedActionLinkPdfSlots = new Set();
        const values = getResourceActionLinkFieldValues(actionLinks);
        Object.entries(values).forEach(([fieldId, value]) => {
            if (fieldId.endsWith('Type')) {
                const slot = fieldId.match(/resourceActionLink(\d+)Type/)?.[1];
                const radio = document.querySelector(`input[name="${fieldId}"][value="${value}"]`);
                if (radio) radio.checked = true;
                if (slot) this.syncResourceActionLinkSlotType(Number(slot));
                return;
            }
            const field = document.getElementById(fieldId);
            if (field) field.value = value;
        });

        for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
            const existingPdfUrl = values[`resourceActionLink${slot}ExistingPdfUrl`] || '';
            if (existingPdfUrl) {
                this.renderExistingActionLinkPdfPreview(slot, existingPdfUrl);
            } else {
                const preview = document.getElementById(`resourceActionLink${slot}PdfPreview`);
                if (preview) preview.innerHTML = '';
            }
        }

        const details = document.querySelector('.resource-action-links-field');
        if (details) {
            details.open = normalizeResourceActionLinks(actionLinks).length > 0;
        }
    }

    initResourceActionLinkSlots() {
        const container = document.getElementById('resourceActionLinkSlots');
        if (!container || container.dataset.initialized === 'true') return;

        container.innerHTML = Array.from({ length: MAX_RESOURCE_ACTION_LINKS }, (_, index) => {
            const slot = index + 1;
            return `
                <div class="resource-action-link-slot" data-action-link-slot="${slot}">
                    <p class="resource-action-link-slot-label">Button ${slot}</p>
                    <div class="field-group double">
                        <div class="form-group">
                            <label for="resourceActionLink${slot}LabelEn" class="optional">Button label (English)</label>
                            <input type="text" id="resourceActionLink${slot}LabelEn" name="resourceActionLink${slot}LabelEn" maxlength="60">
                        </div>
                        <div class="form-group">
                            <label for="resourceActionLink${slot}LabelEs" class="optional">Button label (Spanish)</label>
                            <input type="text" id="resourceActionLink${slot}LabelEs" name="resourceActionLink${slot}LabelEs" maxlength="60">
                        </div>
                    </div>
                    <div class="resource-action-link-type" role="radiogroup" aria-label="Action link ${slot} type">
                        <label class="resource-action-link-type-option">
                            <input type="radio" name="resourceActionLink${slot}Type" value="url" checked>
                            <span>Website link</span>
                        </label>
                        <label class="resource-action-link-type-option">
                            <input type="radio" name="resourceActionLink${slot}Type" value="pdf">
                            <span>PDF upload</span>
                        </label>
                    </div>
                    <div class="form-group resource-action-link-url-field" id="resourceActionLink${slot}UrlField">
                        <label for="resourceActionLink${slot}Url" class="optional">URL</label>
                        <input type="url" id="resourceActionLink${slot}Url" name="resourceActionLink${slot}Url">
                    </div>
                    <div class="form-group resource-action-link-pdf-field" id="resourceActionLink${slot}PdfField" hidden>
                        <label for="resourceActionLink${slot}Pdf" class="optional">PDF file</label>
                        <button type="button" class="ap-flyer-pdf-choose" onclick="document.getElementById('resourceActionLink${slot}Pdf').click()">Choose PDF</button>
                        <input type="file" id="resourceActionLink${slot}Pdf" name="resourceActionLink${slot}Pdf" accept=".pdf,application/pdf" class="file-input" style="display: none;" aria-label="Upload action link PDF ${slot}">
                        <div id="resourceActionLink${slot}PdfPreview" class="pdf-preview"></div>
                    </div>
                    <input type="hidden" id="resourceActionLink${slot}ExistingPdfUrl" name="resourceActionLink${slot}ExistingPdfUrl" value="">
                </div>
            `;
        }).join('');

        container.dataset.initialized = 'true';

        for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
            document.querySelectorAll(`input[name="resourceActionLink${slot}Type"]`).forEach((input) => {
                input.addEventListener('change', () => this.syncResourceActionLinkSlotType(slot));
            });
            const pdfInput = document.getElementById(`resourceActionLink${slot}Pdf`);
            if (pdfInput) {
                pdfInput.addEventListener('change', (event) => this.handleActionLinkPdfPreview(slot, event));
            }
            ['LabelEn', 'LabelEs', 'Url'].forEach((suffix) => {
                const field = document.getElementById(`resourceActionLink${slot}${suffix}`);
                if (field) {
                    field.addEventListener('input', () => {
                        if (typeof window.syncAdminStudentPreview === 'function') {
                            window.syncAdminStudentPreview();
                        }
                    });
                }
            });
        }
    }

    syncResourceActionLinkSlotType(slot) {
        const type = document.querySelector(`input[name="resourceActionLink${slot}Type"]:checked`)?.value || 'url';
        const urlField = document.getElementById(`resourceActionLink${slot}UrlField`);
        const pdfField = document.getElementById(`resourceActionLink${slot}PdfField`);
        if (urlField) urlField.hidden = type === 'pdf';
        if (pdfField) pdfField.hidden = type !== 'pdf';
    }

    handleActionLinkPdfPreview(slot, event) {
        const file = event.target.files[0];
        const preview = document.getElementById(`resourceActionLink${slot}PdfPreview`);
        if (!preview) return;

        if (!file) {
            preview.innerHTML = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showTemporaryMessage('PDF file too large. Please select a PDF under 10MB.', 'error');
            event.target.value = '';
            preview.innerHTML = '';
            return;
        }

        if (file.type !== 'application/pdf') {
            this.showTemporaryMessage('Please select a valid PDF file.', 'error');
            event.target.value = '';
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = `
            <div class="pdf-preview-container">
                <div class="pdf-preview-icon">📄</div>
                <div class="pdf-preview-info">
                    <strong>${this.escapeHtml(file.name)}</strong>
                    <small>${this.formatFileSize(file.size)}</small>
                </div>
                <button type="button" class="remove-pdf" onclick="adminPanel.removeActionLinkPdfPreview(${slot})" aria-label="Remove PDF">&times;</button>
            </div>
        `;
        this.removedActionLinkPdfSlots.delete(slot);
        const existingField = document.getElementById(`resourceActionLink${slot}ExistingPdfUrl`);
        if (existingField) existingField.value = '';
        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    renderExistingActionLinkPdfPreview(slot, pdfUrl) {
        const preview = document.getElementById(`resourceActionLink${slot}PdfPreview`);
        if (!preview) return;

        if (!pdfUrl) {
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = `
            <div class="pdf-preview-container">
                <div class="pdf-preview-icon">📄</div>
                <div class="pdf-preview-info">
                    <strong>Current PDF</strong>
                    <small><a href="${this.escapeAttribute(pdfUrl)}" target="_blank" rel="noopener">Open uploaded PDF</a></small>
                </div>
                <button type="button" class="remove-pdf" onclick="adminPanel.removeActionLinkPdfPreview(${slot})" aria-label="Remove PDF">&times;</button>
            </div>
        `;
    }

    removeActionLinkPdfPreview(slot) {
        const input = document.getElementById(`resourceActionLink${slot}Pdf`);
        const preview = document.getElementById(`resourceActionLink${slot}PdfPreview`);
        const existingField = document.getElementById(`resourceActionLink${slot}ExistingPdfUrl`);
        if (input) input.value = '';
        if (preview) preview.innerHTML = '';
        if (existingField) existingField.value = '';
        this.removedActionLinkPdfSlots.add(slot);
        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    async uploadActionLinkPdf(file, bulletinId, slot) {
        if (file.size > 10 * 1024 * 1024) {
            throw new Error('PDF file too large. Please select a PDF under 10MB.');
        }
        if (file.type !== 'application/pdf') {
            throw new Error('Please select a valid PDF file.');
        }

        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('Session expired. Please log in again.');
        }
        await currentUser.getIdToken(true);

        const timestamp = Date.now();
        const filename = `pdfs/${bulletinId}_action_${slot}_${timestamp}.pdf`;
        const fileRef = storageRef(storage, filename);
        const snapshot = await uploadBytes(fileRef, file, { contentType: 'application/pdf' });
        return getDownloadURL(snapshot.ref);
    }

    async finalizeResourceActionLinks(formData, bulletinId, existingLinks = []) {
        const parsedLinks = parseResourceActionLinkSlotsFromForm(formData, {
            removedPdfSlots: this.removedActionLinkPdfSlots,
            existingLinks,
        });

        const finalizedLinks = [];
        for (const link of parsedLinks) {
            const slot = link._slot;
            const pendingUpload = link._pendingPdfUpload;
            const nextLink = {
                labelEn: link.labelEn,
                labelEs: link.labelEs,
                url: link.url || '',
                pdfUrl: link.pdfUrl || '',
            };

            if (pendingUpload && slot) {
                const file = formData.get(`resourceActionLink${slot}Pdf`);
                nextLink.pdfUrl = await this.uploadActionLinkPdf(file, bulletinId, slot);
                nextLink.url = '';
            }

            finalizedLinks.push(nextLink);
        }

        return stripActionLinkUploadMeta(finalizedLinks);
    }

    syncResourceKindUI() {
        const selected = document.querySelector('input[name="resourceKind"]:checked');
        const kind = normalizeResourceKind(selected?.value);
        const isDocument = kind === RESOURCE_KIND_DOCUMENT;

        document.querySelectorAll('.resource-org-only').forEach((element) => {
            element.hidden = isDocument;
        });

        const pdfField = document.getElementById('resourcePdfField');
        if (pdfField) pdfField.hidden = !isDocument;

        const pdfLabel = document.getElementById('resourcePdfLabel');
        const pdfHelp = document.getElementById('resourcePdfHelp');
        if (pdfLabel) {
            this.setLabelPriority(pdfLabel, 'optional');
        }
        if (pdfHelp) {
            pdfHelp.textContent = isDocument
                ? 'Optional — upload a PDF if students should open a file. A link above works instead.'
                : '';
        }

        const urlInput = document.getElementById('resourceUrl');
        const urlLabel = document.getElementById('resourceUrlLabel');
        const urlHelp = document.getElementById('resourceUrlHelp');
        const urlField = document.getElementById('resourceUrlField');

        if (urlInput) {
            urlInput.required = !isDocument;
            urlInput.dataset.resourceRequired = isDocument ? 'false' : 'true';
        }

        if (urlLabel) {
            urlLabel.textContent = isDocument ? 'Official source link' : 'Link / URL';
            this.setLabelPriority(urlLabel, isDocument ? 'optional' : 'required');
        }

        if (urlHelp) {
            urlHelp.textContent = isDocument
                ? 'Optional — link to the form online. Works instead of uploading a PDF.'
                : 'Paste the website students should open when they tap the resource.';
            urlHelp.classList.toggle('required', !isDocument);
        }

        if (urlField) {
            urlField.classList.toggle('required-field', !isDocument);
        }

        const resourceSubtitle = document.getElementById('resourceSectionSubtitle');
        if (resourceSubtitle) {
            resourceSubtitle.textContent = isDocument
                ? 'Add a link or PDF (or both) so students can open the form'
                : 'Required to publish a resource';
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    validateDocumentResourceInput(formData) {
        const kind = normalizeResourceKind(formData.get('resourceKind'));
        if (kind !== RESOURCE_KIND_DOCUMENT) return;

        const hasPdfFile = Boolean(formData.get('resourcePdf')?.size);
        const hasUrl = Boolean((formData.get('resourceUrl') || '').trim());
        const existing = this.isEditMode && this.editingBulletinId
            ? this.bulletins.find((bulletin) => bulletin.id === this.editingBulletinId)
            : null;
        let hasActionLink = false;
        try {
            hasActionLink = parseResourceActionLinkSlotsFromForm(formData, {
                removedPdfSlots: this.removedActionLinkPdfSlots,
                existingLinks: existing?.actionLinks || [],
            }).length > 0;
        } catch {
            hasActionLink = false;
        }

        if (this.isEditMode && this.editingBulletinId) {
            const existing = this.bulletins.find((bulletin) => bulletin.id === this.editingBulletinId);
            if (existing?.pdfUrl || hasPdfFile || hasUrl || hasActionLink) {
                return;
            }
        } else if (hasPdfFile || hasUrl || hasActionLink) {
            return;
        }

        throw new Error('Document resources need a link, PDF upload, or extra action link so students can open something.');
    }

    async handleImagePreview(e, fieldName = 'image') {
        const file = e.target.files[0];
        const { previewId, pendingKey } = this.getImageFieldConfig(fieldName);
        const preview = document.getElementById(previewId);

        if (file && fieldName === 'resourceLogo') {
            this.removeResourceLogo = false;
        }

        if (file) {
            try {
                let flyerSource;
                if (fieldName === 'image' || fieldName === 'imageEs') {
                    if (isPdfFile(file)) {
                        this.showTemporaryMessage('Converting PDF flyer preview...', 'info');
                    }
                    flyerSource = await this.prepareFlyerSourceFile(file, fieldName);
                    if (flyerSource.warnings?.length) {
                        flyerSource.warnings.forEach((warning) => {
                            this.showTemporaryMessage(warning, 'warning');
                        });
                    }
                } else {
                    const validation = this.validateImageFile(file);
                    if (!validation.isValid) {
                        this.showTemporaryMessage(validation.error, 'error');
                        e.target.value = '';
                        if (preview) preview.innerHTML = '';
                        this[pendingKey] = null;
                        return;
                    }
                    if (validation.warnings.length > 0) {
                        validation.warnings.forEach((warning) => {
                            this.showTemporaryMessage(warning, 'warning');
                        });
                    }
                    flyerSource = {
                        uploadFile: file,
                        convertedFromPdf: false,
                        pdfPageCount: 0
                    };
                }

                const processed = await this.prepareImageForUpload(
                    flyerSource.uploadFile,
                    { mode: fieldName === 'resourceLogo' ? 'logo' : 'flyer' }
                );
                const signature = this.getFileSignature(file);

                this[pendingKey] = {
                    ...processed,
                    signature,
                    convertedFromPdf: flyerSource.convertedFromPdf,
                    pdfPageCount: flyerSource.pdfPageCount || 0
                };

                const sizeWarning = this.getImageSizeRecommendation(processed.width, processed.height, processed.finalBytes);
                const pdfNote = flyerSource.convertedFromPdf
                    ? `<small>Converted from PDF (page 1${flyerSource.pdfPageCount > 1 ? ` of ${flyerSource.pdfPageCount}` : ''})</small>`
                    : '';

                if (preview) {
                    preview.innerHTML = `
                    <div class="preview-container">
                        <img src="${processed.dataUrl}" alt="Preview" class="preview-image">
                        <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview('${fieldName}')" aria-label="Remove image">&times;</button>
                        <div class="image-info">
                            ${pdfNote}
                            <small>${processed.width} × ${processed.height} pixels</small>
                            <small>${this.formatFileSize(processed.finalBytes)}</small>
                            ${sizeWarning ? `<small class="size-warning">${sizeWarning}</small>` : ''}
                        </div>
                    </div>
                `;
                } else if (fieldName === 'image' || fieldName === 'imageEs') {
                    const prevImg = document.getElementById('previewImg');
                    if (prevImg) {
                        prevImg.classList.add('ap-preview-pc-top--image');
                        prevImg.innerHTML = `<div class="ap-preview-pc-image-stage"><img class="ap-preview-pc-poster-image" src="${processed.dataUrl}" alt="Preview"></div>`;
                    }
                }

                if (fieldName === 'resourceLogo') {
                    this.updateResourceIconGroupState();
                    if (typeof window.setResourceLogoPreviewSrc === 'function') {
                        window.setResourceLogoPreviewSrc(processed.dataUrl);
                    }
                } else if (fieldName === 'image') {
                    this.syncFlyerUploadUI();
                } else if (fieldName === 'imageEs') {
                    this.toggleSpanishFlyerPanel(true);
                }

                if (processed.infoMessage) {
                    this.showTemporaryMessage(processed.infoMessage, 'info');
                } else if (sizeWarning) {
                    this.showTemporaryMessage(sizeWarning, 'info');
                } else if (flyerSource.convertedFromPdf) {
                    const pdfReadyMessage = fieldName === 'image'
                        ? 'PDF preview ready. The full PDF will be attached when you post.'
                        : 'Spanish PDF preview ready. Page 1 will show when students switch to Spanish.';
                    this.showTemporaryMessage(pdfReadyMessage, 'info');
                }
            } catch (error) {
                console.error('Image preview error:', error);
                const message = typeof error === 'string'
                    ? error
                    : ((fieldName === 'image' || fieldName === 'imageEs') && isPdfFile(file)
                        ? 'Could not read this PDF. Try a different file or export page 1 as a PNG/JPG.'
                        : 'Could not process this image. Please try a smaller JPG or PNG.');
                this.showTemporaryMessage(message, 'error');
                e.target.value = '';
                if (preview) preview.innerHTML = '';
                this[pendingKey] = null;
                if (fieldName === 'resourceLogo') {
                    this.updateResourceIconGroupState();
                    if (typeof window.clearResourceLogoPreviewSrc === 'function') {
                        window.clearResourceLogoPreviewSrc();
                    }
                }
            }
        } else {
            preview.innerHTML = '';
            this[pendingKey] = null;
            if (fieldName === 'resourceLogo') {
                this.updateResourceIconGroupState();
            }
            if (fieldName === 'image') {
                this.syncFlyerUploadUI();
            }
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    validateImageFile(file) {
        const result = {
            isValid: true,
            error: null,
            warnings: []
        };

        // File size check (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            result.isValid = false;
            result.error = 'Image file too large. Please select an image under 10MB.';
            return result;
        }

        // File type check
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            result.isValid = false;
            result.error = 'Invalid file type. Please select a JPEG, PNG, GIF, or WebP image.';
            return result;
        }

        // Size warnings
        if (file.size > 2 * 1024 * 1024) { // 2MB
            result.warnings.push('Large file size. Consider compressing the image for faster loading.');
        }

        if (file.size > 1024 * 1024) { // 1MB
            result.warnings.push('💡 Tip: For better performance, try to keep images under 1MB.');
        }

        return result;
    }

    getImageSizeRecommendation(width, height, fileSize) {
        // Optimal dimensions for bulletin images
        const maxWidth = 1280;
        const maxHeight = 1280;

        if (width > maxWidth * 2 || height > maxHeight * 2) {
            return '📐 Very large dimensions. Consider resizing to improve loading speed.';
        } else if (width > maxWidth || height > maxHeight) {
            return '📐 Large image. May load slowly on mobile devices.';
        } else if (width < 300 && height < 300 && fileSize > 100 * 1024) {
            return '🗜️ Small image with large file size. Try compressing to reduce file size.';
        }

        return null;
    }

    calculateBase64Size(dataUrl) {
        if (!dataUrl) return 0;
        const base64 = dataUrl.split(',')[1] || '';
        const padding = (base64.match(/=+$/) || [''])[0].length;
        return Math.floor(base64.length * 3 / 4) - padding;
    }

    buildImageOptimizationMessage(originalBytes, finalBytes, width, height) {
        if (!originalBytes || !finalBytes || finalBytes >= originalBytes) {
            return null;
        }

        const reduction = originalBytes - finalBytes;
        const percent = Math.round((reduction / originalBytes) * 100);
        const sizeSummary = `${this.formatFileSize(originalBytes)} → ${this.formatFileSize(finalBytes)}`;
        const dimensionSummary = width && height ? ` (${width} × ${height}px)` : '';

        return `Image optimized: ${sizeSummary} (${percent}% smaller)${dimensionSummary}.`;
    }

    getFileSignature(file) {
        return `${file.name}_${file.lastModified}_${file.size}`;
    }

    async prepareFlyerSourceFile(file, fieldName = 'image') {
        if ((fieldName === 'image' || fieldName === 'imageEs') && isPdfFile(file)) {
            if (file.size > 10 * 1024 * 1024) {
                throw 'PDF file too large. Please select a PDF under 10MB.';
            }

            const { convertPdfFirstPageToImageFile } = await import('./src/pdf-flyer.js');
            const converted = await convertPdfFirstPageToImageFile(file);
            const multiPageWarning = fieldName === 'image'
                ? `This PDF has ${converted.pageCount} pages. Page 1 will show on the board; the full PDF will be attached.`
                : `This PDF has ${converted.pageCount} pages. Page 1 will be used for the Spanish flyer.`;
            return {
                uploadFile: converted.imageFile,
                sourcePdf: file,
                convertedFromPdf: true,
                pdfPageCount: converted.pageCount,
                warnings: converted.pageCount > 1
                    ? [multiPageWarning]
                    : []
            };
        }

        const validation = this.validateImageFile(file);
        if (!validation.isValid) {
            throw validation.error;
        }

        return {
            uploadFile: file,
            sourcePdf: null,
            convertedFromPdf: false,
            pdfPageCount: 0,
            warnings: validation.warnings
        };
    }

    prepareImageForUpload(file, options = {}) {
        const isLogo = options.mode === 'logo';

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject('Unable to read image file.');
            reader.onload = (event) => {
                const originalDataUrl = event.target.result;
                const img = new Image();
                img.onload = () => {
                    const originalBytes = file.size;
                    const isOptimizable = !/image\/(gif|webp)/i.test(file.type);

                    if (!isOptimizable) {
                        const finalBytes = this.calculateBase64Size(originalDataUrl);
                        resolve({
                            dataUrl: originalDataUrl,
                            width: img.width,
                            height: img.height,
                            originalBytes,
                            finalBytes,
                            infoMessage: null
                        });
                        return;
                    }

                    const TARGET_BYTES = isLogo ? 450 * 1024 : 900 * 1024;
                    const MIN_DIMENSION = isLogo ? 0 : 600;
                    let currentMaxDimension = isLogo ? 960 : 1400;
                    let processedDataUrl = originalDataUrl;
                    let processedWidth = img.width;
                    let processedHeight = img.height;
                    let finalBytes = this.calculateBase64Size(originalDataUrl);
                    let quality;

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    let attempts = 0;
                    while (attempts < 5) {
                        const scale = Math.min(currentMaxDimension / img.width, currentMaxDimension / img.height, 1);
                        processedWidth = Math.max(Math.round(img.width * scale), MIN_DIMENSION || 1);
                        processedHeight = Math.max(Math.round(img.height * scale), MIN_DIMENSION || 1);

                        canvas.width = processedWidth;
                        canvas.height = processedHeight;
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, processedWidth, processedHeight);
                        ctx.drawImage(img, 0, 0, processedWidth, processedHeight);

                        if (isLogo) {
                            processedDataUrl = canvas.toDataURL('image/png');
                            finalBytes = this.calculateBase64Size(processedDataUrl);
                        } else {
                            quality = 0.85;
                            processedDataUrl = canvas.toDataURL('image/jpeg', quality);
                            finalBytes = this.calculateBase64Size(processedDataUrl);

                            while (finalBytes > TARGET_BYTES && quality >= 0.4) {
                                quality -= 0.1;
                                processedDataUrl = canvas.toDataURL('image/jpeg', quality);
                                finalBytes = this.calculateBase64Size(processedDataUrl);
                            }
                        }

                        if (finalBytes <= TARGET_BYTES) {
                            break;
                        }

                        if (isLogo) {
                            if (scale >= 1 || currentMaxDimension <= 240) {
                                break;
                            }
                            currentMaxDimension = Math.max(Math.round(currentMaxDimension * 0.85), 240);
                        } else if (processedWidth <= MIN_DIMENSION && processedHeight <= MIN_DIMENSION) {
                            break;
                        } else {
                            currentMaxDimension = Math.max(Math.round(currentMaxDimension * 0.75), MIN_DIMENSION);
                        }

                        attempts += 1;
                    }

                    if (finalBytes > 4 * 1024 * 1024) {
                        const message = isLogo
                            ? 'This logo is very large. Please resize it below 1200px on the longest edge and try again.'
                            : 'This image is very large. Please resize it below 2000px on the longest edge and try again.';
                        reject(message);
                        return;
                    }

                    const infoMessage = this.buildImageOptimizationMessage(
                        originalBytes,
                        finalBytes,
                        processedWidth,
                        processedHeight
                    );

                    resolve({
                        dataUrl: processedDataUrl,
                        width: processedWidth,
                        height: processedHeight,
                        originalBytes,
                        finalBytes,
                        infoMessage
                    });
                };
                img.onerror = () => reject('Unable to process this image file.');
                img.src = originalDataUrl;
            };
            reader.readAsDataURL(file);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeImagePreview(fieldName = 'image') {
        const { previewId, pendingKey } = this.getImageFieldConfig(fieldName);
        const input = document.getElementById(fieldName)
            || document.querySelector(`#bulletinForm [name="${fieldName}"]`);
        const preview = document.getElementById(previewId);

        if (input) input.value = '';
        if (preview) preview.innerHTML = '';
        this[pendingKey] = null;

        if (fieldName === 'resourceLogo') {
            if (this.isEditMode) {
                this.removeResourceLogo = true;
            }
            this.updateResourceIconGroupState();
            if (typeof window.clearResourceLogoPreviewSrc === 'function') {
                window.clearResourceLogoPreviewSrc();
            }
        }

        if (fieldName === 'image') {
            this.removePdfPreview();
            this.syncFlyerUploadUI();
        }
        if (fieldName === 'imageEs' && !document.getElementById('imageEsPreview')?.querySelector('.preview-image')) {
            this.toggleSpanishFlyerPanel(false);
        }

        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    handlePdfPreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('pdfPreview');
        if (!preview) return;

        if (file) {
            // Check file size (10MB limit for PDFs)
            if (file.size > 10 * 1024 * 1024) {
                this.showTemporaryMessage('PDF file too large. Please select a PDF under 10MB.', 'error');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            // Check file type
            if (file.type !== 'application/pdf') {
                this.showTemporaryMessage('Please select a valid PDF file.', 'error');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            preview.innerHTML = `
                <div class="pdf-preview-container">
                    <div class="pdf-preview-icon">📄</div>
                    <div class="pdf-preview-info">
                        <strong>${file.name}</strong>
                        <small>${this.formatFileSize(file.size)}</small>
                    </div>
                    <button type="button" class="remove-pdf" onclick="adminPanel.removePdfPreview()" aria-label="Remove PDF">&times;</button>
                </div>
            `;

            this.showTemporaryMessage('PDF file selected successfully!', 'success');
        } else {
            preview.innerHTML = '';
        }
    }

    removePdfPreview() {
        const pdfIn = document.getElementById('pdf');
        if (pdfIn) pdfIn.value = '';
        const pdfPrev = document.getElementById('pdfPreview');
        if (pdfPrev) pdfPrev.innerHTML = '';
    }

    handleResourcePdfPreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('resourcePdfPreview');
        if (!preview) return;

        if (!file) {
            preview.innerHTML = '';
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showTemporaryMessage('PDF file too large. Please select a PDF under 10MB.', 'error');
            e.target.value = '';
            preview.innerHTML = '';
            return;
        }

        if (file.type !== 'application/pdf') {
            this.showTemporaryMessage('Please select a valid PDF file.', 'error');
            e.target.value = '';
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = `
            <div class="pdf-preview-container">
                <div class="pdf-preview-icon">📄</div>
                <div class="pdf-preview-info">
                    <strong>${this.escapeHtml(file.name)}</strong>
                    <small>${this.formatFileSize(file.size)}</small>
                </div>
                <button type="button" class="remove-pdf" onclick="adminPanel.removeResourcePdfPreview()" aria-label="Remove PDF">&times;</button>
            </div>
        `;
        this.removeResourcePdf = false;
        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    removeResourcePdfPreview() {
        const input = document.getElementById('resourcePdf');
        const preview = document.getElementById('resourcePdfPreview');
        if (input) input.value = '';
        if (preview) preview.innerHTML = '';
        this.removeResourcePdf = true;
        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }
    }

    renderExistingResourcePdfPreview(pdfUrl) {
        const preview = document.getElementById('resourcePdfPreview');
        if (!preview) return;

        if (!pdfUrl) {
            preview.innerHTML = '';
            return;
        }

        preview.innerHTML = `
            <div class="pdf-preview-container">
                <div class="pdf-preview-icon">📄</div>
                <div class="pdf-preview-info">
                    <strong>Current form PDF</strong>
                    <small><a href="${this.escapeAttribute(pdfUrl)}" target="_blank" rel="noopener">Open uploaded PDF</a></small>
                </div>
                <button type="button" class="remove-pdf" onclick="adminPanel.removeResourcePdfPreview()" aria-label="Remove PDF">&times;</button>
            </div>
        `;
        this.removeResourcePdf = false;
    }


    deleteBulletin(bulletinId) {
        this.showConfirmDialog(
            'Delete this bulletin?',
            'It will be hidden from students right away. This cannot be undone.',
            async () => {
                try {
                    await updateDoc(doc(db, 'bulletins', bulletinId), { isActive: false });
                    this.showTemporaryMessage('Bulletin deleted.', 'success');
                } catch (error) {
                    console.error('Error deleting bulletin:', error);
                    this.showTemporaryMessage(this.getFirestoreErrorMessage(error, 'delete this bulletin'), 'error');
                }
            }
        );
    }

    showConfirmDialog(title, body, onConfirm) {
        const existing = document.getElementById('inlineConfirmDialog');
        if (existing) existing.remove();

        const dialog = document.createElement('div');
        dialog.id = 'inlineConfirmDialog';
        dialog.style.cssText = `
            position: fixed; inset: 0; z-index: 2000;
            display: flex; align-items: center; justify-content: center;
            background: rgba(15,23,42,0.55); backdrop-filter: blur(4px);
            padding: 20px;
        `;
        dialog.innerHTML = `
            <div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center">
                <div style="font-size:32px;margin-bottom:12px">🗑️</div>
                <h3 style="font-family:'Outfit',sans-serif;font-size:18px;font-weight:800;color:#0a1d3a;margin:0 0 8px">${title}</h3>
                <p style="font-size:14px;color:#475569;margin:0 0 24px;line-height:1.5">${body}</p>
                <div style="display:flex;gap:10px">
                    <button id="confirmDialogCancel" style="flex:1;padding:12px;border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;font-size:14px;font-weight:700;color:#475569;cursor:pointer">Keep it</button>
                    <button id="confirmDialogOk" style="flex:1;padding:12px;border:none;background:#dc2626;border-radius:12px;font-size:14px;font-weight:700;color:#fff;cursor:pointer">Yes, delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const close = () => dialog.remove();
        dialog.querySelector('#confirmDialogCancel').addEventListener('click', close);
        dialog.querySelector('#confirmDialogOk').addEventListener('click', () => { close(); onConfirm(); });
        dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
    }

    editBulletin(bulletinId) {
        const bulletin = this.bulletins.find(b => b.id === bulletinId);
        if (!bulletin) {
            this.showTemporaryMessage('Could not find that bulletin. Try refreshing the page.', 'error');
            return;
        }

        this.editReturnManagePage = this.getManagePageForContentKind(bulletin);

        // Switch to post tab (skip preview sync until edit data is loaded)
        window.__skipCreatePreviewSync = true;
        this.showTab('post');
        window.__skipCreatePreviewSync = false;
        document.getElementById('bulletinForm').reset();
        const resourceLogoPreviewEl = document.getElementById('resourceLogoPreview');
        if (resourceLogoPreviewEl) resourceLogoPreviewEl.innerHTML = '';
        this.pendingImageData = null;
        this.pendingImageEsData = null;
        this.pendingResourceLogoData = null;
        this.removeResourceLogo = false;

        // Set edit mode
        this.isEditMode = true;
        this.editingBulletinId = bulletinId;

        const contentKind = this.getManageContentKind(bulletin);
        const isResource = contentKind === 'resource';
        const isEvent = contentKind === 'event';
        const set = (name, value, options) => this.setComposerMirror(name, value, options);
        let resourceServiceLabels = '';

        this.setContentType(isResource ? 'resource' : isEvent ? 'event' : 'post', { preserveFields: true, silent: true });

        if (isResource) {
            const resourceKind = normalizeResourceKind(bulletin.resourceKind);
            set('contentType', 'resource');
            set('resourceKind', resourceKind);
            set('resourceTitleEn', bulletin.titleEn || bulletin.title || '');
            set('resourceTitleEs', bulletin.titleEs || '');
            set('resourceCategory', bulletin.resourceCategory || '', {
                dataset: { suggestedIcon: bulletin.resourceIcon || null },
            });
            set('resourceUrl', bulletin.url || bulletin.eventLink || '');
            set('resourceDescription', bulletin.description || '');
            set('resourceSummaryEs', bulletin.summaryEs || '');

            const serviceValues = Array.isArray(bulletin.serviceChips) && bulletin.serviceChips.length
                ? bulletin.serviceChips
                : bulletin.services;
            resourceServiceLabels = Array.isArray(serviceValues) && serviceValues.length
                ? formatResourceServiceChipsInput(serviceValues)
                : formatResourceServiceChipsInput(bulletin.highlights || '');
            set('resourceHighlights', resourceServiceLabels);
            set('resourcePublished', bulletin.isPublished !== false ? 'on' : '');
            set('resourceOrder', bulletin.resourceOrder ?? '');
            set('resourceAddress', bulletin.address || '');
            set('resourcePhone', bulletin.phone || '');
            set('resourcePhoneMode', bulletin.phoneMode || 'call');
            set('resourceHours', bulletin.hours || '');

            const actionLinkValues = getResourceActionLinkFieldValues(bulletin.actionLinks);
            Object.entries(actionLinkValues).forEach(([fieldId, value]) => {
                set(fieldId, value);
            });
            this.removedActionLinkPdfSlots = new Set();
            this.renderExistingResourcePdfPreview(bulletin.pdfUrl || '');

            const resourceLogoPreview = document.getElementById('resourceLogoPreview');
            if (resourceLogoPreview) {
                if (bulletin.resourceLogo) {
                    resourceLogoPreview.innerHTML = `
                        <div class="preview-container">
                            <img src="${bulletin.resourceLogo}" alt="Logo preview" class="preview-image">
                            <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview('resourceLogo')" aria-label="Remove logo">&times;</button>
                        </div>
                    `;
                } else {
                    resourceLogoPreview.innerHTML = '';
                }
            }
            if (bulletin.resourceLogo && typeof window.setResourceLogoPreviewSrc === 'function') {
                window.setResourceLogoPreviewSrc(bulletin.resourceLogo);
            }
            this.updateResourceIconGroupState();
        } else {
            set('title', bulletin.title || '');
            set('titleEs', bulletin.titleEs || '');
            set('category', bulletin.category || '');
            set('description', bulletin.description || '');
            set('summaryEs', bulletin.summaryEs || '');
            set('company', bulletin.company || '');
            set('contact', bulletin.contact || '');
            set('contactPhone', bulletin.phone || '');
            set('contactPhoneMode', bulletin.phoneMode || 'call');
            set('contactHours', bulletin.hours || '');
            set('classType', bulletin.classType || '');
            set('eventLocation', bulletin.eventLocation || '');
            set('eventLink', bulletin.eventLink || '');

            if (bulletin.dateType) {
                set('dateType', bulletin.dateType);

                if (bulletin.dateType === 'deadline' || bulletin.dateType === 'event') {
                    set('eventDate', bulletin.eventDate || '');
                } else if (bulletin.dateType === 'range') {
                    set('startDate', bulletin.startDate || '');
                    set('endDate', bulletin.endDate || '');
                    set('eventDate', bulletin.startDate || bulletin.eventDate || '');
                } else if (bulletin.dateType === 'sessions') {
                    const sessionRows = this.getBulletinEventSessions(bulletin);
                    this.writeSessionMirrorInputs(
                        sessionRows.length ? sessionRows : [{ date: '' }, { date: '' }],
                    );
                    set('eventDate', sessionRows[0]?.date || '');
                    set('startTime', sessionRows[0]?.startTime || bulletin.startTime || '');
                    set('endTime', sessionRows[0]?.endTime || bulletin.endTime || '');
                }
            } else if (bulletin.deadline) {
                set('dateType', 'deadline');
                set('eventDate', bulletin.deadline);
            }

            set('startTime', bulletin.startTime || '');
            set('endTime', bulletin.endTime || '');
            this.syncFlyerUploadUI();
        }

        if (typeof window.PostComposer?.selectComposerType === 'function') {
            window.PostComposer.selectComposerType(isResource ? 'resource' : isEvent ? 'event' : 'bulletin', {
                resourceKind: isResource ? normalizeResourceKind(bulletin.resourceKind) : undefined,
                resourceHighlights: isResource ? resourceServiceLabels : undefined,
                syncPreview: false,
            });
        } else if (typeof window.apSelectType === 'function') {
            window.apSelectType(isResource ? 'resource' : isEvent ? 'event' : 'bulletin');
        }
        if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }

        // Store the bulletin ID for updating
        document.getElementById('bulletinForm').dataset.editingId = bulletinId;

        // Change submit button text
        this.setSubmitButtonLabel(isResource ? 'Update Resource' : 'Update Bulletin');

        // Show edit mode banner
        const formHeader = document.getElementById('formHeader');
        if (formHeader) {
            let banner = document.getElementById('editModeBanner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'editModeBanner';
                banner.style.cssText = `
                    display:flex;align-items:center;gap:10px;
                    background:linear-gradient(90deg,#fffbeb,#fef3c7);
                    border:1.5px solid #f59e0b;border-radius:12px;
                    padding:10px 14px;margin-bottom:16px;font-size:13px;
                    font-weight:700;color:#92400e;font-family:'Plus Jakarta Sans',sans-serif;
                `;
                formHeader.insertAdjacentElement('afterend', banner);
            }
            const shortTitle = (bulletin.title || bulletin.titleEn || 'this item').slice(0, 50);
            banner.innerHTML = `✏️ Editing: <span style="font-weight:500;color:#78350f">"${shortTitle}"</span> &nbsp;<button type="button" onclick="adminPanel.resetForm()" style="margin-left:auto;background:none;border:none;color:#b45309;font-size:12px;font-weight:700;cursor:pointer;text-decoration:underline">Cancel edit</button>`;
            banner.style.display = 'flex';
        }

        // Scroll form into view
        document.getElementById('bulletinForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        refreshRichEditors();

        // Streamlined composer: insert blocks for whichever optional fields are populated
        if (typeof window.PostComposer?.hydrateFromForm === 'function') {
            window.PostComposer.hydrateFromForm();
        } else if (typeof window.syncAdminStudentPreview === 'function') {
            window.syncAdminStudentPreview();
        }

        // hydrateFromForm defers its own preview sync; ensure resource/post edit still updates
        if (typeof window.PostComposer?.hydrateFromForm === 'function') {
            requestAnimationFrame(() => {
                if (typeof window.PostComposer?.syncComposerBeforePreview === 'function') {
                    window.PostComposer.syncComposerBeforePreview();
                }
                if (typeof window.syncAdminStudentPreview === 'function') {
                    window.syncAdminStudentPreview();
                }
            });
        }

        // Show existing flyer in student preview when editing a post
        if (!isResource && bulletin.image) {
            const prevImg = document.getElementById('previewImg');
            if (prevImg) {
                prevImg.classList.add('ap-preview-pc-top--image');
                prevImg.innerHTML = `<div class="ap-preview-pc-image-stage"><img class="ap-preview-pc-poster-image" src="${this.escapeAttribute(bulletin.image)}" alt="Preview"></div>`;
            }
        }
    }

    canManageAllPosts() {
        return this.currentUser?.isAdmin === true;
    }

    /** Email used for Firebase Auth sign-in (matches enhanced-auth parseLoginIdentifier). */
    getAdvisorAuthEmail(username) {
        const u = String(username || '').trim().toLowerCase();
        if (!u) return '';
        return u === 'admin' ? 'admin@ebhcs.org' : `${u}@ebhcs.org`;
    }

    async sendAdvisorPasswordReset(username) {
        if (!this.canManageAllPosts()) {
            this.showToast('Only admins can send password resets.', 'error');
            return;
        }
        const authEmail = this.getAdvisorAuthEmail(username);
        if (!authEmail) {
            this.showToast('Invalid username.', 'error');
            return;
        }
        const advisor = this.advisors.find((a) => a.username === username);
        const label = advisor?.displayName || username;
        const ok = confirm(
            `Send a password reset email to:\n${authEmail}\n\nThis is their Firebase login address (${label}). They will set a new password using the link in that inbox.`
        );
        if (!ok) return;
        try {
            if (typeof auth === 'undefined') {
                throw new Error('Authentication is not available.');
            }
            await sendPasswordResetEmail(auth, authEmail);
            this.showToast(`Reset email sent to ${authEmail}.`, 'success');
        } catch (e) {
            const code = e?.code;
            let msg = e?.message || 'Failed to send reset email.';
            if (code === 'auth/user-not-found') {
                msg = `No Firebase account for ${authEmail}. Create the user in Firebase Auth first, or fix the login email.`;
            } else if (code === 'auth/too-many-requests') {
                msg = 'Too many attempts. Try again later.';
            }
            console.error('sendAdvisorPasswordReset', e);
            this.showToast(msg, 'error');
        }
    }

    // ── Advisor Management ────────────────────────────────────────────

    loadAdvisors() {
        const container = document.getElementById('advisorsList');
        if (!container) return;
        if (!this.advisors.length) {
            container.innerHTML = '<p class="manage-empty">No advisors found.</p>';
            return;
        }
        const sorted = [...this.advisors].sort((a, b) => {
            const nameA = a.displayName || a.username || '';
            const nameB = b.displayName || b.username || '';
            return nameA.localeCompare(nameB);
        });
        container.innerHTML = sorted.map(a => `
            <div class="manage-card advisor-card" data-username="${this.escapeHtml(a.username)}">
                <div class="manage-card-header">
                    <h5>${this.escapeHtml(a.displayName)}</h5>
                    ${a.isAdmin ? '<span class="advisor-admin-badge">Admin</span>' : ''}
                </div>
                <div class="manage-card-body">
                    <p><strong>Username:</strong> ${this.escapeHtml(a.username)}</p>
                    <p><strong>Email:</strong> ${this.escapeHtml(getPublicAdvisorEmail(a))}</p>
                </div>
                <div class="manage-actions advisor-manage-actions">
                    <div class="manage-actions-primary">
                        <button type="button" class="edit-btn" onclick="adminPanel.openEditAdvisor('${this.escapeHtml(a.username)}')">Edit</button>
                        ${a.username !== this.currentUser.username ? `<button type="button" class="delete-btn" onclick="adminPanel.deleteAdvisor('${this.escapeHtml(a.username)}')">Remove</button>` : ''}
                    </div>
                    <button type="button" class="reset-password-btn" onclick="adminPanel.sendAdvisorPasswordReset('${this.escapeHtml(a.username)}')">Reset password</button>
                </div>
            </div>
        `).join('');
    }

    openEditAdvisor(username) {
        const advisor = this.advisors.find(a => a.username === username);
        if (!advisor) return;
        document.getElementById('editAdvisorUsername').value = advisor.username;
        document.getElementById('editAdvisorDisplayName').value = advisor.displayName;
        document.getElementById('editAdvisorEmail').value = getPublicAdvisorEmail(advisor);
        document.getElementById('editAdvisorIsAdmin').checked = advisor.isAdmin || false;
        document.getElementById('editAdvisorModal').style.display = 'flex';
    }

    closeEditAdvisor() {
        document.getElementById('editAdvisorModal').style.display = 'none';
    }

    async saveEditAdvisor() {
        const username = document.getElementById('editAdvisorUsername').value.trim();
        const displayName = document.getElementById('editAdvisorDisplayName').value.trim();
        const email = document.getElementById('editAdvisorEmail').value.trim();
        const isAdmin = document.getElementById('editAdvisorIsAdmin').checked;
        if (!username || !displayName) {
            this.showToast('Display name is required.', 'error'); return;
        }
        try {
            await updateDoc(doc(db, 'advisors', username), { displayName, email, isAdmin });
            const idx = this.advisors.findIndex(a => a.username === username);
            if (idx !== -1) this.advisors[idx] = { ...this.advisors[idx], displayName, email, isAdmin };
            // Keep current user's name in sync
            if (this.currentUser.username === username) {
                this.currentUser.name = displayName;
                this.currentUser.isAdmin = isAdmin;
                document.getElementById('welcomeMessage').textContent = `Welcome, ${displayName}!`;
            }
            this.closeEditAdvisor();
            this.loadAdvisors();
            this.showToast('Advisor updated.', 'success');
        } catch (e) {
            this.showToast('Error saving advisor: ' + e.message, 'error');
        }
    }

    async addAdvisor() {
        const username = document.getElementById('newAdvisorUsername').value.trim().toLowerCase();
        const displayName = document.getElementById('newAdvisorDisplayName').value.trim();
        const email = document.getElementById('newAdvisorEmail').value.trim();
        const isAdmin = document.getElementById('newAdvisorIsAdmin').checked;
        if (!username || !displayName) {
            this.showToast('Username and display name are required.', 'error'); return;
        }
        if (this.advisors.find(a => a.username === username)) {
            this.showToast('An advisor with that username already exists.', 'error'); return;
        }
        try {
            const loginEmail = (email || `${username}@ebhcs.org`).trim().toLowerCase();
            await setDoc(doc(db, 'advisors', username), {
                displayName,
                email: loginEmail,
                isAdmin,
                createdAt: serverTimestamp()
            });
            this.advisors.push({ username, displayName, email: loginEmail, isAdmin });
            document.getElementById('newAdvisorUsername').value = '';
            document.getElementById('newAdvisorDisplayName').value = '';
            document.getElementById('newAdvisorEmail').value = '';
            document.getElementById('newAdvisorIsAdmin').checked = false;
            this.loadAdvisors();
            this.showToast(`${displayName} added to the advisor list.`, 'success');
            this.showTemporaryMessage(
                `Next step (required): open Firebase Console → Authentication → Add user with email ${loginEmail}. They cannot log in until that account exists.`,
                'info'
            );
        } catch (e) {
            this.showToast('Error adding advisor: ' + e.message, 'error');
        }
    }

    async deleteAdvisor(username) {
        const advisor = this.advisors.find(a => a.username === username);
        if (!advisor) return;
        if (!confirm(`Remove ${advisor.displayName} as an advisor? This won't delete their login account.`)) return;
        try {
            await deleteDoc(doc(db, 'advisors', username));
            this.advisors = this.advisors.filter(a => a.username !== username);
            this.loadAdvisors();
            this.showToast(`${advisor.displayName} removed.`, 'success');
        } catch (e) {
            this.showToast('Error removing advisor: ' + e.message, 'error');
        }
    }

    loadManageBulletins() {
        const container = document.getElementById('manageBulletins');

        const searchQuery = (document.getElementById('manageSearchInput')?.value || '').toLowerCase().trim();
        const sortMode = document.getElementById('manageSortSelect')?.value || 'newest';
        const filterMode = document.getElementById('manageFilterSelect')?.value || 'all';
        const contentKind = document.getElementById('manageContentTypeSelect')?.value || 'all';

        let userBulletins = this.bulletins
            .filter(b => (this.canManageAllPosts() || b.postedBy === this.currentUser.username) && b.isActive);

        // Apply filter
        if (filterMode === 'active') {
            userBulletins = userBulletins.filter(b => {
                if (this.isResourceBulletin(b)) return b.isPublished !== false;
                return !this.isBulletinExpiredAdmin(b);
            });
        } else if (filterMode === 'expired') {
            userBulletins = userBulletins.filter(b => !this.isResourceBulletin(b) && this.isBulletinExpiredAdmin(b));
        }

        if (contentKind === 'bulletin') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'bulletin');
        } else if (contentKind === 'resource') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'resource');
        } else if (contentKind === 'event') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'event');
        }

        // Reorder mode: render every active resource grouped by category, regardless of search/sort/status filters
        if (this.resourceReorderMode && contentKind === 'resource') {
            const allResources = this.bulletins.filter(b => this.isResourceBulletin(b) && b.isActive);
            this.renderResourceReorderView(container, allResources);
            return;
        }

        // Apply search
        if (searchQuery) {
            userBulletins = userBulletins.filter(b => {
                const searchable = [
                    b.title,
                    b.titleEn,
                    b.titleEs,
                    b.category,
                    b.resourceCategory,
                    this.isResourceBulletin(b) ? this.getResourceCategoryLabel(b.resourceCategory) : this.getCategoryDisplay(b.category),
                    this.getAdvisorDisplayName(b),
                    b.description,
                    b.url,
                    b.eventLink,
                    b.highlights,
                    b.phone,
                    b.address
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(searchQuery);
            });
        }

        // Apply sort
        userBulletins.sort((a, b) => {
            if (sortMode === 'category') {
                return (a.category || a.resourceCategory || '').localeCompare(b.category || b.resourceCategory || '');
            }
            if (sortMode === 'deadline') {
                const aD = a.deadline || a.eventDate || a.endDate || '';
                const bD = b.deadline || b.eventDate || b.endDate || '';
                return aD.localeCompare(bD);
            }
            if (sortMode === 'oldest') {
                return this.getManageSortTimestamp(a) - this.getManageSortTimestamp(b);
            }
            return this.compareManagePosts(a, b);
        });

        if (userBulletins.length === 0) {
            if (searchQuery) {
                container.innerHTML = `<p>No posts match "<strong>${this.escapeHtml(searchQuery)}</strong>". Try a different search.</p>`;
            } else if (filterMode === 'expired') {
                container.innerHTML = '<p>No expired posts. Great — everything is still active!</p>';
            } else if (filterMode === 'active') {
                container.innerHTML = '<p>No active posts right now.</p>';
            } else if (contentKind === 'event') {
                container.innerHTML = '<p>No calendar events match these filters.</p>';
            } else if (contentKind === 'resource') {
                container.innerHTML = '<p>No resources match these filters.</p>';
            } else if (contentKind === 'bulletin') {
                container.innerHTML = '<p>No bulletins match these filters.</p>';
            } else {
                container.innerHTML = this.canManageAllPosts()
                    ? '<p>There are no bulletins to manage right now.</p>'
                    : '<p>You haven\'t posted anything yet. Use the <strong>New Content</strong> tab to create your first bulletin!</p>';
            }
            return;
        }

        container.innerHTML = userBulletins.map(bulletin => {
            const isResource = this.isResourceBulletin(bulletin);
            const kind = this.getManageContentKind(bulletin);
            const typeLabel = kind === 'resource'
                ? (isDocumentResource(bulletin) ? 'Document resource' : 'Organization resource')
                : kind === 'event' ? 'Calendar event' : 'Bulletin';
            const isDraft = isResource && bulletin.isPublished === false;
            const isExpired = !isResource && this.isBulletinExpiredAdmin(bulletin);
            const statusLabel = isDraft ? 'Draft / Hidden from students' : isExpired ? 'Expired' : 'Live';

            return `
            <div class="manage-card" data-bulletin-id="${bulletin.id}" id="manage-card-${bulletin.id}">
                <h5>${this.escapeHtml(this.getManageCardTitle(bulletin))}</h5>
                <p><strong>Type:</strong> ${typeLabel}</p>
                <p><strong>Status:</strong> ${statusLabel}</p>
                <p><strong>Category:</strong> ${isResource ? this.getResourceCategoryLabel(bulletin.resourceCategory) : this.getCategoryDisplay(bulletin.category)}</p>
                ${this.canManageAllPosts() && bulletin.postedBy !== this.currentUser.username ? `
                    <p><strong>Advisor:</strong> ${this.escapeHtml(this.getAdvisorDisplayName(bulletin))} (${this.escapeHtml(bulletin.postedBy)})</p>
                ` : ''}
                <p><strong>Posted:</strong> ${bulletin.datePosted
                    ? new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString()
                    : 'Unknown'}</p>
                ${isResource ? `
                    <p><strong>Spanish Title:</strong> ${this.escapeHtml(bulletin.titleEs || bulletin.titleEn || bulletin.title || '')}</p>
                    <p><strong>Published:</strong> ${bulletin.isPublished !== false ? 'Yes' : 'No — hidden from students'}</p>
                    ${bulletin.url || bulletin.eventLink ? `<p><strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.url || bulletin.eventLink)}" target="_blank" rel="noopener">Open resource</a></p>` : ''}
                    ${bulletin.pdfUrl ? `<p><strong>Form PDF:</strong> <a href="${this.escapeAttribute(bulletin.pdfUrl)}" target="_blank" rel="noopener">Open PDF</a></p>` : ''}
                    ${bulletin.description ? `<p><strong>Description:</strong> ${this.escapeHtml(bulletin.description)}</p>` : ''}
                    ${bulletin.highlights ? `<p><strong>Services:</strong> ${this.escapeHtml(bulletin.highlights)}</p>` : ''}
                    ${bulletin.address ? `<p><strong>Address:</strong> ${this.escapeHtml(bulletin.address)}</p>` : ''}
                    ${bulletin.phone ? `<p><strong>Phone:</strong> ${this.escapeHtml(bulletin.phone)} (${this.escapeHtml(bulletin.phoneMode || 'call')})</p>` : ''}
                    ${bulletin.resourceOrder !== '' && bulletin.resourceOrder !== undefined && bulletin.resourceOrder !== null ? `<p><strong>Display Order:</strong> ${this.escapeHtml(String(bulletin.resourceOrder))}</p>` : ''}
                ` : ''}
                ${this.renderManageDateInfo(bulletin)}
                <div class="manage-actions">
                    <button class="edit-btn" onclick="adminPanel.editBulletin('${bulletin.id}')">
                        Edit
                    </button>
                    <button class="delete-btn" onclick="adminPanel.deleteBulletin('${bulletin.id}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Scroll to and briefly highlight the card that was just posted/edited
        if (this.pendingHighlightId) {
            const highlightId = this.pendingHighlightId;
            this.pendingHighlightId = null;
            requestAnimationFrame(() => {
                const card = document.getElementById(`manage-card-${highlightId}`);
                if (!card) return;
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'box-shadow 0.3s ease, outline 0.3s ease';
                card.style.outline = '2.5px solid #22c55e';
                card.style.boxShadow = '0 0 0 6px rgba(34,197,94,0.15)';
                setTimeout(() => {
                    card.style.outline = '';
                    card.style.boxShadow = '';
                }, 2500);
            });
        }
    }

    toggleResourceReorderMode() {
        const contentType = document.getElementById('manageContentTypeSelect');
        if (contentType && contentType.value !== 'resource') {
            contentType.value = 'resource';
        }
        this.resourceReorderMode = !this.resourceReorderMode;
        this.updateReorderToggleUI();
        this.loadManageBulletins();
    }

    updateReorderToggleUI() {
        const toggle = document.getElementById('manageReorderToggle');
        const label = document.getElementById('manageReorderToggleLabel');
        const banner = document.getElementById('manageReorderBanner');
        const contentKind = document.getElementById('manageContentTypeSelect')?.value || 'all';
        const visible = contentKind === 'resource';
        if (toggle) {
            toggle.style.display = visible ? '' : 'none';
            toggle.classList.toggle('is-active', this.resourceReorderMode);
            toggle.style.background = this.resourceReorderMode ? 'var(--ap-blue, #2563eb)' : '';
            toggle.style.color = this.resourceReorderMode ? '#fff' : '';
            toggle.style.borderColor = this.resourceReorderMode ? 'var(--ap-blue, #2563eb)' : '';
        }
        if (label) label.textContent = this.resourceReorderMode ? 'Done reordering' : 'Reorder';
        if (banner) banner.style.display = (visible && this.resourceReorderMode) ? '' : 'none';
    }

    renderResourceReorderView(container, resources) {
        if (resources.length === 0) {
            container.innerHTML = '<p>No resources yet. Create one from the New Content tab, then come back to reorder.</p>';
            return;
        }

        const orderOf = (r) => {
            const v = r.resourceOrder;
            return (v === null || v === undefined || v === '') ? Number.POSITIVE_INFINITY : Number(v);
        };
        const dateOf = (r) => {
            if (!r.datePosted) return 0;
            return r.datePosted.toDate ? r.datePosted.toDate().getTime() : new Date(r.datePosted).getTime();
        };

        const categoryOrder = ['immigration', 'jobs', 'housing', 'health', 'legal-aid'];
        const grouped = {};
        resources.forEach(r => {
            const cat = r.resourceCategory || 'other';
            (grouped[cat] = grouped[cat] || []).push(r);
        });
        Object.keys(grouped).forEach(cat => {
            grouped[cat].sort((a, b) => {
                const oa = orderOf(a), ob = orderOf(b);
                if (oa !== ob) return oa - ob;
                return dateOf(b) - dateOf(a);
            });
        });
        const orderedCats = [
            ...categoryOrder.filter(c => grouped[c]),
            ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)).sort()
        ];

        const handleSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';

        container.innerHTML = orderedCats.map(cat => {
            const items = grouped[cat];
            const label = this.getResourceCategoryLabel(cat);
            const cards = items.map((r) => {
                const title = r.titleEn || r.title || 'Untitled resource';
                return `
                <div class="reorder-card" draggable="true" data-bulletin-id="${r.id}" data-category="${this.escapeAttribute(cat)}">
                    <button type="button" class="reorder-handle" aria-label="Drag ${this.escapeAttribute(title)}">${handleSvg}</button>
                    <div class="reorder-card-body">
                        <div class="reorder-card-title">${this.escapeHtml(title)}</div>
                        <div class="reorder-card-meta">
                            ${r.isPublished === false ? '<span class="reorder-pill reorder-pill-draft">Hidden</span>' : '<span class="reorder-pill reorder-pill-live">Live</span>'}
                            <span class="reorder-card-advisor">Posted by ${this.escapeHtml(this.getAdvisorDisplayName(r) || '—')}</span>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            return `
                <section class="reorder-section" data-category="${this.escapeAttribute(cat)}">
                    <header class="reorder-section-header">
                        <h4>${this.escapeHtml(label)}</h4>
                        <span class="reorder-count">${items.length} resource${items.length === 1 ? '' : 's'}</span>
                    </header>
                    <div class="reorder-list" data-category="${this.escapeAttribute(cat)}">
                        ${cards}
                    </div>
                </section>
            `;
        }).join('');

        this.attachReorderDragHandlers(container);
    }

    attachReorderDragHandlers(container) {
        const lists = container.querySelectorAll('.reorder-list');
        let draggedId = null;
        let draggedFromCategory = null;

        const clearIndicators = () => {
            container.querySelectorAll('.reorder-card').forEach(c => {
                c.classList.remove('drop-before', 'drop-after', 'is-dragging');
            });
        };

        lists.forEach(list => {
            list.addEventListener('dragstart', (e) => {
                const card = e.target.closest('.reorder-card');
                if (!card) return;
                draggedId = card.dataset.bulletinId;
                draggedFromCategory = card.dataset.category;
                card.classList.add('is-dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', draggedId); } catch (_) {}
                }
            });

            list.addEventListener('dragover', (e) => {
                if (!draggedId) return;
                if (list.dataset.category !== draggedFromCategory) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const target = e.target.closest('.reorder-card');
                container.querySelectorAll('.reorder-card.drop-before, .reorder-card.drop-after')
                    .forEach(c => c.classList.remove('drop-before', 'drop-after'));
                if (!target || target.dataset.bulletinId === draggedId) return;
                const rect = target.getBoundingClientRect();
                const before = (e.clientY - rect.top) < rect.height / 2;
                target.classList.add(before ? 'drop-before' : 'drop-after');
            });

            list.addEventListener('dragleave', (e) => {
                if (!list.contains(e.relatedTarget)) {
                    container.querySelectorAll('.reorder-card.drop-before, .reorder-card.drop-after')
                        .forEach(c => c.classList.remove('drop-before', 'drop-after'));
                }
            });

            list.addEventListener('drop', async (e) => {
                if (!draggedId) return;
                if (list.dataset.category !== draggedFromCategory) {
                    clearIndicators();
                    draggedId = null;
                    draggedFromCategory = null;
                    return;
                }
                e.preventDefault();
                const target = e.target.closest('.reorder-card');
                const draggedCard = list.querySelector(`.reorder-card[data-bulletin-id="${draggedId}"]`);
                if (!draggedCard) { clearIndicators(); draggedId = null; return; }

                if (target && target.dataset.bulletinId !== draggedId) {
                    const rect = target.getBoundingClientRect();
                    const before = (e.clientY - rect.top) < rect.height / 2;
                    if (before) list.insertBefore(draggedCard, target);
                    else list.insertBefore(draggedCard, target.nextSibling);
                } else if (!target) {
                    list.appendChild(draggedCard);
                }
                clearIndicators();

                const category = list.dataset.category;
                const orderedIds = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId);

                draggedId = null;
                draggedFromCategory = null;

                try {
                    await this.reorderResourcesInCategory(category, orderedIds);
                    this.showTemporaryMessage('Order saved.', 'success');
                } catch (err) {
                    console.error('Reorder failed', err);
                    this.showTemporaryMessage('Could not save the new order. Please try again.', 'error');
                    this.loadManageBulletins();
                }
            });

            list.addEventListener('dragend', () => {
                clearIndicators();
                draggedId = null;
                draggedFromCategory = null;
            });
        });

        this.attachReorderPointerHandlers(container);
    }

    attachReorderPointerHandlers(container) {
        if (container._resourceReorderPointerBound) return;
        container._resourceReorderPointerBound = true;

        let drag = null;

        const clearPointerDrag = () => {
            if (!drag) return;
            drag.card.setAttribute('draggable', 'true');
            drag.card.classList.remove('is-pointer-dragging', 'is-dragging');
            document.body.classList.remove('is-resource-reordering');
            drag = null;
        };

        const getCardAtPoint = (x, y) => {
            const el = document.elementFromPoint(x, y);
            const card = el?.closest?.('.reorder-card');
            if (!card || !drag || !drag.list.contains(card) || card === drag.card) return null;
            return card;
        };

        const moveDragToPoint = (x, y) => {
            const target = getCardAtPoint(x, y);
            if (!target) return;

            const rect = target.getBoundingClientRect();
            const before = (y - rect.top) < rect.height / 2;
            if (before) {
                drag.list.insertBefore(drag.card, target);
            } else {
                drag.list.insertBefore(drag.card, target.nextSibling);
            }
            drag.moved = true;
        };

        const startDrag = (e, pointerId, pointerType = 'mouse') => {
            const eventTarget = e.target?.closest ? e.target : document.elementFromPoint(e.clientX, e.clientY);
            const handle = eventTarget?.closest?.('.reorder-handle') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.reorder-handle');
            if (drag || !handle || !container.contains(handle)) return false;
            if (!window.matchMedia('(max-width: 768px)').matches) return false;

            const card = handle.closest('.reorder-card');
            const list = handle.closest('.reorder-list');
            if (!card || !list) return false;

            e.preventDefault();
            e.stopPropagation();
            card.setAttribute('draggable', 'false');
            drag = {
                card,
                list,
                pointerId,
                pointerType,
                startOrder: Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|'),
                moved: false
            };
            card.classList.add('is-pointer-dragging', 'is-dragging');
            document.body.classList.add('is-resource-reordering');
            return true;
        };

        container.addEventListener('pointerdown', (e) => {
            if (startDrag(e, e.pointerId, e.pointerType)) {
                e.target.closest('.reorder-handle')?.setPointerCapture?.(e.pointerId);
            }
        });

        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || drag) return;
            startDrag(e, 'mouse');
        });

        document.addEventListener('pointermove', (e) => {
            if (!drag || drag.pointerId !== e.pointerId) return;
            e.preventDefault();
            moveDragToPoint(e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (!drag || (drag.pointerId !== 'mouse' && drag.pointerType !== 'mouse')) return;
            e.preventDefault();
            moveDragToPoint(e.clientX, e.clientY);
        });

        const finishDrag = async (e) => {
            if (!drag || drag.pointerId !== e.pointerId) return;
            moveDragToPoint(e.clientX, e.clientY);

            const list = drag.list;
            const nextOrder = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|');
            const changed = drag.moved && nextOrder !== drag.startOrder;
            clearPointerDrag();
            if (!changed) return;

            await this.saveResourceListOrder(list);
        };

        document.addEventListener('pointerup', finishDrag);
        document.addEventListener('pointercancel', clearPointerDrag);
        document.addEventListener('mouseup', async (e) => {
            if (!drag || (drag.pointerId !== 'mouse' && drag.pointerType !== 'mouse')) return;
            moveDragToPoint(e.clientX, e.clientY);

            const list = drag.list;
            const nextOrder = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|');
            const changed = drag.moved && nextOrder !== drag.startOrder;
            clearPointerDrag();
            if (!changed) return;

            await this.saveResourceListOrder(list);
        });
    }

    async saveResourceListOrder(list) {
        const category = list.dataset.category;
        const orderedIds = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId);

        try {
            await this.reorderResourcesInCategory(category, orderedIds);
            this.showTemporaryMessage('Order saved.', 'success');
        } catch (err) {
            console.error('Reorder failed', err);
            this.showTemporaryMessage('Could not save the new order. Please try again.', 'error');
            this.loadManageBulletins();
        }
    }

    // Utility Methods
    getManageCardTitle(bulletin) {
        if (this.isResourceBulletin(bulletin)) {
            return bulletin.titleEn || bulletin.title || 'Untitled Resource';
        }

        return bulletin.title || 'Untitled Bulletin';
    }

    getResourceCategoryLabel(category) {
        return ADMIN_RESOURCE_CATEGORY_LABELS[category] || 'Resource / Recurso';
    }

    async reorderResourcesInCategory(category, orderedIds) {
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
        const batch = writeBatch(db);
        orderedIds.forEach((id, i) => {
            batch.update(doc(db, 'bulletins', id), {
                resourceOrder: (i + 1) * 10,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
        orderedIds.forEach((id, i) => {
            const bulletin = this.bulletins.find(b => b.id === id);
            if (bulletin) bulletin.resourceOrder = (i + 1) * 10;
        });
    }

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

    escapeAttribute(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    formatEventTime(timeString) {
        if (!timeString) return '';
        try {
            const [hourStr, minuteStr] = timeString.split(':');
            let hour = parseInt(hourStr, 10);
            const minute = minuteStr || '00';
            if (isNaN(hour)) {
                return timeString;
            }
            const period = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${minute.padStart(2, '0')} ${period}`;
        } catch (error) {
            return timeString;
        }
    }

    formatLinkLabel(url, category) {
        if (!url) return '';

        const labels = {
            'job': 'Job Posting Link',
            'training': 'Training Link',
            'college': 'College/University Link',
            'career-fair': 'Event Link',
            'immigration': 'More Information',
            'announcement': 'More Information',
            'resource': 'Resource Link'
        };

        return labels[category] || 'More Information';
    }

    formatRichText(rawText) {
        const div = document.createElement('div');
        div.textContent = rawText || '';
        return this.applyInlineFormatting(div.innerHTML);
    }

    applyInlineFormatting(html) {
        return (html || '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
    }

    getFirestoreErrorMessage(error, actionDescription) {
        const fallback = `Unable to ${actionDescription}. Please try again.`;

        if (!error) {
            return fallback;
        }

        const code = (error.code || '').replace('firestore/', '');

        switch (code) {
            case 'permission-denied':
                return `${fallback} You do not have permission for this action. Make sure you are logged in with your advisor email.`;
            case 'unauthenticated':
                return `${fallback} Your session expired—please log in again.`;
            case 'resource-exhausted':
                return `${fallback} The upload is too large. Try reducing the attachment size.`;
            case 'unavailable':
                return `${fallback} Firestore is temporarily unavailable. Check your internet connection and retry.`;
            case 'deadline-exceeded':
                return `${fallback} The request timed out. Please try again in a moment.`;
            default:
                if (error.message) {
                    return `${fallback} Details: ${error.message}`;
                }
                return fallback;
        }
    }

    getCompatibleDeadline(formData) {
        const dateType = formData.get('dateType');
        if (dateType === 'deadline') {
            return formData.get('eventDate') || '';
        } else if (dateType === 'event') {
            return formData.get('eventDate') || '';
        } else if (dateType === 'range') {
            return formData.get('startDate') || '';
        } else if (dateType === 'sessions') {
            const sessions = sessionsFromFormData(formData);
            return sessions.length ? sessions[sessions.length - 1].date : '';
        }
        return '';
    }

    isDeadlineClose(deadline) {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        const timeDiff = deadlineDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        return daysDiff <= 7 && daysDiff >= 0;
    }

    isBulletinExpiredAdmin(bulletin) {
        if (!bulletin) return false;
        const endOfDay = (dateStr) => {
            const d = new Date(dateStr);
            d.setHours(23, 59, 59, 999);
            return d;
        };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Prefer explicit deadline, fall back to endDate then eventDate so that
        // events and range posts without a separate deadline field also expire.
        const check = bulletin.deadline || bulletin.endDate || bulletin.eventDate;
        if (!check) return false;
        const d = endOfDay(check);
        return !Number.isNaN(d.getTime()) && d < today;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessMessage(message) {
        this.showTemporaryMessage(message, 'success');
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.toast-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = 'toast-message';

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const colors = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        };

        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
            z-index: 1001;
            font-weight: 500;
            max-width: 350px;
            font-size: 14px;
            line-height: 1.4;
            animation: slideInRight 0.3s ease-out;
            cursor: pointer;
        `;

        messageDiv.innerHTML = `
            <span style="margin-right: 8px; font-size: 16px;">${icons[type] || icons.info}</span>
            ${message}
        `;

        // Click to dismiss
        messageDiv.addEventListener('click', () => {
            messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => messageDiv.remove(), 300);
        });

        document.body.appendChild(messageDiv);

        // Auto-remove after delay
        const delay = type === 'error' ? 6000 : 4000; // Longer for errors
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, delay);
    }

    setupFormValidation() {
        const titleInput = document.getElementById('title');
        const descriptionTextarea = document.getElementById('description');
        if (!titleInput || !descriptionTextarea) return;

        // Title validation
        titleInput.addEventListener('input', (e) => {
            this.validateField(e.target, 'titleFeedback', {
                required: true,
                minLength: 3,
                maxLength: 200,
                label: 'Title'
            });
        });

        titleInput.addEventListener('blur', (e) => {
            this.validateField(e.target, 'titleFeedback', {
                required: true,
                minLength: 3,
                maxLength: 200,
                label: 'Title'
            });
        });

        // Description validation (optional)
        descriptionTextarea.addEventListener('input', (e) => {
            this.validateField(e.target, 'descriptionFeedback', {
                required: false,
                minLength: 1,
                maxLength: 2000,
                label: 'Description'
            });
        });

        descriptionTextarea.addEventListener('blur', (e) => {
            this.validateField(e.target, 'descriptionFeedback', {
                required: false,
                minLength: 1,
                maxLength: 2000,
                label: 'Description'
            });
        });
    }

    validateField(field, feedbackId, rules) {
        const feedback = document.getElementById(feedbackId);
        const value = field.value.trim();
        let message = '';
        let isValid = true;
        let type = 'success';

        // Required check
        if (rules.required && !value) {
            message = `${rules.label} is required`;
            isValid = false;
            type = 'error';
        }
        // Length checks
        else if (value && rules.minLength && value.length < rules.minLength) {
            message = `${rules.label} must be at least ${rules.minLength} characters`;
            isValid = false;
            type = 'error';
        }
        else if (value && rules.maxLength && value.length > rules.maxLength) {
            message = `${rules.label} cannot exceed ${rules.maxLength} characters`;
            isValid = false;
            type = 'error';
        }
        // Success state
        else if (value) {
            if (rules.maxLength) {
                const remaining = rules.maxLength - value.length;
                if (remaining < 50) {
                    message = `${remaining} characters remaining`;
                    type = 'warning';
                } else {
                    message = '✓ Looks good!';
                    type = 'success';
                }
            } else {
                message = '✓ Looks good!';
                type = 'success';
            }
        }

        // Apply feedback
        feedback.textContent = message;
        feedback.className = `field-feedback ${type}`;

        // Apply field styling
        field.classList.remove('valid', 'invalid');
        if (value) {
            field.classList.add(isValid ? 'valid' : 'invalid');
        }

        return isValid;
    }

    // Content moderation
    moderateContent(text) {
        const inappropriateWords = [
            // Basic inappropriate content filters
            'spam', 'scam', 'fake', 'fraud', 'illegal', 'drugs', 'weapons',
            // Add more as needed
        ];

        const suspiciousPatterns = [
            /\$\d+.*per.*hour.*work.*home/i, // Work from home scams
            /click.*here.*now.*money/i, // Clickbait scams
            /urgent.*respond.*immediately/i, // Urgent response scams
            /guaranteed.*income/i, // Get rich quick
            /no.*experience.*required.*\$\d+/i, // Too good to be true jobs
        ];

        const content = text.toLowerCase();
        const warnings = [];

        // Check for inappropriate words
        for (const word of inappropriateWords) {
            if (content.includes(word.toLowerCase())) {
                warnings.push(`Contains potentially inappropriate word: "${word}"`);
            }
        }

        // Check for suspicious patterns
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(content)) {
                warnings.push('Content matches suspicious pattern (possible scam)');
                break;
            }
        }

        // Check for excessive caps
        const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
        if (capsRatio > 0.5 && text.length > 20) {
            warnings.push('Excessive use of capital letters');
        }

        // Check for excessive punctuation
        const exclamationCount = (text.match(/!/g) || []).length;
        if (exclamationCount > 5) {
            warnings.push('Excessive use of exclamation marks');
        }

        return {
            isClean: warnings.length === 0,
            warnings: warnings,
            riskLevel: warnings.length === 0 ? 'low' : warnings.length < 3 ? 'medium' : 'high'
        };
    }

    validateBulletinContent(bulletin) {
        const titleModeration = this.moderateContent(bulletin.title);
        const descriptionModeration = this.moderateContent(bulletin.description);
        const companyModeration = bulletin.company ? this.moderateContent(bulletin.company) : { isClean: true, warnings: [] };

        const allWarnings = [
            ...titleModeration.warnings.map(w => `Title: ${w}`),
            ...descriptionModeration.warnings.map(w => `Description: ${w}`),
            ...companyModeration.warnings.map(w => `Company: ${w}`)
        ];

        return {
            isClean: titleModeration.isClean && descriptionModeration.isClean && companyModeration.isClean,
            warnings: allWarnings,
            riskLevel: Math.max(
                titleModeration.warnings.length,
                descriptionModeration.warnings.length,
                companyModeration.warnings.length
            ) < 3 ? 'medium' : 'high'
        };
    }

    getAuthPostedBy() {
        const email = auth.currentUser?.email || this.currentUser?.email || '';
        if (email.includes('@')) {
            return email.split('@')[0].toLowerCase();
        }
        return (this.currentUser?.username || '').toLowerCase();
    }

    getAdvisorDisplayName(doc) {
        if (doc.advisorName) return doc.advisorName;
        const uid = doc.createdBy || doc.postedBy || '';
        if (!uid) return '';
        const match = this.advisors.find(a => a.username === uid || a.uid === uid);
        return match ? (match.displayName || match.username || '') : uid;
    }

    async createBulletin(formData) {
        const bulletin = this.buildBulletinObject(formData);
        bulletin.postedBy = this.getAuthPostedBy();
        bulletin.datePosted = serverTimestamp();
        bulletin.createdAt = serverTimestamp();
        bulletin.updatedAt = serverTimestamp();

        // Create the Firestore document FIRST to get an ID
        const docRef = await addDoc(collection(db, 'bulletins'), bulletin);
        const bulletinId = docRef.id;

        if (this.isResourceBulletin(bulletin)) {
            const resourceLogoFile = formData.get('resourceLogo');
            const resourcePdfFile = formData.get('resourcePdf');
            const actionLinks = await this.finalizeResourceActionLinks(
                formData,
                bulletinId,
                bulletin.actionLinks || [],
            );
            await updateDoc(doc(db, 'bulletins', bulletinId), { actionLinks });
            if (resourceLogoFile && resourceLogoFile.size > 0) {
                await this.handleImageUpload(resourceLogoFile, bulletin, null, bulletinId, 'resourceLogo');
            }
            if (isDocumentResource(bulletin) && resourcePdfFile && resourcePdfFile.size > 0) {
                await this.handlePdfUpload(resourcePdfFile, bulletin, bulletinId);
            }
            this.loadManageBulletins();
            return bulletinId;
        }

        const imageFile = formData.get('image');
        const imageEsFile = formData.get('imageEs');
        const pdfFile = formData.get('pdf');
        const attachSourcePdf = formData.get('attachSourcePdf') === 'on';

        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile, bulletinId, 'image', { attachSourcePdf });
        } else if (pdfFile && pdfFile.size > 0) {
            await this.handlePdfUpload(pdfFile, bulletin, bulletinId);
        }
        
        if (imageEsFile && imageEsFile.size > 0) {
            await this.handleImageUpload(imageEsFile, bulletin, null, bulletinId, 'imageEs');
        }

        // Reload bulletins to show the new one
        this.loadManageBulletins();
        return bulletinId;
    }

    async updateBulletin(formData, bulletinId) {
        const bulletin = this.buildBulletinObject(formData);
        bulletin.updatedAt = serverTimestamp();

        // Preserve existing data
        const existingBulletin = this.bulletins.find(b => b.id === bulletinId);
        if (existingBulletin) {
            bulletin.postedBy = existingBulletin.postedBy;
            bulletin.datePosted = existingBulletin.datePosted;
            bulletin.createdAt = existingBulletin.createdAt || existingBulletin.datePosted;
            bulletin.image = this.isResourceBulletin(bulletin) ? null : (existingBulletin.image || null);
            bulletin.imageEs = this.isResourceBulletin(bulletin) ? null : (existingBulletin.imageEs || null);
            if (this.isResourceBulletin(bulletin)) {
                bulletin.pdfUrl = isDocumentResource(bulletin)
                    ? (this.removeResourcePdf ? null : (existingBulletin.pdfUrl || null))
                    : null;
            } else {
                bulletin.pdfUrl = existingBulletin.pdfUrl || null;
            }
            if (this.isResourceBulletin(bulletin)) {
                bulletin.resourceLogo = existingBulletin.resourceLogo || null;
                // If the form field is absent from the submission (hidden input missing or
                // cleared), fall back to the existing published state rather than silently
                // unpublishing the resource.
                if (formData.get('resourcePublished') === null) {
                    bulletin.isPublished = existingBulletin.isPublished !== false;
                }
            }
        }

        if (this.isResourceBulletin(bulletin)) {
            const resourceLogoFile = formData.get('resourceLogo');
            const resourcePdfFile = formData.get('resourcePdf');
            const hasNewLogo = resourceLogoFile && resourceLogoFile.size > 0;

            if (!hasNewLogo && this.removeResourceLogo) {
                bulletin.resourceLogo = null;
            }

            const actionLinks = await this.finalizeResourceActionLinks(
                formData,
                bulletinId,
                existingBulletin?.actionLinks || [],
            );
            bulletin.actionLinks = actionLinks;

            if (hasNewLogo) {
                await this.saveBulletin(bulletin, bulletinId);
                await this.handleImageUpload(resourceLogoFile, bulletin, null, bulletinId, 'resourceLogo');
            } else {
                await this.saveBulletin(bulletin, bulletinId);
            }

            if (isDocumentResource(bulletin) && resourcePdfFile && resourcePdfFile.size > 0) {
                await this.handlePdfUpload(resourcePdfFile, bulletin, bulletinId);
            }

            this.removeResourceLogo = false;
            this.removeResourcePdf = false;
            this.removedActionLinkPdfSlots = new Set();
            return;
        }

        await this.saveBulletin(bulletin, bulletinId);

        const imageFile = formData.get('image');
        const imageEsFile = formData.get('imageEs');
        const pdfFile = formData.get('pdf');
        const attachSourcePdf = formData.get('attachSourcePdf') === 'on';

        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile, bulletinId, 'image', { attachSourcePdf });
        } else if (pdfFile && pdfFile.size > 0) {
            await this.handlePdfUpload(pdfFile, bulletin, bulletinId);
        }

        if (imageEsFile && imageEsFile.size > 0) {
            await this.handleImageUpload(imageEsFile, bulletin, null, bulletinId, 'imageEs');
        }
    }

    buildBulletinObject(formData) {
        const contentType = (formData.get('contentType') || this.contentType || 'post') === 'resource' ? 'resource' : 'post';

        if (contentType === 'resource') {
            const titleEn = (formData.get('resourceTitleEn') || '').trim();
            const titleEs = (formData.get('resourceTitleEs') || '').trim();
            const resourceCategory = (formData.get('resourceCategory') || '').trim();
            const resourceKind = normalizeResourceKind(formData.get('resourceKind'));
            const isDocument = resourceKind === RESOURCE_KIND_DOCUMENT;
            let url = (formData.get('resourceUrl') || '').trim();
            const rawOrder = (formData.get('resourceOrder') || '').trim();

            if (!titleEn) {
                throw new Error('English title is required for resources.');
            }

            if (!resourceCategory) {
                throw new Error('Resource category is required.');
            }

            if (!isDocument && !url) {
                if (this.isEditMode && this.editingBulletinId) {
                    const existing = this.bulletins.find((b) => b.id === this.editingBulletinId);
                    url = (existing?.url || existing?.eventLink || '').trim();
                }
                if (!url) {
                    throw new Error('Resource link is required.');
                }
            }

            if (url) {
                if (!/^https?:\/\//i.test(url)) {
                    url = `https://${url}`;
                }

                try {
                    new URL(url);
                } catch (error) {
                    throw new Error('Please enter a valid resource URL.');
                }
            }

            const resourceOrder = rawOrder === '' ? null : Number(rawOrder);
            if (rawOrder !== '' && (!Number.isFinite(resourceOrder) || !Number.isInteger(resourceOrder) || resourceOrder < 0 || resourceOrder > 999)) {
                throw new Error('Display order must be a whole number from 0 to 999.');
            }

            const suggestedIcon = document.getElementById('resourceCategory')?.dataset?.suggestedIcon
                || document.querySelector('#bulletinForm [name="resourceCategory"]')?.dataset?.suggestedIcon
                || 'globe';

            const servicesRaw = (formData.get('resourceHighlights') || '').trim();
            const services = parseResourceServiceChips(servicesRaw);
            const resourceSummaryEn = (formData.get('resourceDescription') || '').trim();
            const resourceSummaryEs = (formData.get('resourceSummaryEs') || '').trim();
            if (!services.length && !resourceSummaryEn) {
                throw new Error('Add at least one service chip, or a card summary so students can tell this resource apart.');
            }

            const existingResource = this.isEditMode && this.editingBulletinId
                ? this.bulletins.find((b) => b.id === this.editingBulletinId)
                : null;
            const actionLinks = parseResourceActionLinkSlotsFromForm(formData, {
                removedPdfSlots: this.removedActionLinkPdfSlots,
                existingLinks: existingResource?.actionLinks || [],
            });

            return {
                type: 'resource',
                title: titleEn,
                titleEn,
                titleEs: titleEs || titleEn,
                category: 'resource',
                resourceKind,
                resourceCategory,
                resourceIcon: suggestedIcon,
                resourceLogo: isDocument ? null : null,
                url: url || '',
                eventLink: url || '',
                description: resourceSummaryEn,
                summaryEs: resourceSummaryEs,
                highlights: services.join(', '),
                services,
                serviceChips: services,
                address: isDocument ? '' : (formData.get('resourceAddress') || '').trim(),
                phone: isDocument ? '' : (formData.get('resourcePhone') || '').trim(),
                phoneMode: isDocument ? 'call' : (formData.get('resourcePhoneMode') || 'call').trim(),
                hours: isDocument ? '' : (formData.get('resourceHours') || '').trim(),
                actionLinks: stripActionLinkUploadMeta(actionLinks),
                isActive: true,
                isPublished: formData.get('resourcePublished') === 'on',
                isPinned: false,
                resourceOrder,
                company: '',
                contact: '',
                dateType: '',
                eventDate: '',
                eventDates: [],
                startDate: '',
                endDate: '',
                deadline: '',
                startTime: '',
                endTime: '',
                eventLocation: '',
                classType: '',
                image: null,
                pdfUrl: null
            };
        }

        const dateType = formData.get('dateType') || '';
        let eventDates = [];
        if (dateType === 'sessions') {
            eventDates = sessionsFromFormData(formData);
            if (eventDates.length < 2) {
                throw new Error('Please add at least two session dates.');
            }
        }

        const bulletin = {
            type: 'post',
            title: (formData.get('title') || '').trim(),
            titleEs: (formData.get('titleEs') || '').trim(),
            category: formData.get('category'),
            description: (formData.get('description') || '').trim(),
            summaryEs: (formData.get('summaryEs') || '').trim(),
            company: (formData.get('company') || '').trim(),
            contact: (formData.get('contact') || '').trim(),
            dateType,
            eventDate: dateType === 'sessions' ? (eventDates[0]?.date || '') : (formData.get('eventDate') || ''),
            eventDates: dateType === 'sessions' ? eventDates : [],
            startDate: dateType === 'sessions' ? '' : (formData.get('startDate') || ''),
            endDate: dateType === 'sessions' ? '' : (formData.get('endDate') || ''),
            deadline: this.getCompatibleDeadline(formData),
            startTime: dateType === 'sessions' ? '' : (formData.get('startTime') || ''),
            endTime: dateType === 'sessions' ? '' : (formData.get('endTime') || ''),
            eventLocation: formData.get('eventLocation') || '',
            eventLink: (formData.get('eventLink') || '').trim(),
            classType: formData.get('classType') || '',
            address: (formData.get('eventLocation') || '').trim(),
            phone: (formData.get('contactPhone') || '').trim(),
            phoneMode: (formData.get('contactPhoneMode') || 'call').trim(),
            hours: (formData.get('contactHours') || '').trim(),
            isActive: true,
            isPublished: true,
            image: null,
            pdfUrl: null
        };

        if (bulletin.eventLink && !/^https?:\/\//i.test(bulletin.eventLink)) {
            bulletin.eventLink = `https://${bulletin.eventLink}`;
        }

        if (!bulletin.category) {
            throw new Error('Please select a category.');
        }

        return bulletin;
    }

    async saveBulletin(bulletin, editingId = null) {
        try {
            let payload = { ...bulletin };
            delete payload.id;
            payload.languages = deleteField();

            if (editingId) {
                // Text/metadata updates should not re-send embedded flyer assets.
                if (payload.image) delete payload.image;
                if (payload.imageEs) delete payload.imageEs;
                if (payload.pdfUrl) delete payload.pdfUrl;
                if (payload.resourceLogo) delete payload.resourceLogo;
            }

            const bulletinStr = JSON.stringify(payload);
            const sizeInBytes = new Blob([bulletinStr]).size;
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

            console.log(`Bulletin size: ${sizeInMB} MB (${sizeInBytes} bytes)`);

            if (sizeInBytes > 1048576) { // 1MB in bytes
                throw new Error(`Bulletin too large (${sizeInMB} MB). Firestore documents must be under 1 MB. Try using a smaller image.`);
            }

            if (editingId) {
                await updateDoc(doc(db, 'bulletins', editingId), payload);
            } else {
                await addDoc(collection(db, 'bulletins'), payload);
            }

            // Reload bulletins to show updated data
            this.loadManageBulletins();
        } catch (error) {
            console.error('Error saving bulletin:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            throw error;
        }
    }

    resetForm(options = {}) {
        const managePage = options.managePage
            || this.editReturnManagePage
            || this.getManagePageForContentMode(this.contentMode);
        this.editReturnManagePage = null;

        // Reset edit mode
        this.isEditMode = false;
        this.editingBulletinId = null;

        // Hide edit banner
        const banner = document.getElementById('editModeBanner');
        if (banner) banner.style.display = 'none';

        // Clear form
        document.getElementById('bulletinForm').reset();
        refreshRichEditors();

        // Clear image preview and cached data
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) imagePreview.innerHTML = '';
        const imageEsPreview = document.getElementById('imageEsPreview');
        if (imageEsPreview) imageEsPreview.innerHTML = '';
        const resourceLogoPreview = document.getElementById('resourceLogoPreview');
        if (resourceLogoPreview) resourceLogoPreview.innerHTML = '';
        const pdfPreview = document.getElementById('pdfPreview');
        if (pdfPreview) pdfPreview.innerHTML = '';
        const resourcePdfPreview = document.getElementById('resourcePdfPreview');
        if (resourcePdfPreview) resourcePdfPreview.innerHTML = '';
        const resourcePdfInput = document.getElementById('resourcePdf');
        if (resourcePdfInput) resourcePdfInput.value = '';
        const orgKindRadio = document.querySelector('input[name="resourceKind"][value="organization"]');
        if (orgKindRadio) orgKindRadio.checked = true;
        this.pendingImageData = null;
        this.pendingImageEsData = null;
        this.pendingResourceLogoData = null;
        this.removeResourceLogo = false;
        this.removeResourcePdf = false;
        this.updateResourceIconGroupState();
        this.syncResourceKindUI();
        this.toggleSpanishFlyerPanel(false);
        this.syncFlyerUploadUI();

        // Reset phone mode radios
        document.querySelectorAll('input[name="resourcePhoneMode"][value="call"]').forEach(r => r.checked = true);
        document.querySelectorAll('input[name="contactPhoneMode"][value="call"]').forEach(r => r.checked = true);
        this.populateResourceActionLinkFields([]);
        this.removedActionLinkPdfSlots = new Set();
        const actionLinksDetails = document.querySelector('.resource-action-links-field');
        if (actionLinksDetails) actionLinksDetails.open = false;

        // Reset date fields (legacy form only — composer reset handles the new UI)
        if (typeof window.PostComposer?.resetComposer === 'function') {
            window.PostComposer.resetComposer();
        } else {
            const dateTypeField = document.getElementById('dateType')
                || document.querySelector('#bulletinForm [name="dateType"]');
            if (dateTypeField) dateTypeField.value = '';
            const sameTimeToggle = document.getElementById('sessionSameTimeToggle');
            if (sameTimeToggle) sameTimeToggle.checked = false;
            const sharedRow = document.getElementById('sessionSharedTimeRow');
            if (sharedRow) sharedRow.hidden = true;
            document.getElementById('sessionsDateGroup')?.classList.remove('is-same-time');
            this.renderEventDatesList([{ date: '' }]);
            if (typeof toggleDateFields === 'function') toggleDateFields();
        }
        document.getElementById('bulletinForm')?.querySelectorAll('input[data-cx-session]').forEach((node) => node.remove());
        this.setContentType('post', { preserveFields: true, silent: true });
        const resourcePublished = document.getElementById('resourcePublished')
            || document.querySelector('#bulletinForm [name="resourcePublished"]');
        if (resourcePublished) {
            if (resourcePublished.type === 'checkbox') resourcePublished.checked = true;
            else resourcePublished.value = 'on';
        }
        const resourceCategory = document.getElementById('resourceCategory')
            || document.querySelector('#bulletinForm [name="resourceCategory"]');
        if (resourceCategory?.dataset) delete resourceCategory.dataset.suggestedIcon;
        
        // Return to the matching workspace list (resources, events, or bulletins).
        if (!options.stayOnCreate) {
            this.navigateToManagePage(managePage);
        }
    }

    isMineOrManaged(bulletin) {
        if (!this.currentUser) return false;
        const u = this.currentUser.username;
        const n = this.currentUser.name;
        const displayName = this.getAdvisorDisplayName(bulletin);
        return bulletin.postedBy === u ||
               bulletin.postedBy === n ||
               displayName === n ||
               displayName === u;
    }

    formatTimeAgo(date) {
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return mins + 'm ago';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h ago';
        const days = Math.floor(hrs / 24);
        return days + 'd ago';
    }

    renderManageDateInfo(bulletin) {
        let html = '';

        // Prioritize new date structure
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.startDate && bulletin.endDate))) {
            const dateType = bulletin.dateType;
            let timeInfo = this.formatTimeRangeAdmin(bulletin.startTime, bulletin.endTime);

            if (dateType === 'deadline') {
                html = `<p><strong>Application Deadline:</strong> ${this.formatDateLocalAdmin(bulletin.eventDate)}</p>`;
            } else if (dateType === 'event') {
                html = `<p><strong>Event Date:</strong> ${this.formatDateLocalAdmin(bulletin.eventDate)}${timeInfo ? ` at ${timeInfo}` : ''}</p>`;
            } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
                html = `<p><strong>Event Dates:</strong> ${this.formatDateLocalAdmin(bulletin.startDate)} - ${this.formatDateLocalAdmin(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}</p>`;
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
                const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                                   bulletin.eventLocation === 'online' ? 'Online' :
                                   bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
                html += `<p><strong>Format:</strong> ${locationText}</p>`;
            }
        }

        // Backward compatibility
        if (bulletin.deadline) {
            return `<p><strong>Deadline:</strong> ${this.formatDateLocalAdmin(bulletin.deadline)}</p>`;
        }

        return '';
    }

    formatDateLocalAdmin(dateString) {
        if (!dateString) return '';
        // Create date object and format in local timezone to prevent shifting
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString();
    }

    formatTimeRangeAdmin(startTime, endTime) {
        if (!startTime && !endTime) return '';

        if (startTime && endTime) {
            return `${this.formatTimeAdmin(startTime)} - ${this.formatTimeAdmin(endTime)}`;
        } else if (startTime) {
            return this.formatTimeAdmin(startTime);
        }

        return '';
    }

    formatTimeAdmin(timeString) {
        if (!timeString) return '';

        // Convert 24-hour format to 12-hour format
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    formatDateLocal(dateString) {
        if (!dateString) return '';
        // Create date object and format in local timezone to prevent shifting
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString();
    }

    formatTimeRange(startTime, endTime) {
        if (!startTime && !endTime) return '';

        const formatTime = (timeString) => {
            if (!timeString) return '';
            const [hours, minutes] = timeString.split(':');
            const hour = parseInt(hours);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${minutes} ${ampm}`;
        };

        if (startTime && endTime) {
            return `${formatTime(startTime)} - ${formatTime(endTime)}`;
        } else if (startTime) {
            return formatTime(startTime);
        }

        return '';
    }
}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    adminPanel.showTab(tabName);
}

// Keyboard accessibility for tabs
function handleTabKeydown(event, tabName) {
    switch (event.key) {
        case 'Enter':
        case ' ':
            event.preventDefault();
            showTab(tabName);
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            event.preventDefault();
            const tabs = document.querySelectorAll('.tab-btn');
            const currentIndex = Array.from(tabs).findIndex(tab => tab.classList.contains('active'));
            const nextIndex = event.key === 'ArrowRight'
                ? (currentIndex + 1) % tabs.length
                : (currentIndex - 1 + tabs.length) % tabs.length;
            tabs[nextIndex].focus();
            tabs[nextIndex].click();
            break;
    }
}

function toggleDateFields() {
    const dateTypeEl = document.getElementById('dateType');
    const dateFields = document.getElementById('dateFields');
    const singleDateGroup = document.getElementById('singleDateGroup');
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    // Streamlined composer has no legacy date UI — dates live in optional blocks / event hero.
    if (!dateTypeEl || !dateFields || !singleDateGroup || !startDateGroup || !endDateGroup) {
        return;
    }

    const dateType = dateTypeEl.value;
    const sessionsDateGroup = document.getElementById('sessionsDateGroup');
    const eventTimeRow = document.querySelector('.event-time-row');
    const eventDateInput = document.getElementById('eventDate');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Hide all date fields initially
    dateFields.style.display = 'none';
    singleDateGroup.style.display = 'none';
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    if (sessionsDateGroup) sessionsDateGroup.style.display = 'none';
    if (eventTimeRow) eventTimeRow.style.display = '';

    // Remove required attribute from all date fields first
    if (eventDateInput) eventDateInput.required = false;
    if (startDateInput) startDateInput.required = false;
    if (endDateInput) endDateInput.required = false;
    document.querySelectorAll('#eventDatesList input[name="eventDates"]').forEach((input) => {
        input.required = false;
    });

    if (dateType === 'deadline') {
        dateFields.style.display = 'grid';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Application Deadline';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'event') {
        dateFields.style.display = 'grid';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Event Date';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'sessions') {
        dateFields.style.display = 'grid';
        if (sessionsDateGroup) sessionsDateGroup.style.display = 'block';
        if (eventTimeRow) eventTimeRow.style.display = 'none';
        if (window.adminPanel) {
            const rows = document.querySelectorAll('#eventDatesList .event-date-row');
            if (rows.length < 2) {
                const firstValue = rows.length === 1 ? (rows[0].querySelector('.event-session-date')?.value || '') : '';
                window.adminPanel.renderEventDatesList(
                    firstValue ? [{ date: firstValue }, { date: '' }] : [{ date: '' }, { date: '' }]
                );
            }
        }
        const firstSessionInput = document.querySelector('#eventDatesList input[name="eventDates"]');
        if (firstSessionInput) firstSessionInput.required = true;
    } else if (dateType === 'range') {
        dateFields.style.display = 'grid';
        startDateGroup.style.display = 'block';
        endDateGroup.style.display = 'block';
        if (startDateInput) startDateInput.required = true;
        if (endDateInput) endDateInput.required = true;
    }
    if (typeof window.syncAdminStudentPreview === 'function') {
        window.syncAdminStudentPreview();
    }
}

// Initialize the admin panel
let adminPanel;
export async function mountAdvisorPortal(userDetails) {
    if (typeof window.adminPanel?.applyAuthenticatedUser === 'function') {
        if (userDetails) {
            await window.adminPanel.applyAuthenticatedUser(userDetails);
        }
        return window.adminPanel;
    }

    adminPanel = new FirebaseAdminPanel();
    // Expose for global access after initialization
    window.adminPanel = adminPanel;
    window.showTab = showTab;
    window.handleTabKeydown = handleTabKeydown;
    window.toggleDateFields = toggleDateFields;

    if (userDetails) {
        await adminPanel.applyAuthenticatedUser(userDetails);
    }

    return adminPanel;
}
