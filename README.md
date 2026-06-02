# ⛵ EBHCS Advisor Bulletin Board

A modern, mobile-responsive, bilingual community bulletin board system for the **East Boston Harborside Community School (EBHCS)**. The system allows advisors to securely publish and manage job listings, training opportunities, resources, and events for ESOL students.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5, Vanilla JavaScript (ES6+ Modules), Vanilla CSS
*   **Build System**: [Vite](https://vite.dev/) (fast bundling, code splitting, and local dev server)
*   **Backend**: [Firebase](https://firebase.google.com/)
    *   **Authentication**: Firebase Auth with role-based restrictions (requiring `@ebhcs.org` domains)
    *   **Database**: Cloud Firestore (NoSQL realtime database with strict validation schemas)
    *   **File Storage**: Stored as base64 document attachments directly linked with documents
*   **Testing**: [Playwright](https://playwright.dev/) (End-to-End browser tests for multiple viewports)

---

## ✨ Features

*   **Bilingual Translation**: Complete English/Spanish toggle for headings, filters, buttons, and help drawers.
*   **Custom Story Resource Bubbles**: Quick filter bubbles at the top of the feed for critical areas (Immigration, Jobs, Housing, Health).
*   **Color-Coordinated Multi-Select Filters**: Filter chips categorized by opportunity type, deadlines, and ESOL class levels (HSE, FamLit, ESOL).
*   **PDF Document Attachments**: Advisors can upload PDF flyers (up to 10MB) alongside or instead of images. Students see a clean "📄 View PDF" download option.
*   **Automated Expiration Ribbon**: Outdated opportunities display a grayscale diagonal "EXPIRED" banner once deadlines pass and are hidden from the public feed by default (with a "Show Expired" toggle).
*   **Comprehensive Advisor Portal**:
    *   **Content Status Dashboard**: Review live posts, resources, upcoming events, expiring posts, and content categories.
    *   **Unified Post Creator**: Simplified type selectors to create Bulletins, Resources, or Calendar events.
    *   **Interactive My Posts Section**: Real-time search, sorting, deleting, and editing of existing opportunities.

---

## 📂 Active File Structure

The project has transitioned from client-side mockups (`script.js` & `admin-script.js`) to a structured, modular production app:

```
advisor_bulletin/
├── src/
│   ├── main.js                  # Main entry point for the Student Feed
│   ├── admin.js                 # Main entry point for the Advisor Dashboard
│   ├── lightbox.js              # Full-screen image lightbox preview handler
│   ├── error-logger.js          # Appends runtime client errors to Firestore for monitoring
│   ├── feed-categories.js       # Student feed category labels and translations
│   ├── pdf-flyer.js             # Client-side PDF preview and download rendering logic
│   └── css/
│       └── advisor-portal-v2.css # Modern styling sheet for the advisor portal
├── index.html                   # Student bulletin board interface
├── admin.html                   # Advisor portal interface
├── firebase-config.js           # Client-side configuration and student feed handlers
├── firebase-admin.js            # Server-side configurations and advisor dashboard logic
├── enhanced-auth.js             # Firebase auth wrapper with password strength checks and default reset modal
├── firestore.rules              # Strict read/write permissions and data schemas
├── package.json                 # Project scripts and dependencies
└── playwright.config.js         # Playwright test runners configuration
```

*Note: `script.js` and `admin-script.js` in the root are legacy backup copies preserved for reference and are not active.*

---

## 🚀 Running Locally

### Prerequisites
*   Node.js (v18+)
*   npm

### Installation
Clone the repository and install dependencies:
```bash
npm install
```

### Dev Server
Launch Vite's hot-reloading development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build
Compile and minify code for production hosting:
```bash
npm run build
```
Vite generates optimized static assets inside the `dist/` directory.

---

## 🧪 Testing

The application includes an extensive E2E Playwright test suite validating layouts, responsiveness, stats, search, and form synchronization.

To run all automated tests:
```bash
npm test
```

To run mobile viewport tests specifically:
```bash
npm run test:mobile
```

To open the interactive Playwright UI:
```bash
npm run test:ui
```

---

## 🔑 Advisor Credentials & Security

*   **Advisor Domain**: Only email addresses ending in `@ebhcs.org` can access the portal.
*   **Default Password**: New advisor accounts are created in the Firebase console with the temporary password `ebhcs123` or `ebhcs2025`.
*   **Security Policy**: First-time login automatically redirects advisors to a secure password reset interface to transition off default credentials.
*   **Edit Permissions**: Advisors can modify and delete only their own posts. Administrators (`admin@ebhcs.org`, `leah@ebhcs.org`, `mcreed@ebhcs.org`) have global update/delete overrides.

---

## 📘 Guides & Reference
*   **Setup Firebase Console**: See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) and [FIREBASE_SECURITY_RULES.md](FIREBASE_SECURITY_RULES.md).
*   **Advisor Tutorial**: Share the [ADVISOR_GUIDE.md](ADVISOR_GUIDE.md) with staff.
*   **IT Handover**: Detailed administration procedures are detailed in [DIRECTOR_HANDOVER_GUIDE.md](DIRECTOR_HANDOVER_GUIDE.md).
