// Advisor management, the Manage list, and resource reordering.
// Extracted verbatim from firebase-admin.js; methods are merged onto
// FirebaseAdminPanel.prototype by applyMethods() in firebase-admin.js.
import { db } from './firebase.js'
import { getPublicAdvisorEmail } from './advisor-directory.js'
import { isPrivilegedAdminEmail } from './admin-roles.js'
import { isDocumentResource } from './resource-kinds.js'
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

export class AdminManageMethods {
    canManageAllPosts() {
        return this.currentUser?.isAdmin === true;
    }

    /** Google account used for portal sign-in (matches google-auth.js). */
    getAdvisorAuthEmail(username) {
        const u = String(username || '').trim().toLowerCase();
        if (!u) return '';
        return `${u}@ebhcs.org`;
    }

    // ── Advisor Management ────────────────────────────────────────────

    loadAdvisors() {
        const container = document.getElementById('advisorsList');
        if (!container) return;
        if (!this.advisors.length) {
            container.innerHTML = '<p class="manage-empty">No advisors found.</p>';
            return;
        }
        const sorted = [...this.advisors].sort((a, b) => {
            const nameA = a.displayName || a.username || '';
            const nameB = b.displayName || b.username || '';
            return nameA.localeCompare(nameB);
        });
        container.innerHTML = sorted.map(a => `
            <div class="manage-card advisor-card" data-username="${this.escapeHtml(a.username)}">
                <div class="manage-card-header">
                    <h5>${this.escapeHtml(a.displayName)}</h5>
                    ${a.isAdmin ? '<span class="advisor-admin-badge">Admin</span>' : ''}
                </div>
                <div class="manage-card-body">
                    <p><strong>Username:</strong> ${this.escapeHtml(a.username)}</p>
                    <p><strong>Email:</strong> ${this.escapeHtml(getPublicAdvisorEmail(a))}</p>
                </div>
                <div class="manage-actions advisor-manage-actions">
                    <div class="manage-actions-primary">
                        <button type="button" class="edit-btn" onclick="adminPanel.openEditAdvisor('${this.escapeHtml(a.username)}')">Edit</button>
                        ${a.username !== this.currentUser.username ? `<button type="button" class="delete-btn" onclick="adminPanel.deleteAdvisor('${this.escapeHtml(a.username)}')">Remove</button>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    openEditAdvisor(username) {
        const advisor = this.advisors.find(a => a.username === username);
        if (!advisor) return;
        document.getElementById('editAdvisorUsername').value = advisor.username;
        document.getElementById('editAdvisorDisplayName').value = advisor.displayName;
        document.getElementById('editAdvisorEmail').value = getPublicAdvisorEmail(advisor);
        document.getElementById('editAdvisorIsAdmin').checked = advisor.isAdmin || false;
        document.getElementById('editAdvisorPublicRole').value = advisor.publicRole || 'Advisor';
        document.getElementById('editAdvisorShowInDirectory').checked = advisor.showInDirectory !== false;
        document.getElementById('editAdvisorModal').style.display = 'flex';
    }

    closeEditAdvisor() {
        document.getElementById('editAdvisorModal').style.display = 'none';
    }

    async saveEditAdvisor() {
        const username = document.getElementById('editAdvisorUsername').value.trim();
        const displayName = document.getElementById('editAdvisorDisplayName').value.trim();
        const email = document.getElementById('editAdvisorEmail').value.trim();
        const isAdmin = document.getElementById('editAdvisorIsAdmin').checked;
        const publicRole = document.getElementById('editAdvisorPublicRole').value.trim() || 'Advisor';
        const showInDirectory = document.getElementById('editAdvisorShowInDirectory').checked;
        if (!username || !displayName) {
            this.showToast('Display name is required.', 'error'); return;
        }
        // Guard against double-clicks / slow Firestore responses firing two
        // concurrent saves (which would each re-publish the student directory).
        if (this.isSavingAdvisor) return;
        this.isSavingAdvisor = true;
        try {
            await updateDoc(doc(db, 'advisors', username), { displayName, email, isAdmin, publicRole, showInDirectory });
            const idx = this.advisors.findIndex(a => a.username === username);
            if (idx !== -1) this.advisors[idx] = { ...this.advisors[idx], displayName, email, isAdmin, publicRole, showInDirectory };
            await this.publishStudentDirectory();
            // Keep current user's name in sync
            if (this.currentUser.username === username) {
                this.currentUser.name = displayName;
                this.currentUser.isAdmin = isAdmin;
                document.getElementById('welcomeMessage').textContent = `Welcome, ${displayName}!`;
            }
            this.closeEditAdvisor();
            this.loadAdvisors();
            // The Admin checkbox only unlocks admin screens in this portal.
            // Server-side privileges (edit/delete anyone's posts) come from the
            // isPrivilegedAdvisor email list in firestore.rules, which needs a
            // developer to change — warn so the mismatch isn't a surprise.
            if (isAdmin && !isPrivilegedAdminEmail(this.getAdvisorAuthEmail(username))) {
                this.showToast('Saved. Note: full admin rights (managing other advisors’ posts) also require a developer to add this account to the security rules — see DEPLOYMENT.md.', 'info');
            } else {
                this.showToast('Advisor updated.', 'success');
            }
        } catch (e) {
            this.showToast('Error saving advisor: ' + e.message, 'error');
        } finally {
            this.isSavingAdvisor = false;
        }
    }

    async addAdvisor() {
        const username = document.getElementById('newAdvisorUsername').value.trim().toLowerCase();
        const displayName = document.getElementById('newAdvisorDisplayName').value.trim();
        const email = document.getElementById('newAdvisorEmail').value.trim().toLowerCase();
        const isAdmin = document.getElementById('newAdvisorIsAdmin').checked;
        const publicRole = document.getElementById('newAdvisorPublicRole').value.trim() || 'Advisor';
        const showInDirectory = document.getElementById('newAdvisorShowInDirectory').checked;
        if (!username || !displayName) {
            this.showToast('Username and display name are required.', 'error'); return;
        }
        // Access is granted by matching the Google sign-in email against
        // advisors/{username}, so the username must be their real email prefix.
        if (email && !email.endsWith('@ebhcs.org')) {
            this.showToast('Email must be an @ebhcs.org address — it is what they sign in with.', 'error'); return;
        }
        if (email && email.split('@')[0] !== username) {
            this.showToast(`Username must match their email: use "${email.split('@')[0]}" for ${email}.`, 'error'); return;
        }
        if (this.advisors.find(a => a.username === username)) {
            this.showToast('An advisor with that username already exists.', 'error'); return;
        }
        try {
            const loginEmail = (email || `${username}@ebhcs.org`).trim().toLowerCase();
            await setDoc(doc(db, 'advisors', username), {
                displayName,
                email: loginEmail,
                isAdmin,
                publicRole,
                showInDirectory,
                createdAt: serverTimestamp()
            });
            this.advisors.push({ username, displayName, email: loginEmail, isAdmin, publicRole, showInDirectory });
            await this.publishStudentDirectory();
            document.getElementById('newAdvisorUsername').value = '';
            document.getElementById('newAdvisorDisplayName').value = '';
            document.getElementById('newAdvisorEmail').value = '';
            document.getElementById('newAdvisorIsAdmin').checked = false;
            document.getElementById('newAdvisorPublicRole').value = '';
            document.getElementById('newAdvisorShowInDirectory').checked = true;
            this.loadAdvisors();
            this.showToast(`${displayName} added to the advisor list.`, 'success');
            this.showTemporaryMessage(
                `Done — no other setup needed. Tell them to open the Advisor Portal and click "Sign in with Google" using ${loginEmail}.`,
                'info'
            );
        } catch (e) {
            this.showToast('Error adding advisor: ' + e.message, 'error');
        }
    }

    async deleteAdvisor(username) {
        const advisor = this.advisors.find(a => a.username === username);
        if (!advisor) return;
        if (!confirm(`Remove ${advisor.displayName} as an advisor?\n\nThis immediately locks them out of the portal — even if they sign in with Google, they will be turned away.`)) return;
        try {
            await deleteDoc(doc(db, 'advisors', username));
            this.advisors = this.advisors.filter(a => a.username !== username);
            await this.publishStudentDirectory();
            this.loadAdvisors();
            this.showToast(`${advisor.displayName} removed. They can no longer sign in to the portal.`, 'success');
        } catch (e) {
            this.showToast('Error removing advisor: ' + e.message, 'error');
        }
    }

    /**
     * Write the student-facing advisor directory to config/studentDirectory.
     * The student site reads this doc (publicly readable) and falls back to
     * the static list in src/advisor-directory.js when it doesn't exist.
     * Coordinators (any title other than "Advisor") sort first, matching the
     * original hand-ordered list.
     */
    async publishStudentDirectory() {
        const entries = this.advisors
            .filter((a) => a.username !== 'admin' && a.showInDirectory !== false)
            .map((a) => ({
                name: a.displayName || a.username,
                role: a.publicRole || 'Advisor',
                email: getPublicAdvisorEmail(a),
                loginUsername: a.username,
            }))
            .sort((a, b) => {
                const aCoord = a.role === 'Advisor' ? 1 : 0;
                const bCoord = b.role === 'Advisor' ? 1 : 0;
                if (aCoord !== bCoord) return aCoord - bCoord;
                return a.name.localeCompare(b.name);
            });
        try {
            await setDoc(doc(db, 'config', 'studentDirectory'), {
                advisors: entries,
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            console.error('publishStudentDirectory', e);
            this.showToast('Advisor saved, but updating the student directory failed: ' + e.message, 'warning');
        }
    }

    loadManageBulletins() {
        const container = document.getElementById('manageBulletins');

        const searchQuery = (document.getElementById('manageSearchInput')?.value || '').toLowerCase().trim();
        const sortMode = document.getElementById('manageSortSelect')?.value || 'newest';
        const filterMode = document.getElementById('manageFilterSelect')?.value || 'all';
        const contentKind = document.getElementById('manageContentTypeSelect')?.value || 'all';

        let userBulletins = this.bulletins
            .filter(b => (this.canManageAllPosts() || b.postedBy === this.currentUser.username) && b.isActive);

        // Apply filter
        if (filterMode === 'active') {
            userBulletins = userBulletins.filter(b => {
                if (this.isResourceBulletin(b)) return b.isPublished !== false;
                return !this.isBulletinExpiredAdmin(b);
            });
        } else if (filterMode === 'expired') {
            userBulletins = userBulletins.filter(b => !this.isResourceBulletin(b) && this.isBulletinExpiredAdmin(b));
        }

        if (contentKind === 'bulletin') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'bulletin');
        } else if (contentKind === 'resource') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'resource');
        } else if (contentKind === 'event') {
            userBulletins = userBulletins.filter(b => this.getManageContentKind(b) === 'event');
        }

        // Reorder mode: render every active resource grouped by category, regardless of search/sort/status filters
        if (this.resourceReorderMode && contentKind === 'resource') {
            const allResources = this.bulletins.filter(b => this.isResourceBulletin(b) && b.isActive);
            this.renderResourceReorderView(container, allResources);
            return;
        }

        // Apply search
        if (searchQuery) {
            userBulletins = userBulletins.filter(b => {
                const searchable = [
                    b.title,
                    b.titleEn,
                    b.titleEs,
                    b.category,
                    b.resourceCategory,
                    this.isResourceBulletin(b) ? this.getResourceCategoryLabel(b.resourceCategory) : this.getCategoryDisplay(b.category),
                    this.getAdvisorDisplayName(b),
                    b.description,
                    b.url,
                    b.eventLink,
                    b.highlights,
                    b.phone,
                    b.address
                ].filter(Boolean).join(' ').toLowerCase();
                return searchable.includes(searchQuery);
            });
        }

        // Apply sort
        userBulletins.sort((a, b) => {
            if (sortMode === 'category') {
                return (a.category || a.resourceCategory || '').localeCompare(b.category || b.resourceCategory || '');
            }
            if (sortMode === 'deadline') {
                const aD = a.deadline || a.eventDate || a.endDate || '';
                const bD = b.deadline || b.eventDate || b.endDate || '';
                return aD.localeCompare(bD);
            }
            if (sortMode === 'oldest') {
                return this.getManageSortTimestamp(a) - this.getManageSortTimestamp(b);
            }
            return this.compareManagePosts(a, b);
        });

        if (userBulletins.length === 0) {
            if (searchQuery) {
                container.innerHTML = `<p>No posts match "<strong>${this.escapeHtml(searchQuery)}</strong>". Try a different search.</p>`;
            } else if (filterMode === 'expired') {
                container.innerHTML = '<p>No expired posts. Great — everything is still active!</p>';
            } else if (filterMode === 'active') {
                container.innerHTML = '<p>No active posts right now.</p>';
            } else if (contentKind === 'event') {
                container.innerHTML = '<p>No calendar events match these filters.</p>';
            } else if (contentKind === 'resource') {
                container.innerHTML = '<p>No resources match these filters.</p>';
            } else if (contentKind === 'bulletin') {
                container.innerHTML = '<p>No bulletins match these filters.</p>';
            } else {
                container.innerHTML = this.canManageAllPosts()
                    ? '<p>There are no bulletins to manage right now.</p>'
                    : '<p>You haven\'t posted anything yet. Use the <strong>New Content</strong> tab to create your first bulletin!</p>';
            }
            return;
        }

        container.innerHTML = userBulletins.map(bulletin => {
            const isResource = this.isResourceBulletin(bulletin);
            const kind = this.getManageContentKind(bulletin);
            const typeLabel = kind === 'resource'
                ? (isDocumentResource(bulletin) ? 'Document resource' : 'Organization resource')
                : kind === 'event' ? 'Calendar event' : 'Bulletin';
            const isDraft = isResource && bulletin.isPublished === false;
            const isExpired = !isResource && this.isBulletinExpiredAdmin(bulletin);
            const statusLabel = isDraft ? 'Draft / Hidden from students' : isExpired ? 'Expired' : 'Live';

            return `
            <div class="manage-card" data-bulletin-id="${bulletin.id}" id="manage-card-${bulletin.id}">
                <h5>${this.escapeHtml(this.getManageCardTitle(bulletin))}</h5>
                <p><strong>Type:</strong> ${typeLabel}</p>
                <p><strong>Status:</strong> ${statusLabel}</p>
                <p><strong>Category:</strong> ${isResource ? this.getResourceCategoryLabel(bulletin.resourceCategory) : this.getCategoryDisplay(bulletin.category)}</p>
                ${this.canManageAllPosts() && bulletin.postedBy !== this.currentUser.username ? `
                    <p><strong>Advisor:</strong> ${this.escapeHtml(this.getAdvisorDisplayName(bulletin))} (${this.escapeHtml(bulletin.postedBy)})</p>
                ` : ''}
                <p><strong>Posted:</strong> ${bulletin.datePosted
                    ? new Date(bulletin.datePosted.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString()
                    : 'Unknown'}</p>
                ${isResource ? `
                    <p><strong>Spanish Title:</strong> ${this.escapeHtml(bulletin.titleEs || bulletin.titleEn || bulletin.title || '')}</p>
                    <p><strong>Published:</strong> ${bulletin.isPublished !== false ? 'Yes' : 'No — hidden from students'}</p>
                    ${bulletin.url || bulletin.eventLink ? `<p><strong>Link:</strong> <a href="${this.escapeAttribute(bulletin.url || bulletin.eventLink)}" target="_blank" rel="noopener">Open resource</a></p>` : ''}
                    ${bulletin.pdfUrl ? `<p><strong>Form PDF:</strong> <a href="${this.escapeAttribute(bulletin.pdfUrl)}" target="_blank" rel="noopener">Open PDF</a></p>` : ''}
                    ${bulletin.description ? `<p><strong>Description:</strong> ${this.escapeHtml(bulletin.description)}</p>` : ''}
                    ${bulletin.highlights ? `<p><strong>Services:</strong> ${this.escapeHtml(bulletin.highlights)}</p>` : ''}
                    ${bulletin.address ? `<p><strong>Address:</strong> ${this.escapeHtml(bulletin.address)}</p>` : ''}
                    ${bulletin.phone ? `<p><strong>Phone:</strong> ${this.escapeHtml(bulletin.phone)} (${this.escapeHtml(bulletin.phoneMode || 'call')})</p>` : ''}
                    ${bulletin.resourceOrder !== '' && bulletin.resourceOrder !== undefined && bulletin.resourceOrder !== null ? `<p><strong>Display Order:</strong> ${this.escapeHtml(String(bulletin.resourceOrder))}</p>` : ''}
                ` : ''}
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
        `;
        }).join('');

        // Scroll to and briefly highlight the card that was just posted/edited
        if (this.pendingHighlightId) {
            const highlightId = this.pendingHighlightId;
            this.pendingHighlightId = null;
            requestAnimationFrame(() => {
                const card = document.getElementById(`manage-card-${highlightId}`);
                if (!card) return;
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'box-shadow 0.3s ease, outline 0.3s ease';
                card.style.outline = '2.5px solid #22c55e';
                card.style.boxShadow = '0 0 0 6px rgba(34,197,94,0.15)';
                setTimeout(() => {
                    card.style.outline = '';
                    card.style.boxShadow = '';
                }, 2500);
            });
        }
    }

