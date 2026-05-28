'use strict';

var header = document.querySelector('.app-topbar');

// ── Keep --app-header-offset in sync with actual topbar height ──
if (header) {
    function syncHeaderOffset() {
        var h = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--app-header-offset', h + 'px');
    }
    syncHeaderOffset();
    var ro = new ResizeObserver(syncHeaderOffset);
    ro.observe(header);
}

var storyRowWrap = document.querySelector('#feedView > .story-row-wrap.story-row-wrap--bilingual');
var storyRowCompactPending = false;
var storyRowIsCompact = false;
var STORY_ROW_COMPACT_ON = 96;
var STORY_ROW_COMPACT_OFF = 48;
var scrollIdleTimer;

function syncStoryRowCompact() {
    if (!storyRowWrap) {
        return;
    }
    if (document.body.getAttribute('data-current-view') !== 'feed') {
        storyRowIsCompact = false;
        storyRowWrap.classList.remove('story-row-wrap--compact');
        return;
    }
    var y = window.scrollY;
    if (!storyRowIsCompact && y > STORY_ROW_COMPACT_ON) {
        storyRowIsCompact = true;
    } else if (storyRowIsCompact && y < STORY_ROW_COMPACT_OFF) {
        storyRowIsCompact = false;
    }
    storyRowWrap.classList.toggle('story-row-wrap--compact', storyRowIsCompact);
}

function queueStoryRowCompactSync() {
    if (storyRowCompactPending) {
        return;
    }
    storyRowCompactPending = true;
    requestAnimationFrame(function () {
        storyRowCompactPending = false;
        syncStoryRowCompact();
    });
}

function onPageScroll() {
    document.body.classList.add('is-scrolling');
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = window.setTimeout(function () {
        document.body.classList.remove('is-scrolling');
    }, 140);

    if (header) {
        header.classList.toggle('collapsed', window.scrollY > 50);
    }
    queueStoryRowCompactSync();
}

if (header) {
    header.classList.toggle('collapsed', window.scrollY > 50);
}
syncStoryRowCompact();
window.addEventListener('scroll', onPageScroll, { passive: true });
if (document.body) {
    new MutationObserver(queueStoryRowCompactSync).observe(document.body, {
        attributes: true,
        attributeFilter: ['data-current-view']
    });
}

// Language toggle is handled by firebase-config.js via bulletinBoard.setLanguage().
// ── Feed search bar triggers search layer ──────────────
var feedSearchTrigger = document.getElementById('feedSearchTrigger');
var mobileSearchTrigger = document.getElementById('mobileSearchTrigger');
if (feedSearchTrigger && mobileSearchTrigger) {
    feedSearchTrigger.addEventListener('click', function () {
        mobileSearchTrigger.click();
    });
}

// ── Mobile inline search wires to main search ──────────
var mobileInlineInput = document.getElementById('mobileInlineSearchInput');
if (mobileInlineInput) {
    mobileInlineInput.addEventListener('input', function () {
        var mainInput = document.getElementById('searchInput');
        var heroInput = document.getElementById('heroSearchInput');
        if (mainInput) mainInput.value = this.value;
        if (heroInput) heroInput.value = this.value;
        // Trigger the app's filter logic
        var ev = new Event('input', { bubbles: true });
        if (mainInput) mainInput.dispatchEvent(ev);
    });
    mobileInlineInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') this.blur();
    });
}

