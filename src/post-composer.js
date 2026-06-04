import {
    getActionResourceChipLabel,
    getCanonicalResourceChipCatalog,
    getSuggestedResourceChips,
    MAX_RESOURCE_SERVICE_CHIPS,
    resolveResourceChipCategory,
} from './resource-chip-labels.js'
import { MAX_RESOURCE_ACTION_LINKS } from './resource-action-links.js'

/**
 * Streamlined Post Composer — UI layer for the new Create-a-Post experience.
 *
 * Owns: type tabs, sub-kind chooser, applyMode(), category popover,
 * "+Add detail" menu, block insertion/removal, help-chips widget,
 * upload previews, hydrateFromForm() for edit-prefill.
 *
 * Does NOT own: submission, Firestore writes, validation,
 * image-base64 encoding — all delegated to window.adminPanel
 * (firebase-admin.js / FirebaseAdminPanel).
 *
 * Data strategy: every visible composer input has a mirror hidden input
 * inside #bulletinForm with the real name= attribute that
 * handleBulletinSubmit / buildBulletinObject reads via FormData.
 */

// ── Category data (mirrors shared.js CATS for standalone use) ─────────────
const CATS = {
    job:           { em: '💼', chip: 'Job',           bg: '#e8f0fe', fg: '#1e4db7' },
    training:      { em: '📚', chip: 'Training',      bg: '#f0eeff', fg: '#7c3aed' },
    immigration:   { em: '🌎', chip: 'Immigration',   bg: '#e6f7f0', fg: '#059669' },
    housing:       { em: '🏠', chip: 'Housing',       bg: '#fff1ec', fg: '#c2410c' },
    health:        { em: '❤️', chip: 'Health',        bg: '#ffe9ee', fg: '#be123c' },
    food:          { em: '🍽️', chip: 'Food',          bg: '#fffbea', fg: '#b45309' },
    jobs:          { em: '💼', chip: 'Job Help',      bg: '#e8f0fe', fg: '#1e4db7' },
    family:        { em: '👨‍👩‍👧', chip: 'Family',   bg: '#fff7ed', fg: '#c2410c' },
    esol:          { em: '🗣️', chip: 'ESOL',          bg: '#e8f0fe', fg: '#1e4db7' },
    hse:           { em: '📚', chip: 'GED / HSE',      bg: '#f0eeff', fg: '#7c3aed' },
    college:       { em: '🎓', chip: 'College',       bg: '#f0eeff', fg: '#7c3aed' },
    money:         { em: '💵', chip: 'Money Help',    bg: '#e6f7f0', fg: '#059669' },
    'legal-aid':   { em: '⚖️', chip: 'Legal Help',    bg: '#eef2ff', fg: '#4338ca' },
    'career-fair': { em: '🤝', chip: 'Career Fair',   bg: '#fff1ec', fg: '#c2410c' },
    announcement:  { em: '📣', chip: 'Announcement',  bg: '#f0f4f9', fg: '#3d5a80' },
}
const PRIMARY_CATS = ['job', 'training', 'immigration', 'housing', 'health', 'announcement']

// ── Add-detail menu definitions ───────────────────────────────────────────
const BLOCK_DEFS = {
    spanish: {
        icon: '🌎', label: 'Spanish version', sub: 'Reach students who read in Spanish',
        title: 'Spanish version', rec: true,
        // html() receives mode so name= attributes adapt
        html(mode) {
            const isRes = mode === 'resource'
            return `
<div class="cx-field">
  <label class="cx-label">Spanish title</label>
  <input class="cx-input" data-cx-mirror="${isRes ? 'resourceTitleEs' : 'titleEs'}" placeholder="If blank, English is used">
</div>
<div class="cx-field">
  <label class="cx-label">Spanish summary <span class="cx-opt-tag">optional</span></label>
  <textarea class="cx-textarea" rows="2" data-cx-mirror="${isRes ? 'resourceSummaryEs' : 'summaryEs'}" placeholder="Paste a translation — you don't have to write it yourself"></textarea>
</div>`
        },
    },
    dates: {
        icon: '📅', label: 'Dates & times', sub: 'Deadline, date range, or sessions', title: 'Dates & times',
        html() {
            return `
<div class="cx-row2">
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label">What kind of date?</label>
    <select class="cx-select" id="cxBlkDateType" data-cx-mirror="dateType">
      <option value="">No specific date</option>
      <option value="deadline">Application deadline</option>
      <option value="event">Event date</option>
      <option value="range">Date range</option>
      <option value="sessions">Multiple sessions</option>
    </select>
  </div>
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label" id="cxBlkDateLabel">Date</label>
    <input type="date" class="cx-input" id="cxBlkDate" data-cx-mirror="eventDate">
  </div>
</div>
<div class="cx-field cx-hidden" id="cxBlkEndWrap" style="margin-top:10px;margin-bottom:0">
  <label class="cx-label">End date</label>
  <input type="date" class="cx-input" id="cxBlkEnd">
</div>
<div class="cx-row2" style="margin-top:10px">
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label">Start time <span class="cx-opt-tag">optional</span></label>
    <input type="time" class="cx-input" id="cxBlkStart" data-cx-mirror="startTime">
  </div>
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label">End time <span class="cx-opt-tag">optional</span></label>
    <input type="time" class="cx-input" id="cxBlkEndTime" data-cx-mirror="endTime">
  </div>
</div>
<div class="cx-hidden" id="cxBlkSessionsWrap" style="margin-top:12px">
  <div id="cxBlkSessionsList"></div>
  <button type="button" class="cx-evmore-add" id="cxBlkAddSession">+ Add another session date</button>
</div>`
        },
    },
    link: {
        icon: '🔗', label: 'Sign-up link', sub: 'Registration or info page', title: 'Sign-up link',
        html() {
            return `<input type="url" class="cx-input" data-cx-mirror="eventLink" placeholder="https://…">`
        },
    },
    contact: {
        icon: '📞', label: 'Contact & location', sub: 'Org, address, phone', title: 'Contact & location',
        html() {
            return `
<div class="cx-field">
  <label class="cx-label">Organization / company</label>
  <input class="cx-input" data-cx-mirror="company" placeholder="e.g. Boston Career Institute">
</div>
<div class="cx-row2">
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label">Address</label>
    <input class="cx-input" data-cx-mirror="eventLocation" placeholder="Street, city">
  </div>
  <div class="cx-field" style="margin-bottom:0">
    <label class="cx-label">Phone</label>
    <input type="tel" class="cx-input" data-cx-mirror="contactPhone" placeholder="(617) 555-0123">
  </div>
</div>
<div style="display:flex;gap:16px;font-size:.82rem;color:var(--ap-text-2);margin-top:10px">
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxContactPhoneMode" value="call" checked data-cx-mirror="contactPhoneMode"> Call</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxContactPhoneMode" value="text"> Text</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxContactPhoneMode" value="both"> Both</label>
</div>`
        },
    },
    audience: {
        icon: '🎯', label: "Who it's for", sub: 'Target a class group', title: "Who it's for",
        html() {
            return `
<select class="cx-select" data-cx-mirror="classType">
  <option value="">All students (default)</option>
  <option value="esol">ESOL</option>
  <option value="hse">HSE</option>
  <option value="famlit">FamLit</option>
</select>`
        },
    },
    // ── Resource-specific blocks (Phases 3–4) ──────────────────────────────
    weblink: {
        icon: '🔗', label: 'Website link', sub: 'The page students open', title: 'Website link',
        html() {
            return `<input type="url" class="cx-input" data-cx-mirror="resourceUrl" placeholder="https://…">`
        },
    },
    phone: {
        icon: '📞', label: 'Phone number', sub: 'Call or text', title: 'Phone number',
        html() {
            return `
<input type="tel" class="cx-input" data-cx-mirror="resourcePhone" placeholder="(617) 555-0123" style="margin-bottom:10px">
<div style="display:flex;gap:16px;font-size:.82rem;color:var(--ap-text-2)">
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxResPhoneMode" value="call" checked data-cx-mirror="resourcePhoneMode"> Call</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxResPhoneMode" value="text"> Text</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="radio" name="cxResPhoneMode" value="both"> Both</label>
</div>`
        },
    },
    address: {
        icon: '📍', label: 'Address', sub: 'Where students go', title: 'Address',
        html() {
            return `<input class="cx-input" data-cx-mirror="resourceAddress" placeholder="Street, city">`
        },
    },
    hours: {
        icon: '🕒', label: 'Hours', sub: "When they're open", title: 'Hours of operation',
        html() {
            return `<input class="cx-input" data-cx-mirror="resourceHours" placeholder="e.g. Mon–Fri 9am–5pm">`
        },
    },
    extras: {
        icon: '➕',
        label: 'Extra button',
        sub: 'A link or PDF on the card (up to 5 buttons)',
        title: 'Extra action button',
        html(slot = 1) {
            return `
<p class="cx-help" style="margin:0 0 10px">Adds a button to the card — point it at a page <em>or</em> attach a PDF.</p>
<input class="cx-input" data-cx-mirror="resourceActionLink${slot}LabelEn" placeholder="Button label (e.g. Steps to apply)" style="margin-bottom:10px">
<div class="cx-seg" data-cx-toggle-pdf style="margin-bottom:10px">
  <label class="on"><input type="radio" name="cxExtKind${slot}" value="url" checked> 🔗 Link</label>
  <label><input type="radio" name="cxExtKind${slot}" value="pdf"> 📄 PDF</label>
</div>
<div class="ex-link"><input type="url" class="cx-input" data-cx-mirror="resourceActionLink${slot}Url" placeholder="https://…"></div>
<div class="ex-pdf cx-hidden" style="display:flex;align-items:center;gap:10px">
  <button type="button" class="cx-flyerbtn ex-pdf-btn" style="background:var(--ap-surface-2);border:1.5px solid var(--ap-border);color:var(--ap-text-2)">Choose PDF</button>
  <input type="file" accept=".pdf,application/pdf" name="resourceActionLink${slot}Pdf" hidden>
  <span class="ex-pdf-name" style="font-size:.8rem;color:var(--ap-text-3)"></span>
</div>`
        },
    },
    // ── Calendar Event blocks (Phase 3) ────────────────────────────────────
    format: {
        icon: '📍', label: 'Format & location', sub: 'In-person, online, or hybrid', title: 'Format & location',
        html() {
            return `
<div class="cx-field">
  <label class="cx-label">Format</label>
  <select class="cx-select" data-cx-mirror="eventFormat">
    <option value="">Select format</option>
    <option value="in-person">In-person</option>
    <option value="online">Online</option>
    <option value="hybrid">Hybrid</option>
  </select>
</div>
<div class="cx-field" style="margin-bottom:0">
  <label class="cx-label">Location or meeting link</label>
  <input class="cx-input" data-cx-mirror="eventLocation" placeholder="Address or online link">
</div>`
        },
    },
}

