import {
    getActionResourceChipLabel,
    parseResourceServiceChips,
    translateResourceChipEs,
} from './resource-chip-labels.js';
import { formatResourceHoursHtml } from './resource-hours.js';

(function() {
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.pageYOffset > 50) {
                header.classList.add('collapsed');
            } else {
                header.classList.remove('collapsed');
            }
        }, { passive: true });
    }
})();

// ── Sidebar user menu ────────────────────────────────────────────
window.apToggleUserMenu = function() {
    var menu = document.getElementById('apUserMenu');
    var chevron = document.getElementById('apUserMenuChevron');
    var open = menu.style.display === 'none' || menu.style.display === '';
    menu.style.display = open ? 'block' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
};

document.addEventListener('click', function(e) {
    var card = document.getElementById('apAdvisorCard');
    var menu = document.getElementById('apUserMenu');
    if (!card || !menu) return;
    if (!card.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
        var chevron = document.getElementById('apUserMenuChevron');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
});

document.addEventListener('DOMContentLoaded', function() {
    var sidebarLogout = document.getElementById('sidebarLogoutBtn');
    var mainLogout = document.getElementById('logoutBtn');
    if (sidebarLogout && mainLogout) {
        sidebarLogout.addEventListener('click', function() { mainLogout.click(); });
    }
});

(function() {
    // ── Page navigation ──────────────────────────────────────────
    var PAGES = {
        dashboard: { el: 'apPageDashboard', nav: 'apNavDashboard',  title: 'Dashboard' },
        create:    { el: 'apPageCreate',    nav: 'apNavCreate',     title: 'Create Post' },
        posts:     { el: 'apPagePosts',     nav: 'apNavBulletins',  title: 'All Posts' },
        bulletins: { el: 'apPagePosts',     nav: 'apNavBulletins',  title: 'My Bulletins' },
        resources: { el: 'apPagePosts',     nav: 'apNavResources',  title: 'My Resources' },
        events:    { el: 'apPagePosts',     nav: 'apNavEvents',     title: 'My Events' },
        stats:     { el: 'apPageStats',     nav: 'apNavStats',      title: 'Stats' },
        advisors:  { el: 'apPageAdvisors',  nav: 'apNavAdvisors',   title: 'Advisors' },
    };

    var POSTS_PAGE_FILTERS = {
        posts:     { contentType: 'all',      sort: 'newest' },
        bulletins: { contentType: 'bulletin', sort: 'newest' },
        resources: { contentType: 'resource', sort: 'category' },
        events:    { contentType: 'event',    sort: 'newest' },
    };

    function syncManageStatusFilters(contentType) {
        var showStatus = contentType !== 'resource';
        var pills = document.getElementById('manageStatusPills');
        var statusSelect = document.getElementById('manageFilterSelect');
        if (pills) pills.hidden = !showStatus;
        if (statusSelect) statusSelect.hidden = !showStatus;
        if (!showStatus) {
            document.querySelectorAll('#manageStatusPills .ap-filter-pill').forEach(function(pill, index) {
                pill.classList.toggle('active', index === 0);
            });
            if (statusSelect && statusSelect.value !== 'all') {
                statusSelect.value = 'all';
                statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    window.apShowPage = function(page) {
        // Several nav entries (bulletins/resources/events) share the same
        // page element (apPagePosts), and posts/bulletins share the same
        // nav button. Deduplicate so a later iteration doesn't toggle off
        // an element a previous one just turned on.
        var targetEl  = PAGES[page] && PAGES[page].el;
        var targetNav = PAGES[page] && PAGES[page].nav;
        var seenEls = {}, seenNavs = {};
        Object.keys(PAGES).forEach(function(k) {
            var p = PAGES[k];
            if (p.el && !seenEls[p.el]) {
                seenEls[p.el] = true;
                var el = document.getElementById(p.el);
                if (el) el.classList.toggle('active', p.el === targetEl);
            }
            if (p.nav && !seenNavs[p.nav]) {
                seenNavs[p.nav] = true;
                var nav = document.getElementById(p.nav);
                if (nav) nav.classList.toggle('active', p.nav === targetNav);
            }
        });
        var titleEl = document.getElementById('apTopbarTitle');
        if (titleEl && PAGES[page]) titleEl.textContent = PAGES[page].title;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Advisor list is filled by adminPanel.loadAdvisors(); legacy tab switch called that,
        // but rail navigation only uses apShowPage — refresh list when opening this page.
        if (page === 'advisors' && window.adminPanel) {
            var ap = window.adminPanel;
            if (typeof ap.loadAdvisorsFromFirestore === 'function') {
                ap.loadAdvisorsFromFirestore().then(function() { ap.loadAdvisors(); }).catch(function() { ap.loadAdvisors(); });
            } else {
                ap.loadAdvisors();
            }
        }
        if (page === 'create' && window.adminPanel) {
            var ap = window.adminPanel;
            if (typeof ap.renumberVisibleFormSteps === 'function') {
                ap.renumberVisibleFormSteps();
            }
        }
        if (POSTS_PAGE_FILTERS[page]) {
            var preset = POSTS_PAGE_FILTERS[page];
            var setFilter = function(id, value) {
                var el = document.getElementById(id);
                if (!el || el.value === value) return;
                el.value = value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            setFilter('manageContentTypeSelect', preset.contentType);
            setFilter('manageFilterSelect', 'all');
            setFilter('manageSortSelect', preset.sort);
            syncManageStatusFilters(preset.contentType);

            var heading = document.querySelector('#apPagePosts h1');
            if (heading) heading.textContent = PAGES[page].title;
            var subhead = document.querySelector('#apPagePosts h1 + p');
            if (subhead) {
                var subtitleByPage = {
                    bulletins: 'Announcements, jobs, and other bulletins you have published.',
                    resources: 'Help links shown in the resources view, grouped by category.',
                    events:    'Calendar events you have published.',
                    posts:     'All content you have published.',
                };
                subhead.textContent = subtitleByPage[page] || subtitleByPage.posts;
            }
        }
    };

    // ── Type selector ─────────────────────────────────────────────
    var typeMap = {
        bulletin: { cls: 'selected-bulletin', chipCls: 'ap-chip-bulletin', chipText: 'BULLETIN', contentType: 'post' },
        resource: { cls: 'selected-resource', chipCls: 'ap-chip-resource', chipText: 'RESOURCE', contentType: 'resource' },
        event:    { cls: 'selected-event',    chipCls: 'ap-chip-event',    chipText: 'EVENT',    contentType: 'event' },
    };

    window.apSelectType = function(type) {
        var map = typeMap[type];
        if (!map) return;
        // Update type cards
        ['bulletin','resource','event'].forEach(function(t) {
            var card = document.getElementById('apType' + t.charAt(0).toUpperCase() + t.slice(1));
            if (!card) return;
            card.classList.remove('selected','selected-bulletin','selected-resource','selected-event');
            card.setAttribute('aria-pressed', t === type ? 'true' : 'false');
            if (t === type) card.classList.add('selected', map.cls);
        });
        // Update live preview chip
        var chip = document.getElementById('previewChip');
        if (chip) {
            chip.className = 'ap-preview-type-chip ' + map.chipCls;
            chip.textContent = map.chipText;
        }
        // Sync existing content-type-btn for JS compat
        var btns = document.querySelectorAll('.content-type-btn');
        btns.forEach(function(btn) {
            var ct = btn.getAttribute('data-content-type');
            var match = (ct === map.contentType) || (type === 'bulletin' && ct === 'post');
            btn.classList.toggle('active', match);
            if (match) btn.click();
        });
        syncPreview();
    };

    // ── Live preview sync ─────────────────────────────────────────
    function escPreview(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function formatPreviewDescription(raw) {
        if (typeof window.formatRichTextPreview === 'function') {
            return window.formatRichTextPreview(raw, 110) || 'Your description will show here.';
        }
        if (!raw) return 'Your description will show here.';
        var txt = raw.length > 110 ? raw.slice(0, 108) + '…' : raw;
        return escPreview(txt)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>');
    }

    function formatPreviewYmd(ymd) {
        if (!ymd || typeof ymd !== 'string') return '';
        var m = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return ymd;
        var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (isNaN(d.getTime())) return ymd;
        return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatPreviewTimeRange(start, end) {
        function fmt(t) {
            if (!t || typeof t !== 'string') return '';
            var p = t.trim().split(':');
            if (p.length < 2) return t;
            var h = parseInt(p[0], 10), mm = p[1];
            if (isNaN(h)) return t;
            var am = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12 || 12;
            return h12 + ':' + mm + ' ' + am;
        }
        var fs = fmt(start), fe = fmt(end);
        if (fs && fe) return fs + ' – ' + fe;
        return fs || fe || '';
    }

    function eventFormatLabel(v) {
        var map = { 'in-person': 'In person', 'online': 'Online', 'hybrid': 'Hybrid' };
        return map[v] || '';
    }

    function getPreviewMode() {
        var form = document.getElementById('bulletinForm');
        var mode = form && form.dataset.contentMode;
        if (mode === 'event') return 'event';
        var hidden = document.getElementById('contentType');
        return hidden && hidden.value === 'resource' ? 'resource' : 'post';
    }

    function setPreviewNav(active) {
        document.querySelectorAll('[data-preview-nav]').forEach(function(item) {
            item.classList.toggle('active', item.getAttribute('data-preview-nav') === active);
        });
    }

    var PREVIEW_CAT_META = {
        job:          { accent: '#1e40af', tint: '#dbeafe', grad: 'linear-gradient(145deg,#bfdbfe,#dbeafe)', label: 'JOBS',        emoji: '💼' },
        training:     { accent: '#7b4ec7', tint: '#ede9fe', grad: 'linear-gradient(145deg,#ddd6fe,#ede9fe)', label: 'TRAINING',    emoji: '📚' },
        college:      { accent: '#4338ca', tint: '#e0e7ff', grad: 'linear-gradient(145deg,#c7d2fe,#e0e7ff)', label: 'COLLEGE',     emoji: '🎓' },
        immigration:  { accent: '#0d8a7a', tint: '#ccfbf1', grad: 'linear-gradient(145deg,#99f6e4,#ccfbf1)', label: 'IMMIGRATION', emoji: '🌍' },
        housing:      { accent: '#b91c1c', tint: '#fee2e2', grad: 'linear-gradient(145deg,#fca5a5,#fecaca)', label: 'HOUSING',     emoji: '🏠' },
        health:       { accent: '#be185d', tint: '#fce7f3', grad: 'linear-gradient(145deg,#f9a8d4,#fce7f3)', label: 'HEALTH',      emoji: '❤️' },
        food:         { accent: '#166534', tint: '#dcfce7', grad: 'linear-gradient(145deg,#86efac,#dcfce7)', label: 'FOOD',        emoji: '🍎' },
        childcare:    { accent: '#92400e', tint: '#fef3c7', grad: 'linear-gradient(145deg,#fde68a,#fef3c7)', label: 'FAMILY',      emoji: '👨‍👩‍👧' },
        esol:         { accent: '#6d28d9', tint: '#ede9fe', grad: 'linear-gradient(145deg,#c4b5fd,#ede9fe)', label: 'ESOL',        emoji: '🗣️' },
        'career-fair':{ accent: '#b45309', tint: '#ffedd5', grad: 'linear-gradient(145deg,#fed7aa,#ffedd5)', label: 'CAREER FAIR', emoji: '🤝' },
        money:        { accent: '#065f46', tint: '#d1fae5', grad: 'linear-gradient(145deg,#6ee7b7,#d1fae5)', label: 'MONEY HELP',  emoji: '💰' },
        announcement: { accent: '#0284c7', tint: '#e0f2fe', grad: 'linear-gradient(145deg,#bae6fd,#e0f2fe)', label: 'ANNOUNCEMENT',emoji: '📢' }
    };

    function getPreviewCardIconSvg(category) {
        var icons = {
            job: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
            immigration: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
            housing: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            health: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>',
            food: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
            esol: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            training: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
            college: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
            'career-fair': '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            money: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
            childcare: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            family: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
            'legal-aid': '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l-3 7H3l5.5 4-2 7L12 17l5.5 3-2-7L21 9h-6z"/></svg>',
            announcement: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
        };
        return icons[category] || icons.announcement;
    }

    function buildBulletinPreviewShell(category, title, desc, advisor, imgSrc) {
        var m = PREVIEW_CAT_META[category] || { accent: '#475569', tint: '#f1f5f9', grad: 'linear-gradient(145deg,#e2e8f0,#f1f5f9)', label: 'BULLETIN', emoji: '📌' };
        var chipHtml = '<span class="ap-preview-pc-chip" id="previewChip" style="background:' + m.tint + ';color:' + m.accent + '">' +
            '<span class="ap-preview-pc-chip-emoji">' + m.emoji + '</span> ' + m.label + '</span>';
        var topHtml;
        var topClass = 'ap-preview-pc-top';
        if (imgSrc) {
            topClass += ' ap-preview-pc-top--image';
            topHtml = '<div class="ap-preview-pc-image-stage">' +
                '<img class="ap-preview-pc-poster-image" src="' + imgSrc + '" alt="Flyer">' +
                '</div>';
        } else if (category) {
            topHtml = '<div class="ap-preview-pc-top-placeholder" style="background:' + m.grad + ';width:100%;height:100%">' +
                '<div class="ap-preview-pc-icon-wrap">' +
                    '<div class="ap-preview-pc-icon-box" style="background:' + m.accent + '">' +
                        getPreviewCardIconSvg(category) +
                    '</div>' +
                '</div>' +
                '<div class="ap-preview-pc-title-overlay">' + escPreview(title || '') + ' —</div>' +
                '</div>';
        } else {
            topHtml = '<div class="ap-preview-pc-top-placeholder" style="background:linear-gradient(145deg,#e2e8f0,#f1f5f9);width:100%;height:100%">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="width:28px;height:28px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
                '<span style="font-size:.58rem;font-weight:600;color:#94a3b8;font-family:var(--ap-font-head);letter-spacing:.04em">IMAGE / FLYER</span>' +
                '</div>';
        }
        return '<div class="ap-preview-pc">' +
            '<div class="ap-preview-pc-chipbar" id="previewChipBar" style="background:#fff">' + chipHtml + '</div>' +
            '<div class="' + topClass + '" id="previewImg">' + topHtml + '</div>' +
            '<div class="ap-preview-pc-body">' +
                '<div class="ap-preview-pc-title" id="previewTitle">' + escPreview(title || 'Your post title will appear here') + '</div>' +
                '<div class="ap-preview-pc-desc" id="previewBody">' + formatPreviewDescription(desc) + '</div>' +
            '</div>' +
            '<div class="ap-preview-pc-footer">' +
                '<span class="ap-preview-pc-author" id="previewAdvisor">' + escPreview(advisor || 'Advisor') + ' · Just now</span>' +
                '<span class="ap-preview-pc-open" style="color:' + m.accent + '">Open →</span>' +
            '</div>' +
        '</div>';
    }

    function renderPostPreviewShell() {
        var cardWrap = document.querySelector('.ap-preview-card');
        if (!cardWrap || document.getElementById('previewTitle')) return;
        cardWrap.innerHTML = buildBulletinPreviewShell('', '', '', '', '');
    }

    var PREVIEW_RESOURCE_COLORS = {
        immigration: '#0d9488',
        jobs: '#24498f',
        housing: '#df6b4a',
        health: '#df477f',
        food: '#2f934f',
        family: '#c99035',
        esol: '#8050d1',
        hse: '#2563eb',
        college: '#0a1d3a',
        'legal-aid': '#7c3aed',
        money: '#1fa77e'
    };

    function previewResourceIcon(category) {
        var key = category === 'jobs' ? 'job' : (category === 'family' ? 'childcare' : category);
        return getPreviewCardIconSvg(key);
    }

    function plainPreviewSummary(raw) {
        if (!raw) return '';
        return String(raw).replace(/\s+/g, ' ').trim();
    }

    function buildResourcePreviewCard(data) {
        var category = data.category || '';
        var accent = PREVIEW_RESOURCE_COLORS[category] || '#0a1d3a';
        var title = data.title || 'Resource title';
        var titleEs = data.titleEs || '';
        var descEn = plainPreviewSummary(data.desc);
        var descEs = plainPreviewSummary(data.summaryEs || data.desc);
        var logoSrc = data.logoSrc || '';
        var iconSvg = previewResourceIcon(category);

        var logoTile = logoSrc
            ? '<img src="' + escPreview(logoSrc) + '" alt="">'
            : '<span class="mobile-resource-card__icon-fallback" style="background:' + accent + '" aria-hidden="true">' + iconSvg + '</span>';

        var headingHtml =
            '<div class="mobile-resource-card__heading">' +
                '<div class="mobile-resource-card__title-row">' +
                    '<h3 class="mobile-resource-card__title">' + escPreview(title) + '</h3>' +
                '</div>' +
                (titleEs && titleEs !== title
                    ? '<p class="mobile-resource-card__subtitle">' + escPreview(titleEs) + '</p>'
                    : '') +
            '</div>';

        var summaryHtml = (descEn || descEs)
            ? '<p class="mobile-resource-card__summary">' +
                '<span class="en-text">' + escPreview(descEn || descEs) + '</span>' +
                '<span class="es-text">' + escPreview(descEs || descEn) + '</span>' +
              '</p>'
            : '<p class="mobile-resource-card__summary mobile-resource-card__summary--placeholder">' +
                '<span class="en-text">Card summary appears here</span>' +
              '</p>';

        var displayHighlights = [];
        var seenHighlightLabels = new Set();
        (data.highlights || []).forEach(function(service) {
            if (displayHighlights.length >= 5) return;
            var actionLabel = getActionResourceChipLabel(service);
            var key = actionLabel.toLowerCase();
            if (!actionLabel || seenHighlightLabels.has(key)) return;
            seenHighlightLabels.add(key);
            displayHighlights.push({ label: actionLabel, source: service });
        });

        var chipsHtml = displayHighlights.length
            ? '<div class="resource-service-section">' +
                '<div class="resource-service-chips">' + displayHighlights.map(function(service) {
                return '<span class="resource-service-chip">' +
                    '<span class="en-text">' + escPreview(service.label) + '</span>' +
                    '<span class="es-text">' + escPreview(translateResourceChipEs(service.source)) + '</span>' +
                '</span>';
            }).join('') + '</div></div>'
            : '';

        var hoursHtml = data.hours
            ? formatResourceHoursHtml(data.hours, escPreview)
            : '';

        var isDesktopPreview = window.matchMedia('(min-width: 768px)').matches;
        var hasDirections = Boolean((data.address || '').trim());
        var addressHtml = data.address && !(isDesktopPreview && hasDirections)
            ? '<p class="mobile-resource-card__address">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>' +
                escPreview(data.address) +
              '</p>'
            : '';

        var callBtn = data.phone
            ? '<span class="mobile-resource-card__btn mobile-resource-card__btn--primary" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>' +
                '<span class="en-text">Call</span><span class="es-text">Llamar</span>' +
              '</span>'
            : '';

        var websiteBtn = data.url
            ? '<span class="mobile-resource-card__btn mobile-resource-card__btn--secondary" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>' +
                '<span class="en-text">Website</span><span class="es-text">Sitio</span>' +
              '</span>'
            : '';

        var directionsBtn = data.address
            ? '<span class="mobile-resource-card__btn mobile-resource-card__btn--secondary mobile-resource-card__btn--directions" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>' +
                '<span class="en-text">Directions</span><span class="es-text">Cómo llegar</span>' +
              '</span>'
            : '';

        var actionButtons = [callBtn, websiteBtn, directionsBtn].filter(Boolean);
        var actionsModifier = actionButtons.length === 1
            ? ' mobile-resource-card__actions--single'
            : actionButtons.length >= 3
                ? ' mobile-resource-card__actions--triple'
                : '';
        var actionsHtml = actionButtons.length
            ? '<div class="mobile-resource-card__actions' + actionsModifier + '">' + actionButtons.join('') + '</div>'
            : '';

        return '' +
            '<article class="mobile-resource-card mobile-resource-card--' + escPreview(category || 'resource') + ' ap-preview-resource-mock" style="--cat-accent:' + accent + '">' +
                '<button type="button" class="mobile-resource-card__share" tabindex="-1" aria-hidden="true">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>' +
                '</button>' +
                '<div class="mobile-resource-card__logo-tile">' + logoTile + '</div>' +
                '<div class="mobile-resource-card__body">' +
                    headingHtml +
                    summaryHtml +
                    chipsHtml +
                    addressHtml +
                    hoursHtml +
                    actionsHtml +
                '</div>' +
            '</article>';
    }

    function syncPreview() {
        var mode = getPreviewMode();

        if (mode === 'resource') {
            var cardWrap = document.querySelector('.ap-preview-card');
            if (!cardWrap) return;

            var title = (document.getElementById('resourceTitleEn')?.value || '').trim();
            var titleEs = (document.getElementById('resourceTitleEs')?.value || '').trim();
            var category = document.getElementById('resourceCategory')?.value || '';
            var desc = (document.getElementById('resourceDescription')?.value || '').trim();
            var summaryEs = (document.getElementById('resourceSummaryEs')?.value || '').trim();
            var highlights = parseResourceServiceChips(document.getElementById('resourceHighlights')?.value || '');
            var logoImg = document.querySelector('#resourceLogoPreview .preview-image');
            var logoSrc = logoImg && logoImg.getAttribute('src') ? logoImg.getAttribute('src') : '';
            var url = (document.getElementById('resourceUrl')?.value || '').trim();
            var phone = (document.getElementById('resourcePhone')?.value || '').trim();
            var address = (document.getElementById('resourceAddress')?.value || '').trim();
            var hours = (document.getElementById('resourceHours')?.value || '').trim();

            cardWrap.innerHTML = buildResourcePreviewCard({
                title: title,
                titleEs: titleEs,
                category: category,
                desc: desc,
                summaryEs: summaryEs,
                highlights: highlights,
                logoSrc: logoSrc,
                url: url,
                phone: phone,
                address: address,
                hours: hours
            });
            setPreviewNav('resources');
            return;
        }

        if (mode === 'event') {
            var cardWrapEv = document.querySelector('.ap-preview-card');
            if (!cardWrapEv) return;

            var titleEv = (document.getElementById('title')?.value || '').trim();
            var descEv = (document.getElementById('description')?.value || '').trim();
            var advisorEv = document.getElementById('advisorName')?.value || 'Advisor';
            var dateTypeEv = document.getElementById('dateType')?.value || '';
            var eventDateVal = document.getElementById('eventDate')?.value || '';
            var startDateVal = document.getElementById('startDate')?.value || '';
            var endDateVal = document.getElementById('endDate')?.value || '';
            var startT = document.getElementById('startTime')?.value || '';
            var endT = document.getElementById('endTime')?.value || '';
            var fmtSel = document.getElementById('eventLocation')?.value || '';
            var addr = (document.getElementById('location')?.value || '').trim();
            var evLink = (document.getElementById('eventLink')?.value || '').trim();

            var whenLine = '';
            if (dateTypeEv === 'range') {
                if (startDateVal || endDateVal) {
                    whenLine = formatPreviewYmd(startDateVal || eventDateVal) + ' – ' + formatPreviewYmd(endDateVal || startDateVal);
                } else {
                    whenLine = 'Add start and end dates';
                }
            } else if (dateTypeEv === 'deadline' && eventDateVal) {
                whenLine = 'Deadline: ' + formatPreviewYmd(eventDateVal);
            } else if (dateTypeEv === 'sessions') {
                var sameTimeEv = document.getElementById('sessionSameTimeToggle')?.checked;
                var sharedStartEv = document.getElementById('sessionSharedStartTime')?.value || '';
                var sharedEndEv = document.getElementById('sessionSharedEndTime')?.value || '';
                var sessionRows = document.querySelectorAll('#eventDatesList .event-session-row');
                var sessionParts = Array.from(sessionRows).map(function(row) {
                    var dateVal = row.querySelector('.event-session-date')?.value || '';
                    if (!dateVal) return '';
                    var startVal = sameTimeEv ? sharedStartEv : (row.querySelector('.event-session-start')?.value || '');
                    var endVal = sameTimeEv ? sharedEndEv : (row.querySelector('.event-session-end')?.value || '');
                    var line = formatPreviewYmd(dateVal);
                    var timePart = formatPreviewTimeRange(startVal, endVal);
                    return timePart ? line + ' · ' + timePart : line;
                }).filter(Boolean);
                if (sessionParts.length >= 2) {
                    whenLine = sessionParts.join(' · ');
                } else if (sessionParts.length === 1) {
                    whenLine = sessionParts[0] + ' — add another session';
                } else {
                    whenLine = 'Add at least two session dates';
                }
            } else if (eventDateVal) {
                whenLine = formatPreviewYmd(eventDateVal);
            } else if (dateTypeEv) {
                whenLine = 'Pick a date for this event';
            } else {
                whenLine = 'Choose a date type in Event Details';
            }

            var timeStr = dateTypeEv === 'sessions' ? '' : formatPreviewTimeRange(startT, endT);
            var metaParts = [];
            var fl = eventFormatLabel(fmtSel);
            if (fl) metaParts.push(fl);
            if (addr) metaParts.push(addr);
            var metaHtml = metaParts.length
                ? '<div class="ap-preview-event-meta">' + metaParts.map(function(p) { return '<span class="ap-preview-event-meta-pill">' + escPreview(p) + '</span>'; }).join('') + '</div>'
                : '';

            var descHtml = descEv
                ? '<div class="ap-preview-event-desc">' + formatPreviewDescription(descEv.length > 240 ? descEv.slice(0, 240) + '…' : descEv) + '</div>'
                : '<div class="ap-preview-event-desc ap-preview-event-desc-muted">Optional details for students</div>';

            var linkRowEv = evLink
                ? '<div class="ap-preview-event-url"><span class="ap-preview-url-label">Link</span> ' + escPreview(evLink) + '</div>'
                : '';

            // Get category for event preview styling
            var catEv = document.getElementById('category')?.value || '';
            var m = PREVIEW_CAT_META[catEv] || { accent: '#6d28d9', tint: '#ede9fe', grad: 'linear-gradient(145deg,#c4b5fd,#ede9fe)', label: 'EVENT', emoji: '📅' };

            cardWrapEv.innerHTML =
                '<div class="ap-preview-event-card" style="--event-accent:' + m.accent + '; --event-tint:' + m.tint + '; --event-grad:' + m.grad + '">' +
                    '<div class="ap-preview-post-meta">' +
                        '<span class="ap-preview-type-chip" id="previewChip" style="background:' + m.tint + ';color:' + m.accent + '">' +
                            '<span class="ap-preview-pc-chip-emoji">' + m.emoji + '</span> ' + m.label +
                        '</span>' +
                        '<span class="ap-preview-post-time">Calendar</span>' +
                    '</div>' +
                    '<div class="ap-preview-event-title">' + escPreview(titleEv || 'Event title will appear here') + '</div>' +
                    '<div class="ap-preview-event-when">' +
                        '<span class="ap-preview-event-when-icon" aria-hidden="true">' +
                            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                        '</span>' +
                        '<span class="ap-preview-event-when-text">' + escPreview(whenLine) + '</span>' +
                    '</div>' +
                    (timeStr ? '<div class="ap-preview-event-time"><span class="ap-preview-event-time-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>' + escPreview(timeStr) + '</div>' : '') +
                    metaHtml +
                    descHtml +
                    '<div class="ap-preview-post-img ap-preview-event-img ap-preview-pc-top" id="previewImg" style="background:#f8fafc;position:relative;overflow:hidden;aspect-ratio:16/9;display:grid;place-items:center;">' +
                        '<div class="ap-preview-post-img-placeholder">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:28px;height:28px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
                            '<span>Optional flyer</span>' +
                        '</div>' +
                    '</div>' +
                    linkRowEv +
                    '<div class="ap-preview-post-footer">' +
                        '<span class="ap-preview-author"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span id="previewAdvisor">' + escPreview(advisorEv) + '</span></span>' +
                        '<span class="ap-preview-audience" style="color:' + m.accent + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Events</span>' +
                    '</div>' +
                '</div>';

            var imgInEv = document.getElementById('image');
            if (imgInEv && imgInEv.files && imgInEv.files[0]) {
                var readerEv = new FileReader();
                readerEv.onload = function(e) {
                    var prevImgEv = document.getElementById('previewImg');
                    if (prevImgEv) {
                        prevImgEv.classList.add('ap-preview-pc-top--image');
                        prevImgEv.innerHTML = '<div class="ap-preview-pc-image-stage"><img class="ap-preview-pc-poster-image" src="' + e.target.result + '" alt="Flyer"></div>';
                    }
                };
                readerEv.readAsDataURL(imgInEv.files[0]);
            }
            setPreviewNav('calendar');
            return;
        }

        setPreviewNav('home');

        var titleInput  = document.getElementById('title');
        var descInput   = document.getElementById('description');
        var advisorSel  = document.getElementById('advisorName');
        var catSel      = document.getElementById('category');
        var imageInput  = document.getElementById('image');

        var titleVal   = (titleInput ? titleInput.value.trim() : '') || '';
        var descVal    = (descInput  ? descInput.value.trim()  : '') || '';
        var advisorVal = (advisorSel ? advisorSel.value        : '') || 'Advisor';
        var catVal     = (catSel     ? catSel.value            : '') || '';

        var cardWrapPost = document.querySelector('.ap-preview-card');
        if (cardWrapPost) {
            cardWrapPost.innerHTML = buildBulletinPreviewShell(catVal, titleVal, descVal, advisorVal, '');
        }

        // Image preview
        if (imageInput && imageInput.files && imageInput.files[0]) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var prevImg = document.getElementById('previewImg');
                if (prevImg) {
                    prevImg.classList.add('ap-preview-pc-top--image');
                    prevImg.innerHTML = '<div class="ap-preview-pc-image-stage"><img class="ap-preview-pc-poster-image" src="' + e.target.result + '" alt="Preview"></div>';
                }
            };
            reader.readAsDataURL(imageInput.files[0]);
        }
    }

    // ── Advisor avatar / name init ────────────────────────────────
    function initAdvisorDisplay() {
        var sel = document.getElementById('advisorName');
        var nameEl = document.getElementById('apAdvisorName');
        var avatarEl = document.getElementById('apAdvisorAvatar');

        function setAdvisorCard(name) {
            if (!name || name === 'Advisor') return;
            if (nameEl) nameEl.textContent = name;
            if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
        }

        // Sync from the welcome message whenever it changes (set on login)
        var welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) {
            var wmObs = new MutationObserver(function() {
                var raw = welcomeEl.textContent || '';
                var name = raw.replace('Welcome, ', '').replace('Hi, ', '').replace('!', '').trim();
                setAdvisorCard(name);
            });
            wmObs.observe(welcomeEl, { childList: true, characterData: true, subtree: true });
        }

        if (!sel) return;
        function update() {
            var name = sel.value || 'Advisor';
            if (nameEl) nameEl.textContent = name;
            if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
        }
        sel.addEventListener('change', update);
        sel.addEventListener('change', syncPreview);
    }

    // ── Bind live preview to title/desc ──────────────────────────
    function bindPreviewListeners() {
        ['title','category','resourceTitleEn','resourceTitleEs','description','summaryEs','resourceDescription','resourceSummaryEs','advisorName','resourceAdvisorName','resourceCategory','resourceUrl','resourceHighlights','resourcePhone','resourceAddress','resourceHours','resourcePublished','dateType','eventDate','startDate','endDate','startTime','endTime','location','eventLink','eventLocation'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', syncPreview);
            el.addEventListener('change', syncPreview);
        });
        var imgEl = document.getElementById('image');
        if (imgEl) imgEl.addEventListener('change', syncPreview);

        var logoPreviewEl = document.getElementById('resourceLogoPreview');
        if (logoPreviewEl && typeof MutationObserver !== 'undefined') {
            new MutationObserver(syncPreview).observe(logoPreviewEl, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });
        }

        var eventDatesList = document.getElementById('eventDatesList');
        if (eventDatesList) {
            eventDatesList.addEventListener('input', syncPreview);
            eventDatesList.addEventListener('change', syncPreview);
        }
        ['sessionSameTimeToggle', 'sessionSharedStartTime', 'sessionSharedEndTime'].forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', syncPreview);
            el.addEventListener('change', syncPreview);
        });
    }

    // ── Filter pills in My Posts ──────────────────────────────────
    document.querySelectorAll('.ap-filter-pills .ap-filter-pill').forEach(function(pill) {
        pill.addEventListener('click', function() {
            document.querySelectorAll('.ap-filter-pills .ap-filter-pill').forEach(function(p) { p.classList.remove('active'); });
            pill.classList.add('active');
            var filterMap = { 'All': 'all', 'Live': 'active', 'Expired': 'expired' };
            var sel = document.getElementById('manageFilterSelect');
            if (sel) {
                var val = filterMap[pill.textContent.trim()];
                if (val) { sel.value = val; sel.dispatchEvent(new Event('change')); }
            }
        });
    });

    // ── Toast helper ──────────────────────────────────────────────
    window.apShowToast = function(msg) {
        var t = document.getElementById('apToast');
        var m = document.getElementById('apToastMsg');
        if (!t) return;
        if (m) m.textContent = msg || 'Done!';
        t.classList.add('show');
        setTimeout(function() { t.classList.remove('show'); }, 3000);
    };

    // ── Hide legacy header/footer in portal ───────────────────────
    function hidePortalChrome() {
        var panel = document.getElementById('adminPanel');
        if (!panel) return;
        var visible = panel.style.display !== 'none' && panel.style.display !== '';
        document.body.classList.toggle('ap-portal-active', visible);
    }

    // ── Bridge: intercept showTab to also route portal pages ─────
    function installShowTabBridge() {
        var orig = window.showTab;
        window.showTab = function(tabName) {
            var map = { post: 'create', manage: 'posts', advisors: 'advisors' };
            if (map[tabName]) apShowPage(map[tabName]);
            if (orig) orig(tabName);
        };
    }

    // ── Stats page: real data rendering ───────────────────────────
    var CAT_COLORS = {
        'job':          { fill: 'ap-bar-fill-blue',   label: 'Job Opp.' },
        'training':     { fill: 'ap-bar-fill-purple', label: 'Training' },
        'college':      { fill: 'ap-bar-fill-amber',  label: 'College' },
        'career-fair':  { fill: 'ap-bar-fill-teal',   label: 'Career Fair' },
        'immigration':  { fill: 'ap-bar-fill-green',  label: 'Immigration' },
        'announcement': { fill: 'ap-bar-fill-teal',   label: 'Announce.' },
        'resource':     { fill: 'ap-bar-fill-coral',  label: 'Resource' },
        'housing':      { fill: 'ap-bar-fill-coral',  label: 'Housing' },
        'health':       { fill: 'ap-bar-fill-coral',  label: 'Health' },
        'food':         { fill: 'ap-bar-fill-green',  label: 'Food' },
        'esol':         { fill: 'ap-bar-fill-purple', label: 'English Class' },
        'money':        { fill: 'ap-bar-fill-green',  label: 'Money Help' },
        'family':       { fill: 'ap-bar-fill-amber',  label: 'Family Help' },
        'childcare':    { fill: 'ap-bar-fill-amber',  label: 'Childcare' },
        'legal-aid':    { fill: 'ap-bar-fill-purple', label: 'Legal Help' }
    };

    function renderBarChart(containerId, rows, maxVal) {
        var el = document.getElementById(containerId);
        if (!el) return;
        if (!rows.length) {
            el.innerHTML = '<p style="font-size:.82rem;color:var(--ap-text-3);">No click data yet.</p>';
            return;
        }
        var max = maxVal || rows[0][1] || 1;
        el.innerHTML = rows.map(function(r) {
            var cat = CAT_COLORS[r[0]] || { fill: 'ap-bar-fill-blue', label: r[0] };
            var pct = Math.round((r[1] / max) * 100);
            return '<div class="ap-bar-row">' +
                '<span class="ap-bar-label">' + cat.label + '</span>' +
                '<div class="ap-bar-track"><div class="ap-bar-fill ' + cat.fill + '" style="width:' + pct + '%"></div></div>' +
                '<span class="ap-bar-val">' + r[1] + '</span>' +
            '</div>';
        }).join('');
    }

    function renderTopPostsTable(rows) {
        var container = document.querySelector('#apPageStats .ap-top-posts');
        if (!container) return;
        // Remove old static rows (keep header)
        var header = container.querySelector('.ap-top-posts-header');
        container.innerHTML = '';
        if (header) container.appendChild(header);

        if (!rows.length) {
            container.insertAdjacentHTML('beforeend', '<p style="padding:16px 22px;font-size:.82rem;color:var(--ap-text-3);">No click data yet.</p>');
            return;
        }
        rows.forEach(function(row, i) {
            var rankStyle = i === 0 ? 'color:var(--ap-gold-accent)' : (i === 1 ? 'color:var(--ap-text-2)' : '');
            container.insertAdjacentHTML('beforeend',
                '<div class="ap-top-post-row">' +
                    '<div class="ap-top-post-rank" style="' + rankStyle + '">' + (i + 1) + '</div>' +
                    '<div class="ap-top-post-meta">' +
                        '<div class="ap-top-post-name">' + escHtml(row.title) + '</div>' +
                        '<div class="ap-top-post-type">' + escHtml(row.type) + (row.age ? ' · ' + row.age : '') + '</div>' +
                    '</div>' +
                    '<div class="ap-top-post-views">' + row.total + ' <small>actions</small></div>' +
                '</div>'
            );
        });
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function timeAgo(date) {
        if (!date) return '';
        var now = Date.now();
        var diff = now - date.getTime();
        var days = Math.floor(diff / 86400000);
        if (days < 1) return 'today';
        if (days === 1) return '1 day ago';
        if (days < 7) return days + ' days ago';
        if (days < 14) return '1 week ago';
        if (days < 30) return Math.floor(days / 7) + ' weeks ago';
        return Math.floor(days / 30) + ' month' + (days >= 60 ? 's' : '') + ' ago';
    }

    function renderStatsPage() {
        var ap = window.adminPanel;
        if (!ap) return;

        var events    = ap.analyticsEvents   || [];
        var byPost    = ap.analyticsByPost    || {};
        var byAction  = ap.analyticsByAction  || {};
        var byCat     = ap.analyticsByEngagedCategory || ap.analyticsByCategory || {};
        var summary   = ap.analyticsSummary || {};
        var bulletins = ap.bulletins          || [];

        var studentEvents = events.filter(function(e) { return e.source === 'student'; });

        // ── Top-line stat cards ──────────────────────────────────
        var posts    = bulletins.filter(function(b) { return b.isActive && !ap.isResourceBulletin(b); });
        var live     = posts.filter(function(b) { return !ap.isBulletinExpiredAdmin(b); });
        var postOpens = summary.postOpens || (byAction['detail_open'] || 0);
        var highIntentClicks = summary.highIntentClicks || ((byAction['link_click'] || 0) + (byAction['pdf_open'] || 0) + (byAction['resource_open'] || 0));
        var knownPostIds = {};
        bulletins.forEach(function(b) { knownPostIds[b.id] = true; });
        var engagedPosts = summary.engagedPosts;
        if (engagedPosts == null) {
            engagedPosts = Object.entries(byPost).filter(function(entry) {
                return knownPostIds[entry[0]] && (entry[1].engagement || 0) > 0;
            }).length;
        }

        setText('statsPublished', live.length);
        setText('statsViews',    postOpens);
        setText('statsClicks',   highIntentClicks);
        setText('statsReach',    engagedPosts);

        // ── Views by Category ────────────────────────────────────
        var catRows = Object.entries(byCat).sort(function(a,b){ return b[1]-a[1]; }).slice(0,6);
        var catMax  = catRows.length ? catRows[0][1] : 1;
        renderBarChart('statsCatChart', catRows, catMax);
        renderBarChart('dashCatChart',  catRows, catMax);

        // ── Top Categories (count of posts) ──────────────────────
        var catPostCount = {};
        bulletins.forEach(function(b) {
            var key = ap.isResourceBulletin(b) ? 'resource' : (b.category || 'uncategorized');
            catPostCount[key] = (catPostCount[key] || 0) + 1;
        });
        var catPostRows = Object.entries(catPostCount).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
        renderBarChart('statsPostCatChart', catPostRows, catPostRows.length ? catPostRows[0][1] : 1);

        // ── Top Performing Posts ─────────────────────────────────
        var topRows = Object.entries(byPost)
            .map(function(entry) {
                var id = entry[0], metrics = entry[1];
                var b = bulletins.find(function(x){ return x.id === id; });
                if (!b) return null;
                var cat = ap.isResourceBulletin(b) ? 'Resource' : ap.getCategoryDisplay(b.category);
                var datePosted = b.datePosted ? (b.datePosted.toDate ? b.datePosted.toDate() : new Date(b.datePosted)) : null;
                return {
                    title: b.title || b.resourceTitleEn || 'Untitled',
                    type: cat,
                    age: timeAgo(datePosted),
                    total: metrics.engagement || 0
                };
            })
            .filter(function(row) { return row && row.total > 0; })
            .sort(function(a,b){ return b.total - a.total; })
            .slice(0, 8);
        renderTopPostsTable(topRows);

        // ── Clicks by Device ─────────────────────────────────────
        var deviceCounts = { mobile: 0, tablet: 0, desktop: 0 };
        studentEvents.forEach(function(e) {
            var d = (e.device || '').toLowerCase();
            if (d === 'mobile') deviceCounts.mobile++;
            else if (d === 'tablet') deviceCounts.tablet++;
            else if (d === 'desktop') deviceCounts.desktop++;
            else deviceCounts.mobile++; // default unknown to mobile
        });
        var devTotal = deviceCounts.mobile + deviceCounts.tablet + deviceCounts.desktop || 1;
        var mobPct  = Math.round(deviceCounts.mobile  / devTotal * 100);
        var tabPct  = Math.round(deviceCounts.tablet  / devTotal * 100);
        var dskPct  = 100 - mobPct - tabPct;
        updateDonut(mobPct, tabPct, dskPct);
        setText('statsDevMobile',  mobPct + '%');
        setText('statsDevTablet',  tabPct + '%');
        setText('statsDevDesktop', dskPct + '%');
    }

    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    function updateDonut(mobPct, tabPct, dskPct) {
        // SVG circles: circumference = 2π×15.9 ≈ 100
        var svg = document.getElementById('statsDonutSvg');
        if (!svg) return;
        var circles = svg.querySelectorAll('circle[data-segment]');
        // segments: mobile, tablet, desktop
        var data = [
            { pct: mobPct,  color: '#1a56db', offset: 25 },
            { pct: tabPct,  color: '#059669', offset: 25 - mobPct },
            { pct: dskPct,  color: '#d97706', offset: 25 - mobPct - tabPct }
        ];
        circles.forEach(function(c, i) {
            var d = data[i];
            if (!d) return;
            c.setAttribute('stroke-dasharray', d.pct + ' ' + (100 - d.pct));
            c.setAttribute('stroke-dashoffset', -d.offset);
        });
    }

    // Hook into adminPanel.updateAdvisorDashboard via polling once it exists
    function installStatsBridge() {
        function tryPatch() {
            var ap = window.adminPanel;
            if (!ap || typeof ap.updateAdvisorDashboard !== 'function') {
                setTimeout(tryPatch, 400);
                return;
            }
            var origUpdate = ap.updateAdvisorDashboard.bind(ap);
            ap.updateAdvisorDashboard = function() {
                origUpdate();
                renderStatsPage();
                renderDashboardRecents();
            };
            // Run once immediately in case data is already loaded
            renderStatsPage();
            renderDashboardRecents();
        }
        tryPatch();
    }

    // ── Dashboard: recent posts list ──────────────────────────────
    function renderDashboardRecents() {
        var ap = window.adminPanel;
        if (!ap) return;
        var bulletins = (ap.bulletins || []).slice().sort(function(a, b) {
            var ad = a.datePosted ? (a.datePosted.toDate ? a.datePosted.toDate() : new Date(a.datePosted)) : new Date(0);
            var bd = b.datePosted ? (b.datePosted.toDate ? b.datePosted.toDate() : new Date(b.datePosted)) : new Date(0);
            return bd - ad;
        }).slice(0, 5);

        ['dashRecentPosts', 'createRecentPosts'].forEach(function(containerId) {
            var el = document.getElementById(containerId);
            if (!el) return;
            if (!bulletins.length) {
                el.innerHTML = '<p style="color:var(--ap-text-3);font-size:.85rem;">No posts yet.</p>';
                return;
            }
            el.innerHTML = bulletins.map(function(b) {
                var title = b.title || b.resourceTitleEn || 'Untitled';
                var isLive = b.isActive && !ap.isBulletinExpiredAdmin(b);
                var isDraft = !b.isActive;
                var badgeCls = isLive ? 'ap-badge-live' : (isDraft ? 'ap-badge-draft' : 'ap-badge-expired');
                var badgeText = isLive ? 'Live' : (isDraft ? 'Draft' : 'Expired');
                var datePosted = b.datePosted ? (b.datePosted.toDate ? b.datePosted.toDate() : new Date(b.datePosted)) : null;
                return '<div class="ap-post-row">' +
                    '<div class="ap-post-thumb">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
                    '</div>' +
                    '<div class="ap-post-meta">' +
                        '<div class="ap-post-title-text">' + escHtml(title) + '</div>' +
                        '<div class="ap-post-sub">' + (datePosted ? timeAgo(datePosted) : '') + '</div>' +
                    '</div>' +
                    '<span class="ap-badge ' + badgeCls + '">' + badgeText + '</span>' +
                '</div>';
            }).join('');
        });

        // Dashboard upcoming events
        var eventsEl = document.getElementById('dashUpcomingEvents');
        if (eventsEl) {
            var upcoming = (ap.bulletins || []).filter(function(b) {
                if (!b.eventDate && !b.startDate) return false;
                var d = new Date(b.eventDate || b.startDate);
                return d >= new Date();
            }).sort(function(a, b) {
                return new Date(a.eventDate || a.startDate) - new Date(b.eventDate || b.startDate);
            }).slice(0, 4);

            if (!upcoming.length) {
                eventsEl.innerHTML = '<p style="color:var(--ap-text-3);font-size:.82rem;">No upcoming events.</p>';
            } else {
                eventsEl.innerHTML = upcoming.map(function(b) {
                    var d = new Date(b.eventDate || b.startDate);
                    var month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
                    var day = d.getDate();
                    var title = b.title || 'Untitled event';
                    var time = b.startTime ? b.startTime : '';
                    return '<div class="ap-event-row">' +
                        '<div class="ap-event-date-block">' +
                            '<div class="ap-event-month">' + month + '</div>' +
                            '<div class="ap-event-day">' + day + '</div>' +
                        '</div>' +
                        '<div class="ap-event-info">' +
                            '<div class="ap-event-name">' + escHtml(title) + '</div>' +
                            '<div class="ap-event-time">' + (time ? time : 'All day') + '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }
        }
    }

    // ── Init ──────────────────────────────────────────────────────
    function init() {
        initAdvisorDisplay();
        bindPreviewListeners();
        window.syncAdminStudentPreview = syncPreview;
        installShowTabBridge();
        installStatsBridge();
        // Watch for adminPanel becoming visible
        var panel = document.getElementById('adminPanel');
        if (panel) {
            var obs = new MutationObserver(hidePortalChrome);
            obs.observe(panel, { attributes: true, attributeFilter: ['style'] });
            hidePortalChrome();
        }
        // Start on dashboard page
        apShowPage('dashboard');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
