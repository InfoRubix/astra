// Firebase Cloud Messaging Service Worker
// This file handles background push notifications on mobile and desktop

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js'); // Load config from separate file

// Initialize Firebase in the service worker using imported config
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  console.log('[firebase-messaging-sw.js] Notification title:', payload.notification?.title);
  console.log('[firebase-messaging-sw.js] Notification body:', payload.notification?.body);

  const notificationTitle = payload.notification?.title || 'Attendance Reminder';
  const notificationOptions = {
    body: payload.notification?.body || 'Don\'t forget to check in/out!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'attendance-notification',
    requireInteraction: true,
    data: payload.data || {}
  };

  console.log('[firebase-messaging-sw.js] Showing notification:', notificationTitle, notificationOptions);
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

  event.notification.close();

  // Open the app when notification is clicked
  const urlToOpen = event.notification.data?.url || '/user/attendance';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // If app is not open, open it
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Handle push events (for scheduled notifications)
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push received:', event);

  if (event.data) {
    const data = event.data.json();

    const notificationTitle = data.title || 'Attendance Reminder';
    const notificationOptions = {
      body: data.body || 'Don\'t forget to check in/out!',
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'attendance-notification',
      requireInteraction: true,
      data: data.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  }
});
