# Firebase Configuration Checklist

## Your Firebase Project Details
- **Project ID**: `l2p-kyc`
- **Storage Bucket**: `l2p-kyc.firebasestorage.app`
- **Auth Domain**: `l2p-kyc.firebaseapp.com`

## Steps to Check in Firebase Console

### 1. Go to Firebase Console
Open: https://console.firebase.google.com/
Select your project: **l2p-kyc**

### 2. Check Firebase Storage Rules
**Path**: Storage → Rules

**Current rules should allow authenticated users:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /sanctions/{fileName} {
      allow read, write: if request.auth != null;
    }
    // Allow authenticated users to read/write their own files
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**To update:**
1. Go to Storage → Rules
2. Click "Edit rules"
3. Paste the rules above
4. Click "Publish"

### 3. Check Firestore Rules
**Path**: Firestore Database → Rules

**Current rules should allow authenticated users:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sanctions/{document=**} {
      allow read, write: if request.auth != null;
    }
    // Allow authenticated users to read/write
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**To update:**
1. Go to Firestore Database → Rules
2. Click "Edit rules"
3. Paste the rules above
4. Click "Publish"

### 4. Check Authentication
**Path**: Authentication → Users

**Verify:**
- Your user account exists
- Email is verified (if required)
- User is enabled

### 5. Check Storage Usage
**Path**: Storage → Files

**Verify:**
- Storage is enabled
- No quota exceeded warnings
- Files can be uploaded manually (test)

### 6. Check Firestore Database
**Path**: Firestore Database → Data

**Verify:**
- Database is created
- Collection `sanctions` exists (or will be created on first write)
- No quota exceeded warnings

### 7. Check API Keys & Configuration
**Path**: Project Settings → General

**Verify:**
- Your API key is enabled
- Storage location is set correctly
- Billing is enabled (if using Blaze plan for Storage)

## Common Issues & Solutions

### Issue: "Permission denied" errors
**Solution**: Update Storage and Firestore rules (see above)

### Issue: "Quota exceeded"
**Solution**: 
- Check Firebase usage in console
- Upgrade to Blaze plan if needed
- Check Storage and Firestore quotas

### Issue: "Unauthenticated" errors
**Solution**: 
- Verify user is logged in
- Check Authentication → Users
- Verify email is verified

### Issue: Storage not initialized
**Solution**:
- Go to Storage → Get Started
- Enable Storage if not already enabled
- Choose location (us-central1 recommended)

## Testing Checklist

1. ✅ User can log in
2. ✅ Storage rules allow authenticated uploads
3. ✅ Firestore rules allow authenticated writes
4. ✅ Storage bucket exists and is accessible
5. ✅ No quota warnings in console
6. ✅ API keys are enabled

## Quick Test Commands

Open browser console (F12) and check:
```javascript
// Check if Firebase is initialized
console.log('Storage:', window.firebase?.storage)
console.log('Auth:', window.firebase?.auth)

// Check current user
firebase.auth().currentUser
```

## Need Help?

If uploads still fail after checking all above:
1. Check browser console (F12) for specific error codes
2. Check Firebase console → Usage for quota issues
3. Verify your user is authenticated in the app
4. Try uploading a small test file manually in Firebase Console


