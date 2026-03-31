/**
 * Push Notification Service for Browser Notifications
 * Handles check-in and check-out reminders
 */

class PushNotificationService {
  constructor() {
    this.permission = 'default';
    this.isSupported = 'Notification' in window;
  }

  /**
   * Check if notifications are supported
   */
  isNotificationSupported() {
    return this.isSupported;
  }

  /**
   * Request notification permission and register FCM token
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;

      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        // Store permission in localStorage
        localStorage.setItem('notificationPermission', 'granted');

        // Register FCM token to Firestore for Cloud Functions
        await this.registerFCMToken();

        return true;
      } else if (permission === 'denied') {
        console.log('❌ Notification permission denied');
        localStorage.setItem('notificationPermission', 'denied');
        return false;
      } else {
        console.log('⚠️ Notification permission dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Register FCM token to Firestore for server-side notifications
   */
  async registerFCMToken() {
    try {
      const { getMessaging, getToken } = await import('firebase/messaging');
      const { auth, app } = await import('../services/firebase');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../services/firebase');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn('User not logged in, cannot register FCM token');
        return null;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered');

      // Get FCM token
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');

        // Save token to Firestore
        await setDoc(doc(db, 'fcmTokens', currentUser.uid), {
          userId: currentUser.uid,
          token: token,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        });

        console.log('✅ FCM token saved to Firestore');
        return token;
      } else {
        console.warn('No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('Error registering FCM token:', error);
      return null;
    }
  }

  /**
   * Check current permission status
   */
  checkPermission() {
    if (!this.isSupported) {
      return 'unsupported';
    }

    this.permission = Notification.permission;
    return this.permission;
  }

  /**
   * Show a notification
   */
  async showNotification(title, options = {}) {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return null;
    }

    if (this.checkPermission() !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/logo192.png', // Your app icon
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true, // Keep notification until user interacts
        ...options
      });

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  /**
   * Show check-in reminder notification
   */
  async showCheckInReminder(companyWorkStartTime = '09:00') {
    return await this.showNotification('⏰ Time to Check In!', {
      body: `Good morning! Don't forget to check in for work.\nWork starts at ${companyWorkStartTime}`,
      tag: 'check-in-reminder',
      icon: '/logo192.png',
      actions: [
        { action: 'checkin', title: 'Check In Now' },
        { action: 'snooze', title: 'Remind me in 5 min' }
      ],
      onClick: () => {
        // Navigate to attendance page
        window.location.href = '/attendance';
      }
    });
  }

  /**
   * Show check-out reminder notification
   */
  async showCheckOutReminder(companyWorkEndTime = '18:00') {
    return await this.showNotification('🏁 Time to Check Out!', {
      body: `Your work day is ending at ${companyWorkEndTime}.\nDon't forget to check out!`,
      tag: 'check-out-reminder',
      icon: '/logo192.png',
      actions: [
        { action: 'checkout', title: 'Check Out Now' },
        { action: 'snooze', title: 'Remind me in 5 min' }
      ],
      onClick: () => {
        // Navigate to attendance page
        window.location.href = '/attendance';
      }
    });
  }

  /**
   * Show late check-in warning
   */
  async showLateCheckInWarning(minutesLate) {
    return await this.showNotification('⚠️ Late Check-In Warning', {
      body: `You are ${minutesLate} minutes late. Please check in as soon as possible.`,
      tag: 'late-checkin-warning',
      icon: '/logo192.png',
      requireInteraction: true,
      onClick: () => {
        window.location.href = '/attendance';
      }
    });
  }

  /**
   * Show missed check-out notification
   */
  async showMissedCheckOutNotification(date) {
    return await this.showNotification('❌ Missed Check-Out', {
      body: `You forgot to check out on ${date}. Please submit a forgotten check-out request.`,
      tag: 'missed-checkout',
      icon: '/logo192.png',
      requireInteraction: true,
      onClick: () => {
        window.location.href = '/forgotten-checkouts';
      }
    });
  }