// Mode → ordered add-detail menu items (spanish always first + Recommended)
const MODE_MENUS = {
    bulletin:     ['spanish', 'dates', 'link', 'contact', 'audience'],
    event:        ['spanish', 'format', 'link', 'audience'],
    organization: ['spanish', 'weblink', 'phone', 'address', 'hours', 'extras'],
    document:     ['spanish', 'weblink', 'extras'],
}

// Fallback when no category is selected yet
const GENERIC_CHIP_PRESETS = [
    'Get housing help', 'Apply for SNAP', 'Find a job', 'Talk to a lawyer',
    'Get health care', 'Find legal help', 'Take English classes', 'Get groceries',
]

const CHIP_CATALOG = getCanonicalResourceChipCatalog()

const CHIP_BUCKET_LABELS = {
    food: 'Food',
    housing: 'Housing',
    'legal-aid': 'Legal Help',
    immigration: 'Immigration',
    jobs: 'Job Help',
    college: 'College',
    family: 'Family',
    health: 'Health',
    money: 'Money Help',
    esol: 'ESOL',
    hse: 'HSE',
}

// ── State ──────────────────────────────────────────────────────────────────
let state = {
    type: 'bulletin',   // bulletin | resource | event
    resKind: 'organization', // organization | document
    category: null,
    helpTags: [],
    insertedBlocks: [],  // keys of currently-inserted optional blocks
}

// ── Helpers ────────────────────────────────────────────────────────────────
function qs(sel, root = document) { return root.querySelector(sel) }
function isComposerActive() {
    return !!document.getElementById('apCxCol')
}

function extrasBlockKey(slot) {
    return `extras-${slot}`
}

function parseExtrasBlockKey(blockKey) {
    const match = String(blockKey || '').match(/^extras-(\d+)$/)
    return match ? Number(match[1]) : null
}

function getUsedActionLinkSlots() {
    return state.insertedBlocks
        .map(parseExtrasBlockKey)
        .filter((slot) => Number.isInteger(slot) && slot >= 1)
        .sort((a, b) => a - b)
}

function getNextActionLinkSlot() {
    const used = new Set(getUsedActionLinkSlots())
    for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
        if (!used.has(slot)) return slot
    }
    return null
}

function clearActionLinkSlotMirrors(slot) {
    mirror(`resourceActionLink${slot}LabelEn`, '')
    mirror(`resourceActionLink${slot}LabelEs`, '')
    mirror(`resourceActionLink${slot}Url`, '')
    mirror(`resourceActionLink${slot}Type`, '')
    mirror(`resourceActionLink${slot}ExistingPdfUrl`, '')
    const pdfInput = document.querySelector(`#bulletinForm [name="resourceActionLink${slot}Pdf"]`)
    if (pdfInput) pdfInput.value = ''
}

function syncExtrasMenuState() {
    const menuItem = document.querySelector('[data-mi-key="extras"]')
    if (!menuItem) return
    const usedCount = getUsedActionLinkSlots().length
    const remaining = MAX_RESOURCE_ACTION_LINKS - usedCount
    menuItem.classList.toggle('used', remaining <= 0)
    menuItem.disabled = remaining <= 0
    const sub = menuItem.querySelector('span span')
    if (sub) {
        sub.textContent = remaining <= 0
            ? 'Maximum of 5 buttons reached'
            : remaining === MAX_RESOURCE_ACTION_LINKS
                ? BLOCK_DEFS.extras.sub
                : `${remaining} more button${remaining === 1 ? '' : 's'} available`
    }
}

function wireExtrasBlock(block, slot) {
    const seg = block.querySelector('[data-cx-toggle-pdf]')
    if (!seg) return

    const exLink = block.querySelector('.ex-link')
    const exPdf = block.querySelector('.ex-pdf')
    const pdfBtn = block.querySelector('.ex-pdf-btn')
    const pdfIn = block.querySelector('.ex-pdf input[type=file]')
    const pdfName = block.querySelector('.ex-pdf-name')

    seg.querySelectorAll('input[type=radio]').forEach((r) => {
        r.addEventListener('change', () => {
            const isPdf = r.value === 'pdf' && r.checked
            seg.querySelectorAll('label').forEach((l) => l.classList.toggle('on', l.querySelector('input')?.checked))
            exLink?.classList.toggle('cx-hidden', isPdf)
            exPdf?.classList.toggle('cx-hidden', !isPdf)
            if (r.checked) mirror(`resourceActionLink${slot}Type`, r.value)
        })
    })
    if (pdfBtn && pdfIn) {
        pdfBtn.addEventListener('click', () => pdfIn.click())
        pdfIn.addEventListener('change', () => {
            if (pdfIn.files[0] && pdfName) pdfName.textContent = pdfIn.files[0].name
        })
    }
    if (!getMirrorValue(`resourceActionLink${slot}Type`)) {
        mirror(`resourceActionLink${slot}Type`, 'url')
    }
}

function restoreExtrasBlockUi(block, slot) {
    const linkType = getMirrorValue(`resourceActionLink${slot}Type`)
        || (getMirrorValue(`resourceActionLink${slot}ExistingPdfUrl`) ? 'pdf' : 'url')
    const typeRadio = block.querySelector(`input[name="cxExtKind${slot}"][value="${linkType}"]`)
    if (typeRadio) {
        typeRadio.checked = true
        typeRadio.dispatchEvent(new Event('change'))
    }
    const existingPdf = getMirrorValue(`resourceActionLink${slot}ExistingPdfUrl`)
    if (existingPdf) {
        const pdfName = block.querySelector('.ex-pdf-name')
        if (pdfName) pdfName.textContent = 'Current PDF on file'
    }
}

