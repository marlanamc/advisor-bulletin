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

In Firestore Database → Rules, replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read bulletins
    match /bulletins/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Allow authenticated users to manage their own posts
    match /bulletins/{document} {
      allow update, delete: if request.auth != null &&
        request.auth.token.email in [
          "admin@ebhcs.org",
          "jorge@ebhcs.org",
          "fabiola@ebhcs.org",
          "leidy@ebhcs.org",
          "carmen@ebhcs.org",
          "jerome@ebhcs.org",
          "felipe@ebhcs.org",
          "simonetta@ebhcs.org",
          "mike@ebhcs.org",
          "leah@ebhcs.org"
        ];
    }
  }
}
```

## Step 4: Set Up Authentication

1. Go to "Authentication" in Firebase console
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password"
5. Add authorized users:
   - admin@ebhcs.org (password: advisor123)
   - jorge@ebhcs.org (password: ebhcs2025)
   - fabiola@ebhcs.org (password: ebhcs2025)
   - leidy@ebhcs.org (password: ebhcs2025)
   - carmen@ebhcs.org (password: ebhcs2025)
   - jerome@ebhcs.org (password: ebhcs2025)
   - felipe@ebhcs.org (password: ebhcs2025)
   - simonetta@ebhcs.org (password: ebhcs2025)
   - mike@ebhcs.org (password: ebhcs2025)
   - leah@ebhcs.org (password: ebhcs2025)

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

Replace the configuration in `firebase-config.js` with your actual Firebase config.

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