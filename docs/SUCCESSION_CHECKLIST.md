# Succession Checklist

Use this when the Firebase keyholder, primary admin, or technical contact changes. Most steps need a developer with repo access; operational steps (Console-only) can be done by the new keyholder.

## 1. Transfer Firebase project ownership

1. Current owner: Firebase Console → **Project settings** → **Users and permissions**.
2. Invite the new keyholder's Google account with **Owner** role (or transfer ownership via Google's account-transfer flow if the current owner is leaving entirely).
3. New keyholder accepts the invite and confirms they can open https://console.firebase.google.com/project/ebhcs-bulletin-board.
4. Remove or downgrade the departing owner's access once handoff is verified.
5. Update the ownership table in [DIRECTOR_HANDOVER_GUIDE.md](DIRECTOR_HANDOVER_GUIDE.md).

## 2. Rotate the GitHub deploy secret

CI deploys use `FIREBASE_SERVICE_ACCOUNT` in the GitHub repository secrets.

1. Firebase Console → **Project settings** → **Service accounts** → **Generate new private key**.
2. GitHub repository → **Settings** → **Secrets and variables** → **Actions** → update `FIREBASE_SERVICE_ACCOUNT` with the new JSON.
3. **Never commit** the key file. Store a copy only in the new keyholder's password manager.
4. Trigger a test deploy (merge a trivial doc change to `main` or use **Actions → Deploy to Firebase → Run workflow** if enabled) and confirm hosting + rules deploy succeed.

## 3. Add or remove a privileged admin

Privileged admins can edit any post and manage the advisor list. Today: `mcreed@ebhcs.org` and `lgregory@ebhcs.org`.

**All three must stay in sync:**

| Location | What to edit |
|----------|--------------|
| `firestore.rules` | `isPrivilegedAdvisor(email)` function |
| `src/admin-roles.js` | `PRIVILEGED_ADMIN_EMAILS` array |
| `docs/FIREBASE_SECURITY_RULES.md` | Admin list in the doc |

Then:

1. Create the Firebase Auth account for the new admin (Authentication → Users) if they don't have one.
2. Run `npm run build` locally — `scripts/check-admin-emails-sync.mjs` fails if rules and `admin-roles.js` drift.
3. Merge to `main` so CI deploys the updated rules (or run `firebase deploy --only firestore:rules` manually).
4. Optionally run `node scripts/update-roles.mjs` to write the `users/{username}` profile doc.

## 4. Replace student-facing contact email

Search the repo for `mcreed@ebhcs.org` and update every occurrence to the new monitored address:

- `index.html` — About section and footer contact link
- `admin.html` — login help and footer
- `docs/DEPLOYMENT.md` — maintainer notes
- `public/onboarding/*.html` — advisor onboarding pages (if still in use)

Redeploy after HTML changes (push to `main`).

## 5. Hand off operational runbooks

Give the new keyholder:

- [DIRECTOR_HANDOVER_GUIDE.md](DIRECTOR_HANDOVER_GUIDE.md) — day-to-day operations
- [DEPLOYMENT.md](DEPLOYMENT.md) — how deploys and rules ship
- [ADVISOR_GUIDE.md](ADVISOR_GUIDE.md) — advisor-facing instructions (if published)
- Firebase Console bookmark: https://console.firebase.google.com/project/ebhcs-bulletin-board

## 6. Verify after handoff

- [ ] New keyholder can sign in to Firebase Console
- [ ] New keyholder can create/disable Auth users
- [ ] Privileged admin can log in to `/admin` and manage posts + advisors
- [ ] Student site loads and shows current posts
- [ ] GitHub Actions deploy succeeds on `main`
- [ ] Contact email on the live site points to the new address
- [ ] Monthly health-check steps in the director guide are understood
