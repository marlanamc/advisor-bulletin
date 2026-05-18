function getLightboxElements() {
    return {
        lightbox: document.getElementById('imgLightbox'),
        lightboxImg: document.getElementById('imgLightboxImg'),
        closeBtn: document.getElementById('imgLightboxClose'),
        backdrop: document.getElementById('imgLightboxBackdrop'),
        openBtn: document.getElementById('imgLightboxOpenBtn'),
    };
}

export function isImageLightboxOpen() {
    const { lightbox } = getLightboxElements();
    return Boolean(lightbox && lightbox.classList.contains('open'));
}

export function openImageLightbox(src) {
    const { lightbox, lightboxImg, openBtn } = getLightboxElements();
    if (!lightbox || !lightboxImg || !src) {
        return;
    }

    lightboxImg.classList.remove('is-tall');
    lightboxImg.src = src;
    if (openBtn) {
        openBtn.href = src;
    }
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    lightboxImg.onload = function () {
        const ratio = lightboxImg.naturalHeight / lightboxImg.naturalWidth;
        if (ratio > 1.2) {
            lightboxImg.classList.add('is-tall');
        }
    };
}

export function closeImageLightbox() {
    const { lightbox, lightboxImg } = getLightboxElements();
    if (!lightbox || !lightboxImg) {
        return;
    }

    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (!document.body.classList.contains('modal-open')) {
        document.body.style.overflow = '';
    }
    lightboxImg.src = '';
    lightboxImg.classList.remove('is-tall');
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
        openImageLightbox(trigger.dataset.lightboxSrc);
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
