# Maintenance Scripts

One-off and recurring maintenance tools. Run them from the repository root with Node 20 (`nvm use`).

**Credentials:** scripts marked 🔑 write to (or read privileged data from) Firestore and need a service-account key — see "Service account" in [DEPLOYMENT.md](../docs/DEPLOYMENT.md). Pass it as `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<name>.mjs` (most also accept `--credentials=./service-account.json`).

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
- **cleanup-inactive-draft-bulletins.mjs** — lists and optionally deletes inactive **post** placeholders left by failed publishes (`type === 'post'` only; never touches resources). Dry-run by default; `--confirm` to delete. Signs in as `admin@ebhcs.org` (password prompt) when no service account is configured.
- **patch-calendar-events.mjs** 🔑 — one-time backfill: sets `hideFromMainFeed: true` on calendar events saved before the Event composer fix. Dry-run by default; `--fix` to write. Use `--login` to sign in as `admin@ebhcs.org` (no service-account file), or pass `--credentials=…` / `GOOGLE_APPLICATION_CREDENTIALS`.

## Analytics

- **clear-analytics-events.mjs** 🔑 — deletes historical `analyticsEvents` documents (engagement analytics are no longer collected; this only cleans up old data). Run via npm: `npm run clear:analytics` (dry-run) then `npm run clear:analytics:confirm`.
