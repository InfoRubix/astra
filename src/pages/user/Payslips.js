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
  Chip,
  Avatar,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tab,
  Tabs,
  Badge,
  Fab,
  Skeleton
} from '@mui/material';
import { 
  Payment,
  Download,
  Visibility,
  AttachMoney,
  CalendarMonth,
  Receipt,
  Schedule
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { pdfService } from '../../services/pdfService';

function UserPayslips() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [error, setError] = useState('');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  useEffect(() => {
    if (user) {
      loadUserPayslips();
    }
  }, [user]);

  const loadUserPayslips = async () => {
    setLoading(true);
    try {
      // Query payslips for the current user
      const q = query(
        collection(db, 'payslips'),
        where('employeeId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const payslipsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      // Filter out draft payslips - users should only see approved and paid payslips
      const visiblePayslips = payslipsList.filter(payslip => 
        payslip.status === 'approved' || payslip.status === 'paid'
      );
      
      // Sort by month (most recent first)
      const sortedPayslips = visiblePayslips.sort((a, b) => {
        try {
          return new Date(b.month + '-01') - new Date(a.month + '-01');
        } catch (error) {
          return 0;
        }
      });
      
      setPayslips(sortedPayslips);
    } catch (error) {
      console.error('Error loading payslips:', error);
      setError('Failed to load payslips: ' + error.message);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'success';
      case 'paid': return 'info';
      default: return 'default';
    }
  };

  const handleViewDetails = (payslip) => {
    setSelectedPayslip(payslip);
    setDetailDialog(true);
  };

  const handleDownloadPDF = async (payslip) => {
    try {
      const success = await pdfService.exportPayslip(payslip);
      if (!success) {
        setError('Failed to generate PDF. Please try again.');
      }
    } catch (error) {
      console.error('PDF download error:', error);
      setError('Failed to download PDF. Please try again.');
    }
  };

  const filterByStatus = (status) => {
    if (status === 'all') return payslips;
    return payslips.filter(p => p.status === status);
  };

  const getTabData = () => [
    { label: 'All', count: payslips.length, status: 'all' },
    { label: 'Approved', count: payslips.filter(p => p.status === 'approved').length, status: 'approved' },
    { label: 'Paid', count: payslips.filter(p => p.status === 'paid').length, status: 'paid' }
  ];

  const currentPayslips = filterByStatus(getTabData()[tabValue].status);

  // Calculate statistics
  const totalPayslips = payslips.length;
  const totalEarnings = payslips.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.netSalary || 0), 0);
  const pendingPayslips = payslips.filter(p => p.status === 'approved').length;
  const currentMonthPayslip = payslips.find(p => p.month === format(new Date(), 'yyyy-MM'));

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
              <Box>
                <Skeleton variant="text" width={200} height={45} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width={300} height={25} />
              </Box>
            </Box>
          </Box>
          <Skeleton variant="rectangular" width={60} height={4} sx={{ borderRadius: 2 }} />
        </Box>

        {/* Payslips Table Skeleton */}
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
          {/* Tabs Skeleton */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
            <Skeleton variant="rectangular" width="50%" height={56} sx={{ borderRadius: 1 }} />
          </Box>

          <Box sx={{ p: 4 }}>
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
                      <TableCell>
                        <Skeleton variant="text" width="90%" height={24} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="80%" height={20} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 12 }} />
                      </TableCell>
                      <TableCell>
                        <Skeleton variant="text" width="70%" height={20} />
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Skeleton variant="rectangular" width={70} height={32} sx={{ borderRadius: 1 }} />
                          <Skeleton variant="rectangular" width={90} height={32} sx={{ borderRadius: 1 }} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
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
              <Payment sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                My Payslips
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                View and download your salary statements
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Enhanced Payslips List */}
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
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 56,
                color: 'text.secondary',
                '&.Mui-selected': {
                  color: 'primary.main',
                  fontWeight: 700
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'primary.main',
                height: 3,
                borderRadius: '3px 3px 0 0'
              }
            }}
          >
            {getTabData().map((tab, index) => (
              <Tab 
                key={index}
                label={
                  <Badge 
                    badgeContent={tab.status === 'sent' ? tab.count : null} 
                    color="primary" 
                    sx={{ mr: 1 }}
                  >
                    {tab.label} ({tab.count})
                  </Badge>
                }
              />
            ))}
          </Tabs>
        </Box>
        
        <Box sx={{ p: 4 }}>
          {currentPayslips.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Payment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No payslips found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tabValue === 0 ? 
                  "You don't have any payslips yet." :
                  `No ${getTabData()[tabValue].label.toLowerCase()} payslips available.`
                }
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell>Gross Salary</TableCell>
                    <TableCell>Deductions</TableCell>
                    <TableCell>Net Salary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentPayslips.map((payslip) => (
                    <TableRow key={payslip.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                          {format(new Date(payslip.month + '-01'), 'MMMM yyyy')}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          RM {payslip.grossSalary?.toFixed(2) || '0.00'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          RM {(
                            (payslip.employeeEPF || 0) + 
                            (payslip.employeeEIS || 0) + 
                            (payslip.employeeSOCSO || 0) + 
                            (payslip.zakat || 0) + 
                            (payslip.mtdPCB || 0) + 
                            (payslip.loanDeduction || 0) + 
                            (payslip.insurance || 0) + 
                            (payslip.advanceSalary || 0) + 
                            (payslip.uniformEquipment || 0) + 
                            (payslip.disciplinaryFine || 0) + 
                            (payslip.otherMisc || 0)
                          ).toFixed(2)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          RM {payslip.netSalary?.toFixed(2) || '0.00'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={payslip.status?.charAt(0).toUpperCase() + payslip.status?.slice(1) || 'Unknown'}
                          color={getStatusColor(payslip.status)}
                          size="small"
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {format(payslip.createdAt, 'dd/MM/yyyy')}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Visibility />}
                            onClick={() => handleViewDetails(payslip)}
                          >
                            View
                          </Button>
                          {(payslip.status === 'approved' || payslip.status === 'paid') && (
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<Download />}
                              onClick={() => handleDownloadPDF(payslip)}
                            >
                              Download
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>

      {/* Payslip Detail Dialog */}
      <Dialog 
        open={detailDialog} 
        onClose={() => setDetailDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
              borderRadius: 'inherit',
              zIndex: -1
            }
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)'
          }
        }}
      >
        {selectedPayslip && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Payment sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">
                    Payslip - {format(new Date(selectedPayslip.month + '-01'), 'MMMM yyyy')}
                  </Typography>
                </Box>
                <Chip 
                  label={selectedPayslip.status?.charAt(0).toUpperCase() + selectedPayslip.status?.slice(1)}
                  color={getStatusColor(selectedPayslip.status)}
                  size="small"
                />
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Grid container spacing={3}>
                {/* Employee Information */}
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Employee Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Name:</strong> {selectedPayslip.employeeName}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Email:</strong> {selectedPayslip.employeeEmail}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
                
                {/* Salary Breakdown */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom color="primary">
                    Salary Breakdown
                  </Typography>
                  
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        {selectedPayslip.calculationMethod === 'hourly' && (
                          <>
                            <TableRow>
                              <TableCell><strong>Hours Worked</strong></TableCell>
                              <TableCell align="right">{selectedPayslip.hoursWorked} hours</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell><strong>Hourly Rate</strong></TableCell>
                              <TableCell align="right">RM {selectedPayslip.hourlyRate?.toFixed(2)}</TableCell>
                            </TableRow>
                          </>
                        )}
                        <TableRow>
                          <TableCell><strong>Basic Salary</strong></TableCell>
                          <TableCell align="right">RM {selectedPayslip.basicSalary?.toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Allowances</strong></TableCell>
                          <TableCell align="right">RM {selectedPayslip.allowances?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Overtime</strong></TableCell>
                          <TableCell align="right">RM {selectedPayslip.overtime?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Bonus</strong></TableCell>
                          <TableCell align="right">RM {selectedPayslip.bonus?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Gross Salary</strong></TableCell>
                          <TableCell align="right"><strong>RM {selectedPayslip.grossSalary?.toFixed(2)}</strong></TableCell>
                        </TableRow>
                        
                        {/* Detailed Deductions Breakdown */}
                        {(selectedPayslip.employeeEPF > 0 || selectedPayslip.employeeEIS > 0 || selectedPayslip.employeeSOCSO > 0) && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                              Statutory Deductions
                            </TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.employeeEPF > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Employee EPF (11%)</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.employeeEPF?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.employeeEIS > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Employee EIS</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.employeeEIS?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.employeeSOCSO > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Employee SOCSO</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.employeeSOCSO?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {(selectedPayslip.zakat > 0 || selectedPayslip.mtdPCB > 0) && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                              Tax Deductions
                            </TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.zakat > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Zakat</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.zakat?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.mtdPCB > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>MTD/PCB Tax</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.mtdPCB?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {(selectedPayslip.loanDeduction > 0 || selectedPayslip.insurance > 0 || selectedPayslip.advanceSalary > 0 || selectedPayslip.uniformEquipment > 0 || selectedPayslip.disciplinaryFine > 0 || selectedPayslip.otherMisc > 0) && (
                          <TableRow>
                            <TableCell colSpan={2} sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                              Other Deductions
                            </TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.loanDeduction > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Loan Deduction</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.loanDeduction?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.insurance > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Insurance</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.insurance?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.advanceSalary > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Advance Salary</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.advanceSalary?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.uniformEquipment > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Uniform/Equipment</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.uniformEquipment?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.disciplinaryFine > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Disciplinary Fine</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.disciplinaryFine?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {selectedPayslip.otherMisc > 0 && (
                          <TableRow>
                            <TableCell sx={{ pl: 4 }}>Other Misc</TableCell>
                            <TableCell align="right" color="error.main">-RM {selectedPayslip.otherMisc?.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        
                        <TableRow>
                          <TableCell><strong>Total Deductions</strong></TableCell>
                          <TableCell align="right" color="error.main">
                            <strong>-RM {(
                              (selectedPayslip.employeeEPF || 0) + 
                              (selectedPayslip.employeeEIS || 0) + 
                              (selectedPayslip.employeeSOCSO || 0) + 
                              (selectedPayslip.zakat || 0) + 
                              (selectedPayslip.mtdPCB || 0) + 
                              (selectedPayslip.loanDeduction || 0) + 
                              (selectedPayslip.insurance || 0) + 
                              (selectedPayslip.advanceSalary || 0) + 
                              (selectedPayslip.uniformEquipment || 0) + 
                              (selectedPayslip.disciplinaryFine || 0) + 
                              (selectedPayslip.otherMisc || 0)
                            ).toFixed(2)}</strong>
                          </TableCell>
                        </TableRow>
                        
                        <TableRow sx={{ bgcolor: 'primary.50' }}>
                          <TableCell><strong>Net Salary</strong></TableCell>
                          <TableCell align="right">
                            <Typography variant="h6" color="primary.main">
                              RM {selectedPayslip.netSalary?.toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                
                {/* Additional Information */}
                <Grid item xs={12}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Payment Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Status:</strong> 
                          <Chip 
                            label={selectedPayslip.status?.charAt(0).toUpperCase() + selectedPayslip.status?.slice(1)}
                            color={getStatusColor(selectedPayslip.status)}
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2">
                          <strong>Created:</strong> {format(selectedPayslip.createdAt, 'dd/MM/yyyy')}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setDetailDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default UserPayslips;