/** Write a value into a named hidden input inside #bulletinForm */
function mirror(name, value) {
    const form = document.getElementById('bulletinForm')
    if (!form) return
    let inp = form.querySelector(`input[type="hidden"][name="${name}"]`)
        || form.querySelector(`[name="${name}"]:not([data-cx-mirror])`)
    if (!inp) {
        inp = document.createElement('input')
        inp.type = 'hidden'
        inp.name = name
        inp.id = `_cx_mirror_${name}`
        form.appendChild(inp)
    }
    inp.value = value ?? ''
}

/** Public API — populate mirror fields from firebase-admin edit flow */
export function setFormMirror(name, value) {
    mirror(name, value)
}

function ensureMetaFields() {
    const form = document.getElementById('bulletinForm')
    if (!form) return

    if (!form.querySelector('[name="resourcePublished"]')) {
        const pub = document.createElement('input')
        pub.type = 'hidden'
        pub.name = 'resourcePublished'
        pub.id = 'resourcePublished'
        pub.value = 'on'
        form.appendChild(pub)
    }
    if (!form.querySelector('[name="resourceOrder"]')) {
        const order = document.createElement('input')
        order.type = 'hidden'
        order.name = 'resourceOrder'
        order.id = 'resourceOrder'
        form.appendChild(order)
    }
}

/** Switch composer type without clearing blocks (edit-prefill) */
export function selectComposerType(type, options = {}) {
    state.type = type
    if (type === 'resource' && options.resourceKind) {
        state.resKind = options.resourceKind
        mirror('resourceKind', options.resourceKind)
        document.querySelectorAll('[data-cx-reskind]').forEach(b => {
            b.classList.toggle('sel', b.getAttribute('data-cx-reskind') === options.resourceKind)
        })
    }
    if (type === 'resource' && options.resourceHighlights) {
        state.helpTags = String(options.resourceHighlights)
            .split(',')
            .map(s => getActionResourceChipLabel(s.trim()))
            .filter(Boolean)
        mirror('resourceHighlights', state.helpTags.join(', '))
    } else if (type !== 'resource') {
        state.resKind = 'organization'
        state.helpTags = []
        mirror('resourceKind', 'organization')
        mirror('resourceHighlights', '')
        document.querySelectorAll('[data-cx-reskind]').forEach(b => {
            b.classList.toggle('sel', b.getAttribute('data-cx-reskind') === 'organization')
        })
    }
    document.querySelectorAll('[data-cx-type]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-cx-type') === type)
    })
    applyMode({ syncPreview: options.syncPreview !== false })
    if (type === 'resource' && options.resourceHighlights) {
        renderHelpTags()
    }
}

export function resetComposer() {
    state.type = 'bulletin'
    state.resKind = 'organization'
    state.category = null
    state.helpTags = []
    state.insertedBlocks = []

    document.querySelectorAll('[data-cx-type]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-cx-type') === 'bulletin')
    })
    document.querySelectorAll('[data-cx-reskind]').forEach(b => {
        b.classList.toggle('sel', b.getAttribute('data-cx-reskind') === 'organization')
    })

    const titleInp = document.getElementById('cxTitle')
    const descInp = document.getElementById('cxDesc')
    if (titleInp) titleInp.value = ''
    if (descInp) descInp.value = ''

    resetCategoryPill()
    clearAllBlocks({ clearActionLinkMirrors: true })
    renderHelpTags()

    mirror('contentType', 'post')
    mirror('resourceKind', 'organization')
    mirror('title', '')
    mirror('description', '')
    mirror('resourceTitleEn', '')
    mirror('resourceDescription', '')
    mirror('resourceHighlights', '')
    setFormMirror('resourcePublished', 'on')
    setFormMirror('resourceOrder', '')

    clearResourceLogoPreview()
    applyMode()
    syncPreview()
}

function clearResourceLogoPreview() {
    if (typeof window.clearResourceLogoPreviewSrc === 'function') {
        window.clearResourceLogoPreviewSrc()
    } else {
        if (window.__resourceLogoBlobUrl) URL.revokeObjectURL(window.__resourceLogoBlobUrl)
        window.__resourceLogoBlobUrl = ''
        window.__resourceLogoPreviewSrc = ''
    }
    const hero = document.getElementById('cxResourceHero')
    if (hero) hero.classList.remove('has-logo')
}

/** Sync all data-cx-mirror inputs in a block (or the whole composer) into hidden mirrors */
function getMirrorValue(name) {
    const form = document.getElementById('bulletinForm')
    if (!form) return ''
    const el = form.querySelector(`input[type="hidden"][name="${name}"]`)
        || form.querySelector(`[name="${name}"]:not([data-cx-mirror])`)
    return el?.value ?? ''
}

/** Copy existing hidden mirror values into a newly inserted block before syncMirrors runs */
function prefillBlockFromMirrors(block) {
    if (!block) return
    block.querySelectorAll('[data-cx-mirror]').forEach(el => {
        const name = el.getAttribute('data-cx-mirror')
        const val = getMirrorValue(name)
        if (!val) return
        if (el.type === 'radio') {
            el.checked = el.value === val
        } else {
            el.value = val
        }
    })

    const extrasSlot = Number(block.dataset.cxActionLinkSlot)
    if (extrasSlot) restoreExtrasBlockUi(block, extrasSlot)
}

function syncMirrors(root = document.getElementById('apCxCol')) {
    if (!root) return
    root.querySelectorAll('[data-cx-mirror]').forEach(el => {
        const name = el.getAttribute('data-cx-mirror')
        if (!name) return
        if (el.type === 'radio') {
            if (el.checked) mirror(name, el.value)
        } else {
            mirror(name, el.value ?? '')
        }
    })
}

/** Trigger the existing student preview sync */
function syncPreview() {
    if (typeof window.syncAdminStudentPreview === 'function') {
        window.syncAdminStudentPreview()
    }
}

// ── Category popover ──────────────────────────────────────────────────────
function positionFixedPopover(pop, anchor, gap = 6) {
    if (!pop || !anchor) return
    const margin = 12
    const r = anchor.getBoundingClientRect()
    let left = r.left
    let top = r.bottom + gap

    const wasOpen = pop.classList.contains('open')
    if (!wasOpen) {
        pop.style.visibility = 'hidden'
        pop.classList.add('open')
    }
    const pw = pop.offsetWidth || 320
    const ph = pop.offsetHeight || 140
    if (!wasOpen) {
        pop.classList.remove('open')
        pop.style.visibility = ''
    }

    if (left + pw > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - pw - margin)
    }
    if (top + ph > window.innerHeight - margin) {
        const above = r.top - ph - gap
        if (above >= margin) top = above
    }

    pop.style.left = `${Math.max(margin, left)}px`
    pop.style.top = `${Math.max(margin, top)}px`
}

function buildCatPopover() {
    const pop = document.getElementById('cxCatPop')
    const host = document.getElementById('cxCatPopCats')
    if (!pop || !host) return

    let showAll = false

    function render() {
        host.innerHTML = ''
        const keys = showAll ? Object.keys(CATS) : PRIMARY_CATS
        keys.forEach(k => {
            const c = CATS[k]
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'cx-cat'
            btn.dataset.cat = k
            if (state.category === k) {
                btn.classList.add('sel')
                btn.style.color = c.fg
                btn.style.background = c.bg
            }
            btn.innerHTML = `<span class="cx-cat-em">${c.em}</span>${c.chip}`
            btn.addEventListener('click', () => pickCategory(k))
            host.appendChild(btn)
        })

        if (!showAll) {
            const more = document.createElement('button')
            more.type = 'button'
            more.className = 'cx-cat'
            more.style.cssText = 'color:var(--ap-blue);border-style:dashed'
            more.textContent = '+ More topics'
            more.addEventListener('click', () => { showAll = true; render() })
            host.appendChild(more)
        }
    }

    render()

    const catBtn = document.getElementById('cxCatBtn')
    if (catBtn && catBtn.dataset.cxCatPopBound !== '1') {
        catBtn.dataset.cxCatPopBound = '1'
        catBtn.addEventListener('click', e => {
            e.stopPropagation()
            if (!pop.classList.contains('open')) {
                positionFixedPopover(pop, catBtn)
            }
            pop.classList.toggle('open')
        })
    }

    if (!document.documentElement.dataset.cxCatPopDismissBound) {
        document.documentElement.dataset.cxCatPopDismissBound = '1'
        document.addEventListener('click', () => pop.classList.remove('open'))
        pop.addEventListener('click', e => e.stopPropagation())
    }
}

