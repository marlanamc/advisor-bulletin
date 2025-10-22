**EBHCS Advisor Bulletin Board — Case Study**

- Project: EBHCS Advisor Bulletin Board
- Stakeholders: ESOL/HSE Advising Team, Program Director, 350+ students
- Tech: Firebase (Auth, Firestore, Storage), HTML/CSS/JS

**Overview**
- Problem: Advisors were duplicating announcements across multiple Google Classrooms, fragmenting communication and increasing workload. Students lacked a single, reliable place to find up‑to‑date opportunities and announcements.
- Goal: Provide a centralized, school‑wide bulletin where advisors can post once and reach all 350+ students, with simple publishing, strong filtering, and a great mobile experience.
- Outcome: A live, web‑based bulletin with an Advisor Portal (post/manage) and a Student View (gallery and calendar), backed by Firebase for secure auth, real‑time updates, and durable storage.

**Objectives**
- Centralize: One posting reaches all students/programs.
- Reduce friction: Make posting as easy as filling a form and clicking “Post.”
- Improve discovery: Multi‑select filters, search, and calendar view to quickly find relevant items.
- Govern access: Only EBHCS advisors can create/manage posts; the public can read active posts.
- Handle artifacts: Support images and PDFs for flyers, forms, and details.

**Solution**
- Student View (index):
  - Gallery grid with category badges, images, links, contact, and deadline cues.
  - Calendar view to visualize time‑bound items; per‑day modal lists all events.
  - Search + multi‑select filter chips (Category, Deadlines, Posted Date, Class Type, Posted By).
  - Expired logic: automatic “EXPIRED” banners and toggle to include/hide.
- Advisor Portal (admin):
  - Guided form with required/recommended sections; preview before posting.
  - PDF upload and image upload with size validation and previews.
  - Manage Posts tab: search, sort (newest/oldest/category/deadline), filter (active/expired), and edit/update.
  - Authentication with advisor accounts; first‑login password change flow.

**Key Features Implemented**
- PDF uploads up to 10MB with student‑side “📄 View PDF” (admin.html, firebase-config.js, style.css).
- Multi‑select, color‑coordinated filters for categories/deadlines/class types/posted by (index.html, style.css, firebase-config.js).
- New “Immigration” category with dedicated styling (index.html, admin.html, style.css, firebase-config.js).
- Expired/archiving UX with banners, grayscale styling, and “Show Expired” toggle (index.html, style.css, firebase-config.js).
- Manage Posts overhaul with search/sort/filter and edit/update workflow (admin.html, firebase-admin.js, style.css).

**Architecture**
- Frontend: Static HTML/CSS/JS, responsive design; deep‑linking to bulletins via URL hash.
- Backend: Firebase
  - Auth: Email/password restricted to `@ebhcs.org` accounts; privileged users for emergency overrides.
  - Firestore: `bulletins` collection with validated schema; real‑time snapshot subscriptions for instant UI updates.
  - Storage: Images/PDFs stored as data URLs or in Storage bucket per current configuration.
- Files of note: `index.html`, `admin.html`, `firebase-config.js`, `firebase-admin.js`, `enhanced-auth.js`, `style.css`.

**Security & Governance**
- Firestore Rules (see FIREBASE_SECURITY_RULES.md, firestore.rules):
  - Public read for active bulletins only; write restricted to authenticated `@ebhcs.org` advisors.
  - Advisors can edit/delete only their own posts; admin/leah can manage all.
  - Strict data validation: required fields, category whitelist, size limits, immutable author/date.
- Authentication: Advisor accounts in Firebase Auth; first‑login password change and support for reset.
- Recommended hardening (see Security Analysis.md):
  - HTML sanitization/XSS protection, CSP headers, rate limiting, file signature checks/virus scanning.

**Process & Rollout**
- Discovery: Advisors identified pain from posting the same item to multiple Google Classrooms; students missed content across silos.
- MVP: Public bulletin + simple Advisor Portal, using local storage for quick iteration.
- Production move: Firebase Auth/Firestore/Storage integration for secure multi‑user posting and real‑time updates.
- Iteration (advisor‑requested): PDF uploads, Immigration category, expired system, filter overhaul, manage‑posts redesign.
- Enablement: Advisor Guide with step‑by‑step posting, best practices, and troubleshooting (ADVISOR_GUIDE.md).
- Handover: Director runbook for maintenance and user management (DIRECTOR_HANDOVER_GUIDE.md).

**Impact**
- Single source of truth for 350+ students across programs and classes.
- Reduced duplication and advisor workload by posting once centrally.
- Better student discovery via filters and calendar; easy mobile sharing per post.
- Cleaner lifecycle management: deadlines, expiration, and manage‑posts tooling reduce stale items.

Note: If you track usage, consider measuring: number of posts/week, advisor adoption rate, unique student sessions, filter usage, average time to find a bulletin, expired‑post cleanup rate.

**Challenges & How We Addressed Them**
- Fragmented channels (multiple Classrooms): Replaced with a single public bulletin and deep‑linking for sharing.
- Posting friction: Simplified Advisor Portal with preview, required/recommended guidance, and form progress cues.
- Governance: Firestore rules enforce ownership; privileged accounts handle exceptions.
- Content lifecycle: Deadline/expired logic to prevent clutter while preserving visibility when needed.
- Security posture: Moved from local storage to Firebase; documented next‑step hardening for sanitization/CSP/rate limiting.

**What’s Next**
- Security hardening: Input sanitization, CSP, magic‑number checks, storage scanning; enable 2FA for privileged accounts.
- Analytics: Lightweight metrics for adoption and content effectiveness (e.g., views per post, filter usage).
- Advisor QoL: Drafts, scheduled posts, bulk edit/archiving, and optional notifications.
- Student UX: Saved filters, multilingual labels, and accessibility refinements informed by usage.

**How To Use**
- Students: Open `index.html` → filter/search or switch to calendar view.
- Advisors: Open `admin.html` → login → create/manage posts. See ADVISOR_GUIDE.md for step‑by‑step.

**References**
- Student site: index.html
- Advisor portal: admin.html
- Feature summary: ADVISOR_FEATURES.md
- Security rules: FIREBASE_SECURITY_RULES.md, firestore.rules
- Security posture: Security Analysis.md
- Admin/auth code: firebase-config.js, firebase-admin.js, enhanced-auth.js
- Styles: style.css

**Summary**
By consolidating announcements into one modern, filterable bulletin with secure advisor posting, EBHCS eliminated duplicate work across Google Classrooms and gave 350+ students a single, dependable place to find opportunities. The Firebase foundation enables safe growth, while the feature set reflects direct advisor feedback and real usage needs.

