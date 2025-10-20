// EBHCS Advisor Bulletin Board System
class BulletinBoard {
    constructor() {
        this.currentUser = null;
        this.bulletins = this.loadBulletins();
        this.init();
    }

    init() {
        this.currentView = 'gallery'; // Set default view
        this.bindEvents();
        this.displayBulletins();
        this.checkAutoLogin();
        this.updateNotificationButton();
        this.checkForNewBulletins();
        this.checkFirstTimeUser();
        this.ensureModalsHidden(); // Ensure all modals start hidden
        
        // Initialize form enhancements if on admin page
        if (window.location.pathname.includes('admin')) {
            setTimeout(() => {
                initializeFormEnhancements();
            }, 500);
        }
        
        console.log('BulletinBoard initialized, current view:', this.currentView);
    }

    ensureModalsHidden() {
        // Ensure all modals start hidden
        const modals = [
            'loginModal',
            'bulletinDetailModal',
            'notificationModal',
            'helpModal',
            'passwordChangeModal',
            'forgotPasswordModal',
            'previewModal'
        ];

        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                console.log(`✅ Modal ${modalId} hidden on init`);
            }
        });
    }

    bindEvents() {
        // Modal controls - only bind if elements exist (admin page only)
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.showLoginModal());
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideLoginModal());
        }

        // Login form - only bind if element exists
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Bulletin form - only bind if element exists
        const bulletinForm = document.getElementById('bulletinForm');
        if (bulletinForm) {
            bulletinForm.addEventListener('submit', (e) => this.handleBulletinSubmit(e));
        }

        // Image upload preview - only bind if element exists
        const imageInput = document.getElementById('image');
        if (imageInput) {
            imageInput.addEventListener('change', (e) => this.handleImagePreview(e));
        }

        // PDF upload preview - only bind if element exists
        const pdfInput = document.getElementById('pdf');
        if (pdfInput) {
            pdfInput.addEventListener('change', (e) => this.handlePdfPreview(e));
        }

        // Filter and search controls
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('searchBtn').addEventListener('click', () => this.applyFilters());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());
        
        // Toggle filters button
        const toggleFiltersBtn = document.getElementById('toggleFilters');
        console.log('🔧 Toggle filters button found:', toggleFiltersBtn);
        if (toggleFiltersBtn) {
            // Test if button is clickable
            toggleFiltersBtn.style.background = 'red'; // Temporary visual test
            setTimeout(() => {
                toggleFiltersBtn.style.background = '';
            }, 2000);
            
            toggleFiltersBtn.addEventListener('click', (e) => {
                console.log('🔧 Button clicked!', e);
                alert('Filters button clicked!'); // Temporary alert for testing
                this.toggleFiltersPanel();
            });
            console.log('✅ Toggle filters event listener added');
        } else {
            console.error('❌ Toggle filters button not found during initialization');
        }

        // Multi-select filter chips
        this.selectedCategories = [];
        this.selectedPostedDates = [];
        this.selectedDeadlines = [];
        this.selectedClassTypes = [];

        // Bind filter chip events
        document.querySelectorAll('.filter-chip[data-category]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'category'));
        });

        document.querySelectorAll('.filter-chip[data-posted]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'posted'));
        });

        document.querySelectorAll('.filter-chip[data-deadline]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'deadline'));
        });

        document.querySelectorAll('.filter-chip[data-classtype]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'classtype'));
        });

        // View toggle controls
        const galleryBtn = document.getElementById('galleryViewBtn');
        const calendarBtn = document.getElementById('calendarViewBtn');

        console.log('View buttons found:', { galleryBtn: !!galleryBtn, calendarBtn: !!calendarBtn });

        if (galleryBtn) galleryBtn.addEventListener('click', () => this.switchView('gallery'));
        if (calendarBtn) calendarBtn.addEventListener('click', () => this.switchView('calendar'));

        // Show expired toggle
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        if (showExpiredToggle) {
            this.showExpired = false;
            showExpiredToggle.addEventListener('change', (e) => {
                this.showExpired = e.target.checked;
                this.applyFilters();
            });
        }

        // Notification controls (optional)
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => this.showNotificationModal());
        }

        const closeNotificationModal = document.getElementById('closeNotificationModal');
        if (closeNotificationModal) {
            closeNotificationModal.addEventListener('click', () => this.hideNotificationModal());
        }

        const notificationForm = document.getElementById('notificationForm');
        if (notificationForm) {
            notificationForm.addEventListener('submit', (e) => this.handleNotificationSubmit(e));
        }

        const testNotificationBtn = document.getElementById('testNotification');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', () => this.testNotification());
        }

        // Help tutorial controls (optional)
        const helpBtn = document.getElementById('helpBtn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => this.showHelpModal());
        }

        const closeHelpModal = document.getElementById('closeHelpModal');
        if (closeHelpModal) {
            closeHelpModal.addEventListener('click', () => this.hideHelpModal());
        }

        const nextStepBtn = document.getElementById('nextStep');
        if (nextStepBtn) {
            nextStepBtn.addEventListener('click', () => this.nextTutorialStep());
        }

        const prevStepBtn = document.getElementById('prevStep');
        if (prevStepBtn) {
            prevStepBtn.addEventListener('click', () => this.prevTutorialStep());
        }

        const skipTutorialBtn = document.getElementById('skipTutorial');
        if (skipTutorialBtn) {
            skipTutorialBtn.addEventListener('click', () => this.skipTutorial());
        }

        const restartTutorialBtn = document.getElementById('restartTutorial');
        if (restartTutorialBtn) {
            restartTutorialBtn.addEventListener('click', () => this.restartTutorial());
        }

        // Bulletin detail modal close button
        const closeBulletinDetail = document.getElementById('closeBulletinDetail');
        if (closeBulletinDetail) {
            closeBulletinDetail.addEventListener('click', () => {
                const modal = document.getElementById('bulletinDetailModal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        }


        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            const loginModal = document.getElementById('loginModal');
            const notificationModal = document.getElementById('notificationModal');
            const helpModal = document.getElementById('helpModal');
            const bulletinDetailModal = document.getElementById('bulletinDetailModal');
            
            if (loginModal && e.target === loginModal) {
                this.hideLoginModal();
            }
            if (notificationModal && e.target === notificationModal) {
                this.hideNotificationModal();
            }
            if (helpModal && e.target === helpModal) {
                this.hideHelpModal();
            }
            if (bulletinDetailModal && e.target === bulletinDetailModal) {
                this.hideBulletinDetail();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideLoginModal();
                this.hideBulletinDetail();
                this.hideNotificationModal();
                this.hideHelpModal();
            }
        });
    }

    // Authentication Methods
    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    hideLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    showBulletinDetail(bulletinId) {
        console.log('🔍 showBulletinDetail called with ID:', bulletinId);

        const bulletin = this.bulletins.find(b => b.id === bulletinId);
        if (!bulletin) {
            console.warn('❌ Bulletin not found with ID:', bulletinId);
            return;
        }

        const modal = document.getElementById('bulletinDetailModal');
        const content = document.getElementById('bulletinDetailBody');

        if (modal && content) {
            console.log('✅ Showing bulletin detail modal for:', bulletin.title);
            content.innerHTML = this.createBulletinDetailContent(bulletin);
            modal.style.display = 'block';
            modal.setAttribute('aria-hidden', 'false');
        } else {
            console.error('❌ Bulletin detail modal elements not found');
        }
    }

    hideBulletinDetail() {
        const modal = document.getElementById('bulletinDetailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    createBulletinDetailContent(bulletin) {
        const postedDate = new Date(bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);

        return `
            <div class="bulletin-detail-header">
                <h2>${this.escapeHtml(bulletin.title)}</h2>
                <span class="category-badge category-${bulletin.category}">
                    ${this.getCategoryDisplay(bulletin.category)}
                </span>
            </div>

            ${bulletin.image ? `
                <div class="bulletin-detail-image">
                    <img src="${bulletin.image}" alt="Bulletin image" class="detail-image">
                </div>
            ` : ''}

            <div class="bulletin-detail-description">
                ${this.escapeHtml(bulletin.description).replace(/\n/g, '<br>')}
            </div>

            <div class="bulletin-detail-meta">
                ${bulletin.company ? `
                    <div class="detail-meta-item">
                        <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                    </div>
                ` : ''}

                ${bulletin.classType ? `
                    <div class="detail-meta-item">
                        <strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}
                    </div>
                ` : ''}

                ${bulletin.contact ? `
                    <div class="detail-meta-item">
                        <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}
                    </div>
                ` : ''}

                ${bulletin.deadline ? `
                    <div class="detail-meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                        <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                        ${isDeadlineClose ? ' (Soon!)' : ''}
                    </div>
                ` : ''}

                <div class="detail-meta-item">
                    <strong>Posted:</strong> ${postedDate}
                </div>

                <div class="detail-meta-item">
                    <strong>Posted by:</strong> ${this.escapeHtml(bulletin.advisorName)}
                </div>
            </div>

            <div class="bulletin-detail-actions">
                ${bulletin.pdf ? `
                    <a href="${bulletin.pdf}" download="${bulletin.pdfName || 'bulletin.pdf'}" class="pdf-btn" title="Download PDF" style="margin-right: 10px;">
                        📄 Download PDF
                    </a>
                ` : ''}
                <button class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">
                    📤 Share This Opportunity
                </button>
            </div>
        `;
    }

    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Clear any previous messages
        const errorDiv = document.getElementById('loginError');
        const successDiv = document.getElementById('loginSuccess');
        if (errorDiv) errorDiv.style.display = 'none';
        if (successDiv) successDiv.style.display = 'none';

        // Basic validation
        if (!username || !password) {
            this.showError('loginError', 'Please enter both username and password.');
        return;
        }

        // For demo purposes, accept any username/password combination
        // In production, this would be replaced with Firebase Authentication
        const validCredentials = {
            'admin': 'admin123',
            'jorge': 'jorge123',
            'fabiola': 'fabiola123',
            'leidy': 'leidy123',
            'carmen': 'carmen123',
            'jerome': 'jerome123',
            'felipe': 'felipe123',
            'simonetta': 'simonetta123',
            'mike': 'mike123',
            'leah': 'leah123',
            'marlie': 'marlie123'
        };

        if (validCredentials[username] && validCredentials[username] === password) {
            // Login successful
            this.currentUser = {
                username: username,
                name: this.getUserDisplayName(username),
                email: `${username}@ebhcs.org`
            };

            // Save to localStorage for persistence
            localStorage.setItem('ebhcs_current_user', JSON.stringify(this.currentUser));

            // Hide login modal
            this.hideLoginModal();

            // Update UI
            this.updateLoginUI();

            // Show success message
            this.showSuccessMessage(`Welcome, ${this.currentUser.name}! You are now logged in.`);

            // If on admin page, show admin panel
            if (window.location.pathname.includes('admin')) {
                this.showAdminPanel();
                this.loadManageBulletins();
            }
        } else {
            // Login failed
            this.showError('loginError', 'Invalid username or password. Please try again.');
        }
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
            'leah': 'Leah',
            'marlie': 'Marlie'
        };
        return names[username] || username;
    }

    showError(elementId, message) {
        const errorDiv = document.getElementById(elementId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    checkAutoLogin() {
        const savedUser = localStorage.getItem('ebhcs_current_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateLoginUI();
        }
    }

    updateLoginUI() {
        const logoutBtn = document.getElementById('logoutBtn');

        if (this.currentUser) {
            // User is logged in
            if (logoutBtn) {
                logoutBtn.style.display = 'inline-flex';
                logoutBtn.textContent = `Logout (${this.currentUser.name})`;
            }

            // If on admin page, show admin panel
            if (window.location.pathname.includes('admin')) {
            this.showAdminPanel();
            this.loadManageBulletins();
            }
        } else {
            // User is not logged in
            if (logoutBtn) logoutBtn.style.display = 'none';
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('ebhcs_current_user');
        this.hideAdminPanel();
        this.clearLoginForm();
        this.updateLoginUI(); // Update UI after logout
    }

    clearLoginForm() {
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }

    showAdminPanel() {
        // If on admin page, show the admin panel
        if (window.location.pathname.includes('admin')) {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel) adminPanel.style.display = 'block';
        }

        // Set the advisor name dropdown based on logged-in user (only on admin page)
        if (window.location.pathname.includes('admin')) {
        const advisorSelect = document.getElementById('advisorName');
            if (advisorSelect) {
        const userNameMap = {
            'marlie': 'Marlie Creed',
            'admin': 'Administrator',
            'advisor1': 'Simonetta (Advisor)'
        };

        const defaultName = userNameMap[this.currentUser.username] || this.currentUser.name;
        if ([...advisorSelect.options].some(option => option.value === defaultName)) {
            advisorSelect.value = defaultName;
                }
            }
        }
    }

    hideAdminPanel() {
        // If on admin page, hide the admin panel
        if (window.location.pathname.includes('admin')) {
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel) adminPanel.style.display = 'none';
        }
    }

    // Tab Management
    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

        // Show selected tab
        document.getElementById(tabName + 'Tab').classList.add('active');
        event.target.classList.add('active');

        if (tabName === 'manage') {
            this.loadManageBulletins();
        }
    }

    // Bulletin Management
    handleBulletinSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const editingId = e.target.dataset.editingId;

        let bulletin;
        if (editingId) {
            // Editing existing bulletin
            bulletin = this.bulletins.find(b => b.id === editingId);
            if (!bulletin) {
                alert('Bulletin not found!');
                return;
            }

            // Update fields
            bulletin.title = formData.get('title');
            bulletin.category = formData.get('category');
            bulletin.description = formData.get('description');
            bulletin.company = formData.get('company') || '';
            bulletin.contact = formData.get('contact') || '';
            bulletin.deadline = formData.get('deadline') || '';
            bulletin.advisorName = formData.get('advisorName');
            if (formData.get('classType')) {
                bulletin.classType = formData.get('classType');
            }
        } else {
            // Creating new bulletin
            bulletin = {
                id: Date.now().toString(),
                title: formData.get('title'),
                category: formData.get('category'),
                description: formData.get('description'),
                company: formData.get('company') || '',
                contact: formData.get('contact') || '',
                deadline: formData.get('deadline') || '',
                advisorName: formData.get('advisorName'),
                postedBy: this.currentUser.username,
                datePosted: new Date().toISOString(),
                isActive: true,
                image: null,
                pdf: null
            };

            if (formData.get('classType')) {
                bulletin.classType = formData.get('classType');
            }
        }

        // Handle image upload
        const imageFile = formData.get('image');
        const pdfFile = formData.get('pdf');

        if (imageFile && imageFile.size > 0) {
            this.handleImageUpload(imageFile, bulletin, pdfFile, editingId);
        } else if (pdfFile && pdfFile.size > 0) {
            this.handlePdfUpload(pdfFile, bulletin, editingId);
        } else {
            this.saveBulletin(bulletin, editingId);
        }
    }

    handleImageUpload(file, bulletin, pdfFile = null, editingId = null) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image file too large. Please select an image under 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            bulletin.image = e.target.result;

            // Also handle PDF if present
            if (pdfFile && pdfFile.size > 0) {
                this.handlePdfUpload(pdfFile, bulletin, editingId);
            } else {
                this.saveBulletin(bulletin, editingId);
            }
        };
        reader.readAsDataURL(file);
    }

    handlePdfUpload(file, bulletin, editingId = null) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('PDF file too large. Please select a PDF under 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            bulletin.pdf = e.target.result;
            bulletin.pdfName = file.name;
            this.saveBulletin(bulletin, editingId);
        };
        reader.readAsDataURL(file);
    }

    handleImagePreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('imagePreview');

        if (file) {
            // Check file size
            if (file.size > 5 * 1024 * 1024) {
                alert('Image file too large. Please select an image under 5MB.');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="preview-container">
                        <img src="${e.target.result}" alt="Preview" class="preview-image">
                        <button type="button" class="remove-image" onclick="bulletinBoard.removeImagePreview()">&times;</button>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    }

    removeImagePreview() {
        document.getElementById('image').value = '';
        document.getElementById('imagePreview').innerHTML = '';
    }

    handlePdfPreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('pdfPreview');

        if (file) {
            // Check file size
            if (file.size > 10 * 1024 * 1024) {
                alert('PDF file too large. Please select a PDF under 10MB.');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            preview.innerHTML = `
                <div class="preview-container pdf-preview-container">
                    <div class="pdf-info">
                        <span class="pdf-icon">📄</span>
                        <div class="pdf-details">
                            <strong>${file.name}</strong>
                            <small>${fileSizeMB} MB</small>
                        </div>
                    </div>
                    <button type="button" class="remove-pdf" onclick="bulletinBoard.removePdfPreview()">&times;</button>
                </div>
            `;
        } else {
            preview.innerHTML = '';
        }
    }

    removePdfPreview() {
        document.getElementById('pdf').value = '';
        document.getElementById('pdfPreview').innerHTML = '';
    }

    saveBulletin(bulletin, editingId = null) {
        if (editingId) {
            // Update existing bulletin
            const index = this.bulletins.findIndex(b => b.id === editingId);
            if (index !== -1) {
                this.bulletins[index] = bulletin;
            }
            this.saveBulletins();
            this.displayBulletins();
            this.showSuccessMessage('Bulletin updated successfully!');
            showFormSuccess('Your bulletin has been updated successfully!');
        } else {
            // Create new bulletin
            this.bulletins.unshift(bulletin);
            this.saveBulletins();
            this.displayBulletins();
            this.showSuccessMessage('Bulletin posted successfully!');
            showFormSuccess('Your bulletin has been posted successfully! Students can now see it on the main page.');
        }

        // Clear form
        const form = document.getElementById('bulletinForm');
        if (form) {
            delete form.dataset.editingId;

            // Reset button text
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Post Bulletin';
            }

            form.reset();
            
            // Reset form progress
            const formProgress = document.getElementById('formProgress');
            if (formProgress) formProgress.style.display = 'none';
            
            // Reset section completion status
            const sections = document.querySelectorAll('.form-section');
            sections.forEach(section => section.classList.remove('completed'));
            
            // Reset field validation states
            const formGroups = form.querySelectorAll('.form-group');
            formGroups.forEach(group => {
                group.classList.remove('valid', 'invalid');
                const feedback = group.querySelector('.field-feedback');
                if (feedback) {
                    feedback.className = 'field-feedback';
                    feedback.textContent = '';
                }
            });
        }
        
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) imagePreview.innerHTML = '';

        // Reset advisor name dropdown
        const advisorSelect = document.getElementById('advisorName');
        if (advisorSelect) {
            const userNameMap = {
                'marlie': 'Marlie Creed',
                'admin': 'Administrator',
                'advisor1': 'Simonetta (Advisor)'
            };

            const defaultName = userNameMap[this.currentUser.username] || this.currentUser.name;
            if ([...advisorSelect.options].some(option => option.value === defaultName)) {
                advisorSelect.value = defaultName;
            }
        }
    }

    deleteBulletin(bulletinId) {
        if (confirm('Are you sure you want to delete this bulletin?')) {
            this.bulletins = this.bulletins.filter(b => b.id !== bulletinId);
            this.saveBulletins();
            this.displayBulletins();
            this.loadManageBulletins();
            this.showSuccessMessage('Bulletin deleted successfully!');
        }
    }

    // View Management Methods
    switchView(view) {
        console.log('Switching to view:', view);
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const targetButton = document.querySelector(`[data-view="${view}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
            console.log('Activated button for view:', view);
        } else {
            console.error('Button not found for view:', view);
        }

        // Update current view
        this.currentView = view;

        // Display bulletins in the selected view
        this.displayBulletins();
    }

    // Display Methods
    displayBulletins(filteredBulletins = null) {
        console.log('📋 displayBulletins called with:', filteredBulletins ? filteredBulletins.length : 'null', 'filtered bulletins');
        console.log('📋 Total bulletins in memory:', this.bulletins.length);
        console.log('📋 Active bulletins:', this.bulletins.filter(b => b.isActive).length);

        // Hide all views first
        document.querySelectorAll('.bulletin-view').forEach(view => {
            view.classList.remove('active');
            console.log('🔍 Hiding view:', view.id);
        });

        // Use filtered bulletins if provided, otherwise show all active bulletins
        let bulletinsToShow = filteredBulletins || this.bulletins
            .filter(b => b.isActive)
            .sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));

        console.log('📋 Bulletins to show after filtering:', bulletinsToShow.length);
        console.log('📋 All bulletin details:', this.bulletins.map(b => ({
            title: b.title,
            isActive: b.isActive,
            datePosted: b.datePosted,
            category: b.category
        })));

        // Update results info
        const resultsInfo = document.getElementById('resultsInfo');
        const totalBulletins = this.bulletins.filter(b => b.isActive).length;
        const shownBulletins = bulletinsToShow.length;

        if (filteredBulletins) {
            resultsInfo.textContent = `Showing ${shownBulletins} of ${totalBulletins} bulletins`;
            resultsInfo.style.display = 'block';
        } else {
            resultsInfo.style.display = 'none';
        }

        if (bulletinsToShow.length === 0) {
            const emptyState = document.getElementById('emptyState');
            const debugControls = document.getElementById('debugControls');

            // Check if we have bulletins in memory but they're not showing
            const totalActive = this.bulletins.filter(b => b.isActive).length;

            if (totalActive > 0) {
                // We have active bulletins but they're not showing - show debug controls
                emptyState.innerHTML = '<h3>No bulletins found</h3><p>We detected active bulletins in the system but they\'re not displaying. Use the debug tools below to investigate.</p>';
                if (debugControls) debugControls.style.display = 'block';
                console.warn('⚠️  Active bulletins exist but not showing. Check console for details.');
            } else if (filteredBulletins) {
                emptyState.innerHTML = '<h3>No bulletins found</h3><p>Try adjusting your search or filter criteria.</p>';
                if (debugControls) debugControls.style.display = 'none';
            } else {
                emptyState.innerHTML = '<h3>No bulletins posted yet</h3><p>Advisors can log in to post job opportunities, training sessions, and important announcements.</p>';
                if (debugControls) debugControls.style.display = 'none';
            }

            emptyState.style.display = 'block';
            return;
        }

        // Hide debug controls if bulletins are showing
        const debugControls = document.getElementById('debugControls');
        if (debugControls) debugControls.style.display = 'none';

        // Hide empty state
        document.getElementById('emptyState').style.display = 'none';

        // Display bulletins in the selected view
        console.log('Current view:', this.currentView);
        console.log('Bulletins to show:', bulletinsToShow.length);
        switch(this.currentView) {
            case 'gallery':
                console.log('Switching to gallery view');
                this.displayGalleryView(bulletinsToShow);
                break;
            case 'calendar':
                console.log('Switching to calendar view');
                this.displayCalendarView(bulletinsToShow);
                break;
            default:
                console.error('Unknown view:', this.currentView);
        }
    }

    displayGalleryView(bulletins) {
        console.log('🎨 Displaying gallery view with', bulletins.length, 'bulletins');
        console.log('🎨 Bulletin titles:', bulletins.map(b => b.title));

        const grid = document.getElementById('bulletinGrid');
        if (grid) {
            console.log('🎨 Adding active class to gallery view');
            grid.classList.add('active');
            const html = bulletins.map(bulletin => this.createBulletinCard(bulletin)).join('');
            console.log('🎨 Generated HTML length:', html.length, 'characters');
            grid.innerHTML = html;
            console.log('🎨 Gallery view updated successfully');
            console.log('🎨 Gallery view classes:', grid.className);
        } else {
            console.error('❌ Gallery view container not found');
        }
    }

    // List view removed - advisors requested only gallery and calendar views
    // displayListView(bulletins) {
    //     console.log('📋 Displaying list view with', bulletins.length, 'bulletins');
    //     const list = document.getElementById('bulletinList');
    //     if (list) {
    //         console.log('📋 Adding active class to list view');
    //         list.classList.add('active');
    //         list.innerHTML = bulletins.map(bulletin => this.createBulletinListItem(bulletin)).join('');
    //         console.log('📋 List view updated successfully');
    //         console.log('📋 List view classes:', list.className);
    //     } else {
    //         console.error('❌ List view container not found');
    //     }
    // }

    displayCalendarView(bulletins) {
        console.log('📅 Displaying calendar view with', bulletins.length, 'bulletins');
        const calendar = document.getElementById('bulletinCalendar');
        if (calendar) {
            console.log('📅 Adding active class to calendar view');
            calendar.classList.add('active');
            calendar.innerHTML = this.createCalendarView(bulletins);
            console.log('📅 Calendar view updated successfully');
            console.log('📅 Calendar view classes:', calendar.className);
        } else {
            console.error('❌ Calendar view container not found');
        }
    }

    createBulletinListItem(bulletin) {
        const postedDate = new Date(bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);

        return `
            <div class="bulletin-list-item">
                <div class="bulletin-list-category">
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                </div>

                <div class="bulletin-list-content">
                    <div class="bulletin-list-header">
                        <h3 class="bulletin-list-title">${this.escapeHtml(bulletin.title)}</h3>
                    </div>

                    <div class="bulletin-list-description">
                        ${this.escapeHtml(bulletin.description).replace(/\n/g, '<br>')}
                    </div>

                    <div class="bulletin-list-meta">
                        ${bulletin.company ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                            </div>
                        ` : ''}

                        ${bulletin.classType ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}
                            </div>
                        ` : ''}

                        ${bulletin.contact ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}
                            </div>
                        ` : ''}

                        ${bulletin.deadline ? `
                            <div class="bulletin-list-meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                                <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                                ${isDeadlineClose ? ' (Soon!)' : ''}
                            </div>
                        ` : ''}

                        <div class="bulletin-list-meta-item">
                            <strong>Posted:</strong> ${postedDate}
                        </div>
                    </div>

                    <div class="posted-by">
                        Posted by ${this.escapeHtml(bulletin.advisorName)}
                    </div>
                </div>

                <div class="bulletin-actions">
                    <button class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">
                        📤 Share
                    </button>
                </div>
            </div>
        `;
    }

    createCalendarView(bulletins) {
        // Filter to only show bulletins with deadlines or events
        const calendarBulletins = bulletins.filter(bulletin => {
            return bulletin.deadline || bulletin.eventDate || bulletin.startDate;
        });

        // Group bulletins by deadline date
        const bulletinsByDate = {};
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        calendarBulletins.forEach(bulletin => {
            let dateKey;
            if (bulletin.deadline) {
                const deadline = new Date(bulletin.deadline);
                if (deadline >= today && deadline <= nextMonth) {
                    dateKey = deadline.toDateString();
                } else {
                    return; // Skip bulletins outside the date range
                }
            } else if (bulletin.eventDate) {
                const eventDate = new Date(bulletin.eventDate);
                if (eventDate >= today && eventDate <= nextMonth) {
                    dateKey = eventDate.toDateString();
                } else {
                    return; // Skip bulletins outside the date range
                }
            } else if (bulletin.startDate) {
                const startDate = new Date(bulletin.startDate);
                if (startDate >= today && startDate <= nextMonth) {
                    dateKey = startDate.toDateString();
                } else {
                    return; // Skip bulletins outside the date range
                }
            } else {
                // Skip bulletins without deadlines or events
                return;
            }

            if (!bulletinsByDate[dateKey]) {
                bulletinsByDate[dateKey] = [];
            }
            bulletinsByDate[dateKey].push(bulletin);
        });

        // Create calendar days for the next 30 days
        const calendarDays = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateKey = date.toDateString();
            const dayBulletins = bulletinsByDate[dateKey] || [];

            if (dayBulletins.length > 0 || i === 0) { // Show today even if empty
                calendarDays.push(this.createCalendarDay(date, dayBulletins));
            }
        }

        return `<div class="calendar-grid">${calendarDays.join('')}</div>`;
    }

    createCalendarDay(date, bulletins) {
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate();
        const isToday = date.toDateString() === new Date().toDateString();

        const bulletinsHtml = bulletins.map(bulletin => this.createCalendarBulletinItem(bulletin)).join('');

        return `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-header">
                    <div>
                        <div class="calendar-day-date">${month} ${day}</div>
                        <div class="calendar-day-weekday">${weekday}</div>
                    </div>
                    ${isToday ? '<span class="today-badge">Today</span>' : ''}
                </div>
                <div class="calendar-day-bulletins">
                    ${bulletinsHtml}
                </div>
            </div>
        `;
    }

    createCalendarBulletinItem(bulletin) {
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);

        return `
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                <div class="calendar-bulletin-category category-${bulletin.category}">
                    ${this.getCategoryDisplay(bulletin.category)}
                </div>
                <div class="calendar-bulletin-description">
                    ${this.escapeHtml(bulletin.description).substring(0, 100)}${bulletin.description.length > 100 ? '...' : ''}
                </div>
                <div class="calendar-bulletin-meta">
                    ${bulletin.deadline ? `
                        <span class="${isDeadlineClose ? 'calendar-bulletin-deadline' : ''}">
                            Deadline: ${new Date(bulletin.deadline).toLocaleDateString()}
                            ${isDeadlineClose ? ' (Due Soon!)' : ''}
                        </span>
                    ` : ''}
                    <span>Posted by ${this.escapeHtml(bulletin.advisorName)}</span>
                </div>
            </div>
        `;
    }

    // Multi-select filter chip handler
    toggleFilterChip(chip, type) {
        chip.classList.toggle('active');

        const value = chip.dataset[type];

        if (type === 'category') {
            const index = this.selectedCategories.indexOf(value);
            if (index > -1) {
                this.selectedCategories.splice(index, 1);
            } else {
                this.selectedCategories.push(value);
            }
        } else if (type === 'posted') {
            const index = this.selectedPostedDates.indexOf(value);
            if (index > -1) {
                this.selectedPostedDates.splice(index, 1);
            } else {
                this.selectedPostedDates.push(value);
            }
        } else if (type === 'deadline') {
            const index = this.selectedDeadlines.indexOf(value);
            if (index > -1) {
                this.selectedDeadlines.splice(index, 1);
            } else {
                this.selectedDeadlines.push(value);
            }
        } else if (type === 'classtype') {
            const index = this.selectedClassTypes.indexOf(value);
            if (index > -1) {
                this.selectedClassTypes.splice(index, 1);
            } else {
                this.selectedClassTypes.push(value);
            }
        }

        this.updateFilterCount();
        this.applyFilters();
    }

    updateFilterCount() {
        const total = this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length;
        const countElement = document.getElementById('filterCount');
        const countContainer = document.getElementById('activeFiltersCount');
        const toggleBtn = document.getElementById('toggleFilters');

        if (countElement && countContainer) {
            countElement.textContent = total;
            countContainer.style.display = total > 0 ? 'inline' : 'none';
        }

        // Update toggle button state
        if (toggleBtn) {
            if (total > 0) {
                toggleBtn.classList.add('active');
            } else {
                toggleBtn.classList.remove('active');
            }
        }
    }

    toggleFiltersPanel() {
        const filterControls = document.getElementById('filterControls');
        const toggleBtn = document.getElementById('toggleFilters');
        
        console.log('🔧 Toggle filters clicked');
        console.log('Filter controls element:', filterControls);
        console.log('Toggle button element:', toggleBtn);
        
        if (filterControls && toggleBtn) {
            const currentDisplay = filterControls.style.display;
            console.log('Current display:', currentDisplay);
            
            const isVisible = currentDisplay !== 'none';
            
            if (isVisible) {
                console.log('Hiding filters');
                filterControls.style.display = 'none';
                toggleBtn.innerHTML = '<span>🔧</span> Filters' + (this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length > 0 ? ' <span id="activeFiltersCount" class="active-filters-count" style="display: inline;">(<span id="filterCount">' + (this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length) + '</span>)</span>' : '');
            } else {
                console.log('Showing filters');
                filterControls.style.display = 'block';
                toggleBtn.innerHTML = '<span>🔧</span> Hide Filters';
            }
        } else {
            console.error('❌ Filter controls or toggle button not found');
        }
    }

    // Filter and Search Methods
    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

        let filteredBulletins = this.bulletins
            .filter(b => b.isActive)
            .sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));

        // Filter out expired items unless "Show Expired" is toggled on
        if (!this.showExpired) {
            filteredBulletins = filteredBulletins.filter(b => !this.isExpired(b.deadline));
        }

        // Apply category filters (multi-select)
        if (this.selectedCategories.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => this.selectedCategories.includes(b.category));
        }

        // Apply posted date filters (multi-select)
        if (this.selectedPostedDates.length > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedPostedDates.some(postedFilter => {
                    const postedDate = new Date(b.datePosted);
                    const postedDateOnly = new Date(postedDate.getFullYear(), postedDate.getMonth(), postedDate.getDate());
                    const timeDiff = today.getTime() - postedDateOnly.getTime();
                    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                    switch (postedFilter) {
                        case 'today':
                            return daysDiff === 0;
                        case 'thisweek':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'lastweek':
                            return daysDiff > 7 && daysDiff <= 14;
                        case 'thismonth':
                            return daysDiff <= 30 && daysDiff >= 0;
                        case 'lastmonth':
                            return daysDiff > 30 && daysDiff <= 60;
                        default:
                            return true;
                    }
                });
            });
        }

        // Apply deadline filters (multi-select)
        if (this.selectedDeadlines.length > 0) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedDeadlines.some(deadlineFilter => {
                    if (deadlineFilter === 'nodate') {
                        return !b.deadline;
                    }

                    if (!b.deadline) return false;

                    const deadline = new Date(b.deadline);
                    const timeDiff = deadline.getTime() - today.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    switch (deadlineFilter) {
                        case 'soon':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'thisweek':
                            return daysDiff <= 7 && daysDiff >= 0;
                        case 'thismonth':
                            return daysDiff <= 30 && daysDiff >= 0;
                        default:
                            return true;
                    }
                });
            });
        }

        // Apply class type filters (multi-select)
        if (this.selectedClassTypes.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedClassTypes.includes(b.classType);
            });
        }

        // Apply search filter
        if (searchTerm) {
            filteredBulletins = filteredBulletins.filter(b => {
                return (
                    b.title.toLowerCase().includes(searchTerm) ||
                    b.description.toLowerCase().includes(searchTerm) ||
                    (b.company && b.company.toLowerCase().includes(searchTerm)) ||
                    (b.contact && b.contact.toLowerCase().includes(searchTerm)) ||
                    b.advisorName.toLowerCase().includes(searchTerm)
                );
            });
        }

        this.displayBulletins(filteredBulletins);
    }

    clearFilters() {
        document.getElementById('searchInput').value = '';

        // Clear multi-select filters
        this.selectedCategories = [];
        this.selectedPostedDates = [];
        this.selectedDeadlines = [];
        this.selectedClassTypes = [];

        // Remove active class from all chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });

        this.updateFilterCount();
        this.displayBulletins();
        
        // Update toggle button text
        const toggleBtn = document.getElementById('toggleFilters');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<span>🔧</span> Filters';
        }
    }

    // Notification Methods
    showNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (!modal) return;
        modal.style.display = 'block';
        this.loadNotificationSettings();
    }

    hideNotificationModal() {
        const modal = document.getElementById('notificationModal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    handleNotificationSubmit(e) {
        e.preventDefault();
        
        const form = e.target || document.getElementById('notificationForm');
        if (!form) return;

        const formData = new FormData(form);
        const notificationSettings = {
            advisor: formData.get('advisorNotification') || '',
            classTypes: formData.getAll('classTypeNotification'),
            keywords: formData.get('keywordNotification').split(',').map(k => k.trim()).filter(k => k),
            email: formData.get('emailNotification'),
            timestamp: new Date().toISOString()
        };

        // Save to localStorage
        localStorage.setItem('ebhcs_notification_settings', JSON.stringify(notificationSettings));
        
        this.showSuccessMessage('Notification settings saved! You\'ll receive email notifications for matching bulletins.');
        this.hideNotificationModal();
        this.updateNotificationButton();
    }

    loadNotificationSettings() {
        const form = document.getElementById('notificationForm');
        if (!form) return;

        const settings = JSON.parse(localStorage.getItem('ebhcs_notification_settings') || '{}');
        
        // Populate form
        document.getElementById('advisorNotification').value = settings.advisor || '';
        document.getElementById('emailNotification').value = settings.email || '';
        document.getElementById('keywordNotification').value = (settings.keywords || []).join(', ');
        
        // Check class type checkboxes
        document.querySelectorAll('input[name="classTypeNotification"]').forEach(checkbox => {
            checkbox.checked = (settings.classTypes || []).includes(checkbox.value);
        });

        // Show current settings
        this.displayCurrentSettings(settings);
    }

    displayCurrentSettings(settings) {
        const statusDiv = document.getElementById('notificationStatus');
        const currentSettingsDiv = document.getElementById('currentSettings');
        
        if (settings.email) {
            let settingsText = `<strong>Email:</strong> ${settings.email}<br>`;
            
            if (settings.advisor) {
                settingsText += `<strong>Advisor:</strong> ${settings.advisor}<br>`;
            }
            
            if (settings.classTypes && settings.classTypes.length > 0) {
                const classTypeNames = settings.classTypes.map(ct => this.getClassTypeDisplay(ct)).join(', ');
                settingsText += `<strong>Class Types:</strong> ${classTypeNames}<br>`;
            }
            
            if (settings.keywords && settings.keywords.length > 0) {
                settingsText += `<strong>Keywords:</strong> ${settings.keywords.join(', ')}<br>`;
            }
            
            currentSettingsDiv.innerHTML = settingsText;
            statusDiv.style.display = 'block';
        } else {
            statusDiv.style.display = 'none';
        }
    }

    testNotification() {
        const emailInput = document.getElementById('emailNotification');
        if (!emailInput) return;

        const email = emailInput.value;
        if (!email) {
            alert('Please enter your email address first.');
            return;
        }
        
        // Simulate a test notification
        this.showSuccessMessage(`Test notification would be sent to ${email}. In a real implementation, this would trigger an email.`);
    }

    updateNotificationButton() {
        const notificationBtn = document.getElementById('notificationBtn');
        if (!notificationBtn) {
            return;
        }

        const settings = JSON.parse(localStorage.getItem('ebhcs_notification_settings') || '{}');

        if (settings.email) {
            notificationBtn.classList.add('has-notifications');
            notificationBtn.title = 'Notification settings active - click to manage';
        } else {
            notificationBtn.classList.remove('has-notifications');
            notificationBtn.title = 'Set up notifications';
        }
    }

    checkForNewBulletins() {
        const settings = JSON.parse(localStorage.getItem('ebhcs_notification_settings') || '{}');
        if (!settings.email) return;

        const lastCheck = localStorage.getItem('ebhcs_last_notification_check');
        const now = new Date().toISOString();
        
        // Check for new bulletins since last check
        const newBulletins = this.bulletins.filter(bulletin => {
            if (!bulletin.isActive) return false;
            const bulletinDate = new Date(bulletin.datePosted);
            const lastCheckDate = lastCheck ? new Date(lastCheck) : new Date(0);
            return bulletinDate > lastCheckDate;
        });

        if (newBulletins.length > 0) {
            const matchingBulletins = this.filterBulletinsForNotification(newBulletins, settings);
            if (matchingBulletins.length > 0) {
                this.showNotificationAlert(matchingBulletins.length);
            }
        }

        localStorage.setItem('ebhcs_last_notification_check', now);
    }

    filterBulletinsForNotification(bulletins, settings) {
        return bulletins.filter(bulletin => {
            // Check advisor match
            if (settings.advisor && bulletin.advisorName === settings.advisor) {
                return true;
            }

            // Check class type match
            if (settings.classTypes && settings.classTypes.length > 0 && bulletin.classType) {
                if (settings.classTypes.includes(bulletin.classType)) {
                    return true;
                }
            }

            // Check keyword match
            if (settings.keywords && settings.keywords.length > 0) {
                const searchText = `${bulletin.title} ${bulletin.description} ${bulletin.company || ''}`.toLowerCase();
                if (settings.keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
                    return true;
                }
            }

            return false;
        });
    }

    showNotificationAlert(count) {
        const message = count === 1 
            ? 'You have 1 new bulletin that matches your interests!'
            : `You have ${count} new bulletins that match your interests!`;
        
        this.showSuccessMessage(message);
        
        // Update notification button
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.classList.add('has-notifications');
        }
    }

    // Tutorial Methods
    showHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal) return;
        modal.style.display = 'block';
        this.currentTutorialStep = 1;
        this.updateTutorialDisplay();
    }

    hideHelpModal() {
        const modal = document.getElementById('helpModal');
        if (!modal) return;
        modal.style.display = 'none';
    }

    nextTutorialStep() {
        if (this.currentTutorialStep < 5) {
            this.currentTutorialStep++;
            this.updateTutorialDisplay();
        }
    }

    prevTutorialStep() {
        if (this.currentTutorialStep > 1) {
            this.currentTutorialStep--;
            this.updateTutorialDisplay();
        }
    }

    updateTutorialDisplay() {
        // Hide all steps
        const steps = document.querySelectorAll('.tutorial-step');
        if (steps.length === 0) {
            return;
        }

        steps.forEach(step => {
            step.classList.remove('active');
        });

        // Show current step
        const currentStep = document.querySelector(`[data-step="${this.currentTutorialStep}"]`);
        if (currentStep) {
            currentStep.classList.add('active');
        }

        // Update navigation buttons
        const prevBtn = document.getElementById('prevStep');
        const nextBtn = document.getElementById('nextStep');
        const stepCounter = document.getElementById('stepCounter');
        const restartBtn = document.getElementById('restartTutorial');

        if (!prevBtn || !nextBtn || !stepCounter || !restartBtn) {
            return;
        }

        prevBtn.disabled = this.currentTutorialStep === 1;
        nextBtn.disabled = this.currentTutorialStep === 5;
        stepCounter.textContent = `Step ${this.currentTutorialStep} of 5`;

        if (this.currentTutorialStep === 5) {
            nextBtn.textContent = 'Finish';
            nextBtn.addEventListener('click', () => this.finishTutorial());
        } else {
            nextBtn.textContent = 'Next →';
            nextBtn.removeEventListener('click', () => this.finishTutorial());
        }

        // Show restart button on last step
        restartBtn.style.display = this.currentTutorialStep === 5 ? 'inline-block' : 'none';
    }

    finishTutorial() {
        this.hideHelpModal();
        localStorage.setItem('ebhcs_tutorial_completed', 'true');
        this.showSuccessMessage('Tutorial completed! You now know how to use the site effectively.');
    }

    skipTutorial() {
        this.hideHelpModal();
        localStorage.setItem('ebhcs_tutorial_completed', 'true');
    }

    restartTutorial() {
        this.currentTutorialStep = 1;
        this.updateTutorialDisplay();
    }


    checkFirstTimeUser() {
        const tutorialCompleted = localStorage.getItem('ebhcs_tutorial_completed');
        const helpBtn = document.getElementById('helpBtn');

        if (!tutorialCompleted && helpBtn) {
            // Show a welcome message for first-time users
            setTimeout(() => {
                this.showSuccessMessage('Welcome! Click the ❓ button for a quick tutorial on how to use this site.');
            }, 2000);
        }
    }

    createBulletinCard(bulletin) {
        const postedDate = new Date(bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = bulletin.deadline && this.isExpired(bulletin.deadline);

        return `
            <div class="bulletin-card ${isExpired ? 'expired' : ''}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
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
                    ${this.escapeHtml(bulletin.description).replace(/\n/g, '<br>')}
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
                            <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}

                    ${bulletin.deadline ? `
                        <div class="meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                            <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                            ${isDeadlineClose ? ' (Soon!)' : ''}
                        </div>
                    ` : ''}

                    <div class="meta-item">
                        <strong>Posted:</strong> ${postedDate}
                    </div>

                    <div class="posted-by">
                        Posted by ${this.escapeHtml(bulletin.advisorName)}
                    </div>
                </div>

                <div class="bulletin-actions">
                    <div class="bulletin-tags">
                        ${bulletin.classType ? `
                            <span class="info-tag class-type-tag">
                                ${this.getClassTypeDisplay(bulletin.classType)}
                            </span>
                        ` : ''}
                        ${bulletin.company ? `
                            <span class="info-tag company-tag">
                                🏢 ${this.escapeHtml(bulletin.company)}
                            </span>
                        ` : ''}
                    </div>
                    <div class="bulletin-action-buttons">
                        ${bulletin.pdf ? `
                            <a href="${bulletin.pdf}" download="${bulletin.pdfName || 'bulletin.pdf'}" class="pdf-btn" title="Download PDF">
                                📄 View PDF
                            </a>
                        ` : ''}
                        <button class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    loadManageBulletins(searchTerm = '', sortBy = 'newest', filterBy = 'all') {
        const container = document.getElementById('manageBulletins');
        if (!container) {
            console.warn('Manage bulletins container not found - skipping load');
            return;
        }

        let userBulletins = this.bulletins
            .filter(b => b.postedBy === this.currentUser.username && b.isActive);

        // Apply search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            userBulletins = userBulletins.filter(b =>
                b.title.toLowerCase().includes(search) ||
                b.description.toLowerCase().includes(search) ||
                b.category.toLowerCase().includes(search)
            );
        }

        // Apply status filter
        if (filterBy === 'active') {
            userBulletins = userBulletins.filter(b => !this.isExpired(b.deadline));
        } else if (filterBy === 'expired') {
            userBulletins = userBulletins.filter(b => this.isExpired(b.deadline));
        }

        // Apply sorting
        switch(sortBy) {
            case 'newest':
                userBulletins.sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));
                break;
            case 'oldest':
                userBulletins.sort((a, b) => new Date(a.datePosted) - new Date(b.datePosted));
                break;
            case 'category':
                userBulletins.sort((a, b) => a.category.localeCompare(b.category));
                break;
            case 'deadline':
                userBulletins.sort((a, b) => {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline) - new Date(b.deadline);
                });
                break;
        }

        if (userBulletins.length === 0) {
            container.innerHTML = '<p class="no-posts-message">No posts found.</p>';
            return;
        }

        container.innerHTML = userBulletins.map(bulletin => {
            const isExpired = this.isExpired(bulletin.deadline);
            return `
            <div class="manage-card ${isExpired ? 'expired' : ''}">
                ${isExpired ? '<div class="manage-expired-badge">EXPIRED</div>' : ''}
                <div class="manage-card-header">
                    <h5>${this.escapeHtml(bulletin.title)}</h5>
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                </div>
                <div class="manage-card-body">
                    <p class="manage-description">${this.escapeHtml(bulletin.description).substring(0, 100)}${bulletin.description.length > 100 ? '...' : ''}</p>
                    <div class="manage-meta">
                        <span>📅 Posted: ${new Date(bulletin.datePosted).toLocaleDateString()}</span>
                        ${bulletin.deadline ? `<span class="${isExpired ? 'deadline-expired' : ''}">⏰ Deadline: ${new Date(bulletin.deadline).toLocaleDateString()}</span>` : ''}
                    </div>
                </div>
                <div class="manage-actions">
                    <button class="edit-btn" onclick="bulletinBoard.editBulletin('${bulletin.id}')">
                        ✏️ Edit
                    </button>
                    <button class="delete-btn" onclick="bulletinBoard.deleteBulletin('${bulletin.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
        }).join('');

        // Bind manage controls
        this.bindManageControls();
    }

    bindManageControls() {
        const searchInput = document.getElementById('manageSearchInput');
        const sortSelect = document.getElementById('manageSortSelect');
        const filterSelect = document.getElementById('manageFilterSelect');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const search = e.target.value;
                const sort = sortSelect ? sortSelect.value : 'newest';
                const filter = filterSelect ? filterSelect.value : 'all';
                this.loadManageBulletins(search, sort, filter);
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const sort = e.target.value;
                const search = searchInput ? searchInput.value : '';
                const filter = filterSelect ? filterSelect.value : 'all';
                this.loadManageBulletins(search, sort, filter);
            });
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const filter = e.target.value;
                const search = searchInput ? searchInput.value : '';
                const sort = sortSelect ? sortSelect.value : 'newest';
                this.loadManageBulletins(search, sort, filter);
            });
        }
    }

    editBulletin(id) {
        const bulletin = this.bulletins.find(b => b.id === id);
        if (!bulletin) {
            alert('Bulletin not found!');
            return;
        }

        // Switch to post tab
        showTab('post');

        // Populate form with bulletin data
        document.getElementById('title').value = bulletin.title;
        document.getElementById('category').value = bulletin.category;
        document.getElementById('description').value = bulletin.description;
        document.getElementById('company').value = bulletin.company || '';
        document.getElementById('contact').value = bulletin.contact || '';
        document.getElementById('deadline').value = bulletin.deadline || '';
        document.getElementById('advisorName').value = bulletin.advisorName;

        if (bulletin.classType) {
            document.getElementById('classType').value = bulletin.classType;
        }

        // Store the ID for updating
        const form = document.getElementById('bulletinForm');
        form.dataset.editingId = id;

        // Change submit button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Update Bulletin';
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Utility Methods
    getCategoryDisplay(category) {
        const categories = {
            'job': 'Job Opportunity',
            'training': 'Training',
            'college': 'College/University',
            'classtype': 'Class Type',
            'immigration': 'Immigration',
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

    isDeadlineClose(deadline) {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        const timeDiff = deadlineDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        return daysDiff <= 7 && daysDiff >= 0;
    }

    isExpired(deadline) {
        if (!deadline) return false;
        const deadlineDate = new Date(deadline);
        const today = new Date();
        deadlineDate.setHours(23, 59, 59, 999); // End of deadline day
        return deadlineDate < today;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessMessage(message) {
        // Create temporary success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 1001;
            font-weight: 500;
        `;
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    // Data Persistence
    loadBulletins() {
        // Check if Firebase is available
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            console.log('📊 Using Firebase for data storage');
            this.setupFirebaseListener();
            return []; // Will be populated by the listener
        } else {
            console.log('📊 Firebase not available, using localStorage fallback');
            const saved = localStorage.getItem('ebhcs_bulletins');
            if (saved) {
                const parsedData = JSON.parse(saved);
                console.log('📊 Loaded bulletins from localStorage:', parsedData.length, 'bulletins');

                // Ensure all bulletins have isActive field
                const fixedData = parsedData.map(bulletin => ({
                    ...bulletin,
                    isActive: bulletin.isActive !== undefined ? bulletin.isActive : true
                }));

                console.log('📊 Fixed isActive fields:', fixedData.filter(b => b.isActive).length, 'active bulletins');
                return fixedData;
            }

            // Return sample data for demo
            console.log('📊 No saved data, using sample data:', this.getSampleData().length, 'bulletins');
            return this.getSampleData();
        }
    }

    setupFirebaseListener() {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.error('❌ Firebase not available');
            return;
        }

        const db = firebase.firestore();
        console.log('📊 Setting up Firebase real-time listener');

        db.collection('bulletins')
          .where('isActive', '==', true)
          .orderBy('datePosted', 'desc')
          .onSnapshot((snapshot) => {
              console.log('📊 Firebase data updated:', snapshot.size, 'bulletins');
              this.bulletins = [];
              snapshot.forEach((doc) => {
                  const data = doc.data();
                  this.bulletins.push({
                      id: doc.id,
                      ...data,
                      // Convert Firestore timestamps to ISO strings for compatibility
                      datePosted: data.datePosted?.toDate ? data.datePosted.toDate().toISOString() : data.datePosted
                  });
              });
              console.log('📊 Loaded bulletins from Firebase:', this.bulletins.length, 'bulletins');
              this.displayBulletins();
          }, (error) => {
              console.error('❌ Firebase listener error:', error);
              // Fallback to localStorage if Firebase fails
              this.loadFromLocalStorage();
          });
    }

    loadFromLocalStorage() {
        console.log('📊 Falling back to localStorage');
        const saved = localStorage.getItem('ebhcs_bulletins');
        if (saved) {
            const parsedData = JSON.parse(saved);
            this.bulletins = parsedData.map(bulletin => ({
                ...bulletin,
                isActive: bulletin.isActive !== undefined ? bulletin.isActive : true
            }));
            console.log('📊 Loaded from localStorage:', this.bulletins.length, 'bulletins');
        } else {
            this.bulletins = this.getSampleData();
            console.log('📊 Using sample data:', this.bulletins.length, 'bulletins');
        }
        this.displayBulletins();
    }

    saveBulletins() {
        // Check if Firebase is available
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            console.log('📊 Using Firebase for data storage - no need to manually save (real-time sync)');
            return;
        } else {
            console.log('📊 Using localStorage fallback');
            localStorage.setItem('ebhcs_bulletins', JSON.stringify(this.bulletins));
        }
    }

    // Firebase-specific methods for admin operations
    async saveBulletinToFirebase(bulletin) {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.error('❌ Firebase not available for saving');
            return false;
        }

        try {
            const db = firebase.firestore();
            const bulletinData = {
                ...bulletin,
                datePosted: firebase.firestore.Timestamp.fromDate(new Date(bulletin.datePosted))
            };

            if (bulletin.id && bulletin.id !== 'new') {
                // Update existing bulletin
                await db.collection('bulletins').doc(bulletin.id).update(bulletinData);
                console.log('✅ Bulletin updated in Firebase:', bulletin.id);
            } else {
                // Create new bulletin
                const docRef = await db.collection('bulletins').add(bulletinData);
                console.log('✅ Bulletin created in Firebase:', docRef.id);
                return docRef.id;
            }
            return true;
        } catch (error) {
            console.error('❌ Error saving to Firebase:', error);
            return false;
        }
    }

    async deleteBulletinFromFirebase(bulletinId) {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.error('❌ Firebase not available for deletion');
            return false;
        }

        try {
            const db = firebase.firestore();
            await db.collection('bulletins').doc(bulletinId).delete();
            console.log('✅ Bulletin deleted from Firebase:', bulletinId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting from Firebase:', error);
            return false;
        }
    }

    getSampleData() {
        return [
            {
                id: '1',
                title: 'Customer Service Representative - Boston Medical Center',
                category: 'job',
                description: 'BMC is looking for bilingual customer service representatives. Full-time position with benefits. No experience required - we will train!',
                company: 'Boston Medical Center',
                contact: 'Apply online at bmcjobs.org or call 617-555-0123',
                deadline: '2024-12-15',
                advisorName: 'Marlie Creed',
                postedBy: 'admin',
                datePosted: new Date(Date.now() - 86400000 * 2).toISOString(),
                isActive: true,
                image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop&crop=center'
            },
            {
                id: '2',
                title: 'Free Computer Skills Workshop',
                category: 'training',
                description: 'Learn basic computer skills including Microsoft Word, Excel, and internet browsing. Perfect for job seekers!',
                company: 'Boston Public Library',
                contact: 'Register at bpl.org/workshops or call 617-555-0456',
                deadline: '2024-12-01',
                advisorName: 'School Advisor',
                postedBy: 'admin',
                datePosted: new Date(Date.now() - 86400000 * 5).toISOString(),
                isActive: true,
                image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop&crop=center'
            },
            {
                id: '3',
                title: 'ESOL Class Registration Open',
                category: 'training',
                description: 'New ESOL classes starting next month. Improve your English skills for better job opportunities.',
                company: 'East Boston Community Center',
                contact: 'Call 617-555-0789 to register',
                deadline: '2024-11-30',
                advisorName: 'Simonetta (Advisor)',
                postedBy: 'advisor1',
                datePosted: new Date(Date.now() - 86400000 * 1).toISOString(),
                isActive: true,
                image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop&crop=center'
            }
        ];
    }

    // Admin utility methods for maintenance
    exportData() {
        const data = {
            bulletins: this.bulletins,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `ebhcs-bulletins-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.bulletins && Array.isArray(data.bulletins)) {
                this.bulletins = data.bulletins;
                this.saveBulletins();
                this.displayBulletins();
                return true;
            }
        } catch (e) {
            console.error('Import failed:', e);
        }
        return false;
    }

    // Comprehensive testing method
    testAllFunctions() {
        console.log('=== COMPREHENSIVE TESTING START ===');

        // Test 1: Check if all required elements exist
        console.log('Test 1: Element existence check');
        const requiredElements = [
            'searchInput', 'searchBtn', 'categoryFilter', 'deadlineFilter',
            'dateFilter', 'classTypeFilter', 'clearFilters', 'resultsInfo',
            'bulletinGrid', 'bulletinList', 'bulletinCalendar', 'emptyState',
            'adminBtn', 'logoutBtn', 'loginForm', 'bulletinForm', 'image',
            'imagePreview', 'notificationBtn', 'helpBtn'
        ];

        const missingElements = [];
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                missingElements.push(id);
            }
        });

        if (missingElements.length > 0) {
            console.warn('⚠️ Missing elements:', missingElements);
        } else {
            console.log('✅ All required elements found');
        }

        // Test 2: Check bulletin data
        console.log('Test 2: Bulletin data check');
        console.log('📊 Total bulletins:', this.bulletins.length);
        console.log('📊 Active bulletins:', this.bulletins.filter(b => b.isActive).length);

        // Test 3: Check view switching
        console.log('Test 3: View switching test');
        this.testViewSwitching();

        // Test 4: Check admin functionality
        console.log('Test 4: Admin functionality test');
        this.testAdminFunctionality();

        // Test 5: Check Firebase security rules
        console.log('Test 5: Firebase security rules test');
        this.testFirebaseSecurityRules();

        console.log('=== COMPREHENSIVE TESTING END ===');
    }

    // Utility function to inspect and fix localStorage data
    inspectAndFixData() {
        console.log('🔍 Inspecting localStorage data...');
        const saved = localStorage.getItem('ebhcs_bulletins');

        if (saved) {
            const data = JSON.parse(saved);
            console.log('📊 Raw data in localStorage:', data);

            // Show detailed info for each bulletin
            data.forEach((bulletin, index) => {
                console.log(`📋 Bulletin ${index + 1}:`, {
                    title: bulletin.title,
                    isActive: bulletin.isActive,
                    category: bulletin.category,
                    datePosted: bulletin.datePosted,
                    deadline: bulletin.deadline || 'none'
                });
            });

            // Check for missing isActive fields
            const fixedData = data.map((bulletin, index) => {
                const fixed = { ...bulletin };
                if (fixed.isActive === undefined) {
                    fixed.isActive = true;
                    console.log(`🔧 Fixed bulletin ${index + 1}: Added isActive: true`);
                }
                return fixed;
            });

            const activeCount = fixedData.filter(b => b.isActive).length;
            console.log(`✅ Active bulletins: ${activeCount}/${fixedData.length}`);

            // Save the fixed data
            localStorage.setItem('ebhcs_bulletins', JSON.stringify(fixedData));
            console.log('💾 Fixed data saved to localStorage');

            // Reload bulletins
            this.bulletins = fixedData;
            this.displayBulletins();

            return activeCount;
        } else {
            console.log('❌ No data found in localStorage');
            return 0;
        }
    }

    forceRefreshDisplay() {
        console.log('🔄 Force refreshing display...');
        console.log('📊 Current bulletins:', this.bulletins.length);
        console.log('📊 Active bulletins:', this.bulletins.filter(b => b.isActive).length);

        // Clear any existing filters
        const filters = ['searchInput', 'categoryFilter', 'deadlineFilter', 'dateFilter', 'classTypeFilter'];
        filters.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        // Force display refresh
        this.displayBulletins();
        console.log('✅ Display refreshed');
    }

    testViewSwitching() {
        const views = ['gallery', 'list', 'calendar'];
        views.forEach(view => {
            try {
                this.switchView(view);
                console.log(`✅ View switch to ${view} successful`);
            } catch (e) {
                console.error(`❌ View switch to ${view} failed:`, e);
            }
        });
    }

    testAdminFunctionality() {
        // Test admin-specific elements and functions
        const adminElements = ['adminPanel', 'loginForm', 'bulletinForm'];
        adminElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                console.log(`✅ Admin element ${id} found`);
            } else {
                console.log(`⚠️ Admin element ${id} not found (expected on admin page)`);
            }
        });
    }

    testFirebaseSecurityRules() {
        // Check if Firebase is configured
        if (typeof firebase !== 'undefined') {
            console.log('✅ Firebase is loaded');
        } else {
            console.log('⚠️ Firebase not loaded (using local storage)');
        }

        // Check data structure compatibility
        const sampleBulletin = {
            id: 'test',
            title: 'Test Bulletin',
            description: 'Test Description',
            category: 'Jobs',
            datePosted: new Date().toISOString(),
            isActive: true
        };

        console.log('✅ Data structure is compatible');
    }
}

