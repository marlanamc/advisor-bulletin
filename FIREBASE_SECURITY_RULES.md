# Firebase Security Rules for EBHCS Advisor Bulletin Board

## Overview
These security rules ensure that:
- Only authenticated advisors can create, edit, or delete bulletins
- Advisors can only edit/delete their own bulletins
- Anonymous users (students/public) can only read active bulletins
- All operations are properly validated

## Firestore Security Rules

Add these rules to your Firestore Security Rules in the Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Bulletins collection rules
    match /bulletins/{bulletinId} {

      // Anyone can read active bulletins (for student viewing)
      allow read: if resource.data.isActive == true;

      // Only authenticated advisors can create bulletins
      allow create: if request.auth != null
        && request.auth.token.email.matches('.*@ebhcs\\.org')
        && validateBulletinData(request.resource.data)
        && request.resource.data.postedBy == getUsername(request.auth.token.email);

      // Original authors can update their own bulletins; admin/leah may update any bulletin
      allow update: if request.auth != null
        && request.auth.token.email.matches('.*@ebhcs\\.org')
        && (isPrivilegedAdvisor(request.auth.token.email)
          || resource.data.postedBy == getUsername(request.auth.token.email))
        && validateBulletinData(request.resource.data)
        // Prevent changing the original author
        && request.resource.data.postedBy == resource.data.postedBy
        // Prevent changing the creation date
        && request.resource.data.datePosted == resource.data.datePosted;

      // Original authors (or admin/leah) can delete by setting isActive: false
      allow update: if request.auth != null
        && request.auth.token.email.matches('.*@ebhcs\\.org')
        && (isPrivilegedAdvisor(request.auth.token.email)
          || resource.data.postedBy == getUsername(request.auth.token.email))
        && request.resource.data.isActive == false
        && request.resource.data.keys().hasAll(resource.data.keys());
    }

    // Helper functions
    function getUsername(email) {
      return email.split('@')[0];
    }

    function isPrivilegedAdvisor(email) {
      return email == 'admin@ebhcs.org' || email == 'leah@ebhcs.org';
    }

    function validateBulletinData(data) {
      return data.keys().hasAll(['title', 'category', 'advisorName', 'postedBy', 'isActive'])
        && data.title is string && data.title.size() > 0 && data.title.size() <= 200
        && data.category is string && data.category in ['job', 'training', 'college', 'career-fair', 'announcement', 'resource', 'immigration']
        && data.description is string && data.description.size() <= 2000
        && data.advisorName is string && data.advisorName.size() > 0
        && data.postedBy is string && data.postedBy.size() > 0
        && data.isActive is bool
        && (data.company == null || (data.company is string && data.company.size() <= 200))
        && (data.contact == null || (data.contact is string && data.contact.size() <= 500))
        && (data.deadline == null || data.deadline is string)
        && (data.eventTime == null || data.eventTime is string)
        && (data.eventLink == null || (data.eventLink is string && data.eventLink.size() <= 1000))
        && (data.image == null || (data.image is string && data.image.size() <= 5000000)); // ~5MB base64 limit
    }
  }
}
```

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
