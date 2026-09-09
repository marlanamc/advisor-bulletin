# Codebase Cleanup — running log

A running list of maintainability / polish items found while working in the repo.
Not a sprint plan — pick items off as convenient. Each item: what, why it matters,
rough size, and status.

Status key: **TODO** · **IN PROGRESS** · **DONE** · **WON'T DO** (with reason)

---

## 1. Split oversized source files

**Status: LARGELY DONE** — source split follow-ups are tracked in this document.

- `firebase-admin.js` 2,722 → 894 lines, 11 admin mixins. **DONE**
- 9 orphaned `src/css/*.css` files (dead since 2026-05-28) deleted. **DONE**
- `src/bulletin-format.js` — collapsed 6 helpers duplicated across the two firebase files. **DONE**
- All 5 large CSS files → `@import` aggregators + section parts (byte-identical concat, cascade unchanged). **DONE**
- `firebase-config.js` — 1 mixin extracted (`board-date-render.js`); deeper split deferred (it's more interwoven than the admin file — methods thread through `displayBulletins`/`renderFeed` and share helpers with 4 existing mixins). **PARTIAL — follow-ups noted in the plan**
- `post-composer.js` (1,912), `admin-preview.js` (1,888) — untouched. **TODO** (preserve the `window.PostComposer` / `window.ap*` contracts exactly)
- CSS second reconciliation pass — the `_pv3-*` parts are still 780–1,670 lines, and `src/css/legacy/_detail-share-footer.css` is still the largest active-looking CSS part at 2,111 lines. **TODO**

---



## 2. Inline event handlers → bound listeners; drop `unsafe-inline` from CSP `script-src`

**Status: DONE** · **Size: medium (~4–6 small PRs)**

**Why:** the CSP in `firebase.json` (4 Firebase Hosting header blocks) and both HTML `<meta>` tags carry
`script-src 'self' 'unsafe-eval' …`. The old `script-src 'unsafe-inline'` allowance was
removed after retiring inline `on*=` handlers. Do not remove `'unsafe-eval'` until Firebase
SDK and reCAPTCHA behavior are verified without it.

**Inventory (2026-08-30):**

- `admin.html` — 0 `onclick=`, 0 `onload=`; static controls now use delegated `data-ap-*` handlers. **DONE**
- `index.html` — 0 `onclick=`, 0 `onload=`. **DONE**
- Share modal (`board-share.js`) — generated share buttons now use delegated
  `data-share-*` handlers. **DONE**
- Bulletin detail actions (`board-detail.js`) — generated PDF/share buttons now use
  delegated `data-detail-action` handlers on `#bulletinDetailBody`. **DONE**
- Admin manage lists (`admin-manage.js`) — generated advisor/bulletin edit/delete
  buttons now use delegated `data-manage-action` handlers. **DONE**
- Admin attachment previews (`admin-attachments.js`) — generated choose/remove controls
  now use delegated `data-attachment-action` handlers. **DONE**
- Admin edit banner/logo preview (`admin-edit.js`) — generated cancel/remove controls
  now use delegated handlers. **DONE**
- Admin session date rows (`admin-composer-form.js`) — generated date/time inputs
  and remove-session buttons now use delegated listeners. **DONE**
- Student feed retry/day-events modal (`firebase-config.js`) — generated retry, day
  event, and close controls now use delegated handlers. **DONE**
- Resource cards (`board-resources.js`) — generated share/form/action-PDF controls
  now use delegated `data-resource-action` handlers; resource logo layout uses the
  existing logo-tile initializer. **DONE**
- Calendar views (`board-calendar.js`) — generated upcoming/list/month controls now
  use delegated `data-calendar-action` handlers. **DONE**
- Generated HTML strings — 0 `onclick=`/`onkeydown=`/`onchange=`/`oninput=`/`onload=`
  attributes across `index.html`, `admin.html`, and `src`.

**Approach:**

1. Static HTML handlers → `id` / `data-action` attributes, bind in the existing
   `bindEvents()` of `main.js` / `admin.js` / `admin-preview.js`. One PR per file.
2. Generated-string handlers → `data-action="fn" data-id="${id}"` + one delegated
   `click` listener per render container (feed grid, resource sheet, calendar, manage list).
   The `window.*` globals (`shareBulletin`, `bulletinBoard.*`, `apShowPage`, `adminPanel.*`)
   can stay as the delegated handler's target initially.
3. `onload=` on `<img>` / `<script>` → `addEventListener('load', …)` at creation, or drop.
4. Remove `'unsafe-inline'` from `script-src` in `firebase.json` and both HTML
   `<meta>` tags. Leave it in `style-src` for now (see item 3). **DONE**
5. Verify: full Playwright suite + `tests/refactor-safety-net.spec.js` catch broken click
   paths; manual pass; browser console clean of CSP violations. **DONE**

---



## 3. Inline `style="…"` in generated HTML → CSS classes; drop `unsafe-inline` from CSP `style-src`

**Status: TODO** · **Size: large (~116 sites)** · **Priority: low — fold into CSS second-pass work**

~116 inline `style=` attributes in generated HTML strings across `src/*.js`. Each becomes a
class in the relevant (now nicely split) `src/css/` part. This is what lets `style-src` also
drop `'unsafe-inline'` — smaller security gain than item 2, more churn. Do opportunistically
alongside the generated HTML cleanup and any active large legacy CSS cleanup.

Examples already noted during the refactor: the toast styles in `admin-toasts.js`, the
confirm-dialog + edit-banner styles in `admin-edit.js`, `getCatMeta`'s color table in
`firebase-config.js` — all flagged by the Impeccable design hook. Reconciling these to
`DESIGN.md` tokens is the natural pairing.

Started: `admin-edit.js` confirm-dialog and edit-mode banner styles moved to admin CSS
classes, with the dialog text escaped while touching the markup. **DONE**

Also moved `admin-toasts.js` temporary toast styling into `src/css/portal/_toast.css`;
toast messages now use CSS type classes and escaped body text. **DONE**

---



## 4. Documentation drift

**Status: DONE** · **Size: small**

- `README.md:67` — updated from "Node.js (v18+)" to Node 22. **DONE**
- `scripts/README.md:3` — updated from Node 20 to Node 22. **DONE**
- `README.md` **Project Layout** — refreshed for the split student/admin shells,
  admin/board mixins, `bulletin-format.js`, and split CSS section files. **DONE**
- Swept stale Firebase CLI and CSS-file references across `docs/*.md`; setup, deployment,
  security rules, succession, and testing docs now match the current repo shape. **DONE**

---



## 5. Archive one-off maintenance scripts

**Status: DONE** · **Size: small**

`scripts/` had **63** `.mjs` files; **29** dated one-offs (`*-2026-08.mjs`,
`fix-resource-links-2026-08-30.mjs`, etc.) moved to `scripts/archive/`. They were data
migrations / copy edits already run against production and cluttered the dir, making it
hard to see the ~14 genuinely reusable scripts
(the ones referenced in `package.json` / workflows: `build-student-feed-snapshot`,
`check-*-sync`, `run-with-emulator`, `import-resources`, `clear-analytics-events`, …).

**Approach:** dated one-offs live in `scripts/archive/` (keeps them in history and runnable
if ever needed, out of the way). `scripts/README.md` now describes the archive convention:
"dated scripts are single-use; move to `archive/` once run." Leave reusable + recurring
scripts at `scripts/` top level.

**Do NOT archive:** anything named in `package.json` scripts or `.github/workflows/*.yml`,
plus `dump-live-resources.mjs` (recurring audit tool).

---



## 6. Test flakiness

**Status: DONE** · **Size: small–medium**

A few Playwright specs fail intermittently under parallel load (confirmed flaky on pristine
`main` too, pass on isolated rerun):

- `search.spec.js` — "opening a resource result jumps to its card", "leaves the card title
  below the header" (scroll-position assertions)
- `mobile.spec.js` — "need chip filter shows cross-category resources"
- `resource-smoke.spec.js` — "renders all seeded resources through mobile category navigation"

Fixed by replacing the fixed search scroll delay with `expect.poll`, waiting for concrete
mobile shortcut readiness in the shared seed helper, and asserting the seeded resource total
before category-smoke navigation. Targeted desktop/mobile search and mobile resource runs pass.

---



## 7. Deduplicate the Firebase config object

**Status: DONE** · **Size: small–medium**

The same 7-key `firebaseConfig` literal (apiKey, authDomain, projectId, storageBucket,
messagingSenderId, appId) is copy-pasted in:

- `src/firebase.js` (admin app — Firestore + Auth + Storage). **DONE**
- `src/firebase-auth.js` (auth-only app — used by `admin.js`, `google-auth.js`). **DONE**
- `src/firebase-student.js` (student app — Firestore only, keeps Storage/Auth SDK out of the student bundle). **DONE**
- `config/firebase-config-template.js` (the template is now generic placeholders). **DONE**
- **~8 scripts** (`build-student-feed-snapshot`, `import-resources`, `update-roles`,
  `cleanup-*-bulletins`, `patch-calendar-events`, `check-advisor-auth-sync`,
  `delete-imported-resources`) each embed it inline. **DONE**

Three separate client `initializeApp` calls are **intentional** (bundle-size isolation —
don't collapse the files). The **config object** is not — it should be a single export.

**Approach:**

1. `src/firebase-shared-config.js` exports the plain config object. The 3 client files
   import it instead of inlining. **DONE**
2. `scripts/lib/firebase-config.mjs` exports the Node-side script config. The recurring
   client-SDK fallback scripts import it instead of inlining. **DONE**
3. `config/firebase-config-template.js` is now a placeholder-only template and
   `docs/FIREBASE_SETUP.md` points at the shared modules. **DONE**

Note: the apiKey is not a secret for a Firebase web app (it's shipped to every browser),
so this is a DRY / maintainability fix, not a security one.

## 8. Deduplicate the CSP string

**Status: DONE** · **Size: small** · **Pairs with item 2**

The full ~600-character Content-Security-Policy is duplicated across 6 current locations:

- `index.html:9` — `<meta http-equiv="Content-Security-Policy">`
- `admin.html:7` — same meta
- `firebase.json` — **4 header blocks** (lines ~65, 78, 91, 104) with the identical value

Six copies to keep in sync. `vite.config.mjs:66` already does one regex patch on it for
local dev (`+ http://localhost:8400` to script-src), which hints the maintenance pain.

**Approach:** `config/csp.mjs` exports the reviewed policy string, and
`scripts/check-csp-sync.mjs` fails `prebuild` if either HTML meta tag or any of the 4
Firebase Hosting headers drifts. This keeps the current policy behavior unchanged while
making future CSP edits auditable. Revisit the policy contents with item 2 when dropping
`unsafe-inline`.

## 9. Review & simplify advisor permissions in `firestore.rules`

**Status: TODO** · **Size: medium** · **Owner: Marlie (needs product judgment, not just code)**

`firestore.rules` is 283 lines; `storage.rules` 47. Marlie's read: the advisor write rules
were made **too strict** in an earlier hardening pass and should be loosened where it's
creating friction, without opening real holes.

**What's there now (from a quick read — re-inspect before changing):**

- `isAdvisor` = verified `@ebhcs.org` email. Current rules do **not** enforce
  `firebase.sign_in_provider == 'google.com'`; the client uses Google popup, so keep
  Email/Password disabled if relying on Google-only login as the admin boundary.
- `isActiveAdvisor` = `isAdvisor` **AND** an `advisors/{username}` doc exists (or is privileged)
- `isPrivilegedAdvisor` = hardcoded `mcreed@ebhcs.org` / `lgregory@ebhcs.org`
- Bulletins: active advisors can update existing resource-type bulletins; authors and
  privileged advisors have broader post/update/delete rights; privileged advisors control
  advisor docs and role changes (`bulletins` block, ~lines 14–53)
- Heavy per-field validation in `validateBulletinData` / `validActionLinks` / `validHoursRows` /
  `validResourceContact` (~lines 150–283) — hardcoded unrolled loops for list items
  (`links.size() < 2 || validActionLinkItem(links[1])` … up to [4]), size caps, required-key
  checks. This is the most likely source of "the portal won't let me save" friction.

**Approach:**

1. **Deploy-inspect first.** Pull the *live* rules from Firebase Console and diff against
   `firestore.rules` in the repo — confirm they're actually in sync (the CI deploy pipeline
   deploys rules, but verify). Note: memory says rules were last deployed manually 2026-07-09
   and a Rules-Admin-role grant was needed for CI to deploy them.
2. **Identify the actual friction.** What specifically failed / felt over-restrictive?
   Candidates: the unrolled list validators rejecting valid input, size caps too low
   (labels ≤60, urls ≤500, ≤5 action links, ≤7 hours rows), required-key lists too rigid,
   the `postedBy == getUsername(email)` check on create blocking co-authoring.
3. **Treat permission loosening as a product/security decision, not basic cleanup.** The
   security boundary that must NOT weaken: `isAdvisor` (verified @ebhcs.org email, with
   Google-only enforced operationally unless rules add a provider check) + `isActiveAdvisor`
   (on the advisor list).
   Everything past that — which advisor can edit which post, field-level validation strictness —
   is a UX tuning knob. Reasonable target: any active advisor can create/edit/delete any
   bulletin (small trusted team), keep the type/size sanity checks but relax the exact-shape
   validation, keep privileged-only for the `advisors/` collection and role changes.
4. **Test with the emulator.** There's `scripts/run-with-emulator.mjs` and the Playwright
   suite already runs against it. Add rules-unit-tests (`@firebase/rules-unit-testing`) for
   the key allow/deny cases before changing permissions.
5. Deploy rules, then re-run the advisor portal walkthrough from
   `docs/Refactor-Test-Checklist.md` section C against production.
6. Update `docs/FIREBASE_SECURITY_RULES.md` to match whatever the rules end up saying.



## 10. Verify authentication is fully wired end-to-end

**Status: TODO** · **Size: small (mostly verification)** · **Owner: Marlie**

Marlie wants confidence the auth flow works completely. From a read it looks intact but
should be exercised deliberately, especially the edge cases.

**The flow (as built):**

- `admin.html` → `src/admin.js` imports `auth` from `firebase-auth.js`, registers
  `onAuthStateChanged`
- Sign-in button → `google-auth.js` `signInWithPopup(auth, GoogleAuthProvider)` (hosted-domain
  hint `hd: ebhcs.org`)
- `onAuthStateChanged(user)` fires → `verifyAdvisorAccess(user)` reads `advisors/{username}`
  → if the doc exists, dispatches `userAuthenticated` event → `admin.js` calls
  `mountAdvisorPortal(userDetails)` (lazy-loads `firebase-admin.js` + portal CSS + composer)
- No advisor doc → `rejectSignIn` with a "ask an admin to add you" message
- Sign-out → `signOut(auth)` → `onAuthStateChanged(null)` → `handleSignedOut()` →
  `window.adminPanel.handleSignedOut()` (in `admin-auth.js` after the refactor)

**Checklist:**

- [ ] Happy path: @ebhcs.org account **on** the advisor list → portal opens, correct name/role
- [ ] @ebhcs.org account **not** on the list → clean rejection message, no half-open portal
- [ ] `Non-@ebhcs.org` Google account → rejected (rules deny the `advisors/` read → treated as "not an advisor")
- [ ] Privileged admin (`mcreed@` / `lgregory@`) with **no** `advisors/` doc → still gets in
  (the `isPrivilegedAdvisor` bypass in `isActiveAdvisor`)
- [ ] Advisor removed from the list mid-session → next write is denied by rules; next sign-in is rejected
- [ ] Sign out → back to login screen, `adminPanel` torn down, no stale listeners
  (check `bulletinsUnsubscribe` is called)
- [ ] Page refresh while signed in → session restored, portal re-mounts without a re-login
- [ ] `verifyAdvisorAccess` error path (offline / timeout, NOT permission-denied) → surfaces
  "check your connection" instead of silently locking out a real advisor
- [ ] App Check: `firebase-app-check.js` — verify `VITE_FIREBASE_APPCHECK_SITE_KEY` is deployed
  and monitor-mode metrics look healthy before enabling enforcement. If App Check is enforced
  server-side but the site key is missing at build, every request 403s.
- [ ] `recordAdvisorLogin` — writes a last-login timestamp; confirm it's not throwing and
  not blocking the mount if it fails
- [ ] The `admin-roles.js` privileged-email list vs. `isPrivilegedAdvisor` in `firestore.rules`
  — there's a `scripts/check-admin-emails-sync.mjs` that gates the build on these matching;
  confirm it's still passing and the lists are right (`mcreed@ebhcs.org`, `lgregory@ebhcs.org`)

**Note:** items 9 and 10 are related — do the auth verification (10) first so you have a
known-good baseline, then loosen the rules (9) and re-verify.

## 11. Remove refactor-residue comments once stable

**Status: DONE** · **Size: small** · **Priority: polish**

Newly split modules no longer carry temporary "extracted verbatim" scaffolding comments.

## Add new items below as you find them.
