# Test checklist — `refactor/split-large-files` before merge

Branch: `refactor/split-large-files` (16 commits, not pushed).
What changed: file splits only — `firebase-admin.js` → 8 mixins, `firebase-config.js` → 1 mixin,
`bulletin-format.js` shared helper, all 5 large CSS files → `@import` aggregators, 9 dead CSS
files deleted, `docs/Codebase-Cleanup.md` added. **No behavior was intentionally changed.**

Work through top to bottom. Check the box when it passes. If something fails, note it and
stop — don't continue to the cleanup plan until the branch is green.

---

## A. Automated — run these first (~5 min)

- [ ] `npm run build` — succeeds, no errors
- [ ] `npm run test:unit` — 38 pass, 0 fail
- [ ] `npm test -- --project=desktop --project=mobile` — 114 pass, 5 skipped, 0 fail
      - Known flaky under parallel load (re-run isolated if they fail):
        `search.spec.js` "jumps to its card" / "card title below the header";
        `mobile.spec.js` "need chip filter shows cross-category";
        `resource-smoke.spec.js` "mobile category navigation".
        These fail on `main` too — only a problem if they ALSO fail on isolated rerun:
        `npm test -- --project=desktop <specfile>`
- [ ] `git diff --stat main..HEAD` — shows line *movement* (roughly equal +/−), not big net-new logic

---

## B. Student board (`index.html`) — `npm run dev`, open http://localhost:5173

- [ ] Feed loads and shows bulletin cards
- [ ] Category filter dropdown (`#feedCategorySelect`) — pick a category, feed filters, header updates
- [ ] Search: open the search layer (magnifier / Filters), type a query, results group with Help first
- [ ] Language toggle: click **Español** — page switches to Spanish, chips/labels translate; click **English** — switches back
- [ ] Open a bulletin: click a card → detail modal opens with title, description, **dates rendered correctly** (this is the `board-date-render.js` extraction — check an event with a date, a deadline post, and a multi-session post if you have one)
- [ ] Close the bulletin modal (X and click-outside)
- [ ] Resources: open a resource detail sheet, then close it
- [ ] "Find Help by need" chips — click one, resources filter across categories, "clear" resets
- [ ] Open a PDF resource — the PDF viewer opens (this is `openPdfFromBulletin` → `openResourcePdf`)
- [ ] Share: open the share modal on a bulletin → shows the deep link + WhatsApp/FB/Email/SMS buttons; **Copy Link** relabels to "Copied!"; Close works
- [ ] Calendar view — switch to it, click a day with events, a bulletin opens from there
- [ ] Do the above at **mobile width** (dev tools ~390px) and **desktop width** — the CSS split touched `student-v2.css` and `student-legacy.css`; watch for layout breaks, missing styles, wrong colors

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