function pickCategory(key) {
    state.category = key
    const c = CATS[key]
    const catBtn = document.getElementById('cxCatBtn')
    const emEl   = document.getElementById('cxCatEm')
    const lblEl  = document.getElementById('cxCatLabel')
    if (emEl)  emEl.textContent  = c.em
    if (lblEl) lblEl.textContent = c.chip
    if (catBtn) {
        catBtn.classList.add('set')
        catBtn.style.color       = c.fg
        catBtn.style.borderColor = c.fg
        catBtn.style.background  = c.bg
    }
    mirror('category', key)
    if (state.type === 'resource') {
        mirror('resourceCategory', resolveResourceChipCategory(key) || key)
    }
    document.getElementById('cxCatPop')?.classList.remove('open')
    if (state.type === 'resource') renderChipPresets(key)
    syncPreview()
}

function resetCategoryPill() {
    state.category = null
    const catBtn = document.getElementById('cxCatBtn')
    const emEl   = document.getElementById('cxCatEm')
    const lblEl  = document.getElementById('cxCatLabel')
    if (emEl)  emEl.textContent  = '🏷️'
    if (lblEl) lblEl.textContent = 'Add a category'
    if (catBtn) {
        catBtn.classList.remove('set')
        catBtn.style.color = catBtn.style.borderColor = catBtn.style.background = ''
    }
    mirror('category', '')
    mirror('resourceCategory', '')
    if (state.type === 'resource') renderChipPresets(null)
    // Rebuild the popover to clear the sel state
    buildCatPopover()
}

// ── + Add detail menu ─────────────────────────────────────────────────────
function buildInsertMenu() {
    const menuEl = document.getElementById('cxInsertMenu')
    const blocksEl = document.getElementById('cxBlocks')
    if (!menuEl || !blocksEl) return

    const menuKey = state.type === 'resource'
        ? state.resKind
        : state.type

    const items = MODE_MENUS[menuKey] || MODE_MENUS.bulletin

    menuEl.innerHTML = ''
    items.forEach(key => {
        const def = BLOCK_DEFS[key]
        if (!def) return
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'cx-insert-item' + (def.rec ? ' rec' : '')
        btn.dataset.miKey = key
        if (key !== 'extras' && state.insertedBlocks.includes(key)) btn.classList.add('used')
        btn.innerHTML = `
<span class="mi">${def.icon}</span>
<span>
  <b>${def.label}${def.rec ? '<em class="cx-mi-rec">Recommended</em>' : ''}</b>
  <span>${def.sub}</span>
</span>`
        btn.addEventListener('click', () => { insertBlock(key); menuEl.classList.remove('open') })
        menuEl.appendChild(btn)
    })
    syncExtrasMenuState()
}

function insertBlock(key, options = {}) {
    const def = BLOCK_DEFS[key]
    if (!def) return

    let blockKey = key
    let actionLinkSlot = null
    if (key === 'extras') {
        actionLinkSlot = options.slot || getNextActionLinkSlot()
        if (!actionLinkSlot) return
        blockKey = extrasBlockKey(actionLinkSlot)
    }

    if (state.insertedBlocks.includes(blockKey)) return

    state.insertedBlocks.push(blockKey)

    const blocksEl = document.getElementById('cxBlocks')
    const block = document.createElement('div')
    block.className = 'cx-block'
    block.dataset.cxBlock = key
    if (actionLinkSlot) block.dataset.cxActionLinkSlot = String(actionLinkSlot)
    const htmlContent = typeof def.html === 'function'
        ? def.html(actionLinkSlot || state.type)
        : def.html
    const blockTitle = actionLinkSlot && actionLinkSlot > 1
        ? `${def.title} ${actionLinkSlot}`
        : def.title
    block.innerHTML = `
<div class="cx-block-head">
  <b><span>${def.icon}</span> ${blockTitle}</b>
  <button type="button" class="cx-block-x" title="Remove">×</button>
</div>
${htmlContent}`
    blocksEl.appendChild(block)

    // Wire remove button
    block.querySelector('.cx-block-x').addEventListener('click', () => removeBlock(blockKey, block))

    // Wire radio mirror (contactPhoneMode, resourcePhoneMode)
    block.querySelectorAll('input[type="radio"]').forEach(r => {
        r.addEventListener('change', () => syncMirrors())
    })

    if (key === 'extras' && actionLinkSlot) {
        wireExtrasBlock(block, actionLinkSlot)
    }

    // Wire all data-cx-mirror inputs in this block
    block.querySelectorAll('[data-cx-mirror]').forEach(el => {
        const ev = el.tagName === 'SELECT' ? 'change' : 'input'
        el.addEventListener(ev, () => { syncMirrors(); syncPreview() })
    })

    // Wire dates block date-type toggle (range / sessions / single)
    if (key === 'dates') {
        const dtSel     = block.querySelector('#cxBlkDateType')
        const dtLabel   = block.querySelector('#cxBlkDateLabel')
        const endWrap   = block.querySelector('#cxBlkEndWrap')
        const sesWrap   = block.querySelector('#cxBlkSessionsWrap')
        const sesList   = block.querySelector('#cxBlkSessionsList')
        const sesAddBtn = block.querySelector('#cxBlkAddSession')

        function ensureBlkSessions() {
            if (sesList && sesList.querySelectorAll('.cx-evmore-row').length === 0) {
                sesList.appendChild(buildSessionRow('', '', '', syncBlkDateMirrors))
                sesList.appendChild(buildSessionRow('', '', '', syncBlkDateMirrors))
            }
        }
        function updateBlkDateType() {
            const v = dtSel?.value || 'event'
            endWrap?.classList.toggle('cx-hidden', v !== 'range')
            sesWrap?.classList.toggle('cx-hidden', v !== 'sessions')
            if (dtLabel) dtLabel.textContent =
                v === 'deadline' ? 'Deadline date' :
                v === 'range'    ? 'Start date'    :
                v === 'sessions' ? 'First session'  : 'Date'
            if (v === 'sessions') ensureBlkSessions()
            syncBlkDateMirrors()
        }
        function syncBlkDateMirrors() {
            const v      = dtSel?.value || 'event'
            const dateV  = block.querySelector('#cxBlkDate')?.value || ''
            const endV   = block.querySelector('#cxBlkEnd')?.value || ''
            const startT = block.querySelector('#cxBlkStart')?.value || ''
            const endT   = block.querySelector('#cxBlkEndTime')?.value || ''
            const form   = document.getElementById('bulletinForm')
            if (!form) return

            // Clear previous session hidden inputs
            form.querySelectorAll('input[data-cx-session]').forEach(i => i.remove())

            if (v === 'sessions') {
                const rows = Array.from(sesList?.querySelectorAll('.cx-evmore-row') || [])
                const sessions = rows.map(r => {
                    const ins = r.querySelectorAll('input')
                    return { date: ins[0]?.value || '', startTime: ins[1]?.value || '', endTime: ins[2]?.value || '' }
                })
                sessions.forEach(s => {
                    const d = document.createElement('input'); d.type='hidden'; d.name='eventDates'; d.value=s.date; d.setAttribute('data-cx-session','1'); form.appendChild(d)
                    const st = document.createElement('input'); st.type='hidden'; st.name='eventSessionStartTimes'; st.value=s.startTime||''; st.setAttribute('data-cx-session','1'); form.appendChild(st)
                    const et = document.createElement('input'); et.type='hidden'; et.name='eventSessionEndTimes'; et.value=s.endTime||''; et.setAttribute('data-cx-session','1'); form.appendChild(et)
                })
                mirror('dateType', 'sessions')
                mirror('eventDate', sessions[0]?.date || '')
                mirror('startDate', ''); mirror('endDate', '')
                mirror('startTime', sessions[0]?.startTime || '')
                mirror('endTime', sessions[0]?.endTime || '')
            } else if (v === 'range') {
                mirror('dateType', 'range')
                mirror('startDate', dateV); mirror('endDate', endV)
                mirror('eventDate', dateV)
                mirror('startTime', startT); mirror('endTime', endT)
            } else if (v === 'deadline') {
                mirror('dateType', 'deadline')
                mirror('eventDate', dateV)
                mirror('startDate', ''); mirror('endDate', '')
                mirror('startTime', startT); mirror('endTime', endT)
            } else {
                mirror('dateType', v || '')
                mirror('eventDate', dateV)
                mirror('startDate', ''); mirror('endDate', '')
                mirror('startTime', startT); mirror('endTime', endT)
            }
            syncPreview()
        }

        if (dtSel) dtSel.addEventListener('change', updateBlkDateType)
        ;['cxBlkDate','cxBlkEnd','cxBlkStart','cxBlkEndTime'].forEach(id => {
            block.querySelector(`#${id}`)?.addEventListener('change', syncBlkDateMirrors)
        })
        if (sesAddBtn && sesList) {
            sesAddBtn.addEventListener('click', () => {
                sesList.appendChild(buildSessionRow('', '', '', syncBlkDateMirrors))
                syncBlkDateMirrors()
            })
        }
        // Store sync fn on the block so hydrateFromForm can reference it
        block._syncBlkDateMirrors = syncBlkDateMirrors
    }

    if (key === 'extras') {
        syncExtrasMenuState()
    } else {
        const menuItem = document.querySelector(`[data-mi-key="${key}"]`)
        if (menuItem) menuItem.classList.add('used')
    }

    prefillBlockFromMirrors(block)
    syncMirrors()
    syncPreview()
}

