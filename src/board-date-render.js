/**
 * Date/time blocks rendered into bulletin feed cards and the detail sheet
 * on the student board.
 *
 * Merged onto FirebaseBulletinBoard.prototype by applyMethods().
 * The this.* helpers these call (isDeadlineClose, formatTimeRange,
 * getBulletinEventSessions, escapeHtml, parseStoredYmdLocal) live on other
 * parts of the merged prototype.
 */
import { formatSessionsDetailLines, WEEKDAY_NAMES } from './event-sessions.js'

export class BoardDateRenderMethods {
    renderDateInfo(bulletin) {
        // Prioritize new date structure over backward compatibility
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.eventDates && bulletin.eventDates.length) || (bulletin.startDate && bulletin.endDate))) {
            return this.renderNewDateInfo(bulletin);
        }

        // Backward compatibility - show deadline if it exists
        if (bulletin.deadline) {
            const isDeadlineClose = this.isDeadlineClose(bulletin.deadline);
            return `
                <div class="meta-item ${isDeadlineClose ? 'deadline-warning' : ''}">
                    <strong>Deadline:</strong> ${this.formatDateLocal(bulletin.deadline)}
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
        } else if (dateType === 'sessions') {
            const sessions = this.getBulletinEventSessions(bulletin);
            if (sessions.length) {
                const lines = formatSessionsDetailLines(
                    sessions,
                    (date) => this.formatDateLocal(date),
                    (start, end) => this.formatTimeRange(start, end)
                );
                dateHtml = `
                    <div class="meta-item">
                        <strong>Session Dates:</strong>
                        ${lines.map((line) => `<div>${this.escapeHtml(line)}</div>`).join('')}
                    </div>
                `;
            }
        } else if (dateType === 'recurring' && bulletin.startDate && bulletin.endDate) {
            const weekdayName = WEEKDAY_NAMES[Number(bulletin.recurringWeekday)] || '';
            let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
            dateHtml = `
                <div class="meta-item">
                    <strong>Recurring:</strong> Every ${weekdayName}, ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}
                </div>
            `;
        }

        // Add event location if specified
        if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'sessions' || dateType === 'recurring')) {
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
        if (bulletin.dateType && (bulletin.eventDate || (bulletin.eventDates && bulletin.eventDates.length) || (bulletin.startDate && bulletin.endDate))) {
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
            } else if (dateType === 'sessions') {
                const sessions = this.getBulletinEventSessions(bulletin);
                if (sessions.length) {
                    const lines = formatSessionsDetailLines(
                        sessions,
                        (date) => this.formatDateLocal(date),
                        (start, end) => this.formatTimeRange(start, end)
                    );
                    dateHtml = `<div><strong>Session Dates:</strong> ${lines.map((line) => this.escapeHtml(line)).join('<br>')}</div>`;
                }
            } else if (dateType === 'recurring' && bulletin.startDate && bulletin.endDate) {
                const weekdayName = WEEKDAY_NAMES[Number(bulletin.recurringWeekday)] || '';
                let timeInfo = this.formatTimeRange(bulletin.startTime, bulletin.endTime);
                dateHtml = `<div><strong>Recurring:</strong> Every ${weekdayName}, ${this.formatDateLocal(bulletin.startDate)} - ${this.formatDateLocal(bulletin.endDate)}${timeInfo ? ` at ${timeInfo}` : ''}</div>`;
            }

            // Add event location if specified
            if (bulletin.eventLocation && (dateType === 'event' || dateType === 'range' || dateType === 'sessions' || dateType === 'recurring')) {
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

        const ymd = String(dateString).split('T')[0].trim();
        const local = this.parseStoredYmdLocal(ymd);
        if (local) {
            return local.toLocaleDateString();
        }

        const date = new Date(dateString);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }
}
