// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCvfk81onpaDSRewbJ_3cnPNMuKPz5GelM",
  authDomain: "ebhcs-bulletin-board.firebaseapp.com",
  projectId: "ebhcs-bulletin-board",
  storageBucket: "ebhcs-bulletin-board.firebasestorage.app",
  messagingSenderId: "556649154585",
  appId: "1:556649154585:web:3a3f49d2056aa507088288"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Initialize Storage
const storage = firebase.storage();

// Firebase-enabled Bulletin Board System
class FirebaseBulletinBoard {
    constructor() {
        this.currentUser = null;
        this.bulletins = [];
        this.lastHashHighlight = null;
        this.handleHashChange = this.handleHashRouting.bind(this);
        this.handleDescriptionToggle = this.handleDescriptionToggle.bind(this);
        this.init();
    }

    init() {
        this.currentView = 'gallery'; // Set default view
        this.currentCalendarMonth = new Date().getMonth(); // Initialize calendar month
        this.currentCalendarYear = new Date().getFullYear(); // Initialize calendar year
        this.bindEvents();
        this.loadBulletins();
        this.checkAutoLogin();

        // Listen for real-time updates
        this.setupRealtimeListener();

        window.addEventListener('hashchange', this.handleHashChange);
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
            this.populateAdvisorFilters();
            this.displayBulletins();
        });
    }

    populateAdvisorFilters() {
        // Get unique advisor names from bulletins
        const advisorNames = [...new Set(this.bulletins.map(b => b.advisorName).filter(name => name))];
        advisorNames.sort();
        
        const postedByChips = document.getElementById('postedByChips');
        if (!postedByChips) return;
        
        // Clear existing chips
        postedByChips.innerHTML = '';
        
        // Create a chip for each advisor
        advisorNames.forEach(advisorName => {
            const chip = document.createElement('button');
            chip.className = 'filter-chip postedby-chip';
            chip.setAttribute('data-postedby', advisorName);
            chip.textContent = `👤 ${advisorName}`;
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'postedby'));
            postedByChips.appendChild(chip);
        });
    }

    bindEvents() {
        // View toggle controls
        const galleryBtn = document.getElementById('galleryViewBtn');
        const listBtn = document.getElementById('listViewBtn');
        const calendarBtn = document.getElementById('calendarViewBtn');

        console.log('View buttons found:', { galleryBtn: !!galleryBtn, listBtn: !!listBtn, calendarBtn: !!calendarBtn });

        if (galleryBtn) galleryBtn.addEventListener('click', () => this.switchView('gallery'));
        if (listBtn) listBtn.addEventListener('click', () => this.switchView('list'));
        if (calendarBtn) calendarBtn.addEventListener('click', () => this.switchView('calendar'));

        // Filter and search controls
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearFilters = document.getElementById('clearFilters');

        if (searchInput) searchInput.addEventListener('input', () => this.applyFilters());
        if (searchBtn) searchBtn.addEventListener('click', () => this.applyFilters());
        if (clearFilters) clearFilters.addEventListener('click', () => this.clearFilters());

        // Toggle filters button
        const toggleFiltersBtn = document.getElementById('toggleFilters');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', (e) => {
                this.toggleFiltersPanel();
            });
        }

        // Multi-select filter chips
        this.selectedCategories = [];
        this.selectedPostedDates = [];
        this.selectedDeadlines = [];
        this.selectedClassTypes = [];
        this.selectedPostedBy = [];

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

        document.querySelectorAll('.filter-chip[data-postedby]').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleFilterChip(e.target, 'postedby'));
        });

        // Show expired toggle
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        if (showExpiredToggle) {
            showExpiredToggle.addEventListener('change', () => this.applyFilters());
        }

        const closeDetailBtn = document.getElementById('closeBulletinDetail');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => this.closeBulletinDetail());
        }

        const detailModal = document.getElementById('bulletinDetailModal');
        if (detailModal) {
            detailModal.addEventListener('click', (event) => {
                if (event.target === detailModal) {
                    this.closeBulletinDetail();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const detailModalEl = document.getElementById('bulletinDetailModal');
                if (detailModalEl && detailModalEl.style.display === 'flex') {
                    this.closeBulletinDetail();
                }
            }
        });

        document.addEventListener('click', this.handleDescriptionToggle);
    }

    // View Management Methods
    switchView(view) {
        console.log('🔄 Switching to view:', view);
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        const targetButton = document.querySelector(`[data-view="${view}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
            console.log('✅ Activated button for view:', view);
        } else {
            console.error('❌ Button not found for view:', view);
        }

        // Update current view
        this.currentView = view;
        console.log('🔄 Current view set to:', this.currentView);

        // Display bulletins in the selected view
        this.displayBulletins();
    }

    // Helper method to hide all views
    hideAllViews() {
        document.querySelectorAll('.bulletin-view').forEach(view => {
            view.classList.remove('active');
            console.log('🔍 Hiding view:', view.id, 'classes:', view.className);
        });
    }

    // Display Methods
    displayBulletins(filteredBulletins = null) {
        console.log('📋 displayBulletins called with:', filteredBulletins ? filteredBulletins.length : 'null', 'filtered bulletins');
        console.log('📋 Total bulletins in memory:', this.bulletins.length);
        console.log('📋 Current view:', this.currentView);

        // If no filtered bulletins provided, apply filters to get the correct set
        if (filteredBulletins === null) {
            console.log('🔍 No filtered bulletins provided, applying filters...');
            this.applyFilters();
            return; // applyFilters will call displayBulletins again with the filtered results
        }

        // Use filtered bulletins if provided
        let bulletinsToShow = filteredBulletins;

        // Update results info
        const totalBulletins = this.bulletins.length;
        const shownBulletins = bulletinsToShow.length;
        const resultsInfo = document.getElementById('resultsInfo');

        // Only show the message if filters are actually applied
        if (filteredBulletins && resultsInfo && this.areFiltersApplied()) {
            resultsInfo.textContent = `Showing ${shownBulletins} of ${totalBulletins} bulletins`;
            resultsInfo.style.display = 'block';
        } else if (resultsInfo) {
            resultsInfo.style.display = 'none';
        }

        if (bulletinsToShow.length === 0) {
            // Hide all views first when no bulletins to show
            this.hideAllViews();
            
            const emptyState = document.getElementById('emptyState');
            if (filteredBulletins) {
                emptyState.innerHTML = '<h3>No bulletins found</h3><p>Try adjusting your search or filter criteria.</p>';
            } else {
                emptyState.innerHTML = '<h3>No bulletins posted yet</h3><p>Advisors can log in to post job opportunities, training sessions, and important announcements.</p>';
            }
            emptyState.style.display = 'block';
            return;
        }

        // Hide empty state
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'none';

        // Display bulletins in the selected view
        switch(this.currentView) {
            case 'gallery':
                console.log('Switching to gallery view');
                this.displayGalleryView(bulletinsToShow);
                break;
            case 'list':
                console.log('Switching to list view');
                this.displayListView(bulletinsToShow);
                break;
            case 'calendar':
                console.log('Switching to calendar view');
                this.displayCalendarView(bulletinsToShow);
                break;
            default:
                console.error('Unknown view:', this.currentView);
        }

        // Handle deep-linking / highlighting if hash is present
        this.handleHashRouting();
    }

    displayGalleryView(bulletins) {
        console.log('🎨 Displaying gallery view with', bulletins.length, 'bulletins');
        
        // Hide all views first
        this.hideAllViews();
        
        const grid = document.getElementById('bulletinGrid');
        if (grid) {
            console.log('🎨 Adding active class to gallery view');
            grid.classList.add('active');
            grid.innerHTML = bulletins.map(bulletin => this.createBulletinCard(bulletin)).join('');
            console.log('🎨 Gallery view updated successfully');
            console.log('🎨 Gallery view classes:', grid.className);
            console.log('🎨 Gallery view computed display:', window.getComputedStyle(grid).display);
        } else {
            console.error('❌ Gallery view container not found');
        }
    }

    displayListView(bulletins) {
        console.log('📋 Displaying list view with', bulletins.length, 'bulletins');
        
        // Hide all views first
        this.hideAllViews();
        
        const list = document.getElementById('bulletinList');
        if (list) {
            console.log('📋 Adding active class to list view');
            list.classList.add('active');
            const listHTML = bulletins.map(bulletin => this.createBulletinListItem(bulletin)).join('');
            console.log('📋 Generated list HTML length:', listHTML.length, 'characters');
            console.log('📋 First 200 chars of list HTML:', listHTML.substring(0, 200));
            list.innerHTML = listHTML;
            console.log('📋 List view updated successfully');
            console.log('📋 List view classes:', list.className);
            console.log('📋 List view computed style display:', window.getComputedStyle(list).display);
        } else {
            console.error('❌ List view container not found');
        }
    }

    displayCalendarView(bulletins) {
        console.log('📅 Displaying calendar view with', bulletins.length, 'bulletins');
        
        // Hide all views first
        this.hideAllViews();
        
        const calendar = document.getElementById('bulletinCalendar');
        if (calendar) {
            console.log('📅 Adding active class to calendar view');
            calendar.classList.add('active');
            const calendarHTML = this.createCalendarView(bulletins);
            console.log('📅 Generated calendar HTML length:', calendarHTML.length, 'characters');
            console.log('📅 First 200 chars of calendar HTML:', calendarHTML.substring(0, 200));
            calendar.innerHTML = calendarHTML;
            console.log('📅 Calendar view updated successfully');
            console.log('📅 Calendar view classes:', calendar.className);
            console.log('📅 Calendar view computed style display:', window.getComputedStyle(calendar).display);
        } else {
            console.error('❌ Calendar view container not found');
        }
    }

    handleHashRouting() {
        const hash = window.location.hash;

        if (hash && hash.startsWith('#bulletin-')) {
            const bulletinId = hash.replace('#bulletin-', '');
            this.focusBulletinFromHash();
            this.showBulletinDetail(bulletinId);
        } else {
            this.closeBulletinDetail(false);
        }
    }

    focusBulletinFromHash() {
        const hash = window.location.hash;
        if (!hash || !hash.startsWith('#bulletin-')) {
            return;
        }

        const targetCard = document.querySelector(hash);
        if (!targetCard) {
            return;
        }

        // Apply highlight effect
        targetCard.classList.add('hash-highlight');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            targetCard.classList.remove('hash-highlight');
        }, 2800);

        this.lastHashHighlight = hash;
    }

    showBulletinDetail(bulletinId) {
        const modal = document.getElementById('bulletinDetailModal');
        const body = document.getElementById('bulletinDetailBody');
        if (!modal || !body) {
            return;
        }

        const bulletin = this.bulletins.find(b => b.id === bulletinId);

        if (!bulletin) {
            body.innerHTML = `<div class="detail-card"><p>This bulletin is no longer available.</p></div>`;
        } else {
            body.innerHTML = this.renderBulletinDetail(bulletin);
        }

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    closeBulletinDetail(updateHash = true) {
        const modal = document.getElementById('bulletinDetailModal');
        if (!modal) {
            return;
        }

        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');

        if (updateHash && window.location.hash.startsWith('#bulletin-')) {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }

    showDayEvents(bulletins) {
        const modal = document.getElementById('bulletinDetailModal');
        const body = document.getElementById('bulletinDetailBody');
        if (!modal || !body) {
            return;
        }

        // Create a list view of all events for this day
        const bulletinsList = bulletins.map(bulletin => {
            const isExpired = this.isBulletinExpired(bulletin);
            return `
                <div class="day-event-item ${isExpired ? 'expired' : ''}" onclick="event.stopPropagation(); bulletinBoard.showBulletinDetail('${bulletin.id}')">
                    <div class="day-event-header">
                        <h3 class="day-event-title">${this.escapeHtml(bulletin.title)}</h3>
                        <span class="category-badge category-${bulletin.category}">${this.getCategoryDisplay(bulletin.category)}</span>
                    </div>
                    ${bulletin.description ? `<p class="day-event-description">${this.escapeHtml(bulletin.description.substring(0, 150))}${bulletin.description.length > 150 ? '...' : ''}</p>` : ''}
                    <p class="day-event-meta">Posted by ${this.escapeHtml(bulletin.advisorName)}</p>
                    ${isExpired ? '<span class="expired-label">EXPIRED</span>' : ''}
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div class="detail-card">
                <h2 style="margin-bottom: 20px;">Events on this day (${bulletins.length})</h2>
                <div class="day-events-list">
                    ${bulletinsList}
                </div>
                <div class="detail-actions" style="margin-top: 24px;">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    createBulletinCard(bulletin) {
        const postedDate = new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);

        const descriptionHtml = this.renderFormattedDescription(bulletin.description || '', bulletin.id, true);

        return `
            <div class="bulletin-card ${isExpired ? 'expired-bulletin' : ''}" id="bulletin-${bulletin.id}">
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

                <div class="bulletin-description" data-bulletin-id="${bulletin.id}">
                    ${descriptionHtml}
                </div>

                <div class="bulletin-meta">
                    ${bulletin.company ? `
                        <div class="meta-item">
                            <strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}
                        </div>
                    ` : ''}

                    ${bulletin.eventTime ? `
                        <div class="meta-item">
                            <strong>Time:</strong> ${this.escapeHtml(this.formatEventTime(bulletin.eventTime))}
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

                    ${this.renderDateInfo(bulletin)}

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
                        ${bulletin.pdfUrl ? `
                            <a href="#" target="_blank" class="pdf-btn" title="View PDF document" data-pdf-url="${bulletin.pdfUrl.substring(0, 100)}..." onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}'); return false;" onkeydown="if(event.key==='Enter'||event.key===' '){window.bulletinBoard.openPdfFromBulletin('${bulletin.id}');return false;}" role="button" aria-label="View PDF document for ${this.escapeHtml(bulletin.title)}" tabindex="0">
                                📄 PDF
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

    renderBulletinDetail(bulletin) {
        const postedDate = new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString();
        const deadlineText = bulletin.deadline ? new Date(bulletin.deadline).toLocaleDateString() : null;
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);

        return `
            <article class="detail-card ${isExpired ? 'expired-bulletin' : ''}" id="detail-${bulletin.id}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
                <div class="detail-header">
                    <div>
                        <div class="detail-title">${this.escapeHtml(bulletin.title)}</div>
                        <p class="detail-subtitle">Posted by ${this.escapeHtml(bulletin.advisorName)} • ${postedDate}</p>
                    </div>
                    <span class="category-badge category-${bulletin.category}">${this.getCategoryDisplay(bulletin.category)}</span>
                </div>

                ${bulletin.image ? `
                    <div class="detail-image">
                        <img src="${bulletin.image}" alt="Bulletin image for ${this.escapeHtml(bulletin.title)}">
                    </div>
                ` : ''}

                <div class="detail-body">
                    ${bulletin.description ? this.renderFormattedDescription(bulletin.description, `${bulletin.id}-detail`) : ''}

                        ${bulletin.company ? `
                            <p><strong>Organization:</strong> ${this.escapeHtml(bulletin.company)}</p>
                        ` : ''}

                        ${bulletin.eventTime ? `
                            <p><strong>Time:</strong> ${this.escapeHtml(this.formatEventTime(bulletin.eventTime))}</p>
                        ` : ''}

                        ${bulletin.classType ? `
                            <p><strong>Class Type:</strong> ${this.getClassTypeDisplay(bulletin.classType)}</p>
                        ` : ''}

                        ${bulletin.contact ? `
                            <p><strong>Contact:</strong><br>${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}</p>
                        ` : ''}

                        ${bulletin.eventLink ? `
                            <p><strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(bulletin.eventLink, bulletin.category))}</a></p>
                        ` : ''}
                    </div>

                <div class="detail-meta">
                    ${this.renderDetailDateInfo(bulletin)}
                    <div><strong>Posted:</strong> ${postedDate}</div>
                </div>

                <div class="detail-actions">
                    <button type="button" class="close-btn" onclick="window.bulletinBoard.closeBulletinDetail()">Close</button>
                    ${bulletin.pdfUrl ? `
                        <a href="#" target="_blank" class="pdf-btn" title="View PDF" data-pdf-url="${bulletin.pdfUrl.substring(0, 100)}..." onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}'); return false;">
                            📄 PDF
                        </a>
                    ` : ''}
                    <button type="button" class="share-btn" onclick="shareBulletin('${bulletin.id}', '${this.escapeHtml(bulletin.title).replace(/'/g, "&#39;")}')">📤 Share</button>
                </div>
            </article>
        `;
    }

    // Filter and Search Methods
    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();

        let filteredBulletins = [...this.bulletins];

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
                    const postedDate = new Date(b.datePosted.toDate ? b.datePosted.toDate() : b.datePosted);
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

        // Apply posted by filters (multi-select)
        if (this.selectedPostedBy.length > 0) {
            filteredBulletins = filteredBulletins.filter(b => {
                return this.selectedPostedBy.includes(b.advisorName);
            });
        }

        // Apply search filter
        if (searchTerm) {
            filteredBulletins = filteredBulletins.filter(b => {
                const description = (b.description || '').toLowerCase();
                const company = (b.company || '').toLowerCase();
                const contact = (b.contact || '').toLowerCase();
                const eventLink = (b.eventLink || '').toLowerCase();
                const advisorName = (b.advisorName || '').toLowerCase();
                const title = (b.title || '').toLowerCase();
                return (
                    title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    company.includes(searchTerm) ||
                    contact.includes(searchTerm) ||
                    eventLink.includes(searchTerm) ||
                    advisorName.includes(searchTerm)
                );
            });
        }

        // Apply expired filter
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        console.log('🔍 Show expired toggle found:', !!showExpiredToggle);
        console.log('🔍 Show expired toggle checked:', showExpiredToggle ? showExpiredToggle.checked : 'not found');
        
        if (showExpiredToggle && !showExpiredToggle.checked) {
            console.log('🚫 Applying expired filter...');
            const now = new Date();
            const beforeCount = filteredBulletins.length;
            
            filteredBulletins = filteredBulletins.filter(b => {
                const isExpired = this.isBulletinExpired(b);
                if (isExpired) {
                    console.log(`🗑️ Filtering out expired bulletin: "${b.title}"`);
                }
                return !isExpired;
            });
            
            const afterCount = filteredBulletins.length;
            console.log(`🚫 Expired filter: ${beforeCount} -> ${afterCount} bulletins`);
        } else {
            console.log('✅ Show expired toggle is ON or not found - showing all bulletins');
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
        this.selectedPostedBy = [];

        // Reset expired toggle
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        if (showExpiredToggle) {
            showExpiredToggle.checked = false;
        }

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

    toggleFiltersPanel() {
        const filterControls = document.getElementById('filterControls');
        const toggleBtn = document.getElementById('toggleFilters');
        
        if (filterControls && toggleBtn) {
            const isVisible = filterControls.style.display !== 'none';
            
            if (isVisible) {
                filterControls.style.display = 'none';
                toggleBtn.innerHTML = '<span>🔧</span> Filters';
            } else {
                filterControls.style.display = 'block';
                toggleBtn.innerHTML = '<span>🔧</span> Hide Filters';
            }
        }
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
        } else if (type === 'postedby') {
            const index = this.selectedPostedBy.indexOf(value);
            if (index > -1) {
                this.selectedPostedBy.splice(index, 1);
            } else {
                this.selectedPostedBy.push(value);
            }
        }

        this.updateFilterCount();
        this.applyFilters();
    }

    updateFilterCount() {
        const total = this.selectedCategories.length + this.selectedPostedDates.length + this.selectedDeadlines.length + this.selectedClassTypes.length + this.selectedPostedBy.length;
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

    areFiltersApplied() {
        // Check if any filters are active
        const hasCategoryFilters = this.selectedCategories.length > 0;
        const hasPostedDateFilters = this.selectedPostedDates.length > 0;
        const hasDeadlineFilters = this.selectedDeadlines.length > 0;
        const hasClassTypeFilters = this.selectedClassTypes.length > 0;
        const hasPostedByFilters = this.selectedPostedBy.length > 0;
        const hasSearchTerm = document.getElementById('searchInput').value.trim() !== '';
        const showExpiredToggle = document.getElementById('showExpiredToggle');
        // Only consider expired toggle as a filter when it's turned ON (showing expired items)
        // When OFF (default), it's the normal behavior, not a filter
        const hasExpiredFilter = showExpiredToggle && showExpiredToggle.checked;


        return hasCategoryFilters || hasPostedDateFilters || hasDeadlineFilters || hasClassTypeFilters || hasPostedByFilters || hasSearchTerm || hasExpiredFilter;
    }

    loadBulletins() {
        // This is now handled by the real-time listener
        // but we keep this method for compatibility
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

    isDeadlineClose(deadline) {
        const deadlineDate = new Date(deadline);
        const today = new Date();
        const timeDiff = deadlineDate.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        return daysDiff <= 7 && daysDiff >= 0;
    }

    isBulletinExpired(bulletin) {
        const now = new Date();
        
        // Check deadline-based expiration
        if (bulletin.deadline) {
            const deadline = new Date(bulletin.deadline);
            return deadline < now;
        }
        
        // Check event-based expiration (with end time)
        if (bulletin.eventDate && bulletin.endTime) {
            // endTime is stored in 24-hour format (e.g., "14:00")
            const eventDateTime = new Date(`${bulletin.eventDate}T${bulletin.endTime}:00`);
            return eventDateTime < now;
        }
        
        // Check event-based expiration (without end time, assume end of day)
        if (bulletin.eventDate && !bulletin.endTime) {
            const eventDate = new Date(bulletin.eventDate);
            const endOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59);
            return endOfDay < now;
        }
        
        // Check start/end date range expiration
        if (bulletin.startDate && bulletin.endDate) {
            const endDate = new Date(bulletin.endDate);
            const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
            return endOfDay < now;
        }
        
        // Not expired if no date/time information
        return false;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Convert data URL to blob URL for better browser compatibility
    dataUrlToBlobUrl(dataUrl) {
        try {
            // Convert data URL to blob
            const response = fetch(dataUrl);
            return response.then(res => res.blob())
                .then(blob => {
                    const blobUrl = URL.createObjectURL(blob);
                    return blobUrl;
                });
        } catch (error) {
            console.error('Error converting data URL to blob URL:', error);
            return dataUrl; // Fallback to original data URL
        }
    }

    // Open PDF from bulletin ID by looking up the bulletin data
    async openPdfFromBulletin(bulletinId) {
        try {
            console.log('=== PDF OPENING DEBUG START ===');
            console.log('Opening PDF for bulletin ID:', bulletinId);
            console.log('Total bulletins loaded:', this.bulletins.length);
            
            // Show loading state
            this.showTemporaryMessage('Loading PDF...', 'info');
            
            // Find the bulletin in our current data
            const bulletin = this.bulletins.find(b => b.id === bulletinId);
            console.log('Found bulletin:', bulletin ? 'YES' : 'NO');
            
            if (!bulletin) {
                console.error('Bulletin not found in this.bulletins array');
                throw new Error('Bulletin not found.');
            }
            
            if (!bulletin.pdfUrl) {
                console.error('No PDF URL in bulletin object');
                throw new Error('PDF not found for this bulletin.');
            }
            
            console.log('Found bulletin with PDF URL:', bulletin.pdfUrl);
            
            // Check if it's a Firebase Storage URL or base64 data URL
            if (bulletin.pdfUrl && bulletin.pdfUrl.startsWith('data:')) {
                // Handle old base64 data URLs
                console.log('Processing base64 data URL, length:', bulletin.pdfUrl.length);
                
                // Check for browser support
                if (!window.fetch || !window.URL || !window.URL.createObjectURL) {
                    throw new Error('Your browser does not support PDF viewing. Please try a modern browser.');
                }
                
                console.log('Attempting to fetch data URL...');
                const response = await fetch(bulletin.pdfUrl);
                console.log('Fetch response status:', response.status);
                console.log('Fetch response ok:', response.ok);
                
                const blob = await response.blob();
                console.log('Blob created, size:', blob.size, 'type:', blob.type);
                
                // Create blob URL
                const blobUrl = URL.createObjectURL(blob);
                console.log('Created blob URL:', blobUrl);
                
                // Open in new tab
                console.log('Attempting to open new window...');
                const newWindow = window.open(blobUrl, '_blank');
                
                // Clean up blob URL after a delay
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    console.log('Blob URL revoked');
                }, 10000);
                
                if (!newWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site.');
                }
            } else {
                // Handle Firebase Storage URLs (direct download)
                console.log('Opening Firebase Storage URL directly');
                const newWindow = window.open(bulletin.pdfUrl, '_blank');
                
                if (!newWindow) {
                    throw new Error('Popup blocked. Please allow popups for this site.');
                }
                
                console.log('New window opened successfully');
            }
            
            console.log('=== PDF OPENING DEBUG END ===');
            
        } catch (error) {
            console.error('=== PDF OPENING ERROR ===');
            console.error('Error opening PDF:', error);
            console.error('Error stack:', error.stack);
            alert('Failed to open PDF: ' + error.message);
        }
    }

    // Legacy method - keeping for compatibility
    async openPdfFromDataUrl(dataUrl) {
        try {
            console.log('Opening PDF from data URL, length:', dataUrl.length);
            
            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Create blob URL
            const blobUrl = URL.createObjectURL(blob);
            console.log('Created blob URL:', blobUrl);
            
            // Open in new tab
            const newWindow = window.open(blobUrl, '_blank');
            
            // Clean up blob URL after a delay (browser should have loaded it by then)
            setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
            }, 10000); // 10 seconds
            
            if (!newWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }
            
        } catch (error) {
            console.error('Error opening PDF:', error);
            alert('Failed to open PDF. Please try again or check your browser settings.');
        }
    }

    escapeAttribute(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    formatEventTime(timeString) {
        if (!timeString) return '';
        try {
            const [hourStr, minuteStr] = timeString.split(':');
            let hour = parseInt(hourStr, 10);
            const minute = minuteStr || '00';
            if (isNaN(hour)) return timeString;
            const period = hour >= 12 ? 'PM' : 'AM';
            hour = hour % 12;
            if (hour === 0) hour = 12;
            return `${hour}:${minute.padStart(2, '0')} ${period}`;
        } catch (error) {
            return timeString;
        }
    }

    renderFormattedDescription(rawText, bulletinId, collapsed = false) {
        if (!rawText) {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = rawText || '';
        const safeText = div.innerHTML;

        const formatted = this.applyInlineFormatting(safeText)
            .split(/\n{2,}/)
            .map(segment => `<p>${segment.replace(/\n/g, '<br>')}</p>`)
            .join('');

        if (!collapsed) {
            return `<div class="description-content expanded">${formatted}</div>`;
        }

        const id = bulletinId;

        return `
            <div class="description-wrapper" data-bulletin="${id}">
                <div class="description-content">${formatted}</div>
                <button type="button" class="toggle-description" data-bulletin="${id}" aria-expanded="false">Read more</button>
            </div>
        `;
    }

    formatRichText(rawText) {
        const div = document.createElement('div');
        div.textContent = rawText || '';
        return this.applyInlineFormatting(div.innerHTML);
    }

    applyInlineFormatting(html) {
        return (html || '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/`(.+?)`/g, '<code>$1</code>');
    }

    handleDescriptionToggle(event) {
        const button = event.target.closest('.toggle-description');
        if (!button) {
            return;
        }

        // Get the bulletin ID and open the full modal
        const bulletinId = button.getAttribute('data-bulletin');
        if (bulletinId) {
            this.showBulletinDetail(bulletinId);
        }
    }

    renderDateInfo(bulletin) {
        // Prioritize new date structure over backward compatibility
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.startDate && bulletin.endDate))) {
            return this.renderNewDateInfo(bulletin);
        }

        // Backward compatibility - show deadline if it exists
        if (bulletin.deadline) {
            const isDeadlineClose = this.isDeadlineClose(bulletin.deadline);
            return `
                <div class="meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                    <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                    ${isDeadlineClose ? ' (Soon!)' : ''}
                </div>
            `;
        }

        return '';
    }

    renderNewDateInfo(bulletin) {
        const dateType = bulletin.dateType;
        let dateHtml = '';

        if (dateType === 'deadline') {
            const isClose = this.isDeadlineClose(bulletin.eventDate);
            dateHtml = `
                <div class="meta-item ${isClose ? 'deadline-warning' : ''}">
                    <strong>Application Deadline:</strong> ${this.formatDateLocal(bulletin.eventDate)}
                    ${isClose ? ' (Soon!)' : ''}
                </div>
            `;
        } else if (dateType === 'event') {
            const isClose = this.isDeadlineClose(bulletin.eventDate);
            let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            dateHtml = `
                <div class="meta-item ${isClose ? 'deadline-warning' : ''}">
                    <strong>Event Date:</strong> ${this.formatDateLocal(bulletin.eventDate)}${timeInfo ? ` at ${timeInfo}` : ''}
                    ${isClose ? ' (Soon!)' : ''}
                </div>
            `;
        } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
            let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            dateHtml = `
                <div class="meta-item">
                    <strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}
                </div>
            `;
        }

        // Add event location if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
            const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                               bulletin.eventLocation === 'online' ? 'Online' :
                               bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
            dateHtml += `
                <div class="meta-item">
                    <strong>Format:</strong> ${locationText}
                </div>
            `;
        }

        return dateHtml;
    }

    renderDetailDateInfo(bulletin) {
        // Prioritize new date structure
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.startDate && bulletin.endDate))) {
            const dateType = bulletin.dateType;
            let dateHtml = '';

            if (dateType === 'deadline') {
                const isClose = this.isDeadlineClose(bulletin.eventDate);
                dateHtml = `<div><strong>Application Deadline:</strong> <span class="${isClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.eventDate)}${isClose ? ' (Soon!)' : ''}</span></div>`;
            } else if (dateType === 'event') {
                const isClose = this.isDeadlineClose(bulletin.eventDate);
                let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
                dateHtml = `<div><strong>Event Date:</strong> <span class="${isClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.eventDate)}${timeInfo ? ` at ${timeInfo}` : ''}${isClose ? ' (Soon!)' : ''}</span></div>`;
            } else if (dateType === 'range' && bulletin.startDate && bulletin.endDate) {
                let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
                dateHtml = `<div><strong>Event Dates:</strong> ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}</div>`;
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range')) {
                const locationText = bulletin.eventLocation === 'in-person' ? 'In-Person' :
                                   bulletin.eventLocation === 'online' ? 'Online' :
                                   bulletin.eventLocation === 'hybrid' ? 'Hybrid (In-Person & Online)' : bulletin.eventLocation;
                dateHtml += `<div><strong>Format:</strong> ${locationText}</div>`;
            }

            return dateHtml;
        }

        // Backward compatibility
        if (bulletin.deadline) {
            const isDeadlineClose = this.isDeadlineClose(bulletin.deadline);
            return `
                <div><strong>Deadline:</strong> <span class="${isDeadlineClose ? 'deadline-warning' : ''}">${this.formatDateLocal(bulletin.deadline)}${isDeadlineClose ? ' (Soon!)' : ''}</span></div>
            `;
        }

        return '';
    }

    formatDateLocal(dateString) {
        if (!dateString) return '';

        // Create date object and format in local timezone
        // This prevents the date from shifting due to UTC conversion
        const date = new Date(dateString + 'T00:00:00');
        return date.toLocaleDateString();
    }

    formatTimeRange(startTime, endTime) {
        if (!startTime && !endTime) return '';

        if (startTime && endTime) {
            return `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`;
        } else if (startTime) {
            return this.formatTime(startTime);
        }

        return '';
    }

    formatTime(timeString) {
        if (!timeString) return '';

        // Convert 24-hour format to 12-hour format
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    createBulletinListItem(bulletin) {
        const postedDate = new Date(bulletin.datePosted?.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        const isExpired = this.isBulletinExpired(bulletin);
        const descriptionHtml = this.renderFormattedDescription(bulletin.description || '', bulletin.id, true);

        return `
            <div class="bulletin-list-item ${isExpired ? 'expired-bulletin' : ''}">
                ${isExpired ? '<div class="expired-banner">EXPIRED</div>' : ''}
                <div class="bulletin-list-category">
                    <span class="category-badge category-${bulletin.category}">
                        ${this.getCategoryDisplay(bulletin.category)}
                    </span>
                </div>

                <div class="bulletin-list-content">
                    <div class="bulletin-list-header">
                        <div class="bulletin-list-title">${this.escapeHtml(bulletin.title)}</div>
                    </div>

                    <div class="bulletin-list-description">
                        ${descriptionHtml}
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

                        ${bulletin.eventLink ? `
                            <div class="bulletin-list-meta-item">
                                <strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.eventLink)}" target="_blank" rel="noopener">${this.escapeHtml(this.formatLinkLabel(bulletin.eventLink, bulletin.category))}</a>
                            </div>
                        ` : ''}

                        ${this.renderDateInfo(bulletin)}

                        ${bulletin.deadline ? `
                            <div class="bulletin-list-meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                                <strong>Deadline:</strong> ${new Date(bulletin.deadline).toLocaleDateString()}
                                ${isDeadlineClose ? ' (Soon!)' : ''}
                            </div>
                        ` : ''}

                        <div class="bulletin-list-meta-item">
                            <strong>Posted:</strong> ${postedDate}
                        </div>

                        <div class="bulletin-list-meta-item">
                            <strong>By:</strong> ${this.escapeHtml(bulletin.advisorName)}
                        </div>
                    </div>

                    <div class="bulletin-list-actions">
                        ${bulletin.pdfUrl ? `
                            <a href="#" target="_blank" class="pdf-btn" title="View PDF document" data-pdf-url="${bulletin.pdfUrl.substring(0, 100)}..." onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}'); return false;" onkeydown="if(event.key==='Enter'||event.key===' '){window.bulletinBoard.openPdfFromBulletin('${bulletin.id}');return false;}" role="button" aria-label="View PDF document for ${this.escapeHtml(bulletin.title)}" tabindex="0">
                                📄 PDF
                            </a>
                        ` : ''}
                        <button type="button" class="share-btn" onclick="window.bulletinBoard.shareBulletin('${bulletin.id}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createCalendarView(bulletins) {
        // Filter to only show bulletins with deadlines or events
        const calendarBulletins = bulletins.filter(bulletin => {
            return bulletin.deadline || bulletin.eventDate || bulletin.startDate;
        });

        // Group bulletins by date - use event date if available, otherwise deadline
        const bulletinsByDate = {};
        calendarBulletins.forEach(bulletin => {
            let date;

            // Use event date if available, otherwise use deadline
            if (bulletin.eventDate) {
                // Add time component to prevent timezone shift
                date = new Date(bulletin.eventDate + 'T12:00:00');
            } else if (bulletin.startDate) {
                // Add time component to prevent timezone shift
                date = new Date(bulletin.startDate + 'T12:00:00');
            } else if (bulletin.deadline) {
                date = new Date(bulletin.deadline + 'T12:00:00');
            } else {
                // Skip bulletins without deadlines or events
                return;
            }

            const dateKey = date.toDateString();
            if (!bulletinsByDate[dateKey]) {
                bulletinsByDate[dateKey] = [];
            }
            bulletinsByDate[dateKey].push(bulletin);
        });

        // Get current month and year (use stored values if available)
        const today = new Date();
        const currentMonth = this.currentCalendarMonth !== undefined ? this.currentCalendarMonth : today.getMonth();
        const currentYear = this.currentCalendarYear !== undefined ? this.currentCalendarYear : today.getFullYear();
        
        // Get first day of month and number of days
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Create calendar header
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let calendarHTML = `
            <div class="monthly-calendar">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" onclick="bulletinBoard.previousMonth()" title="Previous Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                    </button>
                    <h2 class="calendar-month">${monthNames[currentMonth]} ${currentYear}</h2>
                    <button class="calendar-nav-btn" onclick="bulletinBoard.nextMonth()" title="Next Month">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="calendar-weekdays">
                    ${dayNames.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
                </div>
                <div class="calendar-days">
        `;

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            calendarHTML += `<div class="calendar-day empty"></div>`;
        }

        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dateKey = date.toDateString();
            const dayBulletins = bulletinsByDate[dateKey] || [];
            const isToday = date.toDateString() === today.toDateString();
            
            calendarHTML += this.createMonthlyCalendarDay(day, dayBulletins, isToday);
        }

        calendarHTML += `
                </div>
            </div>
        `;

        return calendarHTML;
    }

    createMonthlyCalendarDay(day, bulletins, isToday) {
        const bulletinCount = bulletins.length;
        const hasBulletins = bulletinCount > 0;
        const clickHandler = hasBulletins ? `onclick="bulletinBoard.showDayEvents(${JSON.stringify(bulletins).replace(/"/g, '&quot;')})"` : '';

        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasBulletins ? 'has-bulletins' : ''}"
                 data-bulletin-count="${bulletinCount}"
                 ${clickHandler}
                 style="${hasBulletins ? 'cursor: pointer;' : ''}">
                <div class="calendar-day-number">
                    <span>${day}</span>
                    ${bulletinCount > 0 ? `<span class="event-count-badge">${bulletinCount}</span>` : ''}
                </div>
                <div class="calendar-day-content">
                    ${hasBulletins ? `
                        <div class="calendar-bulletins">
                            ${bulletins.slice(0, 3).map(bulletin => this.createMonthlyBulletinItem(bulletin)).join('')}
                            ${bulletins.length > 3 ? `<div class="more-bulletins">+${bulletins.length - 3} more</div>` : ''}
                        </div>
                    ` : ''}
                </div>
                ${isToday ? '<div class="today-indicator"></div>' : ''}
            </div>
        `;
    }

    createCalendarDay(date, bulletins) {
        const isToday = date.toDateString() === new Date().toDateString();
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNumber = date.getDate();

        return `
            <div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-header">
                    <div class="calendar-day-date">${dayNumber}</div>
                    <div class="calendar-day-weekday">${dayOfWeek}</div>
                </div>
                <div class="calendar-day-bulletins">
                    ${bulletins.map(bulletin => this.createCalendarBulletinItem(bulletin)).join('')}
                </div>
                ${isToday ? '<div class="today-badge">Today</div>' : ''}
            </div>
        `;
    }

    createMonthlyBulletinItem(bulletin) {
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="monthly-bulletin-item" onclick="bulletinBoard.showBulletinDetail('${bulletin.id}')">
                <div class="monthly-bulletin-category category-${bulletin.category}"></div>
                <div class="monthly-bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                ${displayDate ? `
                    <div class="monthly-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                        ${displayDate}
                    </div>
                ` : ''}
            </div>
        `;
    }

    createCalendarBulletinItem(bulletin) {
        const isDeadlineClose = bulletin.deadline && this.isDeadlineClose(bulletin.deadline);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(bulletin.title)}</div>
                <div class="calendar-bulletin-category">${this.getCategoryDisplay(bulletin.category)}</div>
                <div class="calendar-bulletin-description">${this.escapeHtml(bulletin.description || '').substring(0, 100)}${bulletin.description && bulletin.description.length > 100 ? '...' : ''}</div>
                <div class="calendar-bulletin-meta">
                    ${displayDate ? `
                        <div class="calendar-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                            ${displayDate}
                            ${isDeadlineClose ? ' (Soon!)' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    checkAutoLogin() {
        // Not needed for public viewing page
    }

    // Calendar Navigation Methods
    previousMonth() {
        this.currentCalendarMonth--;
        if (this.currentCalendarMonth < 0) {
            this.currentCalendarMonth = 11;
            this.currentCalendarYear--;
        }
        console.log('📅 Previous month:', this.currentCalendarMonth, this.currentCalendarYear);
        this.displayBulletins();
    }

    nextMonth() {
        this.currentCalendarMonth++;
        if (this.currentCalendarMonth > 11) {
            this.currentCalendarMonth = 0;
            this.currentCalendarYear++;
        }
        console.log('📅 Next month:', this.currentCalendarMonth, this.currentCalendarYear);
        this.displayBulletins();
    }
}

// Share functionality
function shareBulletin(bulletinId, bulletinTitle) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#bulletin-${bulletinId}`;
    fallbackShare(bulletinTitle, shareUrl);
}

