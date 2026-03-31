# Firebase Configuration & Deployment Guide

## 🔥 **Firebase Updates Required**

This document outlines the comprehensive Firebase configuration updates needed to support the enhanced backend services for the Attendance Management System.

## 📋 **Files Updated/Created:**

### 1. **Enhanced Firebase Configuration**
- **File**: `src/services/firebase.js`
- **Updates**: 
  - Added offline persistence support
  - Firebase Functions integration  
  - Development emulator support
  - Enhanced error handling

### 2. **Firestore Security Rules**
- **File**: `firestore.rules`
- **Features**:
  - Multi-tenant company-based access control
  - Role-based permissions (admin/user)
  - Secure access for attendance, leaves, claims, notifications
  - Data validation and integrity checks

### 3. **Firestore Database Indexes**
- **File**: `firestore.indexes.json`
- **Optimizations**:
  - Composite indexes for complex queries
  - Company-scoped data filtering
  - Department and status-based filtering
  - Date range queries for reports

### 4. **Firebase Storage Rules**
- **File**: `storage.rules` (NEW)
- **Security**:
  - User profile images
  - Leave supporting documents
  - Claim receipts and attachments
  - File type and size validation

### 5. **Deployment Configuration**
- **File**: `firebase.json`
- **Enhanced**:
  - Hosting configuration with caching headers
  - Emulator settings for development
  - Functions deployment settings

### 6. **Environment Variables**
- **File**: `.env.example`
- **New Variables**:
  - Development emulator flags
  - Feature toggles
  - Offline support configuration

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `attendance-management-system`
4. Enable/disable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Authentication

1. In Firebase console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" provider
3. Optionally enable "Email link (passwordless sign-in)"

## 3. Create Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll deploy security rules later)
4. Select a location (choose closest to your users, e.g., asia-southeast1)

## 4. Enable Storage

1. Go to "Storage"
2. Click "Get started"
3. Choose same location as Firestore

## 5. Get Firebase Configuration

1. Go to Project settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon (</>) to add web app
4. Register app with nickname: "Attendance Management System"
5. Copy the configuration object

## 6. Configure Environment Variables

Create `.env` file in project root:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Malaysia Holidays API
REACT_APP_HOLIDAYS_API_URL=https://date.nager.at/Api

# App Configuration
REACT_APP_COMPANY_NAME=Your Company Name
REACT_APP_APP_VERSION=1.0.0
```

## 7. Install Firebase CLI

```bash
npm install -g firebase-tools
```

## 8. Login and Initialize Firebase

```bash
# Login to Firebase
firebase login

# Initialize Firebase in project directory
firebase init

# Select:
# - Firestore: Configure security rules and indexes
# - Storage: Configure security rules
# - Hosting: Configure files for Firebase Hosting (optional)
```

## 9. Deploy Security Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy indexes
firebase deploy --only firestore:indexes
```

## 10. Create Initial Admin User

After deploying, you'll need to create an admin user manually:

1. Register a user through your app
2. Go to Firestore Database in Firebase Console
3. Find the user document in "users" collection
4. Edit the document and change `role` field to `"admin"`

## 11. Security Rules Overview

Our security rules ensure:

- **Users** can only access their own data
- **Admins** can access all data
- **Authentication** is required for all operations
- **Role-based permissions** are enforced
- **Data validation** is performed on writes

## 12. Database Collections

The following collections will be created automatically:

- `users` - User profiles and settings
- `attendance` - Check-in/check-out records  
- `leaves` - Leave applications and approvals
- `claims` - Expense claims and receipts
- `departments` - Company departments
- `leaveTypes` - Types of leave available
- `announcements` - Company announcements
- `payslips` - Generated payslips
- `notifications` - User notifications

## 13. Testing with Emulators (Optional)

For development, you can use Firebase emulators:

```bash
# Start emulators
firebase emulators:start

# Access Emulator UI at: http://localhost:4000
```

## 14. Production Deployment

When ready for production:

```bash
# Build the app
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting

# Or deploy everything
firebase deploy
```

## 15. Monitoring and Analytics

- Enable Firebase Analytics in console
- Set up performance monitoring
- Configure crash reporting
- Monitor usage in Firebase console

## Troubleshooting

### Common Issues:

1. **Permission denied**: Check Firestore security rules
2. **API key errors**: Verify environment variables
3. **CORS errors**: Check Firebase configuration
4. **Storage errors**: Verify storage rules and permissions

### Security Rules Testing:

Use Firebase console's Rules Simulator to test your security rules before deploying.

## Next Steps

After Firebase setup:
1. Test user registration and login
2. Verify role-based access control
3. Test file uploads to Storage  
4. Configure email templates (optional)
5. Set up monitoring and alerts