    toggleResourceReorderMode() {
        const contentType = document.getElementById('manageContentTypeSelect');
        if (contentType && contentType.value !== 'resource') {
            contentType.value = 'resource';
        }
        this.resourceReorderMode = !this.resourceReorderMode;
        this.updateReorderToggleUI();
        this.loadManageBulletins();
    }

    updateReorderToggleUI() {
        const toggle = document.getElementById('manageReorderToggle');
        const label = document.getElementById('manageReorderToggleLabel');
        const banner = document.getElementById('manageReorderBanner');
        const contentKind = document.getElementById('manageContentTypeSelect')?.value || 'all';
        const visible = contentKind === 'resource';
        if (toggle) {
            toggle.style.display = visible ? '' : 'none';
            toggle.classList.toggle('is-active', this.resourceReorderMode);
            toggle.style.background = this.resourceReorderMode ? 'var(--ap-blue, #2563eb)' : '';
            toggle.style.color = this.resourceReorderMode ? '#fff' : '';
            toggle.style.borderColor = this.resourceReorderMode ? 'var(--ap-blue, #2563eb)' : '';
        }
        if (label) label.textContent = this.resourceReorderMode ? 'Done reordering' : 'Reorder';
        if (banner) banner.style.display = (visible && this.resourceReorderMode) ? '' : 'none';
    }

