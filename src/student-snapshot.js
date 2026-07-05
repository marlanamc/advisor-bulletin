const SNAPSHOT_URL = '/student-feed-snapshot.json';
const SNAPSHOT_CACHE_KEY = 'ebhcs_student_feed_snapshot_v1';
const SNAPSHOT_FETCH_TIMEOUT_MS = 2400;
const SNAPSHOT_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

const CATEGORY_META = {
    job: { label: 'Job Help', labelEs: 'Ayuda con empleo', emoji: '💼', accent: '#24498f', tint: '#eaf0ff', grad: 'linear-gradient(145deg,#dbeafe 0%,#f8fafc 100%)' },
    training: { label: 'Training', labelEs: 'Capacitación', emoji: '📚', accent: '#8050d1', tint: '#f1eafe', grad: 'linear-gradient(145deg,#ede9fe 0%,#f8fafc 100%)' },
    immigration: { label: 'Immigration', labelEs: 'Inmigración', emoji: '🌎', accent: '#0d9488', tint: '#dff7f3', grad: 'linear-gradient(145deg,#ccfbf1 0%,#f8fafc 100%)' },
    housing: { label: 'Housing', labelEs: 'Vivienda', emoji: '🏠', accent: '#df6b4a', tint: '#fff0e8', grad: 'linear-gradient(145deg,#fed7aa 0%,#f8fafc 100%)' },
    health: { label: 'Health', labelEs: 'Salud', emoji: '❤️', accent: '#df477f', tint: '#fde7ef', grad: 'linear-gradient(145deg,#fbcfe8 0%,#f8fafc 100%)' },
    food: { label: 'Food', labelEs: 'Comida', emoji: '🍽️', accent: '#2f934f', tint: '#e8f7ed', grad: 'linear-gradient(145deg,#dcfce7 0%,#f8fafc 100%)' },
    esol: { label: 'English class', labelEs: 'Inglés', emoji: '🗣️', accent: '#2563eb', tint: '#eaf0ff', grad: 'linear-gradient(145deg,#dbeafe 0%,#f8fafc 100%)' },
    college: { label: 'College & GED', labelEs: 'Colegio', emoji: '🎓', accent: '#0a1d3a', tint: '#e7edf7', grad: 'linear-gradient(145deg,#dbeafe 0%,#f8fafc 100%)' },
    money: { label: 'Money help', labelEs: 'Dinero', emoji: '💵', accent: '#1fa77e', tint: '#e8fff6', grad: 'linear-gradient(145deg,#d1fae5 0%,#f8fafc 100%)' },
    'career-fair': { label: 'Career fair', labelEs: 'Feria', emoji: '🤝', accent: '#317dea', tint: '#eaf2ff', grad: 'linear-gradient(145deg,#bfdbfe 0%,#f8fafc 100%)' },
    announcement: { label: 'News', labelEs: 'Anuncios', emoji: '📣', accent: '#317dea', tint: '#eaf2ff', grad: 'linear-gradient(145deg,#dbeafe 0%,#f8fafc 100%)' },
};

