import React, { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  useTheme,
  Divider,
  Skeleton
} from '@mui/material';
import {
  AccessTime,
  LocationOn,
  CheckCircle,
  Schedule,
  ExitToApp,
  Login,
  History,
  MyLocation,
  Business,
  WbSunny,
  Map as MapIcon,
  Satellite,
  Terrain
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { collection, addDoc, query, where, orderBy, limit, getDocs, getDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { attendanceService } from '../../services/attendanceService';
import { pushNotificationService } from '../../services/pushNotificationService';
import { useNotifications } from '../../hooks/useNotifications';
import AttendanceMap from '../../components/AttendanceMap';
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api';
import { getRawCheckIn, getRawCheckOut, getCheckInTime, getCheckOutTime, isCurrentlyCheckedIn, isRecordCorrupted as checkRecordCorrupted, formatTimeHHMM } from '../../utils/attendanceHelpers';

const libraries = ['places', 'geometry'];

function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [checkOutDialog, setCheckOutDialog] = useState(false);
  const [checkOutReason, setCheckOutReason] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const [recentAttendanceLoading, setRecentAttendanceLoading] = useState(true);
  const [todayAttendanceLoading, setTodayAttendanceLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState(null);
  const [companyLocation, setCompanyLocation] = useState(null);
  const [mapType, setMapType] = useState('hybrid'); // 'roadmap', 'satellite', 'hybrid', 'terrain'

  // Load Google Maps
  const { isLoaded: isMapsLoaded } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_PLACES_API_KEY,
    libraries,
  });

  // Initialize push notifications
  useNotifications(companySettings);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Don't get location on page load - only when checking in/out

  const getBestLocation = async () => {
    setLocationLoading(true);
    setError(''); // Clear any previous errors

    console.log('🔄 Starting location acquisition...');

    try {
      const locationAttempts = [];

      // 1. Try High-Accuracy GPS First (Preferred method using satellite GPS)
      console.log('🛰️ Trying high-accuracy GPS...');
      try {
        const gpsPosition = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, // Use GPS satellites
            timeout: 15000,
            maximumAge: 0 // Fresh GPS reading, no cache
          });
        });

        locationAttempts.push({
          latitude: gpsPosition.coords.latitude,
          longitude: gpsPosition.coords.longitude,
          accuracy: gpsPosition.coords.accuracy,
          method: 'gps-high',
          timestamp: gpsPosition.timestamp
        });

        console.log(`🛰️ High-accuracy GPS: ±${gpsPosition.coords.accuracy.toFixed(0)}m accuracy`);

        // If GPS location is reasonably accurate (within 100m), use it immediately
        if (gpsPosition.coords.accuracy <= 100) {
          setLocation(locationAttempts[0]);
          console.log(`✅ Using GPS location (excellent accuracy): ±${gpsPosition.coords.accuracy.toFixed(0)}m`);
          setLocationLoading(false);
          return;
        }
      } catch (error) {
        console.warn('🛰️ High-accuracy GPS failed:', error);
      }

      // 2. Try Network Location as fallback (WiFi/Cell towers)
      if (locationAttempts.length === 0 || locationAttempts[0].accuracy > 100) {
        console.log('📡 GPS unavailable or poor accuracy, trying network location (WiFi/Cell)...');
        try {
          const networkPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false, // Use network location
              timeout: 10000,
              maximumAge: 0 // MUST get fresh location, no cache
            });
          });

          locationAttempts.push({
            latitude: networkPosition.coords.latitude,
            longitude: networkPosition.coords.longitude,
            accuracy: networkPosition.coords.accuracy,
            method: 'network',
            timestamp: networkPosition.timestamp
          });

          console.log(`📡 Network location: ±${networkPosition.coords.accuracy.toFixed(0)}m accuracy`);
        } catch (error) {
          console.warn('📡 Network location failed:', error);
        }
      }

      // 3. Fallback: Basic GPS (if both above failed or are very poor)
      if (locationAttempts.length === 0 || Math.min(...locationAttempts.map(a => a.accuracy)) > 500) {
        console.log('📍 Trying basic GPS as final fallback...');
        try {
          const basicGpsPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: 0 // MUST get fresh location, no cache
            });
          });

          locationAttempts.push({
            latitude: basicGpsPosition.coords.latitude,
            longitude: basicGpsPosition.coords.longitude,
            accuracy: basicGpsPosition.coords.accuracy,
            method: 'gps-basic',
            timestamp: basicGpsPosition.timestamp
          });

          console.log(`📍 Basic GPS: ±${basicGpsPosition.coords.accuracy.toFixed(0)}m accuracy`);
        } catch (error) {
          console.warn('📍 Basic GPS failed:', error);
        }
      }

      if (locationAttempts.length > 0) {
        // Prefer GPS location over network if both are available
        let bestLocation;
        const gpsLocation = locationAttempts.find(loc => loc.method === 'gps-high');

        if (gpsLocation) {
          bestLocation = gpsLocation;
          console.log(`✅ Using GPS location: ±${gpsLocation.accuracy.toFixed(0)}m accuracy`);
        } else {
          // Use the most accurate available location (network or basic GPS)
          bestLocation = locationAttempts.reduce((best, current) =>
            current.accuracy < best.accuracy ? current : best
          );
          console.log(`✅ Using ${bestLocation.method} location: ±${bestLocation.accuracy.toFixed(0)}m accuracy`);
        }

        setLocation(bestLocation);
      } else {
        setError('Unable to get location. Please enable location access and try again.');
      }
    } catch (error) {
      console.error('❌ Error getting location:', error);
      setError('Location access required for attendance recording');
    }

    setLocationLoading(false);
  };

  // Load today's attendance and recent history
  useEffect(() => {
    if (user) {
      loadTodayAttendance();
      loadRecentAttendance();
      loadCompanySettings();
      loadCompanyLocation();
    }
  }, [user]);



  const loadTodayAttendance = async () => {
    setTodayAttendanceLoading(true);
    try {
      console.log('🔄 Loading today\'s attendance for user:', user.uid);
      // Use attendance service to get today's attendance
      const attendanceData = await attendanceService.getTodayAttendance(user.uid);

      if (attendanceData) {
        console.log('✅ Found today\'s attendance:', attendanceData);
        console.log('📊 Check-in time details:', {
          checkInTime: attendanceData.checkInTime,
          type: typeof attendanceData.checkInTime,
          hasToDate: !!attendanceData.checkInTime?.toDate
        });
        setTodayAttendance(attendanceData);
      } else {
        setTodayAttendance(null);
        console.log('❌ No attendance record found for today');
      }
    } catch (error) {
      console.error('❌ Error loading today\'s attendance:', error);
      setTodayAttendance(null);
    } finally {
      setTodayAttendanceLoading(false);
    }
  };

  const loadRecentAttendance = async () => {
    setRecentAttendanceLoading(true);
    try {
      // Simple query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const attendance = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });

      // Sort by date on client side and limit to 7 most recent
      const sortedAttendance = attendance.sort((a, b) => {
        try {
          const aDate = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const bDate = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          return bDate - aDate; // Most recent first
        } catch (error) {
          return 0;
        }
      }).slice(0, 7);

      setRecentAttendance(sortedAttendance);
      console.log('Recent attendance loaded:', sortedAttendance.length, 'records');
    } catch (error) {
      console.error('Error loading recent attendance:', error);
    } finally {
      setRecentAttendanceLoading(false);
    }
  };

  const loadCompanySettings = async () => {
    try {
      const userCompany = user.company || user.originalCompanyName || '';
      console.log('🏢 Loading company settings for:', userCompany);
      console.log('🔍 User object:', { company: user.company, originalCompanyName: user.originalCompanyName });
      
      const q = query(
        collection(db, 'companySettings'),
        where('company', '==', userCompany),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      console.log('📋 Company settings query results:', querySnapshot.size, 'documents found');
      
      if (!querySnapshot.empty) {
        const settingsDoc = querySnapshot.docs[0];
        const settings = { id: settingsDoc.id, ...settingsDoc.data() };
        // Also load branch-level geofence radius if user has branchId
        if (user.branchId) {
          try {
            const branchDoc = await getDoc(doc(db, 'branches', user.branchId));
            if (branchDoc.exists() && branchDoc.data().geofenceRadius) {
              settings.branchGeofenceRadius = branchDoc.data().geofenceRadius;
            }
          } catch (branchErr) {
            console.warn('Could not load branch geofence:', branchErr);
          }
        }

        setCompanySettings(settings);
        console.log('✅ Company settings loaded:', settings);
      } else {
        console.warn('⚠️ No company settings found for:', userCompany);
        // Set default settings if none found
        setCompanySettings({
          workStartTime: '09:00',
          workEndTime: '18:00',
          lunchStartTime: '12:00',
          lunchEndTime: '13:00',
          allowFlexibleHours: false,
          flexibleHoursWindow: 0,
          geofenceRadius: 200,
          workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        });
        console.log('📝 Using default settings with 09:00 start time');
      }
    } catch (error) {
      console.error('❌ Error loading company settings:', error);
      // Use default settings on error
      setCompanySettings({
        workStartTime: '09:00',
        workEndTime: '18:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        allowFlexibleHours: false,
        flexibleHoursWindow: 0,
        geofenceRadius: 200,
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    }
  };

  const loadCompanyLocation = async () => {
    try {
      const userCompany = user.company || user.originalCompanyName || '';
      console.log('🔍 Loading company location for:', userCompany);

      const q = query(
        collection(db, 'companies'),
        where('name', '==', userCompany)
      );

      const querySnapshot = await getDocs(q);
      console.log('📊 Companies found:', querySnapshot.size);

      if (!querySnapshot.empty) {
        const companyDoc = querySnapshot.docs[0];
        const companyData = companyDoc.data();
        console.log('🏢 Company data:', companyData);

        if (companyData.location && companyData.location.latitude && companyData.location.longitude) {
          const locationData = {
            latitude: parseFloat(companyData.location.latitude),
            longitude: parseFloat(companyData.location.longitude),
            name: companyData.name,
            address: companyData.address
          };
          setCompanyLocation(locationData);
          console.log('✅ Company location loaded:', locationData);
        } else {
          console.warn('⚠️ No location coordinates found in company profile');
          console.log('💡 Will use location from attendance record as fallback');
          setCompanyLocation(null);
        }
      } else {
        console.warn('⚠️ No company found with name:', userCompany);
        setCompanyLocation(null);
      }
    } catch (error) {
      console.error('❌ Error loading company location:', error);
      setCompanyLocation(null);
    }
  };


  // Calculate distance using Google Maps Geometry library (returns meters)
  const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
    if (!window.google?.maps?.geometry) return null;
    const from = new window.google.maps.LatLng(lat1, lng1);
    const to = new window.google.maps.LatLng(lat2, lng2);
    return window.google.maps.geometry.spherical.computeDistanceBetween(from, to);
  };

  // Get distance from company office (in meters)
  const getDistanceFromOffice = () => {
    if (!location || !companyLocation) {
      return null;
    }

    return calculateDistanceMeters(
      location.latitude,
      location.longitude,
      companyLocation.latitude,
      companyLocation.longitude
    );
  };

  // Get location quality assessment
  const getLocationQuality = (accuracy) => {
    if (!accuracy) return { level: 'unknown', label: 'Unknown', color: 'default' };
    
    if (accuracy <= 50) {
      return { level: 'excellent', label: 'Excellent', color: 'success' };
    } else if (accuracy <= 100) {
      return { level: 'good', label: 'Good', color: 'success' };
    } else if (accuracy <= 500) {
      return { level: 'fair', label: 'Fair', color: 'warning' };
    } else {
      return { level: 'poor', label: 'Poor - Verification Needed', color: 'error' };
    }
  };

  // Check if location is reliable for distance calculation
  const isLocationReliable = (accuracy) => {
    return accuracy && accuracy <= 500; // Only show distance if accuracy is 500m or better
  };

  const getIncompleteRecords = () => {
    return recentAttendance.filter(record =>
      getRawCheckIn(record) && !getRawCheckOut(record)
    );
  };


  const handleCheckIn = async () => {
    // Block check-in while today's attendance data is still loading (prevents duplicates after refresh)
    if (todayAttendanceLoading) {
      setError('Please wait, loading attendance data...');
      return;
    }

    if (isCurrentlyCheckedIn(todayAttendance)) {
      setError('You are already checked in today');
      return;
    }

    // Also block if any record already exists for today (even if checked out)
    if (todayAttendance) {
      setError('Attendance record already exists for today');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get fresh location for check-in
      console.log('Getting fresh location for check-in...');
      
      let currentLocation = null;
      let attempts = 0;
      const maxAttempts = 2;
      
      // Try to get location with multiple attempts
      while (!currentLocation && attempts < maxAttempts) {
        attempts++;
        console.log(`Location attempt ${attempts}/${maxAttempts}`);
        
        try {
          await getBestLocation();
          // Wait for state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          currentLocation = location;
        } catch (error) {
          console.warn(`Location attempt ${attempts} failed:`, error);
          if (attempts < maxAttempts) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // If still no location, try a simpler GPS request as fallback
      if (!currentLocation) {
        console.log('Trying fallback GPS location request...');
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, // Use GPS for fallback as well
              timeout: 10000,
              maximumAge: 0 // MUST get fresh location, no cache
            });
          });

          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'gps-fallback'
          };

          setLocation(currentLocation);
          console.log('Fallback GPS location acquired:', currentLocation);
        } catch (fallbackError) {
          console.error('Fallback GPS location failed:', fallbackError);
        }
      }
      
      if (!currentLocation) {
        setError('Unable to get your location. Please ensure GPS is enabled and location access is allowed in your browser settings.');
        setLoading(false);
        return;
      }

      // Calculate distance from office using Google Maps Geometry (in meters)
      const distanceMeters = companyLocation ? calculateDistanceMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        companyLocation.latitude,
        companyLocation.longitude
      ) : null;

      // Enforce geofence - priority: staff override > branch > company > default (200m)
      const geofenceRadius = user.geofenceRadius
        || companySettings?.branchGeofenceRadius
        || companySettings?.geofenceRadius
        || 200;
      if (distanceMeters !== null && distanceMeters > geofenceRadius) {
        const distanceDisplay = distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${Math.round(distanceMeters)} m`;
        setError(`You are ${distanceDisplay} from the office. Check-in is only allowed within ${geofenceRadius}m radius.`);
        setLoading(false);
        return;
      }

      const attendanceData = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        company: user.originalCompanyName || user.company || '',
        department: user.department || 'General',
        location: currentLocation,
        distanceFromOffice: distanceMeters,
        companyLocation: companyLocation,
        locationQuality: getLocationQuality(currentLocation.accuracy),
        locationReliable: isLocationReliable(currentLocation.accuracy),
        notes: ''
      };

      // Use attendance service to create proper record
      const result = await attendanceService.clockIn(attendanceData);
      console.log('Check-in recorded via service:', result);
      
      const checkInTime = format(new Date(), 'HH:mm');
      setSuccess(`Successfully checked in at ${checkInTime}!`);

      // Show browser notification
      const notificationPrefs = localStorage.getItem('notificationPreferences');
      if (notificationPrefs && pushNotificationService.checkPermission() === 'granted') {
        await pushNotificationService.showNotification('✅ Checked In Successfully', {
          body: `You checked in at ${checkInTime}. Have a productive day!`,
          tag: 'check-in-success',
          icon: '/logo192.png'
        });
      }

      // Reload attendance data immediately
      await loadTodayAttendance();
      await loadRecentAttendance();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Check-in error:', error);
      setError('Failed to record check-in: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!todayAttendance || !getRawCheckIn(todayAttendance) || getRawCheckOut(todayAttendance)) {
      setError('No active check-in found for today');
      return;
    }

    setCheckOutDialog(true);
  };

  const confirmCheckOut = async () => {
    setLoading(true);
    setCheckOutDialog(false);

    try {
      // Get fresh location for check-out
      console.log('Getting fresh location for check-out...');
      await getBestLocation();
      
      // Wait a moment for location to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Calculate distance from office using current location
      const distanceFromOffice = getDistanceFromOffice();
      
      // Use attendance service for check-out
      const clockOutData = {
        location: location,
        distanceFromOffice: distanceFromOffice,
        companyLocation: companyLocation,
        notes: checkOutReason || 'End of work day'
      };

      const result = await attendanceService.clockOut(user.uid, clockOutData);
      console.log('Check-out recorded via service:', result);

      const checkOutTime = format(new Date(), 'HH:mm');
      setSuccess(`Successfully checked out at ${checkOutTime}!`);
      setCheckOutReason('');

      // Show browser notification
      const notificationPrefs = localStorage.getItem('notificationPreferences');
      if (notificationPrefs && pushNotificationService.checkPermission() === 'granted') {
        await pushNotificationService.showNotification('👋 Checked Out Successfully', {
          body: `You checked out at ${checkOutTime}. See you tomorrow!`,
          tag: 'check-out-success',
          icon: '/logo192.png'
        });
      }

      // Reload attendance data immediately
      await loadTodayAttendance();
      await loadRecentAttendance();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Check-out error:', error);
      setError('Failed to record check-out: ' + error.message);
    }
    
    setLoading(false);
  };

  const calculateWorkingHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '0h 0m';
    
    const totalMinutes = differenceInMinutes(checkOut, checkIn);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  const getAttendanceStatus = () => {
    console.log('📊 Getting attendance status...');
    console.log('📊 Company settings:', companySettings);
    console.log('📊 Today attendance:', todayAttendance);
    
    if (!companySettings || !todayAttendance) return 'Not Checked In';
    
    const now = new Date();
    const currentTimeString = format(now, 'HH:mm');
    
    // Parse company work times
    const workStart = companySettings.workStartTime;
    const workEnd = companySettings.workEndTime;
    const flexWindow = companySettings.allowFlexibleHours ? companySettings.flexibleHoursWindow : 0;
    
    console.log('🏢 Company work times:', { workStart, workEnd, flexWindow });
    
    const clockIn = getRawCheckIn(todayAttendance);
    const clockOut = getRawCheckOut(todayAttendance);
    
    if (clockIn && !clockOut) {
      // User is checked in
      const checkInTime = clockIn?.toDate ? 
        clockIn.toDate() : 
        new Date(clockIn);
      const checkInTimeString = format(checkInTime, 'HH:mm');
      
      console.log('🔍 Status calculation:', {
        checkInTimeString,
        workStart,
        flexWindow,
        company: user.company || user.originalCompanyName,
        comparison: {
          'checkIn < workStart': checkInTimeString < workStart,
          'checkIn > workStart': checkInTimeString > workStart
        }
      });
      
      // Check if late (with flexible hours consideration)
      const lateThreshold = addMinutesToTime(workStart, flexWindow);
      console.log('⏳ Late threshold:', lateThreshold);
      
      if (checkInTimeString > lateThreshold) {
        console.log('🔴 Result: Late Check-In');
        return 'Late Check-In';
      } else if (checkInTimeString < workStart) {
        console.log('🔵 Result: Early Check-In');
        return 'Early Check-In';
      } else {
        console.log('🟢 Result: On Time');
        return 'On Time';
      }
    } else if (clockOut) {
      // User has checked out
      const checkOutTime = clockOut?.toDate ? 
        clockOut.toDate() : 
        new Date(clockOut);
      const checkOutTimeString = format(checkOutTime, 'HH:mm');
      
      if (checkOutTimeString < workEnd) {
        return 'Early Check-Out';
      } else {
        return 'Completed';
      }
    }
    
    // Not checked in yet
    const lateThreshold = addMinutesToTime(workStart, flexWindow);
    if (currentTimeString > lateThreshold) {
      return 'Late';
    } else {
      return 'Not Checked In';
    }
  };

  const addMinutesToTime = (timeString, minutes) => {
    const [hours, mins] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, mins + minutes, 0, 0);
    return format(date, 'HH:mm');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'On Time':
      case 'Completed':
        return 'success';
      case 'Early Check-In':
      case 'Early Check-Out':
        return 'info';
      case 'Late Check-In':
      case 'Late':
        return 'error';
      default:
        return 'default';
    }
  };

  const isRecordCorrupted = (record) => checkRecordCorrupted(record);

  const isCheckedIn = isCurrentlyCheckedIn(todayAttendance);
  const workingHours = (() => {
    try {
      const checkIn = getCheckInTime(todayAttendance);
      const checkOut = getCheckOutTime(todayAttendance);

      if (checkIn && checkOut) {
        return calculateWorkingHours(checkIn, checkOut);
      } else if (checkIn) {
        const checkInDate = format(checkIn, 'yyyy-MM-dd');
        const todayDate = format(currentTime, 'yyyy-MM-dd');

        if (checkInDate !== todayDate) return 'Not today';

        const hoursDiff = differenceInHours(currentTime, checkIn);
        if (hoursDiff > 24) return 'Invalid duration';

        return calculateWorkingHours(checkIn, currentTime);
      }
      return '0h 0m';
    } catch {
      return '0h 0m';
    }
  })();

  const getTimeOfDayGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { greeting: 'Good morning', icon: <WbSunny /> };
    if (hour < 18) return { greeting: 'Good afternoon', icon: <Business /> };
    return { greeting: 'Good evening', icon: <WbSunny /> };
  };

  const { greeting, icon } = getTimeOfDayGreeting();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main', 
              width: { xs: 48, sm: 56 }, 
              height: { xs: 48, sm: 56 },
              mr: 2,
              boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
            }}
          >
            <AccessTime sx={{ fontSize: { xs: 24, sm: 28 } }} />
          </Avatar>
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '1.75rem', sm: '2.5rem' },
                fontWeight: 700,
                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Attendance Recording
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  ml: 1,
                  fontWeight: 500
                }}
              >
                {format(currentTime, 'EEEE, dd MMMM yyyy')}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'primary.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>
      
      {/* Enhanced Alert Messages */}
      {error && (
        <Paper 
          sx={{ 
            p: 2, 
            mb: 3,
            bgcolor: 'error.50',
            border: '1px solid',
            borderColor: 'error.light',
            borderRadius: 2
          }}
        >
          <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
            {error}
          </Typography>
        </Paper>
      )}
      {success && (
        <Paper 
          sx={{ 
            p: 2, 
            mb: 3,
            bgcolor: 'success.50',
            border: '1px solid',
            borderColor: 'success.light',
            borderRadius: 2
          }}
        >
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
            {success}
          </Typography>
        </Paper>
      )}
      

      <Grid container spacing={3}>
        {/* Enhanced Current Status Card */}
        <Grid item xs={12} lg={8}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d0d1f 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)'
              }
            }}
          >
            <CardContent sx={{ p: 4 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: isCheckedIn ? 'success.main' : 'primary.main',
                    width: 56, 
                    height: 56,
                    mr: 2,
                    boxShadow: isCheckedIn ? 
                      '0 4px 20px rgba(76, 175, 80, 0.4)' : 
                      '0 4px 20px rgba(25, 118, 210, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isCheckedIn ? 
                    <CheckCircle sx={{ fontSize: 28 }} /> : 
                    <Schedule sx={{ fontSize: 28 }} />
                  }
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 600,
                      fontSize: '1.5rem',
                      mb: 0.5,
                      color: 'text.primary'
                    }}
                  >
                    Current Status
                  </Typography>
                  <Box
                    sx={{
                      width: 40,
                      height: 3,
                      bgcolor: isCheckedIn ? 'success.main' : 'primary.main',
                      borderRadius: 1.5,
                      opacity: 0.8
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ textAlign: 'center', py: 3 }}>
                {/* Digital Clock Display */}
                <Paper 
                  sx={{ 
                    p: 3, 
                    mb: 3,
                    bgcolor: 'primary.50',
                    border: '2px solid',
                    borderColor: 'primary.100',
                    borderRadius: 3,
                    boxShadow: 'inset 0 2px 8px rgba(25, 118, 210, 0.1)'
                  }}
                >
                  <Typography
                    variant="h2"
                    sx={{
                      fontSize: { xs: '2.5rem', sm: '3.5rem' },
                      fontWeight: 700,
                      color: 'primary.main',
                      fontFamily: 'monospace',
                      letterSpacing: 2,
                      textShadow: '0 2px 4px rgba(25, 118, 210, 0.2)'
                    }}
                  >
                    {format(currentTime, 'HH:mm:ss')}
                  </Typography>
                </Paper>

                <Chip 
                  label={getAttendanceStatus()}
                  color={getStatusColor(getAttendanceStatus())}
                  sx={{ 
                    mb: 3,
                    px: 2,
                    py: 1,
                    fontSize: '1rem',
                    fontWeight: 600,
                    height: 40,
                    borderRadius: 20
                  }}
                  icon={isCheckedIn ? <CheckCircle /> : <Schedule />}
                />
                
                {/* Info Section */}
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 500 }}>
                    Working Hours: {companySettings ? `${companySettings.workStartTime} - ${companySettings.workEndTime}` : '09:00 - 18:00'}
                  </Typography>
                  {getRawCheckIn(todayAttendance) && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Checked in at: {formatTimeHHMM(getRawCheckIn(todayAttendance))}
                    </Typography>
                  )}
                  {workingHours !== '0h 0m' && (
                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600, mb: 1 }}>
                      Working time: {workingHours}
                    </Typography>
                  )}
                  {location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LocationOn sx={{ fontSize: 16, mr: 0.5, color: 'success.main' }} />
                      <Typography variant="caption" color="success.main" sx={{ fontWeight: 500 }}>
                        Location verified
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Enhanced Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Login />}
                    onClick={handleCheckIn}
                    disabled={loading || isCheckedIn || todayAttendanceLoading || !!todayAttendance}
                    sx={{ 
                      minWidth: 140,
                      py: 1.5,
                      borderRadius: 3,
                      fontWeight: 600,
                      textTransform: 'none',
                      boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    {loading ? 'Processing...' : todayAttendanceLoading ? 'Loading...' : 'Check In'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<ExitToApp />}
                    onClick={handleCheckOut}
                    disabled={loading || !isCheckedIn}
                    sx={{ 
                      minWidth: 140,
                      py: 1.5,
                      borderRadius: 3,
                      fontWeight: 600,
                      textTransform: 'none',
                      borderWidth: 2,
                      '&:hover': {
                        borderWidth: 2,
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    Check Out
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Enhanced Location & Info Card */}
        <Grid item xs={12} lg={4}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2b200d 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #fff8f0 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)'
              }
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: location ? 'success.main' : 'warning.main',
                    width: 56, 
                    height: 56,
                    mr: 2,
                    boxShadow: location ? 
                      '0 4px 20px rgba(76, 175, 80, 0.4)' : 
                      '0 4px 20px rgba(255, 152, 0, 0.4)'
                  }}
                >
                  <MyLocation sx={{ fontSize: 28 }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      fontWeight: 600,
                      fontSize: '1.25rem',
                      mb: 0.5
                    }}
                  >
                    Location & Info
                  </Typography>
                  <Box
                    sx={{
                      width: 40,
                      height: 3,
                      bgcolor: location ? 'success.main' : 'warning.main',
                      borderRadius: 1.5,
                      opacity: 0.8
                    }}
                  />
                </Box>
              </Box>
              
              {/* Location Information */}
              {locationLoading ? (
                <Paper sx={{ 
                  p: 2, 
                  mb: 3,
                  bgcolor: 'info.50', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'info.light'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CircularProgress size={16} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="info.main" sx={{ fontWeight: 600 }}>
                      Getting location...
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    Acquiring high-accuracy GPS position for check-in
                  </Typography>
                </Paper>
              ) : getRawCheckIn(todayAttendance) ? (
                <Paper sx={{ 
                  p: 2, 
                  mb: 3,
                  bgcolor: 'success.50', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'success.light'
                }}>
                  <Typography variant="body2" color="success.main" sx={{ fontWeight: 600, mb: 1 }}>
                    ✓ Location Captured at Check-in
                  </Typography>
                  {(() => {
                    // Get location from today's attendance record
                    const attendanceLocation = todayAttendance?.location;
                    const storedDistance = todayAttendance?.distanceFromOffice;
                    
                    if (attendanceLocation) {
                      const quality = getLocationQuality(attendanceLocation.accuracy);
                      const reliable = isLocationReliable(attendanceLocation.accuracy);
                      
                      return (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                            Your Location: {attendanceLocation.latitude.toFixed(6)}, {attendanceLocation.longitude.toFixed(6)}
                          </Typography>
                          {companyLocation && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                              Office Location: {companyLocation.latitude.toFixed(6)}, {companyLocation.longitude.toFixed(6)}
                            </Typography>
                          )}
                          
                          {/* Location Quality Indicator */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mr: 1 }}>
                              Location Quality:
                            </Typography>
                            <Chip 
                              label={quality.label} 
                              color={quality.color}
                              size="small"
                              sx={{ fontSize: '0.75rem', height: 20 }}
                            />
                          </Box>
                          
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                            Accuracy: ±{attendanceLocation.accuracy.toFixed(0)}m
                            {attendanceLocation.method && ` (${attendanceLocation.method})`}
                          </Typography>
                          
                          {/* Distance - only show if reliable */}
                          {storedDistance && reliable ? (
                            <Typography variant="body2" color="primary.main" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              Distance from office: {storedDistance >= 1000 ? `${(storedDistance / 1000).toFixed(2)} km` : `${Math.round(storedDistance)} m`}
                            </Typography>
                          ) : storedDistance && !reliable ? (
                            <Typography variant="body2" color="warning.main" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              Distance: ~{storedDistance >= 1000 ? `${(storedDistance / 1000).toFixed(2)} km` : `${Math.round(storedDistance)} m`} (approximate due to poor GPS)
                            </Typography>
                          ) : null}
                        </>
                      );
                    } else {
                      return (
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                          Location data available after check-in
                        </Typography>
                      );
                    }
                  })()}
                </Paper>
              ) : (
                <Paper sx={{ 
                  p: 2, 
                  mb: 3,
                  bgcolor: 'grey.50', 
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200'
                }}>
                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, mb: 1 }}>
                    📍 Location Status
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                    Location will be captured when you check in
                  </Typography>
                  {companyLocation && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', mt: 1 }}>
                      Office Location: {companyLocation.latitude.toFixed(6)}, {companyLocation.longitude.toFixed(6)}
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Compact Location Map - Always show if Maps loaded */}
              {isMapsLoaded ? (
                (() => {
                  // Fallback priority: 1) Company DB location, 2) Attendance company location, 3) User location, 4) Default KL location
                  const mapLocation = companyLocation || todayAttendance?.companyLocation || todayAttendance?.location || { latitude: 3.139, longitude: 101.6869 };
                  const userLoc = todayAttendance?.location;

                  console.log('🗺️ Map render check:', {
                    companyLocation: !!companyLocation,
                    attendanceCompanyLocation: !!todayAttendance?.companyLocation,
                    userLocation: !!userLoc,
                    isMapsLoaded,
                    finalMapLocation: mapLocation,
                    mapLocationSource: companyLocation ? 'company DB' : todayAttendance?.companyLocation ? 'attendance record' : userLoc ? 'user location' : 'default KL'
                  });

                  return (
                <Paper
                  sx={{
                    mb: 3,
                    overflow: 'hidden',
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: 'primary.main'
                  }}
                >
                  <Box sx={{
                    p: 1.5,
                    bgcolor: 'primary.50',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      Office Location Map
                    </Typography>

                    {/* Map Type Selector */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Chip
                        icon={<MapIcon sx={{ fontSize: 14 }} />}
                        label="Road"
                        size="small"
                        onClick={() => setMapType('roadmap')}
                        color={mapType === 'roadmap' ? 'primary' : 'default'}
                        sx={{
                          height: 24,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          '& .MuiChip-icon': { ml: 0.5 }
                        }}
                      />
                      <Chip
                        icon={<Satellite sx={{ fontSize: 14 }} />}
                        label="Satellite"
                        size="small"
                        onClick={() => setMapType('satellite')}
                        color={mapType === 'satellite' ? 'primary' : 'default'}
                        sx={{
                          height: 24,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          '& .MuiChip-icon': { ml: 0.5 }
                        }}
                      />
                      <Chip
                        icon={<Terrain sx={{ fontSize: 14 }} />}
                        label="Hybrid"
                        size="small"
                        onClick={() => setMapType('hybrid')}
                        color={mapType === 'hybrid' ? 'primary' : 'default'}
                        sx={{
                          height: 24,
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          '& .MuiChip-icon': { ml: 0.5 }
                        }}
                      />
                    </Box>
                  </Box>
                  <GoogleMap
                    mapContainerStyle={{
                      width: '100%',
                      height: '300px',
                      borderRadius: '12px'
                    }}
                    center={{
                      lat: mapLocation.latitude,
                      lng: mapLocation.longitude
                    }}
                    zoom={18}
                    mapTypeId={mapType}
                    options={{
                      disableDefaultUI: true,
                      zoomControl: true,
                      mapTypeControl: false,
                      scaleControl: false,
                      streetViewControl: false,
                      rotateControl: false,
                      fullscreenControl: true,
                      tilt: 0,
                      styles: [
                        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
                        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
                      ]
                    }}
                  >
                    {/* Radius Circle - Allowed check-in area */}
                    {companyLocation && (
                      <Circle
                        center={{
                          lat: companyLocation.latitude,
                          lng: companyLocation.longitude
                        }}
                        radius={user.geofenceRadius || companySettings?.branchGeofenceRadius || companySettings?.geofenceRadius || 200}
                        options={{
                          fillColor: '#4285F4',
                          fillOpacity: 0.2,
                          strokeColor: '#1a73e8',
                          strokeOpacity: 0.8,
                          strokeWeight: 2
                        }}
                      />
                    )}

                    {/* Office Location Marker (Blue pin) */}
                    <Marker
                      position={{
                        lat: mapLocation.latitude,
                        lng: mapLocation.longitude
                      }}
                      icon={{
                        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2,
                        scale: 1.8,
                        anchor: new window.google.maps.Point(12, 22)
                      }}
                      title="Office Location"
                    />

                    {/* User Location Marker (Red pin) - Show if checked in */}
                    {userLoc && (
                      <Marker
                        position={{
                          lat: userLoc.latitude,
                          lng: userLoc.longitude
                        }}
                        icon={{
                          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                          fillColor: '#EA4335',
                          fillOpacity: 1,
                          strokeColor: '#FFFFFF',
                          strokeWeight: 2,
                          scale: 1.8,
                          anchor: new window.google.maps.Point(12, 22)
                        }}
                        title="Your Check-in Location"
                      />
                    )}
                  </GoogleMap>

                  {/* Map Legend */}
                  <Box sx={{ p: 1.5, bgcolor: 'grey.50', display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center', borderRadius: '0 0 12px 12px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: '#4285F4', borderRadius: '50%', mr: 0.5, border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.3)' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Office
                      </Typography>
                    </Box>
                    {userLoc && (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{ width: 12, height: 12, bgcolor: '#EA4335', borderRadius: '50%', mr: 0.5, border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.3)' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          You
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: 12, height: 12, bgcolor: 'rgba(66,133,244,0.15)', borderRadius: '50%', mr: 0.5, border: '2px solid rgba(66,133,244,0.6)' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Radius ({user.geofenceRadius || companySettings?.branchGeofenceRadius || companySettings?.geofenceRadius || 200}m)
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
                  );
                })()
              ) : (
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="caption">⏳ Loading map...</Typography>
                </Alert>
              )}

              {/* Company Information */}
              <Box>
                {companySettings ? (
                  <Paper sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: 'text.primary' }}>
                      Work Schedule
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Hours: {companySettings.workStartTime} - {companySettings.workEndTime}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Lunch: {companySettings.lunchStartTime} - {companySettings.lunchEndTime}
                    </Typography>
                    {companySettings.allowFlexibleHours && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Flexible: ±{companySettings.flexibleHoursWindow} min
                      </Typography>
                    )}
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Company: {user.company || user.originalCompanyName || ''}
                    </Typography>
                    {companyLocation && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Office Address: {companyLocation.address?.line1 || 'Not specified'}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Today: {format(currentTime, 'EEEE, MMMM do')}
                    </Typography>
                  </Paper>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading settings...
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>


        {/* Enhanced Recent Attendance History */}
        <Grid item xs={12}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: 'info.main',
                    width: 56, 
                    height: 56,
                    mr: 2,
                    boxShadow: '0 4px 20px rgba(33, 150, 243, 0.4)'
                  }}
                >
                  <History sx={{ fontSize: 28 }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 600,
                      fontSize: '1.5rem',
                      mb: 0.5,
                      color: 'text.primary'
                    }}
                  >
                    Recent Attendance History
                  </Typography>
                  <Box
                    sx={{
                      width: 40,
                      height: 3,
                      bgcolor: 'info.main',
                      borderRadius: 1.5,
                      opacity: 0.8
                    }}
                  />
                </Box>
              </Box>

              {recentAttendanceLoading ? (
                // Skeleton loading for recent attendance
                <List sx={{ p: 0 }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                    <React.Fragment key={item}>
                      <ListItem
                        sx={{
                          px: 0,
                          py: 2
                        }}
                      >
                        <ListItemIcon>
                          <Skeleton variant="circular" width={40} height={40} />
                        </ListItemIcon>
                        <ListItemText
                          primary={<Skeleton variant="text" width="30%" height={24} sx={{ mb: 0.5 }} />}
                          secondary={
                            <Box>
                              <Skeleton variant="text" width="60%" height={20} sx={{ mb: 0.5 }} />
                              <Skeleton variant="text" width="50%" height={20} />
                            </Box>
                          }
                        />
                        <Skeleton variant="rectangular" width={100} height={32} sx={{ borderRadius: 2 }} />
                      </ListItem>
                      {item < 7 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : recentAttendance.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {recentAttendance.map((record, index) => (
                    <React.Fragment key={record.id}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          py: 2,
                          borderRadius: 2,
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'grey.50'
                          }
                        }}
                      >
                        <ListItemIcon>
                          <Avatar
                            sx={{
                              bgcolor: record.status === 'checked-out' ? 'success.main' : 'primary.main',
                              width: 40,
                              height: 40
                            }}
                          >
                            <AccessTime sx={{ fontSize: 20 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {(() => {
                                try {
                                  // Handle both date and dateString fields like other components
                                  let date;
                                  if (record.dateString) {
                                    date = new Date(record.dateString);
                                  } else if (record.date?.toDate) {
                                    date = record.date.toDate();
                                  } else if (record.date instanceof Date) {
                                    date = record.date;
                                  } else if (typeof record.date === 'string') {
                                    date = new Date(record.date);
                                  } else {
                                    return 'Invalid date';
                                  }
                                  
                                  if (isNaN(date.getTime())) {
                                    return 'Invalid date';
                                  }
                                  
                                  return format(date, 'dd/MM/yyyy');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              })()}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                Check in: {formatTimeHHMM(getRawCheckIn(record))}
                                {getRawCheckOut(record) ? ` • Check out: ${formatTimeHHMM(getRawCheckOut(record))}` : ''}
                              </Typography>
                              {getCheckInTime(record) && getCheckOutTime(record) && (
                                <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                                  Working time: {(() => {
                                    const checkIn = getCheckInTime(record);
                                    const checkOut = getCheckOutTime(record);
                                    if (checkOut < checkIn) return 'Invalid time';
                                    return calculateWorkingHours(checkIn, checkOut);
                                  })()}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Chip 
                          label={isRecordCorrupted(record) ? 'Corrupted Data' : (record.status === 'checked-out' ? 'Completed' : 'In Progress')} 
                          color={isRecordCorrupted(record) ? 'error' : (record.status === 'checked-out' ? 'success' : 'primary')}
                          sx={{
                            fontWeight: 600,
                            borderRadius: 2
                          }}
                        />
                      </ListItem>
                      {index < recentAttendance.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <AccessTime sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No attendance records found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your attendance history will appear here once you start checking in
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Check Out Dialog */}
      <Dialog 
        open={checkOutDialog} 
        onClose={() => setCheckOutDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 16px 48px rgba(0,0,0,0.2)'
          }
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main',
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2,
              boxShadow: '0 8px 32px rgba(25, 118, 210, 0.4)'
            }}
          >
            <ExitToApp sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Check Out
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You're about to check out for the day
          </Typography>
        </Box>
        
        <Box sx={{ px: 3, pb: 3 }}>
          <TextField
            label="Check-out reason (optional)"
            multiline
            rows={3}
            fullWidth
            value={checkOutReason}
            onChange={(e) => setCheckOutReason(e.target.value)}
            placeholder="e.g., End of work day, Meeting ended, etc."
            sx={{ mb: 3 }}
          />
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button 
              onClick={() => setCheckOutDialog(false)}
              variant="outlined"
              sx={{ px: 4 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmCheckOut}
              variant="contained"
              disabled={loading}
              sx={{ px: 4 }}
            >
              {loading ? 'Checking Out...' : 'Check Out'}
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Container>
  );
}

export default Attendance;