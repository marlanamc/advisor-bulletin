import { db, auth, storage } from './firebase.js'
import { getPublicAdvisorEmail, STUDENT_ADVISOR_DIRECTORY } from './advisor-directory.js'
import { isPrivilegedAdminEmail } from './admin-roles.js'
import { installClientErrorLogger } from './error-logger.js'
import { getPostCategoryDisplay } from './feed-categories.js'
import { AUTHORABLE_RESOURCE_CATEGORIES, AUTHORABLE_RESOURCE_CATEGORY_SET } from './resource-categories.js'
import {
    formatResourceServiceChipsInput,
    getSuggestedResourceChips,
    MAX_RESOURCE_SERVICE_CHIPS,
    parseResourceServiceChips,
} from './resource-chip-labels.js'
import {
    getResourceActionLinkFieldValues,
    MAX_RESOURCE_ACTION_LINKS,
    normalizeResourceActionLinks,
    parseResourceActionLinkSlotsFromForm,
    stripActionLinkUploadMeta,
} from './resource-action-links.js'
import { initAdminFieldHelp } from './admin-field-help.js'
import {
    isDocumentResource,
    normalizeResourceKind,
    RESOURCE_KIND_DOCUMENT,
} from './resource-kinds.js'
import {
    MAX_EVENT_SESSIONS,
    normalizeEventSessions,
    parseSessionEntry,
    sessionsFromFormData,
    sessionsShareSameTime,
    formatSessionsDetailLines,
    getMultiSessionFeedSortMs,
    getNextSessionStartMs,
} from './event-sessions.js'
import { initDescriptionFormatToolbars, refreshRichEditors, syncRichEditorsToForm, getRichTextFieldValue } from './description-format.js'
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore'

// Caps Firestore reads on the admin dashboard listener. Reorder validation falls back
// to getDoc when an ID is missing from this cache (see reorderResourcesInCategory).
const ADMIN_ACTIVE_BULLETINS_LIMIT = 500;

installClientErrorLogger('admin')
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

