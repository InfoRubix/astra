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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tab,
  Tabs,
  Alert,
  Avatar,
  Divider,
  IconButton,
  InputAdornment,
  Fab,
  CircularProgress,
  Skeleton
} from '@mui/material';
import { 
  Add, 
  Receipt,
  AttachMoney,
  CheckCircle, 
  Schedule, 
  Cancel,
  History,
  LocalGasStation,
  Restaurant,
  DirectionsCar,
  Hotel,
  Business,
  AttachFile,
  Delete,
  CloudUpload,
  Visibility,
  Description,
  TrendingUp,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { claimsService } from '../../services/claimsService';

function UserClaims() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [submitDialog, setSubmitDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [claims, setClaims] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileProcessing, setFileProcessing] = useState(false);
  const [claimForm, setClaimForm] = useState({
    claimType: '',
    category: '',
    description: '',
    amount: '',
    claimDate: format(new Date(), 'yyyy-MM-dd'),
    location: '',
    emergencyContact: '',
    receiptFiles: [],
    // Mileage-specific fields
    mileage: {
      distance: '',
      vehicleType: 'car',
      startLocation: '',
      endLocation: ''
    }
  });

  // Claim types and categories
  const claimTypes = [
    { 
      value: 'travel', 
      label: 'Travel & Transportation', 
      color: 'primary',
      icon: <DirectionsCar />,
      categories: ['Taxi/Grab', 'Fuel', 'Parking', 'Public Transport', 'Toll', 'Car Rental', 'Mileage'],
      description: 'Business travel and transportation expenses'
    },
    { 
      value: 'meal', 
      label: 'Meals & Entertainment', 
      color: 'secondary',
      icon: <Restaurant />,
      categories: ['Client Lunch', 'Team Dinner', 'Business Meeting', 'Conference Meals'],
      description: 'Business meals and entertainment costs'
    },
    { 
      value: 'accommodation', 
      label: 'Hotel & Lodging', 
      color: 'info',
      icon: <Hotel />,
      categories: ['Hotel Stay', 'Airbnb', 'Business Trip', 'Conference Accommodation'],
      description: 'Accommodation for business trips'
    },
    { 
      value: 'office', 
      label: 'Office Supplies', 
      color: 'success',
      icon: <Business />,
      categories: ['Stationery', 'Equipment', 'Software', 'Books', 'Office Furniture'],
      description: 'Work-related supplies and equipment'
    },
    { 
      value: 'communication', 
      label: 'Communication', 
      color: 'warning',
      icon: <Receipt />,
      categories: ['Phone Bills', 'Internet', 'Postage', 'Courier', 'Conference Calls'],
      description: 'Communication and connectivity expenses'
    }
  ];


  useEffect(() => {
    if (user) {
      loadUserClaims();
    }
  }, [user]);

  const loadUserClaims = async () => {
    try {
      setLoading(true);
      // Load real claims from Firestore
      const q = query(
        collection(db, 'claims'),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const userClaims = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by submitted date (most recent first)
      userClaims.sort((a, b) => {
        const aDate = a.submittedDate?.toDate ? a.submittedDate.toDate() : new Date(a.submittedDate);
        const bDate = b.submittedDate?.toDate ? b.submittedDate.toDate() : new Date(b.submittedDate);
        return bDate - aDate;
      });

      setClaims(userClaims);
      console.log('Loaded user claims:', userClaims);
    } catch (error) {
      console.error('Error loading claims:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    
    // Handle mileage nested fields
    if (name.startsWith('mileage.')) {
      const mileageField = name.split('.')[1];
      const newMileage = {
        ...claimForm.mileage,
        [mileageField]: value
      };
      
      // Auto-calculate amount for mileage category
      if (claimForm.category === 'Mileage' && (mileageField === 'distance' || mileageField === 'vehicleType')) {
        const calculatedAmount = calculateMileageAmount(
          mileageField === 'distance' ? value : newMileage.distance,
          mileageField === 'vehicleType' ? value : newMileage.vehicleType,
          user.position
        );
        
        setClaimForm({
          ...claimForm,
          mileage: newMileage,
          amount: calculatedAmount
        });
      } else {
        setClaimForm({
          ...claimForm,
          mileage: newMileage
        });
      }
      return;
    }

    // Handle regular form fields
    setClaimForm({
      ...claimForm,
      [name]: value
    });

    // Reset category and amount when claim type changes
    if (name === 'claimType') {
      setClaimForm({
        ...claimForm,
        [name]: value,
        category: '',
        amount: '',
        mileage: {
          distance: '',
          vehicleType: 'car',
          startLocation: '',
          endLocation: ''
        }
      });
    }
    
    // Reset amount and calculate for mileage when category changes to/from Mileage
    if (name === 'category') {
      if (value === 'Mileage') {
        // Auto-calculate amount if distance is already provided
        const calculatedAmount = claimForm.mileage.distance ? 
          calculateMileageAmount(claimForm.mileage.distance, claimForm.mileage.vehicleType, user.position) : '';
        
        setClaimForm({
          ...claimForm,
          [name]: value,
          amount: calculatedAmount
        });
      } else {
        setClaimForm({
          ...claimForm,
          [name]: value,
          amount: '',
          mileage: {
            distance: '',
            vehicleType: 'car',
            startLocation: '',
            endLocation: ''
          }
        });
      }
    }
  };

  const handleFileUpload = async (e) => {
    console.log('🚨 HANDLEFILEUPLOAD CALLED - NEW VERSION');
    console.log('🚨 Event:', e);
    console.log('🚨 Files:', e.target.files);
    
    const files = Array.from(e.target.files);
    console.log('🔍 File upload started:', files.length, 'files');
    setFileProcessing(true);
    
    // Show user feedback immediately
    if (files.length > 0) {
      console.log('🚨 Setting processing state...');
      // Force UI update
      setError(''); // Clear any previous errors
      setSuccess(`Processing ${files.length} file(s)...`);
    }
    
    try {
      const newFiles = [];
      
      for (const file of files) {
        console.log('🔍 Processing file:', file.name, file.size, file.type);
        
        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          setError(`File ${file.name} is too large. Maximum size is 5MB.`);
          continue;
        }
        
        // Convert to Base64
        console.log('🔍 Converting to Base64:', file.name);
        let base64Data;
        try {
          console.log('🚨 ClaimsService check:', {
            serviceExists: !!claimsService,
            hasFileToBase64: !!(claimsService && claimsService.fileToBase64),
            serviceKeys: claimsService ? Object.keys(claimsService) : 'No service'
          });
          
          if (claimsService && claimsService.fileToBase64) {
            console.log('🚨 Using claimsService.fileToBase64');
            base64Data = await claimsService.fileToBase64(file);
          } else {
            console.log('🚨 Using fallback Base64 conversion');
            // Fallback implementation
            base64Data = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => {
                console.log('🚨 FileReader onload triggered');
                resolve(reader.result);
              };
              reader.onerror = error => {
                console.log('🚨 FileReader error:', error);
                reject(error);
              };
            });
          }
          
          console.log('🚨 Base64 conversion completed:', {
            hasResult: !!base64Data,
            resultLength: base64Data ? base64Data.length : 0,
            isValidFormat: base64Data ? base64Data.startsWith('data:') : false
          });
          
        } catch (conversionError) {
          console.error('🚨 Base64 conversion failed:', conversionError);
          setError(`Failed to process ${file.name}: ${conversionError.message}`);
          continue;
        }
        console.log('🔍 Base64 conversion result:', {
          fileName: file.name,
          dataLength: base64Data ? base64Data.length : 0,
          dataPrefix: base64Data ? base64Data.substring(0, 50) + '...' : 'null',
          isValidBase64: base64Data && base64Data.startsWith('data:')
        });
        
        const fileObject = {
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data, // Store Base64 data
          id: Math.random().toString(36).substr(2, 9)
        };
        
        console.log('🔍 File object created:', {
          name: fileObject.name,
          hasData: !!fileObject.data,
          dataLength: fileObject.data ? fileObject.data.length : 0
        });
        
        newFiles.push(fileObject);
      }
      
      if (newFiles.length > 0) {
        setUploadedFiles([...uploadedFiles, ...newFiles]);
        setClaimForm({
          ...claimForm,
          receiptFiles: [...claimForm.receiptFiles, ...newFiles]
        });
        
        // Clear any previous error and show success
        setSuccess(`Successfully processed ${newFiles.length} file(s) with Base64 conversion!`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('No files were successfully processed.');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error('🚨 Error processing files:', err);
      setError(`Error processing files: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    } finally {
      console.log('🚨 File processing completed, setting fileProcessing to false');
      setFileProcessing(false);
    }
  };

  const removeFile = (fileId) => {
    const updatedFiles = uploadedFiles.filter(file => file.id !== fileId);
    setUploadedFiles(updatedFiles);
    setClaimForm({
      ...claimForm,
      receiptFiles: updatedFiles
    });
  };

  const validateClaim = () => {
    const errors = [];
    
    if (!claimForm.claimType) errors.push('Please select claim type');
    if (!claimForm.category) errors.push('Please select category');
    if (!claimForm.description.trim()) errors.push('Please provide description');
    if (!claimForm.amount || parseFloat(claimForm.amount) <= 0) errors.push('Please enter valid amount');
    if (!claimForm.claimDate) errors.push('Please select claim date');
    if (!claimForm.location.trim()) errors.push('Please specify location');
    if (uploadedFiles.length === 0) errors.push('Please upload at least one receipt');
    
    const amount = parseFloat(claimForm.amount);
    if (amount > 1000) {
      errors.push('Claims above RM 1,000 require manager pre-approval');
    }
    
    const claimDate = new Date(claimForm.claimDate);
    const threeMonthsAgo = subMonths(new Date(), 3);
    if (claimDate < threeMonthsAgo) {
      errors.push('Claims older than 3 months cannot be submitted');
    }
    
    return errors;
  };

  const handleSubmitClaim = async () => {
    const validationErrors = validateClaim();

    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      // Convert file objects to serializable data with Base64
      console.log('🔍 Converting uploaded files for submission:', uploadedFiles.length);
      const fileInfos = uploadedFiles.map((fileObj, index) => {
        console.log(`🔍 Processing file ${index + 1}:`, {
          name: fileObj.name,
          hasData: !!fileObj.data,
          dataType: typeof fileObj.data,
          dataLength: fileObj.data ? fileObj.data.length : 0
        });
        
        return {
          id: fileObj.id,
          name: fileObj.name,
          size: fileObj.size,
          type: fileObj.type,
          data: fileObj.data, // Include Base64 data
          uploadedAt: new Date().toISOString(),
          lastModified: fileObj.file?.lastModified || Date.now()
        };
      });
      
      console.log('🔍 Final fileInfos for claim submission:', fileInfos.map(f => ({
        name: f.name,
        hasData: !!f.data,
        dataLength: f.data ? f.data.length : 0
      })));

      // Debug: Check what company value we're using
      const resolvedCompany = user.originalCompanyName || user.company || 'RUBIX';
      console.log('🔍 Creating claim with company data:', {
        userOriginalCompanyName: user.originalCompanyName,
        userCompany: user.company,
        resolvedCompany: resolvedCompany,
        userProfile: { originalCompanyName: user.originalCompanyName, company: user.company }
      });
      console.log('🔍 CLAIM SAVE: Will save originalCompanyName =', resolvedCompany);

      const branchName = getBranchName();
      console.log('🏢 Claim application - Branch info:', {
        userBranch: user?.branch,
        userBranchId: user?.branchId,
        userBranchName: user?.branchName,
        resolvedBranchName: branchName
      });

      const claimApplication = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        department: user.department || 'General',
        position: user.position || 'Staff',
        originalCompanyName: resolvedCompany,
        branchName: branchName,
        claimType: claimForm.claimType,
        category: claimForm.category,
        description: claimForm.description,
        amount: parseFloat(claimForm.amount),
        currency: 'MYR',
        claimDate: new Date(claimForm.claimDate),
        location: claimForm.location,
        status: 'pending',
        submittedDate: serverTimestamp(),
        receiptCount: uploadedFiles.length,
        receipts: fileInfos, // Store serializable file info WITH Base64 data
        // Mileage-specific data (if applicable)
        ...(claimForm.category === 'Mileage' && {
          mileageData: {
            distance: parseFloat(claimForm.mileage.distance),
            vehicleType: claimForm.mileage.vehicleType,
            startLocation: claimForm.mileage.startLocation,
            endLocation: claimForm.mileage.endLocation,
            ratePerKm: getMileageRate(claimForm.mileage.vehicleType, user.position),
            userPosition: user.position || 'Staff'
          }
        })
      };

      console.log('🚨 FINAL CLAIM DATA BEING SUBMITTED:', {
        ...claimApplication,
        receipts: claimApplication.receipts.map(r => ({
          name: r.name,
          size: r.size,
          hasData: !!r.data,
          dataLength: r.data ? r.data.length : 0,
          dataIsString: typeof r.data === 'string',
          dataPrefix: r.data ? r.data.substring(0, 30) + '...' : 'No data'
        }))
      });
      
      const docRef = await addDoc(collection(db, 'claims'), claimApplication);
      console.log('Claim submitted with ID:', docRef.id);

      // Skip user self-notification for submissions - they get success message instead

      try {
        // Create notification for admins about new claim
        const adminNotification = {
          originalCompanyName: user.originalCompanyName || user.company || 'RUBIX',
          isAdminNotification: true, // Flag to identify admin notifications
          type: 'pending_approval',
          title: 'New Claim Requires Approval',
          message: `${user.firstName} ${user.lastName} submitted a ${claimForm.category} claim for ${claimApplication.currency} ${claimApplication.amount}`,
          priority: 'medium',
          read: false,
          createdAt: serverTimestamp(),
          claimId: docRef.id,
          submittedBy: user.uid,
          userName: `${user.firstName} ${user.lastName}`,
          relatedData: {
            employeeName: `${user.firstName} ${user.lastName}`,
            employeeEmail: user.email,
            employeeDepartment: user.department || 'General',
            claimType: claimApplication.claimType,
            category: claimApplication.category,
            amount: claimApplication.amount,
            currency: claimApplication.currency,
            description: claimApplication.description,
            location: claimApplication.location,
            claimDate: claimApplication.claimDate,
            submittedDate: new Date().toLocaleDateString(),
            status: 'pending'
          }
        };

        const adminNotifRef = await addDoc(collection(db, 'notifications'), adminNotification);
        console.log('✅ Admin notification created successfully for claim request:', {
          notificationId: adminNotifRef.id,
          title: adminNotification.title,
          type: adminNotification.type,
          employee: adminNotification.userName,
          claimType: adminNotification.relatedData.claimType,
          amount: `${adminNotification.relatedData.currency} ${adminNotification.relatedData.amount}`,
          isAdminNotification: adminNotification.isAdminNotification,
          createdAt: 'serverTimestamp()'
        });
      } catch (adminNotifError) {
        console.error('Failed to create admin claim notification (non-blocking):', adminNotifError);
      }
      
      setSuccess('Claim submitted successfully!');
      setSubmitDialog(false);
      resetForm();
      
      // Reload claims immediately
      await loadUserClaims();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to submit claim: ' + error.message);
    }

    setSubmitting(false);
  };

  const resetForm = () => {
    setClaimForm({
      claimType: '',
      category: '',
      description: '',
      amount: '',
      claimDate: format(new Date(), 'yyyy-MM-dd'),
      location: '',
      emergencyContact: '',
      receiptFiles: [],
      mileage: {
        distance: '',
        vehicleType: 'car',
        startLocation: '',
        endLocation: ''
      }
    });
    setUploadedFiles([]);
  };

  const handleCancelClaim = async (claimId) => {
    if (!window.confirm('Are you sure you want to cancel this claim?')) {
      return;
    }

    try {
      setError('');
      await updateDoc(doc(db, 'claims', claimId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: user.uid,
        cancelledByName: `${user.firstName} ${user.lastName}`
      });
      
      setSuccess('Claim cancelled successfully');
      
      // Reload claims
      await loadUserClaims();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error cancelling claim:', error);
      setError('Failed to cancel claim: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <CheckCircle />;
      case 'rejected': return <Cancel />;
      case 'pending': return <Schedule />;
      case 'cancelled': return <Cancel />;
      default: return <Schedule />;
    }
  };

  const getClaimTypeInfo = (type) => {
    return claimTypes.find(ct => ct.value === type) || claimTypes[0];
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get branch name helper function
  const getBranchName = () => {
    if (user?.branch) return user.branch;
    
    const branchMappings = {
      'rubix-kl': 'KL Main Branch',
      'rubix-johor': 'Johor Branch',
      'rubix-penang': 'Penang Branch',
      'afc-kl': 'KL Branch',
      'afc-penang': 'Penang Branch',
      'afc-ipoh': 'Ipoh Branch',
      'kfc-kl': 'KL Branch',
      'kfc-sabah': 'Sabah Branch',
      'kfc-sarawak': 'Sarawak Branch',
      'asiahahisam-kl': 'KL Branch',
      'asiahahisam-shahalam': 'Shah Alam Branch',
      'litigation-kl': 'KL Branch',
      'litigation-ipoh': 'Ipoh Branch',
      'litigation-johor': 'Johor Branch'
    };
    
    return branchMappings[user?.branchId] || user?.branchName || 'Main Branch';
  };

  // Mileage calculation function
  const calculateMileageAmount = (distance, vehicleType, userPosition) => {
    if (!distance || !vehicleType || !userPosition) return 0;
    
    const position = userPosition.toLowerCase();
    let rate = 0;
    
    // Position-based rates
    if (position.includes('hod')) {
      rate = vehicleType === 'car' ? 0.85 : 0.6;
    } else if (position.includes('ahod') || position.includes('peguam')) {
      rate = vehicleType === 'car' ? 0.8 : 0.6;
    } else if (position.includes('staff') || position.includes('paralegal')) {
      rate = vehicleType === 'car' ? 0.7 : 0.6;
    } else if (position.includes('runner') || position.includes('chamber') || position.includes('intern')) {
      rate = 0.6; // Same rate for both car and motor
    } else {
      // Default rate for unspecified positions
      rate = vehicleType === 'car' ? 0.7 : 0.6;
    }
    
    return (parseFloat(distance) * rate).toFixed(2);
  };

  // Get mileage rate for display
  const getMileageRate = (vehicleType, userPosition) => {
    if (!vehicleType || !userPosition) return 0;
    
    const position = userPosition.toLowerCase();
    
    if (position.includes('hod')) {
      return vehicleType === 'car' ? 0.85 : 0.6;
    } else if (position.includes('ahod') || position.includes('peguam')) {
      return vehicleType === 'car' ? 0.8 : 0.6;
    } else if (position.includes('staff') || position.includes('paralegal')) {
      return vehicleType === 'car' ? 0.7 : 0.6;
    } else if (position.includes('runner') || position.includes('chamber') || position.includes('intern')) {
      return 0.6;
    } else {
      return vehicleType === 'car' ? 0.7 : 0.6;
    }
  };

  // Calculate summary stats
  const totalSubmitted = claims.reduce((sum, claim) => sum + claim.amount, 0);
  const totalApproved = claims
    .filter(c => c.status === 'approved')
    .reduce((sum, claim) => sum + (claim.processedAmount || claim.amount || 0), 0);
  const pendingCount = claims.filter(c => c.status === 'pending').length;
  const thisMonthClaims = claims.filter(c => {
    const claimDate = c.submittedDate?.toDate ? c.submittedDate.toDate() : new Date(c.submittedDate || c.claimDate);
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    return claimDate >= start && claimDate <= end;
  }).length;

  const TabPanel = ({ children, value, index }) => (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="35%" height={45} />
                <Skeleton variant="text" width="55%" height={25} />
              </Box>
            </Box>
            <Skeleton variant="rectangular" width={140} height={56} sx={{ borderRadius: 3 }} />
          </Box>
          <Skeleton variant="rectangular" width={60} height={4} sx={{ borderRadius: 2 }} />
        </Box>

        {/* Summary Cards Skeleton */}
        <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={6} sm={6} md={3} key={item}>
              <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Skeleton variant="circular" width={48} height={48} sx={{ mr: { xs: 0, sm: 2 }, mb: { xs: 1, sm: 0 } }} />
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, flex: 1 }}>
                      <Skeleton variant="text" width="80%" height={30} />
                      <Skeleton variant="text" width="90%" height={20} />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tabs and Content Skeleton */}
        <Paper sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', p: 2 }}>
            <Skeleton variant="rectangular" width="40%" height={48} sx={{ borderRadius: 1 }} />
          </Box>
          <Box sx={{ p: 3 }}>
            {[1, 2, 3].map((item) => (
              <Box key={item} sx={{ mb: 2, pb: 2, borderBottom: item < 3 ? '1px solid' : 'none', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Skeleton variant="text" width="60%" height={30} />
                  <Skeleton variant="rectangular" width={80} height={28} sx={{ borderRadius: 1 }} />
                </Box>
                <Skeleton variant="text" width="90%" height={20} />
                <Skeleton variant="text" width="70%" height={20} />
                <Skeleton variant="text" width="50%" height={16} />
              </Box>
            ))}
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
                bgcolor: 'success.main', 
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                mr: 2,
                boxShadow: '0 4px 15px rgba(46, 125, 50, 0.3)'
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
                  background: 'linear-gradient(45deg, #2e7d32, #66bb6a)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                Expense Claims
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Submit and track your business expense claims
              </Typography>
            </Box>
          </Box>
          <Fab 
            color="primary" 
            variant="extended"
            onClick={() => setSubmitDialog(true)}
            size={isMobile ? "medium" : "large"}
            sx={{
              position: { xs: 'fixed', sm: 'relative' },
              bottom: { xs: 16, sm: 'auto' },
              right: { xs: 16, sm: 'auto' },
              zIndex: { xs: 1000, sm: 'auto' },
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
            <Add sx={{ mr: 1 }} />
            {isMobile ? 'New' : 'New Claim'}
          </Fab>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'success.main',
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
                  <AttachMoney sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    RM{totalSubmitted.toFixed(2)}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Submitted
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
                    RM{totalApproved.toFixed(2)}
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
                : 'linear-gradient(135deg, #ffffff 0%, #fff8e1 100%)',
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
                  boxShadow: '0 4px 15px rgba(245, 124, 0, 0.3)'
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
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2137 100%)'
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
                  <TrendingUp sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {thisMonthClaims}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    This Month
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Tabs */}
      <Paper
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #1a1a1a 0%, #0d0d1f 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)'
        }}
      >
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{
            '& .MuiTab-root': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              minWidth: { xs: 'auto', sm: 160 }
            }
          }}
        >
          <Tab 
            icon={<History />} 
            label="History" 
            iconPosition={isMobile ? "top" : "start"}
            sx={{ py: { xs: 1.5, sm: 2 } }}
          />
          <Tab 
            icon={<Receipt />} 
            label="Categories" 
            iconPosition={isMobile ? "top" : "start"}
            sx={{ py: { xs: 1.5, sm: 2 } }}
          />
        </Tabs>

        {/* Claim History Tab */}
        <TabPanel value={tabValue} index={0}>
          {claims.length > 0 ? (
            <List>
              {claims.map((claim, index) => (
                <ListItem key={claim.id} divider={index < claims.length - 1}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: getClaimTypeInfo(claim.claimType).color + '.main' }}>
                      {getClaimTypeInfo(claim.claimType).icon}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle1">
                          {claim.category} - {claim.currency} {claim.amount.toFixed(2)}
                        </Typography>
                        <Chip 
                          label={claim.status} 
                          color={getStatusColor(claim.status)}
                          size="small"
                          icon={getStatusIcon(claim.status)}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {claim.description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          📍 {claim.location} • {(() => {
                            try {
                              const claimDate = claim.claimDate?.toDate ? claim.claimDate.toDate() : new Date(claim.claimDate);
                              return format(claimDate, 'dd/MM/yyyy');
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Submitted: {(() => {
                            try {
                              const submittedDate = claim.submittedDate?.toDate ? claim.submittedDate.toDate() : new Date(claim.submittedDate);
                              return format(submittedDate, 'MMM dd, yyyy HH:mm');
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()}
                        </Typography>
                        {claim.status === 'rejected' && claim.rejectionReason && (
                          <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                            Reason: {claim.rejectionReason}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {claim.receiptUrl && (
                      <Button size="small" startIcon={<Visibility />} variant="outlined">
                        View Receipt
                      </Button>
                    )}
                    {claim.status === 'pending' && (
                      <Button 
                        size="small" 
                        color="error" 
                        variant="outlined"
                        onClick={() => handleCancelClaim(claim.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </Box>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Receipt sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No claims submitted yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click "New Claim" to submit your first expense claim
              </Typography>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={() => setSubmitDialog(true)}
              >
                Submit Your First Claim
              </Button>
            </Box>
          )}
        </TabPanel>

        {/* Claim Categories Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 4, px: { xs: 2, sm: 3 } }}>
            <Typography 
              variant="h5" 
              gutterBottom 
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1
              }}
            >
              Available Claim Categories
            </Typography>
            <Typography 
              variant="body1" 
              color="text.secondary" 
              sx={{ 
                fontSize: '1.1rem',
                lineHeight: 1.6
              }}
            >
              Choose the appropriate category for your business expenses. Each category has specific subcategories to help you classify your claims accurately.
            </Typography>
          </Box>
          
          <Grid container spacing={3} sx={{ px: { xs: 2, sm: 3 }, pb: 3 }}>
            {claimTypes.map((type, index) => (
              <Grid item xs={12} sm={6} lg={4} key={index}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: '1px solid',
                    borderColor: 'divider',
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(135deg, #1a1a1a 0%, ${theme.palette[type.color]?.dark || '#0d0d1f'}40 100%)`
                      : `linear-gradient(135deg, #ffffff 0%, ${theme.palette[type.color]?.light || '#f8f9ff'}20 100%)`,
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                      borderColor: `${type.color}.light`,
                      '& .category-icon': {
                        transform: 'scale(1.1)',
                        boxShadow: `0 4px 15px ${theme.palette[type.color]?.main || '#1976d2'}30`
                      },
                      '& .category-title': {
                        color: `${type.color}.main`
                      }
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header with Icon and Title */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                      <Avatar 
                        className="category-icon"
                        sx={{ 
                          bgcolor: `${type.color}.main`,
                          width: 56, 
                          height: 56,
                          mr: 2,
                          transition: 'all 0.3s ease',
                          boxShadow: `0 2px 8px ${theme.palette[type.color]?.main || '#1976d2'}40`
                        }}
                      >
                        {React.cloneElement(type.icon, { sx: { fontSize: 28 } })}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          className="category-title"
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            fontSize: '1.125rem',
                            lineHeight: 1.3,
                            transition: 'color 0.3s ease',
                            mb: 0.5
                          }}
                        >
                          {type.label}
                        </Typography>
                        <Box
                          sx={{
                            width: 40,
                            height: 3,
                            bgcolor: `${type.color}.main`,
                            borderRadius: 1.5,
                            opacity: 0.8
                          }}
                        />
                      </Box>
                    </Box>
                    
                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 3,
                        lineHeight: 1.5,
                        fontSize: '0.9rem'
                      }}
                    >
                      {type.description}
                    </Typography>
                    
                    {/* Subcategories Section */}
                    <Box>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          mb: 1.5,
                          fontWeight: 600,
                          color: 'text.primary',
                          fontSize: '0.875rem',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5
                        }}
                      >
                        Subcategories
                      </Typography>
                      <Box 
                        sx={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: 1,
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          bgcolor: 'grey.50'
                        }}
                      >
                        {type.categories.map((category, catIndex) => (
                          <Chip 
                            key={catIndex}
                            label={category}
                            size="small"
                            sx={{
                              bgcolor: `${type.color}.50`,
                              color: `${type.color}.dark`,
                              border: `1px solid ${theme.palette[type.color]?.light || '#1976d2'}`,
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: `${type.color}.100`,
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }
                            }}
                          />
                        ))}
                      </Box>
                    </Box>

                    {/* Bottom Action Area */}
                    <Box 
                      sx={{ 
                        mt: 3,
                        pt: 2,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                      >
                        {type.categories.length} subcategories
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        color={type.color}
                        onClick={() => {
                          setClaimForm({ ...claimForm, claimType: type.value, category: '' });
                          setSubmitDialog(true);
                        }}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 500,
                          px: 2
                        }}
                      >
                        Use Category
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </TabPanel>
      </Paper>

      {/* Enhanced Submit Claim Dialog */}
      <Dialog 
        open={submitDialog} 
        onClose={() => setSubmitDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: '1px solid',
            borderColor: 'divider'
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #2e7d32 0%, #66bb6a 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                mr: 2,
                width: 40,
                height: 40
              }}
            >
              <Add sx={{ color: 'white' }} />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'white' }}>
                Submit New Claim
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Submit your business expense for approval
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, bgcolor: 'grey.50' }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                name="claimType"
                label="Claim Type"
                select
                fullWidth
                value={claimForm.claimType}
                onChange={handleFormChange}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: 'success.main'
                    }
                  }
                }}
              >
                {claimTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {option.icon}
                      <Box sx={{ ml: 1 }}>
                        <Typography variant="body2">{option.label}</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                name="category"
                label="Category"
                select
                fullWidth
                value={claimForm.category}
                onChange={handleFormChange}
                disabled={!claimForm.claimType}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              >
                {claimForm.claimType && 
                  getClaimTypeInfo(claimForm.claimType).categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))
                }
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="amount"
                label={claimForm.category === 'Mileage' ? "Amount (Auto-calculated)" : "Amount"}
                type="number"
                fullWidth
                value={claimForm.amount}
                onChange={handleFormChange}
                disabled={claimForm.category === 'Mileage'}
                InputProps={{
                  startAdornment: <InputAdornment position="start">RM</InputAdornment>,
                  inputProps: { min: 0, step: 0.01 }
                }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="claimDate"
                label="Expense Date"
                type="date"
                fullWidth
                value={claimForm.claimDate}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: format(new Date(), 'yyyy-MM-dd') }}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description"
                multiline
                rows={3}
                fullWidth
                value={claimForm.description}
                onChange={handleFormChange}
                placeholder="Provide details about the expense..."
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                name="location"
                label="Location"
                fullWidth
                value={claimForm.location}
                onChange={handleFormChange}
                placeholder="Where did this expense occur?"
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              />
            </Grid>

            {/* Mileage-specific fields */}
            {claimForm.category === 'Mileage' && (
              <>
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Your mileage rate: RM {getMileageRate(claimForm.mileage.vehicleType, user.position)}/km</strong>
                      <br />
                      Rate based on your position ({user.position || 'Staff'}) and vehicle type.
                    </Typography>
                  </Alert>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    name="mileage.distance"
                    label="Distance (KM)"
                    type="number"
                    fullWidth
                    value={claimForm.mileage.distance}
                    onChange={handleFormChange}
                    InputProps={{
                      inputProps: { min: 0, step: 0.1 }
                    }}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'background.paper'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    name="mileage.vehicleType"
                    label="Vehicle Type"
                    select
                    fullWidth
                    value={claimForm.mileage.vehicleType}
                    onChange={handleFormChange}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'background.paper'
                      }
                    }}
                  >
                    <MenuItem value="car">Car</MenuItem>
                    <MenuItem value="motor">Motorcycle</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    name="mileage.startLocation"
                    label="Start Location"
                    fullWidth
                    value={claimForm.mileage.startLocation}
                    onChange={handleFormChange}
                    placeholder="e.g., KL Office"
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'background.paper'
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    name="mileage.endLocation"
                    label="End Location"
                    fullWidth
                    value={claimForm.mileage.endLocation}
                    onChange={handleFormChange}
                    placeholder="e.g., Client Office"
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'background.paper'
                      }
                    }}
                  />
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Receipt Upload *
                </Typography>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={fileProcessing ? <CircularProgress size={20} /> : <CloudUpload />}
                  fullWidth
                  sx={{ mb: 2 }}
                  disabled={fileProcessing}
                >
                  {fileProcessing ? 'Processing Files...' : 'Upload Receipts'}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Supported: JPG, PNG, PDF (Max 5MB per file)
                </Typography>
              </Box>

              {uploadedFiles.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Uploaded Files ({uploadedFiles.length}):
                  </Typography>
                  <List dense>
                    {uploadedFiles.map((file) => (
                      <ListItem key={file.id} 
                        secondaryAction={
                          <IconButton edge="end" onClick={() => removeFile(file.id)}>
                            <Delete />
                          </IconButton>
                        }
                      >
                        <ListItemIcon>
                          <Description />
                        </ListItemIcon>
                        <ListItemText
                          primary={file.name}
                          secondary={formatFileSize(file.size)}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Grid>

            {parseFloat(claimForm.amount) > 500 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  <Typography variant="body2">
                    Claims above RM 500 may require additional approval time and documentation.
                  </Typography>
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 4, bgcolor: 'grey.50', gap: 2 }}>
          <Button 
            onClick={() => setSubmitDialog(false)}
            variant="outlined"
            size="large"
            sx={{
              py: 1.5,
              px: 3,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none',
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2
              }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitClaim}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
            size="large"
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 4px 15px rgba(46, 125, 50, 0.3)',
              bgcolor: 'success.main',
              '&:hover': {
                bgcolor: 'success.dark',
                boxShadow: '0 6px 20px rgba(46, 125, 50, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            {submitting ? 'Submitting...' : 'Submit Claim'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default UserClaims;