// ── Category Detail Sheet ──────────────────────────────
var CAT_DATA = {
    immigration: {
        label: { en: 'Immigration', es: 'Inmigración' },
        color: '#0d8a7a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        orgs: [
            {
                name: 'Project Citizenship',
                address: '18 Tremont St, Suite 1120, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=18+Tremont+St+Boston+MA',
                phone: '(617) 357-0900',
                tel: 'tel:6173570900',
                langs: ['EN', 'ES', 'PT'],
                color: '#0d8a7a',
                initial: 'PC'
            },
            {
                name: 'East Boston Ecumenical Community Council',
                address: '68 Paris St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=68+Paris+St+East+Boston+MA',
                phone: '(617) 567-3196',
                tel: 'tel:6175673196',
                langs: ['EN', 'ES'],
                color: '#1f3d7a',
                initial: 'EB'
            },
            {
                name: 'MIRA Coalition',
                address: '105 Chauncy St, Suite 901, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=105+Chauncy+St+Boston+MA',
                phone: '(617) 350-5480',
                tel: 'tel:6173505480',
                langs: ['EN', 'ES', 'PT', 'HT'],
                color: '#7b4ec7',
                initial: 'MC'
            },
            {
                name: 'Irish Immigration Center',
                address: '100 Franklin St, Suite 801, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=100+Franklin+St+Boston+MA',
                phone: '(617) 542-7654',
                tel: 'tel:6175427654',
                langs: ['EN'],
                color: '#2d8a4a',
                initial: 'IC'
            }
        ]
    },
    job: {
        label: { en: 'Jobs', es: 'Empleos' },
        color: '#1f3d7a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
        orgs: [
            {
                name: 'MassHire East Boston Career Center',
                address: '215 Bremen St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=215+Bremen+St+East+Boston+MA',
                phone: '(617) 561-2222',
                tel: 'tel:6175612222',
                langs: ['EN', 'ES'],
                color: '#1f3d7a',
                initial: 'MH'
            },
            {
                name: 'Jewish Vocational Service',
                address: '75 Federal St, Suite 611, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=75+Federal+St+Boston+MA',
                phone: '(617) 399-3131',
                tel: 'tel:6173993131',
                langs: ['EN', 'ES', 'RU'],
                color: '#0d8a7a',
                initial: 'JV'
            }
        ]
    },
    housing: {
        label: { en: 'Housing', es: 'Vivienda' },
        color: '#d96a4a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        orgs: [
            {
                name: 'East Boston Neighborhood Health Center',
                address: '10 Gove St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=10+Gove+St+East+Boston+MA',
                phone: '(617) 569-5800',
                tel: 'tel:6175695800',
                langs: ['EN', 'ES', 'PT'],
                color: '#d96a4a',
                initial: 'EB'
            },
            {
                name: 'Greater Boston Legal Services',
                address: '197 Friend St, Boston, MA 02114',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=197+Friend+St+Boston+MA',
                phone: '(617) 603-1700',
                tel: 'tel:6176031700',
                langs: ['EN', 'ES', 'HT', 'VI'],
                color: '#1f3d7a',
                initial: 'GB'
            }
        ]
    },
    health: {
        label: { en: 'Health', es: 'Salud' },
        color: '#e0497d',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        orgs: [
            {
                name: 'East Boston Neighborhood Health Center',
                address: '10 Gove St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=10+Gove+St+East+Boston+MA',
                phone: '(617) 569-5800',
                tel: 'tel:6175695800',
                langs: ['EN', 'ES', 'PT', 'HT'],
                color: '#e0497d',
                initial: 'EB'
            },
            {
                name: 'Boston Medical Center',
                address: '1 Boston Medical Center Pl, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=1+Boston+Medical+Center+Place+Boston+MA',
                phone: '(617) 638-8000',
                tel: 'tel:6176388000',
                langs: ['EN', 'ES', 'PT', 'HT', 'SO'],
                color: '#1f3d7a',
                initial: 'BM'
            }
        ]
    },
    food: {
        label: { en: 'Food', es: 'Comida' },
        color: '#2d8a4a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
        orgs: [
            {
                name: 'East Boston Social Centers',
                address: '68 Central Square, East Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=68+Central+Square+East+Boston+MA',
                phone: '(617) 569-3221',
                tel: 'tel:6175693221',
                langs: ['EN', 'ES'],
                color: '#2d8a4a',
                initial: 'ES'
            },
            {
                name: 'Greater Boston Food Bank',
                address: '70 S Bay Ave, Boston, MA 02118',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=70+S+Bay+Ave+Boston+MA',
                phone: '(617) 427-5200',
                tel: 'tel:6174275200',
                langs: ['EN', 'ES'],
                color: '#e88a2a',
                initial: 'GF'
            }
        ]
    },
    esol: {
        label: { en: 'English Class', es: 'Inglés' },
        color: '#7b4ec7',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        orgs: [
            {
                name: 'East Boston Harborside Community School',
                address: '312 Border St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=312+Border+St+East+Boston+MA',
                phone: '(617) 635-5114',
                tel: 'tel:6176355114',
                langs: ['EN', 'ES', 'PT'],
                color: '#7b4ec7',
                initial: 'EB'
            },
            {
                name: 'Centro Presente',
                address: '54 Essex St, Cambridge, MA 02139',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=54+Essex+St+Cambridge+MA',
                phone: '(617) 629-4729',
                tel: 'tel:6176294729',
                langs: ['EN', 'ES'],
                color: '#e88a2a',
                initial: 'CP'
            }
        ]
    },
    college: {
        label: { en: 'College & GED', es: 'Universidad' },
        color: '#0a1d3a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
        orgs: [
            {
                name: 'Bunker Hill Community College',
                address: '250 New Rutherford Ave, Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=250+New+Rutherford+Ave+Boston+MA',
                phone: '(617) 228-2000',
                tel: 'tel:6172282000',
                langs: ['EN', 'ES'],
                color: '#0a1d3a',
                initial: 'BH'
            }
        ]
    },
    money: {
        label: { en: 'Money Help', es: 'Dinero' },
        color: '#1aa37a',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        orgs: [
            {
                name: 'Compass Working Capital',
                address: '77 Sumner St, East Boston, MA 02128',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=77+Sumner+St+East+Boston+MA',
                phone: '(617) 561-1090',
                tel: 'tel:6175611090',
                langs: ['EN', 'ES'],
                color: '#1aa37a',
                initial: 'CW'
            },
            {
                name: 'ABCD Financial Assistance',
                address: '178 Tremont St, Boston, MA 02111',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=178+Tremont+St+Boston+MA',
                phone: '(617) 348-6000',
                tel: 'tel:6173486000',
                langs: ['EN', 'ES', 'HT', 'VI'],
                color: '#1f3d7a',
                initial: 'AB'
            }
        ]
    },
    childcare: {
        label: { en: 'Childcare', es: 'Cuidado infantil' },
        color: '#c08a3e',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="19" cy="11" r="2"/><path d="M23 21v-1a2 2 0 0 0-2-2h-2"/></svg>',
        orgs: [
            {
                name: 'East Boston Social Centers – Child Care',
                address: '68 Central Square, East Boston',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=68+Central+Square+East+Boston+MA',
                phone: '(617) 569-3221',
                tel: 'tel:6175693221',
                langs: ['EN', 'ES'],
                color: '#c08a3e',
                initial: 'ES'
            }
        ]
    },
    'legal-aid': {
        label: { en: 'Legal Help', es: 'Ayuda legal' },
        color: '#7c3aed',
        iconSvg: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M6 6h12"/><path d="m6 6-3 6h6L6 6Z"/><path d="m18 6-3 6h6l-3-6Z"/><path d="M8 21h8"/></svg>',
        orgs: [
            {
                name: 'Greater Boston Legal Services',
                address: '197 Friend St, Boston, MA 02114',
                mapUrl: 'https://www.google.com/maps/search/?api=1&query=197+Friend+St+Boston+MA',
                phone: '(617) 371-1234',
                tel: 'tel:6173711234',
                langs: ['EN', 'ES'],
                color: '#7c3aed',
                initial: 'GB'
            }
        ]
    }
};

