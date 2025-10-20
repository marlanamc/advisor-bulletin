// Firebase-enabled Admin Panel
class FirebaseAdminPanel {
    constructor() {
        this.currentUser = null;
        this.bulletins = [];
        this.pendingImageData = null;
        this.isSubmitting = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAutoLogin();
        this.setupRealtimeListener();
        this.setupOfflineHandling();
    }

    setupRealtimeListener() {
        db.collection('bulletins')
          .where('isActive', '==', true)
          .orderBy('datePosted', 'desc')
          .onSnapshot((snapshot) => {
            this.bulletins = [];
            snapshot.forEach((doc) => {
                this.bulletins.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
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
        // Login controls
        document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());

        // Add event listener to the close button in the login modal specifically
        const loginModalClose = document.querySelector('#loginModal .close');
        if (loginModalClose) {
            loginModalClose.addEventListener('click', () => this.hideLoginModal());
        }

        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Login form is handled by enhanced-auth.js
        // Listen for successful login from enhanced-auth
        document.addEventListener('userAuthenticated', (event) => {
            this.handleUserAuthenticated(event.detail);
        });

        // Bulletin form
        document.getElementById('bulletinForm').addEventListener('submit', (e) => this.handleBulletinSubmit(e));

        // Form validation
        this.setupFormValidation();

        // Image upload preview
        document.getElementById('image').addEventListener('change', (e) => this.handleImagePreview(e));
        
        // PDF upload preview
        document.getElementById('pdf').addEventListener('change', (e) => this.handlePdfPreview(e));

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('loginModal');
            if (e.target === modal) {
                this.hideLoginModal();
            }

            const previewModal = document.getElementById('previewModal');
            if (e.target === previewModal) {
                this.closePreview();
            }
        });
    }

    // Authentication Methods
    showLoginModal() {
        document.getElementById('loginModal').style.display = 'block';
    }

    hideLoginModal() {
        document.getElementById('loginModal').style.display = 'none';
    }

    handleUserAuthenticated(userDetails) {
        this.currentUser = {
            username: userDetails.username,
            email: userDetails.email,
            name: userDetails.name
        };

        this.showAdminPanel();
        this.hideLoginModal();
        this.clearLoginForm();
        this.loadManageBulletins();
    }

    getUserDisplayName(username) {
        const names = {
            'admin': 'Administrator',
            'jorge': 'Jorge',
            'fabiola': 'Fabiola',
            'leidy': 'Leidy',
            'carmen': 'Carmen',
            'jerome': 'Jerome',
            'felipe': 'Felipe',
            'simonetta': 'Simonetta',
            'mike': 'Mike K.',
            'leah': 'Leah'
        };
        return names[username] || username;
    }

    checkAutoLogin() {
        if (typeof auth === 'undefined') {
            console.error('Firebase auth not initialized');
            return;
        }
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                const username = user.email.split('@')[0];

                // Check if user needs to change password
                try {
                    const userDoc = await db.collection('users').doc(username).get();
                    if (userDoc.exists && userDoc.data().requirePasswordChange === true) {
                        // User needs to change password, show password change modal
                        if (window.enhancedAuth) {
                            window.enhancedAuth.showPasswordChangeModal(username);
                        }
                        return;
                    }
                } catch (error) {
                    console.error('Error checking user password status:', error);
                }

                this.currentUser = {
                    username: username,
                    email: user.email,
                    name: this.getUserDisplayName(username)
                };
                this.showAdminPanel();
                this.loadManageBulletins();
            } else {
                document.getElementById('loginRequired').style.display = 'block';
            }
        });
    }

    async logout() {
        try {
            if (typeof auth === 'undefined') {
                throw new Error('Firebase auth not initialized');
            }
            await auth.signOut();
            this.currentUser = null;
            this.hideAdminPanel();
            this.clearLoginForm();
            document.getElementById('loginRequired').style.display = 'block';
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    clearLoginForm() {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    showAdminPanel() {
        document.getElementById('loginRequired').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('welcomeMessage').textContent = `Welcome, ${this.currentUser.name}!`;

        // Set the advisor name dropdown based on logged-in user
        const advisorSelect = document.getElementById('advisorName');
        if ([...advisorSelect.options].some(option => option.value === this.currentUser.name)) {
            advisorSelect.value = this.currentUser.name;
        }
    }

    hideAdminPanel() {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
    }

    // Tab Management
    showTab(tabName) {
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
        const originalText = submitBtn.textContent;
        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;

        try {
            const formData = new FormData(e.target);

            if (this.isEditMode && this.editingBulletinId) {
                await this.updateBulletin(formData, this.editingBulletinId);
            } else {
                await this.createBulletin(formData);
            }

            // Reset form after successful submission
            this.resetForm();

            this.showTemporaryMessage(this.isEditMode ? 'Bulletin updated successfully!' : 'Bulletin posted successfully!', 'success');
        } catch (error) {
            if (error && error.code === 'user-cancelled') {
                this.showTemporaryMessage('Post cancelled. You can review the content and try again.', 'info');
                throw error;
                
            }
            console.error('Error submitting bulletin:', error);
            let errorMessage = 'Error posting bulletin. Please try again.';

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
            submitBtn.textContent = originalText;
            this.isSubmitting = false;
        }
    }

    async handleImageUpload(file, bulletin, pdfFile = null, editingId = null) {
        try {
            const signature = this.getFileSignature(file);
            let processedImage = null;
            let usedCachedImage = false;

            if (this.pendingImageData && this.pendingImageData.signature === signature) {
                processedImage = this.pendingImageData;
                usedCachedImage = true;
            } else {
                processedImage = await this.prepareImageForUpload(file);
            }

            // Ensure final encoded image is within safety limits (~4MB)
            if (processedImage.finalBytes > 4 * 1024 * 1024) {
                throw 'Optimized image is still larger than 4MB. Please upload a smaller image.';
            }

            bulletin.image = processedImage.dataUrl;

            // Handle PDF upload if provided
            if (pdfFile && pdfFile.size > 0) {
                await this.handlePdfUpload(pdfFile, bulletin, editingId);
            } else {
                await this.saveBulletin(bulletin, editingId);
            }

            if (processedImage.infoMessage && !usedCachedImage) {
                this.showTemporaryMessage(processedImage.infoMessage, 'info');
            }
        } catch (error) {
            console.error('Image processing error:', error);
            const message = typeof error === 'string'
                ? error
                : 'Image upload failed. Please try uploading a JPG/PNG under 10MB.';
            this.showTemporaryMessage(message, 'error');
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

            console.log('Uploading PDF to Firebase Storage...');
            this.showTemporaryMessage('Uploading PDF...', 'info');
            
            // Generate unique filename
            const timestamp = Date.now();
            const filename = `pdfs/${bulletin.id || 'temp'}_${timestamp}.pdf`;
            
            // Create storage reference
            const storageRef = firebase.storage().ref().child(filename);
            
            // Upload file to Firebase Storage with progress tracking
            const uploadTask = storageRef.put(file);
            
            // Track upload progress
            uploadTask.on('state_changed', 
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload progress: ${progress.toFixed(1)}%`);
                },
                (error) => {
                    console.error('Upload error:', error);
                    throw error;
                }
            );
            
            // Wait for upload to complete
            const snapshot = await uploadTask;
            console.log('PDF upload completed:', snapshot.metadata.name);
            
            // Get download URL
            const downloadUrl = await snapshot.ref.getDownloadURL();
            console.log('PDF download URL:', downloadUrl);
            
            // Store the download URL instead of base64 data
            bulletin.pdfUrl = downloadUrl;

            await this.saveBulletin(bulletin, editingId);
            this.showTemporaryMessage('PDF uploaded successfully!', 'success');
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
        }
    }

    async handleImagePreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');

        if (file) {
            // Comprehensive image validation
            const validation = this.validateImageFile(file);

            if (!validation.isValid) {
                this.showTemporaryMessage(validation.error, 'error');
                e.target.value = '';
                preview.innerHTML = '';
                this.pendingImageData = null;
                return;
            }

            // Show warnings if any
            if (validation.warnings.length > 0) {
                validation.warnings.forEach(warning => {
                    this.showTemporaryMessage(warning, 'warning');
                });
            }

            try {
                const processed = await this.prepareImageForUpload(file);
                const signature = this.getFileSignature(file);

                this.pendingImageData = {
                    ...processed,
                    signature
                };

                const sizeWarning = this.getImageSizeRecommendation(processed.width, processed.height, processed.finalBytes);

                preview.innerHTML = `
                    <div class="preview-container">
                        <img src="${processed.dataUrl}" alt="Preview" class="preview-image">
                        <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview()" aria-label="Remove image">&times;</button>
                        <div class="image-info">
                            <small>${processed.width} × ${processed.height} pixels</small>
                            <small>${this.formatFileSize(processed.finalBytes)}</small>
                            ${sizeWarning ? `<small class="size-warning">${sizeWarning}</small>` : ''}
                        </div>
                    </div>
                `;

                if (processed.infoMessage) {
                    this.showTemporaryMessage(processed.infoMessage, 'info');
                } else if (sizeWarning) {
                    this.showTemporaryMessage(sizeWarning, 'info');
                }
            } catch (error) {
                console.error('Image preview error:', error);
                this.showTemporaryMessage('Could not process this image. Please try a smaller JPG or PNG.', 'error');
                e.target.value = '';
                preview.innerHTML = '';
                this.pendingImageData = null;
            }
        } else {
            preview.innerHTML = '';
            this.pendingImageData = null;
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

    removeImagePreview() {
        document.getElementById('image').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        this.pendingImageData = null;
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


    async deleteBulletin(bulletinId, buttonElement = null) {
        if (confirm('Are you sure you want to delete this bulletin?')) {
            try {
                await db.collection('bulletins').doc(bulletinId).update({
                    isActive: false
                });
                this.showSuccessMessage('Bulletin deleted successfully!');
            } catch (error) {
                console.error('Error deleting bulletin:', error);
                const message = this.getFirestoreErrorMessage(error, 'delete this bulletin');
                this.showTemporaryMessage(message, 'error');
            }
        }
    }

    editBulletin(bulletinId) {
        const bulletin = this.bulletins.find(b => b.id === bulletinId);
        if (!bulletin) {
            alert('Bulletin not found');
            return;
        }

        // Switch to post tab
        this.showTab('post');

        // Set edit mode
        this.isEditMode = true;
        this.editingBulletinId = bulletinId;

        // Update form title and button text
        document.querySelector('.post-form-container h4').textContent = 'Edit Bulletin';
        document.getElementById('postBulletinBtn').textContent = 'Update Bulletin';

        // Populate form with existing data
        document.getElementById('title').value = bulletin.title;
        document.getElementById('category').value = bulletin.category;
        document.getElementById('description').value = bulletin.description;
        document.getElementById('company').value = bulletin.company || '';
        document.getElementById('contact').value = bulletin.contact || '';
        // Handle new date fields
        if (bulletin.dateType) {
            document.getElementById('dateType').value = bulletin.dateType;
            toggleDateFields(); // This function should be available globally

            if (bulletin.dateType === 'deadline' || bulletin.dateType === 'event') {
                document.getElementById('eventDate').value = bulletin.eventDate || '';
            } else if (bulletin.dateType === 'range') {
                document.getElementById('startDate').value = bulletin.startDate || '';
                document.getElementById('endDate').value = bulletin.endDate || '';
            }
        } else {
            // Backward compatibility - convert old deadline to new format
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

        // Show image if exists
        if (bulletin.image) {
            document.getElementById('imagePreview').innerHTML = `
                <div class="preview-container">
                    <img src="${bulletin.image}" alt="Preview" class="preview-image">
                    <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview()">&times;</button>
                </div>
            `;
        }

        // Store the bulletin ID for updating
        document.getElementById('bulletinForm').dataset.editingId = bulletinId;

        // Change submit button text
        const submitBtn = document.querySelector('#bulletinForm button[type="submit"]');
        submitBtn.textContent = 'Update Bulletin';
    }

    canManageAllPosts() {
        return this.currentUser && ['admin', 'leah'].includes(this.currentUser.username);
    }

    loadManageBulletins() {
        const container = document.getElementById('manageBulletins');
        const userBulletins = this.bulletins
            .filter(b => (this.canManageAllPosts() || b.postedBy === this.currentUser.username) && b.isActive)
            .sort((a, b) => {
                const aDate = a.datePosted
                    ? (a.datePosted.toDate ? a.datePosted.toDate() : new Date(a.datePosted))
                    : new Date();
                const bDate = b.datePosted
                    ? (b.datePosted.toDate ? b.datePosted.toDate() : new Date(b.datePosted))
                    : new Date();
                return bDate - aDate;
            });

        if (userBulletins.length === 0) {
            container.innerHTML = this.canManageAllPosts()
                ? '<p>There are no active bulletins to manage right now.</p>'
                : '<p>You haven\'t posted any bulletins yet.</p>';
            return;
        }

        container.innerHTML = userBulletins.map(bulletin => `
            <div class="manage-card">
                <h5>${this.escapeHtml(bulletin.title)}</h5>
                <p><strong>Category:</strong> ${this.getCategoryDisplay(bulletin.category)}</p>
                ${this.canManageAllPosts() && bulletin.postedBy !== this.currentUser.username ? `
                    <p><strong>Advisor:</strong> ${this.escapeHtml(bulletin.advisorName)} (${this.escapeHtml(bulletin.postedBy)})</p>
                ` : ''}
                <p><strong>Posted:</strong> ${bulletin.datePosted
                    ? new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString()
                    : 'Unknown'}</p>
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
        `).join('');
    }

    // Preview functionality
    previewBulletin() {
        const title = document.getElementById('title').value;
        const category = document.getElementById('category').value;
        const description = document.getElementById('description').value;
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
            alert('Please fill in all required fields before previewing.');
            return;
        }

        const bulletin = {
            title,
            category,
            description,
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
            pdfUrl: document.getElementById('pdfPreview').querySelector('.pdf-preview-container') ? 'preview-pdf' : null
        };

        this.showPreview(bulletin);
    }

    showPreview(bulletin) {
        const previewContent = document.getElementById('previewContent');
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const descriptionHtml = this.renderPreviewDescription(bulletin.description || '');

        previewContent.innerHTML = `
            <div class="bulletin-card">
                <div class="bulletin-header">
                    <div>
                        <div class="bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                    </div>
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                </div>

                ${bulletin.image ? `
                    <div class="bulletin-image">
                        <img src="${bulletin.image}" alt="Bulletin image" class="card-image">
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
        } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
            html += `<div class="meta-item"><strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}</div>`;
        }

        // Add time range if specified
        if ((bulletin.startTime || bulletin.endTime) && (dateType === 'event' || dateType === 'range')) {
            const timeRange = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            if (timeRange) {
                html += `<div class="meta-item"><strong>Time:</strong> ${timeRange}</div>`;
            }
        }

        // Add event location/format if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
            const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                               bulletin.eventLocation === 'online' ? 'Online' :
                               bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
            html += `<div class="meta-item"><strong>Format:</strong> ${locationText}</div>`;
        }

        return html;
    }

    // Utility Methods
    getCategoryDisplay(category) {
        const categories = {
            'job': 'Job Opportunity',
            'training': 'Training',
            'college': 'College/University',
            'classtype': 'Class Type',
            'announcement': 'Announcement',
            'resource': 'Resource'
        };
        return categories[category] || category;
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
        bulletin.datePosted = firebase.firestore.FieldValue.serverTimestamp();

        // Handle file uploads (image and PDF)
        const imageFile = formData.get('image');
        const pdfFile = formData.get('pdf');
        
        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile);
        } else if (pdfFile && pdfFile.size > 0) {
            await this.handlePdfUpload(pdfFile, bulletin);
        } else {
            // Only save if there are no files (file upload handlers save it)
            await this.saveBulletin(bulletin);
        }
    }

    async updateBulletin(formData, bulletinId) {
        const bulletin = this.buildBulletinObject(formData);

        // Preserve existing data
        const existingBulletin = this.bulletins.find(b => b.id === bulletinId);
        if (existingBulletin) {
            bulletin.postedBy = existingBulletin.postedBy;
            bulletin.datePosted = existingBulletin.datePosted;
            bulletin.image = existingBulletin.image; // Preserve existing image unless replaced
            bulletin.pdfUrl = existingBulletin.pdfUrl; // Preserve existing PDF unless replaced
        }

        // Handle file uploads (image and PDF)
        const imageFile = formData.get('image');
        const pdfFile = formData.get('pdf');
        
        if (imageFile && imageFile.size > 0) {
            await this.handleImageUpload(imageFile, bulletin, pdfFile, bulletinId);
        } else if (pdfFile && pdfFile.size > 0) {
            await this.handlePdfUpload(pdfFile, bulletin, bulletinId);
        } else {
            // Only save if there are no files (file upload handlers save it)
            await this.saveBulletin(bulletin, bulletinId);
        }
    }

    buildBulletinObject(formData) {
        const bulletin = {
            title: formData.get('title'),
            category: formData.get('category'),
            description: formData.get('description'),
            company: (formData.get('company') || '').trim(),
            contact: (formData.get('contact') || '').trim(),
            dateType: formData.get('dateType') || '',
            eventDate: formData.get('eventDate') || '',
            startDate: formData.get('startDate') || '',
            endDate: formData.get('endDate') || '',
            deadline: this.getCompatibleDeadline(formData),
            startTime: formData.get('startTime') || '',
            endTime: formData.get('endTime') || '',
            eventLocation: formData.get('eventLocation') || '',
            eventLink: (formData.get('eventLink') || '').trim(),
            classType: formData.get('classType') || '',
            advisorName: formData.get('advisorName'),
            isActive: true,
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
            // Debug: Log what we're sending
            console.log('Attempting to save bulletin:', JSON.stringify(bulletin, null, 2));

            if (editingId) {
                await db.collection('bulletins').doc(editingId).update(bulletin);
            } else {
                await db.collection('bulletins').add(bulletin);
            }

            // Note: Don't reset form here - let the caller handle that
            // Reload bulletins to show updated data
            this.loadManageBulletins();
        } catch (error) {
            console.error('Error saving bulletin:', error);
            console.error('Failed bulletin data:', bulletin);
            throw error;
        }
    }

    resetForm() {
        // Reset edit mode
        this.isEditMode = false;
        this.editingBulletinId = null;

        // Reset form title and button
        document.querySelector('.post-form-container h4').textContent = 'Create New Bulletin';
        document.getElementById('postBulletinBtn').textContent = 'Post Bulletin';

        // Clear form
        document.getElementById('bulletinForm').reset();

        // Clear image preview and cached data
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) imagePreview.innerHTML = '';
        this.pendingImageData = null;

        // Reset advisor name dropdown to current user
        const advisorSelect = document.getElementById('advisorName');
        if (advisorSelect && this.currentUser && [...advisorSelect.options].some(option => option.value === this.currentUser.name)) {
            advisorSelect.value = this.currentUser.name;
        }

        // Reset date fields
        document.getElementById('dateType').value = '';
        toggleDateFields();

        // Switch back to manage tab
        this.showTab('manage');
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

            return html;
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

function previewBulletin() {
    if (window.adminPanel) {
        window.adminPanel.previewBulletin();
    } else {
        console.error('Admin panel not initialized yet');
        alert('Please wait for the page to fully load before previewing.');
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
    const eventDateInput = document.getElementById('eventDate');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Hide all date fields initially
    dateFields.style.display = 'none';
    singleDateGroup.style.display = 'none';
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';

    // Remove required attribute from all date fields first
    if (eventDateInput) eventDateInput.required = false;
    if (startDateInput) startDateInput.required = false;
    if (endDateInput) endDateInput.required = false;

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
    } else if (dateType === 'range') {
        dateFields.style.display = 'flex';
        startDateGroup.style.display = 'block';
        endDateGroup.style.display = 'block';
        if (startDateInput) startDateInput.required = true;
        if (endDateInput) endDateInput.required = true;
    }
}

// Initialize the admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new FirebaseAdminPanel();
    // Expose for global access after initialization
    window.adminPanel = adminPanel;
});