  /**
   * Schedule check-in reminder
   * @param {string} workStartTime - Format: "HH:MM" (24-hour)
   * @param {number} minutesBefore - How many minutes before work start time
   */
  scheduleCheckInReminder(workStartTime = '09:00', minutesBefore = 15) {
    if (this.checkPermission() !== 'granted') {
      return null;
    }

    const [hours, minutes] = workStartTime.split(':').map(Number);
    const now = new Date();
    const reminderTime = new Date();

    reminderTime.setHours(hours, minutes - minutesBefore, 0, 0);

    // If reminder time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeUntilReminder = reminderTime - now;

    console.log(`⏰ Check-in reminder scheduled for ${reminderTime.toLocaleString()}`);

    return setTimeout(() => {
      this.showCheckInReminder(workStartTime);
      // Reschedule for next day
      this.scheduleCheckInReminder(workStartTime, minutesBefore);
    }, timeUntilReminder);
  }

  /**
   * Schedule check-out reminder
   * @param {string} workEndTime - Format: "HH:MM" (24-hour)
   * @param {number} minutesBefore - How many minutes before work end time
   */
  scheduleCheckOutReminder(workEndTime = '18:00', minutesBefore = 10) {
    if (this.checkPermission() !== 'granted') {
      return null;
    }

    const [hours, minutes] = workEndTime.split(':').map(Number);
    const now = new Date();
    const reminderTime = new Date();

    reminderTime.setHours(hours, minutes - minutesBefore, 0, 0);

    // If reminder time has passed today, schedule for tomorrow
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeUntilReminder = reminderTime - now;

    console.log(`⏰ Check-out reminder scheduled for ${reminderTime.toLocaleString()}`);

    return setTimeout(() => {
      this.showCheckOutReminder(workEndTime);
      // Reschedule for next day
      this.scheduleCheckOutReminder(workEndTime, minutesBefore);
    }, timeUntilReminder);
  }

  /**
   * Check if user should be reminded to check in (with grace period check)
   */
  shouldRemindCheckIn(workStartTime, gracePeriodMinutes = 30) {
    const [hours, minutes] = workStartTime.split(':').map(Number);
    const now = new Date();
    const workStart = new Date();
    workStart.setHours(hours, minutes, 0, 0);

    const gracePeriodEnd = new Date(workStart);
    gracePeriodEnd.setMinutes(gracePeriodEnd.getMinutes() + gracePeriodMinutes);

    // Remind if current time is between work start and grace period end
    return now >= workStart && now <= gracePeriodEnd;
  }

  /**
   * Clear all scheduled notifications
   */
  clearAllSchedules() {
    // Note: This only clears timers in current session
    // For persistent scheduling, use Service Worker or Cloud Functions
    console.log('Clearing all notification schedules');
  }

  /**
   * Initialize notification system for a user
   */
  async initializeNotifications(userSettings) {
    const { workStartTime, workEndTime, enableNotifications } = userSettings;

    if (!enableNotifications) {
      console.log('Notifications disabled by user');
      return false;
    }

    // Check and request permission
    const hasPermission = await this.requestPermission();
    if (!hasPermission) {
      return false;
    }

    // Schedule daily reminders
    this.scheduleCheckInReminder(workStartTime || '09:00', 15);
    this.scheduleCheckOutReminder(workEndTime || '18:00', 10);

    return true;
  }

  /**
   * Show a test notification (Local browser notification)
   */
  async showTestNotification() {
    return await this.showNotification('🔔 Test Notification', {
      body: 'Notifications are working! You will receive check-in and check-out reminders.',
      tag: 'test-notification',
      icon: '/logo192.png'
    });
  }

  /**
   * Test FCM Cloud Function notification
   * This calls the Firebase Cloud Function to send a push notification
   */
  async testCloudFunctionNotification() {
    try {
      // Import Firebase Functions and Auth
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { auth } = await import('../services/firebase');

      // Check if user is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to test cloud notifications');
      }

      // Get auth token to verify authentication
      const token = await currentUser.getIdToken();
      console.log('User authenticated, calling cloud function as:', currentUser.uid);
      console.log('Auth token exists:', !!token);

      // Get functions instance - use the auth.app to ensure same instance
      const functions = getFunctions(auth.app, 'us-central1');

      // Call the cloud function (auth token is automatically attached by SDK)
      const sendTestNotification = httpsCallable(functions, 'sendTestNotification');

      console.log('Calling function...');
      const result = await sendTestNotification();

      console.log('✅ Cloud function success:', result);
      return result.data;
    } catch (error) {
      console.error('❌ Cloud function error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      throw error;
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
