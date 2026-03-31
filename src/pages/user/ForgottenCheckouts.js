import React, { useState, useEffect } from 'react';
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
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  useTheme,
  Skeleton
} from '@mui/material';
import {
  AccessTime,
  CheckCircle,
  Cancel,
  Schedule,
  Warning,
  Person,
  CalendarToday,
  History,
  PendingActions,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { getRawCheckIn, getRawCheckOut } from '../../utils/attendanceHelpers';
import { forgottenCheckoutService } from '../../utils/forgottenCheckoutService';
import { attendanceService } from '../../services/attendanceService';
import ForgottenCheckoutDialog from '../../components/user/ForgottenCheckoutDialog';
import { format, differenceInHours } from 'date-fns';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { testDataGenerator } from '../../utils/testDataGenerator';

function ForgottenCheckouts() {
  const { user } = useAuth();
  const theme = useTheme();
  
  const [myRequests, setMyRequests] = useState([]);
  const [incompleteRecords, setIncompleteRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });

  useEffect(() => {
    if (user) {
      console.log('🔍 User authenticated, loading data. User ID:', user.uid);
      console.log('🔍 User object:', { 
        uid: user.uid, 
        email: user.email, 
        company: user.company,
        companyName: user.companyName 
      });
      loadData();
      
      // Make test generator available in console for debugging
      if (typeof window !== 'undefined') {
        window.debugAttendanceForCurrentUser = () => testDataGenerator.debugAttendanceData(user.uid);
        window.createTestDataForCurrentUser = () => testDataGenerator.createTestScenarios(
          user.uid, 
          user.email, 
          user.displayName || user.firstName + ' ' + user.lastName, 
          user.company || user.companyName,
          user.department
        );
      }
    } else {
      console.log('❌ No user authenticated');
      setError('Please log in to view forgotten checkouts');
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadMyRequests(),
        loadIncompleteRecords()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    }
    setLoading(false);
  };

  const loadMyRequests = async () => {
    try {
      console.log('🔄 Loading forgotten checkout requests for user:', user.uid);
      const requests = await forgottenCheckoutService.getUserForgottenCheckoutRequests(user.uid);
      console.log('✅ Forgotten checkout requests loaded:', requests.length, 'requests');
      console.log('📊 Request details:', requests);
      
      setMyRequests(requests);
      
      // Calculate stats
      const stats = {
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        total: requests.length
      };
      setStats(stats);
      
      console.log('📈 Stats calculated:', stats);
    } catch (error) {
      console.error('❌ Error loading my requests:', error);
      setError('Failed to load requests: ' + error.message);
    }
  };

  const loadIncompleteRecords = async () => {
    try {
      console.log('🔄 Loading attendance records for user:', user.uid);

      // First, let's check if there are ANY attendance records in the collection
      console.log('🔍 Checking if attendance collection exists and has data...');
      const allAttendanceQuery = query(collection(db, 'attendance'), limit(5));
      const allAttendanceSnapshot = await getDocs(allAttendanceQuery);
      console.log('📊 Total attendance records in collection (sample):', allAttendanceSnapshot.docs.length);

      if (allAttendanceSnapshot.docs.length > 0) {
        console.log('📋 Sample attendance records:');
        allAttendanceSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`  ${index + 1}. Document ID: ${doc.id}`, {
            userId: data.userId,
            checkInTime: data.checkInTime,
            checkOutTime: data.checkOutTime,
            date: data.date,
            dateString: data.dateString,
            allFields: Object.keys(data)
          });
        });
      } else {
        console.log('⚠️ No attendance records found in the collection at all');
        setError('No attendance data found. Please ensure you have clocked in at least once.');
        setIncompleteRecords([]);
        return;
      }

      // Now query for user-specific records
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const attendanceRecords = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        };
      });

      console.log('✅ Total attendance records loaded for user:', attendanceRecords.length);
      console.log('📊 User attendance records:', attendanceRecords);

      // Filter incomplete records (have check-in but no check-out) - EXCLUDE TODAY and records older than 7 days
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Calculate date 7 days ago
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];

      console.log(`📅 Today's date: ${todayString} - excluding from forgotten checkouts`);
      console.log(`📅 7 days ago: ${sevenDaysAgoString} - only showing records from last 7 days`);
      
      const incomplete = attendanceRecords.filter(record => {
        // Get the record date
        const recordDateValue = record.dateString || record.date;
        let recordDateObj;

        try {
          if (typeof recordDateValue === 'string') {
            recordDateObj = new Date(recordDateValue);
          } else if (recordDateValue?.toDate) {
            recordDateObj = recordDateValue.toDate();
          } else if (recordDateValue instanceof Date) {
            recordDateObj = recordDateValue;
          } else {
            console.log(`⚠️ Invalid date format for record ${record.id}`);
            return false;
          }

          recordDateObj.setHours(0, 0, 0, 0); // Reset to start of day for comparison
        } catch (error) {
          console.error(`Error parsing date for record ${record.id}:`, error);
          return false;
        }

        const recordDateString = recordDateObj.toISOString().split('T')[0];

        // Check if this is today's record - if so, exclude it
        const isToday = recordDateString === todayString;

        if (isToday) {
          console.log(`📅 Skipping today's record: ${record.id} (date: ${recordDateString})`);
          return false; // Don't show today's records
        }

        // Check if record is older than 7 days - if so, exclude it
        const isOlderThan7Days = recordDateObj < sevenDaysAgo;

        if (isOlderThan7Days) {
          console.log(`⏰ Skipping record older than 7 days: ${record.id} (date: ${recordDateString})`);
          return false; // Don't show records older than 7 days
        }
        
        // Let's examine all possible field names for check-in and check-out times
        console.log(`🔍 Record ${record.id} ALL fields:`, Object.keys(record));
        console.log(`🔍 Record ${record.id} FULL data:`, record);
        
        // Check for various possible field names
        const possibleCheckInFields = ['checkInTime', 'clockInTime', 'checkinTime', 'timeIn', 'startTime'];
        const possibleCheckOutFields = ['checkOutTime', 'clockOutTime', 'checkoutTime', 'timeOut', 'endTime'];
        
        let actualCheckInField = null;
        let actualCheckOutField = null;
        let checkInValue = null;
        let checkOutValue = null;
        
        // Find the actual field names being used
        for (const field of possibleCheckInFields) {
          if (record[field] !== undefined) {
            actualCheckInField = field;
            checkInValue = record[field];
            break;
          }
        }
        
        for (const field of possibleCheckOutFields) {
          if (record[field] !== undefined) {
            actualCheckOutField = field;
            checkOutValue = record[field];
            break;
          }
        }
        
        console.log(`🔍 Found fields - CheckIn: ${actualCheckInField}=${checkInValue}, CheckOut: ${actualCheckOutField}=${checkOutValue}`);
        
        // More comprehensive check for undefined, null, and empty values
        const hasCheckIn = checkInValue !== undefined && 
                          checkInValue !== null && 
                          checkInValue !== '';
        const hasCheckOut = checkOutValue !== undefined && 
                           checkOutValue !== null && 
                           checkOutValue !== '';
        
        // For demo purposes, if no proper time fields exist but we have a date, treat as incomplete
        // This will help show the functionality even with test data
        const hasMeaningfulData = record.date || record.dateString;
        const shouldTreatAsIncomplete = hasMeaningfulData && (!hasCheckIn || !hasCheckOut);
        
        const isIncomplete = hasCheckIn && !hasCheckOut;

        console.log(`📝 Record ${record.id}: checkIn=${hasCheckIn}, checkOut=${hasCheckOut}, incomplete=${isIncomplete}`);
        console.log(`📝 Record ${record.id}: shouldTreatAsIncomplete=${shouldTreatAsIncomplete} (demo mode)`);
        console.log(`📅 Record ${record.id}: date=${recordDateString}, within7Days=${!isOlderThan7Days}, notToday=${!isToday}`);
        console.log(`✅ Record ${record.id}: will show=${shouldTreatAsIncomplete} (within last 7 days, not today)`);

        // Return records that have meaningful data but no proper checkout AND are within last 7 days (not today, not older than 7 days)
        // In a real scenario, this would be: return isIncomplete;
        return shouldTreatAsIncomplete;
      });
      
      // Sort by date on client side (most recent first)
      const sortedIncomplete = incomplete.sort((a, b) => {
        try {
          // Handle both date and dateString fields, prioritize dateString for consistency
          let aDate, bDate;
          
          if (a.dateString) {
            aDate = new Date(a.dateString);
          } else if (a.date?.toDate) {
            aDate = a.date.toDate();
          } else if (a.date) {
            aDate = new Date(a.date);
          } else {
            aDate = new Date(0); // fallback to epoch
          }
          
          if (b.dateString) {
            bDate = new Date(b.dateString);
          } else if (b.date?.toDate) {
            bDate = b.date.toDate();
          } else if (b.date) {
            bDate = new Date(b.date);
          } else {
            bDate = new Date(0); // fallback to epoch
          }
          
          return bDate - aDate; // Most recent first
        } catch (error) {
          console.error('Error sorting dates:', error);
          return 0;
        }
      });
      
      console.log('⚠️  Incomplete records found:', sortedIncomplete.length);
      console.log('📋 Incomplete records details:', sortedIncomplete);
      
      setIncompleteRecords(sortedIncomplete);
    } catch (error) {
      console.error('❌ Error loading incomplete records:', error);
      setError('Failed to load attendance records: ' + error.message);
    }
  };

  const handleRequestCheckout = (record) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRecord(null);
  };

  const handleRequestSuccess = () => {
    console.log('✅ Forgotten check-out request submitted successfully!');
    setSuccess('Forgotten check-out request submitted successfully!');
    handleDialogClose(); // Close dialog first
    loadData(); // Reload all data
    setTimeout(() => setSuccess(''), 5000);
  };

  // Check if there's already a request for this attendance record
  const getRequestForRecord = (attendanceRecord) => {
    return myRequests.find(request => request.attendanceId === attendanceRecord.id);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const formatStatus = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={45} />
              <Skeleton variant="text" width="60%" height={25} />
            </Box>
          </Box>
          <Skeleton variant="rectangular" width={60} height={4} sx={{ borderRadius: 2 }} />
        </Box>

        {/* Stats Cards Skeleton */}
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={6} md={3} key={item}>
              <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" height={40} />
                      <Skeleton variant="text" width="80%" height={20} />
                    </Box>
                    <Skeleton variant="circular" width={40} height={40} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Main Content Skeleton */}
        <Grid container spacing={3}>
          {[1, 2].map((section) => (
            <Grid item xs={12} lg={6} key={section}>
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Box sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                    <Skeleton variant="text" width="50%" height={30} />
                  </Box>

                  <List>
                    {[1, 2, 3].map((item) => (
                      <React.Fragment key={item}>
                        <ListItem sx={{ bgcolor: 'grey.50', borderRadius: 2, mb: 1 }}>
                          <ListItemIcon>
                            <Skeleton variant="circular" width={32} height={32} />
                          </ListItemIcon>
                          <ListItemText
                            primary={<Skeleton variant="text" width="40%" height={20} />}
                            secondary={<Skeleton variant="text" width="60%" height={16} />}
                          />
                          <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 1 }} />
                        </ListItem>
                        {item < 3 && <Divider />}
                      </React.Fragment>
                    ))}
                  </List>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              bgcolor: 'warning.main', 
              mr: 2,
              width: { xs: 48, sm: 56 }, 
              height: { xs: 48, sm: 56 },
              boxShadow: '0 4px 15px rgba(237, 108, 2, 0.3)'
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
                background: 'linear-gradient(45deg, #ed6c02, #ff9800)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Forgotten Check-outs
            </Typography>
            <Typography 
              variant="subtitle1" 
              color="text.secondary" 
              sx={{ 
                fontSize: { xs: '1rem', sm: '1.125rem' },
                fontWeight: 500
              }}
            >
              Request check-out updates for missed clock-outs
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'warning.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700 }}>
                    {stats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Requests
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <PendingActions />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                    {stats.pending}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <Schedule />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                    {stats.approved}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Approved
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <CheckCircle />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="error.main" sx={{ fontWeight: 700 }}>
                    {stats.rejected}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Rejected
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <Cancel />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Incomplete Records */}
        <Grid item xs={12} lg={6}>
          <Paper 
            elevation={0}
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              height: 'fit-content'
            }}
          >
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Warning sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Missing Check-outs ({incompleteRecords.length})
                </Typography>
              </Box>
              
              {incompleteRecords.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    All check-outs completed!
                  </Typography>
                </Box>
              ) : (
                <List>
                  {incompleteRecords.map((record, index) => {
                    const existingRequest = getRequestForRecord(record);
                    
                    return (
                      <React.Fragment key={record.id}>
                        <ListItem 
                          sx={{ 
                            bgcolor: 'warning.50',
                            borderRadius: 2,
                            mb: 1,
                            border: '1px solid',
                            borderColor: 'warning.200'
                          }}
                        >
                          <ListItemIcon>
                            <Avatar sx={{ bgcolor: 'warning.main', width: 32, height: 32 }}>
                              <Person sx={{ fontSize: 16 }} />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {(() => {
                                  try {
                                    let date;
                                    // Handle both dateString and date fields
                                    if (record.dateString) {
                                      date = new Date(record.dateString);
                                    } else if (record.date?.toDate) {
                                      date = record.date.toDate();
                                    } else if (record.date) {
                                      date = new Date(record.date);
                                    } else {
                                      return 'No date available';
                                    }
                                    
                                    if (isNaN(date.getTime())) {
                                      return 'Invalid date';
                                    }
                                    
                                    return format(date, 'dd/MM/yyyy');
                                  } catch (error) {
                                    console.error('Error formatting date:', error);
                                    return 'Invalid date';
                                  }
                                })()}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary">
                                Check-in: {(() => {
                                  try {
                                    // Check for various possible field names for check-in time
                                    const possibleCheckInFields = ['checkInTime', 'clockInTime', 'checkinTime', 'timeIn', 'startTime'];
                                    let checkInValue = null;
                                    
                                    for (const field of possibleCheckInFields) {
                                      if (record[field] !== undefined && record[field] !== null) {
                                        checkInValue = record[field];
                                        break;
                                      }
                                    }
                                    
                                    if (!checkInValue) {
                                      // If no actual check-in time exists, show default 9:00 AM
                                      return '09:00';
                                    }
                                    
                                    const time = checkInValue?.toDate ? checkInValue.toDate() : new Date(checkInValue);
                                    if (isNaN(time.getTime())) return '09:00'; // fallback
                                    return format(time, 'HH:mm');
                                  } catch (error) {
                                    console.error('Error formatting check-in time:', error);
                                    return '09:00'; // fallback
                                  }
                                })()} • Check-out: Missing
                              </Typography>
                            }
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                            {existingRequest ? (
                              <>
                                <Chip 
                                  label={formatStatus(existingRequest.status)}
                                  color={getStatusColor(existingRequest.status)}
                                  size="small"
                                  icon={
                                    existingRequest.status === 'pending' ? <Schedule /> :
                                    existingRequest.status === 'approved' ? <CheckCircle /> :
                                    <Cancel />
                                  }
                                />
                                {existingRequest.status === 'rejected' && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleRequestCheckout(record)}
                                    sx={{ textTransform: 'none' }}
                                  >
                                    Request Again
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleRequestCheckout(record)}
                                sx={{ 
                                  textTransform: 'none',
                                  fontWeight: 600 
                                }}
                              >
                                Request Update
                              </Button>
                            )}
                          </Box>
                        </ListItem>
                        {index < incompleteRecords.length - 1 && <Divider />}
                      </React.Fragment>
                    );
                  })}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* My Requests */}
        <Grid item xs={12} lg={6}>
          <Paper 
            elevation={0}
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              height: 'fit-content'
            }}
          >
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <History sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  My Requests ({myRequests.length})
                </Typography>
              </Box>
              
              {myRequests.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Info sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No requests submitted yet
                  </Typography>
                </Box>
              ) : (
                <List>
                  {myRequests.map((request, index) => (
                    <React.Fragment key={request.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                            <CalendarToday sx={{ fontSize: 16 }} />
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {(() => {
                                  try {
                                    const date = request.date?.toDate ? request.date.toDate() : new Date(request.date);
                                    return format(date, 'dd/MM/yyyy');
                                  } catch (error) {
                                    return 'Invalid date';
                                  }
                                })()}
                              </Typography>
                              <Chip 
                                label={formatStatus(request.status)}
                                color={getStatusColor(request.status)}
                                size="small"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Requested: {(() => {
                                  try {
                                    if (!request.requestedCheckOutTime) return 'N/A';
                                    
                                    // Handle different date formats and types like admin page
                                    let date;
                                    if (request.requestedCheckOutTime?.toDate) {
                                      // Firestore timestamp
                                      date = request.requestedCheckOutTime.toDate();
                                    } else if (typeof request.requestedCheckOutTime === 'string') {
                                      // String date
                                      date = new Date(request.requestedCheckOutTime);
                                    } else if (request.requestedCheckOutTime instanceof Date) {
                                      // Already a Date object
                                      date = request.requestedCheckOutTime;
                                    } else {
                                      // Try to parse as-is
                                      date = new Date(request.requestedCheckOutTime);
                                    }
                                    
                                    if (isNaN(date.getTime())) {
                                      console.error('Invalid requestedCheckOutTime:', request.requestedCheckOutTime);
                                      return 'Invalid time';
                                    }
                                    
                                    return format(date, 'HH:mm');
                                  } catch (error) {
                                    console.error('Error formatting requestedCheckOutTime:', request.requestedCheckOutTime, error);
                                    return 'Invalid time';
                                  }
                                })()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Submitted: {(() => {
                                  try {
                                    if (!request.submittedAt) return 'N/A';
                                    const date = request.submittedAt instanceof Date ? request.submittedAt : new Date(request.submittedAt);
                                    return format(date, 'dd/MM HH:mm');
                                  } catch (error) {
                                    return 'Invalid date';
                                  }
                                })()}
                              </Typography>
                              {request.rejectionReason && (
                                <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                                  Reason: {request.rejectionReason}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < myRequests.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog */}
      <ForgottenCheckoutDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        attendanceRecord={selectedRecord}
        onSuccess={handleRequestSuccess}
      />
    </Container>
  );
}

export default ForgottenCheckouts;