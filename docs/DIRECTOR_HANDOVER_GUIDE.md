# 🎯 **DIRECTOR HANDOVER GUIDE**
## Complete Firebase Setup & Testing Checklist

**Project:** EBHCS Advisor Bulletin Board  
**Live URL:** https://ebhcsjobboard.web.app  
**Admin URL:** https://ebhcsjobboard.web.app/admin  
**Handover Date:** [Fill in date]  
**Prepared by:** [Your name]

---

## 👤 **OWNERSHIP AFTER HANDOFF**

Fill this in before training day:

| Role | Name | Contact |
|------|------|---------|
| **Firebase Console keyholder** (can add/remove login accounts) | [Name] | [Email / phone] |
| **Primary admin user** (can manage all posts + advisors in the app) | [Name] | [Email / phone] |
| **Technical fallback** (only if the site breaks) | [Your name or IT contact] | [Email / phone] |

The **Firebase Console keyholder** is the most important role. They are the only person who can create login accounts for new advisors. The in-app "Add Advisor" button updates the advisor list, but it does **not** create the login by itself.

**Firebase Console:** https://console.firebase.google.com/project/ebhcs-bulletin-board

---

## ➕ **WHEN A NEW ADVISOR JOINS (1 STEP)**

1. **In the admin portal (Advisors tab):** Add the advisor with username + display name. Use their `@ebhcs.org` email. Set their "Title on student site" (e.g. Advisor) and leave "Show on student site" on if students should see them in the advisor directory.

That's it — no Firebase Console step. They sign in with **Sign in with Google** using their `@ebhcs.org` school account; their login account is created automatically the first time they do.

**When an advisor leaves (1 step):**

1. **In the admin portal (Advisors tab):** Click **Remove**. This immediately locks them out — even if they sign in with Google, the portal turns them away and the security rules deny all reads and writes. (If their school Google account is also deactivated by the Workspace admin, that closes things off even sooner.)

The student site's advisor directory updates automatically whenever you add, edit, or remove an advisor — no developer needed.

---

## 🩺 **MONTHLY HEALTH CHECK (5 MINUTES)**

Once a month, the Firebase keyholder should:

1. Open **Firestore Database → `errors` collection**
2. Sort by newest. If empty (or only old entries), the site is healthy.
3. If new errors appear, note the `message`, `page`, and `source` fields (`student` = public site, `admin` = advisor portal).
4. Contact the technical fallback if errors are recurring or students report broken pages.
5. **Prune old error logs** (optional, keeps Firestore tidy): from the repo root, run `npm run prune:errors` (dry-run), then `npm run prune:errors:confirm` if the count looks right. Requires a service account key — see [DEPLOYMENT.md](DEPLOYMENT.md).
6. **Keep the archive tidy**: the student site only loads the 500 most recently posted active items (posts, events, and resources combined). That is far more than the site normally carries, but if the total ever gets close, archive old posts in **Manage Posts** so nothing silently drops off the student site.

Student and admin pages automatically log JavaScript errors here. No developer action is needed day-to-day unless errors show up.

---

## 🚨 **WHEN SOMETHING BREAKS**

| Symptom | First thing to try |
|---------|-------------------|
| Advisor cannot log in | Confirm their account exists in Firebase Console → Authentication → Users |
| New advisor added but can't sign in | Complete step 2 of the new-advisor checklist above |
| Student site blank or not loading posts | Check Firebase Console → Firestore → `errors` for recent entries; try a hard refresh |
| "Permission denied" when posting | Advisor may be logged out — log out and back in |
| Image upload fails | Use a smaller JPG/PNG (under 10MB). The app auto-compresses, but very large files may still fail |
| Need to hide content quickly | Use **Manage tab → Edit → hide/unpublish**. Avoid permanent Delete unless necessary |

**Do not edit code or Firestore rules** unless you have a developer. The site is frozen as-is — operational fixes happen through the admin portal and Firebase Console only.

If the whole site is broken after a code change, a previous version can be restored without a developer: Firebase Console → **Hosting** → Release history → **Rollback**. For anything involving code, deploys, or costs, hand your developer [DEPLOYMENT.md](DEPLOYMENT.md) — it explains how the site ships and where the safety rails are. For long-term ownership changes (new Firebase keyholder, new privileged admin, contact email updates), see [SUCCESSION_CHECKLIST.md](SUCCESSION_CHECKLIST.md).

---

## 🔥 **PHASE 1: FIREBASE CONSOLE SETUP** (30 minutes)

### ✅ **Step 1.1: Verify Project Configuration**
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Select project: **ebhcs-bulletin-board**
- [ ] Verify project is in **us-central1** region
- [ ] Check that **Google Analytics is disabled** (not needed)

