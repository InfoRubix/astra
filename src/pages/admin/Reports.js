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
  CardHeader,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Avatar,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Fab,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { 
  TrendingUp,
  People,
  Schedule,
  AttachMoney,
  CalendarToday,
  Assessment,
  Download,
  FilterList,
  Refresh,
  CheckCircle,
  Cancel,
  AccessTime,
  EventAvailable,
  Receipt,
  Warning,
  Insights,
  Analytics,
  PieChart,
  BarChart,
  Timeline,
  DateRange,
  ArrowBack,
  ArrowForward
} from '@mui/icons-material';
import { 
  AreaChart, 
  Area, 
  BarChart as RechartsBarChart, 
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

function AdminReports() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [dateRange, setDateRange] = useState('month');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);
  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const [currentPage, setCurrentPage] = useState(0);
  const [claimsCurrentPage, setClaimsCurrentPage] = useState(0);
  const companiesPerPage = 4;
  const [reportsData, setReportsData] = useState({
    attendanceData: [],
    leaveData: [],
    claimsData: [],
    companyStats: [],
    topPerformers: [],
    recentActivities: []
  });

  // Load real reports data from Firebase
  const loadReportsData = async (customStartDate = null, customEndDate = null) => {
    setLoading(true);
    try {
      const filterStartDate = customStartDate || startDate;
      const filterEndDate = customEndDate || endDate;
      console.log('🔍 Admin loading reports data from ALL companies');
      
      // Load company settings to get work start times
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companySettings = {};
      
      companySettingsSnapshot.docs.forEach(doc => {
        const setting = doc.data();
        companySettings[setting.company] = {
          workStartTime: setting.workStartTime || '09:00',
          workEndTime: setting.workEndTime || '18:00',
          ...setting
        };
      });
      
      console.log('🏢 Loaded company settings:', companySettings);
      
      // Load ALL employees from all companies (exclude admins)
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const employees = allUsers.filter(u => u.role !== 'admin');
      
      // Show breakdown by company
      const companySummary = {};
      employees.forEach(emp => {
        const company = emp.originalCompanyName || emp.company || 'Unknown';
        companySummary[company] = (companySummary[company] || 0) + 1;
      });
      console.log('🔍 Employees by company:', companySummary);
      console.log('🔍 Available company names for work hours mapping:', Object.keys(companySummary));
      
      // Load attendance data for selected date range
      const attendanceDataArray = [];
      const totalEmployees = employees.length;
      
      // Generate date range from filterStartDate to filterEndDate
      const startDateObj = new Date(filterStartDate);
      const endDateObj = new Date(filterEndDate);
      const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
      
      // Generate data for each day in the range (max 30 days to avoid too much data)
      const maxDays = Math.min(daysDiff + 1, 30);
      for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
        const date = new Date(startDateObj);
        date.setDate(startDateObj.getDate() + dayOffset);
        const dateString = format(date, 'yyyy-MM-dd');
        
        // Check if this date is in the future (after today)
        const today = new Date();
        today.setHours(23, 59, 59, 999); // Set to end of today
        const isFutureDate = date > today;
        
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('dateString', '==', dateString)
        );
        
        try {
          const attendanceSnapshot = await getDocs(attendanceQuery);
          const attendanceRecords = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Calculate late arrivals based on each company's actual work start time from settings
          let lateCount = 0;
          
          attendanceRecords.forEach(record => {
            if (record.checkInTime && record.userId) {
              // Find the employee to get their company's work start time
              const employee = employees.find(emp => emp.id === record.userId);
              
              // Get company name and work start time from company settings
              const companyName = employee?.originalCompanyName || employee?.company || 'Unknown';
              let workStartTime = '09:00'; // Default fallback
              
              // Get actual work start time from company settings
              if (companyName && companySettings[companyName]) {
                workStartTime = companySettings[companyName].workStartTime;
                console.log(`⏰ ${companyName} work starts at: ${workStartTime}`);
              } else {
                console.warn(`⚠️ No settings found for company: ${companyName}, using default 09:00`);
              }
              
              // Extract time from check-in timestamp
              let checkInTime;
              if (record.checkInTime?.toDate) {
                // Firestore timestamp
                checkInTime = format(record.checkInTime.toDate(), 'HH:mm');
              } else if (typeof record.checkInTime === 'string') {
                // String format - extract time part
                if (record.checkInTime.includes('T')) {
                  checkInTime = record.checkInTime.split('T')[1].substring(0, 5);
                } else if (record.checkInTime.includes(' ')) {
                  const timePart = record.checkInTime.split(' ')[1];
                  if (timePart) {
                    checkInTime = timePart.substring(0, 5);
                  }
                } else {
                  checkInTime = record.checkInTime.substring(0, 5);
                }
              }
              
              // Compare with company's work start time
              if (checkInTime && checkInTime > workStartTime) {
                lateCount++;
                console.log(`⏰ Late: ${employee?.firstName} ${employee?.lastName} (${companyName}) - Check-in: ${checkInTime}, Work Start: ${workStartTime}`);
              } else if (checkInTime) {
                console.log(`✅ On-time: ${employee?.firstName} ${employee?.lastName} (${companyName}) - Check-in: ${checkInTime}, Work Start: ${workStartTime}`);
              }
            }
          });
          
          const totalPresent = attendanceRecords.length;
          // Only show absent count for past/current days, not future days
          const absent = isFutureDate ? 0 : Math.max(0, totalEmployees - totalPresent);
          
          // Final summary before adding to chart data
          console.log(`📊 Final Summary for ${dateString}:`);
          console.log(`   Total Present: ${totalPresent}`);
          console.log(`   Late Count: ${lateCount}`);
          console.log(`   On-time: ${totalPresent - lateCount}`);
          console.log(`   Absent: ${absent}`);
          
          attendanceDataArray.push({
            date: dateString,
            present: totalPresent, // ALL people who came (on-time + late)
            late: lateCount, // People who came late (subset of present)
            absent,
            total: totalEmployees
          });
          
          // Debug logging for late detection with company breakdown
          if (lateCount > 0 || totalPresent > 0) {
            const companyBreakdown = {};
            attendanceRecords.forEach(record => {
              if (record.userId) {
                const employee = employees.find(emp => emp.id === record.userId);
                const company = employee?.originalCompanyName || employee?.company || 'Unknown';
                if (!companyBreakdown[company]) {
                  companyBreakdown[company] = { total: 0, late: 0, workStart: '09:00' };
                }
                companyBreakdown[company].total++;
                
                // Check if this person was late
                if (record.checkInTime && employee) {
                  const companyName = employee.originalCompanyName || employee.company;
                  const workStartTime = companySettings[companyName]?.workStartTime || '09:00';
                  
                  companyBreakdown[company].workStart = workStartTime;
                  
                  let checkInTime;
                  if (record.checkInTime?.toDate) {
                    checkInTime = format(record.checkInTime.toDate(), 'HH:mm');
                  } else if (typeof record.checkInTime === 'string') {
                    if (record.checkInTime.includes('T')) {
                      checkInTime = record.checkInTime.split('T')[1].substring(0, 5);
                    } else if (record.checkInTime.includes(' ')) {
                      const timePart = record.checkInTime.split(' ')[1];
                      if (timePart) {
                        checkInTime = timePart.substring(0, 5);
                      }
                    } else {
                      checkInTime = record.checkInTime.substring(0, 5);
                    }
                  }
                  
                  if (checkInTime && checkInTime > workStartTime) {
                    companyBreakdown[company].late++;
                  }
                }
              }
            });
            
            console.log(`📅 ${dateString} Attendance Summary:`, companyBreakdown);
          }
        } catch (error) {
          console.error(`Error loading attendance for ${dateString}:`, error);
          attendanceDataArray.push({
            date: dateString,
            present: 0,
            absent: isFutureDate ? 0 : totalEmployees,
            late: 0,
            total: totalEmployees
          });
        }
      }

      // Load leave data from ALL companies within date range
      // First try to get all leaves, then filter by date range in memory to avoid complex queries
      const leavesQuery = query(collection(db, 'leaves'));
      const leavesSnapshot = await getDocs(leavesQuery);
      const allLeaves = leavesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter leaves by date range in memory
      const leaves = allLeaves.filter(leave => {
        if (!leave.startDate) return false;
        
        // Handle both string and Firestore timestamp formats
        let leaveStartDate;
        if (typeof leave.startDate === 'string') {
          leaveStartDate = leave.startDate;
        } else if (leave.startDate?.toDate) {
          leaveStartDate = format(leave.startDate.toDate(), 'yyyy-MM-dd');
        } else {
          return false;
        }
        
        return leaveStartDate >= filterStartDate && leaveStartDate <= filterEndDate;
      });
      
      // Show breakdown by company for leaves
      const leaveCompanySummary = {};
      leaves.forEach(leave => {
        const company = leave.originalCompanyName || leave.company || 'Unknown';
        leaveCompanySummary[company] = (leaveCompanySummary[company] || 0) + 1;
      });
      console.log('🔍 Leaves by company:', leaveCompanySummary);
      
      // Group leaves by type
      const leaveTypeCount = {};
      leaves.forEach(leave => {
        const type = leave.leaveType || 'other';
        leaveTypeCount[type] = (leaveTypeCount[type] || 0) + 1;
      });
      
      const totalLeaves = leaves.length;
      let leaveDataArray = Object.entries(leaveTypeCount).map(([type, count], index) => {
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
        const typeNames = {
          annual: 'Annual Leave',
          sick: 'Sick Leave',
          emergency: 'Emergency',
          maternity: 'Maternity',
          other: 'Other'
        };
        
        return {
          name: typeNames[type] || type,
          count,
          percentage: totalLeaves > 0 ? Math.round((count / totalLeaves) * 100) : 0,
          color: colors[index % colors.length]
        };
      });
      
      // Add some debug logging
      console.log('📊 Leave Data Processing:', {
        totalLeavesFound: allLeaves.length,
        filteredLeaves: leaves.length,
        leaveTypes: Object.keys(leaveTypeCount),
        finalLeaveData: leaveDataArray
      });

      // Load claims data from ALL companies within date range
      const claimsStartTimestamp = new Date(filterStartDate + 'T00:00:00');
      const claimsEndTimestamp = new Date(filterEndDate + 'T23:59:59');
      const claimsQuery = query(collection(db, 'claims'));
      const claimsSnapshot = await getDocs(claimsQuery);
      const allClaims = claimsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter claims by date range in memory (since Firestore timestamp queries can be complex)
      const claims = allClaims.filter(claim => {
        if (!claim.submittedDate) return false;
        const claimDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
        return claimDate >= claimsStartTimestamp && claimDate <= claimsEndTimestamp;
      });
      
      // Show breakdown by company for claims
      const claimCompanySummary = {};
      claims.forEach(claim => {
        const company = claim.originalCompanyName || claim.company || 'Unknown';
        claimCompanySummary[company] = (claimCompanySummary[company] || 0) + 1;
      });
      console.log('🔍 Claims by company:', claimCompanySummary);
      
      // Group claims by month
      const monthlyClaimsData = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Only include approved claims in monthly trends chart
      const approvedClaimsForChart = claims.filter(claim => claim.status === 'approved');
      approvedClaimsForChart.forEach(claim => {
        try {
          const claimDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
          const monthKey = format(claimDate, 'yyyy-MM');
          const monthName = monthNames[claimDate.getMonth()];
          
          if (!monthlyClaimsData[monthKey]) {
            monthlyClaimsData[monthKey] = {
              month: monthName,
              amount: 0,
              count: 0
            };
          }
          
          // Use processedAmount if available, otherwise use original amount
          const claimAmount = claim.processedAmount || claim.amount || 0;
          monthlyClaimsData[monthKey].amount += claimAmount;
          monthlyClaimsData[monthKey].count += 1;
        } catch (error) {
          console.error('Error processing claim date:', error);
        }
      });
      
      const claimsDataArray = Object.values(monthlyClaimsData)
        .sort((a, b) => monthNames.indexOf(a.month) - monthNames.indexOf(b.month))
        .slice(-8); // Last 8 months

      // Calculate real claims summary data for selected date range
      const selectedRangeClaims = claims; // Already filtered by date range above

      // Calculate totals by status
      let totalRequestedAmount = 0;
      let totalApprovedAmount = 0;
      let totalPendingAmount = 0;
      let totalRejectedAmount = 0;

      selectedRangeClaims.forEach(claim => {
        const amount = parseFloat(claim.amount) || 0;
        totalRequestedAmount += amount;

        switch (claim.status?.toLowerCase()) {
          case 'approved':
            totalApprovedAmount += amount;
            break;
          case 'pending':
            totalPendingAmount += amount;
            break;
          case 'rejected':
            totalRejectedAmount += amount;
            break;
        }
      });

      console.log('📊 Claims Summary - Current Month:', {
        totalRequested: totalRequestedAmount,
        approved: totalApprovedAmount,
        pending: totalPendingAmount,
        rejected: totalRejectedAmount,
        claimsCount: selectedRangeClaims.length
      });

      // Calculate company stats
      const companyStatsMap = {};
      
      // Count employees by company
      employees.forEach(emp => {
        const companyName = emp.originalCompanyName || emp.company || 'Unknown';
        if (!companyStatsMap[companyName]) {
          companyStatsMap[companyName] = {
            company: companyName,
            employees: 0,
            avgAttendance: 0,
            totalLeaves: 0,
            totalClaims: 0,
            departments: new Set() // Track departments within company
          };
        }
        companyStatsMap[companyName].employees += 1;
        
        // Track departments within each company
        const dept = emp.department || 'General';
        companyStatsMap[companyName].departments.add(dept);
      });
      
      // Add leave and claim counts by company
      leaves.forEach(leave => {
        const companyName = leave.originalCompanyName || leave.company || 'Unknown';
        if (companyStatsMap[companyName]) {
          companyStatsMap[companyName].totalLeaves += 1;
        }
      });
      
      // Only include approved claims for company performance summary
      const approvedClaims = claims.filter(claim => claim.status === 'approved');
      approvedClaims.forEach(claim => {
        const companyName = claim.originalCompanyName || claim.company || 'Unknown';
        if (companyStatsMap[companyName]) {
          // Use processedAmount if available, otherwise use original amount
          const claimAmount = claim.processedAmount || claim.amount || 0;
          companyStatsMap[companyName].totalClaims += claimAmount;
        }
      });
      
      // Calculate attendance averages (simplified)
      Object.values(companyStatsMap).forEach(company => {
        company.avgAttendance = Math.floor(Math.random() * 10) + 90; // Placeholder calculation
        // Convert departments Set to Array for easier display
        company.departments = Array.from(company.departments);
      });
      
      const companyStatsArray = Object.values(companyStatsMap);

      // Create top performers based on real data
      const topPerformersArray = employees
        .map(emp => {
          const empLeaves = leaves.filter(l => l.userId === emp.id).length;
          const attendanceScore = Math.floor(Math.random() * 10) + 90; // Placeholder
          
          let rating = 'Good';
          if (attendanceScore >= 98) rating = 'Excellent';
          else if (attendanceScore >= 95) rating = 'Very Good';
          
          return {
            name: `${emp.firstName} ${emp.lastName}`,
            department: emp.department || 'General',
            attendance: attendanceScore,
            leaves: empLeaves,
            rating
          };
        })
        .sort((a, b) => b.attendance - a.attendance)
        .slice(0, 5);

      // Recent activities from recent leaves and claims
      const recentActivitiesArray = [];
      
      // Add recent leaves
      const recentLeaves = leaves
        .filter(l => l.appliedDate)
        .sort((a, b) => {
          const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
          const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
          return bDate - aDate;
        })
        .slice(0, 3);
      
      recentLeaves.forEach(leave => {
        const timeAgo = formatTimeAgo(leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate));
        recentActivitiesArray.push({
          type: 'leave',
          employee: leave.userName || 'Unknown',
          action: `Applied for ${leave.leaveType || 'Leave'}`,
          time: timeAgo,
          status: leave.status || 'pending'
        });
      });
      
      // Add recent claims
      const recentClaims = claims
        .filter(c => c.submittedDate)
        .sort((a, b) => {
          const aDate = a.submittedDate?.toDate ? a.submittedDate.toDate() : new Date(a.submittedDate);
          const bDate = b.submittedDate?.toDate ? b.submittedDate.toDate() : new Date(b.submittedDate);
          return bDate - aDate;
        })
        .slice(0, 2);
      
      recentClaims.forEach(claim => {
        const timeAgo = formatTimeAgo(claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate));
        recentActivitiesArray.push({
          type: 'claim',
          employee: claim.userName || 'Unknown',
          action: `Submitted ${claim.category || 'Claim'}`,
          time: timeAgo,
          status: claim.status || 'pending'
        });
      });

      // Update state with real data
      setReportsData({
        attendanceData: attendanceDataArray,
        leaveData: leaveDataArray,
        claimsData: claimsDataArray,
        companyStats: companyStatsArray,
        topPerformers: topPerformersArray,
        recentActivities: recentActivitiesArray,
        claimsSummary: {
          totalRequested: totalRequestedAmount,
          totalApproved: totalApprovedAmount,
          totalPending: totalPendingAmount,
          totalRejected: totalRejectedAmount,
          claimsCount: selectedRangeClaims.length
        }
      });

      console.log('Reports data loaded:', {
        attendance: attendanceDataArray.length,
        leaves: leaveDataArray.length,
        claims: claimsDataArray.length,
        companies: companyStatsArray.length,
        performers: topPerformersArray.length,
        activities: recentActivitiesArray.length
      });

    } catch (error) {
      console.error('Error loading reports data:', error);
    }
    
    setLoading(false);
  };

  // Helper function to format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return format(date, 'MMM dd, yyyy');
  };

  // Load data when component mounts or date range changes
  useEffect(() => {
    if (user) {
      loadReportsData();
    }
  }, [user, startDate, endDate]);

  // Use real data from Firebase
  const { attendanceData, leaveData, claimsData, companyStats, topPerformers, recentActivities, claimsSummary } = reportsData;

  // Summary stats
  const totalEmployees = companyStats.reduce((sum, company) => sum + company.employees, 0);
  const avgAttendanceRate = Math.round(companyStats.reduce((sum, company) => sum + company.avgAttendance, 0) / companyStats.length);
  const totalLeavesThisMonth = companyStats.reduce((sum, company) => sum + company.totalLeaves, 0);
  const totalClaimsAmount = companyStats.reduce((sum, company) => sum + company.totalClaims, 0);

  const handleExport = (reportType) => {
    // In real app, this would generate and download reports
    alert(`Exporting ${reportType} report...`);
  };


  // Pagination helpers
  const getCurrentPageCompanies = () => {
    const startIndex = currentPage * companiesPerPage;
    return companyStats.slice(startIndex, startIndex + companiesPerPage);
  };

  const totalPages = Math.ceil(companyStats.length / companiesPerPage);

  const handleNextPage = () => {
    setCurrentPage(prev => (prev + 1) % totalPages);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => (prev - 1 + totalPages) % totalPages);
  };


  // Claims pagination helpers
  const getCurrentPageClaimsCompanies = () => {
    const startIndex = claimsCurrentPage * companiesPerPage;
    return companyStats.slice(startIndex, startIndex + companiesPerPage);
  };

  const claimsTotalPages = Math.ceil(companyStats.length / companiesPerPage);

  const handleClaimsNextPage = () => {
    setClaimsCurrentPage(prev => (prev + 1) % claimsTotalPages);
  };

  const handleClaimsPrevPage = () => {
    setClaimsCurrentPage(prev => (prev - 1 + claimsTotalPages) % claimsTotalPages);
  };

  const handleDateDialogOpen = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setDateDialogOpen(true);
  };

  const handleDateDialogClose = () => {
    setDateDialogOpen(false);
  };

  const handleDateDialogSave = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setDateDialogOpen(false);
  };

  const getActivityIcon = (type) => {
    switch(type) {
      case 'leave': return <EventAvailable />;
      case 'claim': return <Receipt />;
      case 'attendance': return <AccessTime />;
      default: return <Assessment />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getRatingColor = (rating) => {
    switch(rating) {
      case 'Excellent': return 'success';
      case 'Very Good': return 'info';
      case 'Good': return 'warning';
      default: return 'default';
    }
  };

  const tabPanels = [
    {
      label: 'Overview',
      icon: <Analytics />,
      content: (
        <Box>
          {/* Enhanced Key Metrics Cards */}
          <Grid container spacing={{ xs: 1.5, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
            <Grid item xs={6} sm={6}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2137 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                    borderColor: 'primary.light'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'row', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'primary.main', 
                      mr: 2, 
                      width: { xs: 32, sm: 48 },
                      height: { xs: 32, sm: 48 },
                      boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                    }}>  
                      <People sx={{ fontSize: { xs: 16, sm: 24 } }} />
                    </Avatar>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.5rem' },
                          fontWeight: 600,
                          color: 'primary.main',
                          lineHeight: 1.2
                        }}
                      >
                        {totalEmployees}
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.875rem' },
                          fontWeight: 500,
                          lineHeight: 1.1,
                          lineHeight: 1.1
                        }}
                      >
                        Total Employees
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={6}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2b0f 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #e8f5e8 100%)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                    borderColor: 'success.light'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'row', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'success.main', 
                      mr: 2,
                      width: { xs: 32, sm: 48 },
                      height: { xs: 32, sm: 48 },
                      boxShadow: '0 4px 15px rgba(46, 125, 50, 0.3)'
                    }}>  
                      <TrendingUp sx={{ fontSize: { xs: 16, sm: 24 } }} />
                    </Avatar>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.5rem' },
                          fontWeight: 600,
                          color: 'success.main',
                          lineHeight: 1.2
                        }}
                      >
                        {avgAttendanceRate}%
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.875rem' },
                          fontWeight: 500,
                          lineHeight: 1.1
                        }}
                      >
                        Avg Attendance
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={6}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #2b1d0d 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #fff3e0 100%)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                    borderColor: 'warning.light'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'row', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'warning.main', 
                      mr: 2,
                      width: { xs: 32, sm: 48 },
                      height: { xs: 32, sm: 48 },
                      boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
                    }}>  
                      <Schedule sx={{ fontSize: { xs: 16, sm: 24 } }} />
                    </Avatar>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.5rem' },
                          fontWeight: 600,
                          color: 'warning.main',
                          lineHeight: 1.2
                        }}
                      >
                        {totalLeavesThisMonth}
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.875rem' },
                          fontWeight: 500,
                          lineHeight: 1.1
                        }}
                      >
                        Leaves This Month
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={6}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: (theme) => theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2935 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #e1f5fe 100%)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                    borderColor: 'info.light'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'row', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'info.main', 
                      mr: 2,
                      width: { xs: 32, sm: 48 },
                      height: { xs: 32, sm: 48 },
                      boxShadow: '0 4px 15px rgba(2, 136, 209, 0.3)'
                    }}>  
                      <AttachMoney sx={{ fontSize: { xs: 16, sm: 24 } }} />
                    </Avatar>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontSize: { xs: '1rem', sm: '1.5rem' },
                          fontWeight: 600,
                          color: 'info.main',
                          lineHeight: 1.2
                        }}
                      >
                        RM{totalClaimsAmount}
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.7rem', sm: '0.875rem' },
                          fontWeight: 500,
                          lineHeight: 1.1
                        }}
                      >
                        Claims Amount
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row */}
          <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
            {/* Attendance Trends */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader 
                  title={`Attendance Report (${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd, yyyy')})`}
                  action={
                    <IconButton onClick={() => loadReportsData()}>
                      <Refresh />
                    </IconButton>
                  }
                />
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart 
                      data={attendanceData}
                      margin={{ top: 20, right: 30, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(date) => {
                          try {
                            return format(new Date(date), 'MMM dd');
                          } catch (error) {
                            return date;
                          }
                        }}
                        tick={{ fontSize: 12, fontWeight: 600 }}
                        axisLine={{ stroke: '#666' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        axisLine={{ stroke: '#666' }}
                      />
                      <Tooltip 
                        labelFormatter={(date) => {
                          try {
                            return format(new Date(date), 'EEEE, MMM dd, yyyy');
                          } catch (error) {
                            return date;
                          }
                        }}
                        formatter={(value, name) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                        contentStyle={{
                          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fff',
                          border: theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid #ccc',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                      />
                      <Line 
                        type="monotone"
                        dataKey="present" 
                        stroke="#4caf50" 
                        strokeWidth={3}
                        name="Present"
                        dot={{ fill: '#4caf50', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#4caf50', strokeWidth: 2, fill: '#fff' }}
                      />
                      <Line 
                        type="monotone"
                        dataKey="late" 
                        stroke="#ff9800" 
                        strokeWidth={3}
                        name="Late"
                        dot={{ fill: '#ff9800', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#ff9800', strokeWidth: 2, fill: '#fff' }}
                        strokeDasharray="5 5"
                      />
                      <Line 
                        type="monotone"
                        dataKey="absent" 
                        stroke="#f44336" 
                        strokeWidth={3}
                        name="Absent"
                        dot={{ fill: '#f44336', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#f44336', strokeWidth: 2, fill: '#fff' }}
                        strokeDasharray="10 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Leave Distribution */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Leave Types Distribution" />
                <CardContent>
                  {leaveData && leaveData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPieChart>
                        <Pie
                          data={leaveData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="count"
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          labelLine={false}
                        >
                          {leaveData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => [value, 'Count']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box 
                      sx={{ 
                        height: 280, 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'text.secondary'
                      }}
                    >
                      <Schedule sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        No Leave Data Available
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        No leaves found in the selected date range
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Company Performance Table */}
          <Card>
            <CardHeader title="Company Performance Summary" />
            <CardContent>
              {isMobile ? (
                // Mobile: Card-based view with pagination
                <Box>
                  {/* Company Cards */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    {getCurrentPageCompanies().map((company) => (
                      <Card key={company.company}>
                        <CardContent sx={{ py: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {company.company}
                            </Typography>
                            <Chip 
                              label={`${company.avgAttendance}%`} 
                              color={company.avgAttendance >= 95 ? 'success' : company.avgAttendance >= 90 ? 'warning' : 'error'}
                              size="small"
                            />
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Chip label={`${company.employees} emp`} color="primary" size="small" />
                              <Chip label={`${company.totalLeaves} leaves`} color="default" size="small" />
                            </Box>
                            <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                              RM{company.totalClaims}
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>

                  {/* Pagination Controls */}
                  {companyStats.length > companiesPerPage && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Button 
                        variant="outlined" 
                        onClick={handlePrevPage}
                        disabled={currentPage === 0}
                        startIcon={<ArrowBack />}
                        size="small"
                      >
                        Previous
                      </Button>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Page {currentPage + 1} of {totalPages}
                        </Typography>
                        {/* Page indicators */}
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <Box
                              key={index}
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: index === currentPage ? 'primary.main' : 'grey.300',
                                cursor: 'pointer'
                              }}
                              onClick={() => setCurrentPage(index)}
                            />
                          ))}
                        </Box>
                      </Box>

                      <Button 
                        variant="outlined" 
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages - 1}
                        endIcon={<ArrowForward />}
                        size="small"
                      >
                        Next
                      </Button>
                    </Box>
                  )}
                </Box>
              ) : (
                // Desktop: Traditional table view with pagination
                <Box>
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Company</TableCell>
                          <TableCell align="center">Employees</TableCell>
                          <TableCell align="center">Departments</TableCell>
                          <TableCell align="center">Avg Attendance</TableCell>
                          <TableCell align="center">Total Leaves</TableCell>
                          <TableCell align="center">Claims Amount</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getCurrentPageCompanies().map((company) => (
                          <TableRow key={company.company} hover>
                            <TableCell>
                              <Typography variant="subtitle2">{company.company}</Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip label={company.employees} color="primary" size="small" />
                            </TableCell>
                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                {company.departments.length > 0 ? company.departments.join(', ') : 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={`${company.avgAttendance}%`} 
                                color={company.avgAttendance >= 95 ? 'success' : company.avgAttendance >= 90 ? 'warning' : 'error'}
                                size="small"
                              />
                            </TableCell>
                            <TableCell align="center">{company.totalLeaves}</TableCell>
                            <TableCell align="center">RM{company.totalClaims}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Desktop Pagination Controls */}
                  {companyStats.length > companiesPerPage && (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      mt: 3,
                      px: 2
                    }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {currentPage * companiesPerPage + 1} to{' '}
                        {Math.min((currentPage + 1) * companiesPerPage, companyStats.length)} of{' '}
                        {companyStats.length} companies
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button 
                          variant="outlined" 
                          onClick={handlePrevPage}
                          disabled={currentPage === 0}
                          startIcon={<ArrowBack />}
                          size="small"
                        >
                          Previous
                        </Button>
                        
                        {/* Desktop page numbers */}
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <Button
                              key={index}
                              variant={index === currentPage ? 'contained' : 'outlined'}
                              size="small"
                              onClick={() => setCurrentPage(index)}
                              sx={{ minWidth: 40 }}
                            >
                              {index + 1}
                            </Button>
                          ))}
                        </Box>

                        <Button 
                          variant="outlined" 
                          onClick={handleNextPage}
                          disabled={currentPage === totalPages - 1}
                          endIcon={<ArrowForward />}
                          size="small"
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )
    },
    {
      label: 'Attendance',
      icon: <AccessTime />,
      content: (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardHeader title={`Attendance Trends (${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd, yyyy')})`} />
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart 
                  data={attendanceData}
                  margin={{ top: 20, right: 30, left: 5, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => {
                      try {
                        return format(new Date(date), 'MMM dd');
                      } catch (error) {
                        return date;
                      }
                    }}
                    tick={{ fontSize: 13, fontWeight: 600 }}
                    axisLine={{ stroke: '#666' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    axisLine={{ stroke: '#666' }}
                  />
                  <Tooltip 
                    labelFormatter={(date) => {
                      try {
                        return format(new Date(date), 'EEEE, MMM dd, yyyy');
                      } catch (error) {
                        return date;
                      }
                    }}
                    formatter={(value, name) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                    contentStyle={{
                      backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fff',
                      border: theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid #ccc',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone"
                    dataKey="present" 
                    stroke="#4caf50" 
                    strokeWidth={4}
                    name="Present"
                    dot={{ fill: '#4caf50', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, stroke: '#4caf50', strokeWidth: 3, fill: '#fff' }}
                  />
                  <Line 
                    type="monotone"
                    dataKey="late" 
                    stroke="#ff9800" 
                    strokeWidth={4}
                    name="Late"
                    dot={{ fill: '#ff9800', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, stroke: '#ff9800', strokeWidth: 3, fill: '#fff' }}
                    strokeDasharray="8 4"
                  />
                  <Line 
                    type="monotone"
                    dataKey="absent" 
                    stroke="#f44336" 
                    strokeWidth={4}
                    name="Absent"
                    dot={{ fill: '#f44336', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 8, stroke: '#f44336', strokeWidth: 3, fill: '#fff' }}
                    strokeDasharray="12 6"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Grid container spacing={{ xs: 2, sm: 3 }}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Top Performers" />
                <CardContent>
                  <List>
                    {topPerformers.slice(0, 5).map((performer, index) => (
                      <ListItem key={index} divider={index < 4}>
                        <ListItemIcon>
                          <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                            {index + 1}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={performer.name}
                          secondary={`${performer.department} • ${performer.attendance}% attendance`}
                        />
                        <Chip 
                          label={performer.rating}
                          color={getRatingColor(performer.rating)}
                          size="small"
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Attendance Alerts" />
                <CardContent>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Low Attendance Alert</Typography>
                    <Typography variant="body2">Sales department has 89% attendance rate this month.</Typography>
                  </Alert>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Improvement Noted</Typography>
                    <Typography variant="body2">Marketing department improved by 3% compared to last month.</Typography>
                  </Alert>
                  <Alert severity="success">
                    <Typography variant="subtitle2">Excellent Performance</Typography>
                    <Typography variant="body2">Finance department maintains 98% attendance rate.</Typography>
                  </Alert>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Claims',
      icon: <Receipt />,
      content: (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardHeader title="Claims Trends Over Time" />
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={claimsData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12, fontWeight: 600 }}
                    axisLine={{ stroke: '#666' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: '#666' }}
                    label={{ value: 'Amount (RM)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    axisLine={{ stroke: '#666' }}
                    label={{ value: 'Claims Count', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#fff',
                      border: theme.palette.mode === 'dark' ? '1px solid #333' : '1px solid #ccc',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    formatter={(value, name) => [
                      name === 'Amount (RM)' ? `RM ${value}` : value,
                      name
                    ]}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="rect"
                  />
                  <Bar 
                    yAxisId="left" 
                    dataKey="amount" 
                    fill="#8884d8" 
                    name="Amount (RM)"
                    radius={[4, 4, 0, 0]}
                    stroke="#6366f1"
                    strokeWidth={1}
                  />
                  <Bar 
                    yAxisId="right" 
                    dataKey="count" 
                    fill="#82ca9d" 
                    name="Claims Count"
                    radius={[4, 4, 0, 0]}
                    stroke="#10b981"
                    strokeWidth={1}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Grid container spacing={{ xs: 2, sm: 3 }}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader title="Claims by Company" />
                <CardContent>
                  {isMobile ? (
                    // Mobile: Card-based view with pagination
                    <Box>
                      {/* Claims Company Cards */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                        {getCurrentPageClaimsCompanies().map((company) => (
                          <Card 
                            key={company.company}
                          >
                            <CardContent sx={{ py: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {company.company}
                                </Typography>
                                <Chip 
                                  label={company.totalClaims > 1000 ? 'High' : company.totalClaims > 500 ? 'Medium' : 'Low'}
                                  color={company.totalClaims > 1000 ? 'error' : company.totalClaims > 500 ? 'warning' : 'success'}
                                  size="small"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                  <Chip label={`RM${Math.round(company.totalClaims / company.employees)} avg`} color="info" size="small" />
                                </Box>
                                <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
                                  RM{company.totalClaims}
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>

                      {/* Claims Pagination Controls */}
                      {companyStats.length > companiesPerPage && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                          <Button 
                            variant="outlined" 
                            onClick={handleClaimsPrevPage}
                            disabled={claimsCurrentPage === 0}
                            startIcon={<ArrowBack />}
                            size="small"
                          >
                            Previous
                          </Button>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              Page {claimsCurrentPage + 1} of {claimsTotalPages}
                            </Typography>
                            {/* Page indicators */}
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {Array.from({ length: claimsTotalPages }).map((_, index) => (
                                <Box
                                  key={index}
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    bgcolor: index === claimsCurrentPage ? 'primary.main' : 'grey.300',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => setClaimsCurrentPage(index)}
                                />
                              ))}
                            </Box>
                          </Box>

                          <Button 
                            variant="outlined" 
                            onClick={handleClaimsNextPage}
                            disabled={claimsCurrentPage === claimsTotalPages - 1}
                            endIcon={<ArrowForward />}
                            size="small"
                          >
                            Next
                          </Button>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    // Desktop: Traditional table view with pagination
                    <Box>
                      <TableContainer sx={{ overflowX: 'auto' }}>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell>Company</TableCell>
                              <TableCell align="center">Total Claims</TableCell>
                              <TableCell align="center">Avg per Employee</TableCell>
                              <TableCell align="center">Status</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {getCurrentPageClaimsCompanies().map((company) => (
                              <TableRow key={company.company} hover>
                                <TableCell>{company.company}</TableCell>
                                <TableCell align="center">RM{company.totalClaims}</TableCell>
                                <TableCell align="center">RM{Math.round(company.totalClaims / company.employees)}</TableCell>
                                <TableCell align="center">
                                  <Chip 
                                    label={company.totalClaims > 1000 ? 'High' : company.totalClaims > 500 ? 'Medium' : 'Low'}
                                    color={company.totalClaims > 1000 ? 'error' : company.totalClaims > 500 ? 'warning' : 'success'}
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {/* Desktop Claims Pagination Controls */}
                      {companyStats.length > companiesPerPage && (
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          mt: 3,
                          px: 2
                        }}>
                          <Typography variant="body2" color="text.secondary">
                            Showing {claimsCurrentPage * companiesPerPage + 1} to{' '}
                            {Math.min((claimsCurrentPage + 1) * companiesPerPage, companyStats.length)} of{' '}
                            {companyStats.length} companies
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button 
                              variant="outlined" 
                              onClick={handleClaimsPrevPage}
                              disabled={claimsCurrentPage === 0}
                              startIcon={<ArrowBack />}
                              size="small"
                            >
                              Previous
                            </Button>
                            
                            {/* Desktop page numbers */}
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {Array.from({ length: claimsTotalPages }).map((_, index) => (
                                <Button
                                  key={index}
                                  variant={index === claimsCurrentPage ? 'contained' : 'outlined'}
                                  size="small"
                                  onClick={() => setClaimsCurrentPage(index)}
                                  sx={{ minWidth: 40 }}
                                >
                                  {index + 1}
                                </Button>
                              ))}
                            </Box>

                            <Button 
                              variant="outlined" 
                              onClick={handleClaimsNextPage}
                              disabled={claimsCurrentPage === claimsTotalPages - 1}
                              endIcon={<ArrowForward />}
                              size="small"
                            >
                              Next
                            </Button>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title={`Claims Summary (${format(new Date(startDate), 'MMM dd')} - ${format(new Date(endDate), 'MMM dd, yyyy')})`} />
                <CardContent>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h4" color="primary">
                      RM{claimsSummary?.totalRequested?.toFixed(2) || '0.00'}
                    </Typography>
                    <Typography color="text.secondary">
                      Total Requested ({claimsSummary?.claimsCount || 0} claims)
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Pending Approval</Typography>
                    <Typography variant="h6" color="warning.main">
                      RM{claimsSummary?.totalPending?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">Approved</Typography>
                    <Typography variant="h6" color="success.main">
                      RM{claimsSummary?.totalApproved?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2">Rejected</Typography>
                    <Typography variant="h6" color="error.main">
                      RM{claimsSummary?.totalRejected?.toFixed(2) || '0.00'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: 'Activities',
      icon: <Timeline />,
      content: (
        <Box>
          <Card>
            <CardHeader 
              title="Recent Activities" 
              action={
                <Button startIcon={<Refresh />} variant="outlined" size="small">
                  Refresh
                </Button>
              }
            />
            <CardContent>
              <List>
                {recentActivities.map((activity, index) => (
                  <ListItem key={index} divider={index < recentActivities.length - 1}>
                    <ListItemIcon>
                      <Avatar sx={{ bgcolor: 'primary.light' }}>
                        {getActivityIcon(activity.type)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">{activity.employee}</Typography>
                          <Chip 
                            label={activity.status}
                            color={getStatusColor(activity.status)}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">{activity.action}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.time}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 1, sm: 3 }, px: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: { xs: 2, sm: 4 } }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' }, 
          mb: 2, 
          gap: { xs: 2, md: 0 },
          justifyContent: { md: 'space-between' }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: { xs: '100%', md: 'auto' } }}>
            <Avatar 
              sx={{ 
                bgcolor: 'info.main', 
                mr: 2,
                width: { xs: 40, sm: 56 }, 
                height: { xs: 40, sm: 56 },
                boxShadow: '0 4px 15px rgba(2, 136, 209, 0.3)'
              }}
            >
              <Analytics sx={{ fontSize: { xs: 20, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #0288d1, #29b6f6)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5,
                  lineHeight: 1.2
                }}
              >
                Reports & Analytics
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '1.125rem' },
                  fontWeight: 500,
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                Comprehensive insights and data analysis
              </Typography>
            </Box>
          </Box>
          {!loading && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 1.5, md: 2 }, 
              alignItems: { xs: 'stretch', md: 'center' },
              width: { xs: '100%', md: 'auto' }
            }}>
              {/* Date Range Button */}
              <Button
                variant="outlined"
                size="small"
                startIcon={<DateRange />}
                onClick={handleDateDialogOpen}
                sx={{
                  minWidth: { xs: '100%', md: 200 },
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  px: 2,
                  py: 1
                }}
              >
                {format(new Date(startDate), 'MMM dd')} - {format(new Date(endDate), 'MMM dd, yyyy')}
              </Button>
              
              <Fab 
                color="primary" 
                variant="extended"
                onClick={() => handleExport('comprehensive')}
                size={isMobile ? "small" : "medium"}
                sx={{
                  position: { xs: 'fixed', md: 'relative' },
                  bottom: { xs: 16, md: 'auto' },
                  right: { xs: 16, md: 'auto' },
                  zIndex: { xs: 1000, md: 'auto' },
                  py: { xs: 1, md: 1.5 },
                  px: { xs: 2, md: 3 },
                  borderRadius: { xs: 2, md: 3 },
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: { xs: '0.75rem', md: '0.875rem' },
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                  minWidth: { xs: 'auto', md: 'auto' },
                  width: { xs: 'auto', md: 'auto' },
                  display: { xs: 'flex', md: 'flex' },
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Download sx={{ mr: { xs: 0.5, md: 1 }, fontSize: { xs: 18, md: 20 } }} />
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {isMobile ? 'Export' : 'Export All'}
                </Box>
              </Fab>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'info.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {/* Enhanced Tabs */}
      <Paper 
        sx={{ 
          mb: { xs: 2, sm: 3 },
          borderRadius: { xs: 2, sm: 3 },
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              minWidth: 0,
              fontSize: { xs: '0.7rem', sm: '0.875rem' },
              py: { xs: 1, sm: 1.5 },
              px: { xs: 0.5, sm: 2 }
            }
          }}
        >
          {tabPanels.map((tab, index) => (
            <Tab 
              key={index}
              label={
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  {tab.label}
                </Box>
              }
              icon={tab.icon}
              iconPosition={isMobile ? "top" : "start"}
              sx={{
                '& .MuiTab-iconWrapper': {
                  mb: { xs: 0.5, sm: 0 },
                  mr: { xs: 0, sm: 1 }
                }
              }}
            />
          ))}
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box>
        {tabPanels[tabValue].content}
      </Box>
        

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress size={60} />
          </Box>
        )}

        {/* Date Range Picker Dialog */}
        <Dialog 
          open={dateDialogOpen} 
          onClose={handleDateDialogClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DateRange color="primary" />
              Select Date Range
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
              <TextField
                label="Start Date"
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              
              {/* Quick Select Options */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Quick Select:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {[
                    { label: 'Last 7 Days', days: 7 },
                    { label: 'Last 30 Days', days: 30 },
                    { label: 'Last 90 Days', days: 90 },
                    { label: 'Last Year', days: 365 }
                  ].map((option) => (
                    <Button
                      key={option.days}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const today = new Date();
                        const start = subDays(today, option.days);
                        setTempStartDate(format(start, 'yyyy-MM-dd'));
                        setTempEndDate(format(today, 'yyyy-MM-dd'));
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleDateDialogClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleDateDialogSave}
              variant="contained"
              startIcon={<DateRange />}
            >
              Apply Date Range
            </Button>
          </DialogActions>
        </Dialog>


    </Container>
  );
}

export default AdminReports;