function fallbackShare(title, url) {
    // Ensure any existing share modal is closed before opening a new one
    closeShareModal();

    // Create share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <h3>Share This Opportunity</h3>
            <div class="share-options">
                <button onclick="shareVia('whatsapp', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option whatsapp">
                    📱 WhatsApp
                </button>
                <button onclick="shareVia('facebook', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option facebook">
                    📘 Facebook
                </button>
                <button onclick="shareVia('email', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option email">
                    ✉️ Email
                </button>
                <button onclick="shareVia('sms', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option sms">
                    💬 Text Message
                </button>
            </div>
            <div class="share-link">
                <input type="text" value="${url}" id="shareLink" readonly>
                <button onclick="copyLink()" class="copy-btn">Copy Link</button>
            </div>
            <button onclick="closeShareModal()" class="close-share">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
}

function shareVia(platform, title, url) {
    const shareUrls = {
        whatsapp: `https://wa.me/?text=${title}%20${url}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        email: `mailto:?subject=${title}&body=Check out this opportunity: ${url}`,
        sms: `sms:?body=${title} ${url}`
    };

    window.open(shareUrls[platform], '_blank');
    closeShareModal();
}

function copyLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        const copyBtn = document.querySelector('.copy-btn');
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#27ae60';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
            copyBtn.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

function closeShareModal() {
    const modal = document.querySelector('.share-modal');
    if (modal) modal.remove();
}

// Initialize the bulletin board when page loads
let bulletinBoard;
document.addEventListener('DOMContentLoaded', () => {
    bulletinBoard = new FirebaseBulletinBoard();
    // Expose for global access after initialization
    window.bulletinBoard = bulletinBoard;
});