import {
    ADMIN_RESOURCE_CATEGORY_LABELS,
    isPdfFile,
    isFlyerImageFile,
    isImageOnlyFile,
} from './admin-shared.js'
import { applyMethods } from './apply-methods.js'
import { AdminComposerFormMethods } from './admin-composer-form.js'
import { AdminAttachmentMethods } from './admin-attachments.js'
import { AdminManageMethods } from './admin-manage.js'

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

        const q = query(collection(db, 'bulletins'), where('isActive', '==', true), orderBy('datePosted', 'desc'), limit(ADMIN_ACTIVE_BULLETINS_LIMIT))
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
            // Keep the existing list (static fallback or prior load) so a transient
            // Firestore error doesn't blank the Advisors tab or break name lookups.
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
                    // Fail safe on permission errors: if we can't confirm whether a
                    // forced password change is pending, don't silently let the user
                    // in — send them back to login. Transient errors (network/timeout)
                    // can fall through and continue.
                    if (error?.code === 'permission-denied') {
                        this.setAuthView('login');
                        return;
                    }
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
                if (this.contentMode === 'event') {
                    successMessage += ' It should appear on the student calendar shortly.';
                } else {
                    successMessage += ' It should appear on the student feed shortly.';
                    if (formData.get('summaryEs')) {
                        successMessage += ' Students in Spanish see Spanish Summary instead of Description when a summary is filled in.';
                    }
                }
            }
            this.showTemporaryMessage(successMessage, 'success');
        } catch (error) {
            if (error && error.code === 'user-cancelled') {
                this.showTemporaryMessage('Post cancelled. You can review the content and try again.', 'info');
                return;
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

        // The IDs come straight from draggable DOM nodes, so validate them against
        // the in-memory cache before writing. Every ID must reference a bulletin we
        // actually loaded AND belong to the category being reordered — otherwise a
        // stale/forged data-bulletin-id could rewrite resourceOrder on the wrong doc.
        // If the listener cap omitted a doc, fetch it once before rejecting the batch.
        const resolved = await Promise.all(orderedIds.map(async (id) => {
            let bulletin = this.bulletins.find(b => b.id === id);
            if (bulletin) return bulletin;
            try {
                const snap = await getDoc(doc(db, 'bulletins', id));
                if (!snap.exists()) return null;
                return { id: snap.id, ...this.normalizeBulletin(snap.data()) };
            } catch (error) {
                console.error('Failed to fetch bulletin for reorder validation:', id, error);
                return null;
            }
        }));
        // Match the grouping fallback used when the reorder UI is rendered
        // (resources with no category are grouped under 'other').
        const allValid = resolved.every(b => b && (b.resourceCategory || 'other') === category);
        if (!allValid) {
            console.error('Reorder aborted: IDs did not match category', { category, orderedIds });
            this.showTemporaryMessage('Could not save the new order. Please refresh and try again.', 'error');
            return;
        }

        const batch = writeBatch(db);
        orderedIds.forEach((id, i) => {
            batch.update(doc(db, 'bulletins', id), {
                resourceOrder: (i + 1) * 10,
                updatedAt: serverTimestamp()
            });
        });
        await batch.commit();
        resolved.forEach((bulletin, i) => {
            bulletin.resourceOrder = (i + 1) * 10;
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
        div.textContent = String(text ?? '');
        return div.innerHTML;
    }

    showSuccessMessage(message) {
        this.showTemporaryMessage(message, 'success');
    }

    // Alias used throughout advisor management; without it every
    // this.showToast(...) call throws and kills the calling flow.
    showToast(message, type = 'info') {
        this.showTemporaryMessage(message, type);
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

    getAuthAdvisorName() {
        const name = (this.currentUser?.name || '').trim();
        if (name) return name;
        const fromDirectory = this.getUserDisplayName(this.getAuthPostedBy());
        return (fromDirectory || 'Advisor').trim();
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
        bulletin.advisorName = this.getAuthAdvisorName();
        bulletin.datePosted = serverTimestamp();
        bulletin.createdAt = serverTimestamp();
        bulletin.updatedAt = serverTimestamp();

        // Publish as inactive first so students never see a half-uploaded card.
        // We only flip isActive:true after every asset upload succeeds, which
        // prevents orphaned "live" bulletins with broken/missing images or PDFs.
        const shouldBeActive = bulletin.isActive !== false;
        bulletin.isActive = false;

        // Create the Firestore document FIRST to get an ID
        const docRef = await addDoc(collection(db, 'bulletins'), bulletin);
        const bulletinId = docRef.id;

        let assetsReady = false;
        try {
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
            } else {
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

            assetsReady = true;

            // All assets uploaded — now make the bulletin visible to students.
            if (shouldBeActive) {
                await updateDoc(doc(db, 'bulletins', bulletinId), {
                    isActive: true,
                    updatedAt: serverTimestamp(),
                });
            }
        } catch (uploadError) {
            // The admin listener only loads isActive==true docs, so an inactive
            // placeholder becomes invisible. Remove failed/cancelled drafts; keep
            // the doc only if uploads finished but the final activation write failed.
            if (!assetsReady) {
                try {
                    await deleteDoc(doc(db, 'bulletins', bulletinId));
                } catch (cleanupError) {
                    console.error('Failed to remove draft bulletin after upload error:', cleanupError);
                }
            } else {
                console.error('Bulletin uploads succeeded but activation failed; bulletin left inactive:', uploadError);
            }
            throw uploadError;
        }

        // Reload bulletins to show the new one
        this.loadManageBulletins();
        return bulletinId;
    }

    updateHasPendingAssetUploads(formData, bulletin) {
        if (this.isResourceBulletin(bulletin)) {
            const resourceLogoFile = formData.get('resourceLogo');
            const resourcePdfFile = formData.get('resourcePdf');
            if (resourceLogoFile && resourceLogoFile.size > 0) return true;
            if (isDocumentResource(bulletin) && resourcePdfFile && resourcePdfFile.size > 0) return true;
            return false;
        }

        const imageFile = formData.get('image');
        const imageEsFile = formData.get('imageEs');
        const pdfFile = formData.get('pdf');
        return Boolean(
            (imageFile && imageFile.size > 0)
            || (imageEsFile && imageEsFile.size > 0)
            || (pdfFile && pdfFile.size > 0)
        );
    }

    async updateBulletin(formData, bulletinId) {
        const bulletin = this.buildBulletinObject(formData);
        bulletin.updatedAt = serverTimestamp();

        // Preserve existing data
        const existingBulletin = this.bulletins.find(b => b.id === bulletinId);
        if (existingBulletin) {
            bulletin.postedBy = existingBulletin.postedBy;
            bulletin.advisorName = existingBulletin.advisorName || this.getAuthAdvisorName();
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

        const pendingUploads = this.updateHasPendingAssetUploads(formData, bulletin);
        const wasActive = existingBulletin?.isActive !== false;
        if (pendingUploads && wasActive) {
            bulletin.isActive = false;
        }

        try {
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

                if (pendingUploads && wasActive) {
                    await updateDoc(doc(db, 'bulletins', bulletinId), {
                        isActive: true,
                        updatedAt: serverTimestamp(),
                    });
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

            if (pendingUploads && wasActive) {
                await updateDoc(doc(db, 'bulletins', bulletinId), {
                    isActive: true,
                    updatedAt: serverTimestamp(),
                });
            }
        } catch (error) {
            if (pendingUploads && wasActive) {
                try {
                    await updateDoc(doc(db, 'bulletins', bulletinId), {
                        isActive: true,
                        updatedAt: serverTimestamp(),
                    });
                } catch (restoreError) {
                    console.error('Failed to restore bulletin visibility after update error:', restoreError);
                }
            }
            throw error;
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
            hideFromMainFeed: this.contentMode === 'event',
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

            if (import.meta.env.DEV) {
                console.log(`Bulletin size: ${sizeInMB} MB (${sizeInBytes} bytes)`);
            }

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

applyMethods(FirebaseAdminPanel, AdminComposerFormMethods)
applyMethods(FirebaseAdminPanel, AdminAttachmentMethods)
applyMethods(FirebaseAdminPanel, AdminManageMethods)

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