### ✅ **Step 1.2: Configure Authentication**
- [ ] Go to **Authentication** → **Sign-in method**
- [ ] Ensure the **Google** provider is enabled (and Email/Password is **disabled**)

There are **no accounts to create**. Advisors sign in with their `@ebhcs.org` Google accounts, and Firebase creates their login automatically at first sign-in. Who gets portal access is controlled entirely from the portal's **Advisors tab** (see "When a new advisor joins" above).

### ✅ **Step 1.3: Configure Firestore Security Rules**
- [ ] Go to **Firestore Database** → **Rules**
- [ ] Copy the current rules from the project's `firestore.rules` file in the repo (preferred over the older example below)
- [ ] Click **Publish**
- [ ] Confirm the rules include an `errors` collection (used for automatic site error logging)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
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
        && request.resource.data.postedBy == resource.data.postedBy
        && request.resource.data.datePosted == resource.data.datePosted;

      // Original authors (or admin/leah) can delete by setting isActive: false
      allow update: if request.auth != null
        && request.auth.token.email.matches('.*@ebhcs\\.org')
        && (isPrivilegedAdvisor(request.auth.token.email)
          || resource.data.postedBy == getUsername(request.auth.token.email))
        && request.resource.data.isActive == false
        && request.resource.data.keys().hasAll(resource.data.keys());
    }

    function getUsername(email) {
      return email.split('@')[0];
    }

    function isPrivilegedAdvisor(email) {
      return email == 'mcreed@ebhcs.org' || email == 'lgregory@ebhcs.org';
    }

    function validateBulletinData(data) {
      return data.keys().hasAll(['title', 'category', 'advisorName', 'postedBy', 'isActive'])
        && data.title is string && data.title.size() > 0 && data.title.size() <= 200
        && data.category is string && data.category in ['job', 'training', 'college', 'career-fair', 'announcement', 'resource']
        && data.description is string && data.description.size() <= 2000
        && data.advisorName is string && data.advisorName.size() > 0
        && data.postedBy is string && data.postedBy.size() > 0
        && data.isActive is bool
        && (data.company == null || (data.company is string && data.company.size() <= 200))
        && (data.contact == null || (data.contact is string && data.contact.size() <= 500))
        && (data.deadline == null || data.deadline is string)
        && (data.eventTime == null || data.eventTime is string)
        && (data.eventLink == null || (data.eventLink is string && data.eventLink.size() <= 1000))
        && (data.image == null || (data.image is string && data.image.size() <= 5000000));
    }
  }
}
```

- [ ] Click **"Publish"**

### ✅ **Step 1.5: Set Up Firestore Indexes**
- [ ] Go to **Firestore Database** → **Indexes**
- [ ] Click **"Create Index"**
- [ ] Create these composite indexes:

**Index 1: Bulletin Listing**
- Collection: `bulletins`
- Fields: `isActive` (Ascending), `datePosted` (Descending)

**Index 2: Category Filtering**
- Collection: `bulletins`
- Fields: `isActive` (Ascending), `category` (Ascending), `datePosted` (Descending)

**Index 3: User Posts**
- Collection: `bulletins`
- Fields: `isActive` (Ascending), `postedBy` (Ascending), `datePosted` (Descending)

---

## 🧪 **PHASE 2: COMPREHENSIVE TESTING** (45 minutes)

### ✅ **Test 2.1: Authentication Flow**
- [ ] **Test Admin Login:**
  - Go to https://ebhcsjobboard.web.app/admin
  - Click **Sign in with Google** and pick an admin `@ebhcs.org` account
  - Verify the admin panel loads and the Advisors tab is visible

- [ ] **Test Advisor Login:**
  - Sign in with Google as an advisor who **is** on the Advisors list
  - Verify the portal opens (without the Advisors tab)

- [ ] **Test the Advisor-List Gate:**
  - Sign in with Google as an `@ebhcs.org` account that is **not** on the Advisors list
  - Verify they see "isn't on the advisor list" and are signed back out

### ✅ **Test 2.2: Bulletin Creation**
- [ ] **Test Required Fields:**
  - Login as advisor
  - Try submitting empty form
  - Verify error message appears
  - Fill in required fields: Title, Category, Posted By
  - Verify form accepts submission

- [ ] **Test All Categories:**
  - Create bulletin with category "Job Opportunity"
  - Create bulletin with category "Training/Workshop"
  - Create bulletin with category "College/University"
  - Create bulletin with category "Career Fair" (new category)
  - Create bulletin with category "General Announcement"
  - Create bulletin with category "Resource/Service"

- [ ] **Test Image Upload:**
  - Upload image under 5MB
  - Verify image appears in preview
  - Upload image over 5MB
  - Verify error message appears

### ✅ **Test 2.3: Bulletin Management**
- [ ] **Test Edit Permissions:**
  - Login as Jorge
  - Create a bulletin
  - Login as Fabiola
  - Try to edit Jorge's bulletin
  - Verify edit is blocked
  - Login as admin
  - Verify admin can edit any bulletin

- [ ] **Test Delete Functionality:**
  - Create test bulletin
  - Delete bulletin (set to inactive)
  - Verify bulletin disappears from public view
  - Verify bulletin appears in "Manage Posts" as inactive

### ✅ **Test 2.4: Public Bulletin Display**
- [ ] **Test Main Page:**
  - Go to https://ebhcsjobboard.web.app
  - Verify bulletins display correctly
  - Test Gallery view
  - Test List view
  - Test Calendar view

- [ ] **Test Search & Filtering:**
  - Search for specific text
  - Filter by category
  - Filter by deadline
  - Test "Clear All Filters"

- [ ] **Test Mobile Responsiveness:**
  - Test on mobile device or browser dev tools
  - Verify all views work on mobile
  - Test admin panel on mobile

### ✅ **Test 2.5: Error Handling**
- [ ] **Test Invalid Login:**
  - Try signing in with a personal (non-@ebhcs.org) Google account
  - Verify it is rejected with a clear message

- [ ] **Test Form Validation:**
  - Try invalid email format
  - Try invalid URL format
  - Try exceeding character limits
  - Verify validation messages appear

- [ ] **Test Network Issues:**
  - Disconnect internet
  - Try to submit form
  - Verify graceful error handling

---

## 📋 **PHASE 3: DIRECTOR TRAINING MATERIALS** (15 minutes)

### ✅ **Step 3.1: Create User Accounts Document**
Create a document with:
- All advisor email addresses (their @ebhcs.org Google accounts)
- Role assignments (admin vs advisor)
- Contact information for tech support

### ✅ **Step 3.2: Prepare Demo Data**
- [ ] Create 3-5 sample bulletins with different categories
- [ ] Include at least one with an image
- [ ] Include one with a deadline
- [ ] Include one with contact information

### ✅ **Step 3.3: Create Quick Reference Card**
Print out:
- Website URLs (main and admin)
- Login process steps
- Common troubleshooting steps
- Tech support contact information

---

## 🚨 **CRITICAL SECURITY CHECKLIST**

### ✅ **Before Go-Live:**
- [ ] All advisors added on the portal's Advisors tab
- [ ] Google sign-in enabled; Email/Password provider disabled
- [ ] Firestore security rules are active
- [ ] Email domain restriction is working (@ebhcs.org only)
- [ ] Non-listed @ebhcs.org accounts are turned away at sign-in
- [ ] No test data in production database

### ✅ **Post Go-Live Monitoring:**
- [ ] Monitor Firebase Console for failed login attempts
- [ ] Check Firestore for any unusual activity
- [ ] Verify all advisors can sign in with Google successfully
- [ ] Monitor image upload sizes and storage usage

---

## 📞 **SUPPORT INFORMATION**

### **For Director:**
- **Main Website:** https://ebhcsjobboard.web.app
- **Admin Portal:** https://ebhcsjobboard.web.app/admin
- **Firebase Console:** https://console.firebase.google.com/project/ebhcs-bulletin-board
- **Error logs (monthly check):** Firebase Console → Firestore → `errors` collection
- **Tech Support:** [Your contact information]

### **For Advisors:**
- **Login Guide:** See ADVISOR_GUIDE.md
- **Password Reset:** Use "Forgot Password?" button
- **Technical Issues:** Contact [Your contact information]

### **Emergency Contacts:**
- **Firebase Issues:** Firebase Support (if needed)
- **Domain Issues:** [Your hosting provider]
- **User Account Issues:** [Your contact information]

---

## ✅ **FINAL SIGN-OFF CHECKLIST**

- [ ] All Firebase configuration complete
- [ ] All user accounts created and tested
- [ ] All security rules active
- [ ] All functionality tested and working
- [ ] Director has been trained
- [ ] All advisors have login credentials
- [ ] Documentation is complete and accessible
- [ ] Emergency procedures are in place
- [ ] Firebase Console keyholder is named and has access
- [ ] Error monitoring is active (check Firestore `errors` collection monthly)
- [ ] New-advisor 2-step checklist is understood by admin staff

---

## 🎯 **HANDOVER COMPLETE**

**System Status:** ✅ Production Ready  
**Security Level:** ✅ High  
**User Experience:** ✅ Professional  
**Documentation:** ✅ Complete  

**Ready for Director:** ✅ YES

---

*This system is now ready for production use. All security measures are in place, and the system provides a professional, user-friendly experience for both advisors and students.*
