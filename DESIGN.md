---
name: EBHCS Advisor Bulletin Board
description: A bilingual harbor-navy help board — calm wayfinding for ESOL students, an orderly control room for advisors.
colors:
  harbor-navy: "#0a1d3a"
  harbor-navy-deep: "#15315e"
  advisor-navy: "#0a1f44"
  advisor-navy-mid: "#12306b"
  signal-blue: "#2e7af0"
  advisor-blue: "#1a56db"
  sky-tint: "#7eb1ff"
  sky-pale: "#dde9ff"
  beacon-gold: "#ffc857"
  advisor-gold-accent: "#f59e0b"
  sidebar-gold-rail: "#ffd55d"
  amber-urgent: "#e88a2a"
  amber-urgent-text: "#9a3412"
  money-green: "#1aa37a"
  advisor-green: "#059669"
  health-pink: "#e0497d"
  esol-purple: "#7b4ec7"
  advisor-purple: "#7c3aed"
  advisor-red: "#dc2626"
  page-mist: "#f4f6fb"
  neutral-ink: "#0f172a"
  neutral-slate: "#475569"
  neutral-muted: "#64748b"
  neutral-border: "#e2e8f0"
  neutral-surface: "#f8fafc"
  advisor-mint: "#e6f7f0"
  advisor-mint-mid: "#a7e8cc"
  advisor-coral: "#fff1ec"
  advisor-coral-mid: "#ffc9b0"
  advisor-lavender: "#f0eeff"
  advisor-lavender-mid: "#c8bcf8"
  advisor-text-muted: "#4d6d90"
  advisor-green-text: "#047857"
  advisor-amber-text: "#a35800"
  advisor-red-text: "#b91c1c"
typography:
  student-display:
    fontFamily: "'Outfit', sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.05
  student-label:
    fontFamily: "'Outfit', sans-serif"
    fontSize: "13px"
    fontWeight: 800
    letterSpacing: "0.6px"
  student-body:
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  advisor-display:
    fontFamily: "'Lexend', -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
  advisor-label:
    fontFamily: "'Lexend', -apple-system, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 500
  advisor-body:
    fontFamily: "'Source Sans 3', -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.advisor-navy}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.advisor-navy-mid}"
  button-blue:
    backgroundColor: "{colors.advisor-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-slate}"
    rounded: "{rounded.md}"
  chip-filter:
    backgroundColor: "#ffffff"
    textColor: "{colors.neutral-muted}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  chip-deadline-urgent:
    backgroundColor: "#fff5e8"
    textColor: "{colors.amber-urgent-text}"
    rounded: "{rounded.pill}"
  card-bulletin:
    backgroundColor: "rgba(248,250,252,0.98)"
    rounded: "{rounded.lg}"
    padding: "{spacing.2xl}"
---

# Design System: EBHCS Advisor Bulletin Board

## Overview

**Creative North Star: "The Harbor Beacon"**

East Boston Harborside Community School's board is a lighthouse, not a billboard: deep navy stands in for open water and institutional steadiness, while a small set of warm signal colors — gold, sky, coral, mint — mark the channel markers a student is actually looking for. The system runs across two surfaces that share one identity but speak with different registers. The student feed (`index.html`) is the open water: calm, uncluttered, icon-forward, built for a phone held by someone reading their second language under time pressure. The advisor portal (`admin.html`) is the control room: the same navy hull, but denser, more instrumented, built for staff who use it routinely and need instant recognition over persuasion.

Both surfaces reject two things on principle: dense walls of English prose (the student surface leads with icons, action verbs, and short labels — Call, Directions, Website — because paragraphs are the wrong medium for a mixed-literacy audience), and stock-photo/corporate-clipart polish (this is a self-funded, real-institution tool; any imagery or iconography must read as built, not licensed). Urgency is communicated in warm amber (`#e88a2a` / `#9a3412`), never in alarm-red — a deadline is information to act on, not a warning to fear.

**Key Characteristics:**
- Deep harbor-navy as the dominant surface color on both student and advisor chrome (topbar, sidebar, hero bands).
- A restrained, named accent set per surface — student: gold/sky/urgent-amber/money-green/health-pink/esol-purple as category signals; advisor: sky/mint/coral/lavender/gold as soft tonal backgrounds for type chips and stat cards.
- Pill shapes (`999px`) for anything the user selects or filters by; rounded-rectangle cards (`12–20px`) for anything they read.
- Soft, navy-tinted elevation on every raised surface — never a neutral gray or black shadow.
- Tactile, confident interactive states: buttons and cards visibly lift or shift color on hover/active; nothing sits inert.

## Colors

The palette is one navy hull with two accent wardrobes — a saturated, high-signal set for the student feed and a softer, tonal-background set for the advisor portal's information density.

### Primary
- **Harbor Navy** (`#0a1d3a`): the dominant brand color — student topbar background, hero gradients, primary text-on-light headings. Used at full saturation, never diluted.
- **Advisor Navy** (`#0a1f44`): the portal's near-identical navy, used for the sidebar rail, primary buttons, and active states. Treat as the same brand color expressed on the denser surface; do not let it drift from Harbor Navy's hue.
- **Harbor Navy Deep** (`#15315e`) / **Advisor Navy Mid** (`#12306b`): the hover/gradient-end shade for navy surfaces — always paired with the primary navy, never used alone as a base color.

### Secondary
- **Signal Blue** (`#2e7af0`) / **Advisor Blue** (`#1a56db`): the "go" action color — primary CTA buttons, active nav states, focus rings. This is the one hue on the page allowed to say "click me."
- **Beacon Gold** (`#ffc857` / advisor accent `#f59e0b`, sidebar active-rail `#ffd55d`): the wayfinding accent — used sparingly for eyebrow text, the sidebar's active-item rail, and small brand flourishes. Gold marks "you are here," never a large surface.

### Tertiary — Category Signals (student feed)
- **Amber Urgent** (`#e88a2a` bg / `#9a3412` text): deadline chips. Deliberately warm, not alarm-red — see the Urgency Rule below.
- **Money Green** (`#1aa37a`): financial/benefits-related resource category.
- **Health Pink** (`#e0497d`): health-related resource category.
- **ESOL Purple** (`#7b4ec7`): English-class/education resource category.

### Tertiary — Portal Tonal Backgrounds (advisor)
- **Advisor Sky** (`#e8f0fe` family) / **Advisor Mint** (`#e6f7f0`) / **Advisor Coral** (`#fff1ec`) / **Advisor Lavender** (`#f0eeff`): pastel background fills for post-type chips (Bulletin/Resource/Event) and stat-card tints. Always a light tint carrying a saturated text color of the same family (e.g. mint bg + `#059669` text), never solid-saturated as a background.
- **Badge text-safe variants** (`advisor-green-text` `#047857` / `advisor-amber-text` `#a35800` / `advisor-red-text` `#b91c1c`): darker siblings of Advisor Green/Gold-accent/Red used specifically as small (`~11px`) bold badge text on their matching pastel tint (`.ap-badge-green/amber/expired`), where the base accent tone falls short of 4.5:1 contrast at that size. Base accent tones stay unchanged everywhere else (buttons, icons, trend indicators); these variants are for badge text only.

### Neutral
- **Page Mist** (`#f4f6fb`): the default page background on both surfaces — a barely-blue off-white, never pure white.
- **Neutral Ink** (`#0f172a`): primary body/heading text on light surfaces.
- **Neutral Slate** (`#475569`) / **Neutral Muted** (`#64748b`): secondary and tertiary text.
- **Neutral Border** (`#e2e8f0`): default hairline border on cards, inputs, chips.
- **Neutral Surface** (`#f8fafc`): raised-but-quiet backgrounds (hover states, input focus fill).
- **Advisor Text Muted** (`#4d6d90`, advisor portal's `--ap-text-3`): the portal's third-tier text color — stat labels, empty-state notes, table note cells. Darkened from an earlier `#7a95b5` value that measured under 4.5:1 on white; this shade clears WCAG AA at the small sizes it's used at.

### Named Rules
**The Warm Urgency Rule.** Time pressure is signaled in amber/orange, never red. Red (`#dc2626`) is reserved exclusively for destructive advisor actions (delete), not for anything a student sees.
**The One Navy Rule.** Only one navy family is on screen at a time per surface. Don't introduce a third, colder or warmer, navy — reuse Harbor/Advisor Navy and its one deep variant.

## Typography

**Student Display Font:** Outfit (headings, hero titles, section labels)
**Student Body Font:** Plus Jakarta Sans (body copy, UI labels)
**Advisor Display Font:** Lexend (dashboard headings, stat values, nav)
**Advisor Body Font:** Source Sans 3 (portal body copy, composer text)

**Character:** Outfit and Lexend are both geometric, slightly rounded grotesques used at heavy weights (700–800) for headings — confident and legible at a glance, never delicate. Plus Jakarta Sans and Source Sans 3 carry the reading weight at 400–500 — warmer and more neutral than the display faces, chosen for comfortable extended reading in a second language.

### Hierarchy
- **Display** (800, 28px, line-height 1.05, Outfit — student `.view-hero h1`; 800, 2rem, Lexend — advisor `.ap-stat-value`): hero titles and headline numbers. One per view.
- **Headline** (800, 17–25.6px, display font): topbar brand name, portal page/section headers.
- **Label** (700–800, 10–13px, uppercase, 0.6–1px tracking, display font): eyebrows, section labels, nav-section labels. The system's most frequent typographic move — nearly every region opens with one.
- **Body** (400–500, 14–16px, body font, line-height 1.6–1.65): card copy, form fields, portal document content.
- **Chip/small label** (500–700, 10–14px, body or display font): filter chips, deadline chips, type chips.

### Named Rules
**The Heavy-Label Rule.** Section and eyebrow labels are always the display font at 700+ weight, uppercase, with visible letter-spacing — this is how the system marks "structure" distinctly from "content," which stays in the body font at regular weight.

## Layout

Both surfaces are mobile-first, single-column by default, expanding to structured multi-column layouts at wider breakpoints — the student feed to a 2-column card grid and a sticky desktop aside; the advisor portal to a fixed 240px left sidebar plus content area.

- **Containers:** student topbar content caps at `700px`; general content caps at `1200px` (student) / `1160px` (advisor header). Both center with auto margins and `16–24px` side padding.
- **Card grid:** `1fr` on mobile → `repeat(auto-fit, minmax(320–350px, 1fr))` at `640px`/`1024px`, with gap growing from `20px` to `28px`. The student feed also forces a fixed 2-column grid at `768px` for its primary view.
- **Breakpoint rhythm:** student uses a wide-spaced ladder (`640 / 768 / 1024 / 1280 / 1440px`) tuned for card reflow; the advisor portal uses a denser ladder (`480 / 560 / 640 / 720 / 768 / 900 / 1100px`) tuned for the sidebar's collapse behavior around `900–1100px`.
- **Density:** the student surface is comfortable (generous card padding, `24–32px`); the advisor portal is denser by necessity (`16–24px` component padding) since it's an operate-mode tool used repeatedly, not a persuade-mode surface.
- **Touch targets:** minimum `44px` on interactive controls (`--touch-target-min`), honored on both surfaces.

## Elevation & Depth

Depth is conveyed through a single consistent language: soft, navy-tinted shadows (`rgba(10, 29/31, 58/68, α)` — the same hue family as the brand navy, never neutral gray or black) that grow on hover to signal "this lifts." Nothing sits flush with a hard black shadow; nothing floats without warmth in its shadow color.

### Shadow Vocabulary
- **Ambient card** (`box-shadow: 0 4px 16px rgba(15,23,42,0.1), 0 1px 4px rgba(15,23,42,0.05)`): resting state for bulletin cards.
- **Lifted card** (`box-shadow: 0 20px 40px rgba(15,23,42,0.15), 0 8px 16px rgba(15,23,42,0.1)`, with `translateY(-8px)`): hover state — the system's signature "pick this up" gesture.
- **Advisor tiers** (`--ap-shadow-xs` `0 1px 3px rgba(10,31,68,.06)` → `--ap-shadow-sm` `0 2px 8px rgba(10,31,68,.08)` → `--ap-shadow-md` `0 4px 16px rgba(10,31,68,.1)` → `--ap-shadow-lg` `0 8px 32px rgba(10,31,68,.14)`): a formal 4-step elevation scale — topbar/cards/dropdowns/modals respectively.
- **Focus ring** (`0 0 0 3px rgba(26,86,219,.1)` advisor / `inset 0 0 0 1px rgba(46,122,240,0.14)` student): a soft blue glow, not a hard outline.

### Named Rules
**The Navy-Tint Rule.** Every shadow on this system is tinted toward the brand navy (`rgba(10, 29–31, 58–68, …)`). A gray or pure-black shadow is a defect, not a stylistic variant — it breaks the "same hull, same water" continuity between surfaces.

## Shapes

- **Pill (`999px`):** anything the user selects, filters by, or toggles — filter chips, deadline chips, type chips, the language toggle. Pills mean "state," not "content."
- **Rounded rectangle (`12–20px`, scaling up with viewport):** anything the user reads — bulletin cards, post-preview cards, buttons. Student cards round up to `20px` at desktop; advisor's card system uses a tighter, tokenized `8/12/16/20px` scale (`--ap-r-sm/md/lg/xl`).
- **Circle (`50%`):** avatars, icon-only buttons, the topbar's circular search/menu triggers.
- **Borders:** a single hairline (`1–2px`) in Neutral Border or a matching tint of the accent color, used to separate cards and inputs from Page Mist — never a heavy or double border.

## Components

Buttons, cards, and chips read as **tactile and confident**: visible hover lift, clear pill/rounded silhouettes, unambiguous state changes. Nothing in this system sits inert waiting to be clicked.

### Buttons
- **Shape:** `12px` radius (`{rounded.md}`), `8px 16px` padding, `600–800` weight label in the display font.
- **Primary (advisor `.ap-btn-primary`):** Advisor Navy background, white text, hovers to Advisor Navy Mid.
- **Blue/CTA (`.ap-btn-blue`):** Advisor/Signal Blue background, white text — the one button color reserved for the single most important action on a view.
- **Ghost/Secondary:** transparent background, `1px` Neutral Border, Neutral Slate text; hovers to Neutral Surface fill.
- **Danger:** soft red tint background (`#fee2e2`) with `#dc2626` text — destructive-only, advisor surface only.
- **Student action buttons (`.action-btn-v2`):** primary variant drops the border entirely (fully filled); secondary variant is white-filled with a `1.5px` solid border — thinner-weight siblings of the same primary/ghost logic.

### Chips
- **Filter chip (student):** white fill, `2px` transparent border that becomes Neutral Border at rest; `20px` pill radius; active state scales up (`1.05x`) and gains a per-category gradient fill plus a stronger shadow — the chip visibly "presses forward" when selected.
- **Deadline chip:** urgent = amber tint bg + dark amber text (see Warm Urgency Rule); normal = Neutral Surface bg + Neutral Slate text.
- **Type chip (advisor `.ap-preview-type-chip`):** pill radius, `700` weight uppercase micro-label, tonal-background family (sky/mint/lavender bg + matching saturated text) per post type — Bulletin/Resource/Event.

### Cards / Containers
- **Corner style:** `16px` mobile → `20px` desktop (student bulletin card); `14px` (advisor preview card).
- **Background:** near-white with slight transparency (`rgba(248,250,252,0.98)`) plus backdrop blur on student cards; solid white on advisor cards.
- **Shadow strategy:** see Elevation & Depth — ambient at rest, lifted + border tint shift (`rgba(14,165,233,0.3)`) on hover.
- **Border:** `1px` translucent Neutral Border tint.
- **Internal padding:** `24px` mobile → `32px` desktop (student); `24px` fixed (advisor, via `--resource-card-padding`).
- **Expired state:** `75%` opacity + `30%` grayscale filter + red-tinted border — the system's one deliberate "this is inert/past" visual, distinct from every other state which stays saturated.

### Inputs / Fields
- **Style:** `2px` Neutral Border, `8px` radius, white background, `12px` padding — shared by both surfaces via the common form stylesheet.
- **Focus:** border shifts to Signal Blue, background tints to Neutral Surface, plus a soft blue glow (`0 0 0 3px rgba(49,130,206,0.1)`).

### Navigation
- **Student topbar:** sticky, full Harbor Navy fill, white brand name (800 weight), gold-tinted sub-label, circular icon buttons on translucent white fill.
- **Advisor sidebar:** fixed 240px, Advisor Navy fill, nav items in translucent white text that brightens on hover/active; active item gets a blue tint background plus a `3px` gold accent rail on the left edge — the sidebar's one moment of the wayfinding-gold accent.

## Do's and Don'ts

### Do:
- **Do** keep every shadow tinted toward navy (`rgba(10, 29–31, 58–68, …)`) — never neutral gray or black (The Navy-Tint Rule).
- **Do** use pill shape (`999px`) for anything selectable/toggleable and rounded-rectangle (`12–20px`) for anything readable (content vs. state distinction).
- **Do** lead the student surface with icons and action-verb labels (Call, Directions, Website, Open form) over paragraphs of English text.
- **Do** signal urgency/deadlines in warm amber, never red (The Warm Urgency Rule); reserve red for destructive advisor-only actions.
- **Do** give every interactive element a visible hover/active state — lift, color shift, or scale — nothing stays visually inert.

### Don't:
- **Don't** introduce a second, unrelated navy or a cooler/warmer hue as the dominant brand color (The One Navy Rule).
- **Don't** use stock photography, corporate clip-art, or generic AI-image polish anywhere on either surface — this is a self-funded, real-institution tool and must read as built, not templated.
- **Don't** default to paid fonts, paid icon packs, or paid third-party UI kits — the project has no ongoing budget; stay within the loaded Google Fonts families and hand-authored components.
- **Don't** style destructive or urgent states in alarm-red on the student-facing surface.
- **Don't** flatten the student/advisor distinction — the student feed stays calm and spacious (persuade/read-adjacent), the advisor portal stays dense and instrumented (operate); don't import one surface's density or decoration into the other.