    renderResourceReorderView(container, resources) {
        if (resources.length === 0) {
            container.innerHTML = '<p>No resources yet. Create one from the New Content tab, then come back to reorder.</p>';
            return;
        }

        const orderOf = (r) => {
            const v = r.resourceOrder;
            return (v === null || v === undefined || v === '') ? Number.POSITIVE_INFINITY : Number(v);
        };
        const dateOf = (r) => {
            if (!r.datePosted) return 0;
            return r.datePosted.toDate ? r.datePosted.toDate().getTime() : new Date(r.datePosted).getTime();
        };

        const categoryOrder = ['immigration', 'jobs', 'housing', 'health', 'legal-aid'];
        const grouped = {};
        resources.forEach(r => {
            const cat = r.resourceCategory || 'other';
            (grouped[cat] = grouped[cat] || []).push(r);
        });
        Object.keys(grouped).forEach(cat => {
            grouped[cat].sort((a, b) => {
                const oa = orderOf(a), ob = orderOf(b);
                if (oa !== ob) return oa - ob;
                return dateOf(b) - dateOf(a);
            });
        });
        const orderedCats = [
            ...categoryOrder.filter(c => grouped[c]),
            ...Object.keys(grouped).filter(c => !categoryOrder.includes(c)).sort()
        ];

        const handleSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>';

        container.innerHTML = orderedCats.map(cat => {
            const items = grouped[cat];
            const label = this.getResourceCategoryLabel(cat);
            const cards = items.map((r) => {
                const title = r.titleEn || r.title || 'Untitled resource';
                return `
                <div class="reorder-card" draggable="true" data-bulletin-id="${r.id}" data-category="${this.escapeAttribute(cat)}">
                    <button type="button" class="reorder-handle" aria-label="Drag ${this.escapeAttribute(title)}">${handleSvg}</button>
                    <div class="reorder-card-body">
                        <div class="reorder-card-title">${this.escapeHtml(title)}</div>
                        <div class="reorder-card-meta">
                            ${r.isPublished === false ? '<span class="reorder-pill reorder-pill-draft">Hidden</span>' : '<span class="reorder-pill reorder-pill-live">Live</span>'}
                            <span class="reorder-card-advisor">Posted by ${this.escapeHtml(this.getAdvisorDisplayName(r) || '—')}</span>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            return `
                <section class="reorder-section" data-category="${this.escapeAttribute(cat)}">
                    <header class="reorder-section-header">
                        <h4>${this.escapeHtml(label)}</h4>
                        <span class="reorder-count">${items.length} resource${items.length === 1 ? '' : 's'}</span>
                    </header>
                    <div class="reorder-list" data-category="${this.escapeAttribute(cat)}">
                        ${cards}
                    </div>
                </section>
            `;
        }).join('');

        this.attachReorderDragHandlers(container);
    }

    attachReorderDragHandlers(container) {
        const lists = container.querySelectorAll('.reorder-list');
        let draggedId = null;
        let draggedFromCategory = null;

        const clearIndicators = () => {
            container.querySelectorAll('.reorder-card').forEach(c => {
                c.classList.remove('drop-before', 'drop-after', 'is-dragging');
            });
        };

        lists.forEach(list => {
            list.addEventListener('dragstart', (e) => {
                const card = e.target.closest('.reorder-card');
                if (!card) return;
                draggedId = card.dataset.bulletinId;
                draggedFromCategory = card.dataset.category;
                card.classList.add('is-dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    try { e.dataTransfer.setData('text/plain', draggedId); } catch (_) {}
                }
            });

            list.addEventListener('dragover', (e) => {
                if (!draggedId) return;
                if (list.dataset.category !== draggedFromCategory) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                const target = e.target.closest('.reorder-card');
                container.querySelectorAll('.reorder-card.drop-before, .reorder-card.drop-after')
                    .forEach(c => c.classList.remove('drop-before', 'drop-after'));
                if (!target || target.dataset.bulletinId === draggedId) return;
                const rect = target.getBoundingClientRect();
                const before = (e.clientY - rect.top) < rect.height / 2;
                target.classList.add(before ? 'drop-before' : 'drop-after');
            });

            list.addEventListener('dragleave', (e) => {
                if (!list.contains(e.relatedTarget)) {
                    container.querySelectorAll('.reorder-card.drop-before, .reorder-card.drop-after')
                        .forEach(c => c.classList.remove('drop-before', 'drop-after'));
                }
            });

            list.addEventListener('drop', async (e) => {
                if (!draggedId) return;
                if (list.dataset.category !== draggedFromCategory) {
                    clearIndicators();
                    draggedId = null;
                    draggedFromCategory = null;
                    return;
                }
                e.preventDefault();
                const target = e.target.closest('.reorder-card');
                const draggedCard = list.querySelector(`.reorder-card[data-bulletin-id="${draggedId}"]`);
                if (!draggedCard) { clearIndicators(); draggedId = null; return; }

                if (target && target.dataset.bulletinId !== draggedId) {
                    const rect = target.getBoundingClientRect();
                    const before = (e.clientY - rect.top) < rect.height / 2;
                    if (before) list.insertBefore(draggedCard, target);
                    else list.insertBefore(draggedCard, target.nextSibling);
                } else if (!target) {
                    list.appendChild(draggedCard);
                }
                clearIndicators();

                const category = list.dataset.category;
                const orderedIds = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId);

                draggedId = null;
                draggedFromCategory = null;

                try {
                    await this.reorderResourcesInCategory(category, orderedIds);
                    this.showTemporaryMessage('Order saved.', 'success');
                } catch (err) {
                    console.error('Reorder failed', err);
                    this.showTemporaryMessage('Could not save the new order. Please try again.', 'error');
                    this.loadManageBulletins();
                }
            });

            list.addEventListener('dragend', () => {
                clearIndicators();
                draggedId = null;
                draggedFromCategory = null;
            });
        });

        this.attachReorderPointerHandlers(container);
    }

    attachReorderPointerHandlers(container) {
        if (container._resourceReorderPointerBound) return;
        container._resourceReorderPointerBound = true;

        let drag = null;

        const clearPointerDrag = () => {
            if (!drag) return;
            drag.card.setAttribute('draggable', 'true');
            drag.card.classList.remove('is-pointer-dragging', 'is-dragging');
            document.body.classList.remove('is-resource-reordering');
            drag = null;
        };

        const getCardAtPoint = (x, y) => {
            const el = document.elementFromPoint(x, y);
            const card = el?.closest?.('.reorder-card');
            if (!card || !drag || !drag.list.contains(card) || card === drag.card) return null;
            return card;
        };

        const moveDragToPoint = (x, y) => {
            const target = getCardAtPoint(x, y);
            if (!target) return;

            const rect = target.getBoundingClientRect();
            const before = (y - rect.top) < rect.height / 2;
            if (before) {
                drag.list.insertBefore(drag.card, target);
            } else {
                drag.list.insertBefore(drag.card, target.nextSibling);
            }
            drag.moved = true;
        };

        const startDrag = (e, pointerId, pointerType = 'mouse') => {
            const eventTarget = e.target?.closest ? e.target : document.elementFromPoint(e.clientX, e.clientY);
            const handle = eventTarget?.closest?.('.reorder-handle') || document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.reorder-handle');
            if (drag || !handle || !container.contains(handle)) return false;
            if (!window.matchMedia('(max-width: 768px)').matches) return false;

            const card = handle.closest('.reorder-card');
            const list = handle.closest('.reorder-list');
            if (!card || !list) return false;

            e.preventDefault();
            e.stopPropagation();
            card.setAttribute('draggable', 'false');
            drag = {
                card,
                list,
                pointerId,
                pointerType,
                startOrder: Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|'),
                moved: false
            };
            card.classList.add('is-pointer-dragging', 'is-dragging');
            document.body.classList.add('is-resource-reordering');
            return true;
        };

        container.addEventListener('pointerdown', (e) => {
            if (startDrag(e, e.pointerId, e.pointerType)) {
                e.target.closest('.reorder-handle')?.setPointerCapture?.(e.pointerId);
            }
        });

        container.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || drag) return;
            startDrag(e, 'mouse');
        });

        document.addEventListener('pointermove', (e) => {
            if (!drag || drag.pointerId !== e.pointerId) return;
            e.preventDefault();
            moveDragToPoint(e.clientX, e.clientY);
        });

        document.addEventListener('mousemove', (e) => {
            if (!drag || (drag.pointerId !== 'mouse' && drag.pointerType !== 'mouse')) return;
            e.preventDefault();
            moveDragToPoint(e.clientX, e.clientY);
        });

        const finishDrag = async (e) => {
            if (!drag || drag.pointerId !== e.pointerId) return;
            moveDragToPoint(e.clientX, e.clientY);

            const list = drag.list;
            const nextOrder = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|');
            const changed = drag.moved && nextOrder !== drag.startOrder;
            clearPointerDrag();
            if (!changed) return;

            await this.saveResourceListOrder(list);
        };

        document.addEventListener('pointerup', finishDrag);
        document.addEventListener('pointercancel', clearPointerDrag);
        document.addEventListener('mouseup', async (e) => {
            if (!drag || (drag.pointerId !== 'mouse' && drag.pointerType !== 'mouse')) return;
            moveDragToPoint(e.clientX, e.clientY);

            const list = drag.list;
            const nextOrder = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId).join('|');
            const changed = drag.moved && nextOrder !== drag.startOrder;
            clearPointerDrag();
            if (!changed) return;

            await this.saveResourceListOrder(list);
        });
    }

    async saveResourceListOrder(list) {
        const category = list.dataset.category;
        const orderedIds = Array.from(list.querySelectorAll('.reorder-card')).map(c => c.dataset.bulletinId);

        try {
            await this.reorderResourcesInCategory(category, orderedIds);
            this.showTemporaryMessage('Order saved.', 'success');
        } catch (err) {
            console.error('Reorder failed', err);
            this.showTemporaryMessage('Could not save the new order. Please try again.', 'error');
            this.loadManageBulletins();
        }
    }

}