function removeBlock(key, blockEl) {
    blockEl.remove()
    state.insertedBlocks = state.insertedBlocks.filter(k => k !== key)
    clearBlockMirrors(key)
    if (parseExtrasBlockKey(key)) {
        syncExtrasMenuState()
    } else {
        const menuItem = document.querySelector(`[data-mi-key="${key}"]`)
        if (menuItem) menuItem.classList.remove('used')
    }
    syncPreview()
}

function clearBlockMirrors(key) {
    const mirrorNames = {
        spanish:  ['titleEs', 'summaryEs', 'resourceTitleEs', 'resourceSummaryEs'],
        dates:    ['dateType', 'eventDate', 'startTime', 'endTime'],
        link:     ['eventLink'],
        contact:  ['company', 'eventLocation', 'contactPhone', 'contactPhoneMode'],
        audience: ['classType'],
        weblink:  ['resourceUrl'],
        phone:    ['resourcePhone', 'resourcePhoneMode'],
        address:  ['resourceAddress'],
        hours:    ['resourceHours'],
        format:   ['eventFormat', 'eventLocation'],
    }
    const extrasSlot = parseExtrasBlockKey(key)
    if (extrasSlot) {
        clearActionLinkSlotMirrors(extrasSlot)
        return
    }
    const names = mirrorNames[key] || []
    names.forEach(n => mirror(n, ''))
}

function clearAllBlocks(options = {}) {
    const blocksEl = document.getElementById('cxBlocks')
    if (blocksEl) blocksEl.innerHTML = ''
    state.insertedBlocks = []
    if (options.clearActionLinkMirrors) {
        for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
            clearActionLinkSlotMirrors(slot)
        }
    }
    syncExtrasMenuState()
}

// ── applyMode(): reshapes hero, placeholders, menu ────────────────────────
function applyMode(options = {}) {
    const { type, resKind } = state
    const isResource = type === 'resource'
    const isEvent    = type === 'event'

    // Show/hide hero zones
    const bulletinHero  = document.getElementById('cxBulletinHero')
    const resourceHero  = document.getElementById('cxResourceHero')
    const eventWhen     = document.getElementById('cxEventWhen')
    const resKindBar    = document.getElementById('cxResKind')
    const chipsBlock    = document.getElementById('cxChipsBlock')

    if (bulletinHero) bulletinHero.classList.toggle('cx-hidden', isResource || isEvent)
    if (resourceHero) {
        resourceHero.classList.toggle('cx-hidden', !isResource)
        if (isResource) {
            const titleEl = resourceHero.querySelector('.cx-flyertitle')
            const subEl   = resourceHero.querySelector('.cx-flyersub')
            const btnEl   = resourceHero.querySelector('.cx-flyerbtn')
            if (resKind === 'document') {
                resourceHero.classList.remove('light')
                if (titleEl) titleEl.textContent = 'Drop the PDF or form'
                if (subEl)   subEl.textContent   = 'This file is the resource — students open it from the card'
                if (btnEl)   btnEl.textContent   = 'Choose PDF'
            } else {
                resourceHero.classList.add('light')
                if (titleEl) titleEl.textContent = 'Add a logo · optional'
                if (subEl)   subEl.textContent   = 'A square logo makes the place recognizable on the card'
                if (btnEl)   btnEl.textContent   = 'Choose image'
            }
        }
    }
    if (eventWhen)  eventWhen.classList.toggle('cx-hidden', !isEvent)
    if (resKindBar) resKindBar.classList.toggle('cx-hidden', !isResource)
    if (chipsBlock) chipsBlock.classList.toggle('cx-hidden', !isResource)
    if (isResource) renderChipPresets(state.category)

    // Placeholders
    const titleInp = document.getElementById('cxTitle')
    const descInp  = document.getElementById('cxDesc')
    if (isResource) {
        if (titleInp) titleInp.placeholder = resKind === 'document'
            ? 'Name of the document or form'
            : 'Name of the place or organization'
        if (descInp) descInp.placeholder = 'One-line summary students see on the card'
    } else if (isEvent) {
        if (titleInp) titleInp.placeholder = 'Event name — e.g. Parent–Teacher Night'
        if (descInp)  descInp.placeholder  = 'Any details students should know (optional)'
    } else {
        if (titleInp) titleInp.placeholder = 'Untitled post — type a title'
        if (descInp)  descInp.placeholder  = 'Write what it is, who it\'s for, and how to sign up…'
    }

    // Sync contentType hidden field so handleBulletinSubmit routes correctly
    mirror('contentType', isResource ? 'resource' : 'post')
    const form = document.getElementById('bulletinForm')
    if (form) {
        form.dataset.contentMode = isResource ? 'resource' : isEvent ? 'event' : 'post'
    }
    // Sync contentMode on adminPanel (used by validateRequiredCategorySelection etc.)
    if (window.adminPanel) {
        if (isResource) {
            window.adminPanel.setContentType('resource', { preserveFields: true, silent: true })
        } else if (isEvent) {
            window.adminPanel.setContentType('event', { preserveFields: true, silent: true })
        } else {
            window.adminPanel.setContentType('post', { preserveFields: true, silent: true })
        }
    }

    // Rebuild add-detail menu
    buildInsertMenu()

    if (options.syncPreview !== false) {
        syncPreview()
    }
}

// ── Type tabs ─────────────────────────────────────────────────────────────
function bindTypeTabs() {
    document.querySelectorAll('[data-cx-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cx-type]').forEach(b => b.classList.remove('active'))
            btn.classList.add('active')
            state.type = btn.getAttribute('data-cx-type')
            state.category = null
            resetCategoryPill()
            clearAllBlocks({ clearActionLinkMirrors: true })
            applyMode()
        })
    })
}

// ── Resource sub-kind chooser ─────────────────────────────────────────────
function bindResKindButtons() {
    document.querySelectorAll('[data-cx-reskind]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cx-reskind]').forEach(b => b.classList.remove('sel'))
            btn.classList.add('sel')
            state.resKind = btn.getAttribute('data-cx-reskind')
            mirror('resourceKind', state.resKind)
            clearAllBlocks({ clearActionLinkMirrors: true })
            applyMode()
        })
    })
}

// ── Core field mirrors (title, description) ───────────────────────────────
function bindCoreFields() {
    const titleInp = document.getElementById('cxTitle')
    const descInp  = document.getElementById('cxDesc')

    if (titleInp) {
        titleInp.addEventListener('input', () => {
            // bulletin/event → title; resource → resourceTitleEn
            if (state.type === 'resource') {
                mirror('resourceTitleEn', titleInp.value)
            } else {
                mirror('title', titleInp.value)
            }
            syncPreview()
        })
    }

    if (descInp) {
        descInp.addEventListener('input', () => {
            if (state.type === 'resource') {
                mirror('resourceDescription', descInp.value)
            } else {
                mirror('description', descInp.value)
            }
            syncPreview()
        })
    }
}

