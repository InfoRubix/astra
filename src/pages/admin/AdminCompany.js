import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  CircularProgress,
  Autocomplete
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, addDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// Firebase data fetching functions
const fetchCompaniesFromFirebase = async () => {
  try {
    console.log('Fetching companies from Firebase...');
    const companiesQuery = query(
      collection(db, 'companies'), 
      orderBy('name')
    );
    const companiesSnapshot = await getDocs(companiesQuery);
    
    const companies = [];
    companiesSnapshot.forEach((doc) => {
      const companyData = { id: doc.id, ...doc.data() };
      console.log('Found company:', companyData);
      companies.push(companyData);
    });
    
    console.log('Total companies found:', companies.length);
    return companies;
  } catch (error) {
    console.error('Error fetching companies:', error);
    return [];
  }
};

const fetchBranchesForCompany = async (companyId) => {
  if (!companyId) return [];
  
  try {
    console.log('Fetching branches for company:', companyId);
    const branchesQuery = query(
      collection(db, 'branches'),
      where('companyId', '==', companyId),
      orderBy('name')
    );
    const branchesSnapshot = await getDocs(branchesQuery);
    
    const branches = [];
    branchesSnapshot.forEach((doc) => {
      const branchData = { id: doc.id, ...doc.data() };
      console.log('Found branch:', branchData);
      branches.push(branchData);
    });
    
    console.log('Total branches found for', companyId, ':', branches.length);
    return branches;
  } catch (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
};

// Function to create new company if it doesn't exist
const createNewCompany = async (companyName) => {
  try {
    console.log('Creating new company:', companyName);
    const newCompanyData = {
      name: companyName,
      createdAt: new Date(),
      status: 'active',
      // Add any other default company fields as needed
    };
    
    const docRef = await addDoc(collection(db, 'companies'), newCompanyData);
    console.log('New company created with ID:', docRef.id);
    return { id: docRef.id, ...newCompanyData };
  } catch (error) {
    console.error('Error creating new company:', error);
    throw error;
  }
};

// Function to create new branch if it doesn't exist
const createNewBranch = async (branchName, companyId, companyName) => {
  try {
    console.log('Creating new branch:', branchName, 'for company:', companyName);
    const newBranchData = {
      name: branchName,
      companyId: companyId,
      companyName: companyName,
      createdAt: new Date(),
      status: 'active',
      // Add any other default branch fields as needed
    };
    
    const docRef = await addDoc(collection(db, 'branches'), newBranchData);
    console.log('New branch created with ID:', docRef.id);
    return { id: docRef.id, ...newBranchData };
  } catch (error) {
    console.error('Error creating new branch:', error);
    throw error;
  }
};

const detectCompanyAndRoleFromEmail = (email) => {
  // Super admin
  if (email === 'admin@gmail.com') {
    return { role: 'admin', company: null, branch: null, companyId: null, branchId: null };
  }
  
  // Admin pattern: admin[identifier]@gmail.com
  if (email.startsWith('admin') && email.endsWith('@gmail.com')) {
    const identifier = email.replace('admin', '').replace('@gmail.com', '');
    
    // Branch admin mappings
    const branchMappings = {
      'rubixkl': { company: 'RUBIX', branch: 'KL Main Branch', companyId: 'rubix-company', branchId: 'rubix-kl' },
      'rubixjohor': { company: 'RUBIX', branch: 'Johor Branch', companyId: 'rubix-company', branchId: 'rubix-johor' },
      'rubixpenang': { company: 'RUBIX', branch: 'Penang Branch', companyId: 'rubix-company', branchId: 'rubix-penang' },
      'afcpenang': { company: 'AFC', branch: 'Penang Branch', companyId: 'afc-company', branchId: 'afc-penang' },
      'afckl': { company: 'AFC', branch: 'KL Branch', companyId: 'afc-company', branchId: 'afc-kl' },
      'afcipoh': { company: 'AFC', branch: 'Ipoh Branch', companyId: 'afc-company', branchId: 'afc-ipoh' },
      'kfcsabah': { company: 'KFC', branch: 'Sabah Branch', companyId: 'kfc-company', branchId: 'kfc-sabah' },
      'kfckl': { company: 'KFC', branch: 'KL Branch', companyId: 'kfc-company', branchId: 'kfc-kl' },
      'kfcsarawak': { company: 'KFC', branch: 'Sarawak Branch', companyId: 'kfc-company', branchId: 'kfc-sarawak' },
      'asiahahisamkl': { company: 'ASIAH HISAM', branch: 'KL Branch', companyId: 'asiahahisam-company', branchId: 'asiahahisam-kl' },
      'asiahahisamshahalam': { company: 'ASIAH HISAM', branch: 'Shah Alam Branch', companyId: 'asiahahisam-company', branchId: 'asiahahisam-shahalam' },
      'litigationkl': { company: 'LITIGATION', branch: 'KL Branch', companyId: 'litigation-company', branchId: 'litigation-kl' },
      'litigationipoh': { company: 'LITIGATION', branch: 'Ipoh Branch', companyId: 'litigation-company', branchId: 'litigation-ipoh' },
      'litigationjohor': { company: 'LITIGATION', branch: 'Johor Branch', companyId: 'litigation-company', branchId: 'litigation-johor' }
    };
    
    if (branchMappings[identifier]) {
      return { 
        role: 'branch_admin', 
        company: branchMappings[identifier].company,
        branch: branchMappings[identifier].branch,
        companyId: branchMappings[identifier].companyId,
        branchId: branchMappings[identifier].branchId
      };
    }
    
    // Company admin mappings
    const companyMappings = {
      'rubix': { company: 'RUBIX', companyId: 'rubix-company' },
      'afc': { company: 'AFC', companyId: 'afc-company' },
      'kfc': { company: 'KFC', companyId: 'kfc-company' },
      'asiahahisam': { company: 'ASIAH HISAM', companyId: 'asiahahisam-company' },
      'litigation': { company: 'LITIGATION', companyId: 'litigation-company' }
    };
    
    if (companyMappings[identifier]) {
      return { 
        role: 'company_admin', 
        company: companyMappings[identifier].company,
        branch: null,
        companyId: companyMappings[identifier].companyId,
        branchId: null
      };
    }
  }
  
  return { role: 'user', company: null, branch: null, companyId: null, branchId: null };
};

const getDefaultPermissionsByRole = (role) => {
  const permissions = {
    company_admin: {
      canManageEmployees: true,
      canApproveLeaves: true,
      canApproveClaims: true,
      canViewReports: true,
      canManageCompanySettings: true,
      canManageBranches: true,
      canCreateAdminAccounts: false,
      canManageAllUsers: false,
      scope: 'company'
    },
    branch_admin: {
      canManageEmployees: true,
      canApproveLeaves: true,
      canApproveClaims: true,
      canViewReports: true,
      canManageCompanySettings: false,
      canManageBranches: false,
      canCreateAdminAccounts: false,
      canManageAllUsers: false,
      scope: 'branch'
    }
  };
  
  return permissions[role] || permissions.company_admin;
};

function AdminCompany() {
  const { user } = useAuth();
  const [accountType, setAccountType] = useState('company_admin');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company: '',
    companyId: '',
    branch: '',
    branchId: '',
    department: 'Administration',
    position: 'Company Administrator'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [companyInputValue, setCompanyInputValue] = useState('');
  const [branchInputValue, setBranchInputValue] = useState('');

  // Load companies data on component mount
  useEffect(() => {
    const loadCompanies = async () => {
      setDataLoading(true);
      try {
        const companiesData = await fetchCompaniesFromFirebase();
        setCompanies(companiesData);
        console.log('Companies loaded:', companiesData);
      } catch (error) {
        console.error('Error loading companies:', error);
        setError('Failed to load companies data. Please refresh the page.');
      } finally {
        setDataLoading(false);
      }
    };

    if (user?.role === 'admin') {
      loadCompanies();
    }
  }, [user]);

  // Load branches when company is selected
  useEffect(() => {
    const loadBranches = async () => {
      if (formData.companyId && accountType === 'branch_admin') {
        try {
          const branchesData = await fetchBranchesForCompany(formData.companyId);
          setBranches(branchesData);
          console.log('Branches loaded for', formData.company, ':', branchesData);
        } catch (error) {
          console.error('Error loading branches:', error);
          setError('Failed to load branches data.');
        }
      } else {
        setBranches([]);
      }
    };

    loadBranches();
  }, [formData.companyId, accountType]);

  // Sync input values with form data
  useEffect(() => {
    setCompanyInputValue(formData.company);
  }, [formData.company]);

  useEffect(() => {
    setBranchInputValue(formData.branch);
  }, [formData.branch]);

  // Check if current user is super admin (role: 'admin')
  if (!user || user.role !== 'admin') {
    return (
      <Container maxWidth="md">
        <Alert severity="error" sx={{ mt: 4 }}>
          Access Denied: Only super admin can create admin accounts.
        </Alert>
      </Container>
    );
  }

  const handleAccountTypeChange = (type) => {
    setAccountType(type);
    // Reset branch and update position
    if (type === 'company_admin') {
      setFormData(prev => ({ 
        ...prev, 
        branch: '',
        branchId: '', 
        position: 'Company Administrator' 
      }));
      setBranchInputValue(''); // Clear branch input
      setBranches([]); // Clear branches when switching to company admin
    } else {
      setFormData(prev => ({ 
        ...prev, 
        position: 'Branch Administrator' 
      }));
    }
  };

  // Handle company selection/creation
  const handleCompanyChange = async (event, newValue) => {
    try {
      if (typeof newValue === 'string') {
        // User typed a new company name
        const existingCompany = companies.find(c => c.name.toLowerCase() === newValue.toLowerCase());
        
        if (existingCompany) {
          // Company exists, use it
          setFormData({
            ...formData,
            company: existingCompany.name,
            companyId: existingCompany.id,
            branch: '',
            branchId: ''
          });
          setBranchInputValue(''); // Clear branch input
        } else {
          // Create new company
          setError('');
          const newCompany = await createNewCompany(newValue);
          setCompanies(prev => [...prev, newCompany]);
          setFormData({
            ...formData,
            company: newCompany.name,
            companyId: newCompany.id,
            branch: '',
            branchId: ''
          });
          setBranchInputValue(''); // Clear branch input
          console.log('New company created and selected:', newCompany);
        }
      } else if (newValue && typeof newValue === 'object') {
        // User selected from dropdown
        setFormData({
          ...formData,
          company: newValue.name,
          companyId: newValue.id,
          branch: '',
          branchId: ''
        });
        setBranchInputValue(''); // Clear branch input
      } else {
        // Cleared selection
        setFormData({
          ...formData,
          company: '',
          companyId: '',
          branch: '',
          branchId: ''
        });
        setCompanyInputValue('');
        setBranchInputValue('');
      }
    } catch (error) {
      console.error('Error handling company change:', error);
      setError(`Failed to create company: ${error.message}`);
    }
  };

  // Handle branch selection/creation
  const handleBranchChange = async (event, newValue) => {
    console.log('Branch change triggered with value:', newValue);
    console.log('Current company ID:', formData.companyId);
    
    if (!formData.companyId) {
      setError('Please select a company first');
      return;
    }

    try {
      setError(''); // Clear any previous errors
      
      if (typeof newValue === 'string' && newValue.trim() !== '') {
        // User typed a new branch name
        const existingBranch = branches.find(b => b.name.toLowerCase() === newValue.toLowerCase());
        
        if (existingBranch) {
          // Branch exists, use it
          console.log('Using existing branch:', existingBranch);
          setFormData({
            ...formData,
            branch: existingBranch.name,
            branchId: existingBranch.id
          });
          setBranchInputValue(existingBranch.name);
        } else {
          // Create new branch
          console.log('Creating new branch:', newValue);
          const newBranch = await createNewBranch(newValue, formData.companyId, formData.company);
          setBranches(prev => [...prev, newBranch]);
          setFormData({
            ...formData,
            branch: newBranch.name,
            branchId: newBranch.id
          });
          setBranchInputValue(newBranch.name);
          console.log('New branch created and selected:', newBranch);
        }
      } else if (newValue && typeof newValue === 'object') {
        // User selected from dropdown
        console.log('Selected existing branch from dropdown:', newValue);
        setFormData({
          ...formData,
          branch: newValue.name,
          branchId: newValue.id
        });
        setBranchInputValue(newValue.name);
      } else {
        // Cleared selection or empty string
        console.log('Branch selection cleared');
        setFormData({
          ...formData,
          branch: '',
          branchId: ''
        });
        setBranchInputValue('');
      }
    } catch (error) {
      console.error('Error handling branch change:', error);
      setError(`Failed to create branch: ${error.message}`);
    }
  };

  // Handle branch input blur - save typed value
  const handleBranchBlur = async () => {
    if (branchInputValue && branchInputValue.trim() !== '' && 
        branchInputValue !== formData.branch && formData.companyId) {
      console.log('Branch blur - processing typed value:', branchInputValue);
      await handleBranchChange(null, branchInputValue);
    }
  };

  const generateSuggestedEmail = () => {
    if (!formData.company) return '';
    
    const companyKey = formData.company.toLowerCase().replace(/\s+/g, '');
    
    if (accountType === 'company_admin') {
      return `admin${companyKey}@gmail.com`;
    } else if (accountType === 'branch_admin' && formData.branch) {
      const branchKey = formData.branch.toLowerCase()
        .replace(/\s+/g, '')
        .replace('branch', '')
        .replace('main', '');
      return `admin${companyKey}${branchKey}@gmail.com`;
    }
    
    return '';
  };

  const validateEmail = () => {
    if (!formData.email) return 'Email is required';
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    
    // Admin can use any email - no pattern restriction
    // The role and company will be assigned based on form selections
    return null; // Valid
  };

  const createAdminAccount = async () => {
    try {
      // Verify current user is super admin
      if (!user || user.role !== 'admin') {
        throw new Error('Unauthorized: Only super admin can create admin accounts');
      }

      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Get company/branch IDs from form selections
      const getCompanyId = (company) => {
        const mappings = {
          'RUBIX': 'rubix-company',
          'AFC': 'afc-company',
          'KFC': 'kfc-company',
          'ASIAH HISAM': 'asiahahisam-company',
          'LITIGATION': 'litigation-company'
        };
        return mappings[company] || null;
      };

      const getBranchId = (company, branch) => {
        const branchMappings = {
          'RUBIX': {
            'KL Main Branch': 'rubix-kl',
            'Johor Branch': 'rubix-johor', 
            'Penang Branch': 'rubix-penang'
          },
          'AFC': {
            'KL Branch': 'afc-kl',
            'Penang Branch': 'afc-penang',
            'Ipoh Branch': 'afc-ipoh'
          },
          'KFC': {
            'KL Branch': 'kfc-kl',
            'Sabah Branch': 'kfc-sabah',
            'Sarawak Branch': 'kfc-sarawak'
          },
          'ASIAH HISAM': {
            'KL Branch': 'asiahahisam-kl',
            'Shah Alam Branch': 'asiahahisam-shahalam'
          },
          'LITIGATION': {
            'KL Branch': 'litigation-kl',
            'Ipoh Branch': 'litigation-ipoh',
            'Johor Branch': 'litigation-johor'
          }
        };
        return branchMappings[company]?.[branch] || null;
      };

      // Create user profile with admin privileges (using form selections, not email detection)
      const userProfile = {
        uid: userCredential.user.uid,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: accountType,
        company: formData.company,
        companyId: formData.companyId,
        branch: accountType === 'branch_admin' ? formData.branch : null,
        branchId: accountType === 'branch_admin' ? formData.branchId : null,
        department: formData.department,
        position: formData.position,
        
        // Admin-specific fields
        permissions: getDefaultPermissionsByRole(accountType),
        createdBy: user.uid,
        createdByEmail: user.email,
        isActive: true,
        mustChangePassword: true,
        
        // Standard fields
        createdAt: new Date(),
        leaveBalance: {
          annual: 12,
          sick: 14,
          emergency: 3,
          maternity: 90
        }
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
      
      // Create audit log
      await addDoc(collection(db, 'adminLogs'), {
        action: 'create_admin_account',
        performedBy: user.uid,
        performedByEmail: user.email,
        targetEmail: formData.email,
        targetRole: accountType,
        targetCompany: formData.company,
        targetBranch: formData.branch || null,
        timestamp: new Date(),
        details: {
          createdUser: userProfile.uid,
          accountType: accountType
        }
      });

      return { success: true, userId: userCredential.user.uid };
      
    } catch (error) {
      console.error('Error creating admin account:', error);
      return { success: false, error: error.message };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate email pattern
    const emailError = validateEmail();
    if (emailError) {
      setError(emailError);
      return;
    }
    
    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || 
        !formData.password || !formData.company) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (accountType === 'branch_admin' && (!formData.branch || !formData.branchId)) {
      setError('Please select or create a branch for branch administrator');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await createAdminAccount();
      
      if (result.success) {
        setSuccess(`${accountType.replace('_', ' ')} account created successfully!`);
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          company: '',
          companyId: '',
          branch: '',
          branchId: '',
          department: 'Administration',
          position: accountType === 'company_admin' ? 'Company Administrator' : 'Branch Administrator'
        });
        setCompanyInputValue('');
        setBranchInputValue('');
        setBranches([]); // Clear branches after successful creation
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(`Failed to create admin account: ${error.message}`);
    }
    
    setLoading(false);
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4, mt: 2 }}>
        <Typography variant="h4" gutterBottom>
          Admin Company
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Create administrator accounts for companies and branches
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {/* Account Type Selection */}
        <FormControl component="fieldset" margin="normal" fullWidth>
          <FormLabel component="legend">Account Type</FormLabel>
          <RadioGroup
            value={accountType}
            onChange={(e) => handleAccountTypeChange(e.target.value)}
            sx={{ mt: 1 }}
          >
            <FormControlLabel 
              value="company_admin" 
              control={<Radio />} 
              label="Company Administrator (Full company access)" 
            />
            <FormControlLabel 
              value="branch_admin" 
              control={<Radio />} 
              label="Branch Administrator (Single branch access)" 
            />
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 3 }} />

        <Box component="form" onSubmit={handleSubmit}>
          {/* Personal Information */}
          <Typography variant="h6" gutterBottom>
            Personal Information
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              required
              fullWidth
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({...formData, firstName: e.target.value})}
            />
            <TextField
              required
              fullWidth
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({...formData, lastName: e.target.value})}
            />
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Company & Branch Selection */}
          <Typography variant="h6" gutterBottom>
            Company & Branch Assignment
          </Typography>

          {dataLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" sx={{ ml: 2 }}>
                Loading companies...
              </Typography>
            </Box>
          ) : (
            <>
              <Autocomplete
                freeSolo
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                options={companies}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                value={companies.find(c => c.name === formData.company) || formData.company || null}
                onChange={handleCompanyChange}
                onInputChange={(event, newInputValue, reason) => {
                  // Handle when user types and presses Enter or loses focus
                  if (reason === 'reset' && newInputValue) {
                    handleCompanyChange(event, newInputValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company"
                    required
                    margin="normal"
                    helperText="Select an existing company or type to create a new one (press Enter to create)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value && !companies.find(c => c.name === e.target.value)) {
                        e.preventDefault();
                        handleCompanyChange(e, e.target.value);
                      }
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    {option.name}
                  </Box>
                )}
                sx={{ mb: 2 }}
              />

              {/* Branch Selection (only for branch admins) */}
              {accountType === 'branch_admin' && (
                <>
                  <Autocomplete
                    freeSolo
                    selectOnFocus
                    clearOnBlur={false}
                    handleHomeEndKeys
                    options={branches}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                    value={branches.find(b => b.name === formData.branch) || null}
                    inputValue={branchInputValue}
                    onChange={handleBranchChange}
                    onInputChange={(event, newInputValue, reason) => {
                      console.log('Branch input change:', newInputValue, 'reason:', reason);
                      setBranchInputValue(newInputValue || '');
                      
                      // Handle when user selects from dropdown or clears
                      if (reason === 'reset' && newInputValue) {
                        handleBranchChange(event, newInputValue);
                      } else if (reason === 'clear') {
                        setFormData({
                          ...formData,
                          branch: '',
                          branchId: ''
                        });
                      }
                    }}
                    disabled={!formData.companyId}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Branch"
                        required
                        margin="normal"
                        helperText={!formData.companyId 
                          ? "Please select a company first" 
                          : "Select an existing branch or type to create a new one"
                        }
                        onBlur={handleBranchBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && branchInputValue && branchInputValue.trim() !== '') {
                            e.preventDefault();
                            handleBranchChange(e, branchInputValue);
                          }
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props}>
                        {option.name}
                      </Box>
                    )}
                    sx={{ mb: 2 }}
                  />
                  {formData.companyId && branches.length === 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, ml: 2 }}>
                      No existing branches found for this company. Type to create a new branch.
                    </Typography>
                  )}
                </>
              )}
            </>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Email and Login Details */}
          <Typography variant="h6" gutterBottom>
            Login Details
          </Typography>

          <TextField
            required
            fullWidth
            margin="normal"
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            helperText="Any valid email address can be used. Role and company will be assigned based on your selections above."
          />
          
          {/* Auto-fill suggested email button */}
          {formData.company && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setFormData({...formData, email: generateSuggestedEmail()})}
              sx={{ mt: 1, mb: 2 }}
            >
              Use Suggested Pattern: {generateSuggestedEmail()}
            </Button>
          )}

          <TextField
            required
            fullWidth
            margin="normal"
            label="Temporary Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            helperText="Admin will be prompted to change password on first login"
          />

          <TextField
            required
            fullWidth
            margin="normal"
            label="Position"
            value={formData.position}
            onChange={(e) => setFormData({...formData, position: e.target.value})}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? 'Creating Account...' : `Create ${accountType.replace('_', ' ')} Account`}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default AdminCompany;