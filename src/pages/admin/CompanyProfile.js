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
  Fab,
  CircularProgress,
  Autocomplete
} from '@mui/material';
import { 
  Add,
  Business,
  Edit,
  Delete,
  MoreVert,
  LocationOn,
  AccountBalance,
  Phone,
  Email,
  Language,
  Settings,
  Save,
  Cancel,
  ArrowForward,
  ArrowBack,
  CalendarMonth,
  CloudUpload,
  Image
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db, storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { format } from 'date-fns';
import LocationSearchBox from '../../components/LocationSearchBox';

// Debounce function
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

function CompanyProfile() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [companies, setCompanies] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const [dialogSuccess, setDialogSuccess] = useState('');
  const [nameValidation, setNameValidation] = useState({ isValid: true, message: '' });
  const [regValidation, setRegValidation] = useState({ isValid: true, message: '' });
  const [currentPage, setCurrentPage] = useState(0);
  const companiesPerPage = 2;
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  
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

  // Debounced values for validation (after form initialization)
  const debouncedCompanyName = useDebounce(form?.name || '', 800);
  const debouncedRegNumber = useDebounce(form?.registrationNumber || '', 800);

  const malaysianStates = [
    'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Malacca',
    'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya',
    'Sabah', 'Sarawak', 'Selangor', 'Terengganu'
  ];

  useEffect(() => {
    if (user) {
      loadCompanies();
      loadAvailableCompanies();
    }
  }, [user]);

  useEffect(() => {
    // Reload available companies when companies list changes
    if (companies.length > 0) {
      loadAvailableCompanies();
    }
  }, [companies]);

  // Debounced validation effects
  useEffect(() => {
    if (createDialog && debouncedCompanyName) {
      validateCompanyName(debouncedCompanyName);
    }
  }, [debouncedCompanyName, createDialog]);

  useEffect(() => {
    if (createDialog && debouncedRegNumber) {
      validateRegistrationNumber(debouncedRegNumber);
    }
  }, [debouncedRegNumber, createDialog]);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'companies'));
      const querySnapshot = await getDocs(q);
      const companiesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      const sortedCompanies = companiesList.sort((a, b) => {
        try {
          return b.createdAt - a.createdAt;
        } catch (error) {
          return 0;
        }
      });
      
      setCompanies(sortedCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
      setError('Failed to load companies: ' + error.message);
    }
    setLoading(false);
  };

  const loadAvailableCompanies = async () => {
    try {
      console.log('🔄 Loading available companies...');
      
      // Load companies from companySettings collection first (like CompanySettings.js)
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companiesFromSettings = companySettingsSnapshot.docs.map(doc => doc.data().company);
      
      // Also get companies from users collection as fallback
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const userCompanies = new Set();
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const company = userData.originalCompanyName || userData.company;
        if (company) userCompanies.add(company);
      });
      
      // Get companies from companies collection (existing companies)
      const existingCompanies = companies.map(company => company.name).filter(Boolean);
      
      // Combine and deduplicate companies (same logic as CompanySettings.js)
      const allCompanies = [...new Set([...companiesFromSettings, ...userCompanies, ...existingCompanies])].sort();
      setAvailableCompanies(allCompanies);
      
      console.log('✅ Loaded companies for profiles:', allCompanies);
    } catch (error) {
      console.error('❌ Error loading available companies:', error);
    }
  };

  const validateCompanyName = async (name) => {
    if (!name.trim()) {
      setNameValidation({ isValid: true, message: '' });
      return;
    }

    try {
      const existingCompanyQuery = query(
        collection(db, 'companies'),
        where('name', '==', name.trim())
      );
      const existingCompanySnapshot = await getDocs(existingCompanyQuery);
      
      if (!existingCompanySnapshot.empty) {
        setNameValidation({ 
          isValid: false, 
          message: `Company "${name.trim()}" already exists` 
        });
      } else {
        setNameValidation({ isValid: true, message: '' });
      }
    } catch (error) {
      console.error('Error validating company name:', error);
    }
  };

  const validateRegistrationNumber = async (regNumber) => {
    if (!regNumber.trim()) {
      setRegValidation({ isValid: true, message: '' });
      return;
    }

    try {
      const existingRegQuery = query(
        collection(db, 'companies'),
        where('registrationNumber', '==', regNumber.trim())
      );
      const existingRegSnapshot = await getDocs(existingRegQuery);
      
      if (!existingRegSnapshot.empty) {
        setRegValidation({ 
          isValid: false, 
          message: `Registration number "${regNumber.trim()}" already exists` 
        });
      } else {
        setRegValidation({ isValid: true, message: '' });
      }
    } catch (error) {
      console.error('Error validating registration number:', error);
    }
  };

  const resetDialogStates = () => {
    setDialogError('');
    setDialogSuccess('');
    setNameValidation({ isValid: true, message: '' });
    setRegValidation({ isValid: true, message: '' });
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleLogoSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setDialogError('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setDialogError('Image size should be less than 5MB');
        return;
      }

      setLogoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogoToStorage = async (file, companyName) => {
    if (!file) return null;

    try {
      setUploadingLogo(true);

      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${sanitizedCompanyName}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, `company-logos/${fileName}`);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      setUploadingLogo(false);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading logo:', error);
      setUploadingLogo(false);
      throw error;
    }
  };

  const deleteLogoFromStorage = async (logoUrl) => {
    if (!logoUrl) return;

    try {
      // Extract storage path from URL
      const storageRef = ref(storage, logoUrl);
      await deleteObject(storageRef);
    } catch (error) {
      console.error('Error deleting old logo:', error);
      // Don't throw error, just log it
    }
  };

  const handleCreateCompany = async () => {
    setDialogError('');
    setDialogSuccess('');

    if (!form.name || !form.registrationNumber) {
      setDialogError('Company name and registration number are required');
      return;
    }

    // Check validation states
    if (!nameValidation.isValid) {
      setDialogError(nameValidation.message + '. Please use a different name or edit the existing company.');
      return;
    }

    if (!regValidation.isValid) {
      setDialogError(regValidation.message + '. Please use a different registration number.');
      return;
    }

    setSaving(true);
    try {
      // Final validation check before creating
      const existingCompanyQuery = query(
        collection(db, 'companies'),
        where('name', '==', form.name.trim())
      );
      const existingCompanySnapshot = await getDocs(existingCompanyQuery);

      if (!existingCompanySnapshot.empty) {
        setDialogError(`Company "${form.name}" already exists. Please use a different name or edit the existing company.`);
        setSaving(false);
        return;
      }

      const existingRegQuery = query(
        collection(db, 'companies'),
        where('registrationNumber', '==', form.registrationNumber.trim())
      );
      const existingRegSnapshot = await getDocs(existingRegQuery);

      if (!existingRegSnapshot.empty) {
        setDialogError(`Registration number "${form.registrationNumber}" already exists. Please use a different registration number.`);
        setSaving(false);
        return;
      }

      // Upload logo if selected
      let logoUrl = form.logoUrl;
      if (logoFile) {
        try {
          logoUrl = await uploadLogoToStorage(logoFile, form.name.trim());
        } catch (error) {
          setDialogError('Failed to upload logo: ' + error.message);
          setSaving(false);
          return;
        }
      }

      const newCompany = {
        ...form,
        name: form.name.trim(),
        registrationNumber: form.registrationNumber.trim(),
        logoUrl: logoUrl || '',
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'companies'), newCompany);
      setDialogSuccess('Company created successfully!');
      
      // Close dialog after a brief delay to show success message
      setTimeout(() => {
        setCreateDialog(false);
        resetForm();
        resetDialogStates();
        setSuccess('Company created successfully');
      }, 1500);
      
      await loadCompanies();
    } catch (error) {
      console.error('Error creating company:', error);
      setDialogError('Failed to create company: ' + error.message);
    }
    setSaving(false);
  };

  const handleUpdateCompany = async () => {
    if (!selectedCompany || !selectedCompany.id) {
      setError('No company selected for update');
      return;
    }
    
    if (!form.name || !form.registrationNumber) {
      setError('Company name and registration number are required');
      return;
    }

    setSaving(true);
    try {
      // Check if another company with the same name already exists (excluding current company)
      if (form.name.trim() !== selectedCompany.name) {
        const existingCompanyQuery = query(
          collection(db, 'companies'),
          where('name', '==', form.name.trim())
        );
        const existingCompanySnapshot = await getDocs(existingCompanyQuery);

        if (!existingCompanySnapshot.empty) {
          setError(`Company "${form.name}" already exists. Please use a different name.`);
          setSaving(false);
          return;
        }
      }

      // Check if another company with the same registration number already exists (excluding current company)
      if (form.registrationNumber.trim() !== selectedCompany.registrationNumber) {
        const existingRegQuery = query(
          collection(db, 'companies'),
          where('registrationNumber', '==', form.registrationNumber.trim())
        );
        const existingRegSnapshot = await getDocs(existingRegQuery);

        if (!existingRegSnapshot.empty) {
          setError(`Registration number "${form.registrationNumber}" already exists. Please use a different registration number.`);
          setSaving(false);
          return;
        }
      }

      // Handle logo upload if new logo is selected
      let logoUrl = form.logoUrl;
      if (logoFile) {
        try {
          // Delete old logo if exists
          if (selectedCompany.logoUrl) {
            await deleteLogoFromStorage(selectedCompany.logoUrl);
          }

          // Upload new logo
          logoUrl = await uploadLogoToStorage(logoFile, form.name.trim());
        } catch (error) {
          setError('Failed to upload logo: ' + error.message);
          setSaving(false);
          return;
        }
      }

      const companyRef = doc(db, 'companies', selectedCompany.id);
      await updateDoc(companyRef, {
        ...form,
        name: form.name.trim(),
        registrationNumber: form.registrationNumber.trim(),
        logoUrl: logoUrl || '',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`
      });

      setSuccess('Company updated successfully');
      setEditDialog(false);
      resetForm();
      setSelectedCompany(null);
      await loadCompanies();
    } catch (error) {
      console.error('Error updating company:', error);
      setError('Failed to update company: ' + error.message);
    }
    setSaving(false);
  };

  const handleDeleteCompany = async (companyId) => {
    if (window.confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'companies', companyId));
        setSuccess('Company deleted successfully');
        await loadCompanies();
      } catch (error) {
        console.error('Error deleting company:', error);
        setError('Failed to delete company: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setForm({
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
  };

  const handleMenuClick = (event, company) => {
    setAnchorEl(event.currentTarget);
    setSelectedCompany(company);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEdit = () => {
    if (selectedCompany && selectedCompany.id) {
      setForm({
        name: selectedCompany.name || '',
        registrationNumber: selectedCompany.registrationNumber || '',
        address: {
          line1: selectedCompany.address?.line1 || '',
          line2: selectedCompany.address?.line2 || '',
          line3: selectedCompany.address?.line3 || '',
          postcode: selectedCompany.address?.postcode || '',
          city: selectedCompany.address?.city || '',
          state: selectedCompany.address?.state || '',
          country: selectedCompany.address?.country || 'Malaysia'
        },
        contact: {
          phone: selectedCompany.contact?.phone || '',
          fax: selectedCompany.contact?.fax || '',
          email: selectedCompany.contact?.email || '',
          website: selectedCompany.contact?.website || ''
        },
        statutory: {
          epfNumber: selectedCompany.statutory?.epfNumber || '',
          socsoNumber: selectedCompany.statutory?.socsoNumber || '',
          eisNumber: selectedCompany.statutory?.eisNumber || '',
          taxNumber: selectedCompany.statutory?.taxNumber || ''
        },
        bankDetails: {
          bankName: selectedCompany.bankDetails?.bankName || '',
          accountNumber: selectedCompany.bankDetails?.accountNumber || '',
          swiftCode: selectedCompany.bankDetails?.swiftCode || ''
        },
        location: {
          latitude: selectedCompany.location?.latitude || '',
          longitude: selectedCompany.location?.longitude || ''
        },
        logoUrl: selectedCompany.logoUrl || '',
        isActive: selectedCompany.isActive !== false
      });

      // Set logo preview if exists
      if (selectedCompany.logoUrl) {
        setLogoPreview(selectedCompany.logoUrl);
      } else {
        setLogoPreview('');
      }
      setLogoFile(null);

      setEditDialog(true);
    } else {
      setError('No company selected for editing');
    }
    handleMenuClose();
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

  const handleCompanySelection = (event, selectedCompany) => {
    if (selectedCompany && typeof selectedCompany === 'object') {
      // If user selected an existing company, populate all fields
      setForm({
        name: selectedCompany.name || '',
        registrationNumber: selectedCompany.registrationNumber || '',
        address: {
          line1: selectedCompany.address?.line1 || '',
          line2: selectedCompany.address?.line2 || '',
          line3: selectedCompany.address?.line3 || '',
          postcode: selectedCompany.address?.postcode || '',
          city: selectedCompany.address?.city || '',
          state: selectedCompany.address?.state || '',
          country: selectedCompany.address?.country || 'Malaysia'
        },
        contact: {
          phone: selectedCompany.contact?.phone || '',
          fax: selectedCompany.contact?.fax || '',
          email: selectedCompany.contact?.email || '',
          website: selectedCompany.contact?.website || ''
        },
        statutory: {
          epfNumber: selectedCompany.statutory?.epfNumber || '',
          socsoNumber: selectedCompany.statutory?.socsoNumber || '',
          eisNumber: selectedCompany.statutory?.eisNumber || '',
          taxNumber: selectedCompany.statutory?.taxNumber || ''
        },
        bankDetails: {
          bankName: selectedCompany.bankDetails?.bankName || '',
          accountNumber: selectedCompany.bankDetails?.accountNumber || '',
          swiftCode: selectedCompany.bankDetails?.swiftCode || ''
        },
        location: {
          latitude: selectedCompany.location?.latitude || '',
          longitude: selectedCompany.location?.longitude || ''
        },
        logoUrl: selectedCompany.logoUrl || '',
        isActive: selectedCompany.isActive !== false
      });
    } else if (typeof selectedCompany === 'string') {
      // If user typed a new company name, just update the name field
      setForm(prev => ({...prev, name: selectedCompany}));
    }
  };

  // Pagination functions
  const totalPages = Math.max(1, Math.ceil(companies.length / companiesPerPage));
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));

  const getPaginatedData = () => {
    const startIndex = safePage * companiesPerPage;
    return companies.slice(startIndex, startIndex + companiesPerPage);
  };

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

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Header */}
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
                Company Profiles
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage company information and details
              </Typography>
            </Box>
          </Box>
          <Fab 
            color="primary" 
            variant="extended"
            onClick={() => {
              resetDialogStates();
              setCreateDialog(true);
            }}
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
            {isMobile ? 'New' : 'Add Company'}
          </Fab>
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

      {/* Companies Table */}
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
          <Typography 
            variant="h6"
            sx={{ 
              fontWeight: 600,
              color: 'primary.main'
            }}
          >
            All Companies ({companies.length})
          </Typography>
        </Box>
        <Divider />
        
        <Box sx={{ p: 4 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : companies.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Business sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No companies found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add your first company to get started
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {getPaginatedData().map((company) => (
                <Grid item xs={12} sm={6} lg={4} key={company.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s ease-in-out'
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1, p: 3 }}>
                      {/* Company Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Avatar
                          src={company.logoUrl}
                          sx={{
                            mr: 2,
                            bgcolor: company.logoUrl ? 'transparent' : 'primary.main',
                            width: 48,
                            height: 48,
                            border: company.logoUrl ? '1px solid' : 'none',
                            borderColor: 'divider'
                          }}
                        >
                          {!company.logoUrl && (company.name?.charAt(0) || 'C')}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 700,
                              cursor: 'pointer',
                              color: 'primary.main',
                              '&:hover': {
                                textDecoration: 'underline'
                              }
                            }}
                            onClick={() => {
                              setSelectedCompany(company);
                              handleEdit();
                            }}
                          >
                            {company.name}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Chip 
                              label={company.isActive ? 'Active' : 'Inactive'}
                              color={company.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                        </Box>
                        <IconButton 
                          onClick={(e) => handleMenuClick(e, company)}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          <MoreVert />
                        </IconButton>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      {/* Company Details */}
                      <Grid container spacing={2}>
                        {/* Registration */}
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Business sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Registration Number
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ ml: 3 }}>
                            {company.registrationNumber || 'Not provided'}
                          </Typography>
                        </Grid>

                        {/* Address */}
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <LocationOn sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Address
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ ml: 3 }}>
                            {company.address?.line1 ? (
                              <>
                                {company.address.line1}
                                {company.address.line2 && <><br />{company.address.line2}</>}
                                {company.address.line3 && <><br />{company.address.line3}</>}
                                {(company.address.postcode || company.address.city || company.address.state) && (
                                  <><br />
                                    {company.address.postcode} {company.address.city}
                                    {company.address.state && `, ${company.address.state}`}
                                  </>
                                )}
                              </>
                            ) : 'Not provided'}
                          </Typography>
                        </Grid>

                        {/* Contact Info */}
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Phone sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Contact
                            </Typography>
                          </Box>
                          <Box sx={{ ml: 3 }}>
                            {company.contact?.phone && (
                              <Typography variant="body2">
                                📞 {company.contact.phone}
                              </Typography>
                            )}
                            {company.contact?.email && (
                              <Typography variant="body2">
                                📧 {company.contact.email}
                              </Typography>
                            )}
                            {company.contact?.website && (
                              <Typography variant="body2">
                                🌐 {company.contact.website}
                              </Typography>
                            )}
                            {!company.contact?.phone && !company.contact?.email && !company.contact?.website && (
                              <Typography variant="body2" color="text.secondary">
                                Not provided
                              </Typography>
                            )}
                          </Box>
                        </Grid>

                        {/* Bank Details */}
                        {company.bankDetails?.bankName && (
                          <Grid item xs={12}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <AccountBalance sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                Bank Details
                              </Typography>
                            </Box>
                            <Box sx={{ ml: 3 }}>
                              <Typography variant="body2">
                                {company.bankDetails.bankName}
                              </Typography>
                              {company.bankDetails.accountNumber && (
                                <Typography variant="body2" color="text.secondary">
                                  Acc: {company.bankDetails.accountNumber}
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                        )}

                        {/* Created Date */}
                        <Grid item xs={12}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <CalendarMonth sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                              Created
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ ml: 3 }}>
                            {format(company.createdAt, 'dd/MM/yyyy')}
                          </Typography>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        {/* Mobile Pagination */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {companies.length > companiesPerPage && totalPages > 1 && (
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
                Showing {safePage * companiesPerPage + 1} to{' '}
                {Math.min((safePage + 1) * companiesPerPage, companies.length)} of{' '}
                {companies.length} companies
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
                
                {/* Page indicators */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageIndex;
                    if (totalPages <= 5) {
                      pageIndex = index;
                    } else if (safePage < 3) {
                      pageIndex = index;
                    } else if (safePage >= totalPages - 3) {
                      pageIndex = totalPages - 5 + index;
                    } else {
                      pageIndex = safePage - 2 + index;
                    }
                    
                    return (
                      <Button
                        key={pageIndex}
                        variant={safePage === pageIndex ? "contained" : "outlined"}
                        size="small"
                        onClick={() => setCurrentPage(pageIndex)}
                        sx={{ minWidth: 36, px: 1 }}
                      >
                        {pageIndex + 1}
                      </Button>
                    );
                  })}
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
      {!isMobile && companies.length > companiesPerPage && totalPages > 1 && (
        <Paper elevation={1} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {safePage * companiesPerPage + 1} to{' '}
              {Math.min((safePage + 1) * companiesPerPage, companies.length)} of{' '}
              {companies.length} companies
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
              
              {/* Page indicators */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                  let pageIndex;
                  if (totalPages <= 5) {
                    pageIndex = index;
                  } else if (safePage < 3) {
                    pageIndex = index;
                  } else if (safePage >= totalPages - 3) {
                    pageIndex = totalPages - 5 + index;
                  } else {
                    pageIndex = safePage - 2 + index;
                  }
                  
                  return (
                    <Button
                      key={pageIndex}
                      variant={safePage === pageIndex ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setCurrentPage(pageIndex)}
                      sx={{ minWidth: 40 }}
                    >
                      {pageIndex + 1}
                    </Button>
                  );
                })}
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
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 2 }} />
          Edit
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            handleDeleteCompany(selectedCompany?.id);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Company Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Business sx={{ mr: 1, color: 'primary.main' }} />
            Add New Company
          </Box>
        </DialogTitle>
        <DialogContent>
          {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
          {dialogSuccess && <Alert severity="success" sx={{ mb: 2 }}>{dialogSuccess}</Alert>}
          
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main">
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                freeSolo
                options={availableCompanies}
                value={form.name}
                onChange={(event, newValue) => {
                  if (typeof newValue === 'string') {
                    setForm(prev => ({...prev, name: newValue}));
                  } else if (newValue) {
                    setForm(prev => ({...prev, name: newValue}));
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setForm(prev => ({...prev, name: newInputValue}));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company Name *"
                    required
                    error={!nameValidation.isValid}
                    helperText={!nameValidation.isValid ? nameValidation.message : "Select existing company or type new name"}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                        {option?.charAt(0) || 'C'}
                      </Avatar>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {option}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Registration Number *"
                fullWidth
                value={form.registrationNumber}
                onChange={(e) => setForm({...form, registrationNumber: e.target.value})}
                error={!regValidation.isValid}
                helperText={!regValidation.isValid ? regValidation.message : ""}
                required
              />
            </Grid>

            {/* Company Logo */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Company Logo
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logoPreview && (
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'background.default'
                    }}
                  >
                    <img
                      src={logoPreview}
                      alt="Company Logo Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '120px',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>
                )}

                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploadingLogo ? <CircularProgress size={20} /> : <CloudUpload />}
                  disabled={uploadingLogo}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {logoFile ? 'Change Logo' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleLogoSelect}
                  />
                </Button>

                {logoFile && (
                  <Typography variant="body2" color="text.secondary">
                    Selected: {logoFile.name}
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  Recommended: PNG or JPG format, max 5MB. Logo will appear on payslips and throughout the system.
                </Typography>
              </Box>
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

            {/* Location Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Location Information
              </Typography>
            </Grid>

            {/* Google Places Search Box */}
            <Grid item xs={12}>
              <LocationSearchBox
                onPlaceSelected={(place) => {
                  console.log('Selected place:', place);
                  // Auto-fill all company details from selected place
                  updateFormField('name', place.name);
                  updateFormField('location.latitude', place.latitude.toString());
                  updateFormField('location.longitude', place.longitude.toString());
                  // Use streetAddress instead of full address to avoid duplication
                  updateFormField('address.line1', place.streetAddress);
                  updateFormField('address.city', place.addressComponents.city);
                  updateFormField('address.state', place.addressComponents.state);
                  updateFormField('address.country', place.addressComponents.country);
                  updateFormField('address.postcode', place.addressComponents.postalCode);
                  if (place.phone) updateFormField('contact.phone', place.phone);
                  if (place.website) updateFormField('contact.website', place.website);
                }}
                placeholder="Search for your office location (e.g., 'Petronas Twin Towers')"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  🔍 <strong>Search for your office location</strong> and we'll automatically fill in the details including address, coordinates, phone, and website!
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Or enter manually" size="small" />
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Latitude"
                fullWidth
                value={form.location.latitude}
                onChange={(e) => updateFormField('location.latitude', e.target.value)}
                placeholder="e.g., 3.1390"
                helperText="Auto-filled when you search above, or enter manually"
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
                helperText="Auto-filled when you search above, or enter manually"
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
            onClick={handleCreateCompany}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Creating...' : 'Create Company'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={editDialog} onClose={() => {
        setEditDialog(false);
        setSelectedCompany(null);
      }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Company</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Same form fields as create dialog */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main">
                Basic Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                freeSolo
                options={availableCompanies}
                value={form.name}
                onChange={(event, newValue) => {
                  if (typeof newValue === 'string') {
                    setForm(prev => ({...prev, name: newValue}));
                  } else if (newValue) {
                    setForm(prev => ({...prev, name: newValue}));
                  }
                }}
                onInputChange={(event, newInputValue) => {
                  setForm(prev => ({...prev, name: newInputValue}));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company Name *"
                    required
                    helperText="Select existing company or type new name"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                        {option?.charAt(0) || 'C'}
                      </Avatar>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {option}
                      </Typography>
                    </Box>
                  </Box>
                )}
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

            {/* Company Logo */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Company Logo
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logoPreview && (
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      bgcolor: 'background.default'
                    }}
                  >
                    <img
                      src={logoPreview}
                      alt="Company Logo Preview"
                      style={{
                        maxWidth: '200px',
                        maxHeight: '120px',
                        objectFit: 'contain'
                      }}
                    />
                  </Box>
                )}

                <Button
                  variant="outlined"
                  component="label"
                  startIcon={uploadingLogo ? <CircularProgress size={20} /> : <CloudUpload />}
                  disabled={uploadingLogo}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  {logoFile ? 'Change Logo' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleLogoSelect}
                  />
                </Button>

                {logoFile && (
                  <Typography variant="body2" color="text.secondary">
                    Selected: {logoFile.name}
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  Recommended: PNG or JPG format, max 5MB. Logo will appear on payslips and throughout the system.
                </Typography>
              </Box>
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

            {/* Location Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom color="primary.main" sx={{ mt: 2 }}>
                Location Information
              </Typography>
            </Grid>

            {/* Google Places Search Box */}
            <Grid item xs={12}>
              <LocationSearchBox
                onPlaceSelected={(place) => {
                  console.log('Selected place:', place);
                  // Auto-fill all company details from selected place
                  updateFormField('name', place.name);
                  updateFormField('location.latitude', place.latitude.toString());
                  updateFormField('location.longitude', place.longitude.toString());
                  // Use streetAddress instead of full address to avoid duplication
                  updateFormField('address.line1', place.streetAddress);
                  updateFormField('address.city', place.addressComponents.city);
                  updateFormField('address.state', place.addressComponents.state);
                  updateFormField('address.country', place.addressComponents.country);
                  updateFormField('address.postcode', place.addressComponents.postalCode);
                  if (place.phone) updateFormField('contact.phone', place.phone);
                  if (place.website) updateFormField('contact.website', place.website);
                }}
                placeholder="Search for your office location (e.g., 'Petronas Twin Towers')"
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  🔍 <strong>Search for your office location</strong> and we'll automatically fill in the details including address, coordinates, phone, and website!
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="Or enter manually" size="small" />
              </Divider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Latitude"
                fullWidth
                value={form.location.latitude}
                onChange={(e) => updateFormField('location.latitude', e.target.value)}
                placeholder="e.g., 3.1390"
                helperText="Auto-filled when you search above, or enter manually"
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
                helperText="Auto-filled when you search above, or enter manually"
                type="number"
                inputProps={{ step: "any" }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            setSelectedCompany(null);
          }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpdateCompany}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
          >
            {saving ? 'Updating...' : 'Update Company'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompanyProfile;