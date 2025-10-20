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
```

### Run All Tests
```bash
npm test
```

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
The tests automatically start a Python HTTP server on port 8080.

## Viewing Test Reports

After running tests:
```bash
npx playwright show-report
```

Screenshots for failed tests are saved in `test-results/`.

## CSS Files Modified

- **style.css**:
  - Lines 2115-2121: Mobile calendar grid
  - Lines 2259-2327: Calendar component mobile optimizations
  - Lines 2458-2545: Modal mobile optimizations

## Browser Compatibility

Tests run on:
- Chromium (Desktop & Mobile viewports)
- Mobile emulation includes touch events and mobile user agent