// Global tab switching function
function showTab(tabName) {
    bulletinBoard.showTab(tabName);
}

// Share functionality
function shareBulletin(bulletinId, bulletinTitle) {
    const currentUrl = window.location.href;
    const shareData = {
        title: `EBHCS Job Opportunity: ${bulletinTitle}`,
        text: `Check out this opportunity from East Boston Harborside Community School: ${bulletinTitle}`,
        url: currentUrl + (currentUrl.includes('#') ? '' : '#bulletin-' + bulletinId)
    };

    // Try native sharing first (mobile)
    if (navigator.share) {
        navigator.share(shareData).catch(err => {
            console.log('Error sharing:', err);
            fallbackShare(bulletinTitle, currentUrl);
        });
    } else {
        fallbackShare(bulletinTitle, currentUrl);
    }
}

function fallbackShare(title, url) {
    // Create share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 400px;
        width: 90%;
        text-align: center;
    `;

    content.innerHTML = `
        <h3>Share Bulletin</h3>
        <p>Copy this link to share:</p>
        <input type="text" value="${url}" readonly style="width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
        <div style="margin-top: 15px;">
            <button onclick="copyToClipboard('${url}')" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Copy Link</button>
            <button onclick="closeShareModal()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">Close</button>
        </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);
}

function copyToClipboard(text) {
    const copyBtn = document.querySelector('.share-modal button');
    try {
        navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#27ae60';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
            copyBtn.style.background = '';
        }, 2000);
        });
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

