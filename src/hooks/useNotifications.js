import { useEffect } from 'react';
import { pushNotificationService } from '../services/pushNotificationService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to initialize push notifications for the user
 * @param {Object} companySettings - Company settings with work hours
 */
export const useNotifications = (companySettings) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !companySettings) {
      return;
    }

    // Check if user has enabled notifications
    const notificationPrefs = localStorage.getItem('notificationPreferences');
    const prefs = notificationPrefs ? JSON.parse(notificationPrefs) : null;

    // Check if permission was previously granted
    const permission = pushNotificationService.checkPermission();

    if (permission === 'granted' && (!prefs || prefs.enabled !== false)) {
      console.log('🔔 Initializing push notifications for user:', user.email);

      // Initialize notification schedules
      pushNotificationService.initializeNotifications({
        workStartTime: companySettings.workStartTime || '09:00',
        workEndTime: companySettings.workEndTime || '18:00',
        enableNotifications: true
      });
    }
  }, [user, companySettings]);

  return pushNotificationService;
};

export default useNotifications;
