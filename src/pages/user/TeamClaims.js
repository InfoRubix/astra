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
  Description as DescriptionIcon,
  Check as ApproveIcon,
  Info as InfoIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getSubordinates, getPositionLevel, getPositionLevelName } from '../../utils/positionHierarchy';

function TeamClaims() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [approvedClaims, setApprovedClaims] = useState([]);
  const [rejectedClaims, setRejectedClaims] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Employee detail dialog
  const [employeeDetailDialog, setEmployeeDetailDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [employeeClaims, setEmployeeClaims] = useState([]);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);

  // Tabs
  const [tabValue, setTabValue] = useState(0); // 0: pending, 1: approved, 2: rejected

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
      setSubordinates(subs);

      // Load ALL claims from subordinates (pending, approved, rejected)
      if (subs.length > 0) {
        const subordinateIds = subs.map(s => s.id);

        const claimsQuery = query(collection(db, 'claims'));
        const claimsSnapshot = await getDocs(claimsQuery);
        const allClaims = claimsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(claim => subordinateIds.includes(claim.userId)); // Filter to subordinates only

        // Add employee details to each claim
        const claimsWithDetails = allClaims.map(claim => {
          const employee = users.find(u => u.id === claim.userId);
          return {
            ...claim,
            employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
            employeePosition: employee?.position || 'N/A',
            employeeCompany: employee?.company || employee?.originalCompanyName || 'N/A'
          };
        });

        // Split by status
        const pending = claimsWithDetails.filter(c => c.status === 'pending');
        const approved = claimsWithDetails.filter(c => c.status === 'approved');
        const rejected = claimsWithDetails.filter(c => c.status === 'rejected');

        // Sort by submission date (newest first)
        const sortByDate = (a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        };

        pending.sort(sortByDate);
        approved.sort(sortByDate);
        rejected.sort(sortByDate);

        setPendingClaims(pending);
        setApprovedClaims(approved);
        setRejectedClaims(rejected);
      } else {
        setPendingClaims([]);
        setApprovedClaims([]);
        setRejectedClaims([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeClick = async (claim) => {
    setSelectedEmployee(null);
    setEmployeeLeaves([]);
    setEmployeeClaims([]);
    setEmployeeDetailDialog(true);
    setLoadingEmployeeData(true);

    try {
      // Find employee details
      const employee = allUsers.find(u => u.id === claim.userId);
      setSelectedEmployee(employee);

      // Load only pending leaves for this employee
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('userId', '==', claim.userId),
        where('status', '==', 'pending')
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const leaves = leavesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by created date (newest first)
      leaves.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      setEmployeeLeaves(leaves);

      // Load only pending claims for this employee
      const claimsQuery = query(
        collection(db, 'claims'),
        where('userId', '==', claim.userId),
        where('status', '==', 'pending')
      );
      const claimsSnapshot = await getDocs(claimsQuery);
      const claims = claimsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by created date (newest first)
      claims.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });
      setEmployeeClaims(claims);
    } catch (error) {
      console.error('Error loading employee data:', error);
      setMessage('Error loading employee details');
      setMessageType('error');
    } finally {
      setLoadingEmployeeData(false);
    }
  };

  const handleActionClick = (claim, type) => {
    setSelectedClaim(claim);
    setActionType(type);
    setRejectionReason('');
    setActionDialog(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedClaim) return;

    if (actionType === 'reject' && !rejectionReason.trim()) {
      setMessage('Please provide a reason for rejection');
      setMessageType('error');
      return;
    }

    setProcessing(true);
    try {
      const claimRef = doc(db, 'claims', selectedClaim.id);
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

      await updateDoc(claimRef, updateData);

      setMessage(`Claim ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`);
      setMessageType('success');
      setActionDialog(false);
      setSelectedClaim(null);

      // Reload data
      await loadData();

      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } catch (error) {
      console.error('Error updating claim:', error);
      setMessage('Error processing claim');
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

  const getLeaveTypeColor = (type) => {
    const colors = {
      annual: 'primary',
      sick: 'warning',
      emergency: 'error',
      maternity: 'secondary'
    };
    return colors[type] || 'default';
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPage(0); // Reset pagination when switching tabs
  };

  // Get current claims based on tab
  const getCurrentClaims = () => {
    switch (tabValue) {
      case 0:
        return pendingClaims;
      case 1:
        return approvedClaims;
      case 2:
        return rejectedClaims;
      default:
        return [];
    }
  };

  const currentClaims = getCurrentClaims();

  // Calculate displayed rows based on pagination
  const displayedClaims = currentClaims.slice(
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
            Team Claims Approvals
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
            Team Claims Approvals
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Review and approve expense claims from your team members
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
                  <Typography variant="h6">Pending Claims</Typography>
                </Box>
                <Typography variant="h4" color="warning.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {pendingClaims.length}
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

        {/* Expense Claims with Tabs */}
        <Paper sx={{ borderRadius: 2 }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              sx={{ px: 3, pt: 2 }}
            >
              <Tab
                label={`Pending (${pendingClaims.length})`}
                icon={<PendingIcon />}
                iconPosition="start"
              />
              <Tab
                label={`Approved (${approvedClaims.length})`}
                icon={<CheckCircle />}
                iconPosition="start"
              />
              <Tab
                label={`Rejected (${rejectedClaims.length})`}
                icon={<RejectIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {currentClaims.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <DescriptionIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3, color: 'text.secondary' }} />
              <Typography variant="h6" color="text.secondary">
                No {tabValue === 0 ? 'Pending' : tabValue === 1 ? 'Approved' : 'Rejected'} Claims
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tabValue === 0
                  ? 'All expense claims have been processed'
                  : tabValue === 1
                  ? 'No approved claims to display'
                  : 'No rejected claims to display'
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
                      <TableCell><strong>Claim Type</strong></TableCell>
                      <TableCell><strong>Amount</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Submitted</strong></TableCell>
                      {tabValue !== 0 && <TableCell><strong>Reviewed By</strong></TableCell>}
                      {tabValue === 0 && <TableCell align="center"><strong>Actions</strong></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedClaims.map((claim) => (
                    <TableRow
                      key={claim.id}
                      hover
                      onClick={() => handleEmployeeClick(claim)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {claim.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {claim.employeeCompany}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={claim.employeePosition}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={claim.claimType?.charAt(0).toUpperCase() + claim.claimType?.slice(1) || 'N/A'}
                          color="primary"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          RM {claim.amount?.toFixed(2) || '0.00'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {claim.description || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(claim.createdAt)}</TableCell>
                      {tabValue !== 0 && (
                        <TableCell>
                          <Typography variant="body2">{claim.reviewedByName || 'N/A'}</Typography>
                          {claim.reviewedAt && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {formatDate(claim.reviewedAt)}
                            </Typography>
                          )}
                        </TableCell>
                      )}
                      {tabValue === 0 && (
                        <TableCell align="center">
                          <Box display="flex" gap={1} justifyContent="center">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              startIcon={<ApproveIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActionClick(claim, 'approve');
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
                                handleActionClick(claim, 'reject');
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
              count={currentClaims.length}
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
          {actionType === 'approve' ? 'Approve Claim' : 'Reject Claim'}
        </DialogTitle>
        <DialogContent>
          {selectedClaim && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Employee</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedClaim.employeeName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Claim Type</Typography>
                  <Typography variant="body1">
                    {selectedClaim.claimType?.charAt(0).toUpperCase() + selectedClaim.claimType?.slice(1) || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="text.secondary">Amount</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    RM {selectedClaim.amount?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                {selectedClaim.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                    <Typography variant="body2">{selectedClaim.description}</Typography>
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
                    placeholder="Please provide a reason for rejecting this claim"
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

              {/* Leave Requests Section */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CalendarIcon color="primary" />
                    Pending Leave Requests ({employeeLeaves.length})
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {employeeLeaves.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No pending leave requests
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {employeeLeaves.map((leave, index) => (
                        <Box
                          key={leave.id}
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
                                <Chip
                                  label={leave.leaveType?.charAt(0).toUpperCase() + leave.leaveType?.slice(1) || 'N/A'}
                                  color={getLeaveTypeColor(leave.leaveType)}
                                  size="small"
                                />
                                <Chip
                                  label={leave.status?.toUpperCase() || 'N/A'}
                                  color={
                                    leave.status === 'approved' ? 'success' :
                                    leave.status === 'rejected' ? 'error' :
                                    'warning'
                                  }
                                  size="small"
                                />
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Start Date</Typography>
                              <Typography variant="body2">{formatDate(leave.startDate)}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">End Date</Typography>
                              <Typography variant="body2">{formatDate(leave.endDate)}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Duration</Typography>
                              <Typography variant="body2">{leave.totalDays || 0} days</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Submitted</Typography>
                              <Typography variant="body2">{formatDate(leave.createdAt)}</Typography>
                            </Grid>
                            {leave.reason && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Reason</Typography>
                                <Typography variant="body2">{leave.reason}</Typography>
                              </Grid>
                            )}
                            {leave.supportingDocuments && leave.supportingDocuments.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <AttachFileIcon sx={{ fontSize: 14 }} />
                                  Attachments
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  {leave.supportingDocuments.map((doc, idx) => (
                                    <Button
                                      key={idx}
                                      size="small"
                                      startIcon={<DownloadIcon />}
                                      onClick={() => window.open(doc.url, '_blank')}
                                      sx={{ mr: 1, mb: 1 }}
                                    >
                                      {doc.name || `Document ${idx + 1}`}
                                    </Button>
                                  ))}
                                </Box>
                              </Grid>
                            )}
                            {leave.status === 'rejected' && leave.rejectionReason && (
                              <Grid item xs={12}>
                                <Alert severity="error" sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary">Rejection Reason</Typography>
                                  <Typography variant="body2">{leave.rejectionReason}</Typography>
                                </Alert>
                              </Grid>
                            )}
                            {leave.reviewedByName && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  Reviewed by: {leave.reviewedByName} ({leave.reviewedByPosition}) on {formatDate(leave.reviewedAt)}
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

              {/* Claims Section */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DescriptionIcon color="primary" />
                    Pending Claims ({employeeClaims.length})
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {employeeClaims.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
                      No pending claims
                    </Typography>
                  ) : (
                    <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                      {employeeClaims.map((claim, index) => (
                        <Box
                          key={claim.id}
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
                                <Chip
                                  label={claim.claimType?.charAt(0).toUpperCase() + claim.claimType?.slice(1) || 'N/A'}
                                  color="primary"
                                  size="small"
                                />
                                <Chip
                                  label={claim.status?.toUpperCase() || 'N/A'}
                                  color={
                                    claim.status === 'approved' ? 'success' :
                                    claim.status === 'rejected' ? 'error' :
                                    'warning'
                                  }
                                  size="small"
                                />
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Amount</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                RM {claim.amount?.toFixed(2) || '0.00'}
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary">Submitted</Typography>
                              <Typography variant="body2">{formatDate(claim.createdAt)}</Typography>
                            </Grid>
                            {claim.description && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">Description</Typography>
                                <Typography variant="body2">{claim.description}</Typography>
                              </Grid>
                            )}
                            {claim.receipts && claim.receipts.length > 0 && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <AttachFileIcon sx={{ fontSize: 14 }} />
                                  Receipts
                                </Typography>
                                <Box sx={{ mt: 1 }}>
                                  {claim.receipts.map((receipt, idx) => (
                                    <Button
                                      key={idx}
                                      size="small"
                                      startIcon={<DownloadIcon />}
                                      onClick={() => window.open(receipt.url, '_blank')}
                                      sx={{ mr: 1, mb: 1 }}
                                    >
                                      {receipt.name || `Receipt ${idx + 1}`}
                                    </Button>
                                  ))}
                                </Box>
                              </Grid>
                            )}
                            {claim.status === 'rejected' && claim.rejectionReason && (
                              <Grid item xs={12}>
                                <Alert severity="error" sx={{ mt: 1 }}>
                                  <Typography variant="caption" color="text.secondary">Rejection Reason</Typography>
                                  <Typography variant="body2">{claim.rejectionReason}</Typography>
                                </Alert>
                              </Grid>
                            )}
                            {claim.reviewedByName && (
                              <Grid item xs={12}>
                                <Typography variant="caption" color="text.secondary">
                                  Reviewed by: {claim.reviewedByName} on {formatDate(claim.reviewedAt)}
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

export default TeamClaims;