function buildOrgCard(org) {
    var langs = org.langs.map(function (l) {
        return '<span class="cat-org-lang-tag">' + l + '</span>';
    }).join('');
    return '<div class="cat-org-card">' +
        '<div class="cat-org-top">' +
            '<div class="cat-org-logo" style="background:' + org.color + '">' + org.initial + '</div>' +
            '<div class="cat-org-info">' +
                '<p class="cat-org-name">' + org.name + '</p>' +
                '<p class="cat-org-address">' +
                    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>' +
                    org.address +
                '</p>' +
            '</div>' +
        '</div>' +
        '<p class="cat-org-phone">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1aa37a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>' +
            org.phone +
        '</p>' +
        '<div class="cat-org-langs">' + langs + '</div>' +
        '<div class="cat-org-actions">' +
            '<a href="' + org.tel + '" class="cat-org-btn cat-org-btn--call">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>' +
                '<span class="en-text">Call</span><span class="es-text">Llamar</span>' +
            '</a>' +
            '<a href="' + org.mapUrl + '" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--directions">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>' +
                '<span class="en-text">Directions</span><span class="es-text">Cómo llegar</span>' +
            '</a>' +
        '</div>' +
    '</div>';
}

function openCategoryDetail(catKey) {
    var data = CAT_DATA[catKey];
    if (!data) return;
    var sheet = document.getElementById('catDetailSheet');
    var titleEl = document.getElementById('catDetailTitle');
    var iconEl = document.getElementById('catDetailIcon');
    var listEl = document.getElementById('catOrgList');
    if (!sheet) return;

    // Set title + icon
    if (titleEl) {
        titleEl.innerHTML =
            '<span class="en-text">' + data.label.en + '</span>' +
            '<span class="es-text">' + data.label.es + '</span>';
    }
    if (iconEl) {
        iconEl.style.background = data.color;
        iconEl.innerHTML = data.iconSvg;
    }

    // Build org list
    if (listEl) {
        listEl.innerHTML = (data.orgs || []).map(buildOrgCard).join('');
    }

    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    sheet.scrollTop = 0;
    var scroll = sheet.querySelector('.cat-detail-scroll');
    if (scroll) scroll.scrollTop = 0;
}

function closeCategoryDetail() {
    var sheet = document.getElementById('catDetailSheet');
    if (sheet) {
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
    }
}

// Back button
var catDetailBack = document.getElementById('catDetailBack');
if (catDetailBack) catDetailBack.addEventListener('click', closeCategoryDetail);

// ── Story bubble → resource category detail ────────────────────
document.querySelectorAll('.story-bubble[data-app-view-cat]').forEach(function (bubble) {
    bubble.addEventListener('click', function () {
        var cat = this.getAttribute('data-app-view-cat');
        if (window.bulletinBoard && typeof window.bulletinBoard.openResourceShortcut === 'function') {
            window.bulletinBoard.openResourceShortcut(cat);
            return;
        }
        if (window.bulletinBoard && typeof window.bulletinBoard.setFeedCategory === 'function') {
            window.bulletinBoard.setFeedCategory(cat);
            return;
        }
        openCategoryDetail(cat);
    });
});

// ── Desktop aside resource chips → category detail modal ──────
document.querySelectorAll('.side-resource-chip[data-resource-cat]').forEach(function (chip) {
    chip.addEventListener('click', function () {
        var cat = this.getAttribute('data-resource-cat');
        if (window.bulletinBoard && typeof window.bulletinBoard.openResourceShortcut === 'function') {
            window.bulletinBoard.openResourceShortcut(cat);
        } else {
            openCategoryDetail(cat);
        }
    });
});
