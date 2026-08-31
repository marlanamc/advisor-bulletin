/**
 * Advisor portal tab switching and the dashboard overview (stat tiles +
 * upcoming-events list).
 *
 * Merged onto FirebaseAdminPanel.prototype by applyMethods().
 * Pure in-memory work over this.bulletins — no Firebase reads.
 */

export class AdminDashboardMethods {
    // Tab Management
    showTab(tabName) {
        const v2PageMap = { post: 'create', manage: 'bulletins', advisors: 'advisors' };
        if (typeof window.apShowPage === 'function' && v2PageMap[tabName]) {
            window.apShowPage(v2PageMap[tabName]);
        }

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
        if (tabName === 'advisors') {
            this.loadAdvisors();
        }

        document.querySelectorAll('[data-admin-tab-target]').forEach((button) => {
            button.classList.toggle('active', button.getAttribute('data-admin-tab-target') === tabName);
        });
    }

    /**
     * Next occurrence of a dated bulletin on/after `today` (day precision).
     * Multi-session bulletins resolve to their next remaining session, not the first one.
     * @returns {{ day: Date, startTime: string, endTime: string } | null}
     */
    getNextUpcomingEventOccurrence(bulletin, today) {
        if (bulletin.dateType === 'sessions' || bulletin.dateType === 'recurring') {
            for (const session of this.getBulletinEventSessions(bulletin)) {
                const day = new Date(`${session.date}T00:00:00`);
                if (!Number.isNaN(day.getTime()) && day >= today) {
                    return { day, startTime: session.startTime || '', endTime: session.endTime || '' };
                }
            }
            return null;
        }

        const dateStr = bulletin.eventDate || bulletin.startDate;
        if (!dateStr) return null;
        const normalized = String(dateStr).split('T')[0];
        const day = new Date(`${normalized}T00:00:00`);
        if (Number.isNaN(day.getTime()) || day < today) return null;
        return { day, startTime: bulletin.startTime || '', endTime: bulletin.endTime || '' };
    }

    /** Upcoming dated posts/events — filtered in memory from already-loaded bulletins (no extra reads). */
    getUpcomingEventBulletins(limit = Infinity) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcoming = this.bulletins
            .filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive !== false)
            .map((bulletin) => ({ bulletin, next: this.getNextUpcomingEventOccurrence(bulletin, today) }))
            .filter((entry) => entry.next)
            .sort((a, b) => a.next.day - b.next.day)
            .map((entry) => entry.bulletin);

        return Number.isFinite(limit) ? upcoming.slice(0, limit) : upcoming;
    }

    updateAdvisorDashboard() {
        const posts = this.bulletins.filter((bulletin) => !this.isResourceBulletin(bulletin) && bulletin.isActive);
        const livePosts = posts.filter((bulletin) => !this.isBulletinExpiredAdmin(bulletin));
        const expiringSoon = posts.filter((bulletin) => bulletin.deadline && this.isDeadlineClose(bulletin.deadline) && !this.isBulletinExpiredAdmin(bulletin));
        const resources = this.bulletins.filter((bulletin) => this.isResourceBulletin(bulletin) && bulletin.isActive);
        const upcomingEvents = this.getUpcomingEventBulletins();

        this.setText('statLivePosts', livePosts.length);
        this.setText('statResources', resources.length);
        this.setText('statUpcomingEvents', upcomingEvents.length);
        this.setText('statExpiringSoon', expiringSoon.length);

        this.renderUpcomingDashboardEvents();
    }

    renderUpcomingDashboardEvents() {
        const container = document.getElementById('dashUpcomingEvents');
        if (!container) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = this.getUpcomingEventBulletins(4);

        if (!upcoming.length) {
            container.innerHTML = '<p style="color:var(--ap-text-3);font-size:.82rem;">No upcoming events. Create a calendar event to see it here.</p>';
            return;
        }

        container.innerHTML = upcoming.map((bulletin) => {
            const next = this.getNextUpcomingEventOccurrence(bulletin, today);
            if (!next) return '';
            const eventDay = next.day;
            const month = eventDay.toLocaleString('default', { month: 'short' }).toUpperCase();
            const day = eventDay.getDate();
            const title = bulletin.title || 'Untitled event';
            const time = this.formatTimeRangeAdmin(next.startTime, next.endTime);

            return `
                <div class="ap-event-row">
                    <div class="ap-event-date-block">
                        <div class="ap-event-month">${this.escapeHtml(month)}</div>
                        <div class="ap-event-day">${day}</div>
                    </div>
                    <div class="ap-event-info">
                        <div class="ap-event-name">${this.escapeHtml(title)}</div>
                        <div class="ap-event-time">${time ? this.escapeHtml(time) : 'All day'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}
