/**
 * Advisor-portal auth flow: the loading / login / portal view switch, the
 * post-sign-in bootstrap, sign-out, and the advisor-directory lookups used
 * for post attribution.
 *
 * Extracted verbatim from firebase-admin.js (Stage 3 of the file-split
 * refactor); merged onto FirebaseAdminPanel.prototype by applyMethods().
 */
import { db, auth } from './firebase.js'
import { collection, getDocs } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { isPrivilegedAdminEmail } from './admin-roles.js'

export class AdminAuthMethods {
    setAuthView(view, message = 'Checking your session...') {
        const loadingEl = document.getElementById('authLoadingScreen');
        const loadingMsg = document.getElementById('authLoadingMessage');
        const loginRequired = document.getElementById('loginRequired');
        const adminPanel = document.getElementById('adminPanel');
        const logoutBtn = document.getElementById('logoutBtn');

        if (loadingMsg) {
            loadingMsg.textContent = message;
        }

        if (view === 'loading') {
            if (loadingEl) {
                loadingEl.style.display = 'flex';
                loadingEl.setAttribute('aria-busy', 'true');
            }
            if (loginRequired) loginRequired.style.display = 'none';
            if (adminPanel) adminPanel.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            document.body.classList.remove('ap-portal-active');
            return;
        }

        if (loadingEl) {
            loadingEl.style.display = 'none';
            loadingEl.setAttribute('aria-busy', 'false');
        }

        if (view === 'login') {
            if (loginRequired) loginRequired.style.display = 'grid';
            if (adminPanel) adminPanel.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';
            document.body.classList.remove('ap-portal-active');
            return;
        }

        if (view === 'portal') {
            if (loginRequired) loginRequired.style.display = 'none';
        }
    }

    async handleUserAuthenticated(userDetails) {
        await this.applyAuthenticatedUser(userDetails);
    }

    async applyAuthenticatedUser(userDetails) {
        if (this.authTransitionInProgress) {
            return;
        }

        this.authTransitionInProgress = true;
        this.setAuthView('loading', 'Signing you in...');

        try {
            const username = userDetails.username;

            // Set current user immediately with whatever name we have so the
            // panel can open without waiting on Firestore. Privileged admins
            // are admins by email (they may have no advisors/{username} doc).
            this.currentUser = {
                username,
                email: userDetails.email,
                name: userDetails.name || username,
                isAdmin: isPrivilegedAdminEmail(userDetails.email)
            };

            this.setAuthView('loading', `Welcome back, ${this.currentUser.name}!`);
            this.showAdminPanel();
            this.clearLoginForm();
            this.setupRealtimeListener();
            this.loadManageBulletins();

            // The name shown so far is just the email username — pulse the
            // advisor card so it's clear the real display name is still loading.
            const advisorCard = document.getElementById('apAdvisorCard');
            if (advisorCard) advisorCard.classList.add('ap-advisor-card--loading');

            // Load full advisor metadata in the background and patch the live UI.
            this.loadAdvisorsFromFirestore().then(() => {
                const advisor = this.advisors.find(a => a.username === username);
                if (advisor) {
                    this.currentUser.name = advisor.displayName || this.currentUser.name;
                    this.currentUser.isAdmin = advisor.isAdmin === true
                        || isPrivilegedAdminEmail(this.currentUser.email);
                    const welcome = document.getElementById('welcomeMessage');
                    if (welcome) welcome.textContent = `Welcome, ${this.currentUser.name}!`;

                    // Update admin tab visibility dynamically once loaded
                    const advisorsTabBtn = document.getElementById('advisorsTabBtn');
                    if (advisorsTabBtn) advisorsTabBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
                    const advisorsRailBtn = document.getElementById('advisorsRailBtn');
                    if (advisorsRailBtn) advisorsRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
                    const workforceRailBtn = document.getElementById('workforceRailBtn');
                    if (workforceRailBtn) workforceRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
                }
            }).catch(err => console.error('Error loading advisor metadata:', err))
            .finally(() => {
                if (advisorCard) advisorCard.classList.remove('ap-advisor-card--loading');
            });
        } catch (error) {
            console.error('Error signing in to advisor portal:', error);
            this.currentUser = null;
            this.setAuthView('login');
            throw error;
        } finally {
            this.authTransitionInProgress = false;
        }
    }

    handleSignedOut() {
        this.currentUser = null;
        if (this.bulletinsUnsubscribe) {
            this.bulletinsUnsubscribe();
            this.bulletinsUnsubscribe = null;
        }
        this.hideAdminPanel();
        this.clearLoginForm();
        this.setAuthView('login');
    }

    getUserDisplayName(username) {
        const fromFirestore = this.advisors.find(a => a.username === username);
        if (fromFirestore) return fromFirestore.displayName;
        return username;
    }

    async loadAdvisorsFromFirestore() {
        try {
            const snap = await getDocs(collection(db, 'advisors'));
            this.advisors = snap.docs.map(d => ({ username: d.id, ...d.data() }));
        } catch (e) {
            console.error('Error loading advisors:', e);
            // Keep the existing list (static fallback or prior load) so a transient
            // Firestore error doesn't blank the Advisors tab or break name lookups.
        }
    }

    async logout() {
        try {
            if (typeof auth === 'undefined') {
                throw new Error('Firebase auth not initialized');
            }
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    clearLoginForm() {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.style.display = 'none';
        }
    }

    showAdminPanel() {
        this.setAuthView('portal');
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'block';
        document.body.classList.add('ap-portal-active');
        document.getElementById('welcomeMessage').textContent = `Welcome, ${this.currentUser.name}!`;

        // Show advisors tab only for admins
        const advisorsTabBtn = document.getElementById('advisorsTabBtn');
        if (advisorsTabBtn) advisorsTabBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
        const advisorsRailBtn = document.getElementById('advisorsRailBtn');
        if (advisorsRailBtn) advisorsRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';
        const workforceRailBtn = document.getElementById('workforceRailBtn');
        if (workforceRailBtn) workforceRailBtn.style.display = this.currentUser.isAdmin ? '' : 'none';

        this.setContentType(this.contentType || 'post', { preserveFields: true, silent: true });
    }

    hideAdminPanel() {
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
        document.body.classList.remove('ap-portal-active');
    }

    getAuthPostedBy() {
        const email = auth.currentUser?.email || this.currentUser?.email || '';
        if (email.includes('@')) {
            return email.split('@')[0].toLowerCase();
        }
        return (this.currentUser?.username || '').toLowerCase();
    }

    getAuthAdvisorName() {
        const name = (this.currentUser?.name || '').trim();
        if (name) return name;
        const fromDirectory = this.getUserDisplayName(this.getAuthPostedBy());
        return (fromDirectory || 'Advisor').trim();
    }

    getAdvisorDisplayName(doc) {
        if (doc.advisorName) return doc.advisorName;
        const uid = doc.createdBy || doc.postedBy || '';
        if (!uid) return '';
        const match = this.advisors.find(a => a.username === uid || a.uid === uid);
        return match ? (match.displayName || match.username || '') : uid;
    }
}
