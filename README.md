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
*   **Custom Story Resource Bubbles**: Quick filter bubbles at the top of the feed for critical areas (Immigration, Job Help, Housing, Health).
*   **Color-Coordinated Multi-Select Filters**: Filter chips categorized by opportunity type, deadlines, and ESOL class levels (HSE, FamLit, ESOL).
*   **PDF Document Attachments**: Advisors can upload PDF flyers (up to 10MB) alongside or instead of images. Students see a clean "📄 View PDF" download option.
*   **Automated Expiration Ribbon**: Outdated opportunities display a grayscale diagonal "EXPIRED" banner once deadlines pass and are hidden from the public feed by default (with a "Show Expired" toggle).
*   **Comprehensive Advisor Portal**:
    *   **Content Status Dashboard**: Review live posts, resources, upcoming events, expiring posts, and content categories.
    *   **Unified Post Creator**: Simplified type selectors to create Bulletins, Resources, or Calendar events.
    *   **Interactive My Posts Section**: Real-time search, sorting, deleting, and editing of existing opportunities.

---

## 📂 Project Layout

```
advisor_bulletin/
├── index.html                   # Student bulletin board (entry page)
├── admin.html                   # Advisor portal (entry page)
├── src/                         # All application JavaScript and CSS
│   ├── main.js                  #   Student entry: snapshot-first bootstrap, PWA updates
│   ├── firebase-config.js       #   Student app (FirebaseBulletinBoard) + board-*.js modules
│   ├── admin.js                 #   Advisor entry: auth wiring, page routing
│   ├── firebase-admin.js        #   Admin panel (FirebaseAdminPanel) + admin-*.js modules
│   ├── google-auth.js           #   Google Workspace sign-in + advisor-list gate
│   ├── admin-roles.js           #   Privileged admin emails (sync-checked vs firestore.rules)
│   └── css/                     #   Stylesheets
├── public/                      # Static files served as-is (PWA service worker,
│                                #   manifest, images, student feed snapshot, 404)
├── docs/                        # All guides: DEPLOYMENT, FIREBASE_SETUP, TESTING,
│                                #   ADVISOR_GUIDE, DIRECTOR_HANDOVER_GUIDE, screenshots
├── scripts/                     # Maintenance scripts (see scripts/README.md)
├── tests/                       # Playwright suite (gates every deploy)
├── data/                        # CSV template for bulk resource imports
├── config/                      # One-time setup artifacts (CORS configs, config template)
├── firestore.rules              # Firestore security rules (the security boundary)
├── storage.rules                # Storage security rules
├── firebase.json                # Firebase Hosting/deploy configuration
├── vite.config.mjs              # Build configuration
└── playwright.config.js         # Test runner configuration
```

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

*   **Google Sign-In Only**: Advisors sign in with their school Google account ("Sign in with Google"). There are no passwords to create, share, or reset.
*   **Advisor Domain**: Only `@ebhcs.org` Google accounts can sign in, and only accounts on the admin-managed Advisors list (the `advisors/{username}` Firestore collection) get portal access — other school staff are turned away at sign-in.
*   **Adding an Advisor**: An admin adds them on the portal's Advisors tab. No Firebase Console step needed — their account is created automatically the first time they sign in with Google.
*   **Edit Permissions**: Advisors can modify and delete only their own posts. Administrators (`mcreed@ebhcs.org`, `lgregory@ebhcs.org`) have global update/delete overrides — the authoritative list is `isPrivilegedAdvisor` in [firestore.rules](firestore.rules).

---

## 📘 Guides & Reference
*   **Deploying & Operations**: See [DEPLOYMENT.md](docs/DEPLOYMENT.md) (how deploys work, credentials, billing, rollback) and [scripts/README.md](scripts/README.md) (maintenance scripts).
*   **Setup Firebase Console**: See [FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) and [FIREBASE_SECURITY_RULES.md](docs/FIREBASE_SECURITY_RULES.md).
*   **Advisor Tutorial**: Share the [ADVISOR_GUIDE.md](docs/ADVISOR_GUIDE.md) with staff.
*   **IT Handover**: Detailed administration procedures are detailed in [DIRECTOR_HANDOVER_GUIDE.md](docs/DIRECTOR_HANDOVER_GUIDE.md).
