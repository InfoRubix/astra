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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  CircularProgress,
  InputAdornment,
  Stack,
  Tabs,
  Tab,
  Fade,
  Slide,
  Fab
} from '@mui/material';
import { 
  TrendingUp,
  TrendingDown,
  Business,
  People,
  Assessment,
  Refresh,
  CheckCircle,
  Warning,
  PersonSearch,
  Search,
  Clear,
  Download,
  BarChart,
  Timeline as TimelineIcon,
  Close,
  Work,
  EmojiEvents,
  Groups,
  CalendarToday,
  Analytics,
  ArrowForward,
  ArrowBack
} from '@mui/icons-material';
import { 
  BarChart as RechartsBarChart, 
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

function CompanyPerformance() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('performance');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const companiesPerPage = 4;

  useEffect(() => {
    if (user) {
      loadCompanyPerformanceData();
    }
  }, [user, selectedPeriod]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, performanceFilter, sortBy, sortOrder]);

  // Helper function to get employee's company consistently
  const getEmployeeCompany = (employee) => {
    return employee.company || employee.originalCompanyName || 'RUBIX';
  };

  // Filter and search functionality
  const getFilteredAndSortedData = () => {
    let filteredData = companyData;

    // Filter by performance level
    if (performanceFilter !== 'all') {
      if (performanceFilter === 'excellent') {
        filteredData = filteredData.filter(comp => comp.overallScore >= 90);
      } else if (performanceFilter === 'good') {
        filteredData = filteredData.filter(comp => comp.overallScore >= 80 && comp.overallScore < 90);
      } else if (performanceFilter === 'average') {
        filteredData = filteredData.filter(comp => comp.overallScore >= 70 && comp.overallScore < 80);
      } else if (performanceFilter === 'poor') {
        filteredData = filteredData.filter(comp => comp.overallScore < 70);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredData = filteredData.filter(comp => 
        comp.companyName.toLowerCase().includes(query)
      );
    }

    // Sort data
    filteredData.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.companyName.toLowerCase();
          bValue = b.companyName.toLowerCase();
          break;
        case 'employees':
          aValue = a.totalEmployees;
          bValue = b.totalEmployees;
          break;
        case 'attendance':
          aValue = a.avgAttendanceRate;
          bValue = b.avgAttendanceRate;
          break;
        case 'performance':
        default:
          aValue = a.overallScore;
          bValue = b.overallScore;
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filteredData;
  };

  const filteredCompanyData = getFilteredAndSortedData();

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setPerformanceFilter('all');
    setSortBy('performance');
    setSortOrder('desc');
    setCurrentPage(0);
  };

  // Pagination helpers
  const getCurrentPageCompanies = () => {
    const startIndex = safePage * companiesPerPage;
    return filteredCompanyData.slice(startIndex, startIndex + companiesPerPage);
  };

  const totalPages = Math.max(1, Math.ceil(filteredCompanyData.length / companiesPerPage));
  
  // Ensure currentPage doesn't exceed available pages
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));

  const handleNextPage = () => {
    if (totalPages > 1) {
      const nextPage = (safePage + 1) % totalPages;
      setCurrentPage(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (totalPages > 1) {
      const prevPage = (safePage - 1 + totalPages) % totalPages;
      setCurrentPage(prevPage);
    }
  };

  const loadCompanyPerformanceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Loading company performance data...');
      
      // Load all employees (exclude admins)
      const usersQuery = query(
        collection(db, 'users')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const employees = allUsers.filter(u => u.role !== 'admin');
      
      console.log('👥 Total employees found:', employees.length);

      // Load attendance data
      const attendanceQuery = query(
        collection(db, 'attendance')
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📅 Attendance records loaded:', attendanceRecords.length);

      // Load leave data
      const leavesQuery = query(
        collection(db, 'leaves')
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const leaveRecords = leavesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        appliedDate: doc.data().appliedDate?.toDate ? doc.data().appliedDate.toDate() : 
                     doc.data().appliedDate ? new Date(doc.data().appliedDate) : new Date(),
        startDate: doc.data().startDate?.toDate ? doc.data().startDate.toDate() : 
                   doc.data().startDate ? new Date(doc.data().startDate) : new Date(),
        endDate: doc.data().endDate?.toDate ? doc.data().endDate.toDate() : 
                 doc.data().endDate ? new Date(doc.data().endDate) : new Date()
      }));
      console.log('🏖️ Leave records loaded:', leaveRecords.length);

      // Calculate date range based on selected period
      const endDate = new Date();
      let startDate;
      let totalWorkingDays;
      
      switch (selectedPeriod) {
        case 'week':
          startDate = subDays(endDate, 7);
          totalWorkingDays = 5;
          break;
        case 'quarter':
          startDate = subMonths(endDate, 3);
          totalWorkingDays = 65;
          break;
        case 'year':
          startDate = subMonths(endDate, 12);
          totalWorkingDays = 260;
          break;
        default: // month
          startDate = startOfMonth(endDate);
          totalWorkingDays = 22;
      }

      // Group employees by company
      const companiesMap = new Map();
      employees.forEach(employee => {
        const companyName = getEmployeeCompany(employee);
        if (!companiesMap.has(companyName)) {
          companiesMap.set(companyName, []);
        }
        companiesMap.get(companyName).push(employee);
      });

      // Calculate performance metrics for each company
      const companyMetrics = Array.from(companiesMap.entries()).map(([companyName, companyEmployees]) => {
        let totalAttendanceRate = 0;
        let totalPresentDays = 0;
        let totalAbsentDays = 0;
        let totalLeaves = 0;
        let totalApprovedLeaves = 0;
        let employeesWithData = 0;

        companyEmployees.forEach(employee => {
          // Filter attendance data by date range
          const employeeAttendance = attendanceRecords.filter(record => {
            try {
              if (record.userId !== employee.id) return false;
              
              let recordDate;
              if (record.dateString) {
                recordDate = new Date(record.dateString);
              } else if (record.date) {
                recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
              } else if (record.createdAt) {
                recordDate = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
              } else {
                return false;
              }
              
              return recordDate >= startDate && recordDate <= endDate;
            } catch (error) {
              return false;
            }
          });

          const employeeLeaves = leaveRecords.filter(record => {
            try {
              if (record.userId !== employee.id) return false;
              return record.appliedDate >= startDate && record.appliedDate <= endDate;
            } catch (error) {
              return false;
            }
          });

          const presentDays = employeeAttendance.length;
          const attendanceRate = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
          const leaves = employeeLeaves.length;
          const approvedLeaves = employeeLeaves.filter(l => l.status === 'approved').length;

          if (presentDays > 0 || leaves > 0) {
            employeesWithData++;
          }

          totalAttendanceRate += attendanceRate;
          totalPresentDays += presentDays;
          totalAbsentDays += Math.max(0, totalWorkingDays - presentDays);
          totalLeaves += leaves;
          totalApprovedLeaves += approvedLeaves;
        });

        const avgAttendanceRate = companyEmployees.length > 0 ? 
          Math.round(totalAttendanceRate / companyEmployees.length) : 0;

        // Calculate overall performance score
        // Based on: Attendance (60%), Leave management (20%), Employee engagement (20%)
        let overallScore = 0;
        
        // Attendance component (60%)
        overallScore += avgAttendanceRate * 0.6;
        
        // Leave management component (20%) - reasonable leave usage is good
        const leaveRatio = totalWorkingDays > 0 ? (totalApprovedLeaves / (companyEmployees.length * totalWorkingDays)) * 100 : 0;
        const optimalLeaveRatio = 12; // 12% is considered optimal
        const leaveScore = Math.max(0, 100 - Math.abs(leaveRatio - optimalLeaveRatio) * 2);
        overallScore += leaveScore * 0.2;
        
        // Employee engagement component (20%) - based on data completeness and consistency
        const engagementScore = companyEmployees.length > 0 ? 
          Math.min(100, (employeesWithData / companyEmployees.length) * 100) : 0;
        overallScore += engagementScore * 0.2;

        overallScore = Math.min(100, Math.max(0, Math.round(overallScore)));

        // Determine performance status
        let performanceStatus = 'Poor';
        let statusColor = 'error';
        if (overallScore >= 90) {
          performanceStatus = 'Excellent';
          statusColor = 'success';
        } else if (overallScore >= 80) {
          performanceStatus = 'Good';
          statusColor = 'info';
        } else if (overallScore >= 70) {
          performanceStatus = 'Average';
          statusColor = 'warning';
        }

        // Calculate trend (comparing with previous period)
        const prevStartDate = selectedPeriod === 'week' ? subDays(startDate, 7) :
                             selectedPeriod === 'quarter' ? subMonths(startDate, 3) :
                             selectedPeriod === 'year' ? subMonths(startDate, 12) :
                             subMonths(startDate, 1);
        
        let prevTotalAttendanceRate = 0;
        companyEmployees.forEach(employee => {
          const prevAttendance = attendanceRecords.filter(record => {
            try {
              if (record.userId !== employee.id) return false;
              
              let recordDate;
              if (record.dateString) {
                recordDate = new Date(record.dateString);
              } else if (record.date) {
                recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
              } else {
                return false;
              }
              
              return recordDate >= prevStartDate && recordDate < startDate;
            } catch (error) {
              return false;
            }
          }).length;

          const prevAttendanceRate = totalWorkingDays > 0 ? Math.round((prevAttendance / totalWorkingDays) * 100) : 0;
          prevTotalAttendanceRate += prevAttendanceRate;
        });

        const prevAvgAttendanceRate = companyEmployees.length > 0 ? 
          Math.round(prevTotalAttendanceRate / companyEmployees.length) : 0;
        const trend = avgAttendanceRate - prevAvgAttendanceRate;

        return {
          companyName,
          totalEmployees: companyEmployees.length,
          employeesWithData,
          avgAttendanceRate,
          totalPresentDays,
          totalAbsentDays,
          totalLeaves,
          totalApprovedLeaves,
          overallScore,
          performanceStatus,
          statusColor,
          trend,
          // Additional metrics for charts
          excellentEmployees: companyEmployees.filter(emp => {
            const empAttendance = attendanceRecords.filter(r => r.userId === emp.id);
            const empRate = totalWorkingDays > 0 ? Math.round((empAttendance.length / totalWorkingDays) * 100) : 0;
            return empRate >= 95;
          }).length,
          goodEmployees: companyEmployees.filter(emp => {
            const empAttendance = attendanceRecords.filter(r => r.userId === emp.id);
            const empRate = totalWorkingDays > 0 ? Math.round((empAttendance.length / totalWorkingDays) * 100) : 0;
            return empRate >= 85 && empRate < 95;
          }).length,
          poorEmployees: companyEmployees.filter(emp => {
            const empAttendance = attendanceRecords.filter(r => r.userId === emp.id);
            const empRate = totalWorkingDays > 0 ? Math.round((empAttendance.length / totalWorkingDays) * 100) : 0;
            return empRate < 70;
          }).length
        };
      });

      // Sort by overall score (highest first)
      companyMetrics.sort((a, b) => b.overallScore - a.overallScore);
      
      if (companyMetrics.length === 0) {
        setError('No company performance data available.');
      } else {
        setError('');
        console.log(`📈 ${companyMetrics.length} companies analyzed`);
      }

      setCompanyData(companyMetrics);
      console.log('✅ Company performance data calculated for', companyMetrics.length, 'companies');

    } catch (error) {
      console.error('❌ Error loading company performance data:', error);
      setError('Failed to load company performance data: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleViewDetails = (company) => {
    setSelectedCompany(company);
    setDetailDialog(true);
  };

  const getPerformanceIcon = (status) => {
    switch (status) {
      case 'Excellent': return <CheckCircle />;
      case 'Good': return <Assessment />;
      case 'Average': return <BarChart />;
      default: return <Warning />;
    }
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp color="success" />;
    if (trend < 0) return <TrendingDown color="error" />;
    return <TimelineIcon color="action" />;
  };

  // Summary statistics
  const totalCompanies = companyData.length;
  const avgOverallScore = companyData.length > 0 ? 
    Math.round(companyData.reduce((sum, comp) => sum + comp.overallScore, 0) / companyData.length) : 0;
  const excellentCompanies = companyData.filter(comp => comp.overallScore >= 90).length;
  const poorCompanies = companyData.filter(comp => comp.overallScore < 70).length;
  const totalEmployees = companyData.reduce((sum, comp) => sum + comp.totalEmployees, 0);

  // Chart data
  const performanceDistributionData = [
    { name: 'Excellent (90%+)', value: excellentCompanies, color: '#4caf50' },
    { name: 'Good (80-89%)', value: companyData.filter(comp => comp.overallScore >= 80 && comp.overallScore < 90).length, color: '#2196f3' },
    { name: 'Average (70-79%)', value: companyData.filter(comp => comp.overallScore >= 70 && comp.overallScore < 80).length, color: '#ff9800' },
    { name: 'Poor (<70%)', value: poorCompanies, color: '#f44336' }
  ];

  const topCompaniesData = companyData.slice(0, 5).map(comp => ({
    name: comp.companyName.length > 15 ? comp.companyName.substring(0, 15) + '...' : comp.companyName,
    score: comp.overallScore,
    attendance: comp.avgAttendanceRate
  }));

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
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
                bgcolor: 'primary.main', 
                mr: 2,
                width: { xs: 40, sm: 56 }, 
                height: { xs: 40, sm: 56 },
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}
            >
              <Business sx={{ fontSize: { xs: 20, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5,
                  lineHeight: 1.2
                }}
              >
                Company Performance
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
                Compare and analyze company-wide performance metrics
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
              <Fab 
                color="primary" 
                variant="extended"
                onClick={() => {}} // Add export functionality
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
            bgcolor: 'primary.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {/* Search and Filter Controls */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          {/* Search Bar */}
          <TextField
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            size={isMobile ? "small" : "medium"}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton onClick={() => setSearchQuery('')} size="small">
                    <Clear />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* Filter Controls */}
          {isMobile ? (
            // Mobile: Stacked layout
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    label="Period"
                  >
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="month">Month</MenuItem>
                    <MenuItem value="quarter">Quarter</MenuItem>
                    <MenuItem value="year">Year</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" fullWidth>
                  <InputLabel>Performance</InputLabel>
                  <Select
                    value={performanceFilter}
                    onChange={(e) => setPerformanceFilter(e.target.value)}
                    label="Performance"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="excellent">Excellent</MenuItem>
                    <MenuItem value="good">Good</MenuItem>
                    <MenuItem value="average">Average</MenuItem>
                    <MenuItem value="poor">Poor</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    label="Sort By"
                  >
                    <MenuItem value="performance">Score</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="employees">Employees</MenuItem>
                    <MenuItem value="attendance">Attendance</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Order</InputLabel>
                  <Select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    label="Order"
                  >
                    <MenuItem value="desc">High to Low</MenuItem>
                    <MenuItem value="asc">Low to High</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Button 
                variant="outlined" 
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!searchQuery && performanceFilter === 'all'}
                fullWidth
                size="small"
              >
                Clear Filters
              </Button>
            </Box>
          ) : (
            // Desktop: Horizontal layout
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  label="Period"
                >
                  <MenuItem value="week">This Week</MenuItem>
                  <MenuItem value="month">This Month</MenuItem>
                  <MenuItem value="quarter">This Quarter</MenuItem>
                  <MenuItem value="year">This Year</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Performance</InputLabel>
                <Select
                  value={performanceFilter}
                  onChange={(e) => setPerformanceFilter(e.target.value)}
                  label="Performance"
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="excellent">Excellent (90%+)</MenuItem>
                  <MenuItem value="good">Good (80-89%)</MenuItem>
                  <MenuItem value="average">Average (70-79%)</MenuItem>
                  <MenuItem value="poor">Poor (&lt;70%)</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="performance">Performance Score</MenuItem>
                  <MenuItem value="name">Company Name</MenuItem>
                  <MenuItem value="employees">Employee Count</MenuItem>
                  <MenuItem value="attendance">Attendance Rate</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  label="Order"
                >
                  <MenuItem value="desc">High to Low</MenuItem>
                  <MenuItem value="asc">Low to High</MenuItem>
                </Select>
              </FormControl>
              
              <Button 
                variant="outlined" 
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!searchQuery && performanceFilter === 'all'}
              >
                Clear Filters
              </Button>
            </Box>
          )}

          {/* Results Summary */}
          {(searchQuery || performanceFilter !== 'all') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredCompanyData.length} of {companyData.length} companies
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={60} />
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'primary.main', 
                      mr: { xs: 0, sm: 2 }, 
                      mb: { xs: 1, sm: 0 }
                    }}>  
                      <Business />
                    </Avatar>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography variant="h5" color="primary.main" fontWeight={600}>
                        {totalCompanies}
                      </Typography>
                      <Typography color="text.secondary" fontSize="0.875rem">
                        Total Companies
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'secondary.main', 
                      mr: { xs: 0, sm: 2 }, 
                      mb: { xs: 1, sm: 0 }
                    }}>  
                      <Assessment />
                    </Avatar>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography variant="h5" color="secondary.main" fontWeight={600}>
                        {avgOverallScore}%
                      </Typography>
                      <Typography color="text.secondary" fontSize="0.875rem">
                        Avg Performance
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'success.main', 
                      mr: { xs: 0, sm: 2 }, 
                      mb: { xs: 1, sm: 0 }
                    }}>  
                      <CheckCircle />
                    </Avatar>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography variant="h5" color="success.main" fontWeight={600}>
                        {excellentCompanies}
                      </Typography>
                      <Typography color="text.secondary" fontSize="0.875rem">
                        Excellent (90%+)
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Card sx={{ height: '100%', borderRadius: 3, boxShadow: 3 }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'info.main', 
                      mr: { xs: 0, sm: 2 }, 
                      mb: { xs: 1, sm: 0 }
                    }}>  
                      <People />
                    </Avatar>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography variant="h5" color="info.main" fontWeight={600}>
                        {totalEmployees}
                      </Typography>
                      <Typography color="text.secondary" fontSize="0.875rem">
                        Total Employees
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top 5 Companies Performance
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={topCompaniesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, '']} />
                      <Legend />
                      <Bar dataKey="score" fill="#1f86edff" name="Overall Score" />
                      <Bar dataKey="attendance" fill="#1a38baff" name="Attendance Rate" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Distribution
                  </Typography>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={performanceDistributionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => value > 0 ? `${value}` : ''}
                      >
                        {performanceDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Company Overview */}
          <Paper sx={{ borderRadius: 3, boxShadow: 3, overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Company Performance Overview ({filteredCompanyData.length} companies)
              </Typography>
            </Box>
            <Divider />
            
            {isMobile ? (
              // Mobile: Card-based view
              <Box sx={{ p: 2 }}>
                {filteredCompanyData.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PersonSearch sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No companies found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 
                        `No companies match "${searchQuery}". Try adjusting your search terms.` :
                        'Try adjusting your filters to see more results.'
                      }
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {getCurrentPageCompanies().map((company, index) => (
                      <Card 
                        key={company.companyName}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { 
                            boxShadow: 4,
                            transform: 'translateY(-1px)',
                            transition: 'all 0.2s ease-in-out'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={() => handleViewDetails(company)}
                      >
                        <CardContent sx={{ py: 2 }}>
                          {/* Company Header */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ mr: 2, bgcolor: `${company.statusColor}.main`, width: 48, height: 48 }}>
                              <Business sx={{ fontSize: 24 }} />
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {company.companyName}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  icon={getPerformanceIcon(company.performanceStatus)}
                                  label={company.performanceStatus}
                                  color={company.statusColor}
                                  size="small"
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  {getTrendIcon(company.trend)}
                                  <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 500 }}>
                                    {company.trend > 0 ? '+' : ''}{company.trend}%
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                            <Typography 
                              variant="h4" 
                              color="primary.main" 
                              sx={{ fontWeight: 700 }}
                            >
                              {company.overallScore}%
                            </Typography>
                          </Box>
                          
                          {/* Company Metrics */}
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr', 
                            gap: 1,
                            mt: 2,
                            pt: 2,
                            borderTop: 1,
                            borderColor: 'divider'
                          }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Employees
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {company.totalEmployees}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Attendance
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {company.avgAttendanceRate}%
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                With Data
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {company.employeesWithData}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Typography variant="caption" color="primary.main" sx={{ display: 'block', textAlign: 'center', mt: 1, fontWeight: 500 }}>
                            Tap to view detailed analytics
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
                
                {filteredCompanyData.length > companiesPerPage && totalPages > 1 && (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      gap: 2,
                      mt: 3,
                      px: 2,
                      pb: 1
                    }}>
                      {/* Page Info */}
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        Showing {safePage * companiesPerPage + 1} to{' '}
                        {Math.min((safePage + 1) * companiesPerPage, filteredCompanyData.length)} of{' '}
                        {filteredCompanyData.length} companies
                      </Typography>
                      
                      {/* Navigation Controls */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Button 
                          variant="outlined" 
                          onClick={handlePrevPage}
                          disabled={safePage === 0}
                          startIcon={<ArrowBack />}
                          size="small"
                          sx={{ minWidth: 100 }}
                        >
                          Previous
                        </Button>
                        
                        {/* Page Dots */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mx: 2 }}>
                          {totalPages > 1 && Array.from({ length: totalPages }).map((_, index) => (
                            <Box
                              key={index}
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: index === safePage ? 'primary.main' : 'grey.300',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                  transform: 'scale(1.2)',
                                  bgcolor: index === safePage ? 'primary.main' : 'grey.400'
                                }
                              }}
                              onClick={() => setCurrentPage(index)}
                            />
                          ))}
                        </Box>
                        
                        <Button 
                          variant="outlined" 
                          onClick={handleNextPage}
                          disabled={safePage === totalPages - 1}
                          endIcon={<ArrowForward />}
                          size="small"
                          sx={{ minWidth: 100 }}
                        >
                          Next
                        </Button>
                      </Box>
                      
                      {/* Page Numbers for Better Context */}
                      <Typography variant="caption" color="text.secondary">
                        Page {safePage + 1} of {totalPages}
                      </Typography>
                    </Box>
                  )}
                
              </Box>
            ) : (
              // Desktop: Table view
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Company</TableCell>
                      <TableCell align="center">Overall Score</TableCell>
                      <TableCell align="center">Status</TableCell>
                      <TableCell align="center">Employees</TableCell>
                      <TableCell align="center">Attendance Rate</TableCell>
                      <TableCell align="center">Trend</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredCompanyData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                          <PersonSearch sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No companies found
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {searchQuery ? 
                              `No companies match "${searchQuery}". Try adjusting your search terms.` :
                              'Try adjusting your filters to see more results.'
                            }
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      getCurrentPageCompanies().map((company, index) => (
                        <TableRow 
                          key={company.companyName} 
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleViewDetails(company)}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ mr: 2, bgcolor: `${company.statusColor}.main` }}>
                                <Business />
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={600}>
                                  {company.companyName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {company.employeesWithData}/{company.totalEmployees} employees with data
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Typography variant="h6" color="primary">
                              {company.overallScore}%
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Chip 
                              icon={getPerformanceIcon(company.performanceStatus)}
                              label={company.performanceStatus}
                              color={company.statusColor}
                              size="small"
                            />
                          </TableCell>
                          
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="600">
                              {company.totalEmployees}
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Typography variant="body2">
                              {company.avgAttendanceRate}%
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getTrendIcon(company.trend)}
                              <Typography variant="caption" sx={{ ml: 0.5 }}>
                                {company.trend > 0 ? '+' : ''}{company.trend}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Desktop Pagination Controls */}
          {!isMobile && filteredCompanyData.length > companiesPerPage && totalPages > 1 && (
            <Paper sx={{ mt: 2, borderRadius: 3, boxShadow: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center', 
                p: 3
              }}>
                {/* Page Info */}
                <Typography variant="body2" color="text.secondary">
                  Showing {safePage * companiesPerPage + 1} to{' '}
                  {Math.min((safePage + 1) * companiesPerPage, filteredCompanyData.length)} of{' '}
                  {filteredCompanyData.length} companies
                </Typography>
                
                {/* Navigation Controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button 
                    variant="outlined" 
                    onClick={handlePrevPage}
                    disabled={safePage === 0}
                    startIcon={<ArrowBack />}
                    size="small"
                  >
                    Previous
                  </Button>
                  
                  {/* Page Numbers */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                      // Show first 2, current, and last 2 pages when there are many pages
                      let pageIndex;
                      if (totalPages <= 5) {
                        pageIndex = index;
                      } else {
                        if (index < 2) {
                          pageIndex = index;
                        } else if (index === 2) {
                          pageIndex = Math.max(2, Math.min(safePage, totalPages - 3));
                        } else {
                          pageIndex = totalPages - (5 - index);
                        }
                      }
                      
                      const isCurrentPage = pageIndex === safePage;
                      
                      return (
                        <Button
                          key={pageIndex}
                          variant={isCurrentPage ? "contained" : "outlined"}
                          onClick={() => setCurrentPage(pageIndex)}
                          size="small"
                          sx={{ 
                            minWidth: 40,
                            height: 32,
                            fontWeight: isCurrentPage ? 600 : 400
                          }}
                        >
                          {pageIndex + 1}
                        </Button>
                      );
                    })}
                  </Box>
                  
                  <Button 
                    variant="outlined" 
                    onClick={handleNextPage}
                    disabled={safePage === totalPages - 1}
                    endIcon={<ArrowForward />}
                    size="small"
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}

          {/* Enhanced Company Detail Dialog */}
          <Dialog 
            open={detailDialog} 
            onClose={() => setDetailDialog(false)}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 4,
                bgcolor: 'background.paper',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
              }
            }}
            TransitionComponent={Slide}
            TransitionProps={{ direction: 'up', timeout: 500 }}
          >
            <DialogTitle sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                color: 'text.primary',
                py: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ 
                    bgcolor: 'primary.main', 
                    mr: 3,
                    width: 60,
                    height: 60
                  }}>
                    <Business sx={{ fontSize: 30, color: 'white' }} />
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 700,
                        mb: 0.5
                      }}
                    >
                      {selectedCompany?.companyName}
                    </Typography>
                    <Typography 
                      variant="subtitle1" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: '1.1rem'
                      }}
                    >
                      Company Performance Analytics
                    </Typography>
                  </Box>
                </Box>
                <IconButton 
                  onClick={() => setDetailDialog(false)}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ 
              bgcolor: 'background.paper',
              m: 2,
              borderRadius: 3
            }}>
              {selectedCompany && (
                <>
                  {/* Header Stats Cards */}
                  <Box sx={{ mb: 3, mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <Assessment sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedCompany.overallScore}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Overall Score
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'secondary.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <CalendarToday sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedCompany.avgAttendanceRate}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Attendance Rate
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'info.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <Groups sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedCompany.totalEmployees}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Total Employees
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: selectedCompany.statusColor + '.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              {getPerformanceIcon(selectedCompany.performanceStatus)}
                            </Avatar>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                              {selectedCompany.performanceStatus}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Detailed Analytics */}
                  <Grid container spacing={{ xs: 2, sm: 4 }}>
                    {/* Performance Breakdown */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        boxShadow: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Analytics sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
                            <Typography variant="h6" fontWeight="600">
                              Performance Analytics
                            </Typography>
                          </Box>
                          
                          <Stack spacing={2.5}>
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Present Days
                              </Typography>
                              <Chip 
                                label={selectedCompany.totalPresentDays} 
                                color="success" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Absent Days
                              </Typography>
                              <Chip 
                                label={selectedCompany.totalAbsentDays} 
                                color="error" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Total Leaves
                              </Typography>
                              <Chip 
                                label={selectedCompany.totalLeaves} 
                                color="info" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Approved Leaves
                              </Typography>
                              <Chip 
                                label={selectedCompany.totalApprovedLeaves} 
                                color="warning" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Employees with Data
                              </Typography>
                              <Chip 
                                label={`${selectedCompany.employeesWithData}/${selectedCompany.totalEmployees}`} 
                                color="primary" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Employee Performance Distribution */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        boxShadow: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <EmojiEvents sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
                            <Typography variant="h6" fontWeight="600">
                              Employee Performance
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={{ xs: 1, sm: 3 }} sx={{ mb: 3 }}>
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ 
                                textAlign: 'center',
                                p: { xs: 1.5, sm: 2 },
                                bgcolor: 'rgba(255, 255, 255, 0.8)',
                                borderRadius: 2,
                                border: '2px solid #4caf50',
                                minHeight: { xs: 80, sm: 'auto' }
                              }}>
                                <Typography variant={{ xs: "h5", sm: "h4" }} color="#4caf50" fontWeight="bold">
                                  {selectedCompany.excellentEmployees}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
                                  Excellent
                                </Typography>
                                <Typography variant={{ xs: "caption", sm: "body2" }} color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                  (95%+ attendance)
                                </Typography>
                              </Box>
                            </Grid>
                            
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ 
                                textAlign: 'center',
                                p: { xs: 1.5, sm: 2 },
                                bgcolor: 'rgba(255, 255, 255, 0.8)',
                                borderRadius: 2,
                                border: '2px solid #2196f3',
                                minHeight: { xs: 80, sm: 'auto' }
                              }}>
                                <Typography variant={{ xs: "h5", sm: "h4" }} color="#2196f3" fontWeight="bold">
                                  {selectedCompany.goodEmployees}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block' }}>
                                  Good
                                </Typography>
                                <Typography variant={{ xs: "caption", sm: "body2" }} color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                  (85-94% attendance)
                                </Typography>
                              </Box>
                            </Grid>
                            
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ 
                                textAlign: 'center',
                                p: { xs: 1.5, sm: 2 },
                                bgcolor: 'rgba(255, 255, 255, 0.8)',
                                borderRadius: 2,
                                border: '2px solid #f44336',
                                minHeight: { xs: 80, sm: 'auto' }
                              }}>
                                <Typography variant={{ xs: "h5", sm: "h4" }} color="#f44336" fontWeight="bold">
                                  {selectedCompany.poorEmployees}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, display: 'block', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                  Needs Improvement
                                </Typography>
                                <Typography variant={{ xs: "caption", sm: "body2" }} color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.875rem' } }}>
                                  (&lt;70% attendance)
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                          
                          {/* Performance Trend */}
                          <Box sx={{ 
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.8)',
                            borderRadius: 2,
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                              {getTrendIcon(selectedCompany.trend)}
                              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                                Performance Trend: {selectedCompany.trend > 0 ? '+' : ''}{selectedCompany.trend}%
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedCompany.trend > 0 ? 'Improving' : selectedCompany.trend < 0 ? 'Declining' : 'Stable'} compared to previous period
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </>
              )}
            </DialogContent>
            
            <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
              <Button 
                onClick={() => setDetailDialog(false)}
                variant="contained"
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none'
                }}
              >
                Close Details
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
}

export default CompanyPerformance;