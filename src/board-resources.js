// Find Help resource rendering: sections, chips, sheets, cards, story row.
// Extracted verbatim from firebase-config.js; methods are merged onto
// FirebaseBulletinBoard.prototype by applyMethods() in firebase-config.js.
import {
    scrollWindowTo,
    RESOURCE_CATEGORY_CONFIG,
    STORY_BUBBLE_PREVIEW_CATEGORIES,
    RESOURCE_ICON_SVGS,
} from './board-shared.js'
import { normalizePostCategory } from './feed-categories.js'
import { RESOURCE_TILE_CATEGORIES } from './resource-categories.js'
import { getActionResourceChipLabel, MAX_RESOURCE_SERVICE_CHIPS, parseResourceServiceChips, translateResourceChipEs } from './resource-chip-labels.js'
import { toRichTextPlainText } from './rich-text.js'
import { formatResourceHoursHtml } from './resource-hours.js'
import { normalizeResourceActionLinks, RESOURCE_ACTION_LINK_ICON_SVG, RESOURCE_ACTION_LINK_PDF_ICON_SVG } from './resource-action-links.js'
import { DOCUMENT_TILE_ICON_SVG, isDocumentResource, OPEN_FORM_ICON_SVG } from './resource-kinds.js'
import { initResourceLogoTiles } from './resource-logo-tile.js'

export class BoardResourcesMethods {
    renderResourcesSections(resources) {
        const storyBubbleResources = this.getStoryBubbleResources(resources);
        this.renderResourceStoryRow('headerResourceStoryRow', 'headerResourceEmpty', storyBubbleResources);
        this.renderResourceStoryRow('feedDesktopResourceRow', null, storyBubbleResources);
        this.renderResourceStoryRow('resourceStoryRow', 'resourceStoryEmpty', storyBubbleResources);
        this.renderResourceStoryRow('resourceStoryRowPage', null, storyBubbleResources);
        this.renderHeroResources(resources);
        this.renderResourceCategoryFilters();
        this.renderResourceNeedChips(resources);
        this.renderResourceList(resources);
        // Also populate the desktop layout whenever resources update
        if (document.querySelector('.resources-desktop-layout')) {
            this.renderResourcesDesktop(resources);
        }
    }

