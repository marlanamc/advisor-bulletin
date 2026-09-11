/**
 * The composer's own validation failures, tagged so the submit handler can
 * show the advisor what to fix.
 *
 * Everything the composer throws deliberately carries a message written for
 * an advisor ("Resource link is required."). Firebase failures do not -- they
 * carry codes and internals. handleBulletinSubmit used to flatten both into
 * one generic "Error saving resource. Please try again.", so a missing title
 * and a genuine outage looked identical. Tagging our own throws lets the
 * handler surface those messages and keep the friendly fallback for the rest.
 */

export class ComposerValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ComposerValidationError';
        this.code = 'composer-validation';
    }
}

/**
 * Some older upload guards throw bare strings rather than Errors, so accept
 * those too and hand back the message to display, or '' when the failure is
 * not one of ours.
 */
export function composerValidationMessage(error) {
    if (typeof error === 'string') {
        return error.trim();
    }
    if (error instanceof ComposerValidationError || error?.code === 'composer-validation') {
        return String(error.message || '').trim();
    }
    return '';
}
