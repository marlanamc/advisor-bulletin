// Image/PDF/action-link upload handling, validation, previews, and resource kind UI.
// Extracted verbatim from firebase-admin.js; methods are merged onto
// FirebaseAdminPanel.prototype by applyMethods() in firebase-admin.js.
import {
    isPdfFile,
} from './admin-shared.js'
import { auth, storage } from './firebase.js'
import { getResourceActionLinkFieldValues, MAX_RESOURCE_ACTION_LINKS, normalizeResourceActionLinks, parseResourceActionLinkSlotsFromForm, stripActionLinkUploadMeta } from './resource-action-links.js'
import { normalizeResourceKind, RESOURCE_KIND_DOCUMENT } from './resource-kinds.js'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

export class AdminAttachmentMethods {
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

            const { convertPdfFirstPageToImageFile } = await import('./pdf-flyer.js');
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


}
