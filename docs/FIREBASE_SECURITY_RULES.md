# Firebase Security Rules for EBHCS Advisor Bulletin Board

## Overview
These security rules ensure that:
- Only authenticated advisors can create, edit, or delete bulletins
- Advisors can only edit/delete their own bulletins
- Anonymous users (students/public) can only read active bulletins
- All operations are properly validated

## Firestore Security Rules

The production security rules are located in the [firestore.rules](../firestore.rules) file in the root of this repository. Copy and paste the contents of that file into your Firebase Console under **Firestore Database** -> **Rules**.

These rules validate:
1. **Public Read Access**: Active posts and published resources are readable by anyone (for student use).
2. **Active Advisor Write Access**: Creating and editing requires a verified `@ebhcs.org` account **and** an `advisors/{username}` doc in Firestore (the `isActiveAdvisor` function). Removing an advisor on the portal's Advisors tab therefore revokes their write access immediately, even before their login is disabled. The same check gates file uploads in [storage.rules](../storage.rules) via cross-service rules.
3. **Equal Advisor Permissions** (Sep 2026): every advisor on the list has identical content permissions — create, edit and delete **any** post or resource, whoever wrote it. This also makes the legacy posts from the retired `admin` / `advisors` shared logins (owned by nobody) editable by the whole team.
4. **Admin = Managing People, Nothing Else**: the one thing an admin can do that a plain advisor cannot is add and remove people (`advisors/*`, `config/studentDirectory`, `users/*`). It is gated on `advisors/{username}.isAdmin == true`, read live by the `isAdminAdvisor` rule function — so the **Admin toggle on the portal's Advisors tab is the real switch** and promoting someone needs no code change and no rules deploy.
5. **Owner Break-Glass**: `mcreed@ebhcs.org` always counts as an active advisor and an admin, so clearing the last `isAdmin` flag — or deleting your own advisor doc — cannot permanently orphan the roster. This is a recovery hatch, not an extra day-to-day privilege. The list lives in `OWNER_ADMIN_EMAILS` in [src/admin-roles.js](../src/admin-roles.js), mirrored in `isOwnerAdmin` in [firestore.rules](../firestore.rules) and the allowlist in [storage.rules](../storage.rules) — `scripts/check-admin-emails-sync.mjs` fails the build if the three drift apart.

   > **Removing a break-glass owner takes a code change.** `isOwnerAdmin` short-circuits the advisor-doc check, so the Advisors tab's **Remove** button will pull them off the student directory while leaving their access fully intact. Revoking them means editing `src/admin-roles.js`, `firestore.rules` and `storage.rules` together, then deploying rules.
6. **Data Shape Validation**: Field checks for text lengths, date formats (single event date, date ranges, multiple sessions, and deadlines), PDF attachments, and analytics/error properties.

**Before deploying the active-advisor rules for the first time**, run `scripts/check-advisor-auth-sync.mjs` to confirm every current advisor has an `advisors/{username}` doc — anyone missing one will lose posting access when the rules ship. No service account key? Sign in with your admin password instead:

```bash
firebase login
node scripts/check-advisor-auth-sync.mjs --email=mcreed@ebhcs.org
```

## Firebase Authentication Setup

### Sign-in Provider
The portal uses **Google sign-in only** (no passwords):

1. Go to Firebase Console → Authentication → Sign-in method
2. Add and enable the **Google** provider (pick a support email)
3. Keep the **Email/Password** provider disabled

### Who Can Get In
- The Google account picker is scoped to `@ebhcs.org` (the `hd` parameter), and any other domain is signed out by the client.
- The rules additionally require `email_verified == true` (always true for Google sign-in) and an `advisors/{username}` doc — so only staff an admin has added on the Advisors tab can read or write portal data, even if other org accounts authenticate.
- Advisor Firebase Auth accounts are created automatically at first Google sign-in; there is nothing to pre-create in the console.

## Database Structure

### Collection: `bulletins`
```javascript
{
  id: "auto-generated-id",
  title: "Job Opening: Customer Service Rep",
  category: "job", // job|training|college|career-fair|announcement|resource|immigration
  description: "Full job description...",
  company: "Boston Medical Center", // optional
  contact: "hr@bmc.org", // optional
  deadline: "2025-02-15", // optional, ISO date string
  eventTime: "6:30 PM", // optional
  eventLink: "https://example.com/register", // optional URL
  advisorName: "Jorge",
  postedBy: "rocha", // prefix of the advisor's @ebhcs.org email
  datePosted: Timestamp, // Firebase server timestamp
  isActive: true, // false for deleted posts
  image: "data:image/jpeg;base64,..." // optional, base64 encoded
}
```

## Security Best Practices

### 1. Email Domain Restriction
- Only @ebhcs.org emails can authenticate
- Prevents unauthorized access even with compromised credentials

### 2. Data Validation
- All required fields are validated
- String length limits prevent abuse
- Category values are restricted to predefined options
- Image size is limited to prevent storage abuse

### 3. Ownership Protection
- Advisors can only edit/delete their own posts
- Original author and creation date cannot be changed
- Soft delete prevents data loss

### 4. Public Read Access
- Students and public can view active bulletins
- No authentication required for reading
- Inactive bulletins are hidden from public

## Firestore Indexes

Create these composite indexes in Firebase Console → Firestore → Indexes:

1. **For bulletin listing with filters:**
   - Collection: `bulletins`
   - Fields: `isActive` (Ascending), `datePosted` (Descending)

2. **For category filtering:**
   - Collection: `bulletins`
   - Fields: `isActive` (Ascending), `category` (Ascending), `datePosted` (Descending)

3. **For user's own posts:**
   - Collection: `bulletins`
   - Fields: `postedBy` (Ascending), `isActive` (Ascending), `datePosted` (Descending)

## Testing Security Rules

### Test Cases
1. **Anonymous Read:** Should work for active bulletins only
2. **Authenticated Create:** Should work with valid @ebhcs.org account
3. **Cross-user Edit:** Should fail when trying to edit another user's post
4. **Invalid Data:** Should reject posts with invalid categories or oversized content
5. **Soft Delete:** Should allow setting isActive: false on own posts only

### Testing in Firebase Console
1. Go to Firestore → Rules → Playground
2. Test each scenario with different authentication states
3. Verify error messages match expected behavior

## Emergency Access

### Admin Override (If Needed)
For emergency situations, the mcreed@ebhcs.org account can be given elevated privileges:

```javascript
// Add this condition to allow admin full access
|| request.auth.token.email == 'mcreed@ebhcs.org'
```

### Backup and Recovery
- Set up automated Firestore exports
- Document data recovery procedures
- Maintain offline backup of critical announcements

## Monitoring and Alerts

### Set up Firebase monitoring for:
- Failed authentication attempts
- Unusual data access patterns
- Large bulletin uploads
- Frequent rule violations

### Alert thresholds:
- More than 10 failed logins per hour
- Bulletins larger than 1MB
- More than 50 bulletins posted per day
