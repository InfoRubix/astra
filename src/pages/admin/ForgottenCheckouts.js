import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import {
  AccessTime,
  CheckCircle,
  Cancel,
  MoreVert,
  Visibility,
  Schedule,
  Warning,
  Info,
  Person,
  CalendarToday,
  Approval,
  PendingActions,
  ArrowBack,
  ArrowForward
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { forgottenCheckoutService } from '../../utils/forgottenCheckoutService';
import { format, differenceInMinutes } from 'date-fns';

function ForgottenCheckouts() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processDialog, setProcessDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const requestsPerPage = 4;
  
  const [processForm, setProcessForm] = useState({
    action: 'approve',
    adminComments: '',
    rejectionReason: ''
  });

  useEffect(() => {
    if (user) {
      console.log('👤 Current user:', user);
      loadRequests();
      loadStats();
    }
  }, [user, statusFilter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      console.log('Loading ALL forgotten checkout requests for admin (no company filter)');
      const requestsList = await forgottenCheckoutService.getForgottenCheckoutRequests('ALL_COMPANIES', statusFilter);
      console.log('Loaded requests:', requestsList);
      setRequests(requestsList);
    } catch (error) {
      console.error('Error loading requests:', error);
      setError('Failed to load requests: ' + error.message);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      console.log('Loading stats for ALL companies');
      const statsData = await forgottenCheckoutService.getForgottenCheckoutStats('ALL_COMPANIES', 30);
      console.log('Loaded stats:', statsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleProcessRequest = async () => {
    if (!selectedRequest || !processForm.action) {
      setError('Please select an action');
      return;
    }

    if (processForm.action === 'reject' && !processForm.rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      const adminData = {
        adminId: user.uid,
        adminName: `${user.firstName} ${user.lastName}`,
        adminComments: processForm.adminComments.trim(),
        rejectionReason: processForm.rejectionReason.trim()
      };

      await forgottenCheckoutService.processForgottenCheckoutRequest(
        selectedRequest.id,
        processForm.action,
        adminData
      );

      setSuccess(`Request ${processForm.action}d successfully`);
      setProcessDialog(false);
      resetProcessForm();
      setSelectedRequest(null);
      await loadRequests();
      await loadStats();
      
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      console.error('Error processing request:', error);
      setError('Failed to process request: ' + error.message);
    }
  };

  const resetProcessForm = () => {
    setProcessForm({
      action: 'approve',
      adminComments: '',
      rejectionReason: ''
    });
  };

  const handleMenuClick = (event, request) => {
    console.log('📋 Menu clicked for request:', request);
    setAnchorEl(event.currentTarget);
    setSelectedRequest(request);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedRequest here, as it's needed for dialogs
  };

  const handleView = () => {
    console.log('🔍 View details clicked for request:', selectedRequest);
    setViewDialog(true);
    handleMenuClose();
  };

  const handleProcess = () => {
    setProcessDialog(true);
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getReasonColor = (reason) => {
    switch(reason) {
      case 'forgot': return 'warning';
      case 'emergency': return 'error';
      case 'system_error': return 'info';
      case 'meeting': return 'primary';
      default: return 'default';
    }
  };

  const formatReason = (reason) => {
    switch(reason) {
      case 'forgot': return 'Forgot to check out';
      case 'emergency': return 'Emergency';
      case 'system_error': return 'System Error';
      case 'meeting': return 'Extended Meeting';
      case 'other': return 'Other';
      default: return reason;
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    const statusMap = ['pending', 'approved', 'rejected', 'all'];
    setStatusFilter(statusMap[newValue]);
  };


  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const rejectedRequests = requests.filter(r => r.status === 'rejected');

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(0);
  }, [tabValue]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(requests.length / requestsPerPage));
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

  // Get paginated requests for display
  const getPaginatedRequests = () => {
    const startIndex = safePage * requestsPerPage;
    return requests.slice(startIndex, startIndex + requestsPerPage);
  };

  const paginatedRequests = getPaginatedRequests();

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                Review and process employee forgotten check-out requests
              </Typography>
            </Box>
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
      {stats && (
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" color="primary.main" sx={{ fontWeight: 700 }}>
                      {stats.totalRequests}
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
          
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" color="warning.main" sx={{ fontWeight: 700 }}>
                      {stats.pendingRequests}
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
          
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" color="success.main" sx={{ fontWeight: 700 }}>
                      {stats.approvedRequests}
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
          
          <Grid item xs={6} sm={6} md={3}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="h4" color="info.main" sx={{ fontWeight: 700 }}>
                      {stats.approvalRate}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approval Rate
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Approval />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Requests Table */}
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
        <Box sx={{ p: 3 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={`Pending (${pendingRequests.length})`} 
              icon={<Schedule />}
              iconPosition="start"
            />
            <Tab 
              label={`Approved (${approvedRequests.length})`} 
              icon={<CheckCircle />}
              iconPosition="start"
            />
            <Tab 
              label={`Rejected (${rejectedRequests.length})`} 
              icon={<Cancel />}
              iconPosition="start"
            />
            <Tab 
              label={`All (${requests.length})`} 
              icon={<PendingActions />}
              iconPosition="start"
            />
          </Tabs>
        </Box>
        <Divider />
        
        {/* Desktop Table View */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <TableContainer>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Check-in</TableCell>
                <TableCell>Requested Check-out</TableCell>
                <TableCell>Working Hours</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      Loading requests...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : paginatedRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No forgotten check-out requests found for status: {statusFilter}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRequests.map((request) => (
                  <TableRow key={request.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                        <Person sx={{ fontSize: 18 }} />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {request.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {request.userEmail}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={request.company}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          const date = request.date?.toDate ? request.date.toDate() : new Date(request.date);
                          return format(date, 'dd/MM/yyyy');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(() => {
                        try {
                          const date = request.date?.toDate ? request.date.toDate() : new Date(request.date);
                          return format(date, 'EEEE');
                        } catch (error) {
                          return '';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          if (!request.checkInTime) return 'N/A';
                          const date = request.checkInTime?.toDate ? request.checkInTime.toDate() : new Date(request.checkInTime);
                          return format(date, 'HH:mm');
                        } catch (error) {
                          console.error('Error formatting checkInTime:', request.checkInTime, error);
                          return 'Invalid time';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          if (!request.requestedCheckOutTime) return 'N/A';
                          
                          // Handle different date formats and types
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
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        if (!request.calculatedWorkingHours) return 'N/A';
                        const totalHours = request.calculatedWorkingHours;
                        const hours = Math.floor(totalHours);
                        const minutes = Math.round((totalHours - hours) * 60);
                        return `${hours}h ${minutes}m`;
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={formatReason(request.reason)}
                      size="small"
                      color={getReasonColor(request.reason)}
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      color={getStatusColor(request.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          if (!request.submittedAt) return 'N/A';
                          const date = request.submittedAt instanceof Date ? request.submittedAt : new Date(request.submittedAt);
                          return format(date, 'dd/MM HH:mm');
                        } catch (error) {
                          console.error('Error formatting submittedAt:', request.submittedAt, error);
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell align="right">
                    <IconButton onClick={(e) => handleMenuClick(e, request)}>
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        </Box>

        {/* Mobile Card View */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                Loading requests...
              </Typography>
            </Box>
          ) : paginatedRequests.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              textAlign: 'center',
              py: 6,
              p: 2
            }}>
              <Avatar sx={{ fontSize: 64, bgcolor: 'grey.200', width: 80, height: 80, mb: 2 }}>
                ⏰
              </Avatar>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {statusFilter === 'pending' ? 'No pending requests' : 
                 statusFilter === 'approved' ? 'No approved requests yet' :
                 statusFilter === 'rejected' ? 'No rejected requests' :
                 'No forgotten checkout requests'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusFilter === 'pending' ? 'New forgotten checkout requests will appear here for review' : 
                 statusFilter === 'approved' ? 'Approved requests will be shown here' :
                 statusFilter === 'rejected' ? 'Rejected requests will be displayed here' :
                 'Employee forgotten checkout requests will appear here once submitted'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                {paginatedRequests.map((request) => (
                  <Grid item xs={12} key={request.id}>
                    <Card 
                      sx={{ 
                        borderRadius: 3,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 3
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 50, height: 50 }}>
                            <Person />
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                              {request.userName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {request.userEmail}
                            </Typography>
                            <Chip 
                              label={request.company}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                          <Chip 
                            label={request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            color={getStatusColor(request.status)}
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Date:</strong> {(() => {
                                try {
                                  const date = request.date?.toDate ? request.date.toDate() : new Date(request.date);
                                  return format(date, 'dd/MM/yyyy');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              })()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {(() => {
                                try {
                                  const date = request.date?.toDate ? request.date.toDate() : new Date(request.date);
                                  return format(date, 'EEEE');
                                } catch (error) {
                                  return '';
                                }
                              })()}
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Check-in:</strong>
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {(() => {
                                  try {
                                    if (!request.checkInTime) return 'N/A';
                                    const date = request.checkInTime?.toDate ? request.checkInTime.toDate() : new Date(request.checkInTime);
                                    return format(date, 'HH:mm');
                                  } catch (error) {
                                    return 'Invalid time';
                                  }
                                })()}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Requested Check-out:</strong>
                              </Typography>
                              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                                {(() => {
                                  try {
                                    if (!request.requestedCheckOutTime) return 'N/A';
                                    let date;
                                    if (request.requestedCheckOutTime?.toDate) {
                                      date = request.requestedCheckOutTime.toDate();
                                    } else if (typeof request.requestedCheckOutTime === 'string') {
                                      date = new Date(request.requestedCheckOutTime);
                                    } else if (request.requestedCheckOutTime instanceof Date) {
                                      date = request.requestedCheckOutTime;
                                    } else {
                                      date = new Date(request.requestedCheckOutTime);
                                    }
                                    if (isNaN(date.getTime())) {
                                      return 'Invalid time';
                                    }
                                    return format(date, 'HH:mm');
                                  } catch (error) {
                                    return 'Invalid time';
                                  }
                                })()}
                              </Typography>
                            </Grid>
                          </Grid>

                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              <strong>Working Hours:</strong> {(() => {
                                if (!request.calculatedWorkingHours) return 'N/A';
                                const totalHours = request.calculatedWorkingHours;
                                const hours = Math.floor(totalHours);
                                const minutes = Math.round((totalHours - hours) * 60);
                                return `${hours}h ${minutes}m`;
                              })()}
                            </Typography>
                            <Chip 
                              label={formatReason(request.reason)}
                              size="small"
                              color={getReasonColor(request.reason)}
                              variant="outlined"
                            />
                          </Box>

                          {request.description && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Description:</strong> {request.description}
                            </Typography>
                          )}
                          
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
                        </Box>
                        
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<MoreVert />}
                          onClick={(e) => handleMenuClick(e, request)}
                          sx={{ borderRadius: 2 }}
                        >
                          Actions
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>

        {/* Mobile Pagination */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {requests.length > requestsPerPage && totalPages > 1 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 3,
              borderTop: 1,
              borderColor: 'divider'
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Showing {safePage * requestsPerPage + 1} to{' '}
                {Math.min((safePage + 1) * requestsPerPage, requests.length)} of{' '}
                {requests.length} requests
              </Typography>
              
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
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {Array.from({ length: totalPages }, (_, index) => (
                    <Button 
                      key={index}
                      variant={safePage === index ? "contained" : "outlined"}
                      onClick={() => setCurrentPage(index)}
                      size="small"
                      sx={{ minWidth: 40, height: 40 }}
                    >
                      {index + 1}
                    </Button>
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
            </Box>
          )}
        </Box>
      </Paper>

      {/* Desktop Pagination */}
      {!isMobile && requests.length > requestsPerPage && totalPages > 1 && (
        <Paper elevation={1} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {safePage * requestsPerPage + 1} to{' '}
              {Math.min((safePage + 1) * requestsPerPage, requests.length)} of{' '}
              {requests.length} requests
            </Typography>
            
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
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                {Array.from({ length: totalPages }, (_, index) => (
                  <Button 
                    key={index}
                    variant={safePage === index ? "contained" : "outlined"}
                    onClick={() => setCurrentPage(index)}
                    size="small"
                    sx={{ minWidth: 40, height: 40 }}
                  >
                    {index + 1}
                  </Button>
                ))}
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

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <Visibility sx={{ mr: 2 }} />
          View Details
        </MenuItem>
        {selectedRequest?.status === 'pending' && (
          <MenuItem onClick={handleProcess}>
            <Approval sx={{ mr: 2 }} />
            Process Request
          </MenuItem>
        )}
      </Menu>

      {/* View Dialog */}
      <Dialog open={viewDialog} onClose={() => { setViewDialog(false); setSelectedRequest(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Request Details</DialogTitle>
        <DialogContent>
          {selectedRequest ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Employee:</Typography>
                <Typography variant="body1">{selectedRequest.userName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Date:</Typography>
                <Typography variant="body1">
                  {(() => {
                    try {
                      if (!selectedRequest.date) return 'N/A';
                      const date = selectedRequest.date?.toDate ? selectedRequest.date.toDate() : new Date(selectedRequest.date);
                      return format(date, 'dd/MM/yyyy');
                    } catch (error) {
                      console.error('Error formatting date in dialog:', selectedRequest.date, error);
                      return 'Invalid date';
                    }
                  })()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Check-in Time:</Typography>
                <Typography variant="body1">
                  {(() => {
                    try {
                      if (!selectedRequest.checkInTime) return 'N/A';
                      const date = selectedRequest.checkInTime?.toDate ? selectedRequest.checkInTime.toDate() : new Date(selectedRequest.checkInTime);
                      return format(date, 'HH:mm');
                    } catch (error) {
                      console.error('Error formatting checkInTime in dialog:', selectedRequest.checkInTime, error);
                      return 'Invalid time';
                    }
                  })()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Requested Check-out Time:</Typography>
                <Typography variant="body1">
                  {(() => {
                    try {
                      if (!selectedRequest.requestedCheckOutTime) return 'N/A';
                      
                      // Handle different date formats and types
                      let date;
                      if (selectedRequest.requestedCheckOutTime?.toDate) {
                        // Firestore timestamp
                        date = selectedRequest.requestedCheckOutTime.toDate();
                      } else if (typeof selectedRequest.requestedCheckOutTime === 'string') {
                        // String date
                        date = new Date(selectedRequest.requestedCheckOutTime);
                      } else if (selectedRequest.requestedCheckOutTime instanceof Date) {
                        // Already a Date object
                        date = selectedRequest.requestedCheckOutTime;
                      } else {
                        // Try to parse as-is
                        date = new Date(selectedRequest.requestedCheckOutTime);
                      }
                      
                      if (isNaN(date.getTime())) {
                        console.error('Invalid requestedCheckOutTime in dialog:', selectedRequest.requestedCheckOutTime);
                        return 'Invalid time';
                      }
                      
                      return format(date, 'HH:mm');
                    } catch (error) {
                      console.error('Error formatting requestedCheckOutTime in dialog:', selectedRequest.requestedCheckOutTime, error);
                      return 'Invalid time';
                    }
                  })()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Working Hours:</Typography>
                <Typography variant="body1">
                  {(() => {
                    if (!selectedRequest.calculatedWorkingHours) return 'N/A';
                    const totalHours = selectedRequest.calculatedWorkingHours;
                    const hours = Math.floor(totalHours);
                    const minutes = Math.round((totalHours - hours) * 60);
                    return `${hours}h ${minutes}m`;
                  })()}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Reason:</Typography>
                <Typography variant="body1">{formatReason(selectedRequest.reason)}</Typography>
              </Grid>
              {selectedRequest.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Description:</Typography>
                  <Typography variant="body1">{selectedRequest.description}</Typography>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Status:</Typography>
                <Chip 
                  label={selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  color={getStatusColor(selectedRequest.status)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Submitted:</Typography>
                <Typography variant="body1">
                  {(() => {
                    try {
                      if (!selectedRequest.submittedAt) return 'N/A';
                      const date = selectedRequest.submittedAt instanceof Date ? selectedRequest.submittedAt : new Date(selectedRequest.submittedAt);
                      return format(date, 'dd/MM/yyyy HH:mm');
                    } catch (error) {
                      console.error('Error formatting submittedAt in dialog:', selectedRequest.submittedAt, error);
                      return 'Invalid date';
                    }
                  })()}
                </Typography>
              </Grid>
              {selectedRequest.processedAt && (
                <>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Processed:</Typography>
                    <Typography variant="body1">
                      {(() => {
                        try {
                          if (!selectedRequest.processedAt) return 'N/A';
                          const date = selectedRequest.processedAt instanceof Date ? selectedRequest.processedAt : new Date(selectedRequest.processedAt);
                          return format(date, 'dd/MM/yyyy HH:mm');
                        } catch (error) {
                          console.error('Error formatting processedAt:', selectedRequest.processedAt, error);
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Processed By:</Typography>
                    <Typography variant="body1">{selectedRequest.processedByName}</Typography>
                  </Grid>
                  {selectedRequest.adminComments && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2">Admin Comments:</Typography>
                      <Typography variant="body1">{selectedRequest.adminComments}</Typography>
                    </Grid>
                  )}
                  {selectedRequest.rejectionReason && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2">Rejection Reason:</Typography>
                      <Typography variant="body1">{selectedRequest.rejectionReason}</Typography>
                    </Grid>
                  )}
                </>
              )}
            </Grid>
          ) : (
            <Typography variant="body1" color="text.secondary">
              No request selected or request data unavailable.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setViewDialog(false); setSelectedRequest(null); }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Process Dialog */}
      <Dialog open={processDialog} onClose={() => { setProcessDialog(false); setSelectedRequest(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Process Request</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={processForm.action}
                  label="Action"
                  onChange={(e) => setProcessForm(prev => ({ ...prev, action: e.target.value }))}
                >
                  <MenuItem value="approve">Approve Request</MenuItem>
                  <MenuItem value="reject">Reject Request</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Admin Comments"
                multiline
                rows={3}
                fullWidth
                value={processForm.adminComments}
                onChange={(e) => setProcessForm(prev => ({ ...prev, adminComments: e.target.value }))}
                placeholder="Add any comments about this decision (optional)"
              />
            </Grid>
            
            {processForm.action === 'reject' && (
              <Grid item xs={12}>
                <TextField
                  label="Rejection Reason"
                  multiline
                  rows={2}
                  fullWidth
                  value={processForm.rejectionReason}
                  onChange={(e) => setProcessForm(prev => ({ ...prev, rejectionReason: e.target.value }))}
                  placeholder="Please provide a reason for rejection"
                  required
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setProcessDialog(false); setSelectedRequest(null); }}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleProcessRequest}
            color={processForm.action === 'approve' ? 'success' : 'error'}
          >
            {processForm.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ForgottenCheckouts;