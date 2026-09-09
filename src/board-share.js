/**
 * Share modal for the student board — the "Share This Opportunity" sheet
 * with WhatsApp / Facebook / Email / SMS buttons and a copy-link field.
 *
 * These module-level functions have no dependency on the
 * FirebaseBulletinBoard instance. Importing this module for its side effect
 * installs the window.* globals used by existing board renderers.
 */

function shareBulletin(bulletinId, bulletinTitle) {
    const shareUrl = `${window.location.origin}${window.location.pathname}#bulletin-${bulletinId}`;
    fallbackShare(bulletinTitle, shareUrl);
}

function escapeHtmlAttributeValue(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function fallbackShare(title, url) {
    // Ensure any existing share modal is closed before opening a new one
    closeShareModal();

    const titleAttr = escapeHtmlAttributeValue(title);
    const urlAttr = escapeHtmlAttributeValue(url);

    // Create share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <h3>Share This Opportunity</h3>
            <div class="share-options">
                <button type="button" data-share-platform="whatsapp" data-share-title="${titleAttr}" data-share-url="${urlAttr}" class="share-option whatsapp">
                    📱 WhatsApp
                </button>
                <button type="button" data-share-platform="facebook" data-share-title="${titleAttr}" data-share-url="${urlAttr}" class="share-option facebook">
                    📘 Facebook
                </button>
                <button type="button" data-share-platform="email" data-share-title="${titleAttr}" data-share-url="${urlAttr}" class="share-option email">
                    ✉️ Email
                </button>
                <button type="button" data-share-platform="sms" data-share-title="${titleAttr}" data-share-url="${urlAttr}" class="share-option sms">
                    💬 Text Message
                </button>
            </div>
            <div class="share-link">
                <input type="text" value="${urlAttr}" id="shareLink" readonly>
                <button type="button" data-share-action="copy" class="copy-btn">Copy Link</button>
            </div>
            <button type="button" data-share-action="close" class="close-share">Close</button>
        </div>
    `;

    modal.addEventListener('click', (event) => {
        const platformButton = event.target.closest('[data-share-platform]');
        if (platformButton) {
            shareVia(
                platformButton.getAttribute('data-share-platform'),
                platformButton.getAttribute('data-share-title') || '',
                platformButton.getAttribute('data-share-url') || '',
            );
            return;
        }

        const actionButton = event.target.closest('[data-share-action]');
        if (actionButton?.getAttribute('data-share-action') === 'copy') {
            copyLink();
        } else if (actionButton?.getAttribute('data-share-action') === 'close') {
            closeShareModal();
        }
    });
    document.body.appendChild(modal);
}

function shareVia(platform, title, url) {
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(url);
    const encodedEmailBody = encodeURIComponent(`Check out this opportunity: ${url}`);
    const encodedSmsBody = encodeURIComponent(`${title} ${url}`);
    const shareUrls = {
        whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        email: `mailto:?subject=${encodedTitle}&body=${encodedEmailBody}`,
        sms: `sms:?body=${encodedSmsBody}`
    };

    if (shareUrls[platform]) {
        window.open(shareUrls[platform], '_blank');
    }
    closeShareModal();
}

function copyLink() {
    const linkInput = document.getElementById('shareLink');
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        const copyBtn = document.querySelector('.copy-btn');
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#27ae60';
        setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
            copyBtn.style.background = '';
        }, 2000);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

function closeShareModal() {
    const modal = document.querySelector('.share-modal');
    if (modal) modal.remove();
}

window.shareBulletin = shareBulletin;
window.shareVia = shareVia;
window.copyLink = copyLink;
window.closeShareModal = closeShareModal;

export { shareBulletin, shareVia, copyLink, closeShareModal, fallbackShare };
