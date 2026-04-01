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
  Chip,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  Business,
  Edit,
  LocationOn,
  AccountBalance,
  Phone,
  Email,
  Language,
  Settings,
  Save,
  Cancel,
  CalendarMonth
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function CompanyAdminProfile() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    registrationNumber: '',
    address: {
      line1: '',
      line2: '',
      line3: '',
      postcode: '',
      city: '',
      state: '',
      country: 'Malaysia'
    },
    contact: {
      phone: '',
      fax: '',
      email: '',
      website: ''
    },
    statutory: {
      epfNumber: '',
      socsoNumber: '',
      eisNumber: '',
      taxNumber: ''
    },
    bankDetails: {
      bankName: '',
      accountNumber: '',
      swiftCode: ''
    },
    location: {
      latitude: '',
      longitude: ''
    },
    logoUrl: '',
    isActive: true
  });

  const malaysianStates = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Malacca',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya',
    'Sabah', 'Sarawak', 'Selangor', 'Terengganu'
  ];

  useEffect(() => {
    if (user) {
      console.log('🔍 Company Admin Profile useEffect - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        fullUserObject: user
      });
      
      const userCompany = user.originalCompanyName || user.company || '';
      setForm(prev => ({
        ...prev,
        name: userCompany
      }));
      
      loadCompanyProfile();
    }
  }, [user]);

  const loadCompanyProfile = async () => {
    setLoading(true);
    try {
      const userCompany = user.originalCompanyName || user.company || '';
      console.log('🔍 Company Admin loading profile for company:', userCompany);
      
      // Load profile for this specific company only
      const q = query(
        collection(db, 'companies'),
        where('name', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const profileDoc = querySnapshot.docs[0];
        const profileData = {
          id: profileDoc.id,
          ...profileDoc.data(),
          createdAt: profileDoc.data().createdAt?.toDate ? profileDoc.data().createdAt.toDate() : new Date(profileDoc.data().createdAt || Date.now())
        };
        setCompanyProfile(profileData);
        console.log('🔍 Company profile loaded:', profileData);
      } else {
        setCompanyProfile(null);
        console.log('🔍 No company profile found for:', userCompany);
      }
    } catch (error) {
      console.error('Error loading company profile:', error);
      setError('Failed to load company profile: ' + error.message);
    }
    setLoading(false);
  };

  const handleCreateProfile = async () => {
    if (!form.name || !form.registrationNumber) {
      setError('Company name and registration number are required');
      return;
    }

    setSaving(true);
    try {
      const userCompany = user.originalCompanyName || user.company || '';
      
      const newProfile = {
        ...form,
        name: userCompany, // Always use company admin's company
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'companies'), newProfile);
      setSuccess('Company profile created successfully');
      setCreateDialog(false);
      await loadCompanyProfile();
    } catch (error) {
      console.error('Error creating company profile:', error);
      setError('Failed to create company profile: ' + error.message);
    }
    setSaving(false);
  };

  const handleUpdateProfile = async () => {
    if (!form.name || !form.registrationNumber) {
      setError('Company name and registration number are required');
      return;
    }

    if (!companyProfile || !companyProfile.id) {
      setError('No profile found to update');
      return;
    }

    setSaving(true);
    try {
      const userCompany = user.originalCompanyName || user.company || '';
      
      const profileRef = doc(db, 'companies', companyProfile.id);
      await updateDoc(profileRef, {
        ...form,
        name: userCompany, // Always use company admin's company
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`
      });

      setSuccess('Company profile updated successfully');
      setEditDialog(false);
      await loadCompanyProfile();
    } catch (error) {
      console.error('Error updating company profile:', error);
      setError('Failed to update company profile: ' + error.message);
    }
    setSaving(false);
  };

  const handleEdit = () => {
    if (companyProfile) {
      setForm({
        name: companyProfile.name || '',
        registrationNumber: companyProfile.registrationNumber || '',
        address: {
          line1: companyProfile.address?.line1 || '',
          line2: companyProfile.address?.line2 || '',
          line3: companyProfile.address?.line3 || '',
          postcode: companyProfile.address?.postcode || '',
          city: companyProfile.address?.city || '',
          state: companyProfile.address?.state || '',
          country: companyProfile.address?.country || 'Malaysia'
        },
        contact: {
          phone: companyProfile.contact?.phone || '',
          fax: companyProfile.contact?.fax || '',
          email: companyProfile.contact?.email || '',
          website: companyProfile.contact?.website || ''
        },
        statutory: {
          epfNumber: companyProfile.statutory?.epfNumber || '',
          socsoNumber: companyProfile.statutory?.socsoNumber || '',
          eisNumber: companyProfile.statutory?.eisNumber || '',
          taxNumber: companyProfile.statutory?.taxNumber || ''
        },
        bankDetails: {
          bankName: companyProfile.bankDetails?.bankName || '',
          accountNumber: companyProfile.bankDetails?.accountNumber || '',
          swiftCode: companyProfile.bankDetails?.swiftCode || ''
        },
        location: {
          latitude: companyProfile.location?.latitude || '',
          longitude: companyProfile.location?.longitude || ''
        },
        logoUrl: companyProfile.logoUrl || '',
        isActive: companyProfile.isActive !== false
      });
      setEditDialog(true);
    }
  };

  const handleCreate = () => {
    const userCompany = user.originalCompanyName || user.company || '';
    setForm(prev => ({
      ...prev,
      name: userCompany
    }));
    setCreateDialog(true);
  };

  const updateFormField = (path, value) => {
    setForm(prev => {
      const newForm = { ...prev };
      const keys = path.split('.');
      let current = newForm;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newForm;
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading company profile...
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
              <Business sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Company Profile
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage your company information and details for {user.originalCompanyName || user.company || 'your company'}
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
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Company Profile Display */}
      {companyProfile ? (
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
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                Company Information
              </Typography>
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={handleEdit}
                sx={{
                  fontWeight: 600,
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                Edit Profile
              </Button>
            </Box>

            <Grid container spacing={4}>
              {/* Basic Information */}
              <Grid item xs={12}>
                <Card
                  sx={{
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 50, height: 50 }}>
                        {companyProfile.name?.charAt(0) || 'C'}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                          {companyProfile.name}
                        </Typography>
                        <Chip 
                          label={companyProfile.isActive ? 'Active' : 'Inactive'}
                          color={companyProfile.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                    </Box>
                    <Typography variant="body1" color="text.secondary">
                      <strong>Registration Number:</strong> {companyProfile.registrationNumber || 'Not provided'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Address Information */}
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'info.main' }}>
                        <LocationOn />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Address
                      </Typography>
                    </Box>
                    {companyProfile.address?.line1 ? (
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          {companyProfile.address.line1}
                        </Typography>
                        {companyProfile.address.line2 && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {companyProfile.address.line2}
                          </Typography>
                        )}
                        {companyProfile.address.line3 && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {companyProfile.address.line3}
                          </Typography>
                        )}
                        {(companyProfile.address.postcode || companyProfile.address.city || companyProfile.address.state) && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            {companyProfile.address.postcode} {companyProfile.address.city}
                            {companyProfile.address.state && `, ${companyProfile.address.state}`}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {companyProfile.address.country}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No address provided
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Contact Information */}
              <Grid item xs={12} md={6}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'success.main' }}>
                        <Phone />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Contact
                      </Typography>
                    </Box>
                    <Box>
                      {companyProfile.contact?.phone && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          📞 {companyProfile.contact.phone}
                        </Typography>
                      )}
                      {companyProfile.contact?.fax && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          📠 {companyProfile.contact.fax}
                        </Typography>
                      )}
                      {companyProfile.contact?.email && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          📧 {companyProfile.contact.email}
                        </Typography>
                      )}
                      {companyProfile.contact?.website && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                          🌐 {companyProfile.contact.website}
                        </Typography>
                      )}
                      {!companyProfile.contact?.phone && !companyProfile.contact?.email && 
                       !companyProfile.contact?.fax && !companyProfile.contact?.website && (
                        <Typography variant="body2" color="text.secondary">
                          No contact information provided
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Bank Details */}
              {companyProfile.bankDetails?.bankName && (
                <Grid item xs={12} md={6}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'warning.main' }}>
                          <AccountBalance />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Bank Details
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 600 }}>
                          {companyProfile.bankDetails.bankName}
                        </Typography>
                        {companyProfile.bankDetails.accountNumber && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            Account: {companyProfile.bankDetails.accountNumber}
                          </Typography>
                        )}
                        {companyProfile.bankDetails.swiftCode && (
                          <Typography variant="body2" color="text.secondary">
                            SWIFT: {companyProfile.bankDetails.swiftCode}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}

              {/* Statutory Information */}
              {(companyProfile.statutory?.epfNumber || companyProfile.statutory?.socsoNumber || 
                companyProfile.statutory?.eisNumber || companyProfile.statutory?.taxNumber) && (
                <Grid item xs={12} md={6}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: 3,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                          <Settings />
                        </Avatar>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          Statutory
                        </Typography>
                      </Box>
                      <Box>
                        {companyProfile.statutory?.epfNumber && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            EPF: {companyProfile.statutory.epfNumber}
                          </Typography>
                        )}
                        {companyProfile.statutory?.socsoNumber && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            SOCSO: {companyProfile.statutory.socsoNumber}
                          </Typography>
                        )}
                        {companyProfile.statutory?.eisNumber && (
                          <Typography variant="body2" sx={{ mb: 0.5 }}>
                            EIS: {companyProfile.statutory.eisNumber}
                          </Typography>
                        )}
                        {companyProfile.statutory?.taxNumber && (
                          <Typography variant="body2" color="text.secondary">
                            Tax: {companyProfile.statutory.taxNumber}
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>

            {/* Created/Updated Info */}
            {companyProfile.createdByName && (
              <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <CalendarMonth sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Created by {companyProfile.createdByName} • {companyProfile.createdAt && format(companyProfile.createdAt, 'MMM dd, yyyy')}
                  </Typography>
                </Box>
                {companyProfile.updatedByName && (
                  <Typography variant="caption" color="text.secondary">
                    Last updated by {companyProfile.updatedByName}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      ) : (
        // No Profile Found
        <Paper 
          elevation={0}
          sx={{
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid',
            borderColor: 'divider',
            py: 8,
            textAlign: 'center'
          }}
        >
          <Avatar sx={{ mx: 'auto', mb: 3, bgcolor: 'primary.main', width: 80, height: 80 }}>
            <Business sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            No Company Profile Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Create your company profile to manage business information, contact details, and statutory requirements.
          </Typography>
          <Button 
            variant="contained" 
            size="large"
            startIcon={<Business />}
            onClick={handleCreate}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Create Company Profile
          </Button>
        </Paper>
      )}

      {/* Create Profile Dialog */}
      <Dialog 
        open={createDialog} 
        onClose={() => setCreateDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Create Company Profile</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main">
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Company Name"
                fullWidth
                value={form.name}
                disabled
                helperText="Company name is automatically set based on your profile"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Registration Number *"
                fullWidth
                value={form.registrationNumber}
                onChange={(e) => setForm({...form, registrationNumber: e.target.value})}
                required
              />
            </Grid>

            {/* Address Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Address Information
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 1"
                fullWidth
                value={form.address.line1}
                onChange={(e) => updateFormField('address.line1', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 2"
                fullWidth
                value={form.address.line2}
                onChange={(e) => updateFormField('address.line2', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 3"
                fullWidth
                value={form.address.line3}
                onChange={(e) => updateFormField('address.line3', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Postcode"
                fullWidth
                value={form.address.postcode}
                onChange={(e) => updateFormField('address.postcode', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="City"
                fullWidth
                value={form.address.city}
                onChange={(e) => updateFormField('address.city', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>State</InputLabel>
                <Select
                  value={form.address.state}
                  label="State"
                  onChange={(e) => updateFormField('address.state', e.target.value)}
                >
                  {malaysianStates.map((state) => (
                    <MenuItem key={state} value={state}>{state}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Contact Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={form.contact.phone}
                onChange={(e) => updateFormField('contact.phone', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={form.contact.email}
                onChange={(e) => updateFormField('contact.email', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Fax"
                fullWidth
                value={form.contact.fax}
                onChange={(e) => updateFormField('contact.fax', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Website"
                fullWidth
                value={form.contact.website}
                onChange={(e) => updateFormField('contact.website', e.target.value)}
                placeholder="https://www.example.com"
              />
            </Grid>

            {/* Statutory Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Statutory Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="EPF Number"
                fullWidth
                value={form.statutory.epfNumber}
                onChange={(e) => updateFormField('statutory.epfNumber', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="SOCSO Number"
                fullWidth
                value={form.statutory.socsoNumber}
                onChange={(e) => updateFormField('statutory.socsoNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="EIS Number"
                fullWidth
                value={form.statutory.eisNumber}
                onChange={(e) => updateFormField('statutory.eisNumber', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tax Number"
                fullWidth
                value={form.statutory.taxNumber}
                onChange={(e) => updateFormField('statutory.taxNumber', e.target.value)}
              />
            </Grid>

            {/* Bank Details */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Bank Details
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Name"
                fullWidth
                value={form.bankDetails.bankName}
                onChange={(e) => updateFormField('bankDetails.bankName', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Number"
                fullWidth
                value={form.bankDetails.accountNumber}
                onChange={(e) => updateFormField('bankDetails.accountNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="SWIFT Code"
                fullWidth
                value={form.bankDetails.swiftCode}
                onChange={(e) => updateFormField('bankDetails.swiftCode', e.target.value)}
              />
            </Grid>

            {/* Location Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Location Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Latitude"
                fullWidth
                value={form.location.latitude}
                onChange={(e) => updateFormField('location.latitude', e.target.value)}
                placeholder="e.g., 3.1390"
                helperText="Enter latitude coordinate"
                type="number"
                inputProps={{ step: "any" }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Longitude"
                fullWidth
                value={form.location.longitude}
                onChange={(e) => updateFormField('location.longitude', e.target.value)}
                placeholder="e.g., 101.6869"
                helperText="Enter longitude coordinate"
                type="number"
                inputProps={{ step: "any" }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateProfile}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Creating...' : 'Create Profile'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => setEditDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Edit Company Profile</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Same form fields as create dialog */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main">
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Company Name"
                fullWidth
                value={form.name}
                disabled
                helperText="Company name cannot be changed"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Registration Number *"
                fullWidth
                value={form.registrationNumber}
                onChange={(e) => setForm({...form, registrationNumber: e.target.value})}
                required
              />
            </Grid>

            {/* Address Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Address Information
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 1"
                fullWidth
                value={form.address.line1}
                onChange={(e) => updateFormField('address.line1', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 2"
                fullWidth
                value={form.address.line2}
                onChange={(e) => updateFormField('address.line2', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Address Line 3"
                fullWidth
                value={form.address.line3}
                onChange={(e) => updateFormField('address.line3', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Postcode"
                fullWidth
                value={form.address.postcode}
                onChange={(e) => updateFormField('address.postcode', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="City"
                fullWidth
                value={form.address.city}
                onChange={(e) => updateFormField('address.city', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>State</InputLabel>
                <Select
                  value={form.address.state}
                  label="State"
                  onChange={(e) => updateFormField('address.state', e.target.value)}
                >
                  {malaysianStates.map((state) => (
                    <MenuItem key={state} value={state}>{state}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Contact Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={form.contact.phone}
                onChange={(e) => updateFormField('contact.phone', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={form.contact.email}
                onChange={(e) => updateFormField('contact.email', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Fax"
                fullWidth
                value={form.contact.fax}
                onChange={(e) => updateFormField('contact.fax', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Website"
                fullWidth
                value={form.contact.website}
                onChange={(e) => updateFormField('contact.website', e.target.value)}
                placeholder="https://www.example.com"
              />
            </Grid>

            {/* Statutory Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Statutory Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="EPF Number"
                fullWidth
                value={form.statutory.epfNumber}
                onChange={(e) => updateFormField('statutory.epfNumber', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="SOCSO Number"
                fullWidth
                value={form.statutory.socsoNumber}
                onChange={(e) => updateFormField('statutory.socsoNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="EIS Number"
                fullWidth
                value={form.statutory.eisNumber}
                onChange={(e) => updateFormField('statutory.eisNumber', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Tax Number"
                fullWidth
                value={form.statutory.taxNumber}
                onChange={(e) => updateFormField('statutory.taxNumber', e.target.value)}
              />
            </Grid>

            {/* Bank Details */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Bank Details
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Name"
                fullWidth
                value={form.bankDetails.bankName}
                onChange={(e) => updateFormField('bankDetails.bankName', e.target.value)}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Number"
                fullWidth
                value={form.bankDetails.accountNumber}
                onChange={(e) => updateFormField('bankDetails.accountNumber', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="SWIFT Code"
                fullWidth
                value={form.bankDetails.swiftCode}
                onChange={(e) => updateFormField('bankDetails.swiftCode', e.target.value)}
              />
            </Grid>

            {/* Location Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Location Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Latitude"
                fullWidth
                value={form.location.latitude}
                onChange={(e) => updateFormField('location.latitude', e.target.value)}
                placeholder="e.g., 3.1390"
                helperText="Enter latitude coordinate"
                type="number"
                inputProps={{ step: "any" }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Longitude"
                fullWidth
                value={form.location.longitude}
                onChange={(e) => updateFormField('location.longitude', e.target.value)}
                placeholder="e.g., 101.6869"
                helperText="Enter longitude coordinate"
                type="number"
                inputProps={{ step: "any" }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateProfile}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Updating...' : 'Update Profile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompanyAdminProfile;