# Codebase Cleanup — running log

A running list of maintainability / polish items found while working in the repo.
Not a sprint plan — pick items off as convenient. Each item: what, why it matters,
rough size, and status.

Status key: **TODO** · **IN PROGRESS** · **DONE** · **WON'T DO** (with reason)

---

## 1. Split oversized source files

**Status: LARGELY DONE** — see `~/.claude/plans/we-have-very-large-woolly-raccoon.md` for the full record.

- `firebase-admin.js` 2,722 → 894 lines, 8 `applyMethods` mixins. **DONE**
- 9 orphaned `src/css/*.css` files (dead since 2026-05-28) deleted. **DONE**
- `src/bulletin-format.js` — collapsed 6 helpers duplicated across the two firebase files. **DONE**
- All 5 large CSS files → `@import` aggregators + section parts (byte-identical concat, cascade unchanged). **DONE**
- `firebase-config.js` — 1 mixin extracted (`board-date-render.js`); deeper split deferred (it's more interwoven than the admin file — methods thread through `displayBulletins`/`renderFeed` and share helpers with 4 existing mixins). **PARTIAL — follow-ups noted in the plan**
- `post-composer.js` (1,912), `admin-preview.js` (1,888) — untouched. **TODO** (preserve the `window.PostComposer` / `window.ap*` contracts exactly)
- `student-v2.css` second reconciliation pass — the `_pv3-*` parts are still 780–1,670 lines. **TODO**

---

## 2. Inline event handlers → bound listeners; drop `unsafe-inline` from CSP `script-src`

**Status: TODO** · **Size: medium (~4–6 small PRs)**

**Why:** the CSP in `firebase.json` (3 header blocks) and both HTML `<meta>` tags carry
`script-src 'self' 'unsafe-inline' 'unsafe-eval' …`. `'unsafe-inline'` is there only
because of inline `on*=` handlers. Removing it is the meaningful XSS hardening. (`'unsafe-eval'`
**cannot** be removed — the Firebase SDK + reCAPTCHA need it.)

**Inventory (2026-08-30):**
- `admin.html` — 23 `onclick=`, 2 `onload=`
- `index.html` — 3 `onclick=`, 2 `onload=`
- Generated HTML strings — ~45 `onclick=`/`onkeydown=` across 10 `src/*.js` files
  (`board-calendar`, `board-resources`, `board-detail`, `firebase-config`, `firebase-admin`,
  `admin-manage`, `admin-attachments`, `admin-composer-form`, `admin-edit`, `board-share`)

**Approach:**
1. Static HTML handlers → `id` / `data-action` attributes, bind in the existing
   `bindEvents()` of `main.js` / `admin.js` / `admin-preview.js`. One PR per file.
2. Generated-string handlers → `data-action="fn" data-id="${id}"` + one delegated
   `click` listener per render container (feed grid, resource sheet, calendar, manage list).
   The `window.*` globals (`shareBulletin`, `bulletinBoard.*`, `apShowPage`, `adminPanel.*`)
   can stay as the delegated handler's target initially.
3. `onload=` on `<img>` / `<script>` → `addEventListener('load', …)` at creation, or drop.
4. Remove `'unsafe-inline'` from `script-src` in `firebase.json` (lines ~65, 78, 91, 104)
   and both HTML `<meta>` tags. Leave it in `style-src` for now (see item 3).
5. Verify: full Playwright suite + `tests/refactor-safety-net.spec.js` catch broken click
   paths; manual pass; browser console clean of CSP violations.

---

## 3. Inline `style="…"` in generated HTML → CSS classes; drop `unsafe-inline` from CSP `style-src`

**Status: TODO** · **Size: large (~113 sites)** · **Priority: low — fold into CSS second-pass work**

~113 inline `style=` attributes in generated HTML strings across `src/*.js`. Each becomes a
class in the relevant (now nicely split) `src/css/` part. This is what lets `style-src` also
drop `'unsafe-inline'` — smaller security gain than item 2, more churn. Do opportunistically
alongside the `student-v2.css` reconciliation pass.

Examples already noted during the refactor: the toast styles in `admin-toasts.js`, the
confirm-dialog + edit-banner styles in `admin-edit.js`, `getCatMeta`'s color table in
`firebase-config.js` — all flagged by the Impeccable design hook. Reconciling these to
`DESIGN.md` tokens is the natural pairing.

---

## 4. Documentation drift

**Status: TODO** · **Size: small**

- **`README.md:67`** — "Node.js (v18+)". Actual: `package.json` `engines` says `>=22`, all
  7 CI workflows use `node-version: 22`. Fix to v22.
- **`scripts/README.md:3`** — "Run them ... with Node 20 (`nvm use`)". Same drift — should be 22.
- **`README.md` Project Layout** (lines 33–63) — mentions "board-*.js modules / admin-*.js
  modules" (accurate now, post-refactor) but predates and doesn't list the new files
  (`bulletin-format.js`, the 8 `admin-*.js` mixins, `board-date-render.js`, the `src/css/*/`
  section dirs). Refresh after the file-split follow-ups settle.
- Sweep `docs/*.md` for other stale version pins / dead paths while in there
  (`docs/DEPLOYMENT.md`, `FIREBASE_SETUP.md`, `TESTING.md` all mention `firebase-tools` global
  install — check that's still the recommended path vs. the pinned devDependency).

---

## 5. Archive one-off maintenance scripts

**Status: TODO** · **Size: small**

`scripts/` has **63** `.mjs` files; **29** are dated one-offs (`*-2026-08.mjs`,
`fix-resource-links-2026-08-30.mjs`, etc.) — data migrations / copy edits already run against
production. They clutter the dir and make it hard to see the ~14 genuinely reusable scripts
(the ones referenced in `package.json` / workflows: `build-student-feed-snapshot`,
`check-*-sync`, `run-with-emulator`, `import-resources`, `clear-analytics-events`, …).

**Approach:** `git mv` the dated one-offs to `scripts/archive/` (keeps them in history and
runnable if ever needed, out of the way). Update `scripts/README.md` to describe the
archive convention: "dated scripts are single-use; move to `archive/` once run." Leave the
reusable + recurring scripts at `scripts/` top level.

**Do NOT archive:** anything named in `package.json` scripts or `.github/workflows/*.yml`,
plus `dump-live-resources.mjs` (recurring audit tool).

---

## 6. Test flakiness

**Status: TODO** · **Size: small–medium**

A few Playwright specs fail intermittently under parallel load (confirmed flaky on pristine
`main` too, pass on isolated rerun):
- `search.spec.js` — "opening a resource result jumps to its card", "leaves the card title
  below the header" (scroll-position assertions)
- `mobile.spec.js` — "need chip filter shows cross-category resources"
- `resource-smoke.spec.js` — "renders all seeded resources through mobile category navigation"

Likely fixes: `await` a settled scroll / `scrollIntoViewIfNeeded` before asserting position,
or `expect.poll` the assertion. Not urgent (CI retries twice) but they cause noise.

---

## Add new items below as you find them.
