# Firebase Setup Guide for EBHCS Bulletin Board

## Step 1: Create Firebase Project

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Name it "ebhcs-bulletin-board" (or similar)
4. **Disable Google Analytics** (not needed for this project)
5. Click "Create project"

## Step 2: Set Up Firestore Database

1. In your Firebase console, click "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" (we'll set rules later)
4. Select a location (choose "us-central1" for best performance in Boston area)
5. Click "Done"

## Step 3: Configure Security Rules

In Firestore Database → Rules, paste the content of the [firestore.rules](../firestore.rules) file from the root of this project.

These rules secure the bulletin board by:
1. Permitting public read access only to active posts and published resources.
2. Requiring an authenticated `@ebhcs.org` Google Account for creates and edits.
3. Restricting post updates to the original creator, while administrators (`mcreed@ebhcs.org`, `lgregory@ebhcs.org`) have global update/delete rights (authoritative list: `isPrivilegedAdvisor` in `firestore.rules`).
4. Ensuring structural data validation for posts, resources, analytics events, and error logs before writes are processed.

## Step 4: Set Up Authentication

1. Go to "Authentication" in Firebase console
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password"
5. Enable the **Google** sign-in provider (Authentication → Sign-in method → Add new provider → Google). Set the public-facing name to "EBHCS Bulletin Board" and pick a support email.

   No per-advisor account creation is needed: advisors sign in with their existing @ebhcs.org Google accounts, and their Firebase Auth account is created automatically on first sign-in. Portal access is controlled by the Advisors tab in the portal (the `advisors/{username}` Firestore collection), not by which Auth accounts exist. Leave the Email/Password provider disabled.

## Step 5: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Add app" → Web (</>)
4. Name it "EBHCS Bulletin Board"
5. Copy the configuration object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## Step 6: Update Your Website Files

Replace the configuration in `src/firebase.js`, `src/firebase-student.js`, and `src/firebase-auth.js` with your actual Firebase config (a blank starting template is in `config/firebase-config-template.js`).

## Step 7: Deploy to Firebase Hosting (Optional but Recommended)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. In your project folder: `firebase login`
3. `firebase init hosting`
4. Select your project
5. Set public directory to current folder
6. Choose "No" for single-page app
7. `firebase deploy`

## Benefits of This Setup:

✅ **Persistent Data**: Data survives even if you leave the school
✅ **Real-time Updates**: All users see changes instantly
✅ **Secure**: Only authorized advisors can post
✅ **Scalable**: Handles many students viewing simultaneously
✅ **Free**: Firebase free tier is generous for school use
✅ **Reliable**: Google's infrastructure, 99.95% uptime

## Important Notes:

- Keep your Firebase config secure but it's safe to include in client-side code
- The free tier includes 1GB storage and 50k reads/day (more than enough for a school)
- You can add more advisors by updating the security rules
- All data is automatically backed up by Google
- You can export data anytime from Firebase console

## Future Enhancements:

- Email notifications when new posts are added
- Image storage in Firebase Storage
- Analytics on popular job categories
- Push notifications for mobile users
- Admin dashboard with posting statistics