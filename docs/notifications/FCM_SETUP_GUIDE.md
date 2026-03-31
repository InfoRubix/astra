# 🚀 Firebase Cloud Messaging - Complete Setup

## What is This?

Firebase Cloud Messaging (FCM) allows notifications to work on mobile even when app is closed.

**Without FCM:** Notifications only work when app is open
**With FCM:** Notifications work anytime, anywhere

---

## Prerequisites

✅ You already have:
- Firebase project
- Hosting set up
- `.env` file configured

---

## Step 1: Get VAPID Key (5 minutes)

1. Go to **Firebase Console**: https://console.firebase.google.com
2. Select project: `attendance-management-sy-f2ec9`
3. Click ⚙️ **Settings** → **Project Settings**
4. Go to **Cloud Messaging** tab
5. Scroll to **Web Push certificates**
6. Click **Generate key pair**
7. Copy the key (starts with "B...")

Add to `.env`:
```env
REACT_APP_FIREBASE_VAPID_KEY=BPR...your_key_here
```

---

## Step 2: Install & Setup Firebase CLI (10 minutes)

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
cd "D:/laragon/www/Rubix/Attendance Management System"
firebase init

# Select:
# [x] Functions
# [x] Hosting
#
# Existing project: attendance-management-sy-f2ec9
# Functions: JavaScript
# Install dependencies: Yes
# Public directory: build
# Single-page app: Yes
```

---

## Step 3: Deploy Cloud Functions (5 minutes)

```bash
# Install function dependencies
cd functions
npm install
cd ..

# Deploy functions
firebase deploy --only functions
```

Wait 2-3 minutes for deployment.

---

## Step 4: Update Notification Settings (Code Already Ready!)

The code is already in place:
- ✅ `src/services/fcmNotificationService.js`
- ✅ `public/firebase-messaging-sw.js`
- ✅ `functions/index.js`

Just need to integrate in NotificationSettings component.

Edit `src/components/user/NotificationSettings.js`:

**Add import:**
```javascript
import { fcmNotificationService } from '../../services/fcmNotificationService';
```

**Update `handleEnableNotifications`:**
```javascript
const handleEnableNotifications = async () => {
  // Existing browser notification code...
  const granted = await pushNotificationService.requestPermission();

  if (granted) {
    // NEW: Add FCM initialization
    try {
      await fcmNotificationService.initialize();
      const token = await fcmNotificationService.requestPermissionAndGetToken();

      if (token && user) {
        await fcmNotificationService.saveTokenToDatabase(user.uid, token);
        console.log('✅ FCM enabled');
      }
    } catch (error) {
      console.log('FCM setup skipped:', error);
    }

    // Rest of existing code...
  }
};
```

---

## Step 5: Build & Deploy (5 minutes)

```bash
# Build app
npm run build

# Deploy everything
firebase deploy
```

---

## Step 6: Test

1. Open app on mobile
2. Go to Settings → Notifications
3. Enable notifications
4. Check Firestore → `fcmTokens` collection
5. Your token should be there!

**Scheduled notifications will run at:**
- 8:45 AM (check-in reminder)
- 5:50 PM (check-out reminder)

---

## 🎯 How It Works

```
Server (Cloud Function)
    ↓ runs at 8:45 AM
Reads FCM tokens from Firestore
    ↓
Sends notification via FCM
    ↓
User's phone receives notification
    ↓ even if app is closed!
Shows notification
```

---

## 💰 Cost

**FREE** for most use cases:
- Unlimited FCM messages
- 2M Cloud Function calls/month free
- You won't pay unless you have 100,000+ users

---

## 🐛 Troubleshooting

**No notification?**
1. Check `fcmTokens` collection - token saved?
2. Check Firebase Functions logs
3. Send test message from Firebase Console

**Function not running?**
```bash
firebase functions:log
```

---

## ⏰ Change Schedule Times

Edit `functions/index.js`:

```javascript
// Check-in at 8:30 AM instead of 8:45 AM
.schedule('30 8 * * 1-5')

// Check-out at 6:00 PM instead of 5:50 PM
.schedule('0 18 * * 1-5')
```

Then: `firebase deploy --only functions`

---

**Total Time:** 25-30 minutes
**Difficulty:** Medium
**Result:** Mobile notifications that work everywhere! 🎉
