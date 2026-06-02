# Handoff: Streamlined "Create a Post" Composer

## Overview
A redesign of the advisor **Create a Post** screen in the EBHCS Advisor Portal (`admin.html` →
"Create Post" page). The current form puts a type selector, a field-priority legend, four
required-ish fields, an 11-button category grid, three upload zones, and four accordions all at
the same visual altitude — overwhelming for time-pressed, non-technical advisors.

This redesign keeps **every existing field and capability** but reorganizes the screen around
**progressive disclosure**: a calm core (Title · Description · Category) with everything else
clearly optional and inserted on demand. It's the "Flyer-first / compose-like-a-note" direction
(internally "Direction C"), chosen after comparing three explorations.

The single most important idea: **lead with what each post type is actually about.**
- **Bulletin** → leads with the **flyer** (the image is what students notice on the feed).
- **Resource → Document** → leads with the **PDF** (the file *is* the resource).
- **Resource → Organization** → leads with the **logo** (optional) + help chips.
- **Calendar Event** → leads with the **date** (a calendar entry is fundamentally a date).

## About the Design Files
The files in this bundle are **design references created in plain HTML/CSS/JS** — a working
prototype that demonstrates the intended look, layout, and interactions. They are **not meant to
be shipped as-is.** The task is to **recreate this design inside the existing EBHCS codebase**,
which is **vanilla ES6 modules + Vite + Firebase/Firestore** (`src/admin.js`,
`src/css/advisor-portal-v2.css`, `admin.html`). Reuse the codebase's existing form-submission
logic, Firestore schema, validation, translation, and analytics wiring — only the **markup and
field organization** of the Create-a-Post page change.

Because the prototype already uses the portal's real design tokens (Lexend / Source Sans 3,
navy/blue palette), it should drop into the existing `advisor-portal-v2.css` token system with
no new colors or fonts.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate pixel-faithfully
using the existing CSS tokens and the codebase's components. The prototype's `shared.css` is a
reference for spacing/structure; prefer mapping to existing `--ap-*` tokens (already identical).

---

## The Screen: Create a Post

Two-column layout (desktop-first; advisors post from laptops):
- **Left (form column, `minmax(0,1fr)`):** type tabs → composer card → "Add detail" → submit bar.
- **Right (aside, fixed `372px`, sticky `top:80px`):** live phone preview of the student view, plus a "The idea" helper card. Hidden below `1040px`.
- Page max-width `1240px`, padding `30px 26px 80px`.

### 1. Type tabs (always visible)
Three equal cards in a `flex; gap:10px` row: **Bulletin**, **Resource**, **Calendar Event**.
Each: icon tile (34px, 10px radius) + bold name (Lexend 700, .9rem) + one-line description
(.72rem, `--ap-text-3`). Active card: `--ap-blue` border, `linear-gradient(180deg,#fff,--ap-sky)`
background, `0 0 0 3px var(--ap-blue-dim)` ring, icon tile filled blue. Selecting a tab reshapes
the composer (see modes below).

### 2. The composer card (`.cx-compose`)
A single white rounded card (`--ap-r-xl`, 1px `--ap-border`, `--ap-shadow-sm`). Top section is a
**mode hero** that changes per type; below it a **document-style body**.

**Hero zone (top of card), by mode:**
| Mode | Hero | Style |
|---|---|---|
| Bulletin | "Start with your flyer" — drop PNG/JPG/PDF | Dark navy bar, "Choose file" |
| Calendar Event | **"When is it?"** date panel (see §Event) | Gold (`--ap-gold`) panel |
| Resource · Organization | "Add a logo · optional" | Light (`--ap-surface-2`) bar, "Choose image" |
| Resource · Document | "Drop the PDF or form" | Dark navy bar, "Choose PDF" |

**Body (`.cx-doc`, padding `26px 30px 30px`):**
- **Title** — borderless headline input, Lexend 800, 1.7rem. Placeholder changes per mode
  ("Untitled post — type a title" / "Event name — …" / "Name of the place or organization" /
  "Name of the document or form").
- **Tag row** — a single **category** pill button ("Add a category"); opens a popover of all 11
  categories. Once chosen, the pill takes that category's color. **No "Posted by" field** — see below.
- **Description / summary** — borderless multiline textarea, Source Sans 3, 1rem, line-height 1.65.
- **Inserted detail blocks** (`#cxBlocks`) appear here.
- Divider, then the **"Add detail"** button → dropdown menu of optional fields (mode-specific).

### 3. Submit bar
`.cx-actions`: primary "Post to students" button (`--ap-blue`, Lexend 700, send icon) + a small
helper note. No advisor picker.

---

## Key Decisions (changes from the current form)

### A. Remove "Posted by"
The advisor is logged in, so **do not ask who is posting.** Drop the `advisorName` /
`resourceAdvisorName` `<select>`s from the UI. Populate the author field automatically from the
authenticated user (`firebase-auth` current user → display name) on submit. The preview card
still shows the byline ("Jorge · Just now") for confirmation only. The portal header shows
"Posting as <Name>" as the single identity cue.

### B. Category condensed
Show the 6 most-used topics as chips by default with a "+ More topics" reveal for the full 11.
Same category values as today (`job, training, immigration, housing, health, food, esol, college,
money, career-fair, announcement`). In the composer the category is a single popover-picker pill.

### C. Spanish is the first, emphasized "Add detail" option
In every mode the **Spanish version** entry is first in the "Add detail" menu and carries a green
**"Recommended"** badge (bilingual ESOL audience). Maps to existing `titleEs` / `summaryEs`
(and `resourceTitleEs` / `resourceSummaryEs`).

### D. Optional fields are inserted, not pre-rendered
"Add detail" inserts only the blocks the advisor picks; removing a block clears it. The resting
screen is just hero + title + category + description.

---

## Mode: Bulletin
- Hero: flyer upload (`image`; also accepts a PDF → maps to `pdf` + the ES flyer `imageEs` can be
  added later). Updates the preview card's image.
- Add-detail menu (in order): **Spanish version** (Recommended) · Dates & times · Sign-up link ·
  Contact & location · Who it's for.
  - Dates & times → `dateType`, `eventDate`/`startDate`/`endDate`, `startTime`, `endTime`.
  - Sign-up link → `eventLink`.
  - Contact & location → `company`, `location` (name `eventLocation`), `contactPhone`
    (+`contactPhoneMode` call/text/both).
  - Who it's for → `classType` (All / ESOL / HSE / FamLit).
- Preview: feed card (`[data-prev="bulletin"]`) — category/type chip bar, image, title, description, byline, "Open →".

## Mode: Resource (the Organization vs Document fork)
Selecting Resource reveals a **sub-type chooser** (`#cxResKind`, two cards):
**"A place or organization"** vs **"A document or form."** This single choice reshapes the rest:

| | Organization | Document / Form |
|---|---|---|
| Hero | "Add a logo · optional" (light) → `resourceLogo` | "Drop the PDF or form" (dark) → `resourcePdf` |
| Title | "Name of the place or organization" → `resourceTitleEn` | "Name of the document or form" → `resourceTitleEn` |
| Description | "One-line summary…" → `resourceDescription` | same |
| Add-detail menu | Spanish · **Website link** · **Phone** (call/text/both) · **Address** · **Hours** · **Extra button** | Spanish · **Website link** · **Extra button** |
| Required link field | `resourceUrl` (Website link) | `resourcePdf` (the hero) or `resourceUrl` |
| Preview action button | **"Visit website"** | **"View PDF"** |

- Always-visible **"What can students do here?"** chips block (`#cxChipsBlock`) — required;
  tag input + tap-to-add suggestions, max 6. Maps to `resourceHighlights`.
- **Extra button** block = an extra action link **or** an uploaded PDF (toggle 🔗 Link / 📄 PDF).
  Maps to the existing `resourceActionLinkSlots` (up to 5 links/PDFs).
- Field mapping: `resourceKind` (`organization`|`document`), `resourceCategory`,
  `resourceTitleEn/Es`, `resourceSummaryEs`, `resourceAddress`, `resourcePhone`(+mode),
  `resourceHours`, `resourceLogo`, `resourcePublished`, `resourceOrder` (keep order via the
  My Posts "Reorder" drag tool, not a field).
- Preview: resource card (`[data-prev="resource"]`) — logo/category tile, title, category label,
  summary, help-chip pills, action button.