function closeShareModal() {
    const modal = document.querySelector('.share-modal');
    if (modal) modal.remove();
}

// Create bulletin board instance
const bulletinBoard = new BulletinBoard();

// Expose bulletinBoard globally for admin functions and debugging
window.bulletinBoard = bulletinBoard;

// Form enhancement functions
function toggleDateFields() {
    const dateType = document.getElementById('dateType');
    const dateFields = document.getElementById('dateFields');
    const singleDateGroup = document.getElementById('singleDateGroup');
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    
    if (!dateType || !dateFields) return;
    
    // Hide all date fields first
    dateFields.style.display = 'none';
    singleDateGroup.style.display = 'none';
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    
    // Show appropriate fields based on selection
    switch (dateType.value) {
        case 'deadline':
        case 'event':
            dateFields.style.display = 'block';
            singleDateGroup.style.display = 'block';
            break;
        case 'range':
            dateFields.style.display = 'block';
            startDateGroup.style.display = 'block';
            endDateGroup.style.display = 'block';
            break;
        default:
            // No date fields needed
            break;
    }
}

function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.nextElementSibling;
    
    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = 'Hide';
    } else {
        field.type = 'password';
        button.textContent = 'Show';
    }
}

function closeForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
}

// Form Progress Tracking
function updateFormProgress() {
    const form = document.getElementById('bulletinForm');
    if (!form) return;
    
    const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
    const filledRequiredFields = Array.from(requiredFields).filter(field => {
        if (field.type === 'checkbox' || field.type === 'radio') {
            return field.checked;
        }
        return field.value.trim() !== '';
    });
    
    const progressPercentage = Math.round((filledRequiredFields.length / requiredFields.length) * 100);
    const progressFill = document.getElementById('progressFill');
    const progressPercentageSpan = document.getElementById('progressPercentage');
    const formProgress = document.getElementById('formProgress');
    
    if (progressFill && progressPercentageSpan && formProgress) {
        progressFill.style.width = progressPercentage + '%';
        progressPercentageSpan.textContent = progressPercentage + '%';
        
        // Show progress bar when user starts filling the form
        if (progressPercentage > 0) {
            formProgress.style.display = 'block';
        } else {
            formProgress.style.display = 'none';
        }
    }
    
    // Update section completion status
    updateSectionCompletion();
}

