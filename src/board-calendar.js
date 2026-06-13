// Calendar, dates list, and upcoming-events rendering for the student board.
// Extracted verbatim from firebase-config.js; methods are merged onto
// FirebaseBulletinBoard.prototype by applyMethods() in firebase-config.js.
import {
    scrollWindowTo,
    withSchoolCalendarAnchors,
} from './board-shared.js'

export class BoardCalendarMethods {
    renderCalendar(bulletins) {
        const calendar = document.getElementById('bulletinCalendar');
        const emptyState = document.getElementById('calendarEmptyState');
        const desktopGrid = document.getElementById('bulletinCalendarDesktopGrid');
        if (!calendar || !emptyState) {
            return;
        }

        const mergedBulletins = withSchoolCalendarAnchors(bulletins);
        const datedBulletins = mergedBulletins.filter((bulletin) => this.bulletinHasCalendarDates(bulletin));
        if (datedBulletins.length === 0) {
            calendar.innerHTML = '';
            if (desktopGrid) desktopGrid.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        this.updateDatesViewToggle();

        const isDesktopSplit = window.matchMedia('(min-width: 1024px)').matches;

        if (isDesktopSplit) {
            // Two-pane: list left, month grid right (toggle ignored)
            calendar.innerHTML = this.createDatesListView(datedBulletins);
            if (desktopGrid) {
                desktopGrid.innerHTML = this.createCalendarView(mergedBulletins, { navigatorMode: true });
                this.bindCalendarDayScroll(desktopGrid);
            }
        } else {
            // Single-pane: respect toggle
            calendar.innerHTML = this.datesViewMode === 'calendar'
                ? this.createCalendarView(mergedBulletins)
                : this.createDatesListView(datedBulletins);
            if (desktopGrid) desktopGrid.innerHTML = '';
        }
    }

    bindCalendarDayScroll(gridEl) {
        // Clicking a day with events scrolls the list to that date's card.
        gridEl.querySelectorAll('[data-calendar-day]').forEach((dayEl) => {
            dayEl.addEventListener('click', () => {
                const iso = dayEl.getAttribute('data-calendar-day');
                if (!iso) return;
                const target = document.querySelector(`[data-list-date="${iso}"]`);
                if (!target) return;
                const headerOffset = parseInt(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--app-header-offset') || '70', 10
                );
                const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 16;
                scrollWindowTo(top);
                target.classList.add('list-card-pulse');
                setTimeout(() => target.classList.remove('list-card-pulse'), 1400);
            });
        });
    }

    renderHomeUpcomingEvents(bulletins) {
        const container = document.getElementById('homeUpcomingEvents');
        if (!container) {
            return;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const mergedBulletins = withSchoolCalendarAnchors(bulletins);
        const events = mergedBulletins
            .flatMap((bulletin) => {
                if (bulletin.dateType === 'sessions') {
                    return this.getBulletinEventSessions(bulletin).map((session) => ({
                        bulletin,
                        rawDate: session.date,
                        timestamp: this.getTimestampValue(session.date),
                        startTime: session.startTime,
                        endTime: session.endTime
                    }));
                }

                const rawDate = bulletin.eventDate || bulletin.startDate || bulletin.deadline;
                return [{
                    bulletin,
                    rawDate,
                    timestamp: this.getTimestampValue(rawDate),
                    startTime: bulletin.startTime,
                    endTime: bulletin.endTime
                }];
            })
            .filter((item) => item.timestamp && item.timestamp >= now.getTime())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(0, 3);

        if (events.length === 0) {
            container.innerHTML = '<div class="side-empty">Events with dates will appear here.</div>';
            return;
        }

        container.innerHTML = events.map(({ bulletin, rawDate, timestamp, startTime, endTime }) => {
            const date = new Date(timestamp);
            const locale = this.getLocale();
            const month = date.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
            const day = date.toLocaleDateString(locale, { day: 'numeric' });
            const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
            const timeLabel = this.formatTimeRange(startTime, endTime);
            const meta = [weekday, timeLabel].filter(Boolean).join(' · ');

            return `
                <button class="side-event" type="button" onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')">
                    <div class="side-date"><span>${month}</span><strong>${day}</strong></div>
                    <div>
                        <p class="side-event-title">${this.escapeHtml(this.getPostTitle(bulletin) || (this.getCurrentLang() === 'ES' ? 'Próximo evento' : 'Upcoming event'))}</p>
                        <p class="side-event-meta">${this.escapeHtml(meta || 'Date posted')}</p>
                    </div>
                    <span class="side-event-arrow" aria-hidden="true">›</span>
                </button>
            `;
        }).join('');
    }

    updateDatesViewToggle() {
        document.querySelectorAll('[data-dates-view]').forEach((button) => {
            const isActive = button.getAttribute('data-dates-view') === this.datesViewMode;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    createBulletinListItem(bulletin) {
        const postedDate = new Date(bulletin.datePosted?.toDate ? bulletin.datePosted.toDate() : bulletin.datePosted).toLocaleDateString();
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
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
                        <div class="bulletin-list-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
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
                                <strong>Class Type:</strong> ${this.escapeHtml(this.getClassTypeDisplay(bulletin.classType))}
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
                                <strong>Deadline:</strong> ${this.formatDateLocal(bulletin.deadline)}
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
                            <button type="button" class="pdf-btn" aria-label="View PDF document for ${this.escapeHtml(bulletin.title)}" onclick="window.bulletinBoard.openPdfFromBulletin('${this.escapeAttribute(bulletin.id)}')">
                                📄 View PDF
                            </button>
                        ` : ''}
                        <button type="button" class="share-btn" onclick="shareBulletin('${this.escapeAttribute(bulletin.id)}', '${this.escapeAttribute(this.getPostTitle(bulletin) || '')}')">
                            📤 Share
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    createDatesListView(bulletins) {
        const datedItems = bulletins
            .flatMap((bulletin) => this.expandBulletinDateItems(bulletin))
            .filter(Boolean)
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        const groups = [
            { key: 'this-week', labelEn: 'This week', labelEs: 'Esta semana', items: [] },
            { key: 'next-week', labelEn: 'Next week', labelEs: 'Próxima semana', items: [] },
            { key: 'upcoming', labelEn: 'Upcoming', labelEs: 'Próximos', items: [] },
            { key: 'past', labelEn: 'Past dates', labelEs: 'Fechas pasadas', items: [] }
        ];

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endThisWeek = new Date(todayStart);
        endThisWeek.setDate(todayStart.getDate() + (6 - todayStart.getDay()));
        endThisWeek.setHours(23, 59, 59, 999);
        const endNextWeek = new Date(endThisWeek);
        endNextWeek.setDate(endThisWeek.getDate() + 7);

        datedItems.forEach((item) => {
            if (item.date < todayStart) {
                groups[3].items.push(item);
            } else if (item.date <= endThisWeek) {
                groups[0].items.push(item);
            } else if (item.date <= endNextWeek) {
                groups[1].items.push(item);
            } else {
                groups[2].items.push(item);
            }
        });

        const visibleGroups = groups.filter((group) => group.items.length > 0);
        if (visibleGroups.length === 0) {
            return '';
        }

        return `
            <div class="dates-list-view">
                ${visibleGroups.map((group) => `
                    <section class="dates-list-group" aria-label="${this.escapeAttribute(group.labelEn)}">
                        <h2>
                            <span class="en-text">${this.escapeHtml(group.labelEn)}</span>
                            <span class="es-text">${this.escapeHtml(group.labelEs)}</span>
                        </h2>
                        <div class="dates-list-items">
                            ${group.items.map((item) => this.createDatesListCard(item)).join('')}
                        </div>
                    </section>
                `).join('')}
            </div>
        `;
    }

    expandBulletinDateItems(bulletin) {
        if (bulletin.dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            return sessions.map((session) => {
                const date = this.parseDateOnly(session.date);
                if (!date) return null;

                return {
                    bulletin,
                    rawDate: session.date,
                    date,
                    kind: 'event',
                    session,
                    label: this.getDatesListLabel(bulletin, date, 'event', { session })
                };
            }).filter(Boolean);
        }

        const item = this.getDatesListItem(bulletin);
        return item ? [item] : [];
    }

    getDatesListItem(bulletin) {
        let rawDate = '';
        let kind = 'date';

        if (bulletin.dateType === 'deadline' && bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'deadline';
        } else if (bulletin.dateType === 'event' && bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'event';
        } else if (bulletin.dateType === 'range' && bulletin.startDate) {
            rawDate = bulletin.startDate;
            kind = 'start';
        } else if (bulletin.eventDate) {
            rawDate = bulletin.eventDate;
            kind = 'event';
        } else if (bulletin.startDate) {
            rawDate = bulletin.startDate;
            kind = 'start';
        } else if (bulletin.deadline) {
            rawDate = bulletin.deadline;
            kind = 'deadline';
        }

        if (!rawDate) return null;

        const date = this.parseDateOnly(rawDate);
        if (!date) return null;

        return {
            bulletin,
            rawDate,
            date,
            kind,
            label: this.getDatesListLabel(bulletin, date, kind)
        };
    }

    parseDateOnly(rawDate) {
        if (!rawDate) return null;
        if (rawDate instanceof Date) return rawDate;
        if (typeof rawDate.toDate === 'function') return rawDate.toDate();
        const normalized = String(rawDate);
        const date = normalized.includes('T') ? new Date(normalized) : new Date(`${normalized}T12:00:00`);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    getDatesListLabel(bulletin, date, kind, options = {}) {
        const locale = this.getLocale();
        const isEs = this.getCurrentLang() === 'ES';
        const dateLabel = date.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
        const dayLabel = date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
        const timeRange = options.session
            ? this.formatTimeRange(options.session.startTime, options.session.endTime)
            : this.formatTimeRange(bulletin.startTime, bulletin.endTime);

        if (kind === 'deadline') {
            return isEs ? `Vence el ${dateLabel}` : `Due by ${dateLabel}`;
        }

        if (kind === 'start') {
            return isEs
                ? `Comienza el ${dayLabel}${timeRange ? ` · ${timeRange}` : ''}`
                : `From ${dateLabel}${timeRange ? ` · ${timeRange}` : ''}`;
        }

        return `${dayLabel}${timeRange ? ` · ${timeRange}` : ''}`;
    }

    createDatesListCard(item) {
        const { bulletin, date, kind, label } = item;
        const meta = this.getCatMeta(bulletin.category);
        const title = this.getPostTitle(bulletin);
        const locale = this.getLocale();
        const isEs = this.getCurrentLang() === 'ES';
        const badgeTop = kind === 'deadline'
            ? (isEs ? 'LÍM' : 'BY')
            : date.toLocaleDateString(locale, { month: 'short' }).toUpperCase();
        const badgeMain = date.getDate();
        const dotColor = kind === 'deadline' ? '#f08b1f' : meta.accent;
        const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        return `
            <article
                class="dates-list-card"
                data-list-date="${isoDate}"
                style="--date-accent:${meta.accent};--date-tint:${meta.tint};--date-dot:${dotColor}"
                role="button"
                tabindex="0"
                onclick="window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.bulletinBoard && window.bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')}"
            >
                <div class="dates-list-badge" aria-hidden="true">
                    <span>${this.escapeHtml(badgeTop)}</span>
                    <strong>${badgeMain}</strong>
                </div>
                <div class="dates-list-copy">
                    <p class="dates-list-category" style="color:${meta.accent}">
                        <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
                    </p>
                    <h3>${this.escapeHtml(title)}</h3>
                    <p class="dates-list-label">${kind === 'start' ? this.formatStartDateLabelHtml(date, bulletin) : this.escapeHtml(label)}</p>
                </div>
                <span class="dates-list-dot" aria-hidden="true"></span>
            </article>
        `;
    }

    createCalendarView(bulletins, options = {}) {
        const navigatorMode = options.navigatorMode === true;
        // Filter to only show bulletins with deadlines or events
        const calendarBulletins = bulletins.filter((bulletin) => this.bulletinHasCalendarDates(bulletin));

        // Group bulletins by date - use event date if available, otherwise deadline
        const bulletinsByDate = {};
        calendarBulletins.forEach((bulletin) => {
            const rawDates = bulletin.dateType === 'sessions'
                ? this.getBulletinEventDates(bulletin)
                : [bulletin.eventDate || bulletin.startDate || bulletin.deadline].filter(Boolean);

            rawDates.forEach((rawDate) => {
                const date = new Date(String(rawDate).split('T')[0] + 'T12:00:00');
                if (Number.isNaN(date.getTime())) {
                    return;
                }

                const dateKey = date.toDateString();
                if (!bulletinsByDate[dateKey]) {
                    bulletinsByDate[dateKey] = [];
                }
                bulletinsByDate[dateKey].push(bulletin);
            });
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
            
            const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            calendarHTML += this.createMonthlyCalendarDay(day, dayBulletins, isToday, { navigatorMode, isoDate });
        }

        calendarHTML += `
                </div>
            </div>
        `;

        return calendarHTML;
    }

    createMonthlyCalendarDay(day, bulletins, isToday, options = {}) {
        const { navigatorMode = false, isoDate = '' } = options;
        const bulletinCount = bulletins.length;
        const hasBulletins = bulletinCount > 0;
        // In navigator mode (desktop split), click scrolls the list (bound separately).
        // In popup mode (mobile), click opens the day's events.
        const clickHandler = hasBulletins && !navigatorMode
            ? `onclick='window.bulletinBoard && window.bulletinBoard.showDayEventsByIds(${JSON.stringify(bulletins.map(b => b.id))})'`
            : '';
        const dayAttr = hasBulletins && navigatorMode ? `data-calendar-day="${isoDate}"` : '';

        return `
            <div class="calendar-day ${isToday ? 'today' : ''} ${hasBulletins ? 'has-bulletins' : ''}"
                 data-bulletin-count="${bulletinCount}"
                 ${dayAttr}
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
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="monthly-bulletin-item" onclick="bulletinBoard.showBulletinDetail('${this.escapeAttribute(bulletin.id)}')">
                <div class="monthly-bulletin-category category-${bulletin.category}"></div>
                <div class="monthly-bulletin-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
                ${displayDate ? `
                    <div class="monthly-bulletin-deadline ${isDeadlineClose ? 'deadline-warning' : ''}">
                        ${displayDate}
                    </div>
                ` : ''}
            </div>
        `;
    }

    createCalendarBulletinItem(bulletin) {
        const isDeadlineClose = this.isApplicationDeadline(bulletin);
        
        // Get the date to display - prioritize new date structure
        let displayDate = '';
        if (bulletin.dateType && bulletin.eventDate) {
            displayDate = this.formatDateLocal(bulletin.eventDate);
        } else if (bulletin.deadline) {
            displayDate = this.formatDateLocal(bulletin.deadline);
        }
        
        return `
            <div class="calendar-bulletin-item">
                <div class="calendar-bulletin-title">${this.escapeHtml(this.getPostTitle(bulletin))}</div>
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

}