## Mode: Calendar Event
- Hero is the **"When is it?"** gold date panel (`#cxEventWhen`) — the date leads:
  - **Type** select: Event date / Deadline / Date range / Multiple sessions → maps to `dateType`.
    - Range reveals an **End date** (`endDate`).
    - Multiple sessions reveals a "+ Add another session date" repeater (maps to the existing
      `eventDatesList` / sessions UI in `event-sessions.js`).
  - **Date** (`eventDate`/`startDate`), **Start time** (`startTime`), **End time** (`endTime`) — times optional.
- Body title "Event name", optional category, optional details textarea.
- Add-detail menu: **Spanish** (Recommended) · **Format & location** (In-person/Online/Hybrid +
  address/link → `eventLocation` format + `location`) · Sign-up link (`eventLink`) · Who it's for.
- Preview: calendar card (`[data-prev="event"]`) — "ON THE CALENDAR" chip, a date tile
  (month + day), title, formatted "Wed, Jun 10 · 6:00–8:00 PM," and format/location line.
- Note: Calendar Events are not shown on the home feed (existing behavior).

---

## Interactions & Behavior
- **Type tab / sub-type change** → reshapes hero, placeholders, the add-detail menu, and the
  preview card. (In the prototype: `applyMode()`.) Inserted detail blocks are cleared on a mode change.
- **Category pill** → opens a popover (`.cx-catpop`) anchored under the pill; pick sets the pill
  color and the preview chip/label/logo color.
- **Add detail** → toggles a dropdown (`.cx-insert-menu`); choosing an item inserts a block above
  the divider and marks the menu item "used"; the block's × removes it and frees the menu item.
- **Help chips (resource)** → Enter/comma or tap a suggestion adds a pill (max 6); × removes.
- **Extra button** → radio toggles between a URL input and a PDF chooser.
- **Live preview** updates on every input. The byline shows the logged-in advisor automatically.
- All transitions are subtle (`.16s–.26s`); dropdowns fade/slide in (`cxIn` keyframe).

## State (per draft)
type (`bulletin|resource|event`), resourceKind (`organization|document`), category, title,
description, plus whichever optional blocks are present and their values, plus help-chip tags
(resource) and event date/type/times. On submit, assemble the existing Firestore document shape;
attach author from auth. Keep existing draft/edit-prefill behavior (My Posts → Edit loads values
back into the composer and shows the matching blocks).

## Design Tokens
Use the existing `:root` tokens in `src/css/advisor-portal-v2.css` — the prototype's `shared.css`
mirrors them exactly:
- Navy `#0a1f44`, navy-mid `#12306b`; Blue `#1a56db` (`--ap-blue`); Green `#059669`; Amber `#d97706`.
- Pastels: sky `#e8f0fe`, mint `#e6f7f0`, coral `#fff1ec`, lavender `#f0eeff`, gold `#fffbea`.
- Surfaces: bg `#f5f7fb`, surface `#fff`, surface-2 `#f0f4f9`, border `#e2e8f2`, border-mid `#c8d4e8`.
- Text: `#0d1b35` / `#3d5a80` / `#7a95b5`.
- Type: headings **Lexend** (300–800), body **Source Sans 3**. (Both already loaded in `admin.html`.)
- Radius: 8 / 12 / 16 / 20 / pill. Shadows: `--ap-shadow-xs/sm/md/lg`.
- Category colors used by chips/preview are defined in `shared.js` `CATS` (em + bg + fg per topic).

## Assets
No new image assets. Icons are inline SVG (feather-style). The "⛵" sail glyph is the existing
brand mark (see `ebhcs-brand-lockup.js`). User-supplied flyers/logos/PDFs are uploaded by advisors
as today (base64 in Firestore, ≤10MB).

## Files in this bundle
- `Streamlined Post Composer.html` — the full prototype (all three modes + the org/document fork).
- `shared.css` — all styles (token mirror + composer + preview cards).
- `shared.js` — shared engine: category map, live preview sync, type tabs, accordions, uploads.
  (Mode/fork/event logic lives in the inline `<script>` at the bottom of the HTML file.)

### Where this replaces code in the real repo
- `admin.html` — the `#apPageCreate` "Create a Post" markup (type selector, `#bulletinForm`,
  the four accordions, the resource/event sections, and the live preview column).
- `src/admin.js` — the form wiring, content-type switching, accordion toggles, preview sync,
  category picker, and submit handlers.
- `src/css/advisor-portal-v2.css` — composer/preview styles.
Keep Firestore rules, `firebase-admin.js`, translation, and analytics unchanged.