    buildResourceNeedChipIndex(resources) {
        const stats = new Map();
        (resources || []).forEach((resource) => {
            const cat = this.getResourceCategoryKey(resource);
            const services = this.getResourceServices(resource, Number.POSITIVE_INFINITY);
            const seen = new Set();
            services.forEach((service) => {
                const label = getActionResourceChipLabel(service);
                if (!label) return;
                const key = label.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                if (!stats.has(label)) {
                    stats.set(label, { count: 0, source: service, catCounts: {} });
                }
                const entry = stats.get(label);
                entry.count += 1;
                if (cat) entry.catCounts[cat] = (entry.catCounts[cat] || 0) + 1;
            });
        });
        return Array.from(stats.entries())
            .map(([label, e]) => {
                const dominant = Object.entries(e.catCounts).sort((a, b) => b[1] - a[1])[0];
                return {
                    label,
                    count: e.count,
                    source: e.source,
                    category: dominant ? dominant[0] : 'immigration'
                };
            })
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    resourceMatchesNeedChip(resource, chipLabel) {
        if (!chipLabel) return true;
        const target = chipLabel.toLowerCase();
        const services = this.getResourceServices(resource, Number.POSITIVE_INFINITY);
        return services.some((service) => getActionResourceChipLabel(service).toLowerCase() === target);
    }

    getResourceCategoryTint(categoryKey) {
        const config = RESOURCE_CATEGORY_CONFIG[categoryKey];
        return config && config.color ? config.color : '#0d9488';
    }

    renderResourceNeedChips(resources) {
        const section = document.getElementById('resourceNeedSearch');
        if (!section) return;
        const entries = this.buildResourceNeedChipIndex(resources);
        if (!entries.length) {
            section.hidden = true;
            return;
        }
        section.hidden = false;

        const activeKey = (this.currentResourceNeedChip || '').toLowerCase();
        const activeEntry = activeKey
            ? entries.find((entry) => entry.label.toLowerCase() === activeKey)
            : null;

        this.renderResourceNeedTopRow(entries, activeEntry);
        this.renderResourceNeedActiveCard(activeEntry);
        this.renderResourceNeedDirectory(entries, activeKey);
        this.updateResourceNeedToggleState();
    }

    renderResourceNeedTopRow(entries, activeEntry) {
        const topRow = document.getElementById('resourceNeedTop');
        const activeWrap = document.getElementById('resourceNeedActive');
        if (!topRow) return;

        if (activeEntry) {
            topRow.hidden = true;
            topRow.innerHTML = '';
            if (activeWrap) activeWrap.hidden = false;
            return;
        }

        if (activeWrap) activeWrap.hidden = true;
        topRow.hidden = false;
        const topLimit = window.matchMedia('(max-width: 767px)').matches ? 5 : 7;
        const top = entries.slice(0, topLimit);
        topRow.innerHTML = top.map(({ label, source, category }) => {
            const tint = this.getResourceCategoryTint(category);
            const en = this.escapeHtml(label);
            const es = this.escapeHtml(translateResourceChipEs(source));
            return `
                <button type="button" class="resource-need-hero-chip" data-need-chip="${this.escapeAttribute(label)}" style="--tint:${tint}" role="option" aria-selected="false">
                    <span class="en-text">${en}</span>
                    <span class="es-text">${es}</span>
                </button>
            `;
        }).join('');
    }

    renderResourceNeedActiveCard(activeEntry) {
        const wrap = document.getElementById('resourceNeedActive');
        if (!wrap) return;
        if (!activeEntry) {
            wrap.innerHTML = '';
            wrap.hidden = true;
            return;
        }
        const tint = this.getResourceCategoryTint(activeEntry.category);
        const en = this.escapeHtml(activeEntry.label);
        const es = this.escapeHtml(translateResourceChipEs(activeEntry.source));
        wrap.innerHTML = `
            <span class="resource-need-hero-chip is-active" style="--tint:${tint}" aria-current="true">
                <span class="en-text">${en}</span>
                <span class="es-text">${es}</span>
            </span>
            <button type="button" class="resource-need__change" id="resourceNeedChange">
                <span class="en-text">Clear</span>
                <span class="es-text">Borrar</span>
            </button>
        `;
        wrap.hidden = false;
    }

    renderResourceNeedDirectory(entries, activeKey) {
        const container = document.getElementById('resourceNeedAll');
        if (!container) return;

        const groups = RESOURCE_TILE_CATEGORIES
            .map((key) => {
                const config = RESOURCE_CATEGORY_CONFIG[key];
                if (!config) return null;
                const items = entries.filter((entry) => entry.category === key);
                if (!items.length) return null;
                return { key, config, items };
            })
            .filter(Boolean);

        if (!groups.length) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.innerHTML = groups.map(({ key, config, items }) => {
            const tint = config.color;
            const chipsHtml = items.map(({ label, source, count }) => {
                const isActive = activeKey && label.toLowerCase() === activeKey;
                const en = this.escapeHtml(label);
                const es = this.escapeHtml(translateResourceChipEs(source));
                return `<button type="button" class="resource-need-chip${isActive ? ' is-active' : ''}" data-need-chip="${this.escapeAttribute(label)}" aria-pressed="${isActive ? 'true' : 'false'}"><span class="en-text">${en}</span><span class="es-text">${es}</span><span class="resource-need-chip__count" aria-hidden="true">${count}</span></button>`;
            }).join('');
            return `
                <div class="resource-need-group" data-cat-key="${key}" style="--tint:${tint}">
                    <h3 class="resource-need-group__eyebrow">
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </h3>
                    <div class="resource-need-group__chips">${chipsHtml}</div>
                </div>
            `;
        }).join('');

        container.hidden = !this.resourceNeedExpanded;
    }

    updateResourceNeedToggleState() {
        const toggle = document.getElementById('resourceNeedToggle');
        const all = document.getElementById('resourceNeedAll');
        const topRow = document.getElementById('resourceNeedTop');
        const activeWrap = document.getElementById('resourceNeedActive');
        if (!toggle || !all) return;
        const expanded = !!this.resourceNeedExpanded;
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        all.hidden = !expanded;
        if (topRow && (!activeWrap || activeWrap.hidden)) {
            topRow.hidden = expanded;
        }
        toggle.querySelectorAll('.resource-need__toggle-text').forEach((el) => {
            const state = el.getAttribute('data-toggle-state');
            el.hidden = expanded ? state !== 'expanded' : state !== 'collapsed';
        });
    }

    toggleResourceNeedDirectory(force) {
        const next = typeof force === 'boolean' ? force : !this.resourceNeedExpanded;
        this.resourceNeedExpanded = next;
        this.updateResourceNeedToggleState();
    }

    setResourceNeedChip(label) {
        const next = label || '';
        const current = this.currentResourceNeedChip || '';
        if (next.toLowerCase() === current.toLowerCase()) {
            this.currentResourceNeedChip = '';
        } else {
            this.currentResourceNeedChip = next;
            if (next) {
                this.currentResourceCategory = 'all';
                this.currentDesktopResourceTopic = 'all';
                this.resourceNeedExpanded = false;
            }
        }
        this.renderResourcesSections(this.getPublishedResources());
    }

    renderHeroResources(resources) {
        const container = document.getElementById('heroResourcesGrid');
        if (!container) {
            return;
        }

        // Show category cards for all categories that have resources, or show preview categories
        const categoriesWithResources = new Set();
        resources.forEach((resource) => {
            const category = this.getResourceCategoryKey(resource);
            if (category) {
                categoriesWithResources.add(category);
            }
        });

        // Always render in canonical sidebar order so the homepage bubbles
        // and the resources view sidebar stay perfectly aligned. Falls back
        // to the preview list before any resources exist.
        const categoriesToShow = categoriesWithResources.size > 0
            ? RESOURCE_TILE_CATEGORIES.filter((key) => categoriesWithResources.has(key))
            : STORY_BUBBLE_PREVIEW_CATEGORIES;

        const heroCards = categoriesToShow.map((category) => {
            const config = RESOURCE_CATEGORY_CONFIG[category];
            if (!config) {
                return '';
            }

            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

            return `
                <button
                    type="button"
                    class="hero-resource-card resource-${category}"
                    data-resource-category="${category}"
                    aria-label="View ${config.labelEn} help"
                >
                    <span class="hero-resource-icon" aria-hidden="true">
                        ${iconSvg}
                    </span>
                    <span class="hero-resource-label">
                        ${config.labelEn}
                        <small>${config.labelEs}</small>
                    </span>
                </button>
            `;
        }).join('');

        container.innerHTML = heroCards || '<p class="hero-resources-empty">No help links available yet.</p>';

        // Add click handlers
        container.querySelectorAll('.hero-resource-card').forEach((card) => {
            card.addEventListener('click', () => {
                const category = card.dataset.resourceCategory;
                this.openResourceShortcut(category);
            });
        });
    }

    renderResourceStoryRow(rowId, emptyId, resources) {
        const row = document.getElementById(rowId);
        if (!row) {
            return;
        }

        row.innerHTML = resources.map((resource) => this.createResourceStoryBubble(resource)).join('');

        if (!emptyId) {
            row.style.display = resources.length > 0 ? 'flex' : 'none';
            return;
        }

        const emptyState = document.getElementById(emptyId);
        if (!emptyState) {
            return;
        }

        const hasResources = resources.length > 0;
        row.style.display = hasResources ? 'flex' : 'none';
        emptyState.style.display = hasResources ? 'none' : 'block';
    }

    renderResourceCategoryFilters() {
        const container = document.getElementById('resourceCategoryFilters');
        if (!container) {
            return;
        }

        const resources = this.getPublishedResources();
        const tiles = RESOURCE_TILE_CATEGORIES
            .map((key) => {
                const config = RESOURCE_CATEGORY_CONFIG[key];
                if (!config) return '';
                const count = resources.filter((resource) => this.getResourceCategoryKey(resource) === key).length;
                const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;
                const placesLabelEn = this.getResourceCountNoun(count, 'en');
                const placesLabelEs = this.getResourceCountNoun(count, 'es');
                return `
            <button
                type="button"
                class="resource-category-tile resource-tile-${key}"
                data-resource-category="${key}"
                aria-label="${this.escapeAttribute(`${config.labelEn} / ${config.labelEs}, ${count} ${placesLabelEn}`)}"
            >
                <span class="resource-category-tile-icon" style="background:${config.color}" aria-hidden="true">
                    ${iconSvg}
                </span>
                <span class="resource-category-tile-copy">
                    <strong>
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </strong>
                    <small>
                        <span class="en-text">${count} ${placesLabelEn}</span>
                        <span class="es-text">${count} ${placesLabelEs}</span>
                    </small>
                </span>
            </button>
        `;
            })
            .join('');

        container.innerHTML = tiles;
    }

    renderResourceCategoryDetailHeader(exploring) {
        const header = document.getElementById('resourceCategoryDetail');
        const tiles = document.getElementById('resourceCategoryFilters');
        if (!header) return;

        const isMobileResourcesLayout = window.matchMedia('(max-width: 767px)').matches;
        const category = this.currentResourceCategory;
        const config = category && category !== 'all' ? RESOURCE_CATEGORY_CONFIG[category] : null;
        const needChip = (this.currentResourceNeedChip || '').trim();
        const isNeedChipMode = !!needChip && isMobileResourcesLayout;

        const resetHeader = () => {
            header.hidden = true;
            header.style.display = 'none';
            header.innerHTML = '';
            if (tiles) {
                tiles.hidden = false;
                tiles.style.removeProperty('display');
            }
            document.body.classList.remove('resource-category-detail-open');
        };

        if (!exploring || !isMobileResourcesLayout || (!config && !isNeedChipMode)) {
            resetHeader();
            return;
        }

        document.body.classList.add('resource-category-detail-open');

        if (tiles) {
            tiles.hidden = true;
            tiles.style.display = 'none';
        }

        if (isNeedChipMode) {
            const matchingResources = this.getPublishedResources()
                .filter((resource) => this.resourceMatchesNeedChip(resource, needChip));
            const entries = this.buildResourceNeedChipIndex(this.getPublishedResources());
            const chipEntry = entries.find((entry) => entry.label.toLowerCase() === needChip.toLowerCase());
            const accent = chipEntry ? this.getResourceCategoryTint(chipEntry.category) : '#0d9488';
            const enLabel = chipEntry ? chipEntry.label : needChip;
            const esLabel = chipEntry ? translateResourceChipEs(chipEntry.source) : needChip;
            const chipCategoryConfig = chipEntry ? RESOURCE_CATEGORY_CONFIG[chipEntry.category] : null;
            const iconSvg = chipCategoryConfig
                ? (RESOURCE_ICON_SVGS[chipCategoryConfig.icon] || RESOURCE_ICON_SVGS.globe)
                : RESOURCE_ICON_SVGS.globe;

            header.hidden = false;
            header.style.removeProperty('display');
            header.style.setProperty('--cat-accent', accent);
            header.innerHTML = `
                <button type="button" class="resource-category-detail-back" data-resource-need-back aria-label="Clear need filter">
                    <span aria-hidden="true">&larr;</span>
                    <span class="en-text">Back</span>
                    <span class="es-text">Atrás</span>
                </button>
                <div class="resource-category-detail-title">
                    <span class="resource-category-detail-icon" style="background:${accent}" aria-hidden="true">${iconSvg}</span>
                    <div class="resource-category-detail-text">
                        <h2>
                            <span class="en-text">${this.escapeHtml(enLabel)}</span>
                            <span class="es-text">${this.escapeHtml(esLabel)}</span>
                        </h2>
                        <p>
                            <span class="en-text">${this.getResourceCountText(matchingResources.length, 'en')}</span>
                            <span class="es-text">${this.getResourceCountText(matchingResources.length, 'es')}</span>
                        </p>
                    </div>
                </div>
            `;

            const backBtn = header.querySelector('[data-resource-need-back]');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    this.setResourceNeedChip('');
                });
            }
            return;
        }

        const allResources = this.getPublishedResources()
            .filter((resource) => this.getResourceCategoryKey(resource) === category);
        const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

        header.hidden = false;
        header.style.removeProperty('display');
        header.style.setProperty('--cat-accent', config.color);

        const returnToFeed = this.mobileResourceCategoryReturnView === 'feed';
        header.innerHTML = `
            <button type="button" class="resource-category-detail-back" data-resource-detail-back aria-label="${returnToFeed ? 'Back to home' : 'Back to help categories'}">
                <span aria-hidden="true">&larr;</span>
                ${returnToFeed
                    ? `<span class="en-text">Back to home</span>
                       <span class="es-text">Volver al inicio</span>`
                    : `<span class="en-text">Back</span>
                       <span class="es-text">Atrás</span>`}
            </button>
            <div class="resource-category-detail-title">
                <span class="resource-category-detail-icon" style="background:${config.color}" aria-hidden="true">${iconSvg}</span>
                <div class="resource-category-detail-text">
                    <h2>
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </h2>
                    <p>
                        <span class="en-text">${this.getResourceCountText(allResources.length, 'en')}</span>
                        <span class="es-text">${this.getResourceCountText(allResources.length, 'es')}</span>
                    </p>
                </div>
            </div>
        `;

        const backBtn = header.querySelector('[data-resource-detail-back]');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.mobileResourceCategoryReturnView === 'feed') {
                    this.switchView('feed', { preserveResourceNavigation: false });
                    scrollWindowTo(0);
                    return;
                }
                this.switchResourceCategory('all');
            });
        }
    }

    renderResourceList(resources) {
        const container = document.getElementById('resourcesList');
        const emptyState = document.getElementById('resourceEmptyState');
        const sortBar = document.getElementById('resourceSortBar');
        if (!container || !emptyState) {
            return;
        }

        // Resources tab: keep category tiles as the landing view. Show the list when
        // searching or when a category shortcut lands here with an active filter.
        const exploring =
            (this.currentResourceCategory && this.currentResourceCategory !== 'all') ||
            (this.resourceSearchQuery && this.resourceSearchQuery.trim() !== '') ||
            !!this.currentResourceNeedChip;

        // Drive the mobile in-page category view (header + back button, hides tiles).
        this.renderResourceCategoryDetailHeader(exploring);

        if (!exploring) {
            container.innerHTML = '';
            container.style.display = 'none';
            container.setAttribute('aria-hidden', 'true');
            emptyState.style.display = 'none';
            if (sortBar) {
                sortBar.hidden = true;
            }
            return;
        }

        container.style.display = '';
        container.setAttribute('aria-hidden', 'false');
        if (sortBar) {
            sortBar.hidden = false;
        }

        // Filter by category — use the primary resourceCategory only, so the
        // mobile drill-in count matches the desktop sidebar count. Tag/category
        // array entries are intentionally ignored here to prevent resources
        // from leaking into unrelated topic views.
        let visibleResources = this.currentResourceCategory === 'all'
            ? resources
            : resources.filter((resource) => this.getResourceCategoryKey(resource) === this.currentResourceCategory);

        // Apply need-chip filter
        if (this.currentResourceNeedChip) {
            visibleResources = visibleResources.filter((resource) => this.resourceMatchesNeedChip(resource, this.currentResourceNeedChip));
        }

        // Apply search filter
        visibleResources = this.filterResourcesBySearch(visibleResources, this.resourceSearchQuery);

        // Apply sort
        visibleResources = this.sortResources(visibleResources, this.resourceSortMode);

        if (visibleResources.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            const isSearching = this.resourceSearchQuery && this.resourceSearchQuery.trim() !== '';
            emptyState.innerHTML = isSearching
                ? '<h3>No results found</h3><p>Try a different search term or clear filters.</p><p class="empty-state-bilingual">No se encontraron resultados. Pruebe un término diferente o borre los filtros.</p>'
                : resources.length === 0
                    ? '<h3>No help links published yet</h3><p>Advisors can add quick links in the admin portal so they appear here for students.</p>'
                    : this.currentResourceNeedChip
                        ? '<h3>No help links for this need</h3><p>Try another need or browse by topic.</p><p class="empty-state-bilingual">No hay enlaces para esta necesidad. Pruebe otra necesidad o busque por tema.</p>'
                        : '<h3>No help links in this category</h3><p>Try another category to see more support links.</p>';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        const useHelpResourceCard =
            isMobile &&
            (
                (this.currentResourceCategory && this.currentResourceCategory !== 'all') ||
                !!this.currentResourceNeedChip
            );

        container.innerHTML = visibleResources
            .map((resource) => {
                if (!useHelpResourceCard) {
                    return this.createResourceCard(resource);
                }
                const resourceCategoryConfig = RESOURCE_CATEGORY_CONFIG[this.getResourceCategoryKey(resource)];
                return this.createHelpResourceCard(resource, resourceCategoryConfig);
            })
            .join('');
        initResourceLogoTiles(container);
    }

    filterResourcesBySearch(resources, query) {
        if (!query || query.trim() === '') {
            return resources;
        }

        const normalizedQuery = query.toLowerCase().trim();

        return resources.filter((resource) => {
            const { titleEn, titleEs } = this.getResourceTitles(resource);
            const description = resource.description || '';
            const category = this.getResourceCategoryKey(resource);
            const services = this.getResourceServices(resource).join(' ');

            return (
                titleEn.toLowerCase().includes(normalizedQuery) ||
                titleEs.toLowerCase().includes(normalizedQuery) ||
                description.toLowerCase().includes(normalizedQuery) ||
                services.toLowerCase().includes(normalizedQuery) ||
                category.toLowerCase().includes(normalizedQuery)
            );
        });
    }

    // ─── Quick-Filter helpers ────────────────────────────────────────

    isResourceWalkIn(resource) {
        if (resource.isWalkIn === true || resource.walkIn === true) return true;
        const text = [
            resource.highlights, resource.description, resource.title,
            resource.titleEn, resource.titleEs
        ].join(' ').toLowerCase();
        return /walk[\s-]?in|sin cita|drop[\s-]?in/.test(text);
    }

    // Card summary shown on resource tiles. Renders both languages in en-text/es-text
    // spans so the lang toggle works without a re-render. Falls back across languages
    // when only one is set.
    getResourceCardSummaryHtml(resource) {
        if (!resource) return '';
        const en = (resource.description || '').trim();
        const es = (resource.summaryEs || '').trim();
        if (!en && !es) return '';
        const enPlain = en ? toRichTextPlainText(en) : toRichTextPlainText(es);
        const esPlain = es ? toRichTextPlainText(es) : toRichTextPlainText(en);
        if (!enPlain && !esPlain) return '';
        return `<p class="mobile-resource-card__summary">
            <span class="en-text">${this.escapeHtml(enPlain)}</span>
            <span class="es-text">${this.escapeHtml(esPlain)}</span>
        </p>`;
    }

    // Returns true if open now, false if a schedule was parsed and we are
    // outside it, or undefined if the hours text was empty/unparseable. The
    // tri-state lets callers distinguish "currently closed" from "unknown".
    isResourceOpenNow(resource) {
        const hoursText = (
            resource.hours || resource.hoursOfOperation || resource.schedule || ''
        ).toLowerCase().trim();
        if (!hoursText) return undefined;
        if (/24\s*\/\s*7|24\s*hours|open\s*24|any\s*time|anytime|always\s*open|24\s*hr/.test(hoursText)) return true;

        const now = new Date();
        const dayIndex = now.getDay(); // 0=Sun..6=Sat
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        const DAY_ALIASES = {
            sun: 0, sunday: 0,
            mon: 1, monday: 1,
            tue: 2, tues: 2, tuesday: 2,
            wed: 3, wednesday: 3,
            thu: 4, thur: 4, thurs: 4, thursday: 4,
            fri: 5, friday: 5,
            sat: 6, saturday: 6
        };

        const parseTime12 = (s) => {
            const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
            if (!m) return null;
            let h = parseInt(m[1], 10);
            const min = parseInt(m[2] || '0', 10);
            const period = (m[3] || '').toLowerCase();
            if (period === 'pm' && h !== 12) h += 12;
            if (period === 'am' && h === 12) h = 0;
            return h * 60 + min;
        };

        let parsedAnySegment = false;
        const segments = hoursText.split(/[,;|]/);
        for (const segment of segments) {
            const rangeParts = segment.match(
                /([a-z]+(?:[\s-][a-z]+)?)[:\s]*([\d:]+\s*(?:am|pm)?)\s*[-–]\s*([\d:]+\s*(?:am|pm)?)/i
            );
            if (!rangeParts) continue;
            const dayPart = rangeParts[1].trim().toLowerCase();
            const openMin = parseTime12(rangeParts[2]);
            const closeMin = parseTime12(rangeParts[3]);
            if (openMin === null || closeMin === null) continue;

            const dayRange = dayPart.split(/[-–]/).map(d => DAY_ALIASES[d.trim()]);
            const startDay = dayRange[0] ?? -1;
            const endDay = dayRange[1] ?? startDay;
            if (startDay === -1) continue;
            parsedAnySegment = true;
            if (dayIndex < startDay || dayIndex > endDay) continue;

            if (closeMin > openMin) {
                if (currentMinutes >= openMin && currentMinutes < closeMin) return true;
            } else {
                if (currentMinutes >= openMin || currentMinutes < closeMin) return true;
            }
        }
        return parsedAnySegment ? false : undefined;
    }

    getResourceBadgesHtml(resource) {
        const badges = [];
        if (this.isResourceWalkIn(resource)) {
            badges.push('<span class="badge badge--walkin"><span class="en-text">Walk-in</span><span class="es-text">Sin cita</span></span>');
        }
        const openState = this.isResourceOpenNow(resource);
        if (openState === true) {
            badges.push('<span class="badge badge--open"><span class="en-text">Open now</span><span class="es-text">Abierto</span></span>');
        } else if (openState === false) {
            badges.push('<span class="badge badge--closed"><span class="en-text">Closed</span><span class="es-text">Cerrado</span></span>');
        }
        if (badges.length === 0) return '';
        return `<div class="resource-badges-container">${badges.join('')}</div>`;
    }

    formatCompactAddress(address = '') {
        const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const street = parts[0];
            const city = parts[1].replace(/\s+[A-Z]{2}(\s+\d{5}(?:-\d{4})?)?$/i, '').trim() || parts[1];
            return `${street} · ${city}`;
        }
        return address.trim();
    }

    getResourceSheetSubtitle(resource) {
        const { titleEn } = this.getResourceTitles(resource);
        const company = (resource.company || '').trim();
        const address = (resource.address || '').trim();
        const shortAddress = address ? this.formatCompactAddress(address) : '';

        if (shortAddress) {
            if (company && company !== titleEn) {
                return `${company} · ${shortAddress.split(' · ').pop()}`;
            }
            return shortAddress;
        }

        if (company && company !== titleEn) {
            return company;
        }

        const description = (resource.description || '').trim();
        if (!description) {
            return '';
        }

        if (description.length <= 72) {
            return description;
        }

        const cut = description.slice(0, 72);
        const lastSpace = cut.lastIndexOf(' ');
        return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
    }

    // ─── Desktop Resources Rendering ────────────────────────────────

    getResourceCountNoun(count, lang = 'en') {
        if (lang === 'es') {
            return count === 1 ? 'recurso' : 'recursos';
        }
        return count === 1 ? 'resource' : 'resources';
    }

    getResourceCountText(count, lang = 'en') {
        return `${count} ${this.getResourceCountNoun(count, lang)}`;
    }

    renderResourcesDesktop(allResources) {
        const navContainer = document.getElementById('desktopCategoryNav');
        const sectionsContainer = document.getElementById('resourcesDesktopSections');
        const emptyEl = document.getElementById('resourceDesktopEmptyState');
        if (!navContainer || !sectionsContainer) return;

        // Apply search query
        const searchQuery = document.getElementById('searchInput')?.value ||
                            document.getElementById('desktopTopbarSearchInput')?.value || '';
        let filtered = this.filterResourcesBySearch(allResources, searchQuery);

        // Apply need-chip filter (search by need)
        if (this.currentResourceNeedChip) {
            filtered = filtered.filter((resource) => this.resourceMatchesNeedChip(resource, this.currentResourceNeedChip));
        }

        // Build per-category map
        const catMap = {};
        RESOURCE_TILE_CATEGORIES.forEach(key => { catMap[key] = []; });
        filtered.forEach(r => {
            const key = this.getResourceCategoryKey(r);
            if (catMap[key]) catMap[key].push(r);
        });

        // Render sidebar nav
        const activeTopic = this.currentDesktopResourceTopic || 'all';
        const allButtonHtml = `
            <button
                type="button"
                class="desktop-cat-btn desktop-cat-btn--all${activeTopic === 'all' ? ' active' : ''}"
                data-desktop-cat="all"
                style="--topic-color:#e0e7ff;--topic-text:#0a1d3a"
                aria-label="All topics / Todos los temas"
            >
                <span class="desktop-cat-icon desktop-cat-icon--all" style="background:#0a1d3a" aria-hidden="true">✨</span>
                <span class="desktop-cat-label">
                    <span class="en-text">All</span>
                    <span class="es-text">Todo</span>
                </span>
                ${filtered.length > 0 ? `<span class="desktop-cat-count" style="background:#e0e7ff;color:#0a1d3a">${filtered.length}</span>` : ''}
            </button>
        `;

        navContainer.innerHTML = allButtonHtml + RESOURCE_TILE_CATEGORIES.map(key => {
            const config = RESOURCE_CATEGORY_CONFIG[key];
            if (!config) return '';
            const count = (catMap[key] || []).length;
            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;
            return `
                <button
                    type="button"
                    class="desktop-cat-btn${activeTopic === key ? ' active' : ''}"
                    data-desktop-cat="${key}"
                    style="--topic-color:${config.color}20;--topic-text:${config.color}"
                    aria-label="${this.escapeAttribute(config.labelEn + ' / ' + config.labelEs)}"
                >
                    <span class="desktop-cat-icon" style="background:${config.color}" aria-hidden="true">${iconSvg}</span>
                    <span class="desktop-cat-label">
                        <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                        <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                    </span>
                    ${count > 0 ? `<span class="desktop-cat-count" style="background:${config.color}20;color:${config.color}">${count}</span>` : ''}
                </button>
            `;
        }).join('');

        const setActiveDesktopTopic = (topic) => {
            this.currentDesktopResourceTopic = topic || 'all';
            navContainer.querySelectorAll('.desktop-cat-btn').forEach((button) => {
                const buttonTopic = button.dataset.desktopCat || 'all';
                button.classList.toggle('active', buttonTopic === this.currentDesktopResourceTopic);
            });
        };

        // Bind sidebar button clicks → scroll to section, not open sheet
        navContainer.querySelectorAll('.desktop-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.dataset.desktopCat;
                if (!cat) return;

                if (this.currentResourceNeedChip) {
                    this.currentResourceNeedChip = '';
                    this.renderResourcesSections(this.getPublishedResources());
                }
                setActiveDesktopTopic(cat);

                const headerOffset = parseInt(
                    getComputedStyle(document.documentElement)
                        .getPropertyValue('--app-header-offset') || '70', 10
                );

                if (cat === 'all') {
                    const scrollTarget = sectionsContainer.closest('.resources-desktop-main') || sectionsContainer;
                    const top = window.scrollY + scrollTarget.getBoundingClientRect().top - headerOffset - 16;
                    scrollWindowTo(top);
                    return;
                }

                const target = document.getElementById(`desktop-section-${cat}`);
                if (target) {
                    const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 16;
                    scrollWindowTo(top);
                }
            });
        });

        // Render main categorized sections
        const categoriesWithResources = RESOURCE_TILE_CATEGORIES.filter(k => (catMap[k] || []).length > 0);

        if (categoriesWithResources.length === 0) {
            sectionsContainer.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';

        sectionsContainer.innerHTML = categoriesWithResources.map(key => {
            const config = RESOURCE_CATEGORY_CONFIG[key];
            if (!config) return '';
            const resources = catMap[key];
            const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

            const cardsHtml = resources.map(r => this.createHelpResourceCard(r, config)).join('');

            return `
                <section class="desktop-resource-section" id="desktop-section-${key}" style="--cat-accent:${config.color}">
                    <div class="desktop-section-header">
                        <span class="desktop-section-icon" style="background:${config.color}" aria-hidden="true">${iconSvg}</span>
                        <div class="desktop-section-title-group">
                            <h2 class="desktop-section-title">
                                <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                                <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                            </h2>
                            <p class="desktop-section-count">
                                <span class="en-text">${this.getResourceCountText(resources.length, 'en')}</span>
                                <span class="es-text">${this.getResourceCountText(resources.length, 'es')}</span>
                            </p>
                        </div>
                    </div>
                    <div class="desktop-section-grid">
                        ${cardsHtml}
                    </div>
                </section>
            `;
        }).join('');
        initResourceLogoTiles(sectionsContainer);
    }

    // ─── Speech Synthesis ────────────────────────────────────────────

    handleResourceSpeech(text, button) {
        if (!window.speechSynthesis) return;

        // If the same button is already speaking, cancel it
        if (button.classList.contains('speaking')) {
            window.speechSynthesis.cancel();
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
            return;
        }

        // Stop any currently speaking button
        window.speechSynthesis.cancel();
        document.querySelectorAll('.resource-audio-btn.speaking').forEach(b => {
            b.classList.remove('speaking');
            b.setAttribute('aria-label', 'Read aloud');
        });

        // Detect language
        const isSpanish = document.documentElement.getAttribute('data-lang') === 'ES' ||
                          document.body.classList.contains('lang-es');
        const lang = isSpanish ? 'es-US' : 'en-US';

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;

        // Prefer a matching voice
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => v.lang === lang) ||
                      voices.find(v => v.lang.startsWith(lang.split('-')[0]));
        if (match) utterance.voice = match;

        button.classList.add('speaking');
        button.setAttribute('aria-label', 'Stop reading');

        utterance.onend = () => {
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
        };
        utterance.onerror = () => {
            button.classList.remove('speaking');
            button.setAttribute('aria-label', 'Read aloud');
        };

        window.speechSynthesis.speak(utterance);
    }

    sortResources(resources, sortMode) {
        const sorted = [...resources];

        switch (sortMode) {
            case 'newest':
                return sorted.sort((a, b) => {
                    const dateA = this.getTimestampValue(a.datePosted || a.createdAt);
                    const dateB = this.getTimestampValue(b.datePosted || b.createdAt);
                    return dateB - dateA;
                });
            case 'az':
                return sorted.sort((a, b) => {
                    const { titleEn: titleA } = this.getResourceTitles(a);
                    const { titleEn: titleB } = this.getResourceTitles(b);
                    return titleA.localeCompare(titleB);
                });
            default:
                // Respect the advisor-defined resourceOrder, then fall back to newest
                return sorted.sort((a, b) => {
                    const orderA = this.getResourceOrder(a);
                    const orderB = this.getResourceOrder(b);
                    if (orderA !== orderB) return orderA - orderB;
                    return this.getTimestampValue(b.datePosted || b.createdAt) - this.getTimestampValue(a.datePosted || a.createdAt);
                });
        }
    }

    switchResourceCategory(category) {
        this.currentResourceCategory = category;
        this.renderResourcesSections(this.getPublishedResources());
    }

    normalizeResourceCategoryKey(category) {
        const keyMap = {
            job: 'jobs',
            childcare: 'family',
            money: 'money',
            esol: 'esol',
            college: 'college',
            'legal-aid': 'legal-aid',
        };
        return keyMap[category] || category;
    }

    scrollToDesktopResourceSection(category) {
        if (!category || category === 'all') {
            return;
        }

        const navContainer = document.getElementById('desktopCategoryNav');
        if (navContainer) {
            navContainer.querySelectorAll('.desktop-cat-btn').forEach((button) => {
                button.classList.toggle('active', button.dataset.desktopCat === category);
            });
        }

        const headerOffset = parseInt(
            getComputedStyle(document.documentElement).getPropertyValue('--app-header-offset') || '70',
            10
        );
        const target = document.getElementById(`desktop-section-${category}`);
        if (target) {
            const top = window.scrollY + target.getBoundingClientRect().top - headerOffset - 16;
            scrollWindowTo(top);
        }
    }

    navigateToResourceCategory(category, options = {}) {
        const resourceKey = this.normalizeResourceCategoryKey(category);
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;
        const entryView = this.currentView;

        if (isDesktop && options.expandDesktop && resourceKey && resourceKey !== 'all') {
            this.expandedDesktopResourceSections.add(resourceKey);
        }

        if (isDesktop) {
            this.currentDesktopResourceTopic = resourceKey;
        } else {
            this.currentResourceCategory = resourceKey;
            this.mobileResourceCategoryReturnView = entryView === 'resources' ? 'categories' : 'feed';
        }
        this.switchView('resources', { preserveResourceNavigation: true, skipRender: true });
        this.renderResourcesSections(this.getPublishedResources());

        if (isDesktop) {
            requestAnimationFrame(() => {
                this.scrollToDesktopResourceSection(resourceKey);
            });
        }
    }

    openResourceShortcut(category) {
        this.navigateToResourceCategory(category);
    }

    setFeedCategory(category = 'all') {
        const normalizedCategory = this.normalizeFeedCategory(category);
        if (this.currentView !== 'feed') {
            this.switchView('feed', { skipRender: true, preserveDetail: true });
        }
        this.currentFeedCategory = normalizedCategory;
        this.selectedCategories = normalizedCategory === 'all' ? [] : [normalizedCategory];
        this.updateFeedCategoryHeader();
        this.updateActiveCategoryState();
        this.updateSearchLayerCatState(normalizedCategory);
        this.updateFilterCount();
        this.applyFilters();
    }

    normalizeFeedCategory(category) {
        return normalizePostCategory(category);
    }

    openResourceDetailSheet(category, options = {}) {
        const config = RESOURCE_CATEGORY_CONFIG[category];
        const sheet = document.getElementById('catDetailSheet');
        const titleEl = document.getElementById('catDetailTitle');
        const iconEl = document.getElementById('catDetailIcon');
        const listEl = document.getElementById('catOrgList');
        if (!config || !sheet || !listEl) return;

        const resources = this.getPublishedResources()
            .filter((resource) => this.getResourceCategoryKey(resource) === category);
        const isMobileSheet = window.matchMedia('(max-width: 767px)').matches;
        const shouldLimit = !options.showAll;
        const visibleResources = shouldLimit ? resources.slice(0, 3) : resources;
        const iconSvg = RESOURCE_ICON_SVGS[config.icon] || RESOURCE_ICON_SVGS.globe;

        if (titleEl) {
            titleEl.innerHTML = `
                <span class="en-text">${this.escapeHtml(config.labelEn)}</span>
                <span class="es-text">${this.escapeHtml(config.labelEs)}</span>
                <small>
                    <span class="en-text">${this.getResourceCountText(resources.length, 'en')}</span>
                    <span class="es-text">${this.getResourceCountText(resources.length, 'es')}</span>
                </small>
            `;
        }

        if (iconEl) {
            iconEl.style.background = config.color;
            iconEl.innerHTML = iconSvg;
        }

        sheet.style.setProperty('--cat-accent', config.color);
        const emptyHtml = `
            <div class="cat-org-empty">
                <strong>No help links listed yet.</strong>
                <span>Ask your advisor for trusted places nearby.</span>
            </div>
        `;
        const showAllHtml = shouldLimit && resources.length > visibleResources.length
            ? this.createResourceSheetShowAllButton(category, config, resources.length)
            : '';
        listEl.innerHTML = visibleResources.length > 0
            ? visibleResources.map((resource) => (
                isMobileSheet
                    ? this.createHelpResourceSheetRow(resource, config)
                    : this.createHelpResourceCard(resource, config)
            )).join('')
            : emptyHtml;
        if (visibleResources.length > 0 && !isMobileSheet) {
            initResourceLogoTiles(listEl);
        }

        // Place the "See all" button in the sticky footer (outside the scroll area)
        const footerEl = document.getElementById('catSheetFooter');
        if (footerEl) {
            footerEl.innerHTML = showAllHtml;
            footerEl.style.display = showAllHtml ? '' : 'none';
        }


        if (this.resourceSheetCloseTimer) {
            window.clearTimeout(this.resourceSheetCloseTimer);
            this.resourceSheetCloseTimer = null;
        }

        sheet.classList.add('open');
        sheet.classList.toggle('cat-detail-sheet--bottom', isMobileSheet);
        sheet.classList.toggle('cat-detail-sheet--desktop', !isMobileSheet);
        sheet.classList.toggle('cat-detail-sheet--expanded', !shouldLimit);
        sheet.setAttribute('aria-hidden', 'false');
        document.body.classList.add('resource-sheet-open');
        const scroll = sheet.querySelector('.cat-detail-scroll');
        if (scroll) scroll.scrollTop = 0;
    }

    closeResourceDetailSheet() {
        const sheet = document.getElementById('catDetailSheet');
        if (sheet) {
            const wasBottomSheet = sheet.classList.contains('cat-detail-sheet--bottom');
            const wasDesktopSheet = sheet.classList.contains('cat-detail-sheet--desktop');
            sheet.classList.remove('open', 'is-dragging');
            sheet.setAttribute('aria-hidden', 'true');
            sheet.style.removeProperty('--cat-sheet-drag-y');

            if (wasBottomSheet || wasDesktopSheet) {
                if (this.resourceSheetCloseTimer) {
                    window.clearTimeout(this.resourceSheetCloseTimer);
                }
                this.resourceSheetCloseTimer = window.setTimeout(() => {
                    this.resourceSheetCloseTimer = null;
                    if (!sheet.classList.contains('open')) {
                        sheet.classList.remove('cat-detail-sheet--bottom', 'cat-detail-sheet--desktop', 'cat-detail-sheet--expanded');
                    }
                }, 280);
            } else {
                sheet.classList.remove('cat-detail-sheet--bottom', 'cat-detail-sheet--desktop', 'cat-detail-sheet--expanded');
            }
        }
        document.body.classList.remove('resource-sheet-open');
    }

    createResourceSheetShowAllButton(category, config, count) {
        return `
            <button class="cat-org-show-all" type="button" data-cat-show-all="${this.escapeAttribute(category)}" style="--cat-accent:${config.color}">
                <span class="en-text">See all ${this.escapeHtml(config.labelEn.toLowerCase())} — ${this.getResourceCountText(count, 'en')}</span>
                <span class="es-text">Ver ${this.getResourceCountText(count, 'es')}</span>
                <span aria-hidden="true">&rarr;</span>
            </button>
        `;
    }

    createResourceDetailCard(resource, config, options = {}) {
        const { titleEn } = this.getResourceTitles(resource);
        const isCompact = options.compact === true;
        const description = isCompact
            ? this.getResourceSheetSubtitle(resource)
            : (resource.description || '');
        const escapedDescription = description
            ? (isCompact
                ? this.escapeHtml(description)
                : this.formatRichTextInline(resource.description || ''))
            : '';
        const url = this.getResourceUrl(resource);
        const displayUrl = resource.websiteLabel || this.formatLinkLabel(url, this.getResourceCategoryKey(resource));
        const phone = resource.phone || '';
        const tel = resource.tel || (phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '');
        const address = resource.address || '';
        const mapUrl = resource.mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');
        const callHtml = phone && tel
            ? `<a href="${this.escapeAttribute(tel)}" class="cat-org-btn cat-org-btn--call">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                    <span><strong>Call</strong><small>${this.escapeHtml(phone)}</small></span>
                </a>`
            : '';
        const websiteHtml = url && url !== '#'
            ? `<a href="${this.escapeAttribute(url)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--website">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                    <span><strong>Website</strong><small>${this.escapeHtml(displayUrl)}</small></span>
                </a>`
            : '';
        const directionsHtml = mapUrl
            ? `<a href="${this.escapeAttribute(mapUrl)}" target="_blank" rel="noopener" class="cat-org-btn cat-org-btn--directions">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    <span><strong>Directions</strong><small>${this.escapeHtml(address)}</small></span>
                </a>`
            : '';

        const primaryActionHtml = options.compact ? (callHtml || websiteHtml || directionsHtml) : '';
        const actionCount = [callHtml, websiteHtml || directionsHtml].filter(Boolean).length;
        const logoHtml = resource.resourceLogo
            ? `<div class="cat-org-logo"><img src="${this.escapeAttribute(resource.resourceLogo)}" alt="${this.escapeAttribute(titleEn)} logo" loading="lazy"></div>`
            : '';

        const badgesHtml = isCompact ? '' : this.getResourceBadgesHtml(resource);

        return `
            <article class="cat-org-card" style="--cat-accent:${config.color}">
                ${logoHtml}
                <div class="cat-org-main">
                    <div class="cat-org-title-row">
                        <h3 class="cat-org-name">${this.escapeHtml(titleEn)}</h3>
                        ${badgesHtml}
                    </div>
                    ${escapedDescription ? `<p class="cat-org-description">${escapedDescription}</p>` : ''}
                </div>
                ${!isCompact && address && !mapUrl ? `<p class="cat-org-address">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#758299" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    ${this.escapeHtml(address)}
                </p>` : ''}
                <div class="cat-org-actions ${actionCount === 1 || (websiteHtml && callHtml && !directionsHtml) ? 'cat-org-actions--stack' : ''}">
                    ${options.compact ? primaryActionHtml : `${callHtml}${websiteHtml || directionsHtml}`}
                </div>
            </article>
        `;
    }

    scrollElementBelowHeader(element, options = {}) {
        if (!element) {
            return;
        }

        const header = document.querySelector('header');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const gap = options.gap ?? 20;
        const top = window.scrollY + element.getBoundingClientRect().top - headerHeight - gap;

        scrollWindowTo(top, options.behavior);
    }

    getStoryBubbleResources(resources) {
        // Show one bubble per category (Immigration, Job Help, Housing, etc.) using category labels.
        // This keeps the header consistent instead of swapping "Immigration" for the first resource's title.
        const bubbles = [];

        STORY_BUBBLE_PREVIEW_CATEGORIES.forEach((category) => {
            const config = RESOURCE_CATEGORY_CONFIG[category];
            if (!config) {
                return;
            }

            bubbles.push({
                id: `bubble-${category}`,
                type: 'resource',
                title: config.labelEn,
                titleEn: config.labelEn,
                titleEs: config.labelEs,
                category: 'resource',
                resourceCategory: category,
                resourceIcon: config.icon,
                isPreviewBubble: true
            });
        });

        return bubbles;
    }

    createResourceStoryBubble(resource) {
        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const isPreviewBubble = resource.isPreviewBubble === true;
        const categoryKey = this.getResourceCategoryKey(resource);
        const url = this.getResourceUrl(resource);
        const description = resource.description ? this.formatRichTextInline(resource.description) : '';

        if (isPreviewBubble) {
            return `
                <button
                    type="button"
                    class="resource-story-bubble preview-story-bubble story-${categoryKey}"
                    data-resource-shortcut="${this.escapeAttribute(categoryKey)}"
                    title="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                    aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                >
                    <span class="resource-story-ring">
                        <span class="resource-story-icon" aria-hidden="true">
                            ${this.getResourceIconSvg(resource)}
                        </span>
                    </span>
                    <span class="resource-story-copy">
                        <strong>${this.escapeHtml(titleEn)}</strong>
                        <small>${this.escapeHtml(titleEs)}</small>
                    </span>
                </button>
            `;
        }

        const logo = resource.resourceLogo || '';
        const storyInnerHtml = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" class="resource-story-logo" loading="lazy">`
            : `<span class="resource-story-icon" aria-hidden="true">${this.getResourceIconSvg(resource)}</span>`;
        const ringClass = logo ? 'resource-story-ring resource-story-ring--logo' : 'resource-story-ring';

        return `
            <a
                class="resource-story-bubble story-${categoryKey}"
                href="${this.escapeAttribute(url)}"
                target="_blank"
                rel="noopener"
                title="${this.escapeAttribute(titleEn)}"
                aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
            >
                <span class="${ringClass}">
                    ${storyInnerHtml}
                </span>
                <span class="resource-story-copy">
                    <strong>${this.escapeHtml(titleEn)}</strong>
                    <small>${this.escapeHtml(titleEs)}</small>
                </span>
                ${description ? `<span class="sr-only">${description}</span>` : ''}
            </a>
        `;
    }

    createResourceCard(resource) {
        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const categoryKey = this.getResourceCategoryKey(resource);
        const categoryConfig = this.getResourceCategoryConfig(resource);
        const description = resource.description ? this.formatRichTextInline(resource.description) : '';
        const url = this.getResourceUrl(resource);
        const logo = resource.resourceLogo || '';

        // Parse highlights for quick-scan bullet points
        const highlights = this.parseResourceHighlights(resource.highlights);
        const highlightsHtml = highlights.length > 0
            ? `<span class="resource-card-highlights">
                ${highlights.map(h => `<span class="resource-card-highlight">${this.escapeHtml(h)}</span>`).join('')}
               </span>`
            : '';
        const iconContents = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" class="resource-card-logo" loading="lazy">`
            : this.getResourceIconSvg(resource);
        const iconClass = logo ? 'resource-card-icon resource-card-icon--logo' : 'resource-card-icon';

        return `
            <div class="resource-card-wrapper">
                <a
                    class="resource-card resource-card-${categoryKey}"
                    href="${this.escapeAttribute(url)}"
                    target="_blank"
                    rel="noopener"
                    aria-label="${this.escapeAttribute(`${titleEn} / ${titleEs}`)}"
                >
                    <span class="${iconClass}" aria-hidden="true">
                        ${iconContents}
                    </span>
                    <span class="resource-card-body">
                        <span class="resource-card-category">
                            <span class="resource-card-category-pill">${this.escapeHtml(categoryConfig.labelEn)}</span>
                            <span class="resource-card-category-pill">${this.escapeHtml(categoryConfig.labelEs)}</span>
                        </span>
                        <span class="resource-card-title">${this.escapeHtml(titleEn)}</span>
                        <span class="resource-card-subtitle">${this.escapeHtml(titleEs)}</span>
                        ${description ? `<span class="resource-card-description">${description}</span>` : ''}
                        ${highlightsHtml}
                    </span>
                    <span class="resource-card-link" aria-hidden="true">Open</span>
                </a>
                <button
                    type="button"
                    class="resource-copy-btn"
                    data-url="${this.escapeAttribute(url)}"
                    aria-label="Copy link"
                    title="Copy link"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    openResourceFromSheet(resourceId) {
        if (!resourceId) return;
        this.closeResourceDetailSheet();
        this.showBulletinDetail(resourceId);
    }

    createHelpResourceSheetRow(resource, categoryConfig) {
        const { titleEn } = this.getResourceTitles(resource);
        const config = categoryConfig || this.getResourceCategoryConfig(resource);
        const accent = config?.color || '#0a1d3a';
        const address = (resource.address || '').trim();
        const phone = (resource.phone || '').trim();
        const services = this.getResourceServices(resource);
        const chipsHtml = services.length
            ? this.getResourceServiceChipsHtml(resource, { max: 2 })
            : '';

        let meta = '';
        if (!services.length) {
            if (address) {
                meta = this.formatCompactAddress(address);
            } else if (phone) {
                meta = phone;
            } else {
                meta = this.getResourceSheetSubtitle(resource);
            }
        }

        const logo = resource.resourceLogo || '';
        const markHtml = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" loading="lazy">`
            : `<span class="help-sheet-row__icon-fallback" style="background:${accent}" aria-hidden="true">${this.getResourceIconSvg(resource)}</span>`;

        return `
            <article class="help-sheet-row" style="--cat-accent:${accent}" data-resource-id="${this.escapeAttribute(resource.id || '')}">
                <div class="help-sheet-row__mark">${markHtml}</div>
                <div class="help-sheet-row__copy">
                    <h3 class="help-sheet-row__title">${this.escapeHtml(titleEn)}</h3>
                    ${chipsHtml || (meta ? `<p class="help-sheet-row__meta">${this.escapeHtml(meta)}</p>` : '')}
                </div>
                <button type="button"
                        class="help-sheet-row__more"
                        data-resource-more="${this.escapeAttribute(resource.id || '')}"
                        aria-label="More info about ${this.escapeAttribute(titleEn)}">
                    <span class="en-text">More info</span>
                    <span class="es-text">Más info</span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </article>
        `;
    }

    createHelpResourceCard(resource, categoryConfig) {
        if (isDocumentResource(resource)) {
            return this.createDocumentResourceCard(resource, categoryConfig);
        }

        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const categoryKey = this.getResourceCategoryKey(resource);
        const config = categoryConfig || this.getResourceCategoryConfig(resource);
        const accent = config?.color || '#0a1d3a';

        const url = this.getResourceUrl(resource);
        const hasUrl = url && url !== '#';
        const phone = (resource.phone || '').trim();
        const tel = resource.tel || (phone ? `tel:${phone.replace(/[^0-9+]/g, '')}` : '');
        const address = (resource.address || '').trim();
        const mapUrl = resource.mapUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '');

        const logo = resource.resourceLogo || '';
        const logoTile = logo
            ? `<img src="${this.escapeAttribute(logo)}" alt="" loading="lazy" decoding="async" onload="window.applyResourceLogoTileLayout&&window.applyResourceLogoTileLayout(this)">`
            : `<span class="mobile-resource-card__icon-fallback" style="background:${accent}" aria-hidden="true">${this.getResourceIconSvg(resource)}</span>`;

        const postDescription = this.getPostDescription(resource);
        const servicesHtml = this.getResourceServiceChipsHtml(resource, { section: true });
        const hours = (resource.hours || '').trim();
        const hoursHtml = hours
            ? formatResourceHoursHtml(hours, (value) => this.escapeHtml(value))
            : '';

        const badgesHtml = this.getResourceBadgesHtml(resource);

        const isDesktopCard = window.matchMedia('(min-width: 768px)').matches;
        const phoneHtml = phone && isDesktopCard
            ? `<p class="mobile-resource-card__phone">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                    <span>${this.escapeHtml(phone)}</span>
                </p>`
            : '';

        const callBtn = phone && tel && !isDesktopCard
            ? `<a class="mobile-resource-card__btn mobile-resource-card__btn--primary"
                  href="${this.escapeAttribute(tel)}"
                  aria-label="Call ${this.escapeAttribute(titleEn)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.25 7.75c0 5.1 5.9 11 11 11h1.75a1 1 0 0 0 1-1v-3.2a1 1 0 0 0-.78-.98l-3.14-.7a1 1 0 0 0-.96.29l-.92.98a13.84 13.84 0 0 1-4.34-4.34l.98-.92a1 1 0 0 0 .29-.96l-.7-3.14A1 1 0 0 0 8.45 4H5.25a1 1 0 0 0-1 1v2.75Z"/></svg>
                    <span class="en-text">Call</span>
                    <span class="es-text">Llamar</span>
                </a>`
            : '';

        const websiteBtn = hasUrl
            ? `<a class="mobile-resource-card__btn mobile-resource-card__btn--secondary"
                  href="${this.escapeAttribute(url)}"
                  target="_blank"
                  rel="noopener"
                  aria-label="Open ${this.escapeAttribute(titleEn)} website">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                    <span class="en-text">Website</span>
                    <span class="es-text">Sitio</span>
                </a>`
            : '';

        const directionsBtn = mapUrl
            ? `<a class="mobile-resource-card__btn mobile-resource-card__btn--secondary mobile-resource-card__btn--directions"
                  href="${this.escapeAttribute(mapUrl)}"
                  target="_blank"
                  rel="noopener"
                  aria-label="Get directions to ${this.escapeAttribute(titleEn)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    <span class="en-text">Directions</span>
                    <span class="es-text">Cómo llegar</span>
                </a>`
            : '';

        const actionButtons = [callBtn, websiteBtn, directionsBtn].filter(Boolean);
        const actionsModifier = actionButtons.length === 1
            ? ' mobile-resource-card__actions--single'
            : actionButtons.length >= 3
                ? ' mobile-resource-card__actions--triple'
                : '';
        const actionsHtml = actionButtons.length
            ? `<div class="mobile-resource-card__actions${actionsModifier}">${actionButtons.join('')}</div>`
            : '';
        const actionLinksHtml = this.getResourceActionLinksHtml(resource, categoryKey, titleEn);

        const showAddressLine = address && !(isDesktopCard && mapUrl);
        const addressHtml = showAddressLine
            ? `<p class="mobile-resource-card__address">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s6.25-5.9 6.25-11.1a6.25 6.25 0 1 0-12.5 0C5.75 15.1 12 21 12 21Z"/><circle cx="12" cy="9.75" r="2.5"/></svg>
                    ${this.escapeHtml(address)}
                </p>`
            : '';

        const shareTitle = this.escapeHtml(titleEn).replace(/'/g, '&#39;');

        return `
            <article class="mobile-resource-card mobile-resource-card--${categoryKey}"
                     style="--cat-accent:${accent}"
                     data-resource-id="${this.escapeAttribute(resource.id || '')}">
                <button type="button"
                        class="mobile-resource-card__share"
                        onclick="shareBulletin('${resource.id || ''}','${shareTitle}')"
                        aria-label="Share ${this.escapeAttribute(titleEn)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                </button>
                <div class="mobile-resource-card__logo-tile">${logoTile}</div>
                <div class="mobile-resource-card__body">
                    <div class="mobile-resource-card__heading">
                        <div class="mobile-resource-card__title-row">
                            <h3 class="mobile-resource-card__title">${this.escapeHtml(titleEn)}</h3>
                            ${badgesHtml}
                        </div>
                        ${titleEs && titleEs !== titleEn ? `<p class="mobile-resource-card__subtitle">${this.escapeHtml(titleEs)}</p>` : ''}
                    </div>
                    ${this.getResourceCardSummaryHtml(resource)}
                    ${servicesHtml}
                    ${addressHtml}
                    ${hoursHtml}
                    ${phoneHtml}
                    ${actionsHtml}
                    ${actionLinksHtml}
                </div>
            </article>
        `;
    }

    createDocumentResourceCard(resource, categoryConfig) {
        const { titleEn, titleEs } = this.getResourceTitles(resource);
        const categoryKey = this.getResourceCategoryKey(resource);
        const config = categoryConfig || this.getResourceCategoryConfig(resource);
        const accent = config?.color || '#0a1d3a';

        const pdfUrl = (resource.pdfUrl || '').trim();
        const url = this.getResourceUrl(resource);
        const hasUrl = url && url !== '#';
        const formUrl = pdfUrl || (hasUrl ? url : '');

        const servicesHtml = this.getResourceServiceChipsHtml(resource, { section: true });
        const badgesHtml = this.getResourceBadgesHtml(resource);
        const actionLinksHtml = this.getResourceActionLinksHtml(resource, categoryKey, titleEn);

        const openFormBtn = formUrl
            ? (pdfUrl
                ? `<button type="button"
                        class="mobile-resource-card__btn mobile-resource-card__btn--primary"
                        aria-label="Open ${this.escapeAttribute(titleEn)} form"
                        onclick="window.bulletinBoard.openPdfFromBulletin('${this.escapeAttribute(resource.id || '')}')">
                    ${OPEN_FORM_ICON_SVG}
                    <span class="en-text">Open form</span>
                    <span class="es-text">Abrir formulario</span>
                </button>`
                : `<a class="mobile-resource-card__btn mobile-resource-card__btn--primary"
                      href="${this.escapeAttribute(formUrl)}"
                      target="_blank"
                      rel="noopener"
                      aria-label="Open ${this.escapeAttribute(titleEn)} form">
                    ${OPEN_FORM_ICON_SVG}
                    <span class="en-text">Open form</span>
                    <span class="es-text">Abrir formulario</span>
                </a>`)
            : '';

        const websiteBtn = pdfUrl && hasUrl
            ? `<a class="mobile-resource-card__btn mobile-resource-card__btn--secondary"
                  href="${this.escapeAttribute(url)}"
                  target="_blank"
                  rel="noopener"
                  aria-label="Open official source for ${this.escapeAttribute(titleEn)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>
                    <span class="en-text">Official source</span>
                    <span class="es-text">Fuente oficial</span>
                </a>`
            : '';

        const actionButtons = [openFormBtn, websiteBtn].filter(Boolean);
        const actionsModifier = actionButtons.length === 1 ? ' mobile-resource-card__actions--single' : '';
        const actionsHtml = actionButtons.length
            ? `<div class="mobile-resource-card__actions${actionsModifier}">${actionButtons.join('')}</div>`
            : '';

        const shareTitle = this.escapeHtml(titleEn).replace(/'/g, '&#39;');
        const logoTile = `<span class="mobile-resource-card__icon-fallback mobile-resource-card__icon-fallback--document" style="background:${accent}" aria-hidden="true">${DOCUMENT_TILE_ICON_SVG}</span>`;

        return `
            <article class="mobile-resource-card mobile-resource-card--document mobile-resource-card--${categoryKey}"
                     style="--cat-accent:${accent}"
                     data-resource-id="${this.escapeAttribute(resource.id || '')}">
                <button type="button"
                        class="mobile-resource-card__share"
                        onclick="shareBulletin('${resource.id || ''}','${shareTitle}')"
                        aria-label="Share ${this.escapeAttribute(titleEn)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4"/><path d="m15.4 6.5-6.8 4"/></svg>
                </button>
                <div class="mobile-resource-card__logo-tile mobile-resource-card__logo-tile--document">${logoTile}</div>
                <div class="mobile-resource-card__body">
                    <div class="mobile-resource-card__heading">
                        <div class="mobile-resource-card__title-row">
                            <h3 class="mobile-resource-card__title">${this.escapeHtml(titleEn)}</h3>
                            ${badgesHtml}
                        </div>
                        ${titleEs && titleEs !== titleEn ? `<p class="mobile-resource-card__subtitle">${this.escapeHtml(titleEs)}</p>` : ''}
                    </div>
                    ${this.getResourceCardSummaryHtml(resource)}
                    ${servicesHtml}
                    ${actionsHtml}
                    ${actionLinksHtml}
                </div>
            </article>
        `;
    }

    getResourceActionLinksHtml(resource, categoryKey, titleEn) {
        const links = normalizeResourceActionLinks(resource?.actionLinks);
        if (!links.length) return '';

        const buttons = links.map((link) => {
            const labelEn = this.escapeHtml(link.labelEn);
            const labelEs = this.escapeHtml(link.labelEs);
            const ariaLabel = this.escapeAttribute(`${link.labelEn} for ${titleEn}`);

            if (link.pdfUrl) {
                const pdfUrl = this.escapeAttribute(link.pdfUrl);
                return `
            <button type="button"
                    class="mobile-resource-card__btn mobile-resource-card__btn--secondary mobile-resource-card__btn--action-link"
                    aria-label="${ariaLabel}"
                    onclick="window.bulletinBoard.openResourcePdf('${pdfUrl}', { postId: '${this.escapeAttribute(resource.id || '')}', category: '${this.escapeAttribute(categoryKey)}' })">
                ${RESOURCE_ACTION_LINK_PDF_ICON_SVG}
                <span class="en-text">${labelEn}</span>
                <span class="es-text">${labelEs}</span>
            </button>`;
            }

            return `
            <a class="mobile-resource-card__btn mobile-resource-card__btn--secondary mobile-resource-card__btn--action-link"
               href="${this.escapeAttribute(link.url)}"
               target="_blank"
               rel="noopener"
               aria-label="${ariaLabel}">
                ${RESOURCE_ACTION_LINK_ICON_SVG}
                <span class="en-text">${labelEn}</span>
                <span class="es-text">${labelEs}</span>
            </a>`;
        }).join('');

        return `<div class="mobile-resource-card__action-links">${buttons}</div>`;
    }

    getResourceServices(resource, max = MAX_RESOURCE_SERVICE_CHIPS) {
        if (!resource) return [];
        const serviceChips = Array.isArray(resource.serviceChips) && resource.serviceChips.length
            ? resource.serviceChips
            : resource.services;
        if (Array.isArray(serviceChips) && serviceChips.length) {
            return serviceChips
                .map((item) => String(item || '').trim())
                .filter(Boolean)
                .slice(0, max);
        }
        return this.parseResourceHighlights(resource.highlights, max);
    }

    getResourceServiceChipsHtml(resource, options = {}) {
        const max = options.max ?? MAX_RESOURCE_SERVICE_CHIPS;
        const services = this.getResourceServices(resource, Number.POSITIVE_INFINITY);
        if (!services.length) return '';
        const displayServices = [];
        const seenLabels = new Set();
        services.forEach((service) => {
            if (displayServices.length >= max) return;
            const label = getActionResourceChipLabel(service);
            const key = label.toLowerCase();
            if (!label || seenLabels.has(key)) return;
            seenLabels.add(key);
            displayServices.push({ label, source: service });
        });
        if (!displayServices.length) return '';
        const chipsHtml = `<div class="resource-service-chips">${displayServices.map(({ label, source }) => {
            const en = this.escapeHtml(label);
            const es = this.escapeHtml(translateResourceChipEs(source));
            return `<span class="resource-service-chip"><span class="en-text">${en}</span><span class="es-text">${es}</span></span>`;
        }).join('')}</div>`;
        if (!options.section) {
            return chipsHtml;
        }
        return `<div class="resource-service-section">${chipsHtml}</div>`;
    }

    parseResourceHighlights(highlights, max = MAX_RESOURCE_SERVICE_CHIPS) {
        return parseResourceServiceChips(highlights, max);
    }

}