function updateSectionCompletion() {
    const sections = document.querySelectorAll('.form-section');
    
    sections.forEach(section => {
        const requiredFields = section.querySelectorAll('input[required], select[required], textarea[required]');
        const filledRequiredFields = Array.from(requiredFields).filter(field => {
            if (field.type === 'checkbox' || field.type === 'radio') {
                return field.checked;
            }
            return field.value.trim() !== '';
        });
        
        if (requiredFields.length > 0 && filledRequiredFields.length === requiredFields.length) {
            section.classList.add('completed');
        } else {
            section.classList.remove('completed');
        }
    });
}

// Enhanced Form Validation
function validateField(field) {
    const formGroup = field.closest('.form-group');
    const feedback = formGroup.querySelector('.field-feedback');
    
    if (!formGroup || !feedback) return;
    
    // Remove existing validation classes
    formGroup.classList.remove('valid', 'invalid');
    feedback.className = 'field-feedback';
    
    // Check if field is required and empty
    if (field.hasAttribute('required') && field.value.trim() === '') {
        formGroup.classList.add('invalid');
        feedback.classList.add('error');
        feedback.textContent = 'This field is required';
        return false;
    }
    
    // Check field-specific validation
    let isValid = true;
    let errorMessage = '';
    
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    if (field.type === 'url' && field.value) {
        try {
            new URL(field.value);
        } catch {
            isValid = false;
            errorMessage = 'Please enter a valid URL';
        }
    }
    
    if (field.hasAttribute('maxlength')) {
        const maxLength = parseInt(field.getAttribute('maxlength'));
        if (field.value.length > maxLength) {
            isValid = false;
            errorMessage = `Maximum ${maxLength} characters allowed`;
        }
    }
    
    if (isValid && field.value.trim() !== '') {
        formGroup.classList.add('valid');
        feedback.classList.add('success');
        feedback.textContent = '✓ Good';
    } else if (!isValid) {
        formGroup.classList.add('invalid');
        feedback.classList.add('error');
        feedback.textContent = errorMessage;
    } else {
        // Field is valid but empty (optional field)
        feedback.textContent = '';
    }
    
    return isValid;
}

