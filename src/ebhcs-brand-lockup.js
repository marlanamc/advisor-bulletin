const EBHCS_BRAND_BADGE_SVG = `<svg width="38" height="46" viewBox="0 0 76 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M4 4 H72 V52 C72 70 38 86 38 86 C38 86 4 70 4 52 Z" fill="#1e3a6e" stroke="#c9a84c" stroke-width="3.5" stroke-linejoin="round"/>
    <circle cx="38" cy="20" r="5" fill="none" stroke="white" stroke-width="2.8"/>
    <line x1="24" y1="29" x2="52" y2="29" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="38" y1="24" x2="38" y2="60" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M38 60 Q22 60 22 50" stroke="white" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <line x1="19" y1="52.5" x2="22" y2="50" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M38 60 Q54 60 54 50" stroke="white" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <line x1="57" y1="52.5" x2="54" y2="50" stroke="white" stroke-width="2.8" stroke-linecap="round"/>
</svg>`;

export const EBHCS_BRAND_ARIA_LABEL = 'East Boston Harborside Community School — Home';

export function renderEbhcsBrandLockup({
    href = null,
    extraClass = '',
    ariaLabel = EBHCS_BRAND_ARIA_LABEL,
} = {}) {
    const tag = href ? 'a' : 'div';
    const hrefAttr = href ? ` href="${href}"` : '';
    const classes = ['topbar-brand-lockup', extraClass].filter(Boolean).join(' ');

    return `<${tag} class="${classes}"${hrefAttr} aria-label="${ariaLabel}">
    <div class="topbar-badge">${EBHCS_BRAND_BADGE_SVG}</div>
    <div class="topbar-brand-text">
        <span class="topbar-brand-eyebrow">East Boston</span>
        <span class="topbar-brand-name">HARBORSIDE</span>
        <span class="topbar-brand-sub">Community School</span>
    </div>
</${tag}>`;
}

export function mountEbhcsBrandLockups(root = document) {
    root.querySelectorAll('[data-ebhcs-brand-lockup]').forEach((slot) => {
        const href = slot.dataset.brandHref;
        const variant = slot.dataset.brandVariant || 'sidebar';
        const link = href !== undefined && href !== 'false';
        const html = renderEbhcsBrandLockup({
            href: link ? (href || 'index.html') : null,
            extraClass: `ap-brand-lockup ap-brand-lockup--${variant}`,
        });

        slot.innerHTML = html;

        if (variant === 'preview') {
            slot.setAttribute('aria-hidden', 'true');
            slot.querySelector('.topbar-brand-lockup')?.removeAttribute('aria-label');
        }

        if (slot.dataset.brandPortalTag === 'true') {
            slot.insertAdjacentHTML('beforeend', '<div class="ap-brand-portal-tag">Advisor Portal</div>');
        }
    });
}
