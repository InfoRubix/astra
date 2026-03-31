import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  LinearProgress,
  CircularProgress,
  useTheme,
  TextField,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  AccessTime,
  EventAvailable,
  Receipt,
  AccountBalance,
  TrendingUp,
  Notifications,
  CheckCircle,
  Schedule,
  Warning,
  Login,
  ExitToApp,
  LocationOn,
  Dashboard as DashboardIcon,
  WbSunny,
  Business,
  Feedback as FeedbackIcon,
  Send
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { collection, getDocs, query, where, orderBy, limit, doc, setDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { attendanceService } from '../../services/attendanceService';
import { getRawCheckIn, getRawCheckOut, getCheckInTime, getCheckOutTime, isCurrentlyCheckedIn } from '../../utils/attendanceHelpers';

function UserDashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [todayAttendanceData, setTodayAttendanceData] = useState(null);
  const [location, setLocation] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceSuccess, setAttendanceSuccess] = useState('');
  const [leaveBalance, setLeaveBalance] = useState({
    annual: { used: 0, total: 12 },
    sick: { used: 0, total: 14 },
    emergency: { used: 0, total: 3 }
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState(null);
  const [checkOutDialog, setCheckOutDialog] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });
  
  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Get user location using GPS
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'gps'
          });
        },
        (error) => {
          console.error('Error getting GPS location:', error);
        },
        {
          enableHighAccuracy: true, // Use GPS satellites
          timeout: 15000,
          maximumAge: 0 // Fresh GPS reading
        }
      );
    }
  }, []);

  // Load dashboard data
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadTodayAttendance(),
        loadLeaveBalance(),
        loadRecentActivity(),
        loadNotifications(),
        loadCompanySettings()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  };

  const loadTodayAttendance = async () => {
    try {
      console.log('🔄 Loading today\'s attendance for user:', user.uid);
      // Use the same attendance service as the attendance page for consistency
      const attendanceData = await attendanceService.getTodayAttendance(user.uid);
      
      if (attendanceData) {
        console.log('✅ Found today\'s attendance:', attendanceData);
        setTodayAttendanceData(attendanceData);
        
        if (attendanceData.checkInTime) {
          const checkInTime = attendanceData.checkInTime?.toDate ? attendanceData.checkInTime.toDate() : new Date(attendanceData.checkInTime);
          setTodayAttendance(format(checkInTime, 'HH:mm'));
        }
      } else {
        setTodayAttendanceData(null);
        setTodayAttendance(null);
        console.log('❌ No attendance record found for today');
      }
    } catch (error) {
      console.error('❌ Error loading today\'s attendance:', error);
      setTodayAttendanceData(null);
      setTodayAttendance(null);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      // Load user's approved leaves for this year
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);

      const q = query(
        collection(db, 'leaves'),
        where('userId', '==', user.uid),
        where('status', '==', 'approved')
      );
      
      const querySnapshot = await getDocs(q);
      const usedLeaves = { annual: 0, sick: 0, emergency: 0, maternity: 0 };
      
      querySnapshot.docs.forEach(doc => {
        const leave = doc.data();
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        
        // Count only this year's leaves
        if (startDate >= yearStart && startDate < yearEnd) {
          const leaveType = leave.leaveType;
          if (usedLeaves[leaveType] !== undefined) {
            usedLeaves[leaveType] += leave.totalDays || 0;
          }
        }
      });

      setLeaveBalance({
        annual: { used: usedLeaves.annual, total: 12 },
        sick: { used: usedLeaves.sick, total: 14 },
        emergency: { used: usedLeaves.emergency, total: 3 }
      });
    } catch (error) {
      console.error('Error loading leave balance:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activities = [];

      // Load recent attendance - no orderBy to avoid index requirements
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid),
        limit(10)
      );
      
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceActivities = [];
      
      attendanceSnapshot.docs.forEach(doc => {
        const attendance = doc.data();
        
        if (attendance.checkInTime) {
          const checkInTime = attendance.checkInTime?.toDate ? attendance.checkInTime.toDate() : new Date(attendance.checkInTime);
          const recordDate = attendance.date?.toDate ? attendance.date.toDate() : new Date(attendance.dateString);
          
          attendanceActivities.push({
            type: 'attendance',
            action: 'Checked In',
            time: format(checkInTime, 'HH:mm'),
            date: format(recordDate, 'dd/MM'),
            status: 'success',
            sortDate: checkInTime
          });
          
          // Also add check-out if exists
          if (attendance.checkOutTime) {
            const checkOutTime = attendance.checkOutTime?.toDate ? attendance.checkOutTime.toDate() : new Date(attendance.checkOutTime);
            
            attendanceActivities.push({
              type: 'attendance',
              action: 'Checked Out',
              time: format(checkOutTime, 'HH:mm'),
              date: format(recordDate, 'dd/MM'),
              status: 'success',
              sortDate: checkOutTime
            });
          }
        }
      });
      
      // Sort and take most recent 3
      attendanceActivities.sort((a, b) => b.sortDate - a.sortDate);
      activities.push(...attendanceActivities.slice(0, 3));

      // Load recent leaves
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('userId', '==', user.uid),
        orderBy('appliedDate', 'desc'),
        limit(3)
      );
      
      const leavesSnapshot = await getDocs(leavesQuery);
      leavesSnapshot.docs.forEach(doc => {
        const leave = doc.data();
        const appliedDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
        
        activities.push({
          type: 'leave',
          action: `Leave ${leave.status === 'approved' ? 'Approved' : leave.status === 'rejected' ? 'Rejected' : 'Submitted'}`,
          time: format(appliedDate, 'HH:mm'),
          date: format(appliedDate, 'dd/MM'),
          status: leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'error' : 'pending',
          sortDate: appliedDate
        });
      });

      // Load recent claims
      const claimsQuery = query(
        collection(db, 'claims'),
        where('userId', '==', user.uid),
        orderBy('submittedDate', 'desc'),
        limit(3)
      );
      
      const claimsSnapshot = await getDocs(claimsQuery);
      claimsSnapshot.docs.forEach(doc => {
        const claim = doc.data();
        const submittedDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
        
        activities.push({
          type: 'claim',
          action: `Claim ${claim.status === 'approved' ? 'Approved' : claim.status === 'rejected' ? 'Rejected' : 'Submitted'}`,
          time: format(submittedDate, 'HH:mm'),
          date: format(submittedDate, 'dd/MM'),
          status: claim.status === 'approved' ? 'success' : claim.status === 'rejected' ? 'error' : 'pending',
          sortDate: submittedDate
        });
      });

      // Sort all activities by sortDate (most recent first)
      activities.sort((a, b) => {
        if (a.sortDate && b.sortDate) {
          return b.sortDate - a.sortDate;
        }
        // Fallback to date/time string comparison
        return new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`);
      });
      
      setRecentActivity(activities.slice(0, 5)); // Show top 5 activities
    } catch (error) {
      console.error('Error loading recent activity:', error);
      // Set fallback empty array
      setRecentActivity([]);
    }
  };

  const loadNotifications = async () => {
    try {
      // Load recent notifications for the user
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      
      const querySnapshot = await getDocs(q);
      const userNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setNotifications(userNotifications);
      console.log('Loaded notifications:', userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Set fallback notifications if Firebase fails
      setNotifications([
        {
          id: 'fallback1',
          title: 'Welcome to the System',
          message: 'Your dashboard is ready to use',
          priority: 'normal',
          createdAt: new Date()
        }
      ]);
    }
  };

  const handleCheckIn = async () => {
    // Block check-in while dashboard data is still loading (prevents duplicates after refresh)
    if (loading) {
      setAttendanceError('Please wait, loading attendance data...');
      return;
    }

    if (!location) {
      setAttendanceError('Please enable location access to check in');
      return;
    }

    if (isCheckedIn) {
      setAttendanceError('You are already checked in today');
      return;
    }

    // Block if any record already exists for today (even if checked out)
    if (todayAttendanceData) {
      setAttendanceError('Attendance record already exists for today');
      return;
    }

    setAttendanceLoading(true);
    setAttendanceError('');

    try {
      const attendanceData = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        company: user.originalCompanyName || user.company || 'RUBIX',
        department: user.department || 'General',
        location: location,
        notes: ''
      };

      await attendanceService.clockIn(attendanceData);

      setAttendanceSuccess(`Successfully checked in at ${format(new Date(), 'HH:mm')}!`);

      // Reload attendance data
      await loadTodayAttendance();
      await loadRecentActivity();
      await loadNotifications();

      setTimeout(() => setAttendanceSuccess(''), 3000);
    } catch (error) {
      console.error('Check-in error:', error);
      setAttendanceError('Failed to record check-in: ' + error.message);
    }

    setAttendanceLoading(false);
  };

  const handleCheckOut = () => {
    if (!isCheckedIn) {
      setAttendanceError('No active check-in found for today');
      return;
    }
    setCheckOutDialog(true);
  };

  const confirmCheckOut = async () => {
    setCheckOutDialog(false);
    setAttendanceLoading(true);
    setAttendanceError('');

    try {
      await attendanceService.clockOut(user.uid, {
        location: location,
        notes: ''
      });

      setAttendanceSuccess(`Successfully checked out at ${format(new Date(), 'HH:mm')}!`);

      // Reload attendance data
      await loadTodayAttendance();
      await loadRecentActivity();
      await loadNotifications();

      setTimeout(() => setAttendanceSuccess(''), 3000);
    } catch (error) {
      console.error('Check-out error:', error);
      setAttendanceError('Failed to record check-out: ' + error.message);
    }

    setAttendanceLoading(false);
  };

  const loadCompanySettings = async () => {
    try {
      const userCompany = user.company || user.originalCompanyName || 'RUBIX';
      console.log('🏢 Dashboard - Loading company settings for:', userCompany);
      console.log('🔍 Dashboard - User object:', { company: user.company, originalCompanyName: user.originalCompanyName });
      
      const q = query(
        collection(db, 'companySettings'),
        where('company', '==', userCompany),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      console.log('📋 Dashboard - Company settings query results:', querySnapshot.size, 'documents found');
      
      if (!querySnapshot.empty) {
        const settingsDoc = querySnapshot.docs[0];
        const settings = { id: settingsDoc.id, ...settingsDoc.data() };
        setCompanySettings(settings);
        console.log('✅ Dashboard - Company settings loaded:', settings);
        console.log('🕘 Dashboard - Work start time from DB:', settings.workStartTime);
      } else {
        console.warn('⚠️ Dashboard - No company settings found for:', userCompany);
        // Set default settings if none found
        setCompanySettings({
          workStartTime: '09:00',
          workEndTime: '18:00',
          lunchStartTime: '12:00',
          lunchEndTime: '13:00',
          allowFlexibleHours: false,
          flexibleHoursWindow: 0,
          workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        });
        console.log('📝 Dashboard - Using default settings with 09:00 start time');
      }
    } catch (error) {
      console.error('❌ Dashboard - Error loading company settings:', error);
      // Use default settings on error
      setCompanySettings({
        workStartTime: '09:00',
        workEndTime: '18:00',
        lunchStartTime: '12:00',
        lunchEndTime: '13:00',
        allowFlexibleHours: false,
        flexibleHoursWindow: 0,
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      });
    }
  };

  const calculateWorkingHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '0h 0m';
    
    const totalMinutes = differenceInMinutes(checkOut, checkIn);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
  };

  const getAttendanceStatus = () => {
    console.log('📊 Dashboard - Getting attendance status...');
    console.log('📊 Dashboard - Company settings:', companySettings);
    console.log('📊 Dashboard - Today attendance data:', todayAttendanceData);
    
    if (!companySettings || !todayAttendanceData) return 'Not Checked In';
    
    const now = new Date();
    const currentTimeString = format(now, 'HH:mm');
    
    // Parse company work times
    const workStart = companySettings.workStartTime;
    const workEnd = companySettings.workEndTime;
    const flexWindow = companySettings.allowFlexibleHours ? companySettings.flexibleHoursWindow : 0;
    
    console.log('🏢 Dashboard - Company work times:', { workStart, workEnd, flexWindow });
    
    // Check for both clockInTime and checkInTime field names (same as attendance page)
    const clockIn = getRawCheckIn(todayAttendanceData);
    const clockOut = getRawCheckOut(todayAttendanceData);
    
    console.log('⏰ Dashboard - Clock times found:', { 
      clockIn: !!clockIn, 
      clockOut: !!clockOut,
      clockInType: typeof clockIn,
      hasToDate: !!clockIn?.toDate
    });
    
    if (clockIn && !clockOut) {
      // User is checked in
      const checkInTime = clockIn?.toDate ? 
        clockIn.toDate() : 
        new Date(clockIn);
      const checkInTimeString = format(checkInTime, 'HH:mm');
      
      console.log('🔍 Dashboard - Status calculation:', {
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
      console.log('⏳ Dashboard - Late threshold:', lateThreshold);
      
      if (checkInTimeString > lateThreshold) {
        console.log('🔴 Dashboard - Result: Late Check-In');
        return 'Late Check-In';
      } else if (checkInTimeString < workStart) {
        console.log('🔵 Dashboard - Result: Early Check-In');
        return 'Early Check-In';
      } else {
        console.log('🟢 Dashboard - Result: On Time');
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

  const getAttendanceStatusColor = (status) => {
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

  const isCheckedIn = isCurrentlyCheckedIn(todayAttendanceData);
  const workingHours = (() => {
    try {
      // Handle both clockInTime and checkInTime field names like attendance page
      const clockIn = getRawCheckIn(todayAttendanceData);
      const clockOut = getRawCheckOut(todayAttendanceData);
      
      if (clockIn && clockOut) {
        let checkInTime, checkOutTime;
        
        if (clockIn?.toDate) {
          checkInTime = clockIn.toDate();
        } else if (clockIn instanceof Date) {
          checkInTime = clockIn;
        } else {
          checkInTime = new Date(clockIn);
        }
        
        if (clockOut?.toDate) {
          checkOutTime = clockOut.toDate();
        } else if (clockOut instanceof Date) {
          checkOutTime = clockOut;
        } else {
          checkOutTime = new Date(clockOut);
        }
        
        return calculateWorkingHours(checkInTime, checkOutTime);
      } else if (clockIn) {
        let checkInTime;
        
        if (clockIn?.toDate) {
          checkInTime = clockIn.toDate();
        } else if (clockIn instanceof Date) {
          checkInTime = clockIn;
        } else {
          checkInTime = new Date(clockIn);
        }
        
        return calculateWorkingHours(checkInTime, currentTime);
      }
      return '0h 0m';
    } catch (error) {
      return '0h 0m';
    }
  })();

  const quickActions = [
    { 
      title: 'Submit Claim', 
      description: 'Upload expense claim', 
      icon: <Receipt />, 
      color: 'success',
      route: '/user/claims'
    },
    { 
      title: 'View Payslips', 
      description: 'Download salary statements', 
      icon: <AccountBalance />, 
      color: 'info',
      route: '/user/payslips'
    }
  ];

  const getStatusColor = (status) => {
    switch(status) {
      case 'success': return 'success';
      case 'pending': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'success': return <CheckCircle />;
      case 'pending': return <Schedule />;
      case 'error': return <Warning />;
      default: return <CheckCircle />;
    }
  };

  const getTimeOfDayGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { greeting: 'Good morning', icon: <WbSunny /> };
    if (hour < 18) return { greeting: 'Good afternoon', icon: <Business /> };
    return { greeting: 'Good evening', icon: <WbSunny /> };
  };

  const { greeting, icon } = getTimeOfDayGreeting();

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Please enter your feedback' });
      return;
    }

    setSubmittingFeedback(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        feedback: feedbackText,
        submittedBy: `${user.firstName} ${user.lastName}`,
        userId: user.uid,
        userEmail: user.email,
        role: user.role,
        company: user.originalCompanyName || user.company || 'RUBIX',
        timestamp: serverTimestamp(),
        status: 'new'
      });

      setFeedbackMessage({ type: 'success', text: 'Thank you! Your feedback has been submitted.' });
      setFeedbackText('');

      // Auto-clear message after 3 seconds
      setTimeout(() => {
        setFeedbackMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setFeedbackMessage({ type: 'error', text: 'Failed to submit feedback. Please try again.' });
    }
    setSubmittingFeedback(false);
  };

  return (
    <>
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
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
            <DashboardIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />
          </Avatar>
          <Box>
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '1.75rem', sm: '2.5rem' },
                fontWeight: 700,
                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              {greeting}, {user?.firstName}!
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
                {format(currentTime, 'EEEE, dd MMMM yyyy • HH:mm:ss')}
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

      <Grid container spacing={3}>
        {/* Enhanced Attendance Status Widget */}
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
              {/* Header with Enhanced Icon */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: 'primary.main',
                    width: 56, 
                    height: 56,
                    mr: 2,
                    boxShadow: '0 4px 20px rgba(25, 118, 210, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <AccessTime sx={{ fontSize: 28 }} />
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
                    Today's Attendance
                  </Typography>
                  <Box
                    sx={{
                      width: 40,
                      height: 3,
                      bgcolor: 'primary.main',
                      borderRadius: 1.5,
                      opacity: 0.8
                    }}
                  />
                </Box>
              </Box>
              
              {/* Error and Success Messages */}
              {attendanceError && (
                <Box sx={{ mb: 3 }}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'error.50',
                      border: '1px solid',
                      borderColor: 'error.light',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                      {attendanceError}
                    </Typography>
                  </Paper>
                </Box>
              )}
              {attendanceSuccess && (
                <Box sx={{ mb: 3 }}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      bgcolor: 'success.50',
                      border: '1px solid',
                      borderColor: 'success.light',
                      borderRadius: 2
                    }}
                  >
                    <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                      {attendanceSuccess}
                    </Typography>
                  </Paper>
                </Box>
              )}
              
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
                  label={loading ? "Loading..." : getAttendanceStatus()} 
                  color={loading ? "default" : getAttendanceStatusColor(getAttendanceStatus())}
                  sx={{ 
                    mb: 3,
                    px: 2,
                    py: 1,
                    fontSize: '1rem',
                    fontWeight: 600,
                    height: 40,
                    borderRadius: 20
                  }}
                  icon={loading ? <Schedule /> : getStatusIcon(getAttendanceStatus())}
                />
                
                {/* Enhanced Check In/Out Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={attendanceLoading ? <CircularProgress size={20} color="inherit" /> : <Login />}
                    onClick={handleCheckIn}
                    disabled={attendanceLoading || isCheckedIn || loading || !!todayAttendanceData}
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
                    {attendanceLoading ? 'Processing...' : loading ? 'Loading...' : 'Check In'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={attendanceLoading ? <CircularProgress size={20} color="inherit" /> : <ExitToApp />}
                    onClick={handleCheckOut}
                    disabled={attendanceLoading || !isCheckedIn}
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
                    {attendanceLoading ? 'Processing...' : 'Check Out'}
                  </Button>
                </Box>
                
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
                  {todayAttendance && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Checked in at: {todayAttendance}
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
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Enhanced Leave Balance Widget */}
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
              {/* Header with Enhanced Icon */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: 'secondary.main',
                    width: 56, 
                    height: 56,
                    mr: 2,
                    boxShadow: '0 4px 20px rgba(156, 39, 176, 0.4)'
                  }}
                >
                  <EventAvailable sx={{ fontSize: 28 }} />
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
                    Leave Balance
                  </Typography>
                  <Box
                    sx={{
                      width: 40,
                      height: 3,
                      bgcolor: 'secondary.main',
                      borderRadius: 1.5,
                      opacity: 0.8
                    }}
                  />
                </Box>
              </Box>

              {loading ? (
                <>
                  {/* Skeleton for leave balance items */}
                  {[1, 2, 3].map((item) => (
                    <Box key={item} sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Skeleton variant="text" width={100} height={24} />
                        <Skeleton variant="text" width={80} height={24} />
                      </Box>
                      <Skeleton
                        variant="rectangular"
                        width="100%"
                        height={10}
                        sx={{ borderRadius: 5 }}
                        animation="wave"
                      />
                    </Box>
                  ))}

                  {/* Skeleton for Apply Leave button */}
                  <Skeleton
                    variant="rectangular"
                    width="100%"
                    height={56}
                    sx={{ borderRadius: 3, mt: 2 }}
                    animation="wave"
                  />
                </>
              ) : (
                <>
                  {Object.entries(leaveBalance).map(([type, balance]) => (
                    <Box key={type} sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            textTransform: 'capitalize',
                            fontWeight: 600,
                            color: 'text.primary'
                          }}
                        >
                          {type} Leave
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600,
                            color: balance.total - balance.used > 2 ? 'success.main' : 'warning.main'
                          }}
                        >
                          {balance.total - balance.used} / {balance.total} days
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={(balance.used / balance.total) * 100}
                        sx={{ 
                          height: 10, 
                          borderRadius: 5,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            bgcolor: balance.total - balance.used > 2 ? 'success.main' : 'warning.main'
                          }
                        }}
                      />
                    </Box>
                  ))}
                  
                  <Button 
                    variant="contained"
                    color="secondary"
                    fullWidth
                    size="large"
                    startIcon={<EventAvailable />}
                    sx={{ 
                      mt: 2,
                      py: 1.5,
                      borderRadius: 3,
                      fontWeight: 600,
                      textTransform: 'none',
                      boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(156, 39, 176, 0.4)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                    onClick={() => window.location.href = '/user/leaves'}
                  >
                    Apply for Leave
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        {/* Quick Actions Section */}
        <Grid item xs={12}>
          <Box sx={{ mb: 3 }}>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 600,
                color: 'text.primary',
                mb: 1
              }}
            >
              Quick Actions
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              Access frequently used features with just one click
            </Typography>
          </Box>
          
          <Grid container spacing={2} justifyContent="center">
            {loading ? (
              // Skeleton loading for Quick Actions
              [1, 2].map((item) => (
                <Grid item xs={6} sm={4} md={3} key={item}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Skeleton
                        variant="circular"
                        width={56}
                        height={56}
                        sx={{ mx: 'auto', mb: 2 }}
                        animation="wave"
                      />
                      <Skeleton
                        variant="text"
                        width="80%"
                        height={28}
                        sx={{ mx: 'auto', mb: 1 }}
                      />
                      <Skeleton
                        variant="text"
                        width="90%"
                        height={20}
                        sx={{ mx: 'auto' }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
              quickActions.map((action, index) => (
                <Grid item xs={6} sm={4} md={3} key={index}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        borderColor: `${action.color}.light`
                      }
                    }}
                    onClick={() => window.location.href = action.route}
                  >
                    <CardContent sx={{ p: 3, textAlign: 'center' }}>
                      <Avatar
                        sx={{
                          bgcolor: `${action.color}.main`,
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          mb: 2,
                          boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                        }}
                      >
{action.icon}
                      </Avatar>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          fontSize: '1rem',
                          mb: 1,
                          color: 'text.primary'
                        }}
                      >
                        {action.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontSize: '0.875rem' }}
                      >
                        {action.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </Grid>

        {/* Feedback Section */}
        <Grid item xs={12}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2137 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f0f8ff 100%)'
            }}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                bgcolor: 'primary.main',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: '12px 12px 0 0'
              }}
            >
              <FeedbackIcon />
              <Typography variant="h6" fontWeight={600}>
                Share Your Feedback
              </Typography>
            </Box>

            {/* Feedback Form */}
            <CardContent sx={{ p: 3 }}>
              {feedbackMessage.text && (
                <Alert
                  severity={feedbackMessage.type}
                  onClose={() => setFeedbackMessage({ type: '', text: '' })}
                  sx={{ mb: 2 }}
                >
                  {feedbackMessage.text}
                </Alert>
              )}

              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder="We'd love to hear your thoughts, suggestions, or any issues you've encountered..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                variant="outlined"
                disabled={submittingFeedback}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Your feedback helps us improve the system
                </Typography>
                <Button
                  variant="contained"
                  startIcon={submittingFeedback ? <CircularProgress size={16} color="inherit" /> : <Send />}
                  onClick={handleFeedbackSubmit}
                  disabled={submittingFeedback || !feedbackText.trim()}
                  sx={{
                    px: 3,
                    py: 1,
                    fontWeight: 600
                  }}
                >
                  {submittingFeedback ? 'Sending...' : 'Send Feedback'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
    <Dialog open={checkOutDialog} onClose={() => setCheckOutDialog(false)}>
      <DialogTitle>Confirm Check Out</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to check out now? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCheckOutDialog(false)}>Cancel</Button>
        <Button onClick={confirmCheckOut} variant="contained" color="primary">
          Yes, Check Out
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

export default UserDashboard;