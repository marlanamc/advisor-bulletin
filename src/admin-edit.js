/**
 * Editing an existing bulletin (populate the composer from a saved doc) and
 * deleting one (with the inline confirm dialog).
 *
 * Extracted verbatim from firebase-admin.js (Stage 3 of the file-split
 * refactor); merged onto FirebaseAdminPanel.prototype by applyMethods().
 */
import { db } from './firebase.js'
import { doc, updateDoc } from 'firebase/firestore'
import { formatResourceServiceChipsInput } from './resource-chip-labels.js'
import { getResourceActionLinkFieldValues } from './resource-action-links.js'
import { normalizeResourceKind } from './resource-kinds.js'
import { refreshRichEditors } from './description-format.js'

export class AdminEditMethods {
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
}
