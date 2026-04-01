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
  CardActions,
  Button,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  Assessment,
  People,
  Schedule,
  Receipt,
  TrendingUp,
  CalendarMonth,
  Business,
  Analytics,
  GetApp,
  Visibility,
  PieChart,
  BarChart,
  InsertChart,
  TableChart,
  FileDownload,
  DateRange,
  AccessTime,
  MonetizationOn,
  Work
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import MonthYearSelector from '../../components/MonthYearSelector';

function BranchAdminReports() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('current_month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState({
    employees: [],
    attendance: [],
    leaves: [],
    claims: [],
    announcements: []
  });
  const [reportDialog, setReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const reportTypes = [
    {
      id: 'attendance',
      title: 'Branch Attendance Report',
      description: 'Employee attendance patterns, check-ins, check-outs, and working hours for this branch',
      icon: <Schedule />,
      color: 'primary',
      metrics: ['Total Working Hours', 'Average Daily Hours', 'Attendance Rate', 'Late Check-ins']
    },
    {
      id: 'employee',
      title: 'Branch Employee Report',
      description: 'Employee demographics, department distribution, and role analysis for this branch',
      icon: <People />,
      color: 'success',
      metrics: ['Branch Employees', 'Department Breakdown', 'Role Distribution', 'New Hires']
    },
    {
      id: 'leaves',
      title: 'Branch Leave Report',
      description: 'Leave requests, approvals, rejections, and leave balance analysis for this branch',
      icon: <CalendarMonth />,
      color: 'warning',
      metrics: ['Leave Requests', 'Approval Rate', 'Leave Types', 'Department Usage']
    },
    {
      id: 'claims',
      title: 'Branch Claims Report',
      description: 'Expense claims, reimbursements, and financial expenditure tracking for this branch',
      icon: <Receipt />,
      color: 'error',
      metrics: ['Total Claims', 'Average Amount', 'Approval Rate', 'Department Spending']
    },
    {
      id: 'productivity',
      title: 'Branch Productivity Analytics',
      description: 'Work patterns, efficiency metrics, and performance indicators for this branch',
      icon: <TrendingUp />,
      color: 'info',
      metrics: ['Productivity Score', 'Peak Hours', 'Department Performance', 'Trends']
    },
    {
      id: 'comprehensive',
      title: 'Branch Comprehensive Report',
      description: 'Complete overview combining all aspects of branch operations',
      icon: <Assessment />,
      color: 'secondary',
      metrics: ['All Metrics', 'Cross-functional Analysis', 'Branch Summary', 'Recommendations']
    }
  ];

  const periodOptions = [
    { value: 'current_month', label: 'Current Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_3_months', label: 'Last 3 Months' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'current_year', label: 'Current Year' },
    { value: 'specific_month', label: 'Specific Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  useEffect(() => {
    if (user) {
      loadReportData();
    }
  }, [user, selectedPeriod, selectedMonth, selectedYear]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const userCompany = user.originalCompanyName || user.company || '';
      const userBranch = user.branchName || user.branch;
      console.log('Loading branch report data for:', { company: userCompany, branch: userBranch });

      if (!userBranch) {
        setError('No branch information found for your account. Please contact your administrator.');
        setLoading(false);
        return;
      }

      // Get date range based on selected period
      const dateRange = getDateRange(selectedPeriod);

      // Load employees data for the specific branch
      const employeesQuery = query(
        collection(db, 'users'),
        where('role', '!=', 'admin')
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      const employees = employeesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(emp => {
          const empCompany = emp.originalCompanyName || emp.company || '';
          const empBranch = emp.branchName || emp.branch;
          return empCompany.toUpperCase() === userCompany.toUpperCase() &&
                 empBranch === userBranch;
        });

      // Load attendance data for the specific branch
      const attendanceQuery = query(collection(db, 'attendance'), orderBy('date', 'desc'));
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendance = attendanceSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(att => {
          const attCompany = att.originalCompanyName || att.company || '';
          const attBranch = att.branchName || att.branch;
          const attDate = att.date?.toDate ? att.date.toDate() : new Date(att.date);
          return attCompany.toUpperCase() === userCompany.toUpperCase() &&
                 attBranch === userBranch &&
                 isWithinInterval(attDate, dateRange);
        });

      // Load leaves data for the specific branch
      const leavesQuery = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
      const leavesSnapshot = await getDocs(leavesQuery);
      const leaves = leavesSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(leave => {
          const leaveCompany = leave.originalCompanyName || leave.company || '';
          const leaveBranch = leave.branchName || leave.branch;
          const leaveDate = leave.createdAt?.toDate ? leave.createdAt.toDate() : new Date(leave.createdAt);
          return leaveCompany.toUpperCase() === userCompany.toUpperCase() &&
                 leaveBranch === userBranch &&
                 isWithinInterval(leaveDate, dateRange);
        });

      // Load claims data for the specific branch
      const claimsQuery = query(collection(db, 'claims'), orderBy('createdAt', 'desc'));
      const claimsSnapshot = await getDocs(claimsQuery);
      const claims = claimsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(claim => {
          const claimCompany = claim.originalCompanyName || claim.company || '';
          const claimBranch = claim.branchName || claim.branch;
          const claimDate = claim.createdAt?.toDate ? claim.createdAt.toDate() : new Date(claim.createdAt);
          return claimCompany.toUpperCase() === userCompany.toUpperCase() &&
                 claimBranch === userBranch &&
                 isWithinInterval(claimDate, dateRange);
        });

      // Load announcements data for the specific branch
      const announcementsQuery = query(
        collection(db, 'announcements'),
        where('company', '==', userCompany)
      );
      const announcementsSnapshot = await getDocs(announcementsQuery);
      const announcements = announcementsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
        }))
        .filter(ann => {
          const annBranch = ann.branchName || ann.branch;
          return !annBranch || annBranch === userBranch; // Show general announcements or branch-specific ones
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      setReportData({
        employees,
        attendance,
        leaves,
        claims,
        announcements
      });

      console.log('Branch report data loaded:', {
        employees: employees.length,
        attendance: attendance.length,
        leaves: leaves.length,
        claims: claims.length,
        announcements: announcements.length,
        branch: userBranch
      });

    } catch (error) {
      console.error('Error loading branch report data:', error);
      
      let errorMessage = 'Failed to load branch report data';
      if (error.message.includes('index')) {
        errorMessage = 'Database indexing issue. Some reports may have limited data. Please contact your system administrator.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network connection issue. Please check your internet connection and try again.';
      } else {
        errorMessage = `Failed to load branch report data: ${error.message}`;
      }
      
      setError(errorMessage);
    }
    setLoading(false);
  };

  const getDateRange = (period) => {
    const now = new Date();
    switch (period) {
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'last_3_months':
        return { start: subMonths(now, 3), end: now };
      case 'last_6_months':
        return { start: subMonths(now, 6), end: now };
      case 'current_year':
        return { start: new Date(now.getFullYear(), 0, 1), end: now };
      case 'specific_month':
        // Use selectedMonth and selectedYear for specific month filtering
        const specificDate = new Date(selectedYear, selectedMonth - 1, 1);
        return { start: startOfMonth(specificDate), end: endOfMonth(specificDate) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const calculateMetrics = () => {
    const { employees, attendance, leaves, claims } = reportData;
    
    return {
      totalEmployees: employees.length,
      activeEmployees: employees.filter(emp => emp.isActive !== false).length,
      totalAttendanceRecords: attendance.length,
      averageWorkingHours: attendance.length > 0 ? 
        attendance.reduce((sum, att) => sum + (att.workingHours || 0), 0) / attendance.length : 0,
      totalLeaveRequests: leaves.length,
      approvedLeaves: leaves.filter(leave => leave.status === 'approved').length,
      totalClaims: claims.length,
      totalClaimAmount: claims.reduce((sum, claim) => sum + (parseFloat(claim.amount) || 0), 0),
      approvedClaims: claims.filter(claim => claim.status === 'approved').length
    };
  };

  const handleGenerateReport = async (report) => {
    setSelectedReport(report);
    setReportDialog(true);
  };

  const handleDownloadReport = async () => {
    setGeneratingReport(true);
    try {
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const metrics = calculateMetrics();
      const dateRange = getDateRange(selectedPeriod);
      
      // Create a simple CSV report
      const csvContent = generateCSVReport(selectedReport, metrics, dateRange);
      
      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedReport.title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(`${selectedReport.title} downloaded successfully`);
      setReportDialog(false);
    } catch (error) {
      console.error('Error generating branch report:', error);
      
      let errorMessage = 'Failed to generate branch report';
      if (error.message.includes('permission')) {
        errorMessage = 'Permission denied. Unable to generate report file.';
      } else if (error.message.includes('storage')) {
        errorMessage = 'Storage issue. Please free up some disk space and try again.';
      } else {
        errorMessage = `Failed to generate branch report: ${error.message}`;
      }
      
      setError(errorMessage);
    }
    setGeneratingReport(false);
  };

  const generateCSVReport = (report, metrics, dateRange) => {
    const userCompany = user.originalCompanyName || user.company || '';
    const userBranch = user.branchName || user.branch;
    let csvContent = `Branch Report: ${report.title}\n`;
    csvContent += `Company: ${userCompany}\n`;
    csvContent += `Branch: ${userBranch}\n`;
    csvContent += `Period: ${format(dateRange.start, 'MMM dd, yyyy')} - ${format(dateRange.end, 'MMM dd, yyyy')}\n`;
    csvContent += `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}\n\n`;
    
    csvContent += `SUMMARY METRICS\n`;
    csvContent += `Total Employees,${metrics.totalEmployees}\n`;
    csvContent += `Active Employees,${metrics.activeEmployees}\n`;
    csvContent += `Attendance Records,${metrics.totalAttendanceRecords}\n`;
    csvContent += `Average Working Hours,${metrics.averageWorkingHours.toFixed(2)}\n`;
    csvContent += `Leave Requests,${metrics.totalLeaveRequests}\n`;
    csvContent += `Approved Leaves,${metrics.approvedLeaves}\n`;
    csvContent += `Total Claims,${metrics.totalClaims}\n`;
    csvContent += `Total Claim Amount,${metrics.totalClaimAmount.toFixed(2)}\n`;
    csvContent += `Approved Claims,${metrics.approvedClaims}\n\n`;
    
    // Add specific data based on report type
    if (report.id === 'employee') {
      csvContent += `EMPLOYEE BREAKDOWN\n`;
      csvContent += `Name,Department,Role,Status\n`;
      reportData.employees.forEach(emp => {
        csvContent += `${emp.firstName} ${emp.lastName},${emp.department || 'N/A'},${emp.role || 'N/A'},${emp.isActive !== false ? 'Active' : 'Inactive'}\n`;
      });
    }
    
    return csvContent;
  };

  const metrics = calculateMetrics();

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading branch report data...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Header */}
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
              <Assessment sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Branch Reports
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Analytics and insights for {user.branchName || user.branch || 'your branch'}
              </Typography>
            </Box>
          </Box>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Report Period</InputLabel>
            <Select
              value={selectedPeriod}
              label="Report Period"
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periodOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Month/Year Selector - Show when "Specific Month" is selected */}
      {selectedPeriod === 'specific_month' && (
        <Box sx={{ mb: 3 }}>
          <MonthYearSelector
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            disabled={loading}
          />
        </Box>
      )}

      {/* Key Metrics Summary */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700 }}>
                    {metrics.totalEmployees}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Employees
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  <People />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                    {metrics.averageWorkingHours.toFixed(1)}h
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Hours
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.main' }}>
                  <AccessTime />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                    {metrics.totalLeaveRequests}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Leave Requests
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.main' }}>
                  <CalendarMonth />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} sm={6} md={3}>
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h4" color="error.main" sx={{ fontWeight: 700 }}>
                    RM{metrics.totalClaimAmount.toFixed(0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Claims
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'error.main' }}>
                  <MonetizationOn />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Report Types */}
      <Paper 
        elevation={0}
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main', mb: 3 }}>
            Available Branch Reports
          </Typography>

          <Grid container spacing={{ xs: 2, sm: 3 }}>
            {reportTypes.map((report) => (
              <Grid item xs={12} md={6} lg={4} key={report.id}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                      borderColor: `${report.color}.light`
                    }
                  }}
                >
                  <CardContent sx={{ p: 3, pb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: `${report.color}.main` }}>
                        {report.icon}
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {report.title}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {report.description}
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: `${report.color}.main` }}>
                        Key Metrics:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {report.metrics.slice(0, 2).map((metric) => (
                          <Chip 
                            key={metric}
                            label={metric}
                            size="small"
                            variant="outlined"
                            color={report.color}
                          />
                        ))}
                        {report.metrics.length > 2 && (
                          <Chip 
                            label={`+${report.metrics.length - 2} more`}
                            size="small"
                            variant="outlined"
                            color="default"
                          />
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                  
                  <CardActions sx={{ p: 3, pt: 0 }}>
                    <Button
                      variant="contained"
                      color={report.color}
                      startIcon={<GetApp />}
                      onClick={() => handleGenerateReport(report)}
                      fullWidth
                      sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                      Generate Report
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>

      {/* Report Generation Dialog */}
      <Dialog 
        open={reportDialog} 
        onClose={() => setReportDialog(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {selectedReport && (
              <>
                <Avatar sx={{ mr: 2, bgcolor: `${selectedReport.color}.main` }}>
                  {selectedReport.icon}
                </Avatar>
                Generate {selectedReport.title}
              </>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="body1" paragraph>
                {selectedReport.description}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.main' }}>
                Report will include:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                {selectedReport.metrics.map((metric) => (
                  <Box key={metric} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      bgcolor: `${selectedReport.color}.main`,
                      mr: 1 
                    }} />
                    <Typography variant="body2">{metric}</Typography>
                  </Box>
                ))}
              </Box>
              
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Period:</strong> {periodOptions.find(p => p.value === selectedPeriod)?.label} • 
                  <strong> Format:</strong> CSV File • 
                  <strong> Branch:</strong> {user.branchName || user.branch}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleDownloadReport}
            disabled={generatingReport}
            startIcon={generatingReport ? <CircularProgress size={20} /> : <FileDownload />}
          >
            {generatingReport ? 'Generating...' : 'Download Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default BranchAdminReports;