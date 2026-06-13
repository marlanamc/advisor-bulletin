// Bulletin detail modal rendering.
// Extracted verbatim from firebase-config.js; methods are merged onto
// FirebaseBulletinBoard.prototype by applyMethods() in firebase-config.js.
import { formatResourceHoursHtml } from './resource-hours.js'

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
        const tagValues = [bulletin.classType ? this.getClassTypeDisplay(bulletin.classType) : '', bulletin.company || '', bulletin.eventLocation || '']
            .filter(Boolean)
            .slice(0, 3);
        const contactAction = this.getDetailContactAction(bulletin);
        const showDetailInfoGrid = this.hasDetailInfoGridContent(bulletin);
        const resourceUrl = this.isResourceBulletin(bulletin) ? this.getResourceUrl(bulletin) : '';
        const detailExternalLink = resourceUrl && resourceUrl !== '#'
            ? resourceUrl
            : (bulletin.eventLink || '');
        const currentLang = document.body.getAttribute('data-lang') || 'EN';
        const displayImage = (currentLang === 'ES' && bulletin.imageEs) ? bulletin.imageEs : bulletin.image;

        const heroContent = displayImage
            ? `<button type="button" class="post-detail-hero-zoom lightbox-trigger" data-lightbox-src="${this.escapeAttribute(displayImage)}" aria-label="View full size flyer">
                <img class="post-detail-hero-image" src="${this.escapeAttribute(displayImage)}" alt="">
                <span class="post-detail-hero-zoom-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg>
                    <span class="en-text">Tap to zoom</span>
                    <span class="es-text">Toca para ampliar</span>
                </span>
            </button>`
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
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Location</strong><span style="font-size: 0.95rem;">${this.escapeHtml(bulletin.address)}</span></div>
                                </div>
                            ` : ''}
                            
                            ${bulletin.hours ? `
                                <div style="display: flex; gap: 12px; align-items: flex-start;">
                                    <div style="color: ${meta.accent}; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                                    <div><strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Hours</strong>${formatResourceHoursHtml(bulletin.hours, (value) => this.escapeHtml(value))}</div>
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
                                <span><strong>${this.escapeHtml(contactAction.label)}</strong><small>${this.escapeHtml(contactAction.value)}</small></span>
                            </a>
                        ` : ''}
                        ${bulletin.pdfUrl ? `
                            <button type="button" class="post-detail-action post-detail-action--outline" onclick="window.bulletinBoard.openPdfFromBulletin('${bulletin.id}')">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
                                <span><strong>View PDF</strong><small>Open attachment</small></span>
                            </button>
                        ` : ''}
                        ${detailExternalLink ? `
                            <a href="${this.escapeAttribute(detailExternalLink)}" target="_blank" rel="noopener" class="post-detail-action post-detail-action--outline">
                                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                                <span><strong>${this.escapeHtml(this.getDetailLinkActionLabel(bulletin.category))}</strong><small>${this.escapeHtml(this.getDisplayHost(detailExternalLink))}</small></span>
                            </a>
                        ` : ''}
                        <button type="button" class="post-detail-action post-detail-action--share" onclick="shareBulletin('${this.escapeAttribute(bulletin.id)}','${this.escapeAttribute(this.getPostTitle(bulletin) || '')}')">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                            <strong>Share with a friend</strong>
                        </button>
                    </div>
                </section>
            </article>
        `;
    }

    getDetailImportantDate(bulletin) {
        if (bulletin.dateType === 'sessions') {
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
                label: this.formatSessionDatesDetailLabel(bulletin)
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

    getDetailContactAction(bulletin) {
        const phone = bulletin.phone || '';
        const source = [phone, bulletin.contact].filter(Boolean).join(' ');
        const phoneMatch = source.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);

        if (!phoneMatch) return null;

        const matchedPhone = phoneMatch[0].replace(/\s+/g, ' ').trim();
        const tel = matchedPhone.replace(/[^0-9+]/g, '');
        const mode = bulletin.phoneMode || 'call';

        let label = 'Call';
        let href = `tel:${tel}`;

        if (mode === 'text') {
            label = 'Text';
            href = `sms:${tel}`;
        } else if (mode === 'both') {
            label = 'Call or Text';
            // Default link to call, text mentioned in label
        }

        if (bulletin.category === 'job') {
            label = mode === 'text' ? 'Text hiring' : 'Call hiring';
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
            job: 'Apply online',
            training: 'Sign up online',
            college: 'Apply online',
            'career-fair': 'Event details',
            resource: 'Open resource',
            announcement: 'More info'
        };

        return labels[category] || 'Open link';
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
