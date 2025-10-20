// EBHCS Advisor Admin Panel
class AdminPanel {
    constructor() {
        this.currentUser = null;
        this.bulletins = this.loadBulletins();
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAutoLogin();
    }

    bindEvents() {
        // Login controls
        document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
        document.querySelector('.close').addEventListener('click', () => this.hideLoginModal());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));

        // Bulletin form
        document.getElementById('bulletinForm').addEventListener('submit', (e) => this.handleBulletinSubmit(e));

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
        });

        // Close preview modal when clicking outside
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('previewModal');
            if (e.target === modal) {
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

    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // This is the local storage version - credentials removed for security
        // Use firebase-admin.js for production with Firebase Authentication
        alert('This is the local development version. Please use Firebase version for production.');
        return;
    }

    checkAutoLogin() {
        const savedUser = localStorage.getItem('ebhcs_current_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showAdminPanel();
            this.loadManageBulletins();
        } else {
            document.getElementById('loginRequired').style.display = 'block';
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('ebhcs_current_user');
        this.hideAdminPanel();
        this.clearLoginForm();
        document.getElementById('loginRequired').style.display = 'block';
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
        const bulletin = {
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
            image: null, // Will be set by handleImageUpload if image exists
            pdfUrl: null // Will be set by handlePdfUpload if PDF exists
        };

        // Handle file uploads (image and PDF)
        const imageFile = formData.get('image');
        const pdfFile = formData.get('pdf');
        
        if (imageFile && imageFile.size > 0) {
            this.handleImageUpload(imageFile, bulletin, pdfFile);
        } else if (pdfFile && pdfFile.size > 0) {
            this.handlePdfUpload(pdfFile, bulletin);
        } else {
            this.saveBulletin(bulletin);
        }
    }

    handleImageUpload(file, bulletin, pdfFile = null) {
        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file too large. Please select an image under 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            bulletin.image = e.target.result;
            if (pdfFile && pdfFile.size > 0) {
                this.handlePdfUpload(pdfFile, bulletin);
            } else {
                this.saveBulletin(bulletin);
            }
        };
        reader.readAsDataURL(file);
    }

    handlePdfUpload(file, bulletin) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('PDF file too large. Please select a PDF under 10MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            bulletin.pdfUrl = e.target.result;
            this.saveBulletin(bulletin);
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
                        <button type="button" class="remove-image" onclick="adminPanel.removeImagePreview()">&times;</button>
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
            // Check file size (10MB limit for PDFs)
            if (file.size > 10 * 1024 * 1024) {
                alert('PDF file too large. Please select a PDF under 10MB.');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            // Check file type
            if (file.type !== 'application/pdf') {
                alert('Please select a valid PDF file.');
                e.target.value = '';
                preview.innerHTML = '';
                return;
            }

            preview.innerHTML = `
                <div class="pdf-preview-container">
                    <div class="pdf-preview-icon">📄</div>
                    <div class="pdf-preview-info">
                        <strong>${file.name}</strong>
                        <small>${(file.size / 1024 / 1024).toFixed(2)} MB</small>
                    </div>
                    <button type="button" class="remove-pdf" onclick="adminPanel.removePdfPreview()">&times;</button>
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

    saveBulletin(bulletin) {
        this.bulletins.unshift(bulletin);
        this.saveBulletins();
        this.showSuccessMessage('Bulletin posted successfully!');

        // Clear form
        document.getElementById('bulletinForm').reset();
        document.getElementById('imagePreview').innerHTML = '';

        // Reset advisor name dropdown
        const advisorSelect = document.getElementById('advisorName');
        if ([...advisorSelect.options].some(option => option.value === this.currentUser.name)) {
            advisorSelect.value = this.currentUser.name;
        }
    }

    deleteBulletin(bulletinId) {
        if (confirm('Are you sure you want to delete this bulletin?')) {
            this.bulletins = this.bulletins.filter(b => b.id !== bulletinId);
            this.saveBulletins();
            this.loadManageBulletins();
            this.showSuccessMessage('Bulletin deleted successfully!');
        }
    }

    loadManageBulletins() {
        const container = document.getElementById('manageBulletins');
        const userBulletins = this.bulletins
            .filter(b => b.postedBy === this.currentUser.username && b.isActive)
            .sort((a, b) => new Date(b.datePosted) - new Date(a.datePosted));

        if (userBulletins.length === 0) {
            container.innerHTML = '<p>You haven\'t posted any bulletins yet.</p>';
            return;
        }

        container.innerHTML = userBulletins.map(bulletin => `
            <div class="manage-card">
                <h5>${this.escapeHtml(bulletin.title)}</h5>
                <p><strong>Category:</strong> ${this.getCategoryDisplay(bulletin.category)}</p>
                <p><strong>Posted:</strong> ${new Date(bulletin.datePosted).toLocaleDateString()}</p>
                ${bulletin.deadline ? `<p><strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}</p>` : ''}
                <div class="manage-actions">
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
        const deadline = document.getElementById('deadline').value;
        const advisorName = document.getElementById('advisorName').value;

        if (!title || !category || !description || !advisorName) {
            alert('Please fill in all required fields before previewing.');
            return;
        }

        const bulletin = {
            title,
            category,
            description,
            company,
            contact,
            deadline,
            advisorName,
            datePosted: new Date().toISOString(),
            image: document.getElementById('imagePreview').querySelector('img')?.src || null,
            pdfUrl: document.getElementById('pdfPreview').querySelector('.pdf-preview-container') ? 'preview-pdf' : null
        };

        this.showPreview(bulletin);
    }

    showPreview(bulletin) {
        const previewContent = document.getElementById('previewContent');
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);

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
                    ${this.escapeHtml(bulletin.description).replace(/\\n/g, '<br>')}
                </div>

                <div class="bulletin-meta">
                    ${bulletin.company ? `
                        <div class="meta-item">
                            <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                        </div>
                    ` : ''}

                    ${bulletin.contact ? `
                        <div class="meta-item">
                            <strong>Contact:</strong> ${this.escapeHtml(bulletin.contact).replace(/\\n/g, '<br>')}
                        </div>
                    ` : ''}

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

                <div class="bulletin-actions">
                    <div class="bulletin-tags">
                        <!-- Tags would go here -->
                    </div>
                    <div class="bulletin-action-buttons">
                        ${bulletin.pdfUrl ? `
                            <span class="pdf-btn" style="cursor: default;">
                                📄 PDF
                            </span>
                        ` : ''}
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
        document.getElementById('bulletinForm').dispatchEvent(new Event('submit'));
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
        const saved = localStorage.getItem('ebhcs_bulletins');
        if (saved) {
            return JSON.parse(saved);
        }
        return [];
    }

    saveBulletins() {
        localStorage.setItem('ebhcs_bulletins', JSON.stringify(this.bulletins));
    }
}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    adminPanel.showTab(tabName);
}

