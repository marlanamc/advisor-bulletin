/**
 * Transient toast / success messages for the advisor portal.
 *
 * Merged onto FirebaseAdminPanel.prototype by applyMethods().
 */

export class AdminToastMethods {
    showSuccessMessage(message) {
        this.showTemporaryMessage(message, 'success');
    }

    // Alias used throughout advisor management; without it every
    // this.showToast(...) call throws and kills the calling flow.
    showToast(message, type = 'info') {
        this.showTemporaryMessage(message, type);
    }

    showTemporaryMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.toast-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = 'toast-message';
        messageDiv.setAttribute('role', 'status');
        messageDiv.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        const toastType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        messageDiv.className = `toast-message toast-message--${toastType}`;

        messageDiv.innerHTML = `
            <span class="toast-message__icon" aria-hidden="true">${icons[toastType]}</span>
            <span class="toast-message__body">${this.escapeHtml(message)}</span>
        `;

        // Click to dismiss
        messageDiv.addEventListener('click', () => {
            messageDiv.classList.add('toast-message--exiting');
            setTimeout(() => messageDiv.remove(), 300);
        });

        document.body.appendChild(messageDiv);

        // Auto-remove after delay
        const delay = type === 'error' ? 6000 : 4000; // Longer for errors
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.classList.add('toast-message--exiting');
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, delay);
    }
}
