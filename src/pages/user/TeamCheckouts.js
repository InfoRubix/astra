import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Divider,
  TablePagination,
  Tabs,
  Tab,
  Skeleton
} from '@mui/material';
import {
  CheckCircle,
  Cancel as RejectIcon,
  PendingActions as PendingIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Check as ApproveIcon,
  Info as InfoIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getSubordinates, getPositionLevel, getPositionLevelName } from '../../utils/positionHierarchy';

function TeamCheckouts() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingCheckouts, setPendingCheckouts] = useState([]);
  const [approvedCheckouts, setApprovedCheckouts] = useState([]);
  const [rejectedCheckouts, setRejectedCheckouts] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Checkout tabs
  const [checkoutTab, setCheckoutTab] = useState(0); // 0: pending, 1: approved, 2: rejected

  // Employee detail dialog
  const [employeeDetailDialog, setEmployeeDetailDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeCheckouts, setEmployeeCheckouts] = useState([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsers(users);

      // Get subordinates
      const subs = getSubordinates(user, users);

      // DEBUG: Log current user and subordinates info
      console.log('====== TEAM CHECKOUTS DEBUG ======');
      console.log('Current User:', {
        name: `${user.firstName} ${user.lastName}`,
        position: user.position,
        company: user.company,
        originalCompanyName: user.originalCompanyName
      });
      console.log('Total Users in System:', users.length);
      console.log('Subordinates Found:', subs.length);
      console.log('Subordinate Details:', subs.map(s => ({
        name: `${s.firstName} ${s.lastName}`,
        position: s.position,
        company: s.company || s.originalCompanyName
      })));
      console.log('================================');

      setSubordinates(subs);

      // Load ALL forgotten checkout requests from subordinates (pending, approved, rejected)
      if (subs.length > 0) {
        // Collect both document IDs and UIDs from subordinates
        const subordinateIds = subs.map(s => s.id);
        const subordinateUids = subs.map(s => s.uid).filter(Boolean); // Filter out undefined/null
        const allSubordinateIdentifiers = [...new Set([...subordinateIds, ...subordinateUids])]; // Combine and dedupe

        // DEBUG: Log subordinate IDs
        console.log('🔍 Subordinate IDs:', subordinateIds);
        console.log('🔍 Subordinate UIDs:', subordinateUids);
        console.log('🔍 All identifiers:', allSubordinateIdentifiers);

        const checkoutsQuery = query(collection(db, 'forgottenCheckoutRequests'));
        const checkoutsSnapshot = await getDocs(checkoutsQuery);

        // DEBUG: Log all checkouts
        console.log('📋 Total forgotten checkouts in DB:', checkoutsSnapshot.docs.length);
        checkoutsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('  - Checkout:', {
            id: doc.id,
            userId: data.userId,
            userName: data.userName,
            company: data.company,
            status: data.status
          });
        });

        const allCheckouts = checkoutsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(checkout => {
            // Check if userId matches any subordinate identifier (id or uid)
            const matches = allSubordinateIdentifiers.includes(checkout.userId);

            if (!matches) {
              console.log('❌ Checkout NOT matched:', checkout.userId, 'not in', allSubordinateIdentifiers);
            } else {
              console.log('✅ Checkout MATCHED:', checkout.userId);
            }

            return matches;
          });

        // Add employee details to each checkout
        const checkoutsWithDetails = allCheckouts.map(checkout => {
          // Find employee by either id or uid
          const employee = users.find(u => u.id === checkout.userId || u.uid === checkout.userId);
          return {
            ...checkout,
            employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
            employeePosition: employee?.position || 'N/A',
            employeeCompany: employee?.company || employee?.originalCompanyName || 'N/A'
          };
        });

        // Split by status
        const pending = checkoutsWithDetails.filter(c => c.status === 'pending');
        const approved = checkoutsWithDetails.filter(c => c.status === 'approved');
        const rejected = checkoutsWithDetails.filter(c => c.status === 'rejected');

        // Sort by submission date (newest first)
        const sortByDate = (a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        };

        pending.sort(sortByDate);
        approved.sort(sortByDate);
        rejected.sort(sortByDate);

        setPendingCheckouts(pending);
        setApprovedCheckouts(approved);
        setRejectedCheckouts(rejected);
      } else {
        setPendingCheckouts([]);
        setApprovedCheckouts([]);
        setRejectedCheckouts([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeClick = async (checkout) => {
    setSelectedEmployee(null);
    setEmployeeCheckouts([]);
    setEmployeeDetailDialog(true);
    setLoadingEmployeeData(true);

    try {
      // Find employee details by either id or uid
      const employee = allUsers.find(u => u.id === checkout.userId || u.uid === checkout.userId);
      setSelectedEmployee(employee);

      // Load only pending checkout requests for this employee
      const checkoutsQuery = query(
        collection(db, 'forgottenCheckoutRequests'),
        where('userId', '==', checkout.userId),
        where('status', '==', 'pending')
      );
      const checkoutsSnapshot = await getDocs(checkoutsQuery);
      const checkouts = checkoutsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by created date (newest first)
      checkouts.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      setEmployeeCheckouts(checkouts);
    } catch (error) {
      console.error('Error loading employee data:', error);
      setMessage('Error loading employee details');
      setMessageType('error');
    } finally {
      setLoadingEmployeeData(false);
    }
  };

  const handleActionClick = (checkout, type) => {
    setSelectedCheckout(checkout);
    setActionType(type);
    setRejectionReason('');
    setActionDialog(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedCheckout) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      setMessage('Please provide a reason for rejection');
      setMessageType('error');
      return;
    }

    setProcessing(true);
    try {
      const checkoutRef = doc(db, 'forgottenCheckoutRequests', selectedCheckout.id);
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        reviewedBy: user.uid,
        reviewedByName: `${user.firstName} ${user.lastName}`,
        reviewedByPosition: user.position,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (actionType === 'reject') {
        updateData.rejectionReason = rejectionReason;
      }

      await updateDoc(checkoutRef, updateData);

      setMessage(`Checkout request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setMessageType('success');
      setActionDialog(false);
      setSelectedCheckout(null);

      // Reload data
      await loadData();

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } catch (error) {
      console.error('Error updating checkout:', error);
      setMessage('Error processing checkout request');
      setMessageType('error');
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return `${formatDate(date)} ${formatTime(date)}`;
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCheckoutTabChange = (event, newValue) => {
    setCheckoutTab(newValue);
    setPage(0); // Reset pagination when switching tabs
  };

  // Get current checkouts based on tab
  const getCurrentCheckouts = () => {
    switch (checkoutTab) {
      case 0:
        return pendingCheckouts;
      case 1:
        return approvedCheckouts;
      case 2:
        return rejectedCheckouts;
      default:
        return [];
    }
  };

  const currentCheckouts = getCurrentCheckouts();

  // Calculate displayed rows based on pagination
  const displayedCheckouts = currentCheckouts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          {/* Header Skeleton */}
          <Box sx={{ mb: 4 }}>
            <Skeleton variant="text" width="45%" height={50} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="65%" height={30} />
          </Box>

          {/* Team Summary Cards Skeleton */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} md={4} key={item}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                      <Skeleton variant="text" width="60%" height={30} />
                    </Box>
                    <Skeleton variant="text" width="40%" height={50} sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width="80%" height={20} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Table Skeleton */}
          <Paper sx={{ borderRadius: 2 }}>
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3, pt: 2 }}>
              <Skeleton variant="rectangular" width="60%" height={48} sx={{ borderRadius: 1 }} />
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                      <TableCell key={col}>
                        <Skeleton variant="text" width="80%" height={20} />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <TableRow key={row}>
                      {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                        <TableCell key={col}>
                          {col === 1 ? (
                            <Box>
                              <Skeleton variant="text" width="70%" height={20} />
                              <Skeleton variant="text" width="60%" height={16} />
                            </Box>
                          ) : col === 7 ? (
                            <Box display="flex" gap={1}>
                              <Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 1 }} />
                              <Skeleton variant="rectangular" width={70} height={32} sx={{ borderRadius: 1 }} />
                            </Box>
                          ) : (
                            <Skeleton variant="text" width="90%" height={20} />
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2 }}>
              <Skeleton variant="rectangular" width="100%" height={52} />
            </Box>
          </Paper>
        </Box>
      </Container>
    );
  }

  if (subordinates.length === 0) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Team Checkout Approvals
          </Typography>
          <Alert severity="info" sx={{ mt: 3 }}>
            You don't have any team members to approve. This page is only available for managers and supervisors.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
            Team Checkout Approvals
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Review and approve forgotten checkout requests from your team members
          </Typography>
        </Box>

        {message && (
          <Alert severity={messageType} sx={{ mb: 3 }}>
            {message}
          </Alert>
        )}

        {/* Team Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <PersonIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Team Size</Typography>
                </Box>
                <Typography variant="h4" color="primary" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {subordinates.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  members reporting to you
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <PendingIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Pending Checkouts</Typography>
                </Box>
                <Typography variant="h4" color="warning.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {pendingCheckouts.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  awaiting your review
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <PersonIcon color="secondary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Your Position</Typography>
                </Box>
                <Typography variant="h4" color="secondary.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {user.position}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getPositionLevelName(getPositionLevel(user.position))}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Forgotten Checkout Requests with Tabs */}
        <Paper sx={{ borderRadius: 2 }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={checkoutTab}
              onChange={handleCheckoutTabChange}
              sx={{ px: 3, pt: 2 }}
            >
              <Tab
                label={`Pending (${pendingCheckouts.length})`}
                icon={<PendingIcon />}
                iconPosition="start"
              />
              <Tab
                label={`Approved (${approvedCheckouts.length})`}
                icon={<CheckCircle />}
                iconPosition="start"
              />
              <Tab
                label={`Rejected (${rejectedCheckouts.length})`}
                icon={<RejectIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {currentCheckouts.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <AccessTimeIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.secondary">
                No {checkoutTab === 0 ? 'Pending' : checkoutTab === 1 ? 'Approved' : 'Rejected'} Checkout Requests
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {checkoutTab === 0
                  ? 'All forgotten checkout requests have been processed'
                  : checkoutTab === 1
                  ? 'No approved checkout requests to display'
                  : 'No rejected checkout requests to display'
                }
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Employee</strong></TableCell>
                      <TableCell><strong>Position</strong></TableCell>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell><strong>Check In</strong></TableCell>
                      <TableCell><strong>Proposed Check Out</strong></TableCell>
                      <TableCell><strong>Submitted</strong></TableCell>
                      {checkoutTab !== 0 && <TableCell><strong>Reviewed By</strong></TableCell>}
                      {checkoutTab === 0 && <TableCell align="center"><strong>Actions</strong></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedCheckouts.map((checkout) => (
                    <TableRow
                      key={checkout.id}
                      hover
                      onClick={() => handleEmployeeClick(checkout)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {checkout.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {checkout.employeeCompany}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={checkout.employeePosition}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{formatDate(checkout.date)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatTime(checkout.checkInTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatTime(checkout.checkOutTime)}
                          color="warning"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{formatDate(checkout.createdAt)}</TableCell>
                      {checkoutTab !== 0 && (
                        <TableCell>
                          <Typography variant="body2">{checkout.reviewedByName || 'N/A'}</Typography>
                          {checkout.reviewedAt && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {formatDate(checkout.reviewedAt)}
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {checkoutTab === 0 && (
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<ApproveIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(checkout, 'approve');
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<RejectIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(checkout, 'reject');
                              }}
                            >
                              Reject
                            </Button>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={currentCheckouts.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
          )}
        </Paper>
      </Box>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog} onClose={() => !processing && setActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'approve' ? 'Approve Checkout Request' : 'Reject Checkout Request'}
        </DialogTitle>
        <DialogContent>
          {selectedCheckout && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Employee</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedCheckout.employeeName}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                  <Typography variant="body1">{formatDate(selectedCheckout.date)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Check In Time</Typography>
                  <Typography variant="body1">{formatTime(selectedCheckout.checkInTime)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Proposed Check Out Time</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: 'warning.main' }}>
                    {formatTime(selectedCheckout.checkOutTime)}
                  </Typography>
                </Grid>
                {selectedCheckout.reason && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                    <Typography variant="body2">{selectedCheckout.reason}</Typography>
                  </Grid>
                )}
              </Grid>

              {actionType === 'reject' && (
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Reason for Rejection *"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this checkout request"
                    required
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setActionDialog(false)} disabled={processing}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={handleConfirmAction}
            disabled={processing}
          >
            {processing ? <CircularProgress size={24} /> : `Confirm ${actionType === 'approve' ? 'Approval' : 'Rejection'}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Employee Detail Dialog */}
      <Dialog
        open={employeeDetailDialog}
        onClose={() => setEmployeeDetailDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PersonIcon color="primary" />
            <Typography variant="h6">Employee Details</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {loadingEmployeeData ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
            </Box>
          ) : selectedEmployee ? (
            <Box>
              {/* Employee Personal Information */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon color="primary" />
                    Personal Information
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Full Name</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        <EmailIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        Email
                      </Typography>
                      <Typography variant="body1">{selectedEmployee.email}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        <PhoneIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        Phone
                      </Typography>
                      <Typography variant="body1">{selectedEmployee.phoneNumber || 'N/A'}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        <BusinessIcon sx={{ fontSize: 14, verticalAlign: 'middle', mr: 0.5 }} />
                        Company
                      </Typography>
                      <Typography variant="body1">
                        {selectedEmployee.company || selectedEmployee.originalCompanyName || 'N/A'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Position</Typography>
                      <Chip
                        label={selectedEmployee.position || 'N/A'}
                        color="primary"
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Department</Typography>
                      <Typography variant="body1">{selectedEmployee.department || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Forgotten Checkout Requests Section */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="primary" />
                    Pending Checkout Requests ({employeeCheckouts.length})
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {employeeCheckouts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No pending checkout requests
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                      {employeeCheckouts.map((checkout, index) => (
                        <Box
                          key={checkout.id}
                          sx={{
                            mb: 2,
                            p: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            backgroundColor: 'background.paper'
                          }}
                        >
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                  {formatDate(checkout.date)}
                                </Typography>
                                <Chip
                                  label={checkout.status?.toUpperCase() || 'N/A'}
                                  color={
                                    checkout.status === 'approved' ? 'success' :
                                    checkout.status === 'rejected' ? 'error' :
                                    'warning'
                                  }
                                  size="small"
                                />
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Check In Time</Typography>
                              <Typography variant="body2">{formatTime(checkout.checkInTime)}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Proposed Check Out</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main' }}>
                                {formatTime(checkout.checkOutTime)}
                              </Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="caption" color="text.secondary">Submitted</Typography>
                              <Typography variant="body2">{formatDate(checkout.createdAt)}</Typography>
                            </Grid>
                            {checkout.reason && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Reason</Typography>
                                <Typography variant="body2">{checkout.reason}</Typography>
                              </Grid>
                            )}
                            {checkout.status === 'rejected' && checkout.rejectionReason && (
                              <Grid item xs={12}>
                                <Alert severity="error" sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary">Rejection Reason</Typography>
                                  <Typography variant="body2">{checkout.rejectionReason}</Typography>
                                </Alert>
                              </Grid>
                            )}
                            {checkout.reviewedByName && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  Reviewed by: {checkout.reviewedByName} ({checkout.reviewedByPosition}) on {formatDate(checkout.reviewedAt)}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
              No employee data available
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmployeeDetailDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TeamCheckouts;
