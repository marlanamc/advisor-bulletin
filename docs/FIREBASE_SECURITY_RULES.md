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
2. **Authenticated Write Access**: Creating and editing requires a verified `@ebhcs.org` account.
3. **Ownership Limits**: Advisors can only update their own posts. Administrators (`admin@ebhcs.org`, `leah@ebhcs.org`) have global overrides. The authoritative list lives in the `isPrivilegedAdvisor` function in [firestore.rules](../firestore.rules) — if you change it there, update this document too.
4. **Data Shape Validation**: Field checks for text lengths, date formats (single event date, date ranges, multiple sessions, and deadlines), PDF attachments, and analytics/error properties.

## Firebase Authentication Setup

### Required User Accounts
Create Firebase Auth accounts for each advisor with these email addresses:

```
admin@ebhcs.org
jorge@ebhcs.org
fabiola@ebhcs.org
leidy@ebhcs.org
carmen@ebhcs.org
jerome@ebhcs.org
felipe@ebhcs.org
simonetta@ebhcs.org
mike@ebhcs.org
leah@ebhcs.org
```

### Creating User Accounts
1. Go to Firebase Console → Authentication → Users
2. Click "Add User"
3. Enter email (e.g., jorge@ebhcs.org)
4. Set initial password (advisors will change on first login)
5. Repeat for all advisors

### Recommended Initial Passwords
- Use a temporary secure password like: `TempEBHCS2025!`
- Force password change on first login
- Minimum password requirements: 8+ characters, mixed case, numbers

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
  postedBy: "jorge", // username from email
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
For emergency situations, the admin@ebhcs.org account can be given elevated privileges:

```javascript
// Add this condition to allow admin full access
|| request.auth.token.email == 'admin@ebhcs.org'
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
