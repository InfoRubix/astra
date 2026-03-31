# Mobile App Development Guide

## Current State: PWA (Progressive Web App)

The Attendance Management System is currently deployed as a PWA, which provides:
- Home screen installation on mobile devices
- Push notifications via FCM
- Offline-capable (with service worker)
- Responsive design for mobile screens

## React Native Migration Plan

When you're ready to build a dedicated mobile app, here's the recommended approach:

### Option 1: React Native + Expo (Recommended)

```bash
npx create-expo-app AttendanceApp --template blank-typescript
cd AttendanceApp
npx expo install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
npx expo install expo-location expo-notifications expo-camera
```

**Shared code from existing project:**
- `src/services/` - All service logic (attendanceService, leaveService, etc.)
- `src/utils/` - All utilities (attendanceHelpers, exportHelpers, etc.)
- `src/hooks/` - Custom hooks (useApprovalHandler, etc.)
- `src/contexts/` - AuthContext (needs minor adaptation for React Native)

**Must be rewritten:**
- All UI components (MUI → React Native Paper or NativeBase)
- Navigation (React Router → React Navigation)
- Maps (Google Maps API → react-native-maps)
- File handling (HTML5 File API → expo-document-picker)

### Option 2: Capacitor (Wrap existing React app)

Fastest path — wraps the existing React web app in a native shell:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Attendance System" com.rubix.attendance
npx cap add android
npx cap add ios
npm run build && npx cap sync
```

**Advantages:**
- Reuses 100% of existing code
- Native GPS via Capacitor Geolocation plugin
- Native push notifications via Capacitor Push Notifications
- Can be published to Play Store / App Store

**Plugins needed:**
```bash
npm install @capacitor/geolocation @capacitor/push-notifications @capacitor/camera @capacitor/filesystem
```

### Recommended: Start with Capacitor

Since the app is already responsive and PWA-ready, wrapping with Capacitor gives you native app store presence with minimal effort. Migrate to React Native later if you need deeper native integration.

### Key Mobile-Specific Features to Add
1. Biometric authentication (fingerprint/face)
2. Background location tracking for auto check-in
3. QR code check-in as alternative to GPS
4. Offline mode with local data sync
5. Native camera for receipt/document capture