// ── Upload wiring ─────────────────────────────────────────────────────────
function bindUploads() {
    // Bulletin EN flyer → delegates to adminPanel.handleImagePreview via hidden #image input
    const enZone = document.querySelector('#cxBulletinHero [data-cx-upload="en"]')
    if (enZone) {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'; fileInput.accept = 'image/*,application/pdf'; fileInput.hidden = true
        fileInput.name = 'image'; fileInput.id = '_cxUploadEn'
        document.getElementById('bulletinForm')?.appendChild(fileInput)
        const btn = enZone.querySelector('.cx-flyerbtn')
        if (btn) btn.addEventListener('click', () => fileInput.click())
        fileInput.addEventListener('change', e => window.adminPanel?.handleImagePreview(e, 'image'))
    }

    // Bulletin ES flyer → hidden #imageEs input
    const esZone = document.querySelector('#cxBulletinHero [data-cx-upload="es"]')
    if (esZone) {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.hidden = true
        fileInput.name = 'imageEs'; fileInput.id = '_cxUploadEs'
        document.getElementById('bulletinForm')?.appendChild(fileInput)
        const btn = esZone.querySelector('.cx-flyerbtn')
        if (btn) btn.addEventListener('click', () => fileInput.click())
        fileInput.addEventListener('change', e => window.adminPanel?.handleImagePreview(e, 'imageEs'))
    }

    // Resource hero → logo (org) or PDF (doc)
    const resZone = document.getElementById('cxResourceHero')
    if (resZone) {
        const logoInput = document.createElement('input')
        logoInput.type = 'file'; logoInput.accept = 'image/*'; logoInput.hidden = true
        logoInput.name = 'resourceLogo'; logoInput.id = '_cxUploadLogo'
        document.getElementById('bulletinForm')?.appendChild(logoInput)

        const pdfInput = document.createElement('input')
        pdfInput.type = 'file'; pdfInput.accept = '.pdf,application/pdf'; pdfInput.hidden = true
        pdfInput.name = 'resourcePdf'; pdfInput.id = '_cxUploadResPdf'
        document.getElementById('bulletinForm')?.appendChild(pdfInput)

        const btn = resZone.querySelector('.cx-flyerbtn')
        if (btn) {
            btn.addEventListener('click', () => {
                if (state.resKind === 'document') pdfInput.click()
                else logoInput.click()
            })
        }
        logoInput.addEventListener('change', e => {
            const file = e.target.files?.[0]
            if (file && state.resKind !== 'document') {
                if (window.__resourceLogoBlobUrl) URL.revokeObjectURL(window.__resourceLogoBlobUrl)
                const blobUrl = URL.createObjectURL(file)
                if (typeof window.setResourceLogoPreviewSrc === 'function') {
                    window.setResourceLogoPreviewSrc(blobUrl)
                } else {
                    window.__resourceLogoBlobUrl = blobUrl
                    window.__resourceLogoPreviewSrc = blobUrl
                    window.syncAdminStudentPreview?.()
                }
            }
            window.adminPanel?.handleImagePreview(e, 'resourceLogo')
        })
        pdfInput.addEventListener('change',  e => window.adminPanel?.handleResourcePdfPreview(e))
    }
}

// ── Help chips (resource only) ────────────────────────────────────────────
function chipKey(label) {
    return String(label || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function hasHelpTag(label) {
    const key = chipKey(label)
    return state.helpTags.some((tag) => chipKey(tag) === key)
}

function getChipPresetLabels(categoryKey) {
    const suggested = getSuggestedResourceChips(categoryKey)
    return suggested.length ? suggested : GENERIC_CHIP_PRESETS
}

function updateChipSuggestLabel(categoryKey) {
    const labelEl = document.getElementById('cxChipSuggestLabel')
    if (!labelEl) return
    const resolved = resolveResourceChipCategory(categoryKey)
    const suggested = getSuggestedResourceChips(categoryKey)
    if (suggested.length && resolved) {
        const name = CATS[categoryKey]?.chip || CHIP_BUCKET_LABELS[resolved] || resolved.replace(/-/g, ' ')
        labelEl.textContent = `Suggested for ${name}`
    } else if (categoryKey) {
        labelEl.textContent = 'Suggestions'
    } else {
        labelEl.textContent = 'Popular actions'
    }
}

function renderChipPresets(categoryKey = state.category) {
    const presetWrap = document.getElementById('cxTagPresets')
    if (!presetWrap) return

    presetWrap.innerHTML = ''
    getChipPresetLabels(categoryKey).forEach((label) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'cx-tag-preset'
        btn.textContent = label
        btn.addEventListener('click', () => addHelpTag(label))
        presetWrap.appendChild(btn)
    })
    updateChipSuggestLabel(categoryKey)
    renderHelpTags()
}

function renderChipBrowseList(query = '') {
    const listEl = document.getElementById('cxChipBrowseList')
    if (!listEl) return

    const q = query.trim().toLowerCase()
    const matches = CHIP_CATALOG.filter((label) => {
        if (!q) return true
        return label.toLowerCase().includes(q)
    })

    listEl.innerHTML = ''
    if (!matches.length) {
        const empty = document.createElement('p')
        empty.className = 'cx-chip-browse-empty'
        empty.textContent = q ? 'No matching actions — type your own above' : 'No actions available'
        listEl.appendChild(empty)
        return
    }

    matches.forEach((label) => {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'cx-chip-browse-item'
        btn.setAttribute('role', 'option')
        btn.textContent = label
        btn.disabled = hasHelpTag(label) || state.helpTags.length >= MAX_RESOURCE_SERVICE_CHIPS
        btn.addEventListener('click', () => {
            addHelpTag(label)
            renderChipBrowseList(document.getElementById('cxChipBrowseSearch')?.value || '')
        })
        listEl.appendChild(btn)
    })
}

function closeChipBrowsePop() {
    const pop = document.getElementById('cxChipBrowsePop')
    if (!pop) return
    pop.classList.remove('open')
    pop.hidden = true
}

function openChipBrowsePop() {
    const pop = document.getElementById('cxChipBrowsePop')
    const btn = document.getElementById('cxChipBrowseBtn')
    const search = document.getElementById('cxChipBrowseSearch')
    if (!pop || !btn) return

    const r = btn.getBoundingClientRect()
    pop.style.left = `${Math.max(12, r.left)}px`
    pop.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 80)}px`
    pop.style.width = `${Math.min(360, window.innerWidth - 24)}px`
    pop.hidden = false
    pop.classList.add('open')
    if (search) {
        search.value = ''
        renderChipBrowseList('')
        requestAnimationFrame(() => search.focus())
    }
}

function buildChipBrowse() {
    const btn = document.getElementById('cxChipBrowseBtn')
    const pop = document.getElementById('cxChipBrowsePop')
    const search = document.getElementById('cxChipBrowseSearch')
    if (!btn || !pop || btn.dataset.cxChipBrowseBound === '1') return
    btn.dataset.cxChipBrowseBound = '1'

    btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (pop.classList.contains('open')) closeChipBrowsePop()
        else openChipBrowsePop()
    })

    search?.addEventListener('input', () => renderChipBrowseList(search.value))
    search?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            closeChipBrowsePop()
        }
    })

    document.addEventListener('click', (e) => {
        if (!pop.classList.contains('open')) return
        if (pop.contains(e.target) || btn.contains(e.target)) return
        closeChipBrowsePop()
    })
    pop.addEventListener('click', (e) => e.stopPropagation())
}

function renderHelpTags() {
    const tagWrap  = document.getElementById('cxTags')
    const tagInput = document.getElementById('cxTagInput')
    const presets  = document.getElementById('cxTagPresets')
    if (!tagWrap || !tagInput) return

    tagWrap.querySelectorAll('.cx-tag').forEach(n => n.remove())
    state.helpTags.forEach((tx, i) => {
        const pill = document.createElement('span')
        pill.className = 'cx-tag'
        pill.innerHTML = `${tx} <button type="button" title="Remove">×</button>`
        pill.querySelector('button').addEventListener('click', () => {
            state.helpTags.splice(i, 1)
            renderHelpTags()
        })
        tagWrap.insertBefore(pill, tagInput)
    })
    if (presets) {
        presets.querySelectorAll('.cx-tag-preset').forEach(p => {
            p.classList.toggle('used', hasHelpTag(p.textContent))
        })
    }
    tagInput.placeholder = state.helpTags.length >= MAX_RESOURCE_SERVICE_CHIPS
        ? 'Max 6 — remove one to add more'
        : 'Type an action and press Enter…'
    syncHelpTags()
}

function addHelpTag(tx) {
    const normalized = getActionResourceChipLabel((tx || '').trim().replace(/[,;]$/, ''))
    if (!normalized || state.helpTags.length >= MAX_RESOURCE_SERVICE_CHIPS || hasHelpTag(normalized)) return
    state.helpTags.push(normalized)
    renderHelpTags()
    renderChipBrowseList(document.getElementById('cxChipBrowseSearch')?.value || '')
}

function syncComposerBeforePreview() {
    syncMirrors()
    mirror('resourceHighlights', state.helpTags.join(', '))
}

export function getHelpTags() {
    return [...state.helpTags]
}

/** Preview mode for the student-view phone mockup */
export function getPreviewMode() {
    if (!isComposerActive()) return null
    if (state.type === 'resource') return 'resource'
    if (state.type === 'event') return 'event'
    return 'post'
}

function syncHelpTags() {
    syncComposerBeforePreview()
    syncPreview()
}

function bindHelpChips() {
    const tagInput = document.getElementById('cxTagInput')
    if (!tagInput) return
    tagInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addHelpTag(tagInput.value)
            tagInput.value = ''
        }
    })
}

