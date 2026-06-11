// Composer form machinery: event date rows, composer mirror, content type, category pickers.
// Extracted verbatim from firebase-admin.js; methods are merged onto
// FirebaseAdminPanel.prototype by applyMethods() in firebase-admin.js.
import {
    ADMIN_RESOURCE_CATEGORIES,
    ADMIN_RESOURCE_CATEGORY_ICONS,
} from './admin-shared.js'
import { formatResourceServiceChipsInput, getSuggestedResourceChips, MAX_RESOURCE_SERVICE_CHIPS, parseResourceServiceChips } from './resource-chip-labels.js'
import { MAX_EVENT_SESSIONS, normalizeEventSessions, parseSessionEntry } from './event-sessions.js'
import { getRichTextFieldValue } from './description-format.js'

export class AdminComposerFormMethods {
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
        if (bulletin.hideFromMainFeed === true) return true;

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

}
