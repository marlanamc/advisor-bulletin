/**
 * Share modal for the student board — the "Share This Opportunity" sheet
 * with WhatsApp / Facebook / Email / SMS buttons and a copy-link field.
 *
 * Lifted verbatim out of firebase-config.js (Stage 1 of the file-split
 * refactor). These were already module-level functions with no dependency
 * on the FirebaseBulletinBoard instance. Importing this module for its side
 * effect installs the window.* globals that the modal's inline onclick=
 * handlers resolve against.
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

    const urlAttr = escapeHtmlAttributeValue(url);

    // Create share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <h3>Share This Opportunity</h3>
            <div class="share-options">
                <button onclick="shareVia('whatsapp', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option whatsapp">
                    📱 WhatsApp
                </button>
                <button onclick="shareVia('facebook', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option facebook">
                    📘 Facebook
                </button>
                <button onclick="shareVia('email', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option email">
                    ✉️ Email
                </button>
                <button onclick="shareVia('sms', '${encodeURIComponent(title)}', '${encodeURIComponent(url)}')" class="share-option sms">
                    💬 Text Message
                </button>
            </div>
            <div class="share-link">
                <input type="text" value="${urlAttr}" id="shareLink" readonly>
                <button onclick="copyLink()" class="copy-btn">Copy Link</button>
            </div>
            <button onclick="closeShareModal()" class="close-share">Close</button>
        </div>
    `;

    document.body.appendChild(modal);
}

function shareVia(platform, title, url) {
    const shareUrls = {
        whatsapp: `https://wa.me/?text=${title}%20${url}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
        email: `mailto:?subject=${title}&body=Check out this opportunity: ${url}`,
        sms: `sms:?body=${title} ${url}`
    };

    window.open(shareUrls[platform], '_blank');
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

// Inline handlers (onclick="...") resolve on `window`; this file is an ES module, so export explicitly.
window.shareBulletin = shareBulletin;
window.shareVia = shareVia;
window.copyLink = copyLink;
window.closeShareModal = closeShareModal;

export { shareBulletin, shareVia, copyLink, closeShareModal, fallbackShare };
