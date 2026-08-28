# Resource bulk import guide

Use this workflow to curate resources in Google Sheets, export CSV, and import them into Firestore as **unpublished** drafts for advisor review.

The launch CSV is intentionally selective. It should contain roughly **30-50 high-value resources**, not every row in the advisor guide.

## CSV columns

| Column | Required | Notes |
|--------|----------|-------|
| `include` | Yes | `Y` to import, anything else skips the row |
| `sourceName` | No | Source sheet/file name for advisor review context |
| `sheetTab` | No | Backward-compatible source tab name; used for category defaults if `resourceCategory` is blank |
| `orgName` | Yes | Organization name -> `titleEn` / card title |
| `resourceCategory` | No | Override tab default — see mapping below |
| `serviceChips` | Yes* | Short labels, semicolon- or comma-separated (max 6 after merge) |
| `url` | No* | Website — auto-prefixed with `https://` if missing |
| `address` | No* | Street address for directions |
| `phone` | No* | Phone number |
| `hours` | No | Scheduling / visit notes (shown on cards + detail) |
| `languages` | No | Semicolon- or comma-separated (e.g. `ENG; ESP`) |
| `advisorName` | No | Defaults to `Import` if blank |
| `description` | No | Optional advisor notes — **detail view only**, not on cards |
| `launchPriority` | No | Review-only ranking; not imported into Firestore |
| `verificationStatus` | No | Review-only status such as `guide-link-trusted` or `needs-review-trusted` |
| `excludeReason` | No | Review-only reason when a row is kept in a working sheet but not imported |
| `sourceRow` | No | Review-only original spreadsheet row number |

\* At least one of `url`, `address`, or `phone` is required. At least one `serviceChip` **or** `description` is required.

## Sheet tab → category mapping

| Sheet tab | Default `resourceCategory` |
|-----------|---------------------------|
| Basic/Misc. Needs | `food` (override per row to `family` or `money` when needed) |
| Housing | `housing` |
| Workforce/Training | `jobs` |
| Education | `college` (override to `hse` for GED/HSE rows) |
| Health & Wellness | `health` |
| Immigration/Legal | `immigration` (override to `legal-aid` for general legal help, or `consulates` for a foreign consulate) |

Valid categories match the student app: `immigration`, `jobs`, `housing`, `health`, `food`, `family`, `hse`, `college`, `legal-aid`, `money`, `consulates`.

## Curation checklist (`include=Y`)

- **Student-relevant** — EBHS students can realistically use it
- **Actionable** — has phone, address, or website (not dead links)
- **Specific** — can be summarized in 1–6 chips (refine or skip vague rows)
- **Not duplicate** — same org + category merges into one card with combined chips
- **Category fits** — one primary Help topic per resource
- **Low-literacy card copy** — service chips are the student-facing summary; put schedules and conditions in `hours` or `description`

Target **30-50 resources** for launch, not every sheet row.

## Chip normalization (automatic in import script)

Common phrase mappings:

| Source text | Normalized chip |
|-------------|-----------------|
| Food Stamp/SNAP, SNAP, Food Stamps | SNAP Help |
| Community Service/Immigration | Immigration Help |
| Grocery bags | Grocery Bags |
| Free diapers & wipes | Free Diapers |
| Housing Advocacy, Housing Support | Housing Help |
| Legal Assistance, Legal Support | Legal Help |
| Health insurance help | Health Insurance Help |
| Tax prep, VITA | Tax Help |

Schedule text trailing a chip label is stripped; put schedules in `hours` instead.

## Merge rules

Rows with the same **normalized org name + `resourceCategory`** merge into one Firestore resource:

- Service chips are unioned (deduped, max 6)
- First non-empty `url`, `address`, `phone`, `hours` wins
- `description` paragraphs are joined with blank lines

## Running the import

```bash
# Preview only (no writes)
node scripts/import-resources.mjs data/resource-import-template.csv --dry-run

# Write unpublished drafts to Firestore
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node scripts/import-resources.mjs data/your-export.csv
```

> **The import always creates new documents.** It has no dedupe step — every
> `include=Y` row becomes a fresh Firestore doc. Re-running it over the full
> template would duplicate everything already imported. To add resources
> incrementally, put only the new rows in their own batch file and import that:
>
> ```bash
> node scripts/import-resources.mjs data/resource-additions-2026-08.csv --dry-run
> ```
>
> `data/resource-additions-2026-08.csv` is the August 2026 audit batch (12 rows).
> Its rows are also appended to the template above so the template stays the
> canonical full set and `seed-resource-descriptions.mjs` manages their copy.

Without a service account, the script falls back to Firebase client auth (prompts for admin password).

Imported resources default to **`isPublished: false`**.

## Resources added through the portal

Four live resources were created in the Advisor Portal rather than imported, so
they have no `importSource: csv-import` field and are not in the CSV:
**World Education Services (WES)**, **Roxbury Community College**,
**Permission to Share Your Case Info (ICE/DHS)** and **Massachusetts HiSET**.

`update-imported-summaries.mjs` skips them (it filters on `importSource`), and
adding them to the CSV would create duplicates on the next import. Their wording
still lives in the `COPY` map in `seed-resource-descriptions.mjs` so there is one
source of truth — but reaching Firestore means pasting it in the portal by hand.

## Advisor review (portal)

1. Sign in to the Advisor Portal → **My Posts**
2. Filter or sort by **Resources**
3. Open each imported draft — verify chips, contact info, and category
4. Toggle **Published** and save, category by category

## Template file

Start from [`resource-import-template.csv`](./resource-import-template.csv) — it contains the curated v1 launch set from the advisor guide.
