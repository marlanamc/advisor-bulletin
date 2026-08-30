/**
 * Formatting/escaping helpers shared by the student board
 * (FirebaseBulletinBoard) and the advisor portal (FirebaseAdminPanel).
 *
 * Both classes had byte-identical copies of these; Stage 2 of the
 * file-split refactor collapses them here. The classes keep thin
 * this.<name>() wrappers so every existing call site — including the
 * mixins that call this.escapeHtml(...) etc. — is untouched.
 *
 * Helpers that only *look* duplicated (formatDateLocal, isDeadlineClose,
 * applyInlineFormatting) genuinely differ between the two files and are
 * deliberately NOT moved here — reconciling them is a behaviour change.
 */

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
}

export function escapeAttribute(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function getClassTypeDisplay(classType) {
    const classTypes = {
        'esol': 'ESOL (English for Speakers of Other Languages)',
        'hse': 'HSE (High School Equivalency)',
        'famlit': 'FamLit (Family Literacy)'
    };
    return classTypes[classType] || classType;
}

export function formatEventTime(timeString) {
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
