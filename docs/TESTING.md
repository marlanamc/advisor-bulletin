# Testing and Maintenance Guide

## Overview
The project has three separate suites: Node unit tests, Firestore security-rule tests, and Playwright browser tests across four viewport sizes.

## Weekly check-in

1. Open [GitHub Actions](https://github.com/marlanamc/advisor-bulletin/actions). Check **Full Playwright Matrix** as well as **Production Health Check**; a healthy live site does not mean the browser suite passed. Read the most recent completed run and its failed step, including retries/flaky tests and the downloadable Playwright report.
2. Review [open issues](https://github.com/marlanamc/advisor-bulletin/issues). Prioritize failed tests or broken student links, then resource accuracy. Review five due resource cards per session. Compare the card with the organization's current information before pressing **Verified today** in the portal.
3. After code changes, run `npm run test:check`. This stops at the first failing suite. To debug only a browser spec, use `npm test -- tests/story-row-collapse.spec.js --project=mobile`.
4. After merging, confirm the **Deploy to Firebase** run succeeds and check the live student and advisor pages. Use [the demo checklist](Demo-Test-Checklist.md) for the manual flows.

The full matrix runs on pull requests to `main`, weekly on Mondays, and manually through **Run workflow**. Deploys run unit/rules tests plus desktop and mobile browser tests. These workflow changes take effect on GitHub once merged; local edits alone do not update CI.

### Backlog reviewed October 1, 2026

**Dependency audit repair (October 1):** the original audit reported 7 high and 18 moderate vulnerable package entries. The high-severity findings are addressed by updating `brace-expansion` and `undici` within their existing major versions and pinning Firestore's nested `@grpc/grpc-js` dependency to patched version `1.14.5` using a scoped npm override. Firebase remains on 12.13.0; no forced SDK downgrade or audit-threshold change is involved. The regenerated lockfile also deduplicates the other gRPC copies onto 1.14.5. The deployment audit now passes locally; 18 moderate findings remain for separate maintenance.

The override is needed because Firestore still declares `~1.9.0`. Keep it until an upstream Firebase release supports a patched gRPC version, then remove it and rerun the audit, rules tests, browser tests, and build. [gRPC security advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j). `npm run test:check` now starts with the same dependency audit as deployment, and the full matrix also audits dependencies on pull requests, weekly runs, and manual runs. Remaining moderate findings are tracked in [#24](https://github.com/marlanamc/advisor-bulletin/issues/24).

| Issue | Remaining work |
|---|---|
| [#12: 20 cards due](https://github.com/marlanamc/advisor-bulletin/issues/12) | All 20 have no verification date. Start with health/housing and eligibility-sensitive resources, then work through five at a time. The live issue is the current checklist. |
| [#8: price recheck](https://github.com/marlanamc/advisor-bulletin/issues/8) | **Confirmed stale pricing; update these two cards first.** CED now lists $90 general / $145 course-by-course / $195 with GPA; Spanish/Portuguese interpretation is $25 general or $50 course-by-course. WES lists $118–$239 for its four U.S. packages, before delivery and other fees. WES also appears in #12. |
| [#14: three links to verify](https://github.com/marlanamc/advisor-bulletin/issues/14) | Browser-checked October 1: BHCC's homepage and application page and the Peru consulate page all loaded normally without a certificate interstitial. No link edit indicated. The September 28 scan found zero broken links. The automated issue may repeat the Node certificate-chain warnings. |

GitHub cleanup on October 1: #14 was closed after the browser checks; #8 has a comment with verified price corrections; #12 remains open for its 20 content reviews. The deployment audit blocker is tracked in [#23](https://github.com/marlanamc/advisor-bulletin/issues/23). An automated check succeeding only means the checker ran; it does not clear its findings.

Price sources checked October 1: [CED application fee schedule](https://apply.cedevaluations.com/product/application-form/) and [WES evaluation fees](https://www.wes.org/evaluations/). The live cards still need edits in the advisor portal. Suggested replacement pricing sentences:

- **CED — English:** “Evaluations start at $90. A course-by-course report costs $145, or $195 with a GPA. Spanish and Portuguese document interpretation costs extra: $25 for a general report or $50 for a course-by-course report. Ask your advisor which report you need before paying.”
- **CED — Spanish:** “Las evaluaciones cuestan desde $90. Un informe curso por curso cuesta $145, o $195 con promedio de calificaciones (GPA). La interpretación de documentos en español o portugués cuesta $25 adicionales para un informe general o $50 para uno curso por curso. Pregunta a tu asesor qué informe necesitas antes de pagar.”
- **WES — English:** “U.S. evaluation packages cost $118–$239, depending on the report and service. Delivery and other fees are extra. Ask your advisor which report your school or employer accepts before paying.”
- **WES — Spanish:** “Los paquetes de evaluación para Estados Unidos cuestan entre $118 y $239, según el informe y el servicio. El envío y otros cargos se cobran aparte. Pregunta a tu asesor qué informe acepta tu escuela o empleador antes de pagar.”

## Mobile CSS Improvements

### Calendar View (Mobile)
- **Single column layout** on screens < 640px
- **Reduced font sizes** for better readability on small screens
- **Optimized padding** (12px on tablets, 10px on phones)
- **Responsive headers** that stack vertically on very small screens
- **Touch-friendly** "Today" badge sizing

#### Breakpoints
- `@media (max-width: 768px)`: Tablet optimizations
- `@media (max-width: 640px)`: Single column grid
- `@media (max-width: 480px)`: Extra small phone optimizations

### Modal View (Mobile)
- **Fullscreen experience** on mobile devices (0 border-radius, 100vh height)
- **Fixed close button** positioned at top-right (44x44 touch target)
- **Optimized padding**: 60px top (for close button), 20px sides, 20px bottom
- **Responsive text sizing**: 1.4rem title on tablets, 1.25rem on phones
- **Flexible meta items** that stack vertically on mobile
- **Image size constraints**: max-height 300px on tablets, 250px on phones

#### Modal Mobile Features
- Zero padding on modal container (fullscreen)
- Content area with proper scrolling
- Category badges stack with title on small screens
- Meta information displays as vertical list

## Running Tests

### Install Dependencies
```bash
npm install
npx playwright install chromium
brew install openjdk        # the Firestore emulator is a JVM process
```

Java is required for anything that touches the emulator, which is every
Playwright run (`npm test` wraps the command in `scripts/run-with-emulator.mjs`)
and the rules suite. Only `npm run test:unit` runs without it.

### The three suites

| Command | What it covers | Emulator |
|---|---|---|
| `npm run test:unit` | pure logic — search scoring, hours parsing, calendar links, URL safety, chip labels | no |
| `npm run test:rules` | `firestore.rules` — who can post, edit and delete; the category whitelist; the rule expression budget | yes, boots its own |
| `npm test` | Playwright end-to-end across desktop/mobile/tablet | yes |

`npm run test:unit` and `npm run test:rules` are the fast gate — together they
take a few seconds and catch the two failure modes that reach students, a logic
regression and a rules regression. Both, plus desktop/mobile Playwright, run in
CI on every push to `main` (`.github/workflows/deploy.yml`).

### Audit Dependencies and Run All Three Suites
```bash
npm run test:check
```

### Run All Browser Tests
```bash
npm test
```

### Run the Firestore Rules Tests
```bash
npm run test:rules
```

Asserts the security rules against a real emulator: every category the composer
offers can actually be posted, an advisor can edit anyone's content, only admins
can add or remove people, a removed advisor loses access immediately, and the
heaviest legitimate resource write stays inside Firestore's expression budget.
Run this whenever you touch `firestore.rules` — a rules regression surfaces to
advisors as a bare "permission denied" that looks unrelated to what they did.

### Run Mobile Tests Only
```bash
npm run test:mobile
```

### Run Quick Mobile Tests
```bash
npm run test:mobile -- mobile-quick.spec.js
```

### Run Tests with UI
```bash
npm run test:ui
```

### Run Tests in Headed Mode
```bash
npm run test:headed
```

## Test Coverage

### Mobile Calendar Tests
- ✅ Calendar displays correctly in mobile viewport
- ✅ Single column layout on screens < 640px
- ✅ Readable font sizes (14px+ for titles, 13px+ for descriptions)
- ✅ Appropriate padding and spacing
- ✅ Today badge visibility and sizing

### Mobile Modal Tests
- ✅ Modal opens successfully
- ✅ Fullscreen modal on mobile (fills viewport)
- ✅ Close button accessibility (44x44 minimum)
- ✅ Close button functionality
- ✅ Readable text sizes (20px+ title, 14px+ description)
- ✅ Proper scrolling behavior
- ✅ Image sizing constraints

### View Toggle Tests
- ✅ View switching (Gallery, List, Calendar)
- ✅ Touch-friendly button sizes

## Test Results

Dependency repair validation: a clean `npm ci` followed by `CI=true npm run test:check` passed the audit, 121 unit tests, 43 rules tests, and 277 browser tests (15 intentional skips). The full `npm run build` also passed on Node 22.20.0, including a live Firestore snapshot fetch and all prebuild consistency checks.

October 1 catch-up: `CI=true npm run test:check` passed locally on Node 23.3.0: **121 unit tests, 43 rules tests, 277 browser tests**, with 15 intentional viewport-specific skips and no flaky retries reported. `npx vite build` also passed. GitHub uses Node 22. The corresponding full matrix also passed in [run 36886626196](https://github.com/marlanamc/advisor-bulletin/actions/runs/36886626196); see the dependency repair notes above for the later audit fix.

Use the current command output and GitHub Actions run for results. Browser tests deliberately skip a few viewport-specific cases; inspect unexpected skips and flaky retries instead of treating a green run alone as complete coverage.

Browser specs use seeded content and simulated advisor state. They do not replace a manual Google sign-in and publish/edit check using the demo checklist. Local browser runs may log Firestore connection errors while fixture-based assertions pass; the separate rules suite validates permissions against the emulator.

## Playwright Configuration

### Projects
- **desktop**: Desktop Chrome (1280x720)
- **mobile**: Pixel 5 emulation (390x844)
- **mobile-small**: Smaller mobile (375x667)
- **tablet**: Tablet size (1024x1366)

### Web Server
Playwright automatically starts the Vite dev server (`npm run dev`) on http://localhost:5173 and reuses an already-running one locally. No credentials or extra setup are needed to run the tests.

## Viewing Test Reports

After running tests:
```bash
npx playwright show-report
```

Screenshots for failed tests are saved in `test-results/`.

## CSS Files Covered

- Student styles now flow through `src/css/student-v2.css`, which imports split section files.
- Admin styles flow through `src/css/admin.css` and `src/css/advisor-portal-v2.css`, which also import split section files.
- Prefer searching the split CSS modules by component/class name instead of relying on old monolithic line numbers.

## Browser Compatibility

Tests run on:
- Chromium (Desktop & Mobile viewports)
- Mobile emulation includes touch events and mobile user agent