// Initialize form enhancements
function initializeFormEnhancements() {
    const form = document.getElementById('bulletinForm');
    if (!form) return;
    
    // Add event listeners to all form fields
    const fields = form.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
        field.addEventListener('blur', () => {
            validateField(field);
            updateFormProgress();
        });
        
        field.addEventListener('input', () => {
            updateFormProgress();
        });
        
        field.addEventListener('change', () => {
            validateField(field);
            updateFormProgress();
        });
    });
    
    // Add form submission enhancement
    form.addEventListener('submit', (e) => {
        const formContainer = form.closest('.post-form-container');
        if (formContainer) {
            formContainer.classList.add('form-submitting');
        }
        
        // Validate all required fields
        const requiredFields = form.querySelectorAll('input[required], select[required], textarea[required]');
        let allValid = true;
        
        requiredFields.forEach(field => {
            if (!validateField(field)) {
                allValid = false;
            }
        });
        
        if (!allValid) {
            e.preventDefault();
            if (formContainer) {
                formContainer.classList.remove('form-submitting');
            }
            
            // Show error message
            showFormError('Please fill in all required fields correctly before submitting.');
            return;
        }
    });
}

function showFormError(message) {
    const formContainer = document.querySelector('.post-form-container');
    if (!formContainer) return;
    
    // Remove existing error/success messages
    const existingError = formContainer.querySelector('.form-error');
    const existingSuccess = formContainer.querySelector('.form-success');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error';
    errorDiv.innerHTML = `
        <div class="form-error-icon">⚠️</div>
        <h4 class="form-error-title">Please Fix These Issues</h4>
        <p class="form-error-message">${message}</p>
    `;
    
    // Insert at the top of the form container
    formContainer.insertBefore(errorDiv, formContainer.firstChild);
    
    // Scroll to error message
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showFormSuccess(message) {
    const formContainer = document.querySelector('.post-form-container');
    if (!formContainer) return;
    
    // Remove existing error/success messages
    const existingError = formContainer.querySelector('.form-error');
    const existingSuccess = formContainer.querySelector('.form-success');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();
    
    // Create success message
    const successDiv = document.createElement('div');
    successDiv.className = 'form-success';
    successDiv.innerHTML = `
        <div class="form-success-icon">✅</div>
        <h4 class="form-success-title">Success!</h4>
        <p class="form-success-message">${message}</p>
    `;
    
    // Insert at the top of the form container
    formContainer.insertBefore(successDiv, formContainer.firstChild);
    
    // Scroll to success message
    successDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Expose utility functions for debugging
window.inspectBulletins = () => bulletinBoard.inspectAndFixData();
window.forceRefresh = () => bulletinBoard.forceRefreshDisplay();
window.clearAllBulletins = () => {
    localStorage.removeItem('ebhcs_bulletins');
    location.reload();
};
window.resetToSampleData = () => {
    bulletinBoard.bulletins = bulletinBoard.getSampleData();
    bulletinBoard.saveBulletins();
    bulletinBoard.displayBulletins();
    console.log('✅ Reset to sample data complete');
    console.log('📊 Sample data includes', bulletinBoard.bulletins.length, 'bulletins with images');
};
window.showAllBulletins = () => {
    console.log('📋 All bulletins in memory:');
    bulletinBoard.bulletins.forEach((b, i) => {
        console.log(`${i + 1}. ${b.title} - Active: ${b.isActive} - Category: ${b.category}`);
    });
};

// Run comprehensive tests
console.log('Running comprehensive tests...');
setTimeout(() => {
    bulletinBoard.testAllFunctions();
}, 1000);
