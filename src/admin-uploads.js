/**
 * Image and PDF upload to Firebase Storage for the advisor composer.
 *
 * Merged onto FirebaseAdminPanel.prototype by applyMethods() in
 * firebase-admin.js. The image-processing helpers these
 * call (getImageFieldConfig, getFileSignature, prepareImageForUpload,
 * prepareFlyerSourceFile, saveBulletin, loadManageBulletins,
 * showTemporaryMessage) live on other parts of the merged prototype.
 */
import { db, auth, storage } from './firebase.js'
import { doc, updateDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { setResourceLogo } from './resource-logos.js'
import { isPdfFile } from './admin-shared.js'

export class AdminUploadMethods {
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

            if (fieldName === 'resourceLogo') {
                // Logos live in their own collection (see src/resource-logos.js),
                // not inline on the bulletin doc — handleImageUpload is only ever
                // called with an editingId for resourceLogo (the doc already
                // exists by this point in both create and update flows).
                await setResourceLogo(db, editingId, processedImage.dataUrl);
                await updateDoc(doc(db, 'bulletins', editingId), { hasResourceLogo: true });
                bulletin.resourceLogo = processedImage.dataUrl;
                bulletin.hasResourceLogo = true;
                if (this._resourceLogoMap) {
                    this._resourceLogoMap.set(editingId, processedImage.dataUrl);
                }
            } else if (editingId) {
                // Update the document with just the image field
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
}