// ── Add-detail dropdown open/close ────────────────────────────────────────
function bindInsertButton() {
    const btn  = document.getElementById('cxInsertBtn')
    const menu = document.getElementById('cxInsertMenu')
    if (!btn || !menu) return
    btn.addEventListener('click', (e) => {
        e.stopPropagation()
        menu.classList.add('open')
    })
    document.addEventListener('click', () => menu.classList.remove('open'))
    menu.addEventListener('click', e => e.stopPropagation())
}

// ── Submit button → triggers existing #bulletinForm submit ────────────────
function bindSubmitButton() {
    const cxBtn = document.getElementById('cxSubmitBtn')
    if (!cxBtn) return
    cxBtn.addEventListener('click', () => {
        // Mirror all visible composer inputs before submitting
        syncMirrors()
        // Delegate to adminPanel's handleBulletinSubmit via a form submit event
        const form = document.getElementById('bulletinForm')
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
    })
}

// ── hydrateFromForm(): called by loadEditBulletin before it populates values
// Inspects the hidden inputs that were just populated and inserts the
// appropriate optional blocks so edit-prefill values land in visible UI.
export function hydrateFromForm() {
    if (!isComposerActive()) return
    const form = document.getElementById('bulletinForm')
    if (!form) return

    const gv = name => (form.querySelector(`[name="${name}"]`)?.value || '').trim()

    // Determine and apply mode
    const adminMode = window.adminPanel?.contentMode
    const contentType = gv('contentType') === 'resource' || adminMode === 'resource'
        ? 'resource'
        : adminMode === 'event'
            ? 'event'
            : 'post'
    const resKind = gv('resourceKind') || 'organization'
    const restoredResourceHighlights = gv('resourceHighlights')
    if (contentType === 'resource') {
        state.type    = 'resource'
        state.resKind = resKind
        mirror('resourceKind', resKind)
        document.querySelectorAll('[data-cx-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-cx-type') === 'resource')
        })
        document.querySelectorAll('[data-cx-reskind]').forEach(b => {
            b.classList.toggle('sel', b.getAttribute('data-cx-reskind') === resKind)
        })
    } else if (adminMode === 'event') {
        state.type = 'event'
        document.querySelectorAll('[data-cx-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-cx-type') === 'event')
        })
    } else {
        state.type = 'bulletin'
        document.querySelectorAll('[data-cx-type]').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-cx-type') === 'bulletin')
        })
    }

    applyMode({ syncPreview: false })

    // Restore category pill
    const cat = gv('category') || gv('resourceCategory')
    if (cat && CATS[cat]) {
        pickCategory(cat)
    } else if (cat) {
        state.category = cat
        if (contentType === 'resource') renderChipPresets(cat)
    }

    // Populate core fields
    const titleInp = document.getElementById('cxTitle')
    const descInp  = document.getElementById('cxDesc')
    if (titleInp) titleInp.value = contentType === 'resource' ? gv('resourceTitleEn') : gv('title')
    if (descInp)  descInp.value  = contentType === 'resource' ? gv('resourceDescription') : gv('description')

    // Insert optional blocks for whichever fields are present
    clearAllBlocks()

    const hasSpanish = contentType === 'resource'
        ? (gv('resourceTitleEs') || gv('resourceSummaryEs'))
        : (gv('titleEs') || gv('summaryEs'))
    if (hasSpanish) insertBlock('spanish')

    if (contentType === 'post') {
        if (gv('dateType') || gv('eventDate')) {
            insertBlock('dates')
            // Restore bulletin date block conditional fields (range/sessions)
            const blkDateType = document.querySelector('#cxBlocks #cxBlkDateType')
            if (blkDateType) {
                blkDateType.value = gv('dateType') || 'event'
                blkDateType.dispatchEvent(new Event('change'))
                // Restore session rows if needed
                if (blkDateType.value === 'sessions') {
                    const eventDates = Array.from(form.querySelectorAll('input[name="eventDates"]')).map(i => i.value)
                    const startTimes = Array.from(form.querySelectorAll('input[name="eventSessionStartTimes"]')).map(i => i.value)
                    const endTimes   = Array.from(form.querySelectorAll('input[name="eventSessionEndTimes"]')).map(i => i.value)
                    const datesBlock = document.querySelector('#cxBlocks [data-cx-block="dates"]')
                    const sesList = datesBlock?.querySelector('#cxBlkSessionsList')
                    const blkSync = datesBlock?._syncBlkDateMirrors
                    if (sesList && eventDates.length) {
                        sesList.innerHTML = ''
                        eventDates.forEach((d, i) => sesList.appendChild(buildSessionRow(d, startTimes[i] || '', endTimes[i] || '', blkSync)))
                    }
                }
            }
        }
        if (gv('eventLink')) insertBlock('link')
        if (gv('company') || gv('contactPhone') || gv('eventLocation')) insertBlock('contact')
        if (gv('classType')) insertBlock('audience')
    } else if (contentType === 'resource') {
        if (gv('resourceUrl')) insertBlock('weblink')
        if (gv('resourcePhone')) insertBlock('phone')
        if (gv('resourceAddress')) insertBlock('address')
        if (gv('resourceHours')) insertBlock('hours')
        for (let slot = 1; slot <= MAX_RESOURCE_ACTION_LINKS; slot += 1) {
            if (gv(`resourceActionLink${slot}LabelEn`)
                || gv(`resourceActionLink${slot}Url`)
                || gv(`resourceActionLink${slot}ExistingPdfUrl`)) {
                insertBlock('extras', { slot })
            }
        }
        // help tags
        const highlights = restoredResourceHighlights || gv('resourceHighlights')
        if (highlights) {
            state.helpTags = highlights
                .split(',')
                .map(s => getActionResourceChipLabel(s.trim()))
                .filter(Boolean)
            renderHelpTags()
            mirror('resourceHighlights', state.helpTags.join(', '))
        }
    }

    // Restore Calendar Event hero date fields
    if (state.type === 'event') {
        const dateType = gv('dateType') || 'event'
        const evTypeEl = document.getElementById('cxEvType')
        if (evTypeEl) evTypeEl.value = dateType

        const primaryDate = gv('eventDate') || gv('startDate')
        const evDateEl = document.getElementById('cxEvDate')
        if (evDateEl && primaryDate) evDateEl.value = primaryDate

        if (dateType === 'range') {
            const endDate = gv('endDate')
            const evEndEl = document.getElementById('cxEvEnd')
            if (evEndEl && endDate) evEndEl.value = endDate
            document.getElementById('cxEvEndWrap')?.classList.remove('cx-hidden')
        }

        const st = gv('startTime'), et = gv('endTime')
        const cxEvStart = document.getElementById('cxEvStart')
        const cxEvEndTime = document.getElementById('cxEvEndTime')
        if (cxEvStart && st) cxEvStart.value = st
        if (cxEvEndTime && et) cxEvEndTime.value = et

        if (dateType === 'sessions') {
            // Restore session rows from eventDates[] in the form
            const eventDates   = Array.from(form.querySelectorAll('input[name="eventDates"]')).map(i => i.value)
            const startTimes   = Array.from(form.querySelectorAll('input[name="eventSessionStartTimes"]')).map(i => i.value)
            const endTimes     = Array.from(form.querySelectorAll('input[name="eventSessionEndTimes"]')).map(i => i.value)
            const sessionsList = document.getElementById('cxEvSessionsList')
            const sessionsWrap = document.getElementById('cxEvSessionsWrap')
            if (sessionsList) {
                sessionsList.innerHTML = ''
                eventDates.forEach((d, i) => sessionsList.appendChild(buildSessionRow(d, startTimes[i] || '', endTimes[i] || '')))
            }
            sessionsWrap?.classList.remove('cx-hidden')
        }

        syncEventDateMirrors()
    }

    // Populate inserted block values after insertion
    requestAnimationFrame(() => {
        document.querySelectorAll('[data-cx-mirror]').forEach(el => {
            const name = el.getAttribute('data-cx-mirror')
            const hiddenVal = form.querySelector(`input[type="hidden"][name="${name}"]`)?.value
                || form.querySelector(`[name="${name}"]`)?.value || ''
            if (hiddenVal) {
                if (el.type === 'radio') el.checked = (el.value === hiddenVal)
                else el.value = hiddenVal
            }
        })

        document.querySelectorAll('#cxBlocks [data-cx-block="extras"]').forEach((extrasBlock) => {
            const slot = Number(extrasBlock.dataset.cxActionLinkSlot) || 1
            restoreExtrasBlockUi(extrasBlock, slot)
        })

        syncMirrors()
        syncPreview()
    })
}

