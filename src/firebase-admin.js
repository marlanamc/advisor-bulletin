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
    getSuggestedResourceChips,
    MAX_RESOURCE_SERVICE_CHIPS,
} from './resource-chip-labels.js'
import {
    MAX_RESOURCE_ACTION_LINKS,
    normalizeResourceActionLinks,
} from './resource-action-links.js'
import { initAdminFieldHelp } from './admin-field-help.js'
import {
    MAX_EVENT_SESSIONS,
    normalizeEventSessions,
    parseSessionEntry,
    sessionsShareSameTime,
    formatSessionsDetailLines,
    getMultiSessionFeedSortMs,
    getNextSessionStartMs,
    expandRecurringWeeklySessions,
    WEEKDAY_NAMES,
} from './event-sessions.js'
import { initDescriptionFormatToolbars, getRichTextFieldValue } from './description-format.js'
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore'

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
import { AdminDashboardMethods } from './admin-dashboard.js'
import { AdminEditMethods } from './admin-edit.js'
import { AdminBulletinWriteMethods } from './admin-bulletin-write.js'

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
            bulletinFormEl.addEventListener('click', (event) => {
                const button = event.target.closest('[data-attachment-action]');
                if (!button || !bulletinFormEl.contains(button)) return;

                const action = button.getAttribute('data-attachment-action');
                const slot = Number(button.getAttribute('data-slot') || 0);
                if (action === 'choose-action-link-pdf' && slot) {
                    document.getElementById(`resourceActionLink${slot}Pdf`)?.click();
                } else if (action === 'remove-action-link-pdf' && slot) {
                    this.removeActionLinkPdfPreview(slot);
                } else if (action === 'remove-image') {
                    this.removeImagePreview(button.getAttribute('data-field-name') || 'image');
                } else if (action === 'remove-pdf') {
                    this.removePdfPreview();
                } else if (action === 'remove-resource-pdf') {
                    this.removeResourcePdfPreview();
                }
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
        const eventDatesList = document.getElementById('eventDatesList');
        if (eventDatesList) {
            eventDatesList.addEventListener('click', (event) => {
                const button = event.target.closest('[data-event-date-action="remove"]');
                if (button && eventDatesList.contains(button)) {
                    this.removeEventDateRow(button);
                }
            });
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
        const runManageAction = (button) => {
            const action = button.getAttribute('data-manage-action');
            const username = button.getAttribute('data-username') || '';
            const bulletinId = button.getAttribute('data-bulletin-id') || '';
            if (action === 'edit-advisor' && username) {
                this.openEditAdvisor(username);
            } else if (action === 'delete-advisor' && username) {
                this.deleteAdvisor(username);
            } else if (action === 'edit-bulletin' && bulletinId) {
                this.editBulletin(bulletinId);
            } else if (action === 'delete-bulletin' && bulletinId) {
                this.deleteBulletin(bulletinId);
            }
        };
        ['advisorsList', 'manageBulletins'].forEach((id) => {
            const container = document.getElementById(id);
            if (!container) return;
            container.addEventListener('click', (event) => {
                const button = event.target.closest('[data-manage-action]');
                if (button && container.contains(button)) {
                    runManageAction(button);
                }
            });
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

    // Tab switching (showTab) and the dashboard overview
    // (getNextUpcomingEventOccurrence, getUpcomingEventBulletins,
    // updateAdvisorDashboard, renderUpcomingDashboardEvents) moved to
    // ./admin-dashboard.js (AdminDashboardMethods).

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
    // handleBulletinSubmit moved to ./admin-bulletin-write.js
    // (AdminBulletinWriteMethods).
    // handleImageUpload / handlePdfUpload moved to ./admin-uploads.js
    // (AdminUploadMethods, merged via applyMethods below).

    // deleteBulletin / showConfirmDialog / editBulletin moved to
    // ./admin-edit.js (AdminEditMethods).


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

    // getCompatibleDeadline moved to ./admin-bulletin-write.js.

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

    // createBulletin, updateHasPendingAssetUploads, updateBulletin,
    // buildBulletinObject, saveBulletin, resetForm moved to
    // ./admin-bulletin-write.js (AdminBulletinWriteMethods).


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
applyMethods(FirebaseAdminPanel, AdminDashboardMethods)
applyMethods(FirebaseAdminPanel, AdminEditMethods)
applyMethods(FirebaseAdminPanel, AdminBulletinWriteMethods)

// showTab / handleTabKeydown / toggleDateFields moved to
// ./admin-tab-globals.js — mountAdvisorPortal assigns them onto window for
// legacy generated handlers and existing admin portal integrations.

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
