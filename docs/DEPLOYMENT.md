# Deployment Guide

How the EBHCS Advisor Bulletin Board gets from this repository to the live site, and what to do when something goes wrong. Written for whoever maintains the site after handover — no prior Firebase experience assumed.

## How deploys happen (the normal path)

**Every push to the `main` branch on GitHub deploys to the live site automatically.** Treat merging to `main` as pressing "publish."

The GitHub Action (`.github/workflows/deploy.yml`) does this on each push:

1. **Test job** — installs dependencies and runs the full Playwright suite (`npm test`) against a local dev server **and a local Firebase emulator** (see "Tests run against an emulator, not production" below). If any test fails, **the deploy is blocked** and the live site stays on its previous version. A failure report is attached to the workflow run as an artifact.
2. **Deploy job** — runs `npm run build`, publishes `dist/` to Firebase Hosting, and deploys `firestore.rules` and `storage.rules` using the `FIREBASE_SERVICE_ACCOUNT` repository secret.

`npm run build` automatically runs two pre-steps (`prebuild` in package.json):

- `scripts/build-student-feed-snapshot.mjs` — regenerates `public/student-feed-snapshot.json`, the static copy of the feed that students see instantly before Firebase loads. In CI it uses the client SDK fallback (no credentials needed). **If it can't reach Firestore, the build still succeeds and reuses the last committed snapshot** — students just see slightly older cards for the first second of their visit.
- `scripts/check-resource-categories-sync.mjs` — fails the build on purpose if the resource category list in `src/resource-categories.js` has drifted from the whitelist in `firestore.rules`. If your build fails with a category-sync message, make those two lists match again.

**Where to look when a deploy fails:** GitHub repository → **Actions** tab → click the failed run. A failed *test* job means the code change broke something (download the `playwright-report` artifact to see what). A failed *deploy* job usually means a Firebase permission/secret problem. Either way, **the live site is unaffected** — it simply keeps running the previous version.

## Deploying manually from a computer

You only need this if GitHub Actions is unavailable or you're doing something unusual.

One-time setup:

```bash
npm install -g firebase-tools
firebase login          # opens a browser; sign in with an account that has access
                        # to the "ebhcs-bulletin-board" project in Firebase Console
```

Your Google account must be added as a member of the Firebase project first: Firebase Console → Project settings → Users and permissions.

Then:

```bash
npm install
npm run deploy          # = npm run build + firebase deploy
```

`firebase deploy` also publishes `firestore.rules` and `storage.rules`, so a manual deploy is the way to ship security-rule changes.

## Firestore security rules

The rules in `firestore.rules` are the real security boundary of the site (the Firebase API key in the source code is public by design — that is normal for Firebase web apps).

- **Who is an admin:** the `isPrivilegedAdvisor` function near the bottom of `firestore.rules` lists the admin emails (currently `mcreed@ebhcs.org` and `lgregory@ebhcs.org`). To change admins, edit that function, then deploy rules (`firebase deploy --only firestore:rules` or a full deploy). Also update `src/admin-roles.js` (the build fails if it drifts from the rules) and `docs/FIREBASE_SECURITY_RULES.md` so code, rules, and docs stay in sync.
- Rules changes ship automatically with every push to `main` (the deploy job runs `firebase deploy --only firestore:rules,storage:uploads`). For an emergency rules-only deploy without a code change, run `firebase deploy --only firestore:rules,storage:uploads` manually (see below).
- **Student advisor directory:** the doc `config/studentDirectory` (publicly readable, admin-writable) is republished automatically whenever an admin adds/edits/removes an advisor in the portal. The student site falls back to the static list in `src/advisor-directory.js` if the doc is missing.

## Service account (for maintenance scripts)

Some scripts in `scripts/` write to Firestore and need admin credentials:

1. Firebase Console → Project settings → **Service accounts** → "Generate new private key". This downloads a JSON file.
2. **Never commit that file.** Keep it outside the repository or rely on `.gitignore`.
3. Pass it to scripts with `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<name>.mjs` or `--credentials=./service-account.json` where supported.

See [scripts/README.md](../scripts/README.md) for what each script does.

## Tests run against an emulator, not production

