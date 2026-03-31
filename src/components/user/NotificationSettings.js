import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  NotificationsOff,
  Schedule,
  CheckCircle,
  Info,
  Warning,
  AccessTime,
  Logout
} from '@mui/icons-material';
import { pushNotificationService } from '../../services/pushNotificationService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * NotificationSettings - Allows the user to enable/disable push notifications
 * and configure reminder preferences (check-in, check-out, late warnings).
 *
 * Manages browser Notification API permission requests, persists
 * preferences to both localStorage and Firestore (fcmTokens collection),
 * and provides buttons to send test notifications (local and cloud).
 *
 * @param {Object} props
 * @param {Object} [props.companySettings] - Company configuration object.
 * @param {string} [props.companySettings.workStartTime] - Work start time in "HH:mm" format (default "09:00").
 * @param {string} [props.companySettings.workEndTime] - Work end time in "HH:mm" format (default "18:00").
 * @returns {JSX.Element}
 */
function NotificationSettings({ companySettings }) {
  const { user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [checkInReminder, setCheckInReminder] = useState(true);
  const [checkOutReminder, setCheckOutReminder] = useState(true);
  const [lateWarning, setLateWarning] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');

  useEffect(() => {
    // Load saved preferences
    const savedPrefs = localStorage.getItem('notificationPreferences');
    if (savedPrefs) {
      const prefs = JSON.parse(savedPrefs);
      setCheckInReminder(prefs.checkInReminder ?? true);
      setCheckOutReminder(prefs.checkOutReminder ?? true);
      setLateWarning(prefs.lateWarning ?? true);
    }

    // Check current permission status
    const status = pushNotificationService.checkPermission();
    setPermissionStatus(status);
    setNotificationsEnabled(status === 'granted');
  }, []);

  const handleEnableNotifications = async () => {
    if (!pushNotificationService.isNotificationSupported()) {
      setMessage('Notifications are not supported in your browser');
      setMessageType('error');
      return;
    }

    const granted = await pushNotificationService.requestPermission();

    if (granted) {
      setPermissionStatus('granted');
      setNotificationsEnabled(true);
      setMessage('✅ Notifications enabled successfully!');
      setMessageType('success');

      // Save initial preferences to Firestore
      try {
        const { db } = await import('../../services/firebase');
        const { doc, setDoc } = await import('firebase/firestore');

        await setDoc(doc(db, 'fcmTokens', user.uid), {
          userId: user.uid,
          checkInReminder: checkInReminder,
          checkOutReminder: checkOutReminder,
          lateWarning: lateWarning
        }, { merge: true });

        console.log('✅ Initial notification preferences saved to Firestore');
      } catch (error) {
        console.error('Error saving initial preferences:', error);
      }

      // Initialize notification schedules
      await pushNotificationService.initializeNotifications({
        workStartTime: companySettings?.workStartTime || '09:00',
        workEndTime: companySettings?.workEndTime || '18:00',
        enableNotifications: true
      });

      // Show test notification
      setTimeout(() => {
        pushNotificationService.showTestNotification();
      }, 1000);
    } else {
      setMessage('❌ Notification permission denied. Please enable in browser settings.');
      setMessageType('error');
    }

    setTimeout(() => setMessage(''), 5000);
  };

  const handleDisableNotifications = () => {
    // Update local state
    setNotificationsEnabled(false);
    setPermissionStatus('default');

    // Clear schedules
    pushNotificationService.clearAllSchedules();

    // Update localStorage
    localStorage.setItem('notificationPermission', 'default');

    setMessage('⚠️ Notifications disabled in app. To fully disable, please also block notifications in your browser settings (click the lock icon in address bar).');
    setMessageType('warning');
    setTimeout(() => setMessage(''), 8000);
  };

  const handlePreferenceChange = async (preference, value) => {
    const prefs = {
      checkInReminder,
      checkOutReminder,
      lateWarning,
      [preference]: value
    };

    // Update state
    switch (preference) {
      case 'checkInReminder':
        setCheckInReminder(value);
        break;
      case 'checkOutReminder':
        setCheckOutReminder(value);
        break;
      case 'lateWarning':
        setLateWarning(value);
        break;
      default:
        break;
    }

    // Save to localStorage
    localStorage.setItem('notificationPreferences', JSON.stringify(prefs));

    // Save to Firestore so Cloud Functions can access
    try {
      const { db } = await import('../../services/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      await setDoc(doc(db, 'fcmTokens', user.uid), {
        userId: user.uid,
        checkInReminder: prefs.checkInReminder,
        checkOutReminder: prefs.checkOutReminder,
        lateWarning: prefs.lateWarning
      }, { merge: true });

      console.log('✅ Notification preferences saved to Firestore');
    } catch (error) {
      console.error('Error saving preferences to Firestore:', error);
    }

    setMessage('Preferences saved');
    setMessageType('success');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleTestNotification = async () => {
    if (permissionStatus !== 'granted') {
      setMessage('Please enable notifications first');
      setMessageType('warning');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    await pushNotificationService.showTestNotification();
    setMessage('Test notification sent!');
    setMessageType('info');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleTestCloudFunction = async () => {
    try {
      setMessage('Sending cloud notification...');
      setMessageType('info');

      await pushNotificationService.testCloudFunctionNotification();

      setMessage('✅ Cloud notification sent! Check your device.');
      setMessageType('success');
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Cloud function error details:', error);

      let errorMsg = '❌ Error: ';
      if (error.code) {
        errorMsg += `[${error.code}] `;
      }
      if (error.details) {
        errorMsg += error.details;
      } else if (error.message) {
        errorMsg += error.message;
      } else {
        errorMsg += 'Unknown error occurred';
      }

      setMessage(errorMsg);
      setMessageType('error');
      setTimeout(() => setMessage(''), 10000); // Show for 10 seconds
    }
  };

  return (
    <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <NotificationsActive sx={{ fontSize: 28, color: 'primary.main', mr: 1.5 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.125rem' }}>
              Notification Settings
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Manage your check-in and check-out reminders
            </Typography>
          </Box>
        </Box>

        {message && (
          <Alert severity={messageType} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}

        {/* Permission Status */}
        <Paper sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {permissionStatus === 'granted' ? (
                <CheckCircle sx={{ color: 'success.main', mr: 1, fontSize: 20 }} />
              ) : permissionStatus === 'denied' ? (
                <NotificationsOff sx={{ color: 'error.main', mr: 1, fontSize: 20 }} />
              ) : (
                <Notifications sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
              )}
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.875rem' }}>
                  Notification Status
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {permissionStatus === 'granted' && 'Enabled and active'}
                  {permissionStatus === 'denied' && 'Blocked in browser'}
                  {permissionStatus === 'default' && 'Not configured'}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={permissionStatus.toUpperCase()}
              color={
                permissionStatus === 'granted' ? 'success' :
                permissionStatus === 'denied' ? 'error' : 'default'
              }
              size="small"
              sx={{ fontSize: '0.75rem' }}
            />
          </Box>
        </Paper>

        {/* Enable/Disable Notifications */}
        <Box sx={{ mb: 2 }}>
          {permissionStatus !== 'granted' ? (
            <Button
              variant="contained"
              fullWidth
              startIcon={<NotificationsActive />}
              onClick={handleEnableNotifications}
              sx={{ py: 1.2 }}
            >
              Enable Notifications
            </Button>
          ) : (
            <Button
              variant="outlined"
              fullWidth
              color="error"
              startIcon={<NotificationsOff />}
              onClick={handleDisableNotifications}
              sx={{ py: 1.2 }}
            >
              Disable Notifications
            </Button>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Notification Preferences */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, fontSize: '0.875rem' }}>
          Reminder Preferences
        </Typography>

        <List sx={{ py: 0 }}>
          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AccessTime color={checkInReminder ? 'primary' : 'disabled'} sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" fontWeight={600}>Check-In Reminder</Typography>}
              secondary={
                <Typography variant="caption" color="text.secondary">
                  15 min before work ({companySettings?.workStartTime || '09:00'})
                </Typography>
              }
              sx={{ my: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={checkInReminder}
                  onChange={(e) => handlePreferenceChange('checkInReminder', e.target.checked)}
                  disabled={permissionStatus !== 'granted'}
                />
              }
              label=""
              sx={{ mr: 0 }}
            />
          </ListItem>

          <ListItem sx={{ px: 0, py: 1 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Logout color={checkOutReminder ? 'primary' : 'disabled'} sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText
              primary={<Typography variant="body2" fontWeight={600}>Check-Out Reminder</Typography>}
              secondary={
                <Typography variant="caption" color="text.secondary">
                  15 min before work ends ({companySettings?.workEndTime || '18:00'})
                </Typography>
              }
              sx={{ my: 0 }}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={checkOutReminder}
                  onChange={(e) => handlePreferenceChange('checkOutReminder', e.target.checked)}
                  disabled={permissionStatus !== 'granted'}
                />
              }
              label=""
              sx={{ mr: 0 }}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
}

export default NotificationSettings;
