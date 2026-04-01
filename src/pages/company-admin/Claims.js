import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Tabs,
  Tab,
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
  Grid,
  Card,
  CardContent,
  Divider,
  Badge,
  CircularProgress
} from '@mui/material';
import { 
  MoreVert,
  CheckCircle,
  Cancel,
  Schedule,
  AttachMoney,
  Receipt,
  Person,
  CalendarToday,
  Download,
  Visibility,
  LocalGasStation,
  Restaurant,
  DirectionsCar,
  Hotel,
  Business,
  ArrowForward,
  ArrowBack,
  Print
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { pdfService } from '../../services/pdfService';

function CompanyAdminClaims() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [actionReason, setActionReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const claimsPerPage = 4;
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('🔍 Company Admin Claims useEffect - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        fullUserObject: user
      });
      loadClaims();
    } else {
      console.log('🔍 Company Admin Claims useEffect - No user yet');
    }
  }, [user]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const userCompany = user.originalCompanyName || user.company || '';
      console.log('🔍 Company Admin loading claims for company:', userCompany);
      
      // Load claims only for this company admin's company
      const q = query(
        collection(db, 'claims'),
        where('originalCompanyName', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      const companyClaims = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('🔍 Total claims loaded for company:', companyClaims.length);
      
      // Sort by submitted date (most recent first)
      companyClaims.sort((a, b) => {
        const aDate = a.submittedDate?.toDate ? a.submittedDate.toDate() : new Date(a.submittedDate);
        const bDate = b.submittedDate?.toDate ? b.submittedDate.toDate() : new Date(b.submittedDate);
        return bDate - aDate;
      });
      
      setClaims(companyClaims);
      console.log('🔍 Company claims set for company admin view');
    } catch (error) {
      console.error('Error loading claims:', error);
      setError('Failed to load claims: ' + error.message);
    }
    setLoading(false);
  };

  const handleMenuClick = (event, claim) => {
    console.log('Menu clicked for claim:', claim?.id, claim?.status);
    setAnchorEl(event.currentTarget);
    setSelectedClaim(claim);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedClaim(null);
  };

  const handleAction = (action) => {
    console.log('handleAction called with:', action, 'selectedClaim:', selectedClaim?.id);
    setActionType(action);
    setActionDialog(true);
    // Close menu but don't clear selectedClaim - we need it for the dialog
    setAnchorEl(null);
  };

  const handleActionSubmit = async () => {
    if (!selectedClaim) {
      console.error('No selected claim');
      return;
    }
    
    console.log('Processing action:', actionType, 'for claim:', selectedClaim.id);
    setActionLoading(true);
    setError('');
    
    try {
      // Update Firestore document
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        [`${actionType === 'approve' ? 'approved' : 'rejected'}By`]: `${user.firstName} ${user.lastName}`,
        [`${actionType === 'approve' ? 'approved' : 'rejected'}ById`]: user.uid,
        [`${actionType === 'approve' ? 'approved' : 'rejected'}Date`]: serverTimestamp(),
        ...(actionType === 'reject' && { rejectionReason: actionReason }),
        ...(actionType === 'approve' && { 
          processedAmount: selectedClaim.amount,
          adminComments: actionReason || 'Approved by company admin'
        })
      };

      console.log('Updating claim with data:', updateData);
      await updateDoc(doc(db, 'claims', selectedClaim.id), updateData);
      console.log(`Claim ${actionType}d successfully:`, selectedClaim.id);

      // Create notification for user
      const notification = {
        userId: selectedClaim.userId,
        type: 'claim_update',
        title: actionType === 'approve' ? 'Claim Approved' : 'Claim Rejected',
        message: actionType === 'approve' 
          ? `Your ${selectedClaim.category} claim (${selectedClaim.currency} ${selectedClaim.amount}) has been approved`
          : `Your ${selectedClaim.category} claim has been rejected. ${actionReason ? 'Reason: ' + actionReason : ''}`,
        priority: 'high',
        read: false,
        createdAt: serverTimestamp(),
        claimId: selectedClaim.id,
        relatedData: {
          claimType: selectedClaim.claimType,
          category: selectedClaim.category,
          amount: selectedClaim.amount,
          currency: selectedClaim.currency,
          approvedBy: `${user.firstName} ${user.lastName}`
        }
      };

      await addDoc(collection(db, 'notifications'), notification);
      console.log('Notification created for user:', selectedClaim.userId);

      // Skip admin action notifications - only keep user notifications
      console.log('User notification created for claim action, skipping admin notification');
      
      // Reload claims to show updated status
      await loadClaims();
      
      setSuccess(`Claim ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setActionDialog(false);
      setActionReason('');
      setActionType('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      setSelectedClaim(null);
    } catch (error) {
      console.error('Error processing claim:', error);
      setError(`Failed to ${actionType} claim: ${error.message}`);
    }
    
    setActionLoading(false);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <CheckCircle />;
      case 'rejected': return <Cancel />;
      case 'pending': return <Schedule />;
      default: return <Schedule />;
    }
  };

  const getClaimTypeColor = (type) => {
    switch(type) {
      case 'travel': return 'primary';
      case 'meal': return 'secondary';
      case 'accommodation': return 'info';
      case 'fuel': return 'warning';
      case 'office': return 'success';
      default: return 'default';
    }
  };

  const getClaimTypeIcon = (type) => {
    switch(type) {
      case 'travel': return <DirectionsCar />;
      case 'meal': return <Restaurant />;
      case 'accommodation': return <Hotel />;
      case 'fuel': return <LocalGasStation />;
      case 'office': return <Business />;
      default: return <Receipt />;
    }
  };

  const getClaimTypeLabel = (type) => {
    switch(type) {
      case 'travel': return 'Travel';
      case 'meal': return 'Meals';
      case 'accommodation': return 'Accommodation';
      case 'fuel': return 'Fuel';
      case 'office': return 'Office Supplies';
      default: return type;
    }
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    try {
      const columns = [
        { 
          key: 'userName', 
          header: 'Employee', 
          width: 1.5 
        },
        { 
          key: 'userEmail', 
          header: 'Email', 
          width: 2 
        },
        { 
          key: 'department', 
          header: 'Department', 
          width: 1.2 
        },
        { 
          key: 'claimType', 
          header: 'Type', 
          width: 1,
          formatter: (claim) => getClaimTypeLabel(claim.claimType)
        },
        { 
          key: 'category', 
          header: 'Category', 
          width: 1.2 
        },
        { 
          key: 'amount', 
          header: 'Amount', 
          width: 1,
          formatter: (claim) => `${claim.currency} ${claim.amount.toFixed(2)}`
        },
        { 
          key: 'description', 
          header: 'Description', 
          width: 2,
          formatter: (claim) => claim.description.length > 50 ? claim.description.substring(0, 50) + '...' : claim.description
        },
        { 
          key: 'location', 
          header: 'Location', 
          width: 1.5 
        },
        { 
          key: 'claimDate', 
          header: 'Claim Date', 
          width: 1.2,
          formatter: (claim) => {
            try {
              const date = claim.claimDate?.toDate ? claim.claimDate.toDate() : new Date(claim.claimDate);
              return format(date, 'dd/MM/yyyy');
            } catch {
              return 'N/A';
            }
          }
        },
        { 
          key: 'submittedDate', 
          header: 'Submitted', 
          width: 1.2,
          formatter: (claim) => {
            try {
              const date = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
              return format(date, 'dd/MM/yyyy');
            } catch {
              return 'N/A';
            }
          }
        },
        { 
          key: 'status', 
          header: 'Status', 
          width: 1,
          formatter: (claim) => claim.status.charAt(0).toUpperCase() + claim.status.slice(1)
        },
        { 
          key: 'processedAmount', 
          header: 'Processed Amount', 
          width: 1.2,
          formatter: (claim) => claim.status === 'approved' && claim.processedAmount ? 
            `${claim.currency} ${claim.processedAmount?.toFixed(2) || "0.00"}` : 'N/A'
        }
      ];

      const currentTabData = getTabData()[tabValue];
      const filteredClaims = filterClaimsByStatus(currentTabData.status);
      
      const filters = {
        Status: currentTabData.label,
        Company: user.originalCompanyName || user.company || '',
        'Total Claims': filteredClaims.length
      };

      const success = await pdfService.createProfessionalPDF({
        title: 'Company Claims Management Report',
        data: filteredClaims,
        columns,
        filters,
        orientation: 'landscape',
        filename: pdfService.generateFilename('company_claims_report', filters),
        additionalInfo: {
          totalCount: filteredClaims.length,
          generatedBy: `${user.firstName} ${user.lastName}`,
          company: user.originalCompanyName || user.company || ''
        }
      });

      if (success) {
        setSuccess('Claims report exported successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to export claims report. Please try again.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (error) {
      console.error('Export error:', error);
      setError('Failed to export claims report: ' + error.message);
      setTimeout(() => setError(''), 3000);
    }
    setExportLoading(false);
  };

  const handlePrintClaim = async (claim) => {
    // Show loading state
    setActionLoading(true);
    
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4'); // Portrait
      
      // Header
      doc.setFontSize(18);
      doc.setTextColor(25, 118, 210);
      doc.text('Claim Details Report', 20, 25);
      
      // Claim ID and Status
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`Claim ID: ${claim.id}`, 20, 35);
      doc.text(`Status: ${claim.status.toUpperCase()}`, 20, 42);
      
      // Date generated
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, 20, 52);
      doc.text(`Generated by: ${user.firstName} ${user.lastName} (Company Admin)`, 20, 58);
      
      let yPos = 75;
      
      // Employee Information Section
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text('Employee Information', 20, yPos);
      yPos += 10;
      
      const employeeInfo = [
        ['Name', claim.userName],
        ['Email', claim.userEmail],
        ['Department', claim.department],
        ['Company', claim.originalCompanyName || '']
      ];
      
      doc.setFontSize(10);
      employeeInfo.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 25, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 70, yPos);
        yPos += 7;
      });
      
      yPos += 10;
      
      // Claim Information Section
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Claim Information', 20, yPos);
      yPos += 10;
      
      const claimInfo = [
        ['Type', getClaimTypeLabel(claim.claimType)],
        ['Category', claim.category],
        ['Amount', `${claim.currency} ${claim.amount.toFixed(2)}`],
        ['Location', claim.location],
        ['Claim Date', (() => {
          try {
            const date = claim.claimDate?.toDate ? claim.claimDate.toDate() : new Date(claim.claimDate);
            return format(date, 'dd MMMM yyyy');
          } catch {
            return 'Invalid date';
          }
        })()],
        ['Submitted Date', (() => {
          try {
            const date = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
            return format(date, 'dd MMMM yyyy HH:mm');
          } catch {
            return 'Invalid date';
          }
        })()]
      ];
      
      doc.setFontSize(10);
      claimInfo.forEach(([label, value]) => {
        doc.setFont(undefined, 'bold');
        doc.text(`${label}:`, 25, yPos);
        doc.setFont(undefined, 'normal');
        doc.text(String(value), 70, yPos);
        yPos += 7;
      });
      
      yPos += 5;
      
      // Description
      doc.setFont(undefined, 'bold');
      doc.text('Description:', 25, yPos);
      yPos += 7;
      doc.setFont(undefined, 'normal');
      
      // Handle long descriptions
      const description = claim.description;
      const maxWidth = 160;
      const lines = doc.splitTextToSize(description, maxWidth);
      
      lines.forEach(line => {
        doc.text(line, 25, yPos);
        yPos += 5;
      });
      
      yPos += 10;
      
      // Processing Information (if processed)
      if (claim.status === 'approved' || claim.status === 'rejected') {
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(claim.status === 'approved' ? 46 : 211, claim.status === 'approved' ? 125 : 47, claim.status === 'approved' ? 50 : 47);
        doc.text(`Processing Information (${claim.status.toUpperCase()})`, 20, yPos);
        yPos += 10;
        
        const processingInfo = [
          [`${claim.status === 'approved' ? 'Approved' : 'Rejected'} By`, claim.approvedBy || claim.rejectedBy],
          ['Date', (() => {
            try {
              const date = claim.approvedDate || claim.rejectedDate;
              if (!date) return 'N/A';
              const processDate = date?.toDate ? date.toDate() : new Date(date);
              return format(processDate, 'dd MMMM yyyy HH:mm');
            } catch {
              return 'Invalid date';
            }
          })()]
        ];
        
        if (claim.status === 'approved' && claim.processedAmount) {
          processingInfo.push(['Processed Amount', `${claim.currency} ${claim.processedAmount?.toFixed(2) || "0.00"}`]);
        }
        
        if (claim.adminComments) {
          processingInfo.push(['Admin Comments', claim.adminComments]);
        }
        
        if (claim.rejectionReason) {
          processingInfo.push(['Rejection Reason', claim.rejectionReason]);
        }
        
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        
        processingInfo.forEach(([label, value]) => {
          doc.setFont(undefined, 'bold');
          doc.text(`${label}:`, 25, yPos);
          doc.setFont(undefined, 'normal');
          
          if (label === 'Admin Comments' || label === 'Rejection Reason') {
            yPos += 5;
            const commentLines = doc.splitTextToSize(String(value), maxWidth);
            commentLines.forEach(line => {
              doc.text(line, 25, yPos);
              yPos += 5;
            });
          } else {
            doc.text(String(value), 70, yPos);
            yPos += 7;
          }
        });
      }
      
      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`This is a computer-generated document from ${user.originalCompanyName || user.company || ''}`, 20, pageHeight - 20);
      doc.text('Confidential - For internal use only', 20, pageHeight - 15);
      
      // Save the PDF
      const filename = `claim_${claim.id}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      setSuccess('Claim details exported successfully!');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Print claim error:', error);
      setError('Failed to print claim details: ' + error.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setActionLoading(false);
    }
    
    // Close menu
    handleMenuClose();
  };

  const filterClaimsByStatus = (status) => {
    if (status === 'all') return claims;
    return claims.filter(claim => claim.status === status);
  };

  const getTabData = () => [
    { label: 'All Claims', count: claims.length, status: 'all' },
    { label: 'Pending', count: claims.filter(c => c.status === 'pending').length, status: 'pending' },
    { label: 'Approved', count: claims.filter(c => c.status === 'approved').length, status: 'approved' },
    { label: 'Rejected', count: claims.filter(c => c.status === 'rejected').length, status: 'rejected' }
  ];

  const currentClaims = filterClaimsByStatus(getTabData()[tabValue].status);

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(0);
  }, [tabValue]);

  // Get paginated data
  const getPaginatedData = () => {
    const startIndex = safePage * claimsPerPage;
    return currentClaims.slice(startIndex, startIndex + claimsPerPage);
  };

  const totalPages = Math.max(1, Math.ceil(currentClaims.length / claimsPerPage));

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

  // Get paginated claims for display
  const paginatedClaims = getPaginatedData();

  // Summary stats
  const pendingCount = claims.filter(c => c.status === 'pending').length;
  const approvedThisMonth = claims.filter(c => {
    try {
      if (c.status !== 'approved' || !c.approvedDate) return false;
      const approvedDate = c.approvedDate?.toDate ? c.approvedDate.toDate() : new Date(c.approvedDate);
      return approvedDate.getMonth() === new Date().getMonth();
    } catch (error) {
      return false;
    }
  }).length;
  const totalAmountRequested = claims.reduce((sum, claim) => sum + claim.amount, 0);
  const totalAmountApproved = claims
    .filter(c => c.status === 'approved')
    .reduce((sum, claim) => sum + (claim.processedAmount || 0), 0);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading claims...
        </Typography>
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
              <Receipt sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Company Claims Management
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage expense claims for {user.originalCompanyName || user.company || 'your company'}
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="contained" 
            startIcon={exportLoading ? <CircularProgress size={20} color="inherit" /> : <Download />}
            onClick={handleExportPDF}
            disabled={exportLoading}
            sx={{
              py: 1.5,
              px: 3,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            {exportLoading ? 'Exporting...' : 'Export Report'}
          </Button>
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

      {/* Enhanced Summary Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        <Grid item xs={6} sm={6} md={3}>
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
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'warning.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(237, 108, 2, 0.3)'
                }}>  
                  <Schedule sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'warning.main'
                    }}
                  >
                    {pendingCount}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Pending Review
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
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
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'success.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(46, 125, 50, 0.3)'
                }}>  
                  <CheckCircle sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'success.main'
                    }}
                  >
                    {approvedThisMonth}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Approved This Month
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
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
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'info.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(2, 136, 209, 0.3)'
                }}>  
                  <AttachMoney sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'info.main'
                    }}
                  >
                    RM{totalAmountRequested.toFixed(2)}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Requested
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
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
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'primary.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                }}>  
                  <Receipt sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'primary.main'
                    }}
                  >
                    RM{totalAmountApproved.toFixed(2)}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Approved
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Claims Table */}
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
                    badgeContent={tab.status === 'pending' ? tab.count : null} 
                    color="error" 
                    sx={{ mr: 1 }}
                  >
                    {tab.label}
                  </Badge>
                }
              />
            ))}
          </Tabs>
        </Box>
        
        {/* Desktop Table View */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <TableContainer>
            <Table>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Claim Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedClaims.map((claim) => (
                <TableRow key={claim.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                        {claim.avatar}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {claim.userName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {claim.department} • {claim.userEmail}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getClaimTypeIcon(claim.claimType)}
                      <Chip 
                        label={getClaimTypeLabel(claim.claimType)}
                        color={getClaimTypeColor(claim.claimType)}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" color="primary">
                        {claim.currency} {claim.amount.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {claim.category}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }}>
                      {claim.description.length > 40 ? `${claim.description.substring(0, 40)}...` : claim.description}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      📍 {claim.location}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          const claimDate = claim.claimDate?.toDate ? claim.claimDate.toDate() : new Date(claim.claimDate);
                          return format(claimDate, 'MMM dd, yyyy');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Submitted: {(() => {
                        try {
                          const submittedDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
                          return format(submittedDate, 'MMM dd');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                      color={getStatusColor(claim.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell align="right">
                    <IconButton onClick={(e) => handleMenuClick(e, claim)}>
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </Box>

        {/* Mobile Card View */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {paginatedClaims.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              textAlign: 'center',
              py: 6,
              p: 2
            }}>
              <Avatar sx={{ fontSize: 64, bgcolor: 'grey.200', width: 80, height: 80, mb: 2 }}>
                💼
              </Avatar>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {getTabData()[tabValue].status === 'pending' ? 'No pending claims' : 
                 getTabData()[tabValue].status === 'approved' ? 'No approved claims yet' :
                 getTabData()[tabValue].status === 'rejected' ? 'No rejected claims' :
                 'No claims submitted yet'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {getTabData()[tabValue].status === 'pending' ? 'New expense claims will appear here for your review' : 
                 getTabData()[tabValue].status === 'approved' ? 'Approved expense claims will be shown here' :
                 getTabData()[tabValue].status === 'rejected' ? 'Rejected expense claims will be displayed here' :
                 'Employee expense claims will appear here once submitted'}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Grid container spacing={2}>
                {paginatedClaims.map((claim) => (
                  <Grid item xs={12} key={claim.id}>
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
                            {claim.avatar}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                              {claim.userName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {claim.department} • {claim.userEmail}
                            </Typography>
                          </Box>
                          <Chip 
                            label={claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                            color={getStatusColor(claim.status)}
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                              {getClaimTypeIcon(claim.claimType)}
                              <Chip 
                                label={getClaimTypeLabel(claim.claimType)}
                                color={getClaimTypeColor(claim.claimType)}
                                size="small"
                                sx={{ ml: 0.5, mr: 1 }}
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {claim.category}
                            </Typography>
                          </Box>
                          
                          <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold', mb: 1 }}>
                            {claim.currency} {claim.amount.toFixed(2)}
                          </Typography>
                          
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Description:</strong> {claim.description}
                          </Typography>
                          
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Location:</strong> 📍 {claim.location}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Claim Date: {(() => {
                                try {
                                  const claimDate = claim.claimDate?.toDate ? claim.claimDate.toDate() : new Date(claim.claimDate);
                                  return format(claimDate, 'MMM dd, yyyy');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              })()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Submitted: {(() => {
                                try {
                                  const submittedDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
                                  return format(submittedDate, 'MMM dd');
                                } catch (error) {
                                  return 'Invalid date';
                                }
                              })()}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<MoreVert />}
                          onClick={(e) => handleMenuClick(e, claim)}
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
          {currentClaims.length > claimsPerPage && totalPages > 1 && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 3,
              borderTop: 1,
              borderColor: 'divider'
            }}>
              {/* Page Info */}
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                Showing {safePage * claimsPerPage + 1} to{' '}
                {Math.min((safePage + 1) * claimsPerPage, currentClaims.length)} of{' '}
                {currentClaims.length} claims
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
                
                {/* Page Numbers */}
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
      {!isMobile && currentClaims.length > claimsPerPage && totalPages > 1 && (
        <Paper elevation={1} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {safePage * claimsPerPage + 1} to{' '}
              {Math.min((safePage + 1) * claimsPerPage, currentClaims.length)} of{' '}
              {currentClaims.length} claims
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
        <MenuItem onClick={() => handleAction('view')}>
          <Visibility sx={{ mr: 2 }} />
          View Details
        </MenuItem>
        
        <MenuItem 
          onClick={() => handlePrintClaim(selectedClaim)} 
          sx={{ color: 'primary.main' }}
          disabled={actionLoading}
        >
          {actionLoading ? <CircularProgress size={20} sx={{ mr: 2 }} /> : <Print sx={{ mr: 2 }} />}
          {actionLoading ? 'Generating PDF...' : 'Print Claim Details'}
        </MenuItem>
        
        {selectedClaim?.status === 'pending' && (
          <>
            <Divider />
            <MenuItem onClick={() => handleAction('approve')} sx={{ color: 'success.main' }}>
              <CheckCircle sx={{ mr: 2 }} />
              Approve Claim
            </MenuItem>
            <MenuItem onClick={() => handleAction('reject')} sx={{ color: 'error.main' }}>
              <Cancel sx={{ mr: 2 }} />
              Reject Claim
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialog} 
        onClose={() => {
          setActionDialog(false);
          setSelectedClaim(null);
          setActionType('');
          setActionReason('');
        }}
        maxWidth="sm"
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {actionType === 'view' ? (
              <Visibility sx={{ mr: 1, color: 'info.main' }} />
            ) : actionType === 'approve' ? 
              <CheckCircle sx={{ mr: 1, color: 'success.main' }} /> : 
              <Cancel sx={{ mr: 1, color: 'error.main' }} />
            }
            {actionType === 'view' ? 'Claim Details' : 
             actionType === 'approve' ? 'Approve Claim' : 'Reject Claim'}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedClaim && (
            <Box>
              {actionType === 'approve' && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 2 }}
                >
                  You are about to approve this expense claim. The employee will be notified via email.
                </Alert>
              )}
              {actionType === 'reject' && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 2 }}
                >
                  You are about to reject this expense claim. The employee will be notified via email.
                </Alert>
              )}
              
              {/* Claim Details Section */}
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Claim Details:
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Employee:</strong> {selectedClaim.userName}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Email:</strong> {selectedClaim.userEmail}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Department:</strong> {selectedClaim.department}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Company:</strong> {selectedClaim.originalCompanyName || ''}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Type:</strong> {getClaimTypeLabel(selectedClaim.claimType)} ({selectedClaim.category})
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Amount:</strong> {selectedClaim.currency} {selectedClaim.amount.toFixed(2)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Status:</strong> 
                      <Chip 
                        label={selectedClaim.status.charAt(0).toUpperCase() + selectedClaim.status.slice(1)}
                        color={getStatusColor(selectedClaim.status)}
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Claim Date:</strong> {(() => {
                        try {
                          const claimDate = selectedClaim.claimDate?.toDate ? selectedClaim.claimDate.toDate() : new Date(selectedClaim.claimDate);
                          return format(claimDate, 'MMM dd, yyyy');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2">
                      <strong>Submitted:</strong> {(() => {
                        try {
                          const submittedDate = selectedClaim.submittedDate?.toDate ? selectedClaim.submittedDate.toDate() : new Date(selectedClaim.submittedDate);
                          return format(submittedDate, 'MMM dd, yyyy HH:mm');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Description:</strong> {selectedClaim.description}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>Location:</strong> {selectedClaim.location}
                    </Typography>
                  </Grid>
                  {selectedClaim.receiptUrl && (
                    <Grid item xs={12}>
                      <Typography variant="body2">
                        <strong>Receipt:</strong> 
                        <Button size="small" sx={{ ml: 1 }} variant="outlined">
                          View Receipt
                        </Button>
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Additional Details for Processed Claims */}
              {(selectedClaim.status === 'approved' || selectedClaim.status === 'rejected') && (
                <Box sx={{ p: 2, bgcolor: selectedClaim.status === 'approved' ? 'success.light' : 'error.light', borderRadius: 1, mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Processing Details:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>{selectedClaim.status === 'approved' ? 'Approved' : 'Rejected'} By:</strong> {selectedClaim.approvedBy || selectedClaim.rejectedBy}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="body2">
                        <strong>Date:</strong> {(() => {
                          try {
                            const processDate = selectedClaim.approvedDate || selectedClaim.rejectedDate;
                            if (!processDate) return 'N/A';
                            const date = processDate?.toDate ? processDate.toDate() : new Date(processDate);
                            return format(date, 'MMM dd, yyyy HH:mm');
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()}
                      </Typography>
                    </Grid>
                    {selectedClaim.status === 'approved' && selectedClaim.processedAmount && (
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2">
                          <strong>Processed Amount:</strong> {selectedClaim.currency} {selectedClaim.processedAmount?.toFixed(2) || "0.00"}
                        </Typography>
                      </Grid>
                    )}
                    {selectedClaim.adminComments && (
                      <Grid item xs={12}>
                        <Typography variant="body2">
                          <strong>Admin Comments:</strong> {selectedClaim.adminComments}
                        </Typography>
                      </Grid>
                    )}
                    {selectedClaim.rejectionReason && (
                      <Grid item xs={12}>
                        <Typography variant="body2">
                          <strong>Rejection Reason:</strong> {selectedClaim.rejectionReason}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Box>
              )}
              
              {actionType === 'reject' && (
                <TextField
                  autoFocus
                  margin="dense"
                  label="Rejection Reason (Required)"
                  fullWidth
                  variant="outlined"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Please provide a reason for rejection..."
                  required
                  multiline
                  rows={3}
                />
              )}
              
              {actionType === 'approve' && (
                <Box>
                  <TextField
                    margin="dense"
                    label="Admin Comments (Optional)"
                    fullWidth
                    variant="outlined"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder="Add any comments about this approval..."
                    multiline
                    rows={2}
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    The claim will be processed for payment and the employee will receive confirmation.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setActionDialog(false);
            setSelectedClaim(null);
            setActionType('');
            setActionReason('');
          }}>
            {actionType === 'view' ? 'Close' : 'Cancel'}
          </Button>
          {actionType !== 'view' && (
            <Button 
              variant="contained" 
              color={actionType === 'approve' ? 'success' : 'error'}
              onClick={() => {
                console.log('Submit button clicked, actionType:', actionType);
                handleActionSubmit();
              }}
              disabled={actionLoading || (actionType === 'reject' && !actionReason.trim())}
              startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {actionLoading ? 'Processing...' : (actionType === 'approve' ? 'Approve Claim' : 'Reject Claim')}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompanyAdminClaims;