# Test checklist — `refactor/split-large-files` before merge

Branch: `refactor/split-large-files` (16 commits, not pushed).
What changed: file splits only — `firebase-admin.js` → 8 mixins, `firebase-config.js` → 1 mixin,
`bulletin-format.js` shared helper, all 5 large CSS files → `@import` aggregators, 9 dead CSS
files deleted, `docs/Codebase-Cleanup.md` added. **No behavior was intentionally changed.**

Work through top to bottom. Check the box when it passes. If something fails, note it and
stop — don't continue to the cleanup plan until the branch is green.

---

## A. Automated — run these first (~5 min)

_(2026-08-30 — all green, run by Claude)_

- [x] `npm run build` — succeeds, no errors
- [x] `npm run test:unit` — 38 pass, 0 fail
- [x] `npm test -- --project=desktop --project=mobile` — **116 pass**, 5 skipped, 0 fail
      (114 → 116: the 2 extra are new tests in `refactor-safety-net.spec.js`). No flakes on this run.
- [x] `git diff --stat main..HEAD` — 21,329 ins / 23,935 del; ~2,600 net *reduction* from
      dedup + dead-file deletion. Line movement, no big net-new logic.

---

## B. Student board (`index.html`) — `npm run dev`, open http://localhost:5173

_(2026-08-30 — driven by Claude via browser automation against a local dev server. All green.)_

- [x] Feed loads and shows bulletin cards
- [x] Category filter dropdown (`#feedCategorySelect`) — picked Food, feed + upcoming-events rail filtered, "Showing: Food" header + "Show all" reset shown; Show all restores
- [x] Search: opened the search layer, typed "food" → "20 results for food", "HELP 12" group rendered first
- [x] Language toggle: **Español** translated nav / chips / category labels / card bodies / weekday names; **English** switched back
- [x] Open a bulletin: card → detail modal with title, description, author; **recurring date rendered correctly** ("Every Wednesday · 3:00 PM – 6:00 PM"). Card-level dates also correct ("Wednesday, Sep 2 · 12:00 PM – 3:00 PM", "From Mon, Jun 15 · …"). _Deadline + multi-session variants not separately exercised — worth a glance in C._
- [x] Close the bulletin modal — both X ("Close bulletin detail") and click-outside work; URL hash clears
- [x] Resources: desktop resource cards render inline with hours/phone/Website/Directions/action chips; mobile category view ("Food / 10 resources" + Back) renders cards
- [x] "Find Help by need" chips — "Get food help" filtered resources across categories (sidebar 89 → 11, Food 10 + Family & Community 1), "Clear" resets to 89
- [x] Open a PDF resource — document resource "Open form" (`data-resource-action="open-pdf"`) opened the PDF (Firebase Storage URL) in a new tab. _In-app flyer PDF viewer (`openResourcePdf`) not separately hit — check via a bulletin PDF flyer in C._
- [x] Share: share modal shows deep link + WhatsApp/FB/Email/SMS; **Copy Link** → "Copied!"; Close works
- [x] Calendar view — month grid + event-count badges + This/Next week lists render; clicking a calendar side-event card opens the bulletin detail
- [x] Mobile width (~430px) and desktop width (1400px) — bottom tab bar (Home/Help/Dates/About), chip scroller, single-column feed, full-screen detail modal all held; no layout breaks or missing styles. Hard reload at both widths → PWA shell serves, no white screen.
- [x] Browser console clean after fresh reload — only Service Worker + Vite HMR logs, no errors / CSP violations

---

## C. Advisor portal (`admin.html`) — sign in with your @ebhcs.org account

_(This is where most of the change is — `firebase-admin.js` went 2,722 → 894 lines.)_

### Sign-in & shell
- [ ] Google sign-in works; portal opens; your name shows in the welcome / advisor card
- [ ] Sidebar nav (`apShowPage`): Dashboard, Create Post, My Bulletins, My Resources, My Events, Stats all switch pages
- [ ] Dashboard stat tiles show numbers (live posts / resources / upcoming events / expiring soon)
- [ ] Dashboard "upcoming events" list renders (or shows the empty-state message)
- [ ] Admin-only: Advisors tab + Workforce Report rail button appear (if you're an admin)
- [ ] Workforce Report page — open it, charts/stat cards render (this loads `/data/workforce/workforce-report.json`)
- [ ] Sign out — returns to the login screen cleanly

### Create a post (`admin-bulletin-write.js` + `admin-uploads.js` + `admin-validation.js`)
- [ ] **Bulletin**: pick category, title, description → Post → success toast → appears in My Bulletins → check it shows on the student feed
- [ ] **Calendar Event**: title + event date + start/end time → Post → appears in My Events → check it shows on the student calendar
- [ ] **Resource**: pick resource category, title (EN), a service chip or summary, a URL → Publish → appears in My Resources → check it shows in the student Resources view
- [ ] **Image upload**: create a bulletin with a JPG/PNG flyer → uploads, shows on the card
- [ ] **PDF flyer**: create a bulletin with a PDF flyer → converts to page-1 image, "open full PDF" works on the student side
- [ ] **PDF document resource**: create a document-kind resource with a PDF → student can open it
- [ ] **Validation**: try to submit with no category → blocked with a message; try a title under 3 chars → inline error
- [ ] **Moderation**: put an obvious scam phrase ("guaranteed income", excessive CAPS/!!!) in title/description → flagged
- [ ] Live preview panel updates as you type (title, description, category color, dates)

### Edit an existing post (`admin-edit.js`)
- [ ] Edit a **bulletin** → composer prefills (category, title, description); edit banner shows; save → "updated" toast; changes reflected
- [ ] Edit a **calendar event** → date/time fields prefill; save routes correctly (stays "post" type, event mode)
- [ ] Edit an **organization resource** → resource kind, service chips, action links, hours all prefill; save → payload correct
- [ ] Edit a **document resource** → document UI shows, PDF preview, no address/phone fields
- [ ] Switch between editing different posts back-to-back → no stale data from the previous edit
- [ ] "Cancel edit" link on the banner → clears the form, returns to the list

### Delete & manage (`admin-edit.js` + `admin-manage.js`)
- [ ] Delete a bulletin → confirm dialog appears ("Keep it" / "Yes, delete")
- [ ] "Keep it" → dialog closes, nothing deleted
- [ ] "Yes, delete" → post hidden from students, "deleted" toast
- [ ] Reorder resources within a category (drag on mobile / the reorder mode) → order persists

### Offline & toasts (`admin-offline.js` + `admin-toasts.js`)
- [ ] Toasts appear top-right, auto-dismiss, click-to-dismiss works (you'll see these throughout the above)
- [ ] (Optional) Toggle offline in dev tools → offline bar appears; back online → "connection restored" toast

---

## D. Cross-cutting — quick sanity

- [ ] Browser console: no new errors on either page (CSP violations, `undefined is not a function`, failed imports)
- [ ] Hard-refresh both pages (Cmd+Shift+R) — PWA / service worker still serves the shell, no white screen
- [ ] `git grep -n "onclick=" src/*.js` still resolves — the `window.*` globals (`shareBulletin`,
      `bulletinBoard.*`, `apShowPage`, `adminPanel.*`, `showTab`) are all still assigned
      (spot-check by using a few inline-handler buttons above — the share modal, tab nav, delete)

---

## E. When all green

- [ ] Merge `refactor/split-large-files` → `main` (or open the PR)
- [ ] Confirm the deploy pipeline runs clean (push to `main` = tests → hosting → rules)
- [ ] Verify the live site once deployed: student feed loads, advisor can sign in and post
- [ ] **Then** start the cleanup plan (`docs/Codebase-Cleanup.md`) — suggested order:
      item 4 (doc drift, ~10 min) → item 5 (archive scripts) → item 7 (Firebase config dedup)
      → item 2 + 8 together (inline handlers + CSP) → item 6 (flaky tests) → item 3 (inline styles, opportunistic)

---

## If a test fails

1. Note which check, what you saw vs. expected.
2. `git bisect` or check `git log --oneline main..HEAD` — each commit is one focused extraction, so `git show <commit>` will show exactly what moved.
3. Any single commit reverts cleanly (`git revert <sha>`) without touching the others.
4. Tell Claude the failing check + the commit it points to.
