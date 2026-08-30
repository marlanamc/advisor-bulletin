/**
 * The advisor composer's Firestore write path: form submit, create, update,
 * the form-data -> bulletin-doc mapper, the size-guarded save, and the
 * post-submit form reset.
 *
 * Extracted verbatim from firebase-admin.js (Stage 3 of the file-split
 * refactor); merged onto FirebaseAdminPanel.prototype by applyMethods().
 * The many this.* helpers these call (buildBulletinObject aside) live on
 * other parts of the merged prototype.
 */
import { db } from './firebase.js'
import { collection, doc, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp } from 'firebase/firestore'
import { parseResourceServiceChips } from './resource-chip-labels.js'
import { parseResourceActionLinkSlotsFromForm, stripActionLinkUploadMeta } from './resource-action-links.js'
import { isDocumentResource, normalizeResourceKind, RESOURCE_KIND_DOCUMENT } from './resource-kinds.js'
import { sessionsFromFormData } from './event-sessions.js'
import { syncRichEditorsToForm, refreshRichEditors } from './description-format.js'
import { normalizeWebUrl } from './url-safety.js'
import { deleteResourceLogo } from './resource-logos.js'
import { toggleDateFields } from './admin-tab-globals.js'

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

export class AdminBulletinWriteMethods {
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
}