// ── Calendar Event hero wiring ────────────────────────────────────────────

function buildSessionRow(date = '', startTime = '', endTime = '', onSync = null) {
    const syncFn = onSync || syncEventDateMirrors
    const row = document.createElement('div')
    row.className = 'cx-evmore-row'
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px'
    row.innerHTML = `
<input type="date" class="cx-input" style="flex:1" value="${date}">
<input type="time" class="cx-input" style="max-width:120px" placeholder="Start" value="${startTime}">
<input type="time" class="cx-input" style="max-width:120px" placeholder="End" value="${endTime}">
<button type="button" class="cx-block-x" title="Remove">×</button>`
    row.querySelector('.cx-block-x').addEventListener('click', () => {
        row.remove()
        syncFn()
    })
    row.querySelectorAll('input').forEach(el => {
        el.addEventListener('change', syncFn)
    })
    return row
}

function syncEventDateMirrors() {
    const evType = document.getElementById('cxEvType')?.value || 'event'
    const dateVal  = document.getElementById('cxEvDate')?.value || ''
    const endVal   = document.getElementById('cxEvEnd')?.value || ''
    const startT   = document.getElementById('cxEvStart')?.value || ''
    const endT     = document.getElementById('cxEvEndTime')?.value || ''

    if (evType === 'sessions') {
        // Collect session rows from the composer's repeater
        const rows = Array.from(document.querySelectorAll('#cxEvSessionsList .cx-evmore-row'))
        const sessions = rows.map(r => {
            const ins = r.querySelectorAll('input')
            return { date: ins[0]?.value || '', startTime: ins[1]?.value || '', endTime: ins[2]?.value || '' }
        }).filter(s => s.date)

        // Write multi-value hidden inputs that sessionsFromFormData reads:
        // eventDates[], eventSessionStartTimes[], eventSessionEndTimes[]
        const form = document.getElementById('bulletinForm')
        if (form) {
            form.querySelectorAll('input[data-cx-session]').forEach(n => n.remove())
            sessions.forEach(s => {
                const d = document.createElement('input'); d.type='hidden'; d.name='eventDates'; d.value=s.date; d.setAttribute('data-cx-session','1'); form.appendChild(d)
                const st = document.createElement('input'); st.type='hidden'; st.name='eventSessionStartTimes'; st.value=s.startTime||''; st.setAttribute('data-cx-session','1'); form.appendChild(st)
                const et = document.createElement('input'); et.type='hidden'; et.name='eventSessionEndTimes'; et.value=s.endTime||''; et.setAttribute('data-cx-session','1'); form.appendChild(et)
            })
        }
        mirror('dateType', 'sessions')
        mirror('eventDate', sessions[0]?.date || '')
        mirror('startDate', '')
        mirror('endDate', '')
        mirror('startTime', sessions[0]?.startTime || '')
        mirror('endTime', sessions[0]?.endTime || '')
    } else if (evType === 'range') {
        mirror('dateType', 'range')
        mirror('startDate', dateVal)
        mirror('endDate', endVal)
        mirror('eventDate', dateVal)
        mirror('startTime', startT)
        mirror('endTime', endT)
    } else if (evType === 'deadline') {
        mirror('dateType', 'deadline')
        mirror('eventDate', dateVal)
        mirror('startDate', '')
        mirror('endDate', '')
        mirror('startTime', startT)
        mirror('endTime', endT)
    } else {
        mirror('dateType', 'event')
        mirror('eventDate', dateVal)
        mirror('startDate', '')
        mirror('endDate', '')
        mirror('startTime', startT)
        mirror('endTime', endT)
    }
    syncPreview()
}

function bindEventHero() {
    const evTypeEl     = document.getElementById('cxEvType')
    const evDateLabel  = document.getElementById('cxEvDateLabel')
    const evEndWrap    = document.getElementById('cxEvEndWrap')
    const evSessionsWrap = document.getElementById('cxEvSessionsWrap')
    const sessionsList = document.getElementById('cxEvSessionsList')
    const addSessionBtn = document.getElementById('cxEvAddSession')

    // Seed with two blank session rows for when sessions mode first activates
    function ensureSessionRows() {
        if (!sessionsList) return
        if (sessionsList.querySelectorAll('.cx-evmore-row').length === 0) {
            sessionsList.appendChild(buildSessionRow())
            sessionsList.appendChild(buildSessionRow())
        }
    }

    function updateEvType() {
        const v = evTypeEl?.value || 'event'
        if (evEndWrap)      evEndWrap.classList.toggle('cx-hidden', v !== 'range')
        if (evSessionsWrap) evSessionsWrap.classList.toggle('cx-hidden', v !== 'sessions')
        if (evDateLabel)    evDateLabel.textContent =
            v === 'deadline' ? 'Deadline date' :
            v === 'range'    ? 'Start date'    :
            v === 'sessions' ? 'First session' : 'Date'
        if (v === 'sessions') ensureSessionRows()
        syncEventDateMirrors()
    }

    if (evTypeEl) evTypeEl.addEventListener('change', updateEvType)
    ;['cxEvDate', 'cxEvEnd', 'cxEvStart', 'cxEvEndTime'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', syncEventDateMirrors)
    })
    if (addSessionBtn && sessionsList) {
        addSessionBtn.addEventListener('click', () => {
            sessionsList.appendChild(buildSessionRow())
            syncEventDateMirrors()
        })
    }
}

// ── Mount: call once after DOM is ready and admin panel is initialized ─────
export function mountPostComposer() {
    if (!isComposerActive()) return
    if (!document.getElementById('apCxCol')) return

    // Ensure all base mirrors are present
    mirror('contentType', 'post')
    mirror('category', '')
    mirror('title', '')
    mirror('description', '')
    mirror('resourceKind', 'organization')
    mirror('resourceTitleEn', '')
    mirror('resourceDescription', '')

    bindTypeTabs()
    bindResKindButtons()
    bindCoreFields()
    bindEventHero()
    bindInsertButton()
    buildCatPopover()
    renderChipPresets()
    buildChipBrowse()
    buildInsertMenu()
    bindHelpChips()
    bindUploads()
    bindSubmitButton()
    ensureMetaFields()

    // Initial mode state
    applyMode()

    // Expose for edit-prefill hook from editBulletin
    window.PostComposer = {
        hydrateFromForm,
        setFormMirror,
        selectComposerType,
        resetComposer,
        getHelpTags,
        getPreviewMode,
        syncComposerBeforePreview,
    }
}
