import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Business,
  People,
  EventAvailable,
  Receipt,
  LocationOn,
  Phone,
  Email,
  Person,
  Close
} from '@mui/icons-material';
import { useBranchDetails } from '../hooks/useBranches';

function BranchDetailsModal({ open, onClose, branchId, branchName }) {
  const { branch, statistics, loading, error } = useBranchDetails(branchId);

  if (!open) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <Business />
          </Avatar>
          <Box>
            <Typography variant="h6">
              {branchName || branch?.name || 'Branch Details'}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Detailed information and statistics
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={onClose}
          variant="outlined"
          startIcon={<Close />}
          size="small"
        >
          Close
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 3 }}>
            <Typography color="error">Error loading branch details: {error}</Typography>
          </Box>
        ) : branch ? (
          <Box sx={{ p: 3 }}>
            {/* Branch Information */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Branch Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business color="action" />
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Branch Name
                          </Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {branch.name}
                          </Typography>
                        </Box>
                      </Box>

                      {branch.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LocationOn color="action" />
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              Location
                            </Typography>
                            <Typography variant="body1">
                              {branch.location}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {branch.address && (
                        <Box sx={{ ml: 4 }}>
                          <Typography variant="body2" color="textSecondary">
                            Address
                          </Typography>
                          <Typography variant="body1">
                            {branch.address}
                          </Typography>
                        </Box>
                      )}

                      {branch.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone color="action" />
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              Phone
                            </Typography>
                            <Typography variant="body1">
                              {branch.phone}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {branch.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Email color="action" />
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              Email
                            </Typography>
                            <Typography variant="body1">
                              {branch.email}
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={branch.isActive === false ? 'Inactive' : 'Active'}
                          color={branch.isActive === false ? 'default' : 'success'}
                          size="small"
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                {/* Statistics Cards */}
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <People fontSize="large" color="primary" />
                        <Typography variant="h4" color="primary" sx={{ mt: 1 }}>
                          {statistics?.totalEmployees || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Total Employees
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <EventAvailable fontSize="large" color="warning" />
                        <Typography variant="h4" color="warning.main" sx={{ mt: 1 }}>
                          {statistics?.pendingLeaves || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Pending Leaves
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <Receipt fontSize="large" color="error" />
                        <Typography variant="h4" color="error.main" sx={{ mt: 1 }}>
                          {statistics?.pendingClaims || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Pending Claims
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={6}>
                    <Card>
                      <CardContent sx={{ textAlign: 'center' }}>
                        <EventAvailable fontSize="large" color="success" />
                        <Typography variant="h4" color="success.main" sx={{ mt: 1 }}>
                          {statistics?.approvedLeaves || 0}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Approved Leaves
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* Employees List */}
            <Typography variant="h6" gutterBottom>
              Branch Employees ({statistics?.employees?.length || 0})
            </Typography>
            
            {statistics?.employees && statistics.employees.length > 0 ? (
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 300 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statistics.employees.map((employee, index) => (
                      <TableRow key={employee.id || index} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={500}>
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {employee.uid?.slice(-8)}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={employee.role || 'Employee'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {employee.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label="Active"
                            color="success"
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center', mt: 2 }}>
                <People fontSize="large" color="disabled" />
                <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                  No employees assigned to this branch
                </Typography>
              </Paper>
            )}

            {/* Recent Activity */}
            {(statistics?.leaves?.length > 0 || statistics?.claims?.length > 0) && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                
                <Grid container spacing={2}>
                  {statistics?.leaves?.slice(0, 3).map((leave, index) => (
                    <Grid item xs={12} sm={6} key={`leave-${index}`}>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <EventAvailable fontSize="small" color="warning" />
                          <Typography variant="subtitle2">
                            Leave Request
                          </Typography>
                          <Chip
                            label={leave.status}
                            size="small"
                            color={leave.status === 'pending' ? 'warning' : 'success'}
                          />
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          {leave.type} - {leave.reason?.slice(0, 50)}...
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                  
                  {statistics?.claims?.slice(0, 3).map((claim, index) => (
                    <Grid item xs={12} sm={6} key={`claim-${index}`}>
                      <Paper sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Receipt fontSize="small" color="error" />
                          <Typography variant="subtitle2">
                            Claim Request
                          </Typography>
                          <Chip
                            label={claim.status}
                            size="small"
                            color={claim.status === 'pending' ? 'warning' : 'success'}
                          />
                        </Box>
                        <Typography variant="body2" color="textSecondary">
                          RM {claim.amount} - {claim.description?.slice(0, 50)}...
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography>Branch not found</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BranchDetailsModal;