function previewBulletin() {
    adminPanel.previewBulletin();
}

function closePreview() {
    adminPanel.closePreview();
}

function submitFromPreview() {
    adminPanel.submitFromPreview();
}

    // Additional admin functions for HTML compatibility
    showPasswordChangeModal(username) {
        // For local storage version, just complete login
        this.completeLogin(username, `${username}@ebhcs.org`);
    }

    completeLogin(username, email) {
        this.currentUser = {
            username: username,
            email: email,
            name: this.getUserDisplayName(username)
        };
        this.showAdminPanel();
        this.loadManageBulletins();
    }

    showForgotPassword() {
        document.getElementById('forgotPasswordModal').style.display = 'block';
    }

    closeForgotPassword() {
        document.getElementById('forgotPasswordModal').style.display = 'none';
    }

    handleForgotPassword(e) {
        e.preventDefault();
        const username = document.getElementById('resetUsername').value;
        this.showSuccessMessage('Password reset request submitted. An admin will contact you shortly.');
        this.closeForgotPassword();
    }

    togglePassword(inputId) {
        const input = document.getElementById(inputId);
        const button = input.nextElementSibling;

        if (input.type === 'password') {
            input.type = 'text';
            button.textContent = '🙈';
        } else {
            input.type = 'password';
            button.textContent = '👁️';
        }
    }

    skipPasswordChange() {
        // For local storage version, just complete login
        this.hideLoginModal();
    }

    handleTabKeydown(event, tabName) {
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.showTab(tabName);
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

    // Enhanced image handling
    async handleImageUpload(file, bulletin) {
        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.showTemporaryMessage('Image file too large. Please select an image under 10MB.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            bulletin.image = e.target.result;
            this.saveBulletin(bulletin);
        };
        reader.readAsDataURL(file);
    }
}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    adminPanel.showTab(tabName);
}

function previewBulletin() {
    adminPanel.previewBulletin();
}

function closePreview() {
    adminPanel.closePreview();
}

function submitFromPreview() {
    adminPanel.submitFromPreview();
}

function togglePassword(inputId) {
    adminPanel.togglePassword(inputId);
}

function closeForgotPassword() {
    adminPanel.closeForgotPassword();
}

function handleTabKeydown(event, tabName) {
    adminPanel.handleTabKeydown(event, tabName);
}

    // Date field management for forms
    toggleDateFields() {
        const dateType = document.getElementById('dateType').value;
        const dateFields = document.getElementById('dateFields');
        const singleDateGroup = document.getElementById('singleDateGroup');
        const startDateGroup = document.getElementById('startDateGroup');
        const endDateGroup = document.getElementById('endDateGroup');
        const eventDateInput = document.getElementById('eventDate');

        // Hide all date fields initially
        dateFields.style.display = 'none';
        singleDateGroup.style.display = 'none';
        startDateGroup.style.display = 'none';
        endDateGroup.style.display = 'none';

        // Clear all date inputs
        if (eventDateInput) eventDateInput.value = '';
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';

        if (dateType === 'deadline') {
            dateFields.style.display = 'flex';
            singleDateGroup.style.display = 'block';
            const label = document.querySelector('label[for="eventDate"]');
            if (label) label.textContent = 'Application Deadline:';
            if (eventDateInput) eventDateInput.required = true;
        } else if (dateType === 'event') {
            dateFields.style.display = 'flex';
            singleDateGroup.style.display = 'block';
            const label = document.querySelector('label[for="eventDate"]');
            if (label) label.textContent = 'Event Date:';
            if (eventDateInput) eventDateInput.required = true;
        } else if (dateType === 'range') {
            dateFields.style.display = 'flex';
            startDateGroup.style.display = 'block';
            endDateGroup.style.display = 'block';
            if (startDateInput) startDateInput.required = true;
            if (endDateInput) endDateInput.required = true;
        } else {
            if (eventDateInput) eventDateInput.required = false;
            if (startDateInput) startDateInput.required = false;
            if (endDateInput) endDateInput.required = false;
        }
    }
}

// Global functions for HTML onclick handlers
function showTab(tabName) {
    if (window.adminPanel) {
        adminPanel.showTab(tabName);
    }
}

function previewBulletin() {
    if (window.adminPanel) {
        adminPanel.previewBulletin();
    }
}

function closePreview() {
    if (window.adminPanel) {
        adminPanel.closePreview();
    }
}

function submitFromPreview() {
    if (window.adminPanel) {
        adminPanel.submitFromPreview();
    }
}

function togglePassword(inputId) {
    if (window.adminPanel) {
        adminPanel.togglePassword(inputId);
    }
}

function closeForgotPassword() {
    if (window.adminPanel) {
        adminPanel.closeForgotPassword();
    }
}

function handleTabKeydown(event, tabName) {
    if (window.adminPanel) {
        adminPanel.handleTabKeydown(event, tabName);
    }
}

function toggleDateFields() {
    if (window.adminPanel) {
        adminPanel.toggleDateFields();
    }
}

// Initialize the admin panel
const adminPanel = new AdminPanel();
window.adminPanel = adminPanel;