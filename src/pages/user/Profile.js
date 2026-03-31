import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  CardActions,
  Avatar,
  Tabs,
  Tab,
  Autocomplete,
  Skeleton
} from '@mui/material';
import { 
  Person as PersonIcon,
  ContactPage as ContactPageIcon,
  Badge as BadgeIcon,
  Work as WorkIcon,
  People as FamilyIcon,
  AccountBalance as BankIcon,
  Info as InfoIcon,
  Business as BusinessIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon
} from '@mui/icons-material';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';

// Common Malaysian banks
const MALAYSIAN_BANKS = [
  'Maybank',
  'CIMB Bank',
  'Public Bank',
  'RHB Bank',
  'Hong Leong Bank',
  'AmBank',
  'Bank Islam',
  'OCBC Bank',
  'HSBC Bank',
  'Standard Chartered',
  'UOB Bank',
  'Affin Bank',
  'Alliance Bank',
  'Bank Rakyat',
  'Bank Muamalat',
  'BSN (Bank Simpanan Nasional)',
  'MBSB Bank',
  'Citibank',
  'Bank of China',
  'ICBC',
  'Maybank Islamic',
  'CIMB Islamic',
  'Public Islamic Bank',
  'RHB Islamic',
  'Hong Leong Islamic Bank',
  'AmBank Islamic',
  'OCBC Al-Amin',
  'Alliance Islamic Bank',
  'Affin Islamic Bank'
];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    position: '',
    company: '',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    payslipMessage: '',
    // Emergency Contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    emergencyContactAddress: '',
    // Spouse/Family Information
    spouseName: '',
    spousePhone: '',
    spouseOccupation: '',
    maritalStatus: '',
    numberOfChildren: '',
    // Employment Details
    employeeId: '',
    department: '',
    dateOfJoining: '',
    employmentType: '',
    workLocation: '',
    reportingManager: '',
    // Personal/Identification Details
    dateOfBirth: '',
    nationality: '',
    identificationNumber: '',
    identificationType: '',
    gender: '',
    bloodGroup: ''
  });

  useEffect(() => {
    if (user && !profile) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const userData = docSnap.data();
        setProfile(userData);
        setEditForm({
          firstName: userData.firstName || '',
          lastName: userData.lastName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          address: userData.address || '',
          position: userData.position || '',
          company: userData.originalCompanyName || userData.company || '',
          bankName: userData.bankName || '',
          accountNumber: userData.accountNumber || '',
          accountHolderName: userData.accountHolderName || '',
          payslipMessage: userData.payslipMessage || '',
          // Emergency Contact
          emergencyContactName: userData.emergencyContactName || '',
          emergencyContactPhone: userData.emergencyContactPhone || '',
          emergencyContactRelationship: userData.emergencyContactRelationship || '',
          emergencyContactAddress: userData.emergencyContactAddress || '',
          // Spouse/Family Information
          spouseName: userData.spouseName || '',
          spousePhone: userData.spousePhone || '',
          spouseOccupation: userData.spouseOccupation || '',
          maritalStatus: userData.maritalStatus || '',
          numberOfChildren: userData.numberOfChildren || '',
          // Employment Details
          employeeId: userData.employeeId || '',
          department: userData.department || '',
          dateOfJoining: userData.dateOfJoining || '',
          employmentType: userData.employmentType || '',
          workLocation: userData.workLocation || '',
          reportingManager: userData.reportingManager || '',
          // Personal/Identification Details
          dateOfBirth: userData.dateOfBirth || '',
          nationality: userData.nationality || '',
          identificationNumber: userData.identificationNumber || '',
          identificationType: userData.identificationType || '',
          gender: userData.gender || '',
          bloodGroup: userData.bloodGroup || ''
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setMessage('Error loading profile data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, {
        ...editForm,
        updatedAt: new Date().toISOString()
      });
      
      setMessage('Profile updated successfully!');
      setMessageType('success');
      setProfile({...profile, ...editForm}); // Update profile state without refetch
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          {/* Header Skeleton */}
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Skeleton variant="text" width="30%" height={50} sx={{ mx: 'auto', mb: 1 }} />
            <Skeleton variant="text" width="40%" height={30} sx={{ mx: 'auto' }} />
          </Box>

          <Grid container spacing={3}>
            {/* Profile Overview Card Skeleton */}
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #6a6a6aff 0%, #000000ff 100%)',
                  borderRadius: 3,
                  boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)'
                }}
              >
                <CardContent sx={{ py: 4 }}>
                  <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                    {/* Avatar Skeleton */}
                    <Skeleton
                      variant="circular"
                      width={120}
                      height={120}
                      sx={{
                        mb: 3,
                        bgcolor: 'rgba(255, 255, 255, 0.15)'
                      }}
                    />

                    {/* Name Skeleton */}
                    <Skeleton
                      variant="text"
                      width="70%"
                      height={45}
                      sx={{
                        mb: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.15)'
                      }}
                    />

                    {/* Position Badge Skeleton */}
                    <Skeleton
                      variant="rectangular"
                      width="60%"
                      height={40}
                      sx={{
                        mb: 3,
                        borderRadius: 25,
                        bgcolor: 'rgba(255, 255, 255, 0.15)'
                      }}
                    />

                    {/* Company Info Skeleton */}
                    <Skeleton
                      variant="text"
                      width="50%"
                      height={25}
                      sx={{
                        mb: 3,
                        bgcolor: 'rgba(255, 255, 255, 0.15)'
                      }}
                    />

                    {/* Contact Information Skeletons */}
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Skeleton
                          variant="circular"
                          width={18}
                          height={18}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                        <Skeleton
                          variant="text"
                          width="80%"
                          height={20}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Skeleton
                          variant="circular"
                          width={18}
                          height={18}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                        <Skeleton
                          variant="text"
                          width="60%"
                          height={20}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Skeleton
                          variant="circular"
                          width={18}
                          height={18}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                        <Skeleton
                          variant="text"
                          width="70%"
                          height={40}
                          sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)' }}
                        />
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Profile Edit Form Skeleton */}
            <Grid item xs={12} md={8}>
              <Card sx={{ borderRadius: 2, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
                {/* Tabs Skeleton */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {[1, 2, 3, 4].map((tab) => (
                      <Skeleton
                        key={tab}
                        variant="rectangular"
                        width={120}
                        height={40}
                        sx={{ borderRadius: 1 }}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Form Content Skeleton */}
                <Box sx={{ p: 3 }}>
                  {/* Section Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                    <Skeleton variant="text" width="30%" height={30} />
                  </Box>

                  {/* Form Fields Grid */}
                  <Grid container spacing={2}>
                    {[1, 2, 3, 4, 5, 6].map((field) => (
                      <Grid item xs={12} sm={6} key={field}>
                        <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
                      </Grid>
                    ))}
                    <Grid item xs={12}>
                      <Skeleton variant="rectangular" width="100%" height={80} sx={{ borderRadius: 1 }} />
                    </Grid>
                  </Grid>

                  {/* Divider */}
                  <Skeleton variant="rectangular" width="100%" height={1} sx={{ my: 4 }} />

                  {/* Second Section Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                    <Skeleton variant="text" width="25%" height={30} />
                  </Box>
                  <Skeleton variant="text" width="50%" height={20} sx={{ mb: 2 }} />

                  {/* More Form Fields */}
                  <Grid container spacing={2}>
                    {[1, 2, 3].map((field) => (
                      <Grid item xs={12} sm={6} key={field}>
                        <Skeleton variant="rectangular" width="100%" height={56} sx={{ borderRadius: 1 }} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>

                {/* Action Buttons Skeleton */}
                <Box sx={{
                  p: 3,
                  pt: 2,
                  backgroundColor: 'background.paper',
                  borderTop: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Skeleton variant="rectangular" width={100} height={42} sx={{ borderRadius: 1 }} />
                    <Skeleton variant="rectangular" width={140} height={42} sx={{ borderRadius: 1 }} />
                  </Box>
                </Box>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.05);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <Box sx={{ py: 4 }}>
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(45deg, #606060ff, #2b1b3aff)',
              backgroundClip: 'text',
              '-webkit-background-clip': 'text',
              color: 'transparent',
              mb: 1
            }}
          >
            My Profile
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Manage your personal information and settings
          </Typography>
        </Box>
        
        {message && (
          <Alert severity={messageType} sx={{ mb: 3 }}>
            {message}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Profile Overview Card */}
          <Grid item xs={12} md={4}>
            <Card 
              sx={{ 
                background: 'linear-gradient(135deg, #6a6a6aff 0%, #000000ff 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 3,
                boxShadow: '0 20px 40px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  boxShadow: '0 25px 50px rgba(102, 126, 234, 0.4)'
                }
              }}
            >
              {/* Decorative Background Elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 150,
                  height: 150,
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '50%',
                  transform: 'rotate(45deg)'
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -30,
                  left: -30,
                  width: 100,
                  height: 100,
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '50%'
                }}
              />
              
              <CardContent sx={{ position: 'relative', zIndex: 1, py: 4 }}>
                <Box display="flex" flexDirection="column" alignItems="center" textAlign="center">
                  {/* Enhanced Avatar */}
                  <Box
                    sx={{
                      position: 'relative',
                      mb: 3,
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -8,
                        left: -8,
                        right: -8,
                        bottom: -8,
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        animation: 'pulse 2s infinite'
                      }
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        width: 120, 
                        height: 120, 
                        bgcolor: 'rgba(255, 255, 255, 0.15)',
                        backdropFilter: 'blur(20px)',
                        border: '4px solid rgba(255, 255, 255, 0.3)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <PersonIcon sx={{ fontSize: 60, color: 'white' }} />
                    </Avatar>
                  </Box>

                  {/* Name */}
                  <Typography 
                    variant="h4" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 700, 
                      mb: 2,
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    {profile?.firstName} {profile?.lastName}
                  </Typography>

                  {/* Position Badge */}
                  <Box 
                    sx={{ 
                      bgcolor: 'rgba(255, 255, 255, 0.2)', 
                      px: 3, 
                      py: 1, 
                      borderRadius: 25, 
                      mb: 3,
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <BadgeIcon sx={{ fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {profile?.position || 'Employee'}
                    </Typography>
                  </Box>

                  {/* Company Info */}
                  <Box 
                    sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                      opacity: 0.95
                    }}
                  >
                    <BusinessIcon sx={{ fontSize: 20 }} />
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {profile?.originalCompanyName || profile?.company || 'Company'}
                    </Typography>
                  </Box>

                  {/* Contact Information */}
                  <Box sx={{ width: '100%', mt: 2 }}>
                    {profile?.email && (
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          mb: 1.5,
                          opacity: 0.9,
                          fontSize: '0.9rem'
                        }}
                      >
                        <EmailIcon sx={{ fontSize: 18 }} />
                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                          {profile.email}
                        </Typography>
                      </Box>
                    )}
                    
                    {profile?.phone && (
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          mb: 1.5,
                          opacity: 0.9,
                          fontSize: '0.9rem'
                        }}
                      >
                        <PhoneIcon sx={{ fontSize: 18 }} />
                        <Typography variant="body2">
                          {profile.phone}
                        </Typography>
                      </Box>
                    )}

                    {profile?.address && (
                      <Box 
                        sx={{ 
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                          opacity: 0.9,
                          fontSize: '0.9rem'
                        }}
                      >
                        <LocationIcon sx={{ fontSize: 18, mt: 0.1 }} />
                        <Typography variant="body2" sx={{ textAlign: 'left' }}>
                          {profile.address}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Profile Edit Form with Tabs */}
          <Grid item xs={12} md={8}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange} 
                  aria-label="profile tabs"
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab 
                    icon={<ContactPageIcon />} 
                    label="Basic Info" 
                    iconPosition="start"
                    sx={{ minHeight: 'auto', py: 2 }}
                  />
                  <Tab 
                    icon={<BadgeIcon />} 
                    label="Personal Details" 
                    iconPosition="start"
                    sx={{ minHeight: 'auto', py: 2 }}
                  />
                  <Tab 
                    icon={<WorkIcon />} 
                    label="Employment" 
                    iconPosition="start"
                    sx={{ minHeight: 'auto', py: 2 }}
                  />
                  <Tab 
                    icon={<FamilyIcon />} 
                    label="Family & Emergency" 
                    iconPosition="start"
                    sx={{ minHeight: 'auto', py: 2 }}
                  />
                </Tabs>
              </Box>

              {/* Tab 1: Basic Info */}
              <TabPanel value={tabValue} index={0}>
                <Box display="flex" alignItems="center" mb={3}>
                  <ContactPageIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Personal Information
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="First Name"
                      fullWidth
                      value={editForm.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Last Name"
                      fullWidth
                      value={editForm.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Email"
                      fullWidth
                      type="email"
                      value={editForm.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled
                      helperText="Email cannot be changed"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Phone"
                      fullWidth
                      value={editForm.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Address"
                      fullWidth
                      multiline
                      rows={2}
                      value={editForm.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Position"
                      fullWidth
                      value={editForm.position}
                      onChange={(e) => handleInputChange('position', e.target.value)}
                      disabled
                      helperText="Position is managed by admin"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Company"
                      fullWidth
                      value={editForm.company}
                      onChange={(e) => handleInputChange('company', e.target.value)}
                      disabled
                      helperText="Company is managed by admin"
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box display="flex" alignItems="center" mb={3}>
                  <BankIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Bank Information
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  This information will be displayed on your payslips
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      freeSolo
                      options={MALAYSIAN_BANKS}
                      value={editForm.bankName}
                      onChange={(event, newValue) => {
                        handleInputChange('bankName', newValue || '');
                      }}
                      onInputChange={(event, newInputValue) => {
                        handleInputChange('bankName', newInputValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Bank Name"
                          placeholder="Select or type bank name"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Account Number"
                      fullWidth
                      value={editForm.accountNumber}
                      onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                      placeholder="e.g., 1234567890123"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Account Holder Name"
                      fullWidth
                      value={editForm.accountHolderName}
                      onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                      placeholder="Name as per bank account"
                    />
                  </Grid>
                </Grid>
              </TabPanel>

              {/* Tab 2: Personal Details */}
              <TabPanel value={tabValue} index={1}>
                <Box display="flex" alignItems="center" mb={3}>
                  <BadgeIcon sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Personal Details
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Date of Birth"
                      fullWidth
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Gender"
                      fullWidth
                      select
                      value={editForm.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Nationality"
                      fullWidth
                      value={editForm.nationality}
                      onChange={(e) => handleInputChange('nationality', e.target.value)}
                      placeholder="e.g., Malaysian"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Blood Group"
                      fullWidth
                      select
                      value={editForm.bloodGroup}
                      onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Identification Type"
                      fullWidth
                      select
                      value={editForm.identificationType}
                      onChange={(e) => handleInputChange('identificationType', e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Select ID Type</option>
                      <option value="NRIC">NRIC</option>
                      <option value="Passport">Passport</option>
                      <option value="Work Permit">Work Permit</option>
                      <option value="Other">Other</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Identification Number"
                      fullWidth
                      value={editForm.identificationNumber}
                      onChange={(e) => handleInputChange('identificationNumber', e.target.value)}
                      placeholder="e.g., 123456-78-9012"
                    />
                  </Grid>
                </Grid>
              </TabPanel>

              {/* Tab 3: Employment */}
              <TabPanel value={tabValue} index={2}>
                <Box display="flex" alignItems="center" mb={3}>
                  <WorkIcon sx={{ mr: 1, color: 'warning.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Employment Information
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Some fields are managed by admin and cannot be edited
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Employee ID"
                      fullWidth
                      value={editForm.employeeId}
                      onChange={(e) => handleInputChange('employeeId', e.target.value)}
                      disabled
                      helperText="Employee ID is managed by admin"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Department"
                      fullWidth
                      value={editForm.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      disabled
                      helperText="Department is managed by admin"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Date of Joining"
                      fullWidth
                      type="date"
                      value={editForm.dateOfJoining}
                      onChange={(e) => handleInputChange('dateOfJoining', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      disabled
                      helperText="Joining date is managed by admin"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Employment Type"
                      fullWidth
                      value={editForm.employmentType}
                      onChange={(e) => handleInputChange('employmentType', e.target.value)}
                      disabled
                      helperText="Employment type is managed by admin"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Work Location"
                      fullWidth
                      value={editForm.workLocation}
                      onChange={(e) => handleInputChange('workLocation', e.target.value)}
                      placeholder="e.g., Main Office, Remote"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Reporting Manager"
                      fullWidth
                      value={editForm.reportingManager}
                      onChange={(e) => handleInputChange('reportingManager', e.target.value)}
                      disabled
                      helperText="Reporting manager is managed by admin"
                    />
                  </Grid>
                </Grid>
              </TabPanel>

              {/* Tab 4: Family & Emergency */}
              <TabPanel value={tabValue} index={3}>
                <Box display="flex" alignItems="center" mb={3}>
                  <FamilyIcon sx={{ mr: 1, color: 'secondary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Family Information
                  </Typography>
                </Box>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Marital Status"
                      fullWidth
                      select
                      value={editForm.maritalStatus}
                      onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                      <option value="Divorced">Divorced</option>
                      <option value="Widowed">Widowed</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Number of Children"
                      fullWidth
                      type="number"
                      value={editForm.numberOfChildren}
                      onChange={(e) => handleInputChange('numberOfChildren', e.target.value)}
                      placeholder="0"
                      inputProps={{ min: 0 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Spouse Name"
                      fullWidth
                      value={editForm.spouseName}
                      onChange={(e) => handleInputChange('spouseName', e.target.value)}
                      placeholder="Spouse full name"
                      disabled={editForm.maritalStatus !== 'Married'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Spouse Phone"
                      fullWidth
                      value={editForm.spousePhone}
                      onChange={(e) => handleInputChange('spousePhone', e.target.value)}
                      placeholder="Spouse contact number"
                      disabled={editForm.maritalStatus !== 'Married'}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Spouse Occupation"
                      fullWidth
                      value={editForm.spouseOccupation}
                      onChange={(e) => handleInputChange('spouseOccupation', e.target.value)}
                      placeholder="Spouse job/profession"
                      disabled={editForm.maritalStatus !== 'Married'}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 4 }} />

                <Box display="flex" alignItems="center" mb={3}>
                  <InfoIcon sx={{ mr: 1, color: 'error.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Emergency Contact
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Person to contact in case of emergency
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Emergency Contact Name"
                      fullWidth
                      value={editForm.emergencyContactName}
                      onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                      placeholder="Full name"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Emergency Contact Phone"
                      fullWidth
                      value={editForm.emergencyContactPhone}
                      onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                      placeholder="Contact number"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Relationship"
                      fullWidth
                      select
                      value={editForm.emergencyContactRelationship}
                      onChange={(e) => handleInputChange('emergencyContactRelationship', e.target.value)}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                    >
                      <option value="">Select Relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Child">Child</option>
                      <option value="Friend">Friend</option>
                      <option value="Other Relative">Other Relative</option>
                      <option value="Other">Other</option>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Emergency Contact Address"
                      fullWidth
                      multiline
                      rows={2}
                      value={editForm.emergencyContactAddress}
                      onChange={(e) => handleInputChange('emergencyContactAddress', e.target.value)}
                      placeholder="Contact address"
                    />
                  </Grid>
                </Grid>
              </TabPanel>
              
              <Box sx={{ 
                p: 3, 
                pt: 2, 
                backgroundColor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider'
              }}>
                <Box display="flex" gap={2} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setEditForm({
                        firstName: profile?.firstName || '',
                        lastName: profile?.lastName || '',
                        email: profile?.email || '',
                        phone: profile?.phone || '',
                        address: profile?.address || '',
                        position: profile?.position || '',
                        company: profile?.originalCompanyName || profile?.company || '',
                        bankName: profile?.bankName || '',
                        accountNumber: profile?.accountNumber || '',
                        accountHolderName: profile?.accountHolderName || '',
                        payslipMessage: profile?.payslipMessage || '',
                        emergencyContactName: profile?.emergencyContactName || '',
                        emergencyContactPhone: profile?.emergencyContactPhone || '',
                        emergencyContactRelationship: profile?.emergencyContactRelationship || '',
                        emergencyContactAddress: profile?.emergencyContactAddress || '',
                        spouseName: profile?.spouseName || '',
                        spousePhone: profile?.spousePhone || '',
                        spouseOccupation: profile?.spouseOccupation || '',
                        maritalStatus: profile?.maritalStatus || '',
                        numberOfChildren: profile?.numberOfChildren || '',
                        employeeId: profile?.employeeId || '',
                        department: profile?.department || '',
                        dateOfJoining: profile?.dateOfJoining || '',
                        employmentType: profile?.employmentType || '',
                        workLocation: profile?.workLocation || '',
                        reportingManager: profile?.reportingManager || '',
                        dateOfBirth: profile?.dateOfBirth || '',
                        nationality: profile?.nationality || '',
                        identificationNumber: profile?.identificationNumber || '',
                        identificationType: profile?.identificationType || '',
                        gender: profile?.gender || '',
                        bloodGroup: profile?.bloodGroup || ''
                      });
                    }}
                    disabled={saving}
                    sx={{ 
                      px: 3,
                      py: 1,
                      borderColor: 'divider',
                      color: 'text.secondary',
                      backgroundColor: 'transparent',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'action.hover',
                        color: 'primary.main',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                      },
                      '&:disabled': {
                        borderColor: 'action.disabled',
                        color: 'text.disabled'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{ 
                      px: 4,
                      py: 1,
                      background: 'linear-gradient(135deg, #1c2341ff 0%, #4f4e50ff 100%)',
                      boxShadow: '0 4px 15px 0 rgba(102, 126, 234, 0.3)',
                      border: 'none',
                      color: 'white',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #4d4d4fff 0%, #271d31ff 100%)',
                        boxShadow: '0 8px 25px 0 rgba(102, 126, 234, 0.5)',
                        transform: 'translateY(-2px)'
                      },
                      '&:active': {
                        transform: 'translateY(0px)',
                        boxShadow: '0 4px 15px 0 rgba(102, 126, 234, 0.4)'
                      },
                      '&:disabled': {
                        background: 'action.disabled',
                        color: 'text.disabled',
                        boxShadow: 'none',
                        transform: 'none'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}

export default Profile;
