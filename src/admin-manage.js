// Advisor management, the Manage list, and resource reordering.
// Extracted verbatim from firebase-admin.js; methods are merged onto
// FirebaseAdminPanel.prototype by applyMethods() in firebase-admin.js.
import { db } from './firebase.js'
import { getPublicAdvisorEmail, isLeadershipRole } from './advisor-directory.js'
import { isDocumentResource } from './resource-kinds.js'
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { currentVerificationStamp, verificationStatus } from './resource-verification.js'

export class AdminManageMethods {
    // Content permissions are equal for every advisor (Sep 2026): anyone on
    // the advisor list can see and manage every post and resource, including
    // the legacy ones left over from the retired shared logins. Admin status
    // only gates the Advisors tab (adding and removing people).
    canManageAllPosts() {
        return true;
    }

    // ── Resource re-verification ──────────────────────────────────────

    // Is this card past its category's recheck window? Shares its definition
    // of "due" with scripts/check-resource-content-risk.mjs via
    // src/resource-verification.js, so the "Needs verification" filter below
    // shows exactly the cards the monthly GitHub issue asks about.
    getResourceVerificationStatus(bulletin) {
        return verificationStatus(
            bulletin.resourceCategory || 'general',
            bulletin.lastVerified || '',
        );
    }

