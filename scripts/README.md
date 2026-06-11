# Maintenance Scripts

One-off and recurring maintenance tools. Run them from the repository root with Node 20 (`nvm use`).

**Credentials:** scripts marked 🔑 write to (or read privileged data from) Firestore and need a service-account key — see "Service account" in [DEPLOYMENT.md](../DEPLOYMENT.md). Pass it as `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<name>.mjs` (most also accept `--credentials=./service-account.json`).

**Safety:** every destructive script supports `--dry-run`. Always dry-run first.

## Used automatically by the build

- **build-student-feed-snapshot.mjs** — regenerates `public/student-feed-snapshot.json` (the instant-loading static feed). Runs in `prebuild`. Uses a service account if available, otherwise falls back to the public client SDK; if Firestore is unreachable it keeps the existing snapshot so the build never breaks. Flags: `--credentials=…`, `--no-client`.
- **check-resource-categories-sync.mjs** — fails the build if the resource category list in `src/resource-categories.js` drifts from the whitelist in `firestore.rules`. No credentials. If it fails, make the two lists match.

## Account management

- **mark-password-change.mjs** 🔑 — sets `requirePasswordChange: true` on user docs so advisors must set a new password at next login. Use after creating accounts with temporary passwords. Flags: `--only u1,u2`, `--exclude u1,u2`, `--dry-run`, `--help`.
- **update-roles.mjs** — interactive; signs in as an admin and writes `users/{id}` role docs (display name, email, isAdmin) for `leah`, `admin`, and `mcreed`. Edit the `TARGETS` list at the top before running if roles change.

## Bulk resource import pipeline (CSV → Firestore)

These were used for the one-time import of curated community resources from `data/resource-import-template.csv`. Keep them in case the school imports another batch.

- **import-resources.mjs** 🔑 — imports rows from a CSV into Firestore as unpublished resources (`importSource: 'csv-import'`). Usage: `node scripts/import-resources.mjs path/to/file.csv [--dry-run]`.
- **publish-imported-resources.mjs** 🔑 — bulk-publishes imported-and-still-unpublished resources. Safe to re-run; never touches hand-created posts.
- **inspect-imported-resources.mjs** 🔑 — read-only dump of what the importer wrote (`--limit=10`).
- **delete-imported-resources.mjs** 🔑 — deletes **only** docs with `importSource == 'csv-import'`. Dry-run first.
- **seed-resource-descriptions.mjs** — fills the description column of the local CSV template with curated EN/ES summaries (no Firestore access). `--write` to save.
- **update-imported-summaries.mjs** 🔑 — pushes the latest EN/ES summaries from the seeder into already-imported Firestore docs, matched by org name + category.
- **split-resource-descriptions.mjs** 🔑 — one-time fix that split combined "English. Español: …" descriptions into separate fields. Safe to re-run (skips already-split docs).
- **repair-resource-visibility.mjs** 🔑 — diagnoses why a specific resource isn't visible to students (finds it by partial title, prints every visibility flag). `--fix` sets `isPublished`/`isActive` to true.

## Analytics

- **clear-analytics-events.mjs** 🔑 — deletes historical `analyticsEvents` documents (engagement analytics are no longer collected; this only cleans up old data). Run via npm: `npm run clear:analytics` (dry-run) then `npm run clear:analytics:confirm`.
