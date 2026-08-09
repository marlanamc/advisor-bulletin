/**
 * Unified search results inside the search overlay.
 *
 * One query searches help resources and posts/events together and renders them
 * as two labelled groups — Help first, because that is what students most often
 * came for. Browsing is untouched: with an empty box the overlay shows the
 * topic buttons exactly as before, and the feed behind it is never filtered by
 * the search text.
 *
 * Results are rendered as plain buttons rather than reusing the feed/resource
 * card markup: a result row has to stay scannable at a glance, and the full
 * cards carry logos, chips and action links that would bury the answer.
 */

import { searchItems } from './search.js';
import { translateResourceChipEs } from './resource-chip-labels.js';
import { getCachedSnapshotItems } from './student-snapshot.js';

const RESULT_LIMIT_PER_GROUP = 12;
const DEBOUNCE_MS = 120;

/** Overlay box first — it is the one the other two mirror into. */
const SEARCH_INPUT_IDS = ['searchInput', 'desktopTopbarSearchInput', 'heroSearchInput'];

export class BoardSearchMethods {
    /** Wire every search box to the one unified result panel. */
    initUnifiedSearch() {
        SEARCH_INPUT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;

            input.addEventListener('input', (event) => {
                // The hero and topbar boxes sit outside the overlay, so typing
                // in them has to surface the panel rather than do nothing.
                if (id !== 'searchInput' && !this.isSearchLayerOpen && event.target.value.trim()) {
                    this.openSearchLayer({ focusInput: false });
                }
                this.searchQuery = event.target.value;
                this.syncSearchInputs(event.target);
                this.scheduleSearchRender();
            });

            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                this.renderUnifiedSearchResults();
                document.getElementById('searchResults')?.querySelector('.search-result')?.focus();
            });
        });

        ['searchBtn', 'desktopTopbarSearchBtn', 'heroSearchBtn'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => {
                if (!this.isSearchLayerOpen) this.openSearchLayer({ focusInput: false });
                this.renderUnifiedSearchResults();
            });
        });

        document.getElementById('searchResults')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-search-result-id]');
            if (button) this.openSearchResult(button.getAttribute('data-search-result-id'));
        });
    }

    /** Keep every search box showing the same text. */
    syncSearchInputs(source) {
        SEARCH_INPUT_IDS.forEach((id) => {
            const input = document.getElementById(id);
            if (input && input !== source && input.value !== this.searchQuery) {
                input.value = this.searchQuery;
            }
        });
    }

    scheduleSearchRender() {
        window.clearTimeout(this._searchRenderTimer);
        this._searchRenderTimer = window.setTimeout(() => this.renderUnifiedSearchResults(), DEBOUNCE_MS);
    }

    /** Clear the query and restore the browse state of the overlay. */
    clearUnifiedSearch() {
        this.searchQuery = '';
        ['searchInput', 'desktopTopbarSearchInput'].forEach((id) => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
        this.renderUnifiedSearchResults();
    }

    renderUnifiedSearchResults() {
        const container = document.getElementById('searchResults');
        const status = document.getElementById('searchResultsStatus');
        if (!container) return;

        const query = (this.searchQuery || '').trim();

        if (!query) {
            container.hidden = true;
            container.innerHTML = '';
            if (status) { status.hidden = true; status.textContent = ''; }
            this.syncHeaderSearchButton();
            return;
        }

        const { resources, posts, total } = searchItems(this.getSearchableItems(), query, {
            isResource: (item) => this.isResourceBulletin(item),
            limit: RESULT_LIMIT_PER_GROUP,
        });

        container.hidden = false;

        if (total === 0) {
            container.innerHTML = this.createSearchEmptyStateHtml(query);
        } else {
            container.innerHTML = [
                this.createSearchGroupHtml('help', resources),
                this.createSearchGroupHtml('posts', posts),
            ].join('');
        }

        if (status) {
            status.hidden = false;
            status.textContent = total === 0
                ? `No results for ${query}`
                : `${total} result${total === 1 ? '' : 's'} for ${query}`;
        }

        this.syncHeaderSearchButton();
    }

    /**
     * Everything searchable: published resources plus visible posts and events.
     *
     * Falls back to the cached snapshot while Firestore is still connecting.
     * The board renders snapshot-first, so without this a student who searches
     * in that window sees a full screen of posts behind an empty result panel.
     */
    getSearchableItems() {
        const live = Array.isArray(this.bulletins) ? this.bulletins : [];
        const all = live.length ? live : getCachedSnapshotItems();
        return all.filter((item) => (
            this.isResourceBulletin(item) ? item.isPublished !== false : true
        ));
    }

    createSearchGroupHtml(kind, items) {
        if (!items.length) return '';

        const label = kind === 'help'
            ? '<span class="en-text">Help</span><span class="es-text">Ayuda</span>'
            : '<span class="en-text">Posts &amp; events</span><span class="es-text">Publicaciones y eventos</span>';

        return `
            <section class="search-result-group" data-search-group="${kind}">
                <h4 class="search-result-group__title">${label} <span class="search-result-group__count">${items.length}</span></h4>
                <ul class="search-result-list">
                    ${items.map((item) => this.createSearchResultHtml(item, kind)).join('')}
                </ul>
            </section>
        `;
    }

    createSearchResultHtml(item, kind) {
        const titleEn = this.escapeHtml(item.titleEn || item.title || '');
        const titleEs = this.escapeHtml(item.resourceTitleEs || item.titleEs || item.titleEn || item.title || '');
        const meta = kind === 'help'
            ? this.createSearchResultChipsHtml(item)
            : this.createSearchResultPostMetaHtml(item);

        return `
            <li>
                <button type="button" class="search-result" data-search-result-id="${this.escapeAttribute(item.id)}">
                    <span class="search-result__title">
                        <span class="en-text">${titleEn}</span><span class="es-text">${titleEs}</span>
                    </span>
                    ${meta}
                </button>
            </li>
        `;
    }

    /** Up to three chips — the closest thing to a plain-language answer. */
    createSearchResultChipsHtml(resource) {
        const raw = resource.serviceChips || resource.services || resource.highlights || '';
        const chips = (Array.isArray(raw) ? raw : String(raw).split(','))
            .map((chip) => String(chip).trim())
            .filter(Boolean)
            .slice(0, 3);

        if (!chips.length) return '';

        return `<span class="search-result__meta">${chips.map((chip) => `
            <span class="search-result__chip">
                <span class="en-text">${this.escapeHtml(chip)}</span><span class="es-text">${this.escapeHtml(translateResourceChipEs(chip) || chip)}</span>
            </span>
        `).join('')}</span>`;
    }

    createSearchResultPostMetaHtml(post) {
        const bits = [];
        const when = post.eventDate || post.deadline || post.startDate;
        if (when) bits.push(this.escapeHtml(this.formatDateLocal ? this.formatDateLocal(when) : when));
        if (post.company) bits.push(this.escapeHtml(post.company));
        if (!bits.length) return '';
        return `<span class="search-result__meta"><span class="search-result__sub">${bits.join(' · ')}</span></span>`;
    }

    createSearchEmptyStateHtml(query) {
        const safe = this.escapeHtml(query);
        return `
            <div class="search-results-empty">
                <p class="search-results-empty__title">
                    <span class="en-text">Nothing found for “${safe}”</span>
                    <span class="es-text">No se encontró nada para “${safe}”</span>
                </p>
                <p class="search-results-empty__hint">
                    <span class="en-text">Try one word instead, like <strong>food</strong>, <strong>rent</strong>, or <strong>lawyer</strong>. Or pick a topic below.</span>
                    <span class="es-text">Pruebe una sola palabra, como <strong>comida</strong>, <strong>renta</strong> o <strong>abogado</strong>. O elija un tema abajo.</span>
                </p>
            </div>
        `;
    }

    /**
     * Open a result and get the overlay out of the way. Resources and posts
     * share the same detail modal, so one call covers both.
     */
    openSearchResult(id) {
        if (!id) return;
        this.closeSearchLayer();
        this.showBulletinDetail(id);
    }
}
