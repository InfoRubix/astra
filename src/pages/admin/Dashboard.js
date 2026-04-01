import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemAvatar,
  Chip,
  Button,
  Divider,
  LinearProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Snackbar,
  Skeleton
} from '@mui/material';
import {
  People,
  AccessTime,
  EventBusy,
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Schedule,
  Warning,
  MoreVert,
  Notifications,
  Assignment,
  AccountCircle,
  Today,
  CalendarToday,
  ChevronLeft,
  ChevronRight,
  ArrowDropDown,
  PictureAsPdf,
  Analytics,
  Feedback,
  Send
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfToday, startOfMonth, endOfMonth, subMonths, addMonths, getDaysInMonth, eachDayOfInterval } from 'date-fns';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart } from 'recharts';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { migrateCompanyNames } from '../../utils/migrateCompanyNames';
import { attendanceService } from '../../services/attendanceService';
import { reportService } from '../../services/reportService';
import { pdfService } from '../../services/pdfService';
import CompanyFilter from '../../components/admin/CompanyFilter';
import CompanyStatsCard from '../../components/admin/CompanyStatsCard';
import { getRawCheckIn, getRawCheckOut, getCheckInTime } from '../../utils/attendanceHelpers';

function AdminDashboard() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    todayStats: { totalEmployees: 0, presentToday: 0, onLeave: 0, lateArrivals: 0, attendanceRate: 0 },
    leaveApprovals: [],
    recentActivity: [],
    weeklyAttendance: [],
    companyStats: [],
    loading: true
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMenuAnchor, setReportMenuAnchor] = useState(null);
  const [lateArrivalsDialogOpen, setLateArrivalsDialogOpen] = useState(false);
  const [lateArrivalsList, setLateArrivalsList] = useState([]);
  
  // Update current time every minute for admin dashboard
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      // Initialize other dashboard data if needed
    }
  }, [user]);


  // Load dashboard data on component mount
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Handle month changes separately with loading state
  useEffect(() => {
    if (user && dashboardData.todayStats.totalEmployees > 0) {
      handleMonthChange();
    }
  }, [selectedMonth]);

  const handleMonthChange = async () => {
    setMonthlyLoading(true);
    try {
      const totalEmployees = dashboardData.todayStats.totalEmployees;
      const monthlyAttendanceData = await loadMonthlyAttendance(totalEmployees, selectedMonth);
      setDashboardData(prev => ({
        ...prev,
        weeklyAttendance: monthlyAttendanceData // Reusing same field for simplicity
      }));
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
    setMonthlyLoading(false);
  };

  const loadMonthlyAttendance = async (totalEmployees, selectedDate) => {
    const monthlyAttendanceData = [];
    const monthStart = startOfMonth(selectedDate);
    const today = new Date();
    
    // Determine end date - either end of month or today, whichever is earlier
    const monthEnd = endOfMonth(selectedDate);
    const endDate = monthEnd > today ? today : monthEnd;
    
    // Get all days from start of month until today (or end of month if in the past)
    const allDays = eachDayOfInterval({ start: monthStart, end: endDate });
    
    for (const date of allDays) {
      const dateString = format(date, 'yyyy-MM-dd');
      const dayLabel = format(date, 'dd/MM/yyyy');
      
      const dayAttendanceQuery = query(
        collection(db, 'attendance'),
        where('dateString', '==', dateString)
      );
      
      try {
        const dayAttendanceSnapshot = await getDocs(dayAttendanceQuery);
        const attendanceCount = dayAttendanceSnapshot.size;
        const percentage = totalEmployees > 0 ? Math.round((attendanceCount / totalEmployees) * 100) : 0;
        
        monthlyAttendanceData.push({
          day: dayLabel,
          date: dateString,
          attendance: attendanceCount,
          percentage: percentage
        });
      } catch (error) {
        console.error(`Error loading attendance for ${dateString}:`, error);
        monthlyAttendanceData.push({
          day: dayLabel,
          date: dateString,
          attendance: 0,
          percentage: 0
        });
      }
    }
    
    return monthlyAttendanceData;
  };

  const loadStaffAttendanceDetails = async (selectedDate) => {
    const monthStart = startOfMonth(selectedDate);
    const today = new Date();
    
    // Determine end date - either end of month or today, whichever is earlier
    const monthEnd = endOfMonth(selectedDate);
    const endDate = monthEnd > today ? today : monthEnd;
    
    // Get all days from start of month until today (or end of month if in the past)
    const allDays = eachDayOfInterval({ start: monthStart, end: endDate });
    const staffAttendanceDetails = [];
    
    for (const date of allDays) {
      const dateString = format(date, 'yyyy-MM-dd');
      
      const dayAttendanceQuery = query(
        collection(db, 'attendance'),
        where('dateString', '==', dateString)
      );
      
      try {
        const dayAttendanceSnapshot = await getDocs(dayAttendanceQuery);
        dayAttendanceSnapshot.docs.forEach(doc => {
          const attendanceData = doc.data();
          staffAttendanceDetails.push({
            userName: attendanceData.userName,
            dateString: dateString,
            checkInTime: getRawCheckIn(attendanceData),
            checkOutTime: getRawCheckOut(attendanceData),
            ...attendanceData
          });
        });
      } catch (error) {
        console.error(`Error loading staff attendance details for ${dateString}:`, error);
      }
    }
    
    return staffAttendanceDetails;
  };

  const loadDashboardData = async () => {
    console.log('🚀 STARTING loadDashboardData function...');
    try {
      // Use user's actual company (supporting legacy fields during transition)
      const companyName = user.originalCompanyName || user.company || '';
      console.log('👤 Admin user company:', companyName);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Load company settings for all companies
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companySettingsMap = {};
      companySettingsSnapshot.docs.forEach(doc => {
        const settings = doc.data();
        companySettingsMap[settings.company] = settings;
      });

      // Load employees (exclude admins from count)
      // Users collection may use 'company' or 'originalCompanyName' field
      const employeesQuery = query(
        collection(db, 'users')
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      const allUsers = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Admin sees ALL users from all companies
      const companyUsers = allUsers;
      const totalEmployees = companyUsers.filter(u => u.role !== 'admin').length;

      // Load today's attendance using the new dateString field
      const todayString = format(today, 'yyyy-MM-dd');
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('dateString', '==', todayString)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const todayAttendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load pending leaves for approvals section
      const pendingLeavesQuery = query(
        collection(db, 'leaves'),
        where('status', '==', 'pending')
      );
      const pendingLeavesSnapshot = await getDocs(pendingLeavesQuery);

      const pendingLeaves = pendingLeavesSnapshot.docs.map(doc => ({
        type: 'leave',
        employee: doc.data().userName,
        company: doc.data().company || doc.data().originalCompanyName || '',
        request: `${doc.data().leaveType} Leave - ${doc.data().totalDays} days`,
        date: `${format(doc.data().startDate?.toDate ? doc.data().startDate.toDate() : new Date(doc.data().startDate), 'dd/MM/yyyy')} to ${format(doc.data().endDate?.toDate ? doc.data().endDate.toDate() : new Date(doc.data().endDate), 'dd/MM/yyyy')}`,
        avatar: doc.data().userName ? doc.data().userName.split(' ').map(n => n[0]).join('') : 'U'
      }));

      // Load approved leaves that are active TODAY for statistics
      const approvedLeavesQuery = query(
        collection(db, 'leaves'),
        where('status', '==', 'approved')
      );
      const approvedLeavesSnapshot = await getDocs(approvedLeavesQuery);
      
      // Count employees who are actually on leave today (approved leaves covering today's date)
      let actualOnLeaveToday = 0;
      approvedLeavesSnapshot.docs.forEach(doc => {
        const leaveData = doc.data();
        const startDate = leaveData.startDate?.toDate ? leaveData.startDate.toDate() : new Date(leaveData.startDate);
        const endDate = leaveData.endDate?.toDate ? leaveData.endDate.toDate() : new Date(leaveData.endDate);
        
        // Check if today falls within the leave period
        if (today >= startDate && today <= endDate) {
          actualOnLeaveToday++;
        }
      });

      // Calculate late arrivals using company-specific working hours
      let lateArrivals = 0;
      const lateArrivalsDetails = [];
      console.log('=== DEBUGGING LATE ARRIVALS (ROUND 2) ===');
      console.log('Total attendance records found:', todayAttendance.length);
      console.log('Company settings available:', Object.keys(companySettingsMap));

      todayAttendance.forEach((attendance, index) => {
        console.log(`\n--- Record ${index + 1} ---`);
        console.log('Full attendance record:', attendance);
        console.log('Has clockInTime:', !!attendance.clockInTime);
        console.log('Has company:', !!attendance.company);
        console.log('Company value:', attendance.company);

        // Handle both old format (checkInTime) and new format (clockInTime)
        const checkInTime = getRawCheckIn(attendance);
        const company = attendance.company || attendance.originalCompanyName || '';

        if (checkInTime) {
          const clockInTime = checkInTime.toDate ? checkInTime.toDate() : new Date(checkInTime);

          // Get company-specific working hours, fallback to 09:00 if not found
          const companySettings = companySettingsMap[company];
          const workStartTime = companySettings?.workStartTime || '09:00';

          console.log(`User: ${attendance.userName}`);
          console.log(`Clock in time: ${clockInTime.toLocaleString()}`);
          console.log(`Company: ${company}`);
          console.log(`Work start time: ${workStartTime}`);
          console.log('Company settings found:', !!companySettings);

          const lateStatus = attendanceService.calculateLateStatus(clockInTime, workStartTime);
          console.log('Late status calculation:', lateStatus);

          if (lateStatus.isLate) {
            lateArrivals++;
            lateArrivalsDetails.push({
              userName: attendance.userName,
              clockInTime: clockInTime,
              workStartTime: workStartTime,
              lateByMinutes: lateStatus.lateByMinutes,
              company: company
            });
            console.log(`✅ ${attendance.userName} IS LATE! Total late count: ${lateArrivals}`);
          } else {
            console.log(`❌ ${attendance.userName} is NOT late`);
          }
        } else {
          console.log(`⚠️ Skipping ${attendance.userName || 'unknown'}: missing check-in time`);
          console.log('Missing clockInTime:', !attendance.clockInTime);
          console.log('Missing checkInTime:', !attendance.checkInTime);
        }
      });

      console.log(`\n📊 FINAL LATE ARRIVALS COUNT: ${lateArrivals}`);
      console.log('=== END DEBUG ===\n');

      const todayStats = {
        totalEmployees,
        presentToday: todayAttendance.length,
        onLeave: actualOnLeaveToday,
        lateArrivals: lateArrivals,
        attendanceRate: totalEmployees > 0 ? Math.round((todayAttendance.length / totalEmployees) * 100) : 0
      };

      // Load monthly attendance data (weekdays only)
      const monthlyAttendanceData = await loadMonthlyAttendance(totalEmployees, selectedMonth);
      const companyEmployeeCount = {};

      // Count employees by company for pie chart
      allUsers.forEach(user => {
        if (user.role !== 'admin') { // Exclude admins from company stats
          const company = user.originalCompanyName || user.company || '';
          companyEmployeeCount[company] = (companyEmployeeCount[company] || 0) + 1;
        }
      });

      const companyStatsData = Object.entries(companyEmployeeCount).map(([name, value], index) => {
        const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];
        return {
          name,
          value,
          color: colors[index % colors.length]
        };
      });

      setDashboardData({
        todayStats,
        leaveApprovals: pendingLeaves.slice(0, 10),
        recentActivity: [], // Could load from attendance/activity logs
        weeklyAttendance: monthlyAttendanceData,
        companyStats: companyStatsData,
        lateArrivalsDetails: lateArrivalsDetails,
        loading: false
      });

      console.log('Dashboard data loaded:', { 
        todayStats, 
        leaveApprovals: pendingLeaves,
        weeklyAttendance: monthlyAttendanceData,
        companyStats: companyStatsData
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setDashboardData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleMigrateCompanyNames = async () => {
    if (!window.confirm('This will update all existing records to use normalized company names. Continue?')) {
      return;
    }

    setMigrationLoading(true);
    setMigrationMessage('');

    try {
      const result = await migrateCompanyNames();
      if (result.success) {
        setMigrationMessage('✅ Migration completed! All users should now see shared data.');
        // Reload dashboard data after migration
        await loadDashboardData();
      } else {
        setMigrationMessage(`❌ Migration failed: ${result.error}`);
      }
    } catch (error) {
      setMigrationMessage(`❌ Migration error: ${error.message}`);
    }

    setMigrationLoading(false);
    
    // Clear message after 10 seconds
    setTimeout(() => setMigrationMessage(''), 10000);
  };

  const handleGenerateReport = async (reportType = 'standard') => {
    setReportLoading(true);
    setReportMenuAnchor(null);
    
    try {
      let success;
      const additionalData = {
        companyName: user.originalCompanyName || user.company || '',
        generatedBy: `${user.firstName} ${user.lastName}`
      };

      // Load staff attendance details for the selected month
      const staffAttendanceDetails = await loadStaffAttendanceDetails(selectedMonth);
      console.log('Loaded staff attendance details:', staffAttendanceDetails.length, 'records');

      if (reportType === 'detailed') {
        // Use new PDF service for detailed report with staff attendance data
        success = await pdfService.exportDashboardReport(dashboardData, selectedMonth, {
          ...additionalData,
          reportType: 'detailed'
        }, staffAttendanceDetails);
      } else {
        // Use new PDF service for standard report with staff attendance data
        success = await pdfService.exportDashboardReport(dashboardData, selectedMonth, additionalData, staffAttendanceDetails);
      }
      
      if (success) {
        setMigrationMessage(`✅ ${reportType === 'detailed' ? 'Detailed dashboard report' : 'Dashboard report'} with staff attendance details generated successfully!`);
      } else {
        // Fallback to original report service
        console.log('PDF service failed, falling back to original report service...');
        let result;
        if (reportType === 'detailed') {
          result = reportService.generateDetailedReport(dashboardData, selectedMonth, additionalData);
        } else {
          result = reportService.generateDashboardReport(dashboardData, selectedMonth);
        }
        
        if (result.success) {
          setMigrationMessage(`✅ ${reportType === 'detailed' ? 'Detailed report' : 'Report'} generated successfully! Downloaded as ${result.filename}`);
        } else {
          setMigrationMessage(`❌ Failed to generate report: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Report generation error:', error);
      setMigrationMessage(`❌ Report generation error: ${error.message}`);
    }
    setReportLoading(false);
    
    // Clear message after 5 seconds
    setTimeout(() => setMigrationMessage(''), 5000);
  };

  // Chart data now loaded from Firebase in dashboardData state

  // Pending approvals and recent activity now loaded from Firebase in dashboardData state

  const quickStats = [
    {
      title: 'Total Employees',
      value: dashboardData.todayStats.totalEmployees,
      icon: <People />,
      color: 'primary',
      trend: 'Active employees'
    },
    {
      title: 'Present Today',
      value: dashboardData.todayStats.presentToday,
      icon: <CheckCircle />,
      color: 'success',
      trend: `${dashboardData.todayStats.attendanceRate}% rate`
    },
    {
      title: 'On Leave',
      value: dashboardData.todayStats.onLeave,
      icon: <EventBusy />,
      color: 'warning',
      trend: 'Pending requests'
    },
    {
      title: 'Late Arrivals',
      value: dashboardData.todayStats.lateArrivals,
      icon: <Schedule />,
      color: 'error',
      trend: 'Today'
    }
  ];

  const getActivityIcon = (type) => {
    switch(type) {
      case 'check-in': return <TrendingUp color="success" />;
      case 'check-out': return <TrendingDown color="info" />;
      case 'leave': return <EventBusy color="warning" />;
      case 'claim': return <Receipt color="primary" />;
      case 'system': return <Notifications color="action" />;
      default: return <CheckCircle />;
    }
  };

  const getApprovalColor = (type) => {
    switch(type) {
      case 'leave': return 'warning';
      case 'claim': return 'info';
      default: return 'default';
    }
  };

  const handleLateArrivalsClick = () => {
    setLateArrivalsDialogOpen(true);
  };

  const handleCloseLateArrivalsDialog = () => {
    setLateArrivalsDialogOpen(false);
  };

  // Show loading screen while data is being fetched
  if (dashboardData.loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar
              sx={{
                bgcolor: 'primary.main',
                mr: 2,
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}
            >
              <AccountCircle sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Admin Dashboard
              </Typography>
              <Typography
                variant="subtitle1"
                color="text.secondary"
                sx={{
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                {format(currentTime, 'EEEE, dd/MM/yyyy • HH:mm')}
              </Typography>
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

        {/* Skeleton Quick Stats Cards */}
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
          {[
            { color: '#e3f2fd', darkColor: '#0d2137', icon: <People /> },
            { color: '#e8f5e8', darkColor: '#0d2b0f', icon: <CheckCircle /> },
            { color: '#fff3e0', darkColor: '#2b1d0d', icon: <EventBusy /> },
            { color: '#ffebee', darkColor: '#2b0d0d', icon: <Schedule /> }
          ].map((stat, index) => (
            <Grid item xs={6} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? `linear-gradient(135deg, #1a1a1a 0%, ${stat.darkColor} 100%)`
                    : `linear-gradient(135deg, #ffffff 0%, ${stat.color} 100%)`,
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Skeleton
                      variant="circular"
                      width={{ xs: 40, sm: 48 }}
                      height={{ xs: 40, sm: 48 }}
                      sx={{ mr: { xs: 0, sm: 2 }, mb: { xs: 1, sm: 0 } }}
                    />
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, flex: 1 }}>
                      <Skeleton variant="text" width={60} height={36} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width={100} height={20} />
                      <Skeleton variant="text" width={80} height={16} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Skeleton Charts Section */}
        <Grid container spacing={3}>
          {/* Skeleton Monthly Attendance Chart */}
          <Grid item xs={12} md={8}>
            <Card
              sx={{
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Skeleton variant="text" width={200} height={32} />
                  <Skeleton variant="rectangular" width={180} height={40} sx={{ borderRadius: 1 }} />
                </Box>
                <Skeleton
                  variant="rectangular"
                  width="100%"
                  height={300}
                  sx={{ borderRadius: 2 }}
                  animation="wave"
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Skeleton Company Distribution */}
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <CardContent>
                <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250 }}>
                  <Skeleton
                    variant="circular"
                    width={160}
                    height={160}
                    animation="wave"
                  />
                </Box>
                <Box sx={{ mt: 2 }}>
                  {[1, 2, 3].map((item) => (
                    <Box key={item} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Skeleton variant="rectangular" width={12} height={12} sx={{ mr: 1, borderRadius: 1 }} />
                      <Skeleton variant="text" width="60%" height={20} sx={{ flex: 1 }} />
                      <Skeleton variant="text" width={30} height={20} />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}
            >
              <AccountCircle sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Admin Dashboard
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                {format(currentTime, 'EEEE, dd/MM/yyyy • HH:mm')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={reportLoading ? <CircularProgress size={16} color="inherit" /> : <Assignment />}
              onClick={() => handleGenerateReport('standard')}
              disabled={reportLoading || dashboardData.loading}
              sx={{
                py: 1.5,
                px: 3,
                borderRadius: '3px 0 0 3px',
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                  transform: 'translateY(-1px)'
                },
                '&:disabled': {
                  transform: 'none'
                }
              }}
            >
              {reportLoading ? 'Generating...' : 'Generate Report'}
            </Button>
            <Button
              variant="contained"
              onClick={(e) => setReportMenuAnchor(e.currentTarget)}
              disabled={reportLoading || dashboardData.loading}
              sx={{
                minWidth: 'auto',
                py: 1.5,
                px: 1,
                borderRadius: '0 3px 3px 0',
                borderLeft: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                  transform: 'translateY(-1px)'
                },
                '&:disabled': {
                  transform: 'none'
                }
              }}
            >
              <ArrowDropDown />
            </Button>
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

      {/* Migration Message */}
      {migrationMessage && (
        <Alert 
          severity={migrationMessage.includes('✅') ? 'success' : 'error'} 
          sx={{ mb: 3 }}
        >
          {migrationMessage}
        </Alert>
      )}

      {/* Enhanced Quick Stats Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        {quickStats.map((stat, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card
              onClick={stat.title === 'Late Arrivals' ? handleLateArrivalsClick : undefined}
              sx={{
                height: '100%',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid',
                borderColor: 'divider',
                background: (theme) => theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, #1a1a1a 0%, ${stat.color === 'primary' ? '#0d2137' : stat.color === 'success' ? '#0d2b0f' : stat.color === 'warning' ? '#2b1d0d' : '#2b0d0d'} 100%)`
                  : `linear-gradient(135deg, #ffffff 0%, ${stat.color === 'primary' ? '#e3f2fd' : stat.color === 'success' ? '#e8f5e8' : stat.color === 'warning' ? '#fff3e0' : '#ffebee'} 100%)`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: stat.title === 'Late Arrivals' ? 'pointer' : 'default',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                  borderColor: `${stat.color}.light`
                }
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Avatar sx={{ 
                    bgcolor: `${stat.color}.main`, 
                    mr: { xs: 0, sm: 2 }, 
                    mb: { xs: 1, sm: 0 },
                    width: { xs: 40, sm: 48 },
                    height: { xs: 40, sm: 48 },
                    boxShadow: `0 4px 15px rgba(${stat.color === 'primary' ? '25, 118, 210' : stat.color === 'success' ? '46, 125, 50' : stat.color === 'warning' ? '237, 108, 2' : '211, 47, 47'}, 0.3)`
                  }}>  
                    {React.cloneElement(stat.icon, { sx: { fontSize: { xs: 20, sm: 24 } } })}
                  </Avatar>
                  <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontSize: { xs: '1.125rem', sm: '1.5rem' },
                        fontWeight: 600,
                        color: `${stat.color}.main`
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography 
                      color="text.secondary" 
                      sx={{ 
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        fontWeight: 500
                      }}
                    >
                      {stat.title}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: { xs: '0.625rem', sm: '0.75rem' }
                      }}
                    >
                      {stat.trend}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Monthly Attendance Chart */}
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">Daily Attendance Overview</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Month & Year</InputLabel>
                    <Select
                      value={format(selectedMonth, 'yyyy-MM')}
                      label="Month & Year"
                      onChange={(e) => {
                        const [year, month] = e.target.value.split('-');
                        setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                      }}
                    >
                      {/* Generate last 12 months */}
                      {Array.from({ length: 12 }, (_, i) => {
                        const date = subMonths(new Date(), i);
                        const value = format(date, 'yyyy-MM');
                        const label = format(date, 'MMMM yyyy');
                        return (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                  <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>
              
              {monthlyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                  <CircularProgress size={40} />
                </Box>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.weeklyAttendance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`${value} employees`, 'Present']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="#1976d2" 
                      strokeWidth={3}
                      dot={{ fill: '#1976d2', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#1976d2', strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Company Distribution */}
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Company Distribution
              </Typography>
              
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={dashboardData.companyStats || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {(dashboardData.companyStats || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              
              <Box sx={{ mt: 2 }}>
                {(dashboardData.companyStats || []).map((company, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: company.color, mr: 1, borderRadius: 1 }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {company.name}
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {company.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Space for additional dashboard components */}
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => setMenuAnchor(null)}>Export Data</MenuItem>
        <MenuItem onClick={() => setMenuAnchor(null)}>Print Report</MenuItem>
        <MenuItem onClick={() => setMenuAnchor(null)}>Share</MenuItem>
      </Menu>

      {/* Report Options Menu */}
      <Menu
        anchorEl={reportMenuAnchor}
        open={Boolean(reportMenuAnchor)}
        onClose={() => setReportMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleGenerateReport('standard')} sx={{ py: 1.5 }}>
          <PictureAsPdf sx={{ mr: 2, color: 'primary.main' }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>Standard Report</Typography>
            <Typography variant="caption" color="text.secondary">
              Basic dashboard summary
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleGenerateReport('detailed')} sx={{ py: 1.5 }}>
          <Analytics sx={{ mr: 2, color: 'success.main' }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>Detailed Report</Typography>
            <Typography variant="caption" color="text.secondary">
              Comprehensive analysis
            </Typography>
          </Box>
        </MenuItem>
      </Menu>

      {/* Late Arrivals Dialog */}
      <Dialog
        open={lateArrivalsDialogOpen}
        onClose={handleCloseLateArrivalsDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: 'error.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Schedule />
          Late Arrivals Today
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {dashboardData.lateArrivalsDetails && dashboardData.lateArrivalsDetails.length > 0 ? (
            <List>
              {dashboardData.lateArrivalsDetails.map((person, index) => (
                <React.Fragment key={index}>
                  <ListItem sx={{ py: 2 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'error.light' }}>
                        {person.userName ? person.userName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body1" fontWeight={600}>
                          {person.userName}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Company: {person.company}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Clock In: {format(person.clockInTime, 'HH:mm:ss')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Expected: {person.workStartTime}
                          </Typography>
                          <Chip
                            label={`Late by ${person.lateByMinutes} minutes`}
                            size="small"
                            color="error"
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < dashboardData.lateArrivalsDetails.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No late arrivals today!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All employees checked in on time.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleCloseLateArrivalsDialog} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default AdminDashboard;