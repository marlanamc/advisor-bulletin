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

## 7. Deduplicate the Firebase config object

**Status: TODO** · **Size: small–medium**

The same 7-key `firebaseConfig` literal (apiKey, authDomain, projectId, storageBucket,
messagingSenderId, appId) is copy-pasted in:
- `src/firebase.js` (admin app — Firestore + Auth + Storage)
- `src/firebase-auth.js` (auth-only app — used by `admin.js`, `google-auth.js`)
- `src/firebase-student.js` (student app — Firestore only, keeps Storage/Auth SDK out of the student bundle)
- `config/firebase-config-template.js` (the "template" — but has real values except apiKey)
- **~8 scripts** (`build-student-feed-snapshot`, `import-resources`, `update-roles`,
  `cleanup-*-bulletins`, `patch-calendar-events`, `check-advisor-auth-sync`,
  `delete-imported-resources`) each embed it inline

Three separate client `initializeApp` calls are **intentional** (bundle-size isolation —
don't collapse the files). The **config object** is not — it should be a single export.

**Approach:**
1. `src/firebase-shared-config.js` exports the plain config object. The 3 client files
   import it instead of inlining. (~10 min, zero behavior change — verify build + suite.)
2. Scripts: `scripts/lib/firebase-config.mjs` (or reuse the src one if the import path
   works under plain Node). Point the ~8 scripts at it.
3. `config/firebase-config-template.js` — either delete (it's stale — real values, fake
   apiKey, and nothing uses it) or regenerate it from the shared module with the apiKey
   blanked. Check `docs/FIREBASE_SETUP.md` for references first.

Note: the apiKey is not a secret for a Firebase web app (it's shipped to every browser),
so this is a DRY / maintainability fix, not a security one.

## 8. Deduplicate the CSP string

**Status: TODO** · **Size: small** · **Pairs with item 2**

The full ~600-character Content-Security-Policy is triplicated:
- `index.html:9` — `<meta http-equiv="Content-Security-Policy">`
- `admin.html:7` — same meta
- `firebase.json` — **4 header blocks** (lines ~65, 78, 91, 104) with the identical value

Six copies to keep in sync. `vite.config.mjs:66` already does one regex patch on it for
local dev (`+ http://localhost:8400` to script-src), which hints the maintenance pain.

**Approach:** single source of truth — e.g. `config/csp.js` exports the policy string;
a small Vite plugin injects it into the HTML `<meta>` at build time, and `firebase.json`
is generated (or a build step asserts the 4 blocks match the source and fails otherwise,
like the existing `check-*-sync.mjs` scripts do for other config). Do this **with** item 2
(dropping `unsafe-inline`) so the policy only has to be edited once.

## 9. Review & simplify advisor permissions in `firestore.rules`

**Status: TODO** · **Size: medium** · **Owner: Marlie (needs product judgment, not just code)**

`firestore.rules` is 283 lines; `storage.rules` 47. Marlie's read: the advisor write rules
were made **too strict** in an earlier hardening pass and should be loosened where it's
creating friction, without opening real holes.

**What's there now (from a quick read — re-inspect before changing):**
- `isAdvisor` = verified Google `@ebhcs.org` account (Workspace-issued, `firebase.sign_in_provider == 'google.com'`)
- `isActiveAdvisor` = `isAdvisor` **AND** an `advisors/{username}` doc exists (or is privileged)
- `isPrivilegedAdvisor` = hardcoded `mcreed@ebhcs.org` / `lgregory@ebhcs.org`
- Bulletins: any active advisor can **update any** bulletin; only the author or a privileged
  advisor can **change ownership fields / delete** (`bulletins` block, ~lines 14–53)
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
3. **Loosen deliberately, keep the boundary.** The security boundary that must NOT weaken:
   `isAdvisor` (real @ebhcs.org Google account) + `isActiveAdvisor` (on the advisor list).
   Everything past that — which advisor can edit which post, field-level validation strictness —
   is a UX tuning knob. Reasonable target: any active advisor can create/edit/delete any
   bulletin (small trusted team), keep the type/size sanity checks but relax the exact-shape
   validation, keep privileged-only for the `advisors/` collection and role changes.
4. **Test with the emulator.** There's `scripts/run-with-emulator.mjs` and the Playwright
   suite already runs against it. Add rules-unit-tests (`@firebase/rules-unit-testing`) for
   the key allow/deny cases if there aren't any — this is worth doing before loosening.
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
- [ ] Non-@ebhcs.org Google account → rejected (rules deny the `advisors/` read → treated as "not an advisor")
- [ ] Privileged admin (`mcreed@` / `lgregory@`) with **no** `advisors/` doc → still gets in
      (the `isPrivilegedAdvisor` bypass in `isActiveAdvisor`)
- [ ] Advisor removed from the list mid-session → next write is denied by rules; next sign-in is rejected
- [ ] Sign out → back to login screen, `adminPanel` torn down, no stale listeners
      (check `bulletinsUnsubscribe` is called)
- [ ] Page refresh while signed in → session restored, portal re-mounts without a re-login
- [ ] `verifyAdvisorAccess` error path (offline / timeout, NOT permission-denied) → surfaces
      "check your connection" instead of silently locking out a real advisor
- [ ] App Check: `firebase-app-check.js` — is `VITE_FIREBASE_APPCHECK_SITE_KEY` set in the
      deploy env? If App Check is enforced server-side but the site key is missing at build,
      every request 403s. Confirm it's configured (or intentionally not enforced yet).
- [ ] `recordAdvisorLogin` — writes a last-login timestamp; confirm it's not throwing and
      not blocking the mount if it fails
- [ ] The `admin-roles.js` privileged-email list vs. `isPrivilegedAdvisor` in `firestore.rules`
      — there's a `scripts/check-admin-emails-sync.mjs` that gates the build on these matching;
      confirm it's still passing and the lists are right (`mcreed@ebhcs.org`, `lgregory@ebhcs.org`)

**Note:** items 9 and 10 are related — do the auth verification (10) first so you have a
known-good baseline, then loosen the rules (9) and re-verify.

## Add new items below as you find them.
