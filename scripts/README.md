# Maintenance Scripts

One-off and recurring maintenance tools. Run them from the repository root with Node 20 (`nvm use`).

**Credentials:** scripts marked 🔑 write to (or read privileged data from) Firestore and need a service-account key — see "Service account" in [DEPLOYMENT.md](../docs/DEPLOYMENT.md). Pass it as `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/<name>.mjs` (most also accept `--credentials=./service-account.json`).

**Safety:** every destructive script supports `--dry-run`. Always dry-run first.

## Used automatically by the build

- **build-student-feed-snapshot.mjs** — regenerates `public/student-feed-snapshot.json` (the instant-loading static feed). Runs in `prebuild`. Uses a service account if available, otherwise falls back to the public client SDK; if Firestore is unreachable it keeps the existing snapshot so the build never breaks. Flags: `--credentials=…`, `--no-client`.
- **check-resource-categories-sync.mjs** — fails the build if the resource category list in `src/resource-categories.js` drifts from the whitelist in `firestore.rules`. No credentials. If it fails, make the two lists match.

## Used automatically by tests

- **run-with-emulator.mjs** — wraps a test command in `firebase emulators:exec`, setting `VITE_USE_FIREBASE_EMULATOR=true` so the app connects to a local Firestore/Auth/Storage emulator instead of production. This is what `npm test`/`test:mobile`/`test:ui`/`test:headed` actually run under the hood (see `package.json`) — you shouldn't need to call it directly. Requires Java locally (`brew install openjdk` on macOS); see "Tests run against an emulator, not production" in [DEPLOYMENT.md](../docs/DEPLOYMENT.md) for why this exists.

## Auditing

- **dump-live-resources.mjs** 🔑 — read-only dump of all `type: 'resource'` bulletins straight from Firestore (title, url, actionLinks, category). Use this instead of `public/student-feed-snapshot.json` for anything that needs current data — the snapshot only refreshes on a push to `main` or the daily cron, so it can be stale by days or weeks relative to portal edits. Usage: `node scripts/dump-live-resources.mjs [--category=housing] [--json]`. See "Never audit against the snapshot" in [DEPLOYMENT.md](../docs/DEPLOYMENT.md).
- **apply-resource-order-audit.mjs** 🔑 — applies the Aug 2026 "Find Help" reorder audit's recommended `resourceOrder` values, writing by known doc ID (zero reads, same trick as `apply-audit-links.mjs`). Covers the 53 resources present in the Jul 9 snapshot; 16 items added/edited since then (new Aug 8 resources, plus a few flagged for verify/archive) are listed in the script's `PENDING_LOOKUP` with no doc ID yet — resolve those with `dump-live-resources.mjs` once the daily read quota resets, then add them to `RESOURCE_ORDER` and rerun. Usage: `node scripts/apply-resource-order-audit.mjs [--confirm]`.
- **check-resource-links.mjs** 🔑 — pulls every resource's `url` and `actionLinks` from Firestore (one read) and makes a real HTTP request against each to flag anything dead, redirected to a new domain, or returning a 403 (often a bot-block, not necessarily dead — flagged separately). Runs weekly via `.github/workflows/check-resource-links.yml`, which opens/updates a single tracking GitHub Issue labeled `link-check` when it finds broken links, and closes it once everything's clean again. This only checks liveness — it does not judge whether a *better*, more specific page exists (that needs a human/AI reading the page; ask for a manual audit pass for that). Usage: `node scripts/check-resource-links.mjs [--json=report.json] [--concurrency=5]`.

## Account management

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
- **cleanup-inactive-draft-bulletins.mjs** — lists and optionally deletes inactive **post** placeholders left by failed publishes (`type === 'post'` only; never touches resources). Dry-run by default; `--confirm` to delete. Signs in as `mcreed@ebhcs.org` (password prompt) when no service account is configured.
- **cleanup-stale-bulletins.mjs** — permanently deletes inactive bulletins of **all types** whose `updatedAt` is older than 180 days (configurable with `--days=`). Dry-run by default; `--confirm` to delete. Use for long-term Firestore hygiene after advisors have archived old content.
- **prune-client-errors.mjs** 🔑 — deletes `errors` collection documents older than 90 days. Run via npm: `npm run prune:errors` (dry-run) then `npm run prune:errors:confirm`. Mentioned in the director guide monthly checklist.
- **patch-calendar-events.mjs** 🔑 — one-time backfill: sets `hideFromMainFeed: true` on calendar events saved before the Event composer fix. Dry-run by default; `--fix` to write. Use `--login` to sign in as `mcreed@ebhcs.org` (no service-account file), or pass `--credentials=…` / `GOOGLE_APPLICATION_CREDENTIALS`.

## Analytics

- **clear-analytics-events.mjs** 🔑 — deletes historical `analyticsEvents` documents (engagement analytics are no longer collected; this only cleans up old data). Run via npm: `npm run clear:analytics` (dry-run) then `npm run clear:analytics:confirm`.
