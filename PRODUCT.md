# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two roles, two surfaces:

- **Students (index.html, public feed):** ESOL/adult-education students at East Boston Harborside Community School (EBHCS), with mixed English proficiency and mixed digital literacy. They browse on phones, often for time-sensitive help: jobs, housing, legal aid, health, SNAP, English classes. They use "Find Help" to scan by action/topic rather than reading long text blocks.
- **Advisors (admin.html, portal):** EBHCS staff who post and manage Bulletins, Resources, and Calendar/Events for students. They sign in with a Google Workspace (`@ebhcs.org`) account and must already be on the admin-managed Advisors list.
- **Admins:** `mcreed@ebhcs.org` and `lgregory@ebhcs.org` — privileged advisors with global edit/delete override across all posts (authoritative list: `isPrivilegedAdvisor` in `firestore.rules`).

## Product Purpose

A bilingual (English/Spanish) community bulletin board so EBHCS advisors can publish job listings, training, resources, and events, and ESOL students can find and act on them quickly. Success is a student finding relevant help (and knowing what action to take next — call, get directions, open a form) faster than a plain announcements list would allow.

## Positioning

Not a generic school announcements board: it is purpose-built for adult ESOL students navigating help in a second language — action-oriented resource cards (Call, Directions, Website, Open form, PDF) and bilingual labeling do the work that a text-heavy bulletin board or generic CMS would not.

## Operating Context

- Public feed at `index.html`; advisor portal at `admin.html` (linked from the bottom of the public feed).
- Advisors create three post kinds: Bulletins, Resources, Calendar/Events — each with optional detail blocks (Spanish text, dates, links, contact info, audience, resource action buttons).
- Resource cards carry student-facing action chips and up to 5 extra URL/PDF buttons.
- PDF flyers up to 10MB, stored as base64 attachments.
- Expired posts get a grayscale diagonal "EXPIRED" ribbon and are hidden from the public feed by default (toggle to show).
- Repeated events / multi-session bulletins stay visible as upcoming sessions approach instead of requiring duplicate posts.
- A student-feed snapshot is built at `npm run build:snapshot` (prebuild step) for a fast, snapshot-first initial load.

## Capabilities and Constraints

- **Auth:** Google Workspace sign-in only, restricted to `@ebhcs.org` accounts already on the Firestore `advisors/{username}` list. No passwords.
- **Backend:** Firebase (Firestore + Hosting); Firestore security rules are the authoritative security boundary. CI on push to `main` runs tests, then deploys hosting and rules.
- **Storage:** No Firebase Storage/CDN for attachments — PDFs and images are stored as base64 directly in documents (10MB cap).
- **Budget: this project is self-funded.** Favor free-tier-friendly, low/no-recurring-cost choices (fonts, icons, services, asset pipelines). Do not assume budget for paid stock imagery, paid icon sets, paid fonts, or paid third-party UI/analytics services.
- **Bilingual:** Complete English/Spanish toggle is a binding, existing feature — not optional polish.
- **Testing:** Playwright E2E suite (desktop + mobile viewports) gates every deploy; treat it as a constraint on structural/markup changes, not just a nice-to-have to keep green.

## Brand Commitments

- Name: EBHCS Advisor Bulletin Board.
- Bilingual English/Spanish across headings, filters, buttons, and help drawers is a binding commitment, not an optional nicety.
- Icon-forward, action-verb resource actions (Call, Directions, Website, Open form) are an established, binding interaction pattern for the student surface.

## Evidence on Hand

- `docs/ADVISOR_GUIDE.md` and `docs/screenshots/` document the current student Find Help experience (desktop + mobile) and the advisor login/dashboard flow — real screenshots, usable as current-state evidence.
- `docs/advisor-posting-guide.html` is a printable version of the advisor guide.
- No testimonials, case studies, press, pricing, or usage-metric claims exist; do not fabricate any.

## Product Principles

1. Design for a second-language reader first: icons and action verbs carry meaning that dense English text cannot.
2. Assume a phone, not a desktop, is the primary device for students.
3. Every resource should tell the student the next concrete action (call, get directions, open a form) rather than just describing the opportunity.
4. Keep the advisor posting flow simple enough for infrequent, non-technical staff users to complete unassisted.
5. Prefer free/low-cost technical choices — this project has no ongoing budget.

## Accessibility & Inclusion

- Low English literacy: icon-forward UI, plain language, action-verb chips over dense text blocks.
- Low digital literacy: large tap targets, minimal steps, avoid nested menus/modals that confuse infrequent computer users.
- WCAG 2.1 AA is a required formal standard (contrast, focus states, screen-reader support), not just good practice.
