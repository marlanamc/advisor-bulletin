function getLightboxElements() {
    return {
        lightbox: document.getElementById('imgLightbox'),
        lightboxImg: document.getElementById('imgLightboxImg'),
        closeBtn: document.getElementById('imgLightboxClose'),
        backdrop: document.getElementById('imgLightboxBackdrop'),
        openBtn: document.getElementById('imgLightboxOpenBtn'),
        frame: document.querySelector('.img-lightbox-frame'),
    };
}

// Only the lightbox's own inline lock gets cleared on close, so closing the
// viewer can never unlock scroll for a layer that locked it for itself.
let lightboxLockedBodyScroll = false;
let lightboxOpenerElement = null;

function usesClassBasedScrollLock() {
    return document.body.classList.contains('modal-open')
        || document.body.classList.contains('search-layer-open')
        || document.body.classList.contains('resource-sheet-open');
}

export function isImageLightboxOpen() {
    const { lightbox } = getLightboxElements();
    return Boolean(lightbox && lightbox.classList.contains('open'));
}

export function openImageLightbox(src, alt) {
    const { lightbox, lightboxImg, openBtn } = getLightboxElements();
    if (!lightbox || !lightboxImg || !src) {
        return;
    }

    lightboxImg.classList.remove('is-tall');
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Full size flyer';
    if (openBtn) {
        openBtn.href = src;
    }
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');

    // Modal/sheet layers already lock page scroll via body classes.
    if (!usesClassBasedScrollLock()) {
        document.body.style.overflow = 'hidden';
        lightboxLockedBodyScroll = true;
    }

    lightboxImg.onload = function () {
        const ratio = lightboxImg.naturalHeight / lightboxImg.naturalWidth;
        if (ratio > 1.2) {
            lightboxImg.classList.add('is-tall');
        }
    };
}

export function closeImageLightbox() {
    const { lightbox, lightboxImg, frame } = getLightboxElements();
    if (!lightbox || !lightboxImg) {
        return;
    }

    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');

    // Clear only a lock this lightbox applied. Class-based locks (modal-open,
    // etc.) continue to manage page scroll when those layers stay open.
    if (lightboxLockedBodyScroll) {
        document.body.style.overflow = '';
        lightboxLockedBodyScroll = false;
    }

    // Focus goes back to the zoom button, so it never sits on a control inside
    // a hidden dialog and the post is where keyboard and scroll resume.
    if (lightbox.contains(document.activeElement)) {
        if (lightboxOpenerElement && lightboxOpenerElement.isConnected) {
            lightboxOpenerElement.focus({ preventScroll: true });
        } else {
            document.activeElement.blur();
        }
    }
    lightboxOpenerElement = null;

    // An empty src makes the browser re-request the page itself as an image.
    lightboxImg.removeAttribute('src');
    lightboxImg.classList.remove('is-tall');
    if (frame) {
        frame.scrollTop = 0;
    }
}

export function initImageLightbox() {
    const { lightbox, closeBtn, backdrop } = getLightboxElements();
    if (!lightbox) {
        return;
    }

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('.lightbox-trigger');
        if (!trigger || !trigger.dataset.lightboxSrc) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        lightboxOpenerElement = trigger;
        openImageLightbox(trigger.dataset.lightboxSrc, trigger.dataset.lightboxAlt);
    });

    closeBtn && closeBtn.addEventListener('click', closeImageLightbox);
    backdrop && backdrop.addEventListener('click', closeImageLightbox);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isImageLightboxOpen()) {
            event.stopImmediatePropagation();
            closeImageLightbox();
        }
    }, true);

    window.openImageLightbox = openImageLightbox;
    window.closeImageLightbox = closeImageLightbox;
    window.isImageLightboxOpen = isImageLightboxOpen;
}
