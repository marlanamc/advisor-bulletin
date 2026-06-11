# Deployment Guide

How the EBHCS Advisor Bulletin Board gets from this repository to the live site, and what to do when something goes wrong. Written for whoever maintains the site after handover — no prior Firebase experience assumed.

## How deploys happen (the normal path)

**Every push to the `main` branch on GitHub deploys to the live site automatically.** Treat merging to `main` as pressing "publish."

The GitHub Action (`.github/workflows/deploy.yml`) does this on each push:

1. **Test job** — installs dependencies and runs the full Playwright suite (`npm test`) against a local dev server. If any test fails, **the deploy is blocked** and the live site stays on its previous version. A failure report is attached to the workflow run as an artifact.
2. **Deploy job** — runs `npm run build` and publishes `dist/` to Firebase Hosting using the `FIREBASE_SERVICE_ACCOUNT` repository secret.

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

- **Who is an admin:** the `isPrivilegedAdvisor` function near the bottom of `firestore.rules` lists the admin emails (currently `admin@ebhcs.org` and `leah@ebhcs.org`). To change admins, edit that function, then deploy rules (`firebase deploy --only firestore:rules` or a full deploy). Also update `src/admin-roles.js` (the build fails if it drifts from the rules) and `docs/FIREBASE_SECURITY_RULES.md` so code, rules, and docs stay in sync.
- Rules changes are **not** deployed by the GitHub Action (it only publishes hosting). Deploy them manually as above.
- **Student advisor directory:** the doc `config/studentDirectory` (publicly readable, admin-writable) is republished automatically whenever an admin adds/edits/removes an advisor in the portal. The student site falls back to the static list in `src/advisor-directory.js` if the doc is missing.

## Service account (for maintenance scripts)

Some scripts in `scripts/` write to Firestore and need admin credentials:

1. Firebase Console → Project settings → **Service accounts** → "Generate new private key". This downloads a JSON file.
2. **Never commit that file.** Keep it outside the repository or rely on `.gitignore`.
3. Pass it to scripts with `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<name>.mjs` or `--credentials=./service-account.json` where supported.

See [scripts/README.md](../scripts/README.md) for what each script does.

## Billing and usage

The project uses four Firebase products: **Firestore** (post data), **Authentication** (advisor logins), **Storage** (uploaded images/PDFs), and **Hosting** (the site itself).

- On the free **Spark** plan the relevant limits are roughly: 50K Firestore reads/day, 20K writes/day, 1 GB Firestore storage, 5 GB file storage, 10 GB hosting transfer/month. A single school's bulletin board sits comfortably inside these.
- Check usage: Firebase Console → the **Usage and billing** page (gear icon). If students ever see "quota exceeded" errors late in the day, that's the daily read limit — the snapshot-first loading was designed specifically to keep reads low, so investigate before paying for anything.
- If the project is ever moved to the pay-as-you-go **Blaze** plan, set a budget alert in the same screen.

## Things a future maintainer should know

- **Contact email:** `index.html` currently lists `mcreed@ebhcs.org` as the student-facing contact (two places — search the file). When Marlie is no longer reachable, change this to a monitored address and redeploy. <!-- HANDOVER TODO -->
- **Node version:** use Node 20 (see `.nvmrc`; run `nvm use` if you have nvm).
- **Custom domain:** the site runs on Firebase Hosting's default domain. If the school adds a custom domain later: Firebase Console → Hosting → "Add custom domain" (Firebase handles the SSL certificate; you only add DNS records at the domain registrar).
- **Rollback:** Firebase Console → Hosting → Release history → "Rollback" instantly restores a previous version of the site without touching git.
