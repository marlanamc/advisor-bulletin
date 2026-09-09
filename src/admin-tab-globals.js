/**
 * Global functions for the advisor portal's inline HTML onclick / onkeydown
 * handlers: showTab, handleTabKeydown, toggleDateFields.
 *
 * These module-level functions delegate to
 * window.adminPanel, which mountAdvisorPortal sets before assigning these
 * onto window.
 */

export function showTab(tabName) {
    window.adminPanel.showTab(tabName);
}

// Keyboard accessibility for tabs
export function handleTabKeydown(event, tabName) {
    switch (event.key) {
        case 'Enter':
        case ' ':
            event.preventDefault();
            showTab(tabName);
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

export function toggleDateFields() {
    const dateTypeEl = document.getElementById('dateType');
    const dateFields = document.getElementById('dateFields');
    const singleDateGroup = document.getElementById('singleDateGroup');
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    // Streamlined composer has no legacy date UI — dates live in optional blocks / event hero.
    if (!dateTypeEl || !dateFields || !singleDateGroup || !startDateGroup || !endDateGroup) {
        return;
    }

    const dateType = dateTypeEl.value;
    const sessionsDateGroup = document.getElementById('sessionsDateGroup');
    const eventTimeRow = document.querySelector('.event-time-row');
    const eventDateInput = document.getElementById('eventDate');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Hide all date fields initially
    dateFields.style.display = 'none';
    singleDateGroup.style.display = 'none';
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    if (sessionsDateGroup) sessionsDateGroup.style.display = 'none';
    if (eventTimeRow) eventTimeRow.style.display = '';

    // Remove required attribute from all date fields first
    if (eventDateInput) eventDateInput.required = false;
    if (startDateInput) startDateInput.required = false;
    if (endDateInput) endDateInput.required = false;
    document.querySelectorAll('#eventDatesList input[name="eventDates"]').forEach((input) => {
        input.required = false;
    });

    if (dateType === 'deadline') {
        dateFields.style.display = 'grid';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Application Deadline';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'event') {
        dateFields.style.display = 'grid';
        singleDateGroup.style.display = 'block';
        const label = document.querySelector('label[for="eventDate"]');
        if (label) label.textContent = 'Event Date';
        if (eventDateInput) eventDateInput.required = true;
    } else if (dateType === 'sessions') {
        dateFields.style.display = 'grid';
        if (sessionsDateGroup) sessionsDateGroup.style.display = 'block';
        if (eventTimeRow) eventTimeRow.style.display = 'none';
        if (window.adminPanel) {
            const rows = document.querySelectorAll('#eventDatesList .event-date-row');
            if (rows.length < 2) {
                const firstValue = rows.length === 1 ? (rows[0].querySelector('.event-session-date')?.value || '') : '';
                window.adminPanel.renderEventDatesList(
                    firstValue ? [{ date: firstValue }, { date: '' }] : [{ date: '' }, { date: '' }]
                );
            }
        }
        const firstSessionInput = document.querySelector('#eventDatesList input[name="eventDates"]');
        if (firstSessionInput) firstSessionInput.required = true;
    } else if (dateType === 'range' || dateType === 'recurring') {
        dateFields.style.display = 'grid';
        startDateGroup.style.display = 'block';
        endDateGroup.style.display = 'block';
        if (startDateInput) startDateInput.required = true;
        if (endDateInput) endDateInput.required = true;
    }
    if (typeof window.syncAdminStudentPreview === 'function') {
        window.syncAdminStudentPreview();
    }
}