function mark(name, detail) {
    try {
        performance.mark(name, detail ? { detail } : undefined);
    } catch {}
    window.__ebhcsPerf = window.__ebhcsPerf || [];
    window.__ebhcsPerf.push({ name, at: Math.round(performance.now()), detail });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

function isSnapshotFresh(snapshot) {
    const generatedAt = snapshot?.generatedAt;
    if (!generatedAt) return true;
    const age = Date.now() - Date.parse(generatedAt);
    return !Number.isNaN(age) && age <= SNAPSHOT_CACHE_TTL;
}

function readStoredSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY) || sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.items) || parsed.items.length === 0) return null;
        if (!isSnapshotFresh(parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeStoredSnapshot(snapshot) {
    if (!Array.isArray(snapshot?.items) || snapshot.items.length === 0) return;
    const payload = JSON.stringify(snapshot);
    try { localStorage.setItem(SNAPSHOT_CACHE_KEY, payload); } catch {}
    try { sessionStorage.setItem(SNAPSHOT_CACHE_KEY, payload); } catch {}
}

async function fetchSnapshot() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SNAPSHOT_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(SNAPSHOT_URL, {
            cache: 'force-cache',
            signal: controller.signal,
        });
        if (!response.ok) return null;
        const snapshot = await response.json();
        return Array.isArray(snapshot?.items) && snapshot.items.length ? snapshot : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function getTimestampValue(value) {
    if (!value) return 0;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day).getTime();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatPostedDate(value) {
    const timestamp = getTimestampValue(value);
    if (!timestamp) return 'Recently posted';
    return new Date(timestamp).toLocaleDateString();
}

function getTitle(item) {
    const isSpanish = document.body.getAttribute('data-lang') === 'ES';
    return (isSpanish && item.titleEs ? item.titleEs : item.title) || item.titleEn || 'Bulletin';
}

function getDescription(item) {
    const isSpanish = document.body.getAttribute('data-lang') === 'ES';
    const text = (isSpanish && item.summaryEs ? item.summaryEs : item.description) || '';
    return text.length > 150 ? `${text.slice(0, 149).trim()}...` : text;
}

function normalizeCategory(category) {
    const raw = String(category || 'announcement').trim().toLowerCase();
    if (raw === 'jobs') return 'job';
    if (raw === 'english' || raw === 'english class') return 'esol';
    return CATEGORY_META[raw] ? raw : 'announcement';
}

function getDateLabel(item) {
    const raw = item.eventDate || item.startDate || item.deadline || item.eventDates?.[0]?.date || '';
    const timestamp = getTimestampValue(raw);
    if (!timestamp) return '';
    const label = new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (item.deadline && !item.eventDate && !item.startDate) return `Deadline ${label}`;
    if (item.startDate) return `From ${label}`;
    return label;
}

function parseYmdLocal(value) {
    if (!value || typeof value !== 'string') return null;
    const datePart = value.split('T')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function isExpired(item) {
    const now = new Date();

    if (item.startDate && item.endDate) {
        const endDate = parseYmdLocal(item.endDate) || new Date(item.endDate);
        const endOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
        return endOfDay < now;
    }

    if (item.dateType === 'sessions' && Array.isArray(item.eventDates) && item.eventDates.length) {
        const lastSession = item.eventDates[item.eventDates.length - 1];
        const lastDate = parseYmdLocal(lastSession.date) || new Date(lastSession.date);
        const endTime = lastSession.endTime || item.endTime || '23:59';
        const [hours, minutes] = endTime.split(':').map(Number);
        const endMs = new Date(
            lastDate.getFullYear(),
            lastDate.getMonth(),
            lastDate.getDate(),
            Number.isFinite(hours) ? hours : 23,
            Number.isFinite(minutes) ? minutes : 59,
        ).getTime();
        return endMs > 0 && endMs < now.getTime();
    }

    if (item.eventDate && item.endTime) {
        const eventDateTime = new Date(`${String(item.eventDate).split('T')[0]}T${item.endTime}:00`);
        return eventDateTime < now;
    }

    if (item.eventDate) {
        const eventDate = parseYmdLocal(item.eventDate) || new Date(item.eventDate);
        const endOfDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate(), 23, 59, 59);
        return endOfDay < now;
    }

    if (item.deadline) {
        const deadlineDay = parseYmdLocal(item.deadline) || new Date(item.deadline);
        const endOfDay = new Date(deadlineDay.getFullYear(), deadlineDay.getMonth(), deadlineDay.getDate(), 23, 59, 59);
        return endOfDay < now;
    }

    return false;
}

function isCalendarOnly(item) {
    if (item.type === 'resource') return true;
    if (item.hideFromMainFeed === true) return true;
    const dt = item.dateType;
    if (dt !== 'event' && dt !== 'range' && dt !== 'sessions') return false;
    return item.category === 'announcement'
        && !item.description
        && !item.eventLink
        && !item.image
        && !item.pdfUrl;
}

function iconSvg() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 4 7v6c0 5.4 3.4 9.3 8 11 4.6-1.7 8-5.6 8-11V7l-8-4Zm0 3.1 5 2.5V13c0 3.5-2 6.2-5 7.7-3-1.5-5-4.2-5-7.7V8.6l5-2.5Z"/></svg>';
}

function createCard(item, index) {
    const category = normalizeCategory(item.category);
    const meta = CATEGORY_META[category] || CATEGORY_META.announcement;
    const title = getTitle(item);
    const titleShort = title.length > 40 ? `${title.slice(0, 38)}...` : title;
    const desc = getDescription(item);
    const image = document.body.getAttribute('data-lang') === 'ES' && item.imageEs ? item.imageEs : item.image;
    const dateLabel = getDateLabel(item);
    const imageAttributes = index < 3 ? 'decoding="async" fetchpriority="high"' : 'decoding="async" loading="lazy"';

    return `
    <article class="pc" id="bulletin-${escapeAttribute(item.id)}" data-bulletin-id="${escapeAttribute(item.id)}" role="button" tabindex="0" style="cursor:pointer">
      <div class="pc__chip-bar" style="--chip-accent:${meta.accent};--chip-tint:${meta.tint}">
        <div class="pc__chips" role="list" aria-label="Post labels">
          <span class="pc__chip pc__chip--category" role="listitem">
            <span class="pc__chip-emoji" aria-hidden="true">${meta.emoji}</span>
            <span class="en-text">${escapeHtml(meta.label.toUpperCase())}</span>
            <span class="es-text">${escapeHtml(meta.labelEs.toUpperCase())}</span>
          </span>
        </div>
      </div>
      <div class="pc__top ${image ? 'pc__top--image' : ''}" style="background:${image ? '#f8fafc' : meta.grad}">
        ${image
            ? `<div class="pc__image-stage"><img class="pc__poster-image" src="${escapeAttribute(image)}" alt="" ${imageAttributes}></div>`
            : `<div class="pc__icon-wrap"><div class="pc__icon-box" style="background:${meta.accent}">${iconSvg()}</div></div><div class="pc__title-overlay">${escapeHtml(titleShort)} -</div>`}
      </div>
      <div class="pc__body">
        <h3 class="pc__title">${escapeHtml(title)}</h3>
        <p class="pc__desc">${escapeHtml(desc)}</p>
        ${dateLabel ? `<div class="pc__date"><span>${escapeHtml(dateLabel)}</span></div>` : ''}
        <div class="pc__footer">
          <div class="pc__foot-left">
            <span class="pc__foot-name">${escapeHtml(item.advisorName || 'Advisor')} · ${escapeHtml(formatPostedDate(item.datePosted || item.createdAt))}</span>
          </div>
          <span class="pc__open-btn" style="color:${meta.accent}">Open -></span>
        </div>
      </div>
    </article>`;
}

function renderSnapshot(snapshot, source) {
    const grid = document.getElementById('bulletinGrid');
    const emptyState = document.getElementById('feedEmptyState');
    if (!grid || !Array.isArray(snapshot?.items) || snapshot.items.length === 0) {
        return false;
    }

    const posts = snapshot.items
        .filter((item) => item.type !== 'resource' && !isCalendarOnly(item) && !isExpired(item))
        .sort((a, b) => getTimestampValue(b.datePosted || b.createdAt) - getTimestampValue(a.datePosted || a.createdAt))
        .slice(0, 36);

    if (!posts.length) return false;

    if (emptyState) emptyState.style.display = 'none';
    grid.innerHTML = posts.map((item, index) => createCard(item, index)).join('');
    grid.setAttribute('data-snapshot-rendered', 'true');
    // Card click/keydown handling lives in feed-card-events.js, bound once in main.js.
    mark('ebhcs:snapshot-rendered', { source, count: posts.length });
    return true;
}

export async function renderStudentSnapshot() {
    mark('ebhcs:shell-loaded');

    const stored = readStoredSnapshot();
    if (stored && renderSnapshot(stored, 'storage')) {
        fetchSnapshot().then((fresh) => {
            if (fresh) {
                writeStoredSnapshot(fresh);
            }
        });
        return true;
    }

    const fresh = await fetchSnapshot();
    if (fresh) {
        writeStoredSnapshot(fresh);
        return renderSnapshot(fresh, 'network');
    }

    mark('ebhcs:snapshot-missed');
    return false;
}

export function recordStudentPerf(name, detail) {
    mark(name, detail);
}
