import { db, auth, storage } from './src/firebase.js'
import { getPublicAdvisorEmail } from './src/advisor-directory.js'
import { installClientErrorLogger } from './src/error-logger.js'
import { getPostCategoryDisplay } from './src/feed-categories.js'
import { collection, doc, query, where, orderBy, onSnapshot, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'

installClientErrorLogger('admin')
import { onAuthStateChanged, signOut, sendPasswordResetEmail } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

const ADMIN_RESOURCE_CATEGORY_LABELS = {
    immigration: 'Immigration / Inmigracion',
    jobs: 'Jobs / Empleos',
    housing: 'Housing / Vivienda',
    health: 'Health / Salud',
    'legal-aid': 'Legal Aid / Ayuda Legal'
};

const ADMIN_RESOURCE_ICON_LABELS = {
    auto: 'Auto',
    shield: 'Shield',
    briefcase: 'Briefcase',
    home: 'Home',
    heart: 'Health',
    scale: 'Legal Aid',
    globe: 'Globe'
};

const HIGH_INTENT_ANALYTICS_ACTIONS = new Set(['link_click', 'pdf_open', 'resource_open']);
const ENGAGEMENT_ANALYTICS_ACTIONS = new Set(['detail_open', 'link_click', 'pdf_open', 'resource_open', 'share_click']);

function isPdfFile(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
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
        this.isSubmitting = false;
        this.contentType = 'post';
        this.contentMode = 'post';
        this.analyticsEvents = [];
        this.analyticsByPost = {};
        this.analyticsUnsubscribe = null;
        this.analyticsRangeDays = 30;
        this.advisors = [];
        this.authTransitionInProgress = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAutoLogin();
        this.setupRealtimeListener();
        this.setupOfflineHandling();
        this.setupRedesignEnhancements();
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

        const resourceCategory = document.getElementById('resourceCategory');
        if (resourceCategory) {
            resourceCategory.addEventListener('change', (event) => this.handleResourceCategoryChange(event.target.value));
        }

        // Form validation
        this.setupFormValidation();

        // Image upload preview
        document.getElementById('image').addEventListener('change', (e) => this.handleImagePreview(e, 'image'));
        document.getElementById('imageEs').addEventListener('change', (e) => this.handleImagePreview(e, 'imageEs'));
        const resourceLogoInput = document.getElementById('resourceLogo');
        if (resourceLogoInput) {
            resourceLogoInput.addEventListener('change', (e) => this.handleImagePreview(e, 'resourceLogo'));
        }

        const addEventDateBtn = document.getElementById('addEventDateBtn');
        if (addEventDateBtn) {
            addEventDateBtn.addEventListener('click', () => this.addEventDateRow());
        }

        this.renderEventDatesList(['']);
        
        // PDF upload preview
        document.getElementById('pdf').addEventListener('change', (e) => this.handlePdfPreview(e));

        // Close preview modal when clicking outside (but NOT login modal - that's annoying during login)
        window.addEventListener('click', (e) => {
            const previewModal = document.getElementById('previewModal');
            if (e.target === previewModal) {
                this.closePreview();
            }
        });

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
        if (manageContentType) manageContentType.addEventListener('change', rerender);

        const analyticsRangeSelect = document.getElementById('analyticsRangeSelect');
        if (analyticsRangeSelect) {
            analyticsRangeSelect.value = String(this.analyticsRangeDays);
            analyticsRangeSelect.addEventListener('change', (event) => {
                this.setAnalyticsRange(Number(event.target.value));
            });
        }

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

        const titleField = document.getElementById('title');
        if (titleField && !titleField.value.trim()) {
            titleField.placeholder = mode === 'calendar-only'
                ? 'e.g., Memorial Day — No School'
                : 'e.g., School assembly / Family info night';
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

    toggleAccordion(header) {
        const section = header.closest('.ap-accordion-section');
        const isOpen = section.classList.contains('open');
        
        if (isOpen) {
            section.classList.remove('open');
        } else {
            section.classList.add('open');
        }
    }

    autoExpandAccordions() {
        // Check sections for values and expand if they have data
        // 3. Event Details
        const dateType = document.getElementById('dateType')?.value;
        if (dateType) {
            document.getElementById('eventDetailsAccordion')?.classList.add('open');
        }

        // 4. Spanish Translation
        const titleEs = document.getElementById('titleEs')?.value;
        const summaryEs = document.getElementById('summaryEs')?.value;
        const hasImageEs = document.getElementById('imageEsPreview')?.querySelector('img');
        if (titleEs || summaryEs || hasImageEs) {
            const step4 = [...document.querySelectorAll('.ap-accordion-section')].find(s => s.querySelector('.ap-step-number')?.textContent === '4');
            if (step4) step4.classList.add('open');
        }

        // 5. Contact & Location
        const company = document.getElementById('company')?.value;
        const contact = document.getElementById('contact')?.value;
        const location = document.getElementById('location')?.value;
        const phone = document.getElementById('contactPhone')?.value;
        const hours = document.getElementById('contactHours')?.value;
        const languages = document.getElementById('contactLanguages')?.value;
        if (company || contact || location || phone || hours || languages) {
            const step5 = [...document.querySelectorAll('.ap-accordion-section')].find(s => s.querySelector('.ap-step-number')?.textContent === '5');
            if (step5) step5.classList.add('open');
        }

        // 6. Advanced Settings
        const classType = document.getElementById('classType')?.value;
        const hasPdf = document.getElementById('pdfPreview')?.querySelector('.pdf-preview-container');
        if (classType || hasPdf) {
            const step6 = [...document.querySelectorAll('.ap-accordion-section')].find(s => s.querySelector('.ap-step-number')?.textContent === '6');
            if (step6) step6.classList.add('open');
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
            this.setupAnalyticsListener();
            this.loadManageBulletins();

            // Load full advisor metadata in the background and patch the live UI.
            this.loadAdvisorsFromFirestore().then(() => {
                const advisor = this.advisors.find(a => a.username === username);
                if (advisor) {
                    this.currentUser.name = advisor.displayName || this.currentUser.name;
                    this.currentUser.isAdmin = advisor.isAdmin === true;
                    const welcome = document.getElementById('welcomeMessage');
                    if (welcome) welcome.textContent = `Welcome, ${this.currentUser.name}!`;
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
        if (this.analyticsUnsubscribe) {
            this.analyticsUnsubscribe();
            this.analyticsUnsubscribe = null;
        }
        this.analyticsEvents = [];
        this.analyticsByPost = {};
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

        this.populateAdvisorSelects(this.currentUser.name);

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
            if (Array.isArray(data.eventDates) && data.eventDates.length) {
                normalized.eventDates = this.normalizeEventDates(data.eventDates);
            } else if (data.eventDate) {
                normalized.eventDates = [String(data.eventDate).split('T')[0]];
            } else {
                normalized.eventDates = [];
            }
            normalized.eventDate = normalized.eventDates[0] || data.eventDate || '';
        }

        return normalized;
    }

    normalizeEventDates(rawDates) {
        const seen = new Set();
        const valid = [];

        (Array.isArray(rawDates) ? rawDates : [rawDates]).forEach((raw) => {
            const value = String(raw || '').trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || seen.has(value)) {
                return;
            }
            seen.add(value);
            valid.push(value);
        });

        valid.sort();
        return valid.slice(0, 10);
    }

    renderEventDatesList(dates = ['']) {
        const list = document.getElementById('eventDatesList');
        const addBtn = document.getElementById('addEventDateBtn');
        if (!list) return;

        const rows = (dates.length ? dates : ['']).map((date, index) => this.buildEventDateRowHtml(date, index));
        list.innerHTML = rows.join('');

        if (addBtn) {
            addBtn.style.display = dates.length >= 10 ? 'none' : '';
        }
    }

    buildEventDateRowHtml(value = '', index = 0) {
        const canRemove = index > 0;
        const safeValue = this.escapeAttribute(String(value || '').split('T')[0]);

        return `
            <div class="event-date-row">
                <input
                    type="date"
                    name="eventDates"
                    class="recommended"
                    value="${safeValue}"
                    ${index === 0 ? 'required' : ''}
                    onchange="window.syncAdminStudentPreview && window.syncAdminStudentPreview()"
                    oninput="window.syncAdminStudentPreview && window.syncAdminStudentPreview()"
                >
                ${canRemove ? `<button type="button" class="event-date-remove-btn" onclick="adminPanel.removeEventDateRow(this)" aria-label="Remove date">&times;</button>` : ''}
            </div>
        `;
    }

    addEventDateRow() {
        const list = document.getElementById('eventDatesList');
        if (!list) return;

        const count = list.querySelectorAll('.event-date-row').length;
        if (count >= 10) return;

        list.insertAdjacentHTML('beforeend', this.buildEventDateRowHtml('', count));

        const addBtn = document.getElementById('addEventDateBtn');
        if (addBtn && count + 1 >= 10) {
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

    getCurrentContentLabel() {
        return this.contentType === 'resource' ? 'Resource' : 'Bulletin';
    }

    setContentType(type, options = {}) {
        const isEvent = type === 'event';
        const nextType = type === 'resource' ? 'resource' : 'post';
        const nextMode = isEvent ? 'event' : nextType;
        this.contentType = nextType;
        this.contentMode = nextMode;

        const hiddenInput = document.getElementById('contentType');
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
        const advisorNameInput = document.getElementById('advisorName');
        if (titleInput) titleInput.required = nextMode === 'post' || nextMode === 'event';
        if (categoryInput) categoryInput.required = nextMode === 'post';
        if (advisorNameInput) advisorNameInput.required = nextMode === 'post' || nextMode === 'event';

        const helper = document.getElementById('contentTypeHelper');
        if (helper) {
            helper.textContent = nextType === 'resource'
                ? 'Use Resources for important links students may need again later.'
                : isEvent
                    ? 'Quick calendar dates (holidays, no-school days). They appear on the feed, calendar, and upcoming list.'
                    : 'Use Posts for announcements, events, trainings, and opportunities.';
        }

        const requiredTitle = document.querySelector('.form-section.required .form-section-title');
        const requiredSubtitle = document.querySelector('.form-section.required .form-section-subtitle');
        const titleLabel = document.querySelector('label[for="title"]');
        const titleHelp = document.querySelector('.title-field-group .input-help');
        if (requiredTitle) {
            requiredTitle.textContent = isEvent ? 'Event Label' : 'Required Information';
        }
        if (requiredSubtitle) {
            requiredSubtitle.textContent = isEvent
                ? 'Add the label students will see on the calendar.'
                : 'These fields are mandatory for all bulletins';
        }
        if (titleLabel) {
            titleLabel.textContent = isEvent ? 'Label' : 'Title';
        }
        if (titleHelp) {
            titleHelp.textContent = isEvent
                ? 'Use the exact wording students should see, like “No School” or “Registration Deadline”.'
                : 'A clear, descriptive title helps students understand the opportunity';
        }
        if (!isEvent) {
            const eventDateLabel = document.querySelector('label[for="eventDate"]');
            if (eventDateLabel) eventDateLabel.textContent = 'Event Date';
        }

        const heading = document.querySelector('.post-form-container h4');
        const previewBtn = document.querySelector('.preview-btn');
        const submitBtn = document.getElementById('postBulletinBtn');

        if (heading) {
            if (this.isEditMode) {
                heading.textContent = nextType === 'resource' ? 'Edit Resource' : 'Edit Bulletin';
            } else {
                heading.textContent = nextType === 'resource' ? 'Create New Resource' : isEvent ? 'Add Event Date' : 'Create New Bulletin';
            }
        }

        if (previewBtn) {
            previewBtn.textContent = nextType === 'resource' ? 'Preview Resource' : isEvent ? 'Preview Event' : 'Preview Post';
        }

        if (submitBtn) {
            if (this.isEditMode) {
                submitBtn.textContent = nextType === 'resource' ? 'Update Resource' : 'Update Bulletin';
            } else {
                submitBtn.textContent = nextType === 'resource' ? 'Publish Resource' : isEvent ? 'Add Event Date' : 'Post Bulletin';
            }
        }

        if (!options.preserveFields && nextType === 'resource') {
            document.getElementById('image').value = '';
            document.getElementById('pdf').value = '';
            document.getElementById('imagePreview').innerHTML = '';
            document.getElementById('pdfPreview').innerHTML = '';
            this.pendingImageData = null;
        }

        if (!options.silent) {
            this.showTemporaryMessage(`${nextType === 'resource' ? 'Resource' : isEvent ? 'Event date' : 'Post'} mode ready.`, 'info');
        }

        if (isEvent) {
            this.applySchoolEventPreset('calendar-only', { keepContentMode: true });
        }

        this.renumberVisibleFormSteps();
    }

    populateAdvisorSelects(selectedName = '') {
        const sorted = [...this.advisors].sort((a, b) => a.displayName.localeCompare(b.displayName));
        ['advisorName', 'resourceAdvisorName'].forEach((selectId) => {
            const select = document.getElementById(selectId);
            if (!select) return;

            const current = selectedName || select.value;
            select.innerHTML = '<option value="">Select your name</option>' +
                sorted.map((advisor) => {
                    const name = advisor.displayName || advisor.username;
                    const selected = name === current ? ' selected' : '';
                    return `<option value="${this.escapeHtml(name)}"${selected}>${this.escapeHtml(name)}</option>`;
                }).join('');
        });
    }

    isElementVisible(element) {
        if (!element) return false;
        let current = element;
        while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            if (style.display === 'none' || style.visibility === 'hidden') {
                return false;
            }
            current = current.parentElement;
        }
        return true;
    }

    renumberVisibleFormSteps() {
        const formCol = document.querySelector('.ap-create-form-col');
        if (!formCol) return;

        let step = 1;
        formCol.querySelectorAll('.ap-step-number').forEach((badge) => {
            const wrapper = badge.closest('.ap-step-header, .ap-accordion-section') || badge.parentElement;
            if (this.isElementVisible(wrapper)) {
                badge.dataset.step = String(step);
                badge.textContent = '';
                step += 1;
            } else {
                delete badge.dataset.step;
            }
        });
    }

    handleResourceCategoryChange(category) {
        const iconSelect = document.getElementById('resourceIcon');
        if (!iconSelect || !category || iconSelect.value !== 'auto') {
            return;
        }

        const defaultIcons = {
            immigration: 'shield',
            jobs: 'briefcase',
            housing: 'home',
            health: 'heart',
            'legal-aid': 'scale'
        };

        iconSelect.dataset.suggestedIcon = defaultIcons[category] || 'globe';
    }

    // Tab Management
    showTab(tabName) {
        const v2PageMap = { post: 'create', manage: 'posts', advisors: 'advisors' };
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

    setupAnalyticsListener() {
        if (!this.currentUser || typeof db === 'undefined') {
            return;
        }

        if (this.analyticsUnsubscribe) {
            this.analyticsUnsubscribe();
            this.analyticsUnsubscribe = null;
        }

        const since = new Date();
        since.setDate(since.getDate() - this.analyticsRangeDays);

        const analyticsQuery = query(
            // Advisor analytics read directly from Firestore analyticsEvents.
            collection(db, 'analyticsEvents'),
            where('createdAt', '>=', Timestamp.fromDate(since)),
            orderBy('createdAt', 'desc')
        )
        this.analyticsUnsubscribe = onSnapshot(analyticsQuery, (snapshot) => {
                this.analyticsEvents = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.aggregateAnalytics();
                this.updateAdvisorDashboard();
                this.updateAnalyticsRangeLabels();
                const status = document.getElementById('advisorStatusPill');
                if (status) status.textContent = `Live analytics · ${this.getAnalyticsRangeLabel()}`;
                if (this.currentUser) {
                    this.loadManageBulletins();
                }
            }, (error) => {
                console.error('Error loading analytics:', error);
                const status = document.getElementById('advisorStatusPill');
                if (status) status.textContent = 'Analytics unavailable';
            });
    }

    setAnalyticsRange(days) {
        const allowedDays = [7, 30, 90, 365];
        this.analyticsRangeDays = allowedDays.includes(days) ? days : 30;
        const select = document.getElementById('analyticsRangeSelect');
        if (select) select.value = String(this.analyticsRangeDays);
        this.analyticsEvents = [];
        this.aggregateAnalytics();
        this.updateAdvisorDashboard();
        this.updateAnalyticsRangeLabels();
        if (this.currentUser) {
            this.setupAnalyticsListener();
        }
    }

    getAnalyticsRangeLabel() {
        if (this.analyticsRangeDays === 365) return 'last year';
        return `last ${this.analyticsRangeDays} days`;
    }

    updateAnalyticsRangeLabels() {
        const label = this.getAnalyticsRangeLabel();
        this.setText('analyticsRangeInlineLabel', label);
        this.setText('analyticsRangeStatsLabel', label);
        const titleLabel = label.charAt(0).toUpperCase() + label.slice(1);
        this.setText('analyticsRangeTopPostsLabel', titleLabel);
    }

    aggregateAnalytics() {
        const byPost = {};
        const byAction = {};
        const byCategory = {};
        const byEngagedCategory = {};
        const summary = {
            impressions: 0,
            postOpens: 0,
            highIntentClicks: 0,
            shares: 0,
            engagedPosts: 0,
            rawEvents: 0
        };

        // Only count genuine student interactions — exclude advisor preview sessions
        const studentEvents = this.analyticsEvents.filter((e) => e.source === 'student');

        studentEvents.forEach((event) => {
            const action = event.action || 'unknown';
            const postId = event.postId || '';
            const category = event.category || 'uncategorized';

            summary.rawEvents += 1;
            if (action === 'card_view') summary.impressions += 1;
            if (action === 'detail_open') summary.postOpens += 1;
            if (action === 'share_click') summary.shares += 1;
            if (HIGH_INTENT_ANALYTICS_ACTIONS.has(action)) summary.highIntentClicks += 1;

            byAction[action] = (byAction[action] || 0) + 1;
            if (ENGAGEMENT_ANALYTICS_ACTIONS.has(action)) {
                byCategory[category] = (byCategory[category] || 0) + 1;
                byEngagedCategory[category] = (byEngagedCategory[category] || 0) + 1;
            }

            if (postId) {
                if (!byPost[postId]) {
                    byPost[postId] = {
                        total: 0,
                        engagement: 0,
                        highIntentClicks: 0,
                        card_view: 0,
                        detail_open: 0,
                        link_click: 0,
                        pdf_open: 0,
                        share_click: 0,
                        resource_open: 0,
                        category_click: 0
                    };
                }
                byPost[postId].total += 1;
                if (ENGAGEMENT_ANALYTICS_ACTIONS.has(action)) {
                    byPost[postId].engagement += 1;
                }
                if (HIGH_INTENT_ANALYTICS_ACTIONS.has(action)) {
                    byPost[postId].highIntentClicks += 1;
                }
                byPost[postId][action] = (byPost[postId][action] || 0) + 1;
            }
        });

        summary.engagedPosts = Object.values(byPost).filter((metrics) => (metrics.engagement || 0) > 0).length;
        this.analyticsByPost = byPost;
        this.analyticsByAction = byAction;
        this.analyticsByCategory = byCategory;
        this.analyticsByEngagedCategory = byEngagedCategory;
        this.analyticsSummary = summary;
    }

    updateAdvisorDashboard() {
        const posts = this.bulletins.filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive);
        const livePosts = posts.filter((bulletin) => !this.isBulletinExpiredAdmin(bulletin));
        const expiringSoon = posts.filter((bulletin) => bulletin.deadline && this.isDeadlineClose(bulletin.deadline) && !this.isBulletinExpiredAdmin(bulletin));
        const resources = this.bulletins.filter((bulletin) => this.isResourceBulletin(bulletin) && bulletin.isActive);

        this.setText('statLivePosts', livePosts.length);
        this.setText('statResources', resources.length);
        this.setText('statStudentClicks', this.analyticsSummary?.highIntentClicks || 0);
        this.setText('statExpiringSoon', expiringSoon.length);

        this.renderAnalyticsList('analyticsActionList', this.analyticsByAction || {}, (key) => this.formatAnalyticsAction(key));
        this.renderAnalyticsList('analyticsTopCategories', this.analyticsByCategory || {}, (key) => this.getCategoryDisplay(key));
        this.renderTopPosts();
    }

    setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    }

    renderAnalyticsList(containerId, data, labelFormatter) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const rows = Object.entries(data || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (rows.length === 0) {
            container.innerHTML = '<p class="analytics-empty">No click data yet.</p>';
            return;
        }

        container.innerHTML = rows.map(([key, value]) => `
            <div class="analytics-row">
                <span>${this.escapeHtml(labelFormatter(key))}</span>
                <strong>${value}</strong>
            </div>
        `).join('');
    }

    renderTopPosts() {
        const container = document.getElementById('analyticsTopPosts');
        if (!container) return;

        const rows = Object.entries(this.analyticsByPost || {})
            .map(([postId, metrics]) => {
                const bulletin = this.bulletins.find((item) => item.id === postId);
                return {
                    postId,
                    title: bulletin ? this.getManageCardTitle(bulletin) : 'Unknown post',
                    total: metrics.engagement || 0
                };
            })
            .filter((row) => row.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        if (rows.length === 0) {
            container.innerHTML = '<p class="analytics-empty">Student engagement will appear here.</p>';
            return;
        }

        container.innerHTML = rows.map((row) => `
            <div class="analytics-row">
                <span>${this.escapeHtml(row.title)}</span>
                <strong>${row.total}</strong>
            </div>
        `).join('');
    }

    formatAnalyticsAction(action) {
        const labels = {
            card_view: 'Card views',
            detail_open: 'Detail opens',
            link_click: 'Link clicks',
            pdf_open: 'PDF opens',
            share_click: 'Shares',
            category_click: 'Category taps',
            resource_open: 'Resource opens'
        };
        return labels[action] || action;
    }

    syncCategoryPicker(category) {
        document.querySelectorAll('[data-category-pick]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-category-pick') === category);
        });
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

        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;

        try {
            const formData = new FormData(e.target);
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
            this.resetForm();

            let successMessage = wasEditMode
                ? `${submittedLabel} updated successfully!`
                : `${submittedLabel} saved successfully! Check the Manage tab.`;
            if (submittedType === 'post') {
                successMessage += ' It should appear on the student feed shortly.';
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
                errorMessage = 'You don\'t have permission to perform this action. Please check your login status.';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable. Please try again in a moment.';
            } else if (error.message?.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            }

            this.showTemporaryMessage(errorMessage, 'error');
        } finally {
            // Reset loading state
            submitBtn.classList.remove('btn-loading');
            submitBtn.disabled = false;
            submitBtn.textContent = this.isEditMode
                ? (this.contentType === 'resource' ? 'Update Resource' : 'Update Bulletin')
                : (this.contentType === 'resource' ? 'Publish Resource' : 'Post Bulletin');
            this.isSubmitting = false;
        }
    }

    async handleImageUpload(file, bulletin, pdfFile = null, editingId = null, fieldName = 'image') {
        try {
            const signature = this.getFileSignature(file);
            let processedImage = null;
            let usedCachedImage = false;
            const { pendingKey, label } = this.getImageFieldConfig(fieldName);

            if (this[pendingKey] && this[pendingKey].signature === signature) {
                processedImage = this[pendingKey];
                usedCachedImage = true;
            } else if (fieldName === 'image' && isPdfFile(file)) {
                const flyerSource = await this.prepareFlyerSourceFile(file, fieldName);
                processedImage = {
                    ...(await this.prepareImageForUpload(flyerSource.uploadFile)),
                    signature,
                    convertedFromPdf: true,
                    pdfPageCount: flyerSource.pdfPageCount
                };
            } else {
                processedImage = await this.prepareImageForUpload(file);
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
                    ? file
                    : (pdfFile && pdfFile.size > 0 ? pdfFile : null);
                if (pdfToUpload) {
                    await this.handlePdfUpload(pdfToUpload, bulletin, editingId);
                }
            }

            if (processedImage.infoMessage && !usedCachedImage) {
                this.showTemporaryMessage(processedImage.infoMessage, 'info');
            } else if (fieldName === 'image' && isPdfFile(file) && !usedCachedImage) {
                this.showTemporaryMessage('PDF flyer converted. Students will see page 1 on the board and can open the full PDF from the post.', 'success');
            }
        } catch (error) {
            console.error('Image processing error:', error);
            const message = typeof error === 'string'
                ? error
                : (fieldName === 'image' && isPdfFile(file)
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

    async handleImagePreview(e, fieldName = 'image') {
        const file = e.target.files[0];
        const { previewId, pendingKey } = this.getImageFieldConfig(fieldName);
        const preview = document.getElementById(previewId);

        if (file && fieldName === 'resourceLogo') {
            this.removeResourceLogo = false;
        }

        if (file) {
            if (fieldName !== 'image' && isPdfFile(file)) {
                this.showTemporaryMessage('PDF flyers can only be uploaded in the English flyer field.', 'error');
                e.target.value = '';
                preview.innerHTML = '';
                this[pendingKey] = null;
                return;
            }

            try {
                let flyerSource;
                if (fieldName === 'image') {
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
                        preview.innerHTML = '';
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

                const processed = await this.prepareImageForUpload(flyerSource.uploadFile);
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

                if (fieldName === 'resourceLogo') {
                    this.updateResourceIconGroupState();
                }

                if (processed.infoMessage) {
                    this.showTemporaryMessage(processed.infoMessage, 'info');
                } else if (sizeWarning) {
                    this.showTemporaryMessage(sizeWarning, 'info');
                } else if (flyerSource.convertedFromPdf) {
                    this.showTemporaryMessage('PDF preview ready. The full PDF will be attached when you post.', 'info');
                }
            } catch (error) {
                console.error('Image preview error:', error);
                const message = typeof error === 'string'
                    ? error
                    : (fieldName === 'image' && isPdfFile(file)
                        ? 'Could not read this PDF. Try a different file or export page 1 as a PNG/JPG.'
                        : 'Could not process this image. Please try a smaller JPG or PNG.');
                this.showTemporaryMessage(message, 'error');
                e.target.value = '';
                preview.innerHTML = '';
                this[pendingKey] = null;
                if (fieldName === 'resourceLogo') {
                    this.updateResourceIconGroupState();
                }
            }
        } else {
            preview.innerHTML = '';
            this[pendingKey] = null;
            if (fieldName === 'resourceLogo') {
                this.updateResourceIconGroupState();
            }
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
        if (fieldName === 'image' && isPdfFile(file)) {
            if (file.size > 10 * 1024 * 1024) {
                throw 'PDF file too large. Please select a PDF under 10MB.';
            }

            const { convertPdfFirstPageToImageFile } = await import('./src/pdf-flyer.js');
            const converted = await convertPdfFirstPageToImageFile(file);
            return {
                uploadFile: converted.imageFile,
                sourcePdf: file,
                convertedFromPdf: true,
                pdfPageCount: converted.pageCount,
                warnings: converted.pageCount > 1
                    ? [`This PDF has ${converted.pageCount} pages. Page 1 will show on the board; the full PDF will be attached.`]
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

    prepareImageForUpload(file) {
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

                    const TARGET_BYTES = 900 * 1024; // ~900KB
                    const MIN_DIMENSION = 600;
                    let currentMaxDimension = 1400;
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
                        processedWidth = Math.max(Math.round(img.width * scale), MIN_DIMENSION);
                        processedHeight = Math.max(Math.round(img.height * scale), MIN_DIMENSION);

                        canvas.width = processedWidth;
                        canvas.height = processedHeight;
                        ctx.clearRect(0, 0, processedWidth, processedHeight);
                        ctx.drawImage(img, 0, 0, processedWidth, processedHeight);

                        quality = 0.85;
                        processedDataUrl = canvas.toDataURL('image/jpeg', quality);
                        finalBytes = this.calculateBase64Size(processedDataUrl);

                        while (finalBytes > TARGET_BYTES && quality >= 0.4) {
                            quality -= 0.1;
                            processedDataUrl = canvas.toDataURL('image/jpeg', quality);
                            finalBytes = this.calculateBase64Size(processedDataUrl);
                        }

                        if (finalBytes <= TARGET_BYTES || (processedWidth <= MIN_DIMENSION && processedHeight <= MIN_DIMENSION)) {
                            break;
                        }

                        currentMaxDimension = Math.max(Math.round(currentMaxDimension * 0.75), MIN_DIMENSION);
                        attempts += 1;
                    }

                    if (finalBytes > 4 * 1024 * 1024) {
                        reject('This image is very large. Please resize it below 2000px on the longest edge and try again.');
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
        const input = document.getElementById(fieldName);
        const preview = document.getElementById(previewId);

        if (input) input.value = '';
        if (preview) preview.innerHTML = '';
        this[pendingKey] = null;

        if (fieldName === 'resourceLogo') {
            if (this.isEditMode) {
                this.removeResourceLogo = true;
            }
            this.updateResourceIconGroupState();
        }
    }

    handlePdfPreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('pdfPreview');

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
        document.getElementById('pdf').value = '';
        document.getElementById('pdfPreview').innerHTML = '';
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

        // Switch to post tab
        this.showTab('post');
        document.getElementById('bulletinForm').reset();
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('imageEsPreview').innerHTML = '';
        const resourceLogoPreviewEl = document.getElementById('resourceLogoPreview');
        if (resourceLogoPreviewEl) resourceLogoPreviewEl.innerHTML = '';
        document.getElementById('pdfPreview').innerHTML = '';
        this.pendingImageData = null;
        this.pendingImageEsData = null;
        this.pendingResourceLogoData = null;
        this.removeResourceLogo = false;

        // Set edit mode
        this.isEditMode = true;
        this.editingBulletinId = bulletinId;

        const isResource = this.isResourceBulletin(bulletin);
        this.setContentType(isResource ? 'resource' : 'post', { preserveFields: true, silent: true });
        if (typeof window.apSelectType === 'function') {
            window.apSelectType(isResource ? 'resource' : 'bulletin');
        }

        if (isResource) {
            document.getElementById('resourceTitleEn').value = bulletin.titleEn || bulletin.title || '';
            document.getElementById('resourceTitleEs').value = bulletin.titleEs || '';
            document.getElementById('resourceCategory').value = bulletin.resourceCategory || '';
            document.getElementById('resourceIcon').value = bulletin.resourceIcon || 'auto';
            document.getElementById('resourceUrl').value = bulletin.url || bulletin.eventLink || '';
            document.getElementById('resourceDescription').value = bulletin.description || '';
            document.getElementById('resourceHighlights').value = bulletin.highlights || '';
            document.getElementById('resourcePublished').checked = bulletin.isPublished !== false;
            document.getElementById('resourceOrder').value = bulletin.resourceOrder ?? '';
            document.getElementById('resourceAdvisorName').value = bulletin.advisorName || '';
            document.getElementById('resourceAddress').value = bulletin.address || '';
            document.getElementById('resourcePhone').value = bulletin.phone || '';
            if (bulletin.phoneMode) {
                const radio = document.querySelector(`input[name="resourcePhoneMode"][value="${bulletin.phoneMode}"]`);
                if (radio) radio.checked = true;
            }
            document.getElementById('resourceHours').value = bulletin.hours || '';
            const resLangs = Array.isArray(bulletin.languages) ? bulletin.languages : (bulletin.languages || '').split(',').map(s => s.trim()).filter(Boolean);
            document.querySelectorAll('input[name="resourceLanguages"]').forEach(cb => {
                cb.checked = resLangs.includes(cb.value);
            });

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
            this.updateResourceIconGroupState();
        } else {
            document.getElementById('title').value = bulletin.title;
            document.getElementById('titleEs').value = bulletin.titleEs || '';
            document.getElementById('category').value = bulletin.category;
            document.getElementById('description').value = bulletin.description;
            document.getElementById('summaryEs').value = bulletin.summaryEs || '';
            document.getElementById('company').value = bulletin.company || '';
            document.getElementById('contact').value = bulletin.contact || '';
            document.getElementById('contactPhone').value = bulletin.phone || '';
            if (bulletin.phoneMode) {
                const radio = document.querySelector(`input[name="contactPhoneMode"][value="${bulletin.phoneMode}"]`);
                if (radio) radio.checked = true;
            }
            document.getElementById('contactHours').value = bulletin.hours || '';
            const conLangs = Array.isArray(bulletin.languages) ? bulletin.languages : (bulletin.languages || '').split(',').map(s => s.trim()).filter(Boolean);
            document.querySelectorAll('input[name="contactLanguages"]').forEach(cb => {
                cb.checked = conLangs.includes(cb.value);
            });
            if (bulletin.dateType) {
                document.getElementById('dateType').value = bulletin.dateType;
                toggleDateFields();

                if (bulletin.dateType === 'deadline' || bulletin.dateType === 'event') {
                    document.getElementById('eventDate').value = bulletin.eventDate || '';
                } else if (bulletin.dateType === 'range') {
                    document.getElementById('startDate').value = bulletin.startDate || '';
                    document.getElementById('endDate').value = bulletin.endDate || '';
                } else if (bulletin.dateType === 'sessions') {
                    const sessionDates = Array.isArray(bulletin.eventDates) && bulletin.eventDates.length
                        ? bulletin.eventDates
                        : (bulletin.eventDate ? [bulletin.eventDate] : ['', '']);
                    this.renderEventDatesList(sessionDates);
                }
            } else {
                document.getElementById('dateType').value = bulletin.deadline ? 'deadline' : '';
                if (bulletin.deadline) {
                    toggleDateFields();
                    document.getElementById('eventDate').value = bulletin.deadline;
                }
            }
            document.getElementById('classType').value = bulletin.classType || '';
            document.getElementById('startTime').value = bulletin.startTime || '';
            document.getElementById('endTime').value = bulletin.endTime || '';
            document.getElementById('eventLocation').value = bulletin.eventLocation || '';
            document.getElementById('eventLink').value = bulletin.eventLink || '';
            document.getElementById('advisorName').value = bulletin.advisorName;

            if (bulletin.image) {
                document.getElementById('imagePreview').innerHTML = `
                    <div class="preview-container">
                        <img src="${bulletin.image}" alt="Preview" class="preview-image">
                        <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview('image')">&times;</button>
                    </div>
                `;
            }

            if (bulletin.imageEs) {
                document.getElementById('imageEsPreview').innerHTML = `
                    <div class="preview-container">
                        <img src="${bulletin.imageEs}" alt="Spanish Preview" class="preview-image">
                        <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview('imageEs')">&times;</button>
                    </div>
                `;
            }
            this.autoExpandAccordions();
        }

        // Store the bulletin ID for updating
        document.getElementById('bulletinForm').dataset.editingId = bulletinId;

        // Change submit button text
        const submitBtn = document.querySelector('#bulletinForm button[type="submit"]');
        submitBtn.textContent = isResource ? 'Update Resource' : 'Update Bulletin';

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
        const sorted = [...this.advisors].sort((a, b) => a.displayName.localeCompare(b.displayName));
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
            this.refreshAdvisorDropdown();
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
            this.refreshAdvisorDropdown();
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
            this.refreshAdvisorDropdown();
            this.showToast(`${advisor.displayName} removed.`, 'success');
        } catch (e) {
            this.showToast('Error removing advisor: ' + e.message, 'error');
        }
    }

    refreshAdvisorDropdown() {
        const current = document.getElementById('advisorName')?.value || document.getElementById('resourceAdvisorName')?.value || '';
        this.populateAdvisorSelects(current);
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
        } else if (filterMode === 'draft') {
            userBulletins = userBulletins.filter(b => this.isResourceBulletin(b) && b.isPublished === false);
        }

        if (contentKind === 'bulletin') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'bulletin');
        } else if (contentKind === 'resource') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'resource');
        } else if (contentKind === 'event') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'event');
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
                    b.advisorName,
                    b.description,
                    b.url,
                    b.eventLink,
                    b.highlights,
                    b.phone,
                    b.address,
                    ...(Array.isArray(b.languages) ? b.languages : [])
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
            const aDate = a.datePosted ? (a.datePosted.toDate ? a.datePosted.toDate() : new Date(a.datePosted)) : new Date(0);
            const bDate = b.datePosted ? (b.datePosted.toDate ? b.datePosted.toDate() : new Date(b.datePosted)) : new Date(0);
            return sortMode === 'oldest' ? aDate - bDate : bDate - aDate;
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
            const typeLabel = kind === 'resource' ? 'Resource' : kind === 'event' ? 'Calendar event' : 'Bulletin';
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
                    <p><strong>Advisor:</strong> ${this.escapeHtml(bulletin.advisorName)} (${this.escapeHtml(bulletin.postedBy)})</p>
                ` : ''}
                <p><strong>Posted:</strong> ${bulletin.datePosted
                    ? new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString()
                    : 'Unknown'}</p>
                ${isResource ? `
                    <p><strong>Spanish Title:</strong> ${this.escapeHtml(bulletin.titleEs || bulletin.titleEn || bulletin.title || '')}</p>
                    <p><strong>Published:</strong> ${bulletin.isPublished !== false ? 'Yes' : 'No — hidden from students'}</p>
                    ${bulletin.url || bulletin.eventLink ? `<p><strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.url || bulletin.eventLink)}" target="_blank" rel="noopener">Open resource</a></p>` : ''}
                    ${bulletin.description ? `<p><strong>Description:</strong> ${this.escapeHtml(bulletin.description)}</p>` : ''}
                    ${bulletin.highlights ? `<p><strong>Highlights:</strong> ${this.escapeHtml(bulletin.highlights)}</p>` : ''}
                    ${bulletin.address ? `<p><strong>Address:</strong> ${this.escapeHtml(bulletin.address)}</p>` : ''}
                    ${bulletin.phone ? `<p><strong>Phone:</strong> ${this.escapeHtml(bulletin.phone)} (${this.escapeHtml(bulletin.phoneMode || 'call')})</p>` : ''}
                    ${Array.isArray(bulletin.languages) && bulletin.languages.length ? `<p><strong>Languages:</strong> ${bulletin.languages.map(lang => this.escapeHtml(lang)).join(', ')}</p>` : ''}
                    ${bulletin.resourceOrder !== '' && bulletin.resourceOrder !== undefined && bulletin.resourceOrder !== null ? `<p><strong>Display Order:</strong> ${this.escapeHtml(String(bulletin.resourceOrder))}</p>` : ''}
                ` : ''}
                ${this.renderManageDateInfo(bulletin)}
                ${this.renderManageAnalytics(bulletin.id)}
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

    // Preview functionality
    previewBulletin() {
        const contentType = document.getElementById('contentType')?.value || this.contentType || 'post';

        if (contentType === 'resource') {
            const titleEn = document.getElementById('resourceTitleEn').value.trim();
            const titleEs = document.getElementById('resourceTitleEs').value.trim();
            const resourceCategory = document.getElementById('resourceCategory').value;
            const rawUrl = document.getElementById('resourceUrl').value.trim();
            const description = document.getElementById('resourceDescription').value.trim();
            const highlights = document.getElementById('resourceHighlights').value.trim();
            const resourceIcon = document.getElementById('resourceIcon').value;
            const resourceOrder = document.getElementById('resourceOrder').value.trim();
            const isPublished = document.getElementById('resourcePublished').checked;

            if (!titleEn || !resourceCategory || !rawUrl) {
                this.showTemporaryMessage('Please fill in the English title, category, and URL before previewing.', 'warning');
                return;
            }

            const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

            this.showPreview({
                type: 'resource',
                title: titleEn,
                titleEn,
                titleEs: titleEs || titleEn,
                resourceCategory,
                resourceIcon,
                url,
                eventLink: url,
                description,
                highlights,
                resourceOrder,
                isPublished,
                advisorName: this.currentUser?.name || document.getElementById('advisorName').value || 'Advisor',
                datePosted: new Date()
            });
            return;
        }

        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;
        const titleEs = document.getElementById('titleEs')?.value || '';
        const summaryEs = document.getElementById('summaryEs')?.value || '';
        const company = document.getElementById('company').value;
        const contact = document.getElementById('contact').value;
        const classType = document.getElementById('classType').value;
        const eventLink = document.getElementById('eventLink').value;
        const advisorName = document.getElementById('advisorName').value;

        // Get new date structure
        const dateType = document.getElementById('dateType')?.value || '';
        const eventDate = document.getElementById('eventDate')?.value || '';
        const startDate = document.getElementById('startDate')?.value || '';
        const endDate = document.getElementById('endDate')?.value || '';
        const startTime = document.getElementById('startTime')?.value || '';
        const endTime = document.getElementById('endTime')?.value || '';
        const eventLocation = document.getElementById('eventLocation')?.value || '';

        if (!title || !category || !advisorName) {
            this.showTemporaryMessage('Please fill in the title, category, and your name before previewing.', 'warning');
            return;
        }

        const bulletin = {
            title,
            titleEs,
            category,
            description,
            summaryEs,
            company,
            contact,
            dateType,
            eventDate,
            startDate,
            endDate,
            startTime,
            endTime,
            eventLocation,
            eventLink,
            classType,
            advisorName,
            datePosted: new Date(),
            image: document.getElementById('imagePreview')?.querySelector('img')?.src || null,
            imageEs: document.getElementById('imageEsPreview')?.querySelector('img')?.src || null,
            pdfUrl: document.getElementById('pdfPreview').querySelector('.pdf-preview-container') ? 'preview-pdf' : null
        };

        this.showPreview(bulletin);
    }

    showPreview(bulletin) {
        const previewContent = document.getElementById('previewContent');
        if (this.isResourceBulletin(bulletin)) {
            previewContent.innerHTML = this.createResourcePreviewCard(bulletin);
            document.getElementById('previewModal').style.display = 'block';
            return;
        }

        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const descriptionHtml = this.renderPreviewDescription(bulletin.description || '');

        previewContent.innerHTML = `
            <div class="bulletin-card">
                <div class="bulletin-header">
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                    <div class="bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                </div>

                ${bulletin.image ? `
                    <div class="bulletin-image">
                        ${bulletin.imageEs ? '<small style="color:#64748b;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;display:block">English Version</small>' : ''}
                        <img src="${bulletin.image}" alt="Bulletin image" class="card-image">
                    </div>
                ` : ''}

                ${bulletin.imageEs ? `
                    <div class="bulletin-image" style="margin-top:12px">
                        <small style="color:#64748b;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;display:block">Spanish Version</small>
                        <img src="${bulletin.imageEs}" alt="Spanish bulletin image" class="card-image">
                    </div>
                ` : ''}

                <div class="bulletin-description">
                    ${descriptionHtml}
                </div>

                <div class="bulletin-meta">
                    ${bulletin.company ? `
                        <div class="meta-item">
                            <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                        </div>
                    ` : ''}

                    ${bulletin.classType ? `
                        <div class="meta-item">
                            <strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}
                        </div>
                    ` : ''}

                    ${bulletin.contact ? `
                        <div class="meta-item">
                            <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\\n/g, '<br>')}
                        </div>
                    ` : ''}

                    ${bulletin.eventLink ? `
                        <div class="meta-item">
                            <strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(bulletin.eventLink, bulletin.category))}</a>
                        </div>
                    ` : ''}

                    ${this.renderPreviewDateInfo(bulletin)}

                    ${bulletin.deadline ? `
                        <div class="meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                            <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                            ${isDeadlineClose ? ' (Soon!)' : ''}
                        </div>
                    ` : ''}

                    <div class="posted-by">
                        Posted by ${this.escapeHtml(bulletin.advisorName)}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('previewModal').style.display = 'block';
    }

    createResourcePreviewCard(resource) {
        const titleEn = resource.titleEn || resource.title || '';
        const titleEs = resource.titleEs || titleEn;
        const categoryLabel = this.getResourceCategoryLabel(resource.resourceCategory);
        const iconLabel = ADMIN_RESOURCE_ICON_LABELS[resource.resourceIcon] || ADMIN_RESOURCE_ICON_LABELS.auto;

        return `
            <div class="bulletin-card resource-preview-card">
                <div class="bulletin-header">
                    <span class="category-badge category-resource">Resource</span>
                    <div class="bulletin-title">${this.escapeHtml(titleEn)}</div>
                </div>
                <div class="resource-preview-meta">
                    <p><strong>Spanish Title:</strong> ${this.escapeHtml(titleEs)}</p>
                    <p><strong>Category:</strong> ${this.escapeHtml(categoryLabel)}</p>
                    <p><strong>Icon:</strong> ${this.escapeHtml(iconLabel)}</p>
                    <p><strong>Published:</strong> ${resource.isPublished !== false ? 'Yes' : 'No'}</p>
                    <p><strong>Link:</strong> <a href="${this.escapeAttribute(resource.url || resource.eventLink)}" target="_blank" rel="noopener">Open resource</a></p>
                    ${resource.description ? `<p><strong>Description:</strong> ${this.escapeHtml(resource.description)}</p>` : ''}
                    ${resource.resourceOrder !== '' && resource.resourceOrder !== undefined && resource.resourceOrder !== null ? `<p><strong>Display Order:</strong> ${this.escapeHtml(String(resource.resourceOrder))}</p>` : ''}
                    <p class="resource-preview-internal"><strong>Internal — Posted by:</strong> ${this.escapeHtml(resource.advisorName || '')} <span class="resource-preview-internal-note">(not shown to students)</span></p>
                </div>
            </div>
        `;
    }

    closePreview() {
        document.getElementById('previewModal').style.display = 'none';
    }

    submitFromPreview() {
        this.closePreview();
        const form = document.getElementById('bulletinForm');
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);
    }

    renderPreviewDateInfo(bulletin) {
        let html = '';
        const dateType = bulletin.dateType;

        if (!dateType) return html;

        if (dateType === 'deadline' && bulletin.eventDate) {
            html += `<div class="meta-item"><strong>Application Deadline:</strong> ${this.formatDateLocal(bulletin.eventDate)}</div>`;
        } else if (dateType === 'event' && bulletin.eventDate) {
            html += `<div class="meta-item"><strong>Event Date:</strong> ${this.formatDateLocal(bulletin.eventDate)}</div>`;
        } else if (dateType === 'range') {
            html += `<div class="meta-item"><strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}</div>`;
        } else if (dateType === 'sessions' && bulletin.eventDates?.length) {
            const datesLabel = bulletin.eventDates.map((date) => this.formatDateLocal(date)).join(', ');
            html += `<div class="meta-item"><strong>Session Dates:</strong> ${datesLabel}</div>`;
        }

        // Add time range if specified
        if ((bulletin.startTime || bulletin.endTime) && (dateType === 'event' || dateType === 'range' || dateType === 'sessions')) {
            const timeRange = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            if (timeRange) {
                html += `<div class="meta-item"><strong>Time:</strong> ${timeRange}</div>`;
            }
        }

        // Add event location/format if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'sessions')) {
            const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                               bulletin.eventLocation === 'online' ? 'Online' :
                               bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
            html += `<div class="meta-item"><strong>Format:</strong> ${locationText}</div>`;
        }

        return html;
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

    renderPreviewDescription(rawText) {
        if (!rawText) {
            return '';
        }

        const formatted = this.formatRichText(rawText);
        return formatted
            .split(/\n{2,}/)
            .map(segment => `<p>${segment.replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    applyInlineFormatting(html) {
        return (html || '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
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
            const dates = this.normalizeEventDates(formData.getAll('eventDates'));
            return dates.length ? dates[dates.length - 1] : '';
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
        if (!bulletin || !bulletin.deadline) {
            return false;
        }

        const deadlineDate = new Date(bulletin.deadline);
        if (Number.isNaN(deadlineDate.getTime())) {
            return false;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(23, 59, 59, 999);
        return deadlineDate < today;
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

    async createBulletin(formData) {
        const bulletin = this.buildBulletinObject(formData);
        bulletin.postedBy = this.currentUser.username;
        bulletin.datePosted = serverTimestamp();
        bulletin.createdAt = serverTimestamp();
        bulletin.updatedAt = serverTimestamp();

        // Create the Firestore document FIRST to get an ID
        const docRef = await addDoc(collection(db, 'bulletins'), bulletin);
        const bulletinId = docRef.id;

        if (this.isResourceBulletin(bulletin)) {
            const resourceLogoFile = formData.get('resourceLogo');
            if (resourceLogoFile && resourceLogoFile.size > 0) {
                await this.handleImageUpload(resourceLogoFile, bulletin, null, bulletinId, 'resourceLogo');
            }
            this.loadManageBulletins();
            return bulletinId;
        }

        const imageFile = formData.get('image');
        const imageEsFile = formData.get('imageEs');
        const pdfFile = formData.get('pdf');

        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile, bulletinId, 'image');
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
            bulletin.image = this.isResourceBulletin(bulletin) ? null : existingBulletin.image;
            bulletin.pdfUrl = this.isResourceBulletin(bulletin) ? null : existingBulletin.pdfUrl;
            if (this.isResourceBulletin(bulletin)) {
                bulletin.resourceLogo = existingBulletin.resourceLogo || null;
            }
        }

        if (this.isResourceBulletin(bulletin)) {
            const resourceLogoFile = formData.get('resourceLogo');
            const hasNewLogo = resourceLogoFile && resourceLogoFile.size > 0;

            if (!hasNewLogo && this.removeResourceLogo) {
                bulletin.resourceLogo = null;
            }

            if (hasNewLogo) {
                await this.saveBulletin(bulletin, bulletinId);
                await this.handleImageUpload(resourceLogoFile, bulletin, null, bulletinId, 'resourceLogo');
            } else {
                await this.saveBulletin(bulletin, bulletinId);
            }

            this.removeResourceLogo = false;
            return;
        }

        const imageFile = formData.get('image');
        const imageEsFile = formData.get('imageEs');
        const pdfFile = formData.get('pdf');
        
        let fileProcessed = false;
        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile, bulletinId, 'image');
            fileProcessed = true;
        } else if (pdfFile && pdfFile.size > 0) {
            await this.handlePdfUpload(pdfFile, bulletin, bulletinId);
            fileProcessed = true;
        }
        
        if (imageEsFile && imageEsFile.size > 0) {
            await this.handleImageUpload(imageEsFile, bulletin, null, bulletinId, 'imageEs');
            fileProcessed = true;
        }

        if (!fileProcessed) {
            // Only save if there are no files (file upload handlers save it)
            await this.saveBulletin(bulletin, bulletinId);
        }
    }

    buildBulletinObject(formData) {
        const contentType = (formData.get('contentType') || this.contentType || 'post') === 'resource' ? 'resource' : 'post';

        if (contentType === 'resource') {
            const titleEn = (formData.get('resourceTitleEn') || '').trim();
            const titleEs = (formData.get('resourceTitleEs') || '').trim();
            const resourceCategory = (formData.get('resourceCategory') || '').trim();
            let url = (formData.get('resourceUrl') || '').trim();
            const rawOrder = (formData.get('resourceOrder') || '').trim();

            if (!titleEn) {
                throw new Error('English title is required for resources.');
            }

            if (!resourceCategory) {
                throw new Error('Resource category is required.');
            }

            if (!url) {
                throw new Error('Resource link is required.');
            }

            if (!/^https?:\/\//i.test(url)) {
                url = `https://${url}`;
            }

            try {
                new URL(url);
            } catch (error) {
                throw new Error('Please enter a valid resource URL.');
            }

            const resourceOrder = rawOrder === '' ? null : Number(rawOrder);
            if (rawOrder !== '' && (!Number.isFinite(resourceOrder) || !Number.isInteger(resourceOrder) || resourceOrder < 0 || resourceOrder > 999)) {
                throw new Error('Display order must be a whole number from 0 to 999.');
            }

            const suggestedIcon = document.getElementById('resourceIcon')?.dataset?.suggestedIcon || 'globe';
            const selectedIcon = (formData.get('resourceIcon') || 'auto').trim();

            const advisorName = (formData.get('resourceAdvisorName') || '').trim();
            if (!advisorName) {
                throw new Error('Please select who is posting this resource.');
            }

            return {
                type: 'resource',
                title: titleEn,
                titleEn,
                titleEs: titleEs || titleEn,
                category: 'resource',
                resourceCategory,
                resourceIcon: selectedIcon === 'auto' ? suggestedIcon : selectedIcon,
                resourceLogo: null,
                url,
                eventLink: url,
                description: (formData.get('resourceDescription') || '').trim(),
                highlights: (formData.get('resourceHighlights') || '').trim(),
                advisorName: advisorName,
                address: (formData.get('resourceAddress') || '').trim(),
                phone: (formData.get('resourcePhone') || '').trim(),
                phoneMode: (formData.get('resourcePhoneMode') || 'call').trim(),
                hours: (formData.get('resourceHours') || '').trim(),
                languages: formData.getAll('resourceLanguages'),
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
            eventDates = this.normalizeEventDates(formData.getAll('eventDates'));
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
            eventDate: dateType === 'sessions' ? (eventDates[0] || '') : (formData.get('eventDate') || ''),
            eventDates: dateType === 'sessions' ? eventDates : [],
            startDate: dateType === 'sessions' ? '' : (formData.get('startDate') || ''),
            endDate: dateType === 'sessions' ? '' : (formData.get('endDate') || ''),
            deadline: this.getCompatibleDeadline(formData),
            startTime: formData.get('startTime') || '',
            endTime: formData.get('endTime') || '',
            eventLocation: formData.get('eventLocation') || '',
            eventLink: (formData.get('eventLink') || '').trim(),
            classType: formData.get('classType') || '',
            advisorName: (formData.get('advisorName') || this.currentUser?.name || '').trim(),
            address: (formData.get('eventLocation') || '').trim(),
            phone: (formData.get('contactPhone') || '').trim(),
            phoneMode: (formData.get('contactPhoneMode') || 'call').trim(),
            hours: (formData.get('contactHours') || '').trim(),
            languages: formData.getAll('contactLanguages'),
            isActive: true,
            isPublished: true,
            hideFromMainFeed: false,
            image: null,
            pdfUrl: null
        };

        if (bulletin.eventLink && !/^https?:\/\//i.test(bulletin.eventLink)) {
            bulletin.eventLink = `https://${bulletin.eventLink}`;
        }

        return bulletin;
    }

    async saveBulletin(bulletin, editingId = null) {
        try {
            // Calculate approximate document size
            const bulletinStr = JSON.stringify(bulletin);
            const sizeInBytes = new Blob([bulletinStr]).size;
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

            console.log(`Bulletin size: ${sizeInMB} MB (${sizeInBytes} bytes)`);

            if (sizeInBytes > 1048576) { // 1MB in bytes
                throw new Error(`Bulletin too large (${sizeInMB} MB). Firestore documents must be under 1 MB. Try using a smaller image.`);
            }

            if (editingId) {
                await updateDoc(doc(db, 'bulletins', editingId), bulletin);
            } else {
                await addDoc(collection(db, 'bulletins'), bulletin);
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

    resetForm() {
        // Reset edit mode
        this.isEditMode = false;
        this.editingBulletinId = null;

        // Hide edit banner
        const banner = document.getElementById('editModeBanner');
        if (banner) banner.style.display = 'none';

        // Clear form
        document.getElementById('bulletinForm').reset();

        // Clear image preview and cached data
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) imagePreview.innerHTML = '';
        const imageEsPreview = document.getElementById('imageEsPreview');
        if (imageEsPreview) imageEsPreview.innerHTML = '';
        const resourceLogoPreview = document.getElementById('resourceLogoPreview');
        if (resourceLogoPreview) resourceLogoPreview.innerHTML = '';
        const pdfPreview = document.getElementById('pdfPreview');
        if (pdfPreview) pdfPreview.innerHTML = '';
        this.pendingImageData = null;
        this.pendingImageEsData = null;
        this.pendingResourceLogoData = null;
        this.removeResourceLogo = false;
        this.updateResourceIconGroupState();

        // Reset advisor name dropdown to current user
        if (this.currentUser) {
            this.populateAdvisorSelects(this.currentUser.name);
        }

        // Reset phone mode radios
        document.querySelectorAll('input[name="resourcePhoneMode"][value="call"]').forEach(r => r.checked = true);
        document.querySelectorAll('input[name="contactPhoneMode"][value="call"]').forEach(r => r.checked = true);

        // Reset language chips
        document.querySelectorAll('input[name="resourceLanguages"], input[name="contactLanguages"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset date fields
        document.getElementById('dateType').value = '';
        this.renderEventDatesList(['']);
        toggleDateFields();
        this.setContentType('post', { preserveFields: true, silent: true });
        document.getElementById('resourcePublished').checked = true;
        delete document.getElementById('resourceIcon').dataset.suggestedIcon;
        
        // Collapse all accordions
        document.querySelectorAll('.ap-accordion-section').forEach(section => {
            section.classList.remove('open');
        });

        // Switch back to manage tab
        this.showTab('manage');
    }

    isMineOrManaged(bulletin) {
        if (!this.currentUser) return false;
        const u = this.currentUser.username;
        const n = this.currentUser.name;
        return bulletin.postedBy === u ||
               bulletin.postedBy === n ||
               bulletin.advisorName === n ||
               bulletin.advisorName === u;
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

    renderManageAnalytics(bulletinId) {
        const metrics = this.analyticsByPost[bulletinId] || {};

        return `
            <div class="manage-analytics-strip" aria-label="Student engagement">
                <span><strong>${metrics.engagement || 0}</strong> engaged</span>
                <span><strong>${metrics.detail_open || 0}</strong> opens</span>
                <span><strong>${metrics.link_click || 0}</strong> links</span>
                <span><strong>${metrics.pdf_open || 0}</strong> PDFs</span>
                <span><strong>${metrics.share_click || 0}</strong> shares</span>
            </div>
        `;
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

function previewBulletin() {
    if (window.adminPanel) {
        window.adminPanel.previewBulletin();
    } else {
        console.error('Admin panel not initialized yet');
    }
}

function closePreview() {
    if (window.adminPanel) {
        window.adminPanel.closePreview();
    }
}

function submitFromPreview() {
    if (window.adminPanel) {
        window.adminPanel.submitFromPreview();
    }
}

function toggleDateFields() {
    const dateType = document.getElementById('dateType').value;
    const dateFields = document.getElementById('dateFields');
    const singleDateGroup = document.getElementById('singleDateGroup');
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    const sessionsDateGroup = document.getElementById('sessionsDateGroup');
    const eventDateInput = document.getElementById('eventDate');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Hide all date fields initially
    dateFields.style.display = 'none';
    singleDateGroup.style.display = 'none';
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    if (sessionsDateGroup) sessionsDateGroup.style.display = 'none';

    // Remove required attribute from all date fields first
    if (eventDateInput) eventDateInput.required = false;
    if (startDateInput) startDateInput.required = false;
    if (endDateInput) endDateInput.required = false;
    document.querySelectorAll('#eventDatesList input[name="eventDates"]').forEach((input) => {
        input.required = false;
    });

    if (dateType === 'deadline') {
        dateFields.style.display = 'flex';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Application Deadline';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'event') {
        dateFields.style.display = 'flex';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Event Date';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'sessions') {
        dateFields.style.display = 'flex';
        if (sessionsDateGroup) sessionsDateGroup.style.display = 'block';
        if (window.adminPanel) {
            const rows = document.querySelectorAll('#eventDatesList .event-date-row');
            if (rows.length < 2) {
                const firstValue = rows.length === 1 ? (rows[0].querySelector('input')?.value || '') : '';
                window.adminPanel.renderEventDatesList(firstValue ? [firstValue, ''] : ['', '']);
            }
        }
        const firstSessionInput = document.querySelector('#eventDatesList input[name="eventDates"]');
        if (firstSessionInput) firstSessionInput.required = true;
    } else if (dateType === 'range') {
        dateFields.style.display = 'flex';
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
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new FirebaseAdminPanel();
    // Expose for global access after initialization
    window.adminPanel = adminPanel;
    window.showTab = showTab;
    window.handleTabKeydown = handleTabKeydown;
    window.previewBulletin = previewBulletin;
    window.closePreview = closePreview;
    window.submitFromPreview = submitFromPreview;
    window.toggleDateFields = toggleDateFields;
});