**`npm test` (and `test:mobile`/`test:ui`/`test:headed`) boot a local Firebase emulator first** — the test suite never touches real Firestore. This was added in August 2026 after discovering the test suite was the single biggest driver of the project's Firestore read quota: every `page.goto()` fires a real `onSnapshot` listener capped at `limit(500)`, and each fire re-counts every document in the result as a read. 63 tests × 2 browser projects on every push could burn 60,000+ reads — the entire daily Spark-plan budget — from one `git push`.

How it works:
- `scripts/run-with-emulator.mjs` wraps the Playwright command in `firebase emulators:exec`, setting `VITE_USE_FIREBASE_EMULATOR=true` for the duration of the run.
- `src/firebase.js` and `src/firebase-student.js` (the two independent Firebase SDK initializations — one for the admin portal, one for the lean student site) check that env var and call `connectFirestoreEmulator`/`connectAuthEmulator`/`connectStorageEmulator` when it's set. Production behavior is unchanged — this only activates under the explicit flag.
- Emulator ports and config live in `firebase.json`'s `emulators` block (Firestore 8080, Auth 9099, Storage 9199, UI 4000).
- Tests don't need real-looking seed data: nearly every spec overwrites `window.bulletinBoard.bulletins` with an inline fixture via `page.evaluate` before asserting, so the emulator just needs to be reachable and return fast (mostly empty) responses for that first real-data page load.

**Requires Java** (the Firestore emulator is JVM-based). GitHub's `ubuntu-latest` runners get it via an explicit `actions/setup-java@v5` step in both `deploy.yml` and `full-test-matrix.yml`. To run tests locally: `brew install openjdk` (macOS, keg-only — add `/opt/homebrew/opt/openjdk/bin` to your `PATH`), or your OS's equivalent.

## Billing and usage

The project uses four Firebase products: **Firestore** (post data), **Authentication** (advisor logins), **Storage** (uploaded images/PDFs), and **Hosting** (the site itself).

- On the free **Spark** plan the relevant limits are roughly: 50K Firestore reads/day, 20K writes/day, 1 GB Firestore storage, 5 GB file storage, 10 GB hosting transfer/month. A single school's bulletin board sits comfortably inside these — now that CI runs against the emulator instead of production (see above), real usage should mostly come from actual site visitors and admin activity, not test runs.
- Check usage: Firebase Console → the **Usage and billing** page (gear icon). If students ever see "quota exceeded" errors late in the day, that's the daily read limit — the snapshot-first loading was designed specifically to keep reads low, so investigate before paying for anything.
- If the project is ever moved to the pay-as-you-go **Blaze** plan, set a budget alert in the same screen.

## Daily snapshot refresh

A separate workflow (`.github/workflows/refresh-snapshot.yml`) rebuilds and redeploys hosting **once per day at 09:00 UTC** (and on manual trigger via **Actions → Refresh Student Feed Snapshot → Run workflow**). This keeps `student-feed-snapshot.json` from going stale between code pushes — without it, students can briefly see bulletins that were deleted or expired since the last deploy.

The refresh workflow runs `npm run build` (which regenerates the snapshot) and deploys hosting only. It does **not** redeploy security rules.

## Things a future maintainer should know

- **Never audit against `public/student-feed-snapshot.json`.** It's a first-paint cache only, refreshed by a push to `main` or the daily 09:00 UTC cron — nothing regenerates it when an advisor saves an edit in the portal, so the copy in the repo (or even a recent-looking deploy) can trail live Firestore by days or weeks. For anything that needs current data (link audits, content checks, counting resources), use `scripts/dump-live-resources.mjs` instead, which reads Firestore directly: `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/dump-live-resources.mjs --json`. (Learned the hard way in August 2026 — a resource-link audit flagged 4 resources as broken/dead that had already been fixed live, because it read the stale snapshot file.)
- **Contact email:** `index.html` currently lists `mcreed@ebhcs.org` as the student-facing contact (two places — search the file). When Marlie is no longer reachable, change this to a monitored address and redeploy. See [SUCCESSION_CHECKLIST.md](SUCCESSION_CHECKLIST.md) for the full handoff steps.
- **Node version:** use Node 22 (see `.nvmrc`; run `nvm use` if you have nvm).
- **Custom domain:** the site runs on Firebase Hosting's default domain. If the school adds a custom domain later: Firebase Console → Hosting → "Add custom domain" (Firebase handles the SSL certificate; you only add DNS records at the domain registrar).
- **Rollback:** Firebase Console → Hosting → Release history → "Rollback" instantly restores a previous version of the site without touching git.
