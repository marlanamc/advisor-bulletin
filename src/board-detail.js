// Bulletin detail modal rendering.
// Merged onto FirebaseBulletinBoard.prototype by applyMethods() in firebase-config.js.
import { formatResourceHoursHtml, formatResourceHoursRowsHtml } from './resource-hours.js'
import { normalizeWebUrl } from './url-safety.js'
import { buildBulletinCalendarLink } from './calendar-export.js'
import { toRichTextPlainText } from './rich-text.js'

export class BoardDetailMethods {
    renderBulletinDetail(bulletin) {
        const meta = this.getCatMeta(bulletin.category);
        const postedDate = this.formatPostedDate(bulletin.datePosted);
        const importantDate = this.getDetailImportantDate(bulletin);
        const sessionCount = bulletin.dateType === 'sessions' ? this.getBulletinEventSessions(bulletin).length : 0;
        const isMultiSessionDetail = sessionCount > 1;
        const isDeadlineClose = importantDate && importantDate.kind === 'deadline' && this.isDeadlineClose(importantDate.raw);
        const isExpired = this.isBulletinExpired(bulletin);
        const initial = (bulletin.advisorName || '?').charAt(0).toUpperCase();
        const omitAuthorPostedDate =
            importantDate && (importantDate.kind === 'event' || importantDate.kind === 'start');
        const authorHtml = bulletin.isSchoolCalendarAnchor
            ? '<strong>School Calendar</strong>'
            : omitAuthorPostedDate
                ? `<strong>${this.escapeHtml(bulletin.advisorName || 'Advisor')}</strong>`
                : `<strong>${this.escapeHtml(bulletin.advisorName || 'Advisor')}</strong> · ${postedDate}`;
        const postDescription = this.getPostDescription(bulletin);
        const isResource = this.isResourceBulletin(bulletin);
        const resourceServicesHtml = isResource ? this.getResourceServiceChipsHtml(bulletin) : '';
        const formattedDescription = postDescription
            ? this.renderFormattedDescription(postDescription, `${bulletin.id}-detail`)
            : '';
        const postDescriptionBlock = !isResource && formattedDescription
            ? `<div class="post-detail-description">${formattedDescription}</div>`
            : '';
        const resourceNotesHtml = isResource && formattedDescription
            ? `<div class="post-detail-description post-detail-description--notes"><p class="post-detail-notes-label"><span class="en-text">Additional notes</span><span class="es-text">Notas adicionales</span></p>${formattedDescription}</div>`
            : '';
        // Prefer the Location row in the info grid; skip eventLocation tag when address already covers it.
        const addressShown = Boolean((bulletin.address || '').trim());
        const eventLocationTag = addressShown ? '' : (bulletin.eventLocation || '');
        const tagValues = [bulletin.classType ? this.getClassTypeDisplay(bulletin.classType) : '', bulletin.company || '', eventLocationTag]
            .filter(Boolean)
            .slice(0, 3);
        const contactAction = this.getDetailContactAction(bulletin);
        const calendarAction = this.getBulletinCalendarAction(bulletin);
        const showDetailInfoGrid = this.hasDetailInfoGridContent(bulletin);
        const resourceUrl = this.isResourceBulletin(bulletin) ? this.getResourceUrl(bulletin) : '';
        const detailExternalLink = resourceUrl && resourceUrl !== '#'
            ? resourceUrl
            : normalizeWebUrl(bulletin.eventLink || '');
        const currentLang = document.body.getAttribute('data-lang') || 'EN';
        const displayImage = (currentLang === 'ES' && bulletin.imageEs) ? bulletin.imageEs : bulletin.image;

        const heroAlt = this.getPostTitle(bulletin) || 'Flyer';
        const resourceLogo = isResource ? (bulletin.resourceLogo || '') : '';
        const heroContent = displayImage
            ? `<button type="button" class="post-detail-hero-zoom lightbox-trigger" data-lightbox-src="${this.escapeAttribute(displayImage)}" data-lightbox-alt="${this.escapeAttribute(heroAlt)}" aria-label="View full size flyer">
                <img class="post-detail-hero-image" src="${this.escapeAttribute(displayImage)}" alt="">
                <span class="post-detail-hero-zoom-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>
                    <span class="en-text">Tap to zoom</span>
                    <span class="es-text">Toca para ampliar</span>
                </span>
            </button>`
            : resourceLogo
                ? `<div class="post-detail-hero-art">
                    <div class="post-detail-icon post-detail-icon--logo"><img src="${this.escapeAttribute(resourceLogo)}" alt="${this.escapeAttribute(heroAlt)} logo"></div>
                </div>`
                : `<div class="post-detail-hero-art">
                    <div class="post-detail-icon">${this.getSchoolBoatIconSvg()}</div>
                </div>`;

        return `
            <article class="post-detail-page" style="--detail-accent:${meta.accent};--detail-tint:${meta.tint}">
                <section class="post-detail-hero ${bulletin.image ? 'post-detail-hero--image' : 'post-detail-hero--art-only'}" aria-hidden="true">
                    ${heroContent}
                </section>
                <section class="post-detail-panel">
                    <p class="post-detail-category" style="color:${meta.accent}">
                        <span class="en-text">${this.escapeHtml(meta.label.toUpperCase())}</span>
                        <span class="es-text">${this.escapeHtml(meta.labelEs.toUpperCase())}</span>
                    </p>
                    <h2>${this.escapeHtml(this.getPostTitle(bulletin))}</h2>
                    ${resourceServicesHtml}
                    ${isExpired ? '<p class="post-detail-expired">Expired</p>' : ''}
                    <div class="post-detail-author">
                        <span class="post-detail-avatar" style="background:${meta.accent}">${this.escapeHtml(initial)}</span>
                        <span>${authorHtml}</span>
                    </div>
                    ${importantDate ? `
                        <div class="post-detail-date ${isDeadlineClose && !isExpired ? 'post-detail-date--urgent' : ''}${isMultiSessionDetail ? ' post-detail-date--sessions' : ''}">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                            <div class="post-detail-date-copy">
                                <strong>${isMultiSessionDetail ? 'Session dates' : 'Important date'}</strong>
                                ${isMultiSessionDetail
                                    ? this.buildSessionDatesDetailHtml(bulletin)
                                    : `<small>${this.escapeHtml(importantDate.label)}</small>`}
                            </div>
                        </div>
                    ` : ''}
                    ${postDescriptionBlock}
                    
                    ${showDetailInfoGrid ? `
                        <div class="post-detail-info-grid" style="margin-top: 24px; display: grid; gap: 16px; background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0;">
                            ${bulletin.address ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;"><span class="en-text">Location</span><span class="es-text">Ubicación</span></strong><span style="font-size: 0.95rem;">${this.escapeHtml(bulletin.address)}</span></div>
                                </div>
                            ` : ''}
                            
                            ${(Array.isArray(bulletin.hoursRows) && bulletin.hoursRows.length) || bulletin.hours ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase; margin-bottom: 6px;"><span class="en-text">Hours</span><span class="es-text">Horario</span></strong>${Array.isArray(bulletin.hoursRows) && bulletin.hoursRows.length
                                        ? formatResourceHoursRowsHtml(bulletin.hoursRows, (value) => this.escapeHtml(value))
                                        : formatResourceHoursHtml(bulletin.hours, (value) => this.escapeHtml(value), bulletin.hoursEs)}</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    ${resourceNotesHtml}

                    ${tagValues.length ? `<div class="post-detail-tags">${tagValues.map((tag) => `<span>${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
                    ${bulletin.contact ? `<div class="post-detail-contact-note">${this.escapeHtml(bulletin.contact).replace(/\n/g, '<br>')}</div>` : ''}
                    <div class="post-detail-actions">
                        ${contactAction ? `
                            <a href="${this.escapeAttribute(contactAction.href)}" class="post-detail-action post-detail-action--primary">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                                <span><strong><span class="en-text">${this.escapeHtml(contactAction.label.en)}</span><span class="es-text">${this.escapeHtml(contactAction.label.es)}</span></strong><small>${this.escapeHtml(contactAction.value)}</small></span>
                            </a>
                        ` : ''}
                        ${bulletin.pdfUrl ? `
                            <button type="button" class="post-detail-action post-detail-action--outline" data-detail-action="open-pdf" data-bulletin-id="${this.escapeAttribute(bulletin.id)}">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                                <span><strong><span class="en-text">View PDF</span><span class="es-text">Ver PDF</span></strong><small><span class="en-text">Open attachment</span><span class="es-text">Abrir archivo</span></small></span>
                            </button>
                        ` : ''}
                        ${detailExternalLink ? `
                            <a href="${this.escapeAttribute(detailExternalLink)}" target="_blank" rel="noopener" class="post-detail-action post-detail-action--outline">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                                <span><strong>${this.getDetailLinkActionLabel(bulletin.category)}</strong><small>${this.escapeHtml(this.getDisplayHost(detailExternalLink))}</small></span>
                            </a>
                        ` : ''}
                        ${calendarAction ? `
                            <a href="${this.escapeAttribute(calendarAction.href)}" target="_blank" rel="noopener" class="post-detail-action post-detail-action--outline">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/><path d="M12 14v4M10 16h4"/></svg>
                                <span>
                                    <strong><span class="en-text">Add to Google Calendar</span><span class="es-text">Agregar a Google Calendar</span></strong>
                                    <small><span class="en-text">${this.escapeHtml(calendarAction.hint.en)}</span><span class="es-text">${this.escapeHtml(calendarAction.hint.es)}</span></small>
                                </span>
                            </a>
                        ` : ''}
                        <button type="button" class="post-detail-action post-detail-action--share" data-detail-action="share" data-bulletin-id="${this.escapeAttribute(bulletin.id)}" data-bulletin-title="${this.escapeAttribute(this.getPostTitle(bulletin) || '')}">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                            <strong><span class="en-text">Share with a friend</span><span class="es-text">Compartir con un amigo</span></strong>
                        </button>
                    </div>
                </section>
            </article>
        `;
    }

    bindBulletinDetailActions(container) {
        if (!container || container.__detailActionsBound) {
            return;
        }

        container.addEventListener('click', (event) => {
            const dayEvent = event.target.closest('[data-day-event-id]');
            if (dayEvent && container.contains(dayEvent)) {
                event.stopPropagation();
                this.showBulletinDetail(dayEvent.getAttribute('data-day-event-id'));
                return;
            }

            const actionButton = event.target.closest('[data-detail-action]');
            if (!actionButton || !container.contains(actionButton)) {
                return;
            }

            const action = actionButton.getAttribute('data-detail-action');
            if (action === 'close') {
                this.closeBulletinDetail();
                return;
            }

            const bulletinId = actionButton.getAttribute('data-bulletin-id') || '';
            if (!bulletinId) {
                return;
            }

            if (action === 'open-pdf') {
                this.openPdfFromBulletin(bulletinId);
            } else if (action === 'share') {
                window.shareBulletin?.(bulletinId, actionButton.getAttribute('data-bulletin-title') || '');
            }
        });

        container.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            const dayEvent = event.target.closest('[data-day-event-id]');
            if (dayEvent && container.contains(dayEvent)) {
                event.preventDefault();
                event.stopPropagation();
                this.showBulletinDetail(dayEvent.getAttribute('data-day-event-id'));
            }
        });

        container.__detailActionsBound = true;
    }

    getDetailImportantDate(bulletin) {
        if (bulletin.dateType === 'sessions' || bulletin.dateType === 'recurring') {
            const items = this.expandBulletinDateItems(bulletin);
            if (!items.length) return null;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcoming = items
                .filter((item) => item.date >= today)
                .sort((a, b) => a.date.getTime() - b.date.getTime());
            const item = upcoming[0] || items[items.length - 1];

            return {
                raw: item.rawDate,
                date: item.date,
                kind: item.kind,
                label: bulletin.dateType === 'recurring'
                    ? this.formatRecurringDetailLabel(bulletin)
                    : this.formatSessionDatesDetailLabel(bulletin)
            };
        }

        const item = this.getDatesListItem(bulletin);
        if (!item) return null;

        return {
            raw: item.rawDate,
            date: item.date,
            kind: item.kind,
            label: item.label
        };
    }

    /**
     * Null when the bulletin has no date worth putting in a calendar, so the
     * caller can leave the button out entirely.
     * @returns {{ href: string, hint: { en: string, es: string } } | null}
     */
    getBulletinCalendarAction(bulletin) {
        // Strip rich-text markers line by line so paragraph breaks survive
        // into the calendar entry's notes.
        const notes = this.getPostDescription(bulletin)
            .split('\n')
            .map((line) => toRichTextPlainText(line))
            .filter(Boolean)
            .join('\n');

        const link = buildBulletinCalendarLink({
            bulletin,
            sessions: this.getBulletinEventSessions(bulletin),
            title: this.getPostTitle(bulletin),
            notes,
            timeLabel: this.formatTimeRange(bulletin.startTime, bulletin.endTime),
            location: (bulletin.address || bulletin.eventLocation || '').trim(),
            url: `${window.location.origin}${window.location.pathname}#bulletin-${bulletin.id}`,
        });

        if (!link) return null;

        return { href: link.href, hint: this.getCalendarActionHint(bulletin, link) };
    }

    /**
     * One Google Calendar link starts on one date, and only carries the rest
     * when they form a weekly pattern. Say which of those happened rather
     * than promising dates the link will not add.
     */
    getCalendarActionHint(bulletin, link) {
        if (bulletin.dateType === 'deadline') {
            return { en: 'Saves the deadline', es: 'Guarda la fecha límite' };
        }

        if (link.savedCount > 1) {
            return {
                en: `Saves all ${link.savedCount} dates`,
                es: `Guarda las ${link.savedCount} fechas`,
            };
        }

        if (link.remainingCount > 1) {
            return { en: 'Saves the next date', es: 'Guarda la próxima fecha' };
        }

        return { en: 'Saves the date', es: 'Guarda la fecha' };
    }

    getDetailContactAction(bulletin) {
        const phone = bulletin.phone || '';
        const source = [phone, bulletin.contact].filter(Boolean).join(' ');
        const phoneMatch = source.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

        if (!phoneMatch) return null;

        const matchedPhone = phoneMatch[0].replace(/\s+/g, ' ').trim();
        const tel = matchedPhone.replace(/[^0-9+]/g, '');
        const mode = bulletin.phoneMode || 'call';

        let label = { en: 'Call', es: 'Llamar' };
        let href = `tel:${tel}`;

        if (mode === 'text') {
            label = { en: 'Text', es: 'Enviar mensaje' };
            href = `sms:${tel}`;
        } else if (mode === 'both') {
            label = { en: 'Call or Text', es: 'Llamar o enviar mensaje' };
            // Default link to call, text mentioned in label
        }

        if (bulletin.category === 'job') {
            label = mode === 'text'
                ? { en: 'Text hiring', es: 'Mensaje a contratación' }
                : { en: 'Call hiring', es: 'Llamar a contratación' };
        }

        return {
            href: href,
            label: label,
            value: matchedPhone
        };
    }

    hasDetailInfoGridContent(bulletin) {
        if (!bulletin) return false;
        if ((bulletin.address || '').trim()) return true;
        return Boolean((bulletin.hours || '').trim());
    }

    getDetailLinkActionLabel(category) {
        const labels = {
            job: { en: 'Apply online', es: 'Aplicar en línea' },
            training: { en: 'Sign up online', es: 'Inscribirse en línea' },
            college: { en: 'Apply online', es: 'Aplicar en línea' },
            'career-fair': { en: 'Event details', es: 'Detalles del evento' },
            resource: { en: 'Open resource', es: 'Abrir recurso' },
            announcement: { en: 'More info', es: 'Más info' }
        };

        const label = labels[category] || { en: 'Open link', es: 'Abrir enlace' };
        return `<span class="en-text">${this.escapeHtml(label.en)}</span><span class="es-text">${this.escapeHtml(label.es)}</span>`;
    }

    getDisplayHost(url) {
        if (!url) return '';

        try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '');
        } catch (error) {
            return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        }
    }

}
