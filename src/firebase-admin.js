import { db } from './firebase.js'
import { showTab, handleTabKeydown, toggleDateFields } from './admin-tab-globals.js'
import * as bulletinFormat from './bulletin-format.js'
import { applyResourceLogos, deleteResourceLogo, fetchAllResourceLogos } from './resource-logos.js'
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
    expandRecurringWeeklySessions,
    WEEKDAY_NAMES,
} from './event-sessions.js'
import { initDescriptionFormatToolbars, refreshRichEditors, syncRichEditorsToForm, getRichTextFieldValue } from './description-format.js'
import { normalizeWebUrl } from './url-safety.js'
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDoc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore'

// Caps Firestore reads on the admin dashboard listener. Reorder validation falls back
// to getDoc when an ID is missing from this cache (see reorderResourcesInCategory).
const ADMIN_ACTIVE_BULLETINS_LIMIT = 500;

installClientErrorLogger('admin')

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
import { AdminUploadMethods } from './admin-uploads.js'
import { AdminOfflineMethods } from './admin-offline.js'
import { AdminToastMethods } from './admin-toasts.js'
import { AdminValidationMethods } from './admin-validation.js'
import { AdminAuthMethods } from './admin-auth.js'

// Reads the hoursRowDay/hoursRowTime hidden input pairs the composer's
// hours block writes (see wireHoursBlock/syncHoursRowMirrors in
// post-composer.js) into a [{ day, time }, ...] array, dropping empty rows.
function parseHoursRowsFromForm(formData) {
    const days = formData.getAll('hoursRowDay');
    const times = formData.getAll('hoursRowTime');
    const rows = [];
    for (let i = 0; i < Math.max(days.length, times.length); i += 1) {
        const day = (days[i] || '').trim();
        const time = (times[i] || '').trim();
        if (day || time) rows.push({ day, time });
    }
    return rows;
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
            isAdmin: isPrivilegedAdminEmail(a.email)
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
            if (this._resourceLogoMap) {
                applyResourceLogos(this.bulletins, this._resourceLogoMap);
            } else {
                this.loadResourceLogosOnce();
            }
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

    // See src/firebase-config.js's identical method for why logos are fetched
    // separately instead of inline on the bulletin document.
    loadResourceLogosOnce() {
        if (this._resourceLogoFetchPromise) return this._resourceLogoFetchPromise;
        this._resourceLogoFetchPromise = fetchAllResourceLogos(db)
            .then((logoMap) => {
                this._resourceLogoMap = logoMap;
                if (applyResourceLogos(this.bulletins, logoMap)) {
                    if (this.currentUser) {
                        this.loadManageBulletins();
                    }
                }
            })
            .catch((error) => {
                console.error('Error loading resource logos:', error);
                this._resourceLogoFetchPromise = null;
            });
        return this._resourceLogoFetchPromise;
    }

    // setupOfflineHandling / showOfflineMessage / hideOfflineMessage moved
    // to ./admin-offline.js (AdminOfflineMethods).

    bindEvents() {
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Sign-in is handled by google-auth.js + the auth listener in admin.js
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
        let manageSearchDebounceTimer = null;
        const rerenderDebounced = () => {
            if (manageSearchDebounceTimer) clearTimeout(manageSearchDebounceTimer);
            manageSearchDebounceTimer = setTimeout(rerender, 200);
        };
        const manageContentType = document.getElementById('manageContentTypeSelect');
        if (manageSearch) manageSearch.addEventListener('input', rerenderDebounced);
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
    // Auth flow (setAuthView, handleUserAuthenticated, applyAuthenticatedUser,
    // handleSignedOut, getUserDisplayName, loadAdvisorsFromFirestore, logout,
    // clearLoginForm, showAdminPanel, hideAdminPanel) and the getAuth*
    // attribution helpers moved to ./admin-auth.js (AdminAuthMethods).

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
        if (!bulletin) return [];
        if (bulletin.dateType === 'recurring') return expandRecurringWeeklySessions(bulletin);
        if (bulletin.dateType !== 'sessions') return [];
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
        if (!bulletin || (bulletin.dateType !== 'sessions' && bulletin.dateType !== 'recurring')) {
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

        const aIsMulti = a.dateType === 'sessions' || a.dateType === 'recurring';
        const bIsMulti = b.dateType === 'sessions' || b.dateType === 'recurring';
        if (aIsMulti && bIsMulti) {
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

    /**
     * Next occurrence of a dated bulletin on/after `today` (day precision).
     * Multi-session bulletins resolve to their next remaining session, not the first one.
     * @returns {{ day: Date, startTime: string, endTime: string } | null}
     */
    getNextUpcomingEventOccurrence(bulletin, today) {
        if (bulletin.dateType === 'sessions' || bulletin.dateType === 'recurring') {
            for (const session of this.getBulletinEventSessions(bulletin)) {
                const day = new Date(`${session.date}T00:00:00`);
                if (!Number.isNaN(day.getTime()) && day >= today) {
                    return { day, startTime: session.startTime || '', endTime: session.endTime || '' };
                }
            }
            return null;
        }

        const dateStr = bulletin.eventDate || bulletin.startDate;
        if (!dateStr) return null;
        const normalized = String(dateStr).split('T')[0];
        const day = new Date(`${normalized}T00:00:00`);
        if (Number.isNaN(day.getTime()) || day < today) return null;
        return { day, startTime: bulletin.startTime || '', endTime: bulletin.endTime || '' };
    }

    /** Upcoming dated posts/events — filtered in memory from already-loaded bulletins (no extra reads). */
    getUpcomingEventBulletins(limit = Infinity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = this.bulletins
            .filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive !== false)
            .map((bulletin) => ({ bulletin, next: this.getNextUpcomingEventOccurrence(bulletin, today) }))
            .filter((entry) => entry.next)
            .sort((a, b) => a.next.day - b.next.day)
            .map((entry) => entry.bulletin);

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = this.getUpcomingEventBulletins(4);

        if (!upcoming.length) {
            container.innerHTML = '<p style="color:var(--ap-text-3);font-size:.82rem;">No upcoming events. Create a calendar event to see it here.</p>';
            return;
        }

        container.innerHTML = upcoming.map((bulletin) => {
            const next = this.getNextUpcomingEventOccurrence(bulletin, today);
            if (!next) return '';
            const eventDay = next.day;
            const month = eventDay.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = eventDay.getDate();
            const title = bulletin.title || 'Untitled event';
            const time = this.formatTimeRangeAdmin(next.startTime, next.endTime);

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

    // handleImageUpload / handlePdfUpload moved to ./admin-uploads.js
    // (AdminUploadMethods, merged via applyMethods below).

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
        dialog.setAttribute('role', 'alertdialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', title);
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

        const lastFocused = document.activeElement;
        const cancelBtn = dialog.querySelector('#confirmDialogCancel');
        const okBtn = dialog.querySelector('#confirmDialogOk');
        cancelBtn.focus();

        const onKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            } else if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === cancelBtn) {
                    e.preventDefault();
                    okBtn.focus();
                } else if (!e.shiftKey && document.activeElement === okBtn) {
                    e.preventDefault();
                    cancelBtn.focus();
                }
            }
        };
        dialog.addEventListener('keydown', onKeydown);

        const close = () => {
            dialog.remove();
            if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
                lastFocused.focus();
            }
        };
        cancelBtn.addEventListener('click', close);
        okBtn.addEventListener('click', () => { close(); onConfirm(); });
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
            const initialHoursRows = Array.isArray(bulletin.hoursRows) && bulletin.hoursRows.length
                ? bulletin.hoursRows
                : (bulletin.hours ? [{ day: '', time: bulletin.hours }] : []);
            this.writeHoursRowMirrorInputs(initialHoursRows);

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
                } else if (bulletin.dateType === 'recurring') {
                    set('startDate', bulletin.startDate || '');
                    set('endDate', bulletin.endDate || '');
                    set('eventDate', bulletin.startDate || bulletin.eventDate || '');
                    set('recurringWeekday', bulletin.recurringWeekday != null ? String(bulletin.recurringWeekday) : '');
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
            throw new Error('Reorder validation failed: one or more resources could not be confirmed against this category.');
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
        return bulletinFormat.getClassTypeDisplay(classType);
    }

    escapeAttribute(text) {
        return bulletinFormat.escapeAttribute(text);
    }

    formatEventTime(timeString) {
        return bulletinFormat.formatEventTime(timeString);
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
        return bulletinFormat.escapeHtml(text);
    }

    // showSuccessMessage / showToast / showTemporaryMessage moved to
    // ./admin-toasts.js (AdminToastMethods).

    // setupFormValidation / validateField / moderateContent /
    // validateBulletinContent moved to ./admin-validation.js
    // (AdminValidationMethods).

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
                bulletin.hasResourceLogo = existingBulletin.hasResourceLogo || false;
                // If the form field is absent from the submission (hidden input missing) or
                // present but empty, fall back to the existing published state rather than
                // silently unpublishing the resource. There is no visible publish control in
                // the composer — the field is a hidden input pinned to 'on' — so an empty
                // value never means "the advisor asked to hide this", only that the mirror
                // was populated from an already-hidden doc. Treating it as intent would let
                // an ordinary edit hide a resource with no way to bring it back.
                const publishedField = formData.get('resourcePublished');
                if (publishedField === null || publishedField === '') {
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
                    bulletin.hasResourceLogo = false;
                    await deleteResourceLogo(db, bulletinId);
                    this._resourceLogoMap?.delete(bulletinId);
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
                url = normalizeWebUrl(url);
                if (!url) {
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
                resourceLogo: null,
                hasResourceLogo: false,
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
                hours: '',
                hoursRows: isDocument ? [] : parseHoursRowsFromForm(formData),
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
        let recurringWeekday = '';
        if (dateType === 'recurring') {
            recurringWeekday = formData.get('recurringWeekday') || '';
            if (recurringWeekday === '' || !formData.get('startDate') || !formData.get('endDate')) {
                throw new Error('Please choose a weekday and a start and end date for the recurring event.');
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
            recurringWeekday: dateType === 'recurring' ? recurringWeekday : '',
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

        if (bulletin.eventLink) {
            bulletin.eventLink = normalizeWebUrl(bulletin.eventLink);
            if (!bulletin.eventLink) {
                throw new Error('Please enter a valid information link.');
            }
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
            } else if (dateType === 'recurring' && bulletin.startDate && bulletin.endDate) {
                const weekdayName = WEEKDAY_NAMES[Number(bulletin.recurringWeekday)] || '';
                html = `<p><strong>Recurring:</strong> Every ${weekdayName}, ${this.formatDateLocalAdmin(bulletin.startDate)} - ${this.formatDateLocalAdmin(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}</p>`;
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'recurring')) {
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
        return bulletinFormat.formatTimeRange(startTime, endTime);
    }

    formatTimeAdmin(timeString) {
        return bulletinFormat.formatTime(timeString);
    }

    // formatDateLocal / formatTimeRange / formatTime (unsuffixed) removed —
    // they were dead code. The portal's date rendering uses the *Admin
    // variants above.
}

applyMethods(FirebaseAdminPanel, AdminComposerFormMethods)
applyMethods(FirebaseAdminPanel, AdminAttachmentMethods)
applyMethods(FirebaseAdminPanel, AdminManageMethods)
applyMethods(FirebaseAdminPanel, AdminUploadMethods)
applyMethods(FirebaseAdminPanel, AdminOfflineMethods)
applyMethods(FirebaseAdminPanel, AdminToastMethods)
applyMethods(FirebaseAdminPanel, AdminValidationMethods)
applyMethods(FirebaseAdminPanel, AdminAuthMethods)

// showTab / handleTabKeydown / toggleDateFields moved to
// ./admin-tab-globals.js — mountAdvisorPortal assigns them onto window for
// the portal's inline onclick= / onkeydown= handlers.

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