    // Stamps lastVerified to the current YYYY-MM. This is the only way an
    // advisor can clear an item from the monthly re-verification queue
    // (scripts/check-resource-content-risk.mjs): until this button existed the
    // field was writable only by scripts, so 21 never-verified resources sat
    // in the queue permanently with no action available to remove them.
    // Deliberately one click and no confirm dialog — it is non-destructive and
    // idempotent, and re-pressing it just refreshes the month.
    async markResourceVerified(bulletinId) {
        if (!this.verifyingResourceIds) this.verifyingResourceIds = new Set();
        if (this.verifyingResourceIds.has(bulletinId)) return;
        this.verifyingResourceIds.add(bulletinId);

        const lastVerified = currentVerificationStamp();

        try {
            // Partial update: Firestore rules validate the merged document, so
            // the required resource fields already present on the doc satisfy
            // validateBulletinData() without resending the whole card.
            await updateDoc(doc(db, 'bulletins', bulletinId), {
                lastVerified,
                updatedAt: serverTimestamp(),
            });
            this.showTemporaryMessage(`Marked verified for ${lastVerified}.`, 'success');
        } catch (error) {
            console.error('Error marking resource verified:', error);
            this.showTemporaryMessage(
                this.getFirestoreErrorMessage(error, 'mark this resource verified'),
                'error',
            );
        } finally {
            this.verifyingResourceIds.delete(bulletinId);
        }
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
                    ${a.showInDirectory === false ? '<span class="advisor-hidden-badge">Not on student site</span>' : ''}
                </div>
                <div class="manage-card-body">
                    <p><strong>Title on student site:</strong> ${this.escapeHtml(a.publicRole || 'Advisor')}</p>
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
        const modal = document.getElementById('editAdvisorModal');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        this._lastFocusedBeforeEditAdvisor = document.activeElement;
        document.getElementById('editAdvisorDisplayName').focus();

        this._editAdvisorKeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeEditAdvisor();
                return;
            }
            if (e.key !== 'Tab') return;
            const focusable = Array.from(modal.querySelectorAll('input, select, button'))
                .filter((el) => el.offsetParent !== null);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        modal.addEventListener('keydown', this._editAdvisorKeydown);
    }

    closeEditAdvisor() {
        const modal = document.getElementById('editAdvisorModal');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (this._editAdvisorKeydown) {
            modal.removeEventListener('keydown', this._editAdvisorKeydown);
            this._editAdvisorKeydown = null;
        }
        const lastFocused = this._lastFocusedBeforeEditAdvisor;
        if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
            lastFocused.focus();
        }
        this._lastFocusedBeforeEditAdvisor = null;
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
            // The Admin toggle is now the real switch on both sides: firestore.rules
            // reads advisors/{username}.isAdmin directly, so no rules deploy is
            // needed to promote or demote someone.
            this.showToast(
                isAdmin
                    ? `${displayName} can now add and remove advisors.`
                    : 'Advisor updated.',
                'success'
            );
        } catch (e) {
            this.showToast('Error saving advisor: ' + e.message, 'error');
        } finally {
            this.isSavingAdvisor = false;
        }
    }

    async addAdvisor() {
        const displayName = document.getElementById('newAdvisorDisplayName').value.trim();
        const email = document.getElementById('newAdvisorEmail').value.trim().toLowerCase();
        const isAdmin = document.getElementById('newAdvisorIsAdmin').checked;
        const publicRole = document.getElementById('newAdvisorPublicRole').value.trim() || 'Advisor';
        const showInDirectory = document.getElementById('newAdvisorShowInDirectory').checked;
        if (!email || !displayName) {
            this.showToast('School Google email and display name are required.', 'error'); return;
        }
        // Access is granted by matching the Google sign-in email against
        // advisors/{username}, so the username IS the email prefix — derived
        // here rather than typed, because a typo in a separate field silently
        // locks the advisor out of the portal.
        if (!email.endsWith('@ebhcs.org')) {
            this.showToast('Email must be an @ebhcs.org address — it is what they sign in with.', 'error'); return;
        }
        const username = email.split('@')[0];
        if (!username) {
            this.showToast('That email is missing a name before the @ — check it and try again.', 'error'); return;
        }
        if (this.advisors.find(a => a.username === username)) {
            this.showToast(`${email} is already on the advisor list.`, 'error'); return;
        }
        try {
            const loginEmail = email;
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
        this.showConfirmDialog(
            `Remove ${advisor.displayName} as an advisor?`,
            'This immediately locks them out of the portal — even if they sign in with Google, they will be turned away.',
            async () => {
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
        );
    }

    /**
     * Write the student-facing advisor directory to config/studentDirectory.
     * The student site reads this doc (publicly readable) and falls back to
     * the static list in src/advisor-directory.js when it doesn't exist.
     * Leadership titles (anything other than "Advisor" — Director,
     * Coordinator/Educator) sort to the top, then everyone alphabetically.
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
                const aLead = isLeadershipRole(a.role) ? 0 : 1;
                const bLead = isLeadershipRole(b.role) ? 0 : 1;
                if (aLead !== bLead) return aLead - bLead;
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
        // Two controls can ask for the queue: the dedicated verification filter on
        // My Resources (where the status dropdown is hidden — resources are never
        // "expired", they go stale) and the status dropdown's "Needs verification"
        // on the mixed views. Read whichever one is actually on screen.
        const verificationMode = contentKind === 'resource'
            ? (document.getElementById('manageVerificationSelect')?.value || 'all')
            : (filterMode === 'needs-verification' ? 'needs-verification' : 'all');

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

        // Only a published resource carries a lastVerified stamp, so both sides of
        // this filter drop bulletins, events, and drafts.
        if (verificationMode === 'needs-verification' || verificationMode === 'verified') {
            const wantDue = verificationMode === 'needs-verification';
            userBulletins = userBulletins.filter(b =>
                this.isResourceBulletin(b)
                && b.isPublished !== false
                && this.getResourceVerificationStatus(b).isDue === wantDue);
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
            // Working the re-verification queue: worst first, regardless of the
            // sort dropdown. Never-verified and unreadable dates come before
            // anything with a real date (see overdueBy in resource-verification).
            if (verificationMode === 'needs-verification') {
                const byOverdue = this.getResourceVerificationStatus(b).overdueBy
                    - this.getResourceVerificationStatus(a).overdueBy;
                if (byOverdue !== 0) return byOverdue;
                return (a.resourceCategory || '').localeCompare(b.resourceCategory || '')
                    || (this.getManageCardTitle(a) || '').localeCompare(this.getManageCardTitle(b) || '');
            }
            // Verified list: soonest to fall out of its window first, so an advisor
            // working ahead sees what is about to go stale. Windows differ by
            // category, so compare months left, not the raw date.
            if (verificationMode === 'verified') {
                const monthsLeft = (item) => {
                    const v = this.getResourceVerificationStatus(item);
                    return v.window - (v.monthsOld || 0);
                };
                return monthsLeft(a) - monthsLeft(b)
                    || (this.getManageCardTitle(a) || '').localeCompare(this.getManageCardTitle(b) || '');
            }
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
            } else if (verificationMode === 'needs-verification') {
                container.innerHTML = '<p>Nothing needs verifying — every published resource is inside its recheck window. Nice.</p>';
            } else if (verificationMode === 'verified') {
                container.innerHTML = '<p>No resource has been verified inside its recheck window yet. Switch to <strong>Needs checking</strong> to start the queue.</p>';
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

        const plural = userBulletins.length === 1 ? '' : 's';
        let queueBanner = '';
        if (verificationMode === 'needs-verification') {
            queueBanner = `<div class="verify-queue-banner">
                    <strong>${userBulletins.length} resource${plural} due for a check.</strong>
                    Confirm each card's details, then press <strong>Verified today</strong> on it. Worst first.
               </div>`;
        } else if (verificationMode === 'verified') {
            queueBanner = `<div class="verify-queue-banner verify-queue-banner-ok">
                    <strong>${userBulletins.length} resource${plural} verified and still inside ${userBulletins.length === 1 ? 'its' : 'their'} recheck window.</strong>
                    Soonest due first — press <strong>Verified today</strong> to re-stamp one early.
               </div>`;
        }

        container.innerHTML = queueBanner + userBulletins.map(bulletin => {
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
                    <p><strong>Last verified:</strong> ${(() => {
                        const v = this.getResourceVerificationStatus(bulletin);
                        // The chip carries the verdict so a card reads the same way
                        // as the verification filter that would select it.
                        const chip = v.isDue
                            ? '<span class="verify-chip verify-chip-due">Needs checking</span>'
                            : '<span class="verify-chip verify-chip-ok">Verified</span>';
                        const stamp = this.escapeHtml(String(bulletin.lastVerified));
                        if (v.status === 'never-verified') return `${chip} <em>never checked</em>`;
                        if (v.status === 'bad-date') return `${chip} ${stamp} <em>(unreadable date)</em>`;
                        if (v.status === 'overdue') return `${chip} ${stamp} <em>(${v.monthsOld} months ago)</em>`;
                        const left = v.window - v.monthsOld;
                        return `${chip} ${stamp} <em>(next check due in ${left} month${left === 1 ? '' : 's'})</em>`;
                    })()}</p>
                ` : ''}
                ${this.renderManageDateInfo(bulletin)}
                <div class="manage-actions">
                    <button type="button" class="edit-btn" data-manage-action="edit-bulletin" data-bulletin-id="${this.escapeAttribute(bulletin.id)}">
                        Edit
                    </button>
                    ${isResource ? `
                        <button type="button" class="verify-btn" data-manage-action="verify-resource" data-bulletin-id="${this.escapeAttribute(bulletin.id)}"
                            title="Record that you checked this card's details today. Clears it from the monthly re-verification queue.">
                            Verified today
                        </button>
                    ` : ''}
                    <button type="button" class="delete-btn" data-manage-action="delete-bulletin" data-bulletin-id="${this.escapeAttribute(bulletin.id)}">
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
                    <button type="button" class="reorder-handle" aria-label="Reorder ${this.escapeAttribute(title)} — drag, or use up and down arrow keys">${handleSvg}</button>
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

        this.attachReorderKeyboardHandlers(container);
        this.attachReorderPointerHandlers(container);
    }

    // Arrow-key alternative to drag-and-drop reordering, since a keyboard-only
    // advisor has no other way to reorder resource cards.
    attachReorderKeyboardHandlers(container) {
        if (container._resourceReorderKeyboardBound) return;
        container._resourceReorderKeyboardBound = true;

        container.addEventListener('keydown', async (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            const handle = e.target.closest('.reorder-handle');
            if (!handle) return;
            const card = handle.closest('.reorder-card');
            const list = handle.closest('.reorder-list');
            if (!card || !list) return;

            const sibling = e.key === 'ArrowUp' ? card.previousElementSibling : card.nextElementSibling;
            if (!sibling || !sibling.classList.contains('reorder-card')) return;

            e.preventDefault();
            if (e.key === 'ArrowUp') {
                list.insertBefore(card, sibling);
            } else {
                list.insertBefore(sibling, card);
            }
            handle.focus();

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
        });
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
