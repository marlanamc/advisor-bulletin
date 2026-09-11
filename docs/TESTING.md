# Mobile Testing Guide

## Overview
This project includes Playwright tests to verify mobile responsiveness for the calendar view and modal components.

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

### Run All Tests
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

Latest test run (mobile-quick tests):
```
4 tests passed (4.6s)
✅ Calendar view rendered on mobile
✅ All view toggle buttons are visible
ℹ️  Modal tests require bulletins to be loaded
```

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
