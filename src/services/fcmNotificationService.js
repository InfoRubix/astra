import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import app from './firebase';

/**
 * Firebase Cloud Messaging Service for Mobile Push Notifications
 * This service works on mobile devices even when the app is closed
 */

class FCMNotificationService {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.isSupported = false;
    this.initialized = false;
  }

  /**
   * Initialize FCM
   */
  async initialize() {
    if (this.initialized) {
      return this.isSupported;
    }

    try {
      // Check if messaging is supported
      if ('Notification' in window && 'serviceWorker' in navigator) {
        this.messaging = getMessaging(app);
        this.isSupported = true;
        console.log('✅ FCM is supported');

        // Set up foreground message handler
        this.setupForegroundHandler();
      } else {
        console.warn('⚠️ FCM not supported in this browser');
        this.isSupported = false;
      }
    } catch (error) {
      console.error('Error initializing FCM:', error);
      this.isSupported = false;
    }

    this.initialized = true;
    return this.isSupported;
  }

  /**
   * Request permission and get FCM token
   */
  async requestPermissionAndGetToken() {
    if (!this.isSupported) {
      console.warn('FCM not supported');
      return null;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        return null;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered:', registration);

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (token) {
        console.log('✅ FCM Token obtained:', token);
        this.currentToken = token;

        // Save token to localStorage
        localStorage.setItem('fcmToken', token);

        return token;
      } else {
        console.log('No registration token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Get current FCM token (if already obtained)
   */
  getCurrentToken() {
    return this.currentToken || localStorage.getItem('fcmToken');
  }

  /**
   * Setup foreground message handler (when app is open)
   */
  setupForegroundHandler() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);

      const notificationTitle = payload.notification?.title || 'Attendance Reminder';
      const notificationOptions = {
        body: payload.notification?.body || '',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: payload.data?.tag || 'attendance-notification',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      };

      // Show notification even when app is in foreground
      if (Notification.permission === 'granted') {
        const notification = new Notification(notificationTitle, notificationOptions);

        notification.onclick = () => {
          window.focus();
          notification.close();

          // Navigate to attendance page if needed
          if (payload.data?.url) {
            window.location.href = payload.data.url;
          }
        };
      }
    });
  }

  /**
   * Save FCM token to Firestore for the user
   */
  async saveTokenToDatabase(userId, token) {
    try {
      const { db } = await import('./firebase');
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

      await setDoc(doc(db, 'fcmTokens', userId), {
        token: token,
        userId: userId,
        platform: this.getPlatform(),
        browser: this.getBrowser(),
        lastUpdated: serverTimestamp(),
        active: true
      }, { merge: true });

      console.log('✅ FCM token saved to database');
      return true;
    } catch (error) {
      console.error('Error saving FCM token:', error);
      return false;
    }
  }

  /**
   * Delete FCM token (on logout)
   */
  async deleteToken(userId) {
    try {
      const { db } = await import('./firebase');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

      await updateDoc(doc(db, 'fcmTokens', userId), {
        active: false,
        deletedAt: serverTimestamp()
      });

      localStorage.removeItem('fcmToken');
      this.currentToken = null;

      console.log('✅ FCM token deleted');
      return true;
    } catch (error) {
      console.error('Error deleting FCM token:', error);
      return false;
    }
  }

  /**
   * Get platform information
   */
  getPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    if (/android/i.test(userAgent)) {
      return 'Android';
    }

    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'iOS';
    }

    if (/Win/i.test(userAgent)) {
      return 'Windows';
    }

    if (/Mac/i.test(userAgent)) {
      return 'MacOS';
    }

    if (/Linux/i.test(userAgent)) {
      return 'Linux';
    }

    return 'Unknown';
  }

  /**
   * Get browser information
   */
  getBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Firefox')) {
      return 'Firefox';
    } else if (userAgent.includes('Chrome')) {
      return 'Chrome';
    } else if (userAgent.includes('Safari')) {
      return 'Safari';
    } else if (userAgent.includes('Edge')) {
      return 'Edge';
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      return 'Opera';
    }

    return 'Unknown';
  }

  /**
   * Check if running on mobile device
   */
  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
}

// Export singleton instance
export const fcmNotificationService = new FCMNotificationService();
export default fcmNotificationService;
