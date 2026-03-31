import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
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
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  LinearProgress,
  Fab,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { 
  MoreVert,
  Edit,
  LockReset,
  Delete,
  PersonAdd,
  People,
  AdminPanelSettings,
  Email,
  Phone,
  Business,
  CloudUpload,
  FileDownload,
  Warning,
  AccountTree,
  PictureAsPdf,
  GetApp,
  ArrowForward,
  ArrowBack,
  Search,
  Clear,
  CheckCircle,
  ErrorOutline,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import CompanyFilter from '../../components/admin/CompanyFilter';
import CompanyStatsCard from '../../components/admin/CompanyStatsCard';
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp, writeBatch, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { db, auth, adminAuth } from '../../services/firebase';
import { pdfService } from '../../services/pdfService';
import { getPositionsForCompany, getAllPositionsForCompany } from '../../utils/positionHierarchy';
import {
  exportEmployeesToCSV,
  downloadImportTemplate,
  parseEmployeeCSV,
  validateEmployeeData,
  importEmployees
} from '../../utils/employeeImportExport';

function Employees() {
  const { resetPassword, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [resetDialog, setResetDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [csvDialog, setCsvDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availablePositions, setAvailablePositions] = useState([]);
  const [branchInputValue, setBranchInputValue] = useState('');
  const [editBranchInputValue, setEditBranchInputValue] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState(null);
  const [importStep, setImportStep] = useState(0); // 0=upload, 1=preview/validate, 2=results
  const [parsedEmployees, setParsedEmployees] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [addLoading, setAddLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    phone: '',
    role: '',
    company: '',
    branch: '',
    branchId: '',
    position: '',
    experienceLevel: 'entry',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    payslipMessage: '',
    // Salary fields
    basicSalary: '',
    hourlyRate: '',
    allowances: '',
    overtimeMultiplier: '1.5'
  });
  const [deactivateDialog, setDeactivateDialog] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    phone: '',
    role: 'user',
    company: '',
    branch: '',
    branchId: '',
    position: '',
    experienceLevel: 'entry',
    password: '',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    payslipMessage: '',
    // Salary fields
    basicSalary: '',
    hourlyRate: '',
    allowances: '',
    overtimeMultiplier: '1.5'
  });

  // Removed pagination - now showing all employees with scroll

  // Helper function to get employee's company consistently
  const getEmployeeCompany = (employee) => {
    return employee.company || employee.originalCompanyName || 'RUBIX';
  };


  useEffect(() => {
    if (user) {
      loadEmployees();
      loadCompaniesAndDepartments();
    }
  }, [user]);

  // Reload branches when companies are updated (to catch newly created branches)
  useEffect(() => {
    const reloadAllBranches = async () => {
      if (availableCompanies.length > 0) {
        console.log('📋 Reloading branches for all companies due to company list update');
        // Clear current branches to force fresh load
        setAvailableBranches([]);
      }
    };
    reloadAllBranches();
  }, [availableCompanies]);

  // Load positions when addForm company changes
  useEffect(() => {
    const loadPositions = async () => {
      if (addForm.company) {
        const positions = await getAllPositionsForCompany(addForm.company, db);
        // Ensure we always set a valid array, filtering out any undefined/null values
        setAvailablePositions(Array.isArray(positions) ? positions.filter(p => p) : []);
      } else {
        // If no company is set (e.g., for system admins), include system-level positions
        setAvailablePositions(['Admin', 'System Administrator', 'Super Admin']);
      }
    };
    loadPositions();
  }, [addForm.company]);

  // Load positions when editForm company changes
  useEffect(() => {
    const loadPositions = async () => {
      if (editForm.company) {
        const positions = await getAllPositionsForCompany(editForm.company, db);
        // Ensure we always set a valid array, filtering out any undefined/null values
        setAvailablePositions(Array.isArray(positions) ? positions.filter(p => p) : []);
      } else {
        // If no company is set (e.g., for system admins), include system-level positions
        setAvailablePositions(['Admin', 'System Administrator', 'Super Admin']);
      }
    };
    loadPositions();
  }, [editForm.company]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      // Load all employees from Firestore
      const q = query(
        collection(db, 'users')
      );
      
      const querySnapshot = await getDocs(q);
      const companyEmployees = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        joinDate: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      // Sort by name
      companyEmployees.sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      setEmployees(companyEmployees);
      console.log('Loaded company employees:', companyEmployees);
      
      // Debug: Log company field values for each employee
      companyEmployees.forEach(emp => {
        const empCompany = getEmployeeCompany(emp);
        console.log(`Employee: ${emp.firstName} ${emp.lastName}`, {
          company: emp.company,
          originalCompanyName: emp.originalCompanyName,
          resolvedCompany: empCompany
        });
      });
    } catch (error) {
      console.error('Error loading employees:', error);
      setError('Failed to load employees: ' + error.message);
    }
    setLoading(false);
  };

  const loadCompaniesAndDepartments = async () => {
    try {
      // Load companies from companySettings collection
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companies = companySettingsSnapshot.docs
        .map(doc => doc.data().company)
        .filter(c => c && c.trim()); // Filter out undefined/null/empty companies

      // Also get companies from users collection as fallback
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const userCompanies = new Set();
      const userDepartments = new Set();

      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const company = userData.originalCompanyName || userData.company;
        const department = userData.department;

        if (company && company.trim()) userCompanies.add(company);
        if (department && department.trim()) userDepartments.add(department);
      });

      // Combine and deduplicate companies, filter out any remaining invalid values
      const allCompanies = [...new Set([...companies, ...userCompanies])]
        .filter(c => c && c.trim())
        .sort();
      const allDepartments = [...userDepartments]
        .filter(d => d && d.trim())
        .sort();

      setAvailableCompanies(allCompanies);
      setAvailableDepartments(allDepartments);

      console.log('Loaded companies:', allCompanies);
      console.log('Loaded departments:', allDepartments);
    } catch (error) {
      console.error('Error loading companies and departments:', error);
    }
  };

  const loadBranches = async (companyName) => {
    if (!companyName) {
      console.log('📋 Employees - No company name provided, clearing branches');
      setAvailableBranches([]);
      return;
    }

    // Debug: Load all branches first to see what's available
    try {
      const allBranchesQuery = query(collection(db, 'branches'));
      const allBranchesSnapshot = await getDocs(allBranchesQuery);
      const allBranches = allBranchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        companyName: doc.data().companyName,
        ...doc.data()
      }));
      console.log('📋 Employees - All branches in database:', allBranches);
      console.log('📋 Employees - Looking for branches with companyName:', companyName);
    } catch (debugError) {
      console.warn('Debug query failed:', debugError);
    }

    try {
      console.log('📋 Employees - Loading branches for company:', companyName);
      // Remove orderBy to avoid Firestore index issues
      const branchesQuery = query(
        collection(db, 'branches'),
        where('companyName', '==', companyName)
      );
      const branchesSnapshot = await getDocs(branchesQuery);
      const branches = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        ...doc.data()
      }));

      // Filter out branches with undefined/null/empty names and sort
      const branchNames = branches
        .map(b => b.name)
        .filter(name => name && name.trim()) // Remove undefined/null/empty names
        .sort();

      console.log('📋 Employees - Loaded branches for company:', companyName, '- Branches:', branches.length, '- Names:', branchNames);
      console.log('📋 Employees - Full branch data:', branches);
      setAvailableBranches(branchNames);

      // Debug: Log current availableBranches state after setting
      setTimeout(() => {
        console.log('📋 Employees - availableBranches state after setting:', branchNames);
      }, 100);

      return branchNames; // Return for immediate use if needed
    } catch (error) {
      console.error('Error loading branches for company', companyName, ':', error);
      setAvailableBranches([]);
      return [];
    }
  };

  const handleBranchChange = async (event, newValue) => {
    const branchName = newValue || branchInputValue;
    if (!branchName || !branchName.trim()) return;
    
    const trimmedBranchName = branchName.trim();
    const companyName = addForm.company;
    
    if (!companyName) {
      setError('Please select a company first');
      return;
    }
    
    try {
      // Check if branch exists
      const branchesQuery = query(
        collection(db, 'branches'),
        where('companyName', '==', companyName),
        where('name', '==', trimmedBranchName)
      );
      const branchesSnapshot = await getDocs(branchesQuery);
      
      let branchId;
      if (branchesSnapshot.empty) {
        // Create new branch
        console.log('📋 Creating new branch:', trimmedBranchName, 'for company:', companyName);
        const branchData = {
          name: trimmedBranchName,
          companyName: companyName,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          isActive: true
        };
        
        const docRef = await addDoc(collection(db, 'branches'), branchData);
        branchId = docRef.id;
        console.log('✅ New branch created with ID:', branchId);
        
        // Refresh branches list
        await loadBranches(companyName);
      } else {
        branchId = branchesSnapshot.docs[0].id;
        console.log('📋 Using existing branch with ID:', branchId);
      }
      
      setAddForm({
        ...addForm,
        branch: trimmedBranchName,
        branchId: branchId
      });
      setBranchInputValue('');
      
    } catch (error) {
      console.error('Error handling branch change:', error);
      setError('Failed to process branch: ' + error.message);
    }
  };

  const handleEditBranchChange = async (event, newValue) => {
    const branchName = newValue || editBranchInputValue;
    if (!branchName || !branchName.trim()) return;
    
    const trimmedBranchName = branchName.trim();
    const companyName = editForm.company;
    
    if (!companyName) {
      setError('Please select a company first');
      return;
    }
    
    try {
      // Check if branch exists
      const branchesQuery = query(
        collection(db, 'branches'),
        where('companyName', '==', companyName),
        where('name', '==', trimmedBranchName)
      );
      const branchesSnapshot = await getDocs(branchesQuery);
      
      let branchId;
      if (branchesSnapshot.empty) {
        // Create new branch
        console.log('📋 Creating new branch:', trimmedBranchName, 'for company:', companyName);
        const branchData = {
          name: trimmedBranchName,
          companyName: companyName,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          isActive: true
        };
        
        const docRef = await addDoc(collection(db, 'branches'), branchData);
        branchId = docRef.id;
        console.log('✅ New branch created with ID:', branchId);
        
        // Refresh branches list
        await loadBranches(companyName);
      } else {
        branchId = branchesSnapshot.docs[0].id;
        console.log('📋 Using existing branch with ID:', branchId);
      }
      
      setEditForm({
        ...editForm,
        branch: trimmedBranchName,
        branchId: branchId
      });
      setEditBranchInputValue(trimmedBranchName); // Keep the value visible
      
    } catch (error) {
      console.error('Error handling branch change:', error);
      setError('Failed to process branch: ' + error.message);
    }
  };

  const handleBranchBlur = async () => {
    if (branchInputValue && branchInputValue.trim() !== '' && 
        branchInputValue !== addForm.branch && addForm.company) {
      await handleBranchChange(null, branchInputValue);
    }
  };

  const handleEditBranchBlur = async () => {
    if (editBranchInputValue && editBranchInputValue.trim() !== '' && 
        editBranchInputValue !== editForm.branch && editForm.company) {
      await handleEditBranchChange(null, editBranchInputValue);
    }
  };

  const handleMenuClick = (event, employee) => {
    setAnchorEl(event.currentTarget);
    setSelectedEmployee(employee);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedEmployee(null);
  };

  const handlePasswordReset = async () => {
    if (!selectedEmployee) return;
    
    setResetLoading(true);
    setError('');
    
    const result = await resetPassword(selectedEmployee.email);
    
    if (result.success) {
      setSuccess(`Password reset email sent to ${selectedEmployee.email}`);
      setResetDialog(false);
    } else {
      setError(`Failed to send reset email: ${result.error}`);
    }
    
    setResetLoading(false);
    handleMenuClose();
  };

  // CSV Upload Functions (using employeeImportExport utility)
  const handleCsvFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file');
      return;
    }

    setCsvFile(file);
    setError('');

    // Read, parse, and validate the CSV content
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const parsed = parseEmployeeCSV(csvText);

        // Build preview data (first 5 rows for the table)
        const previewRows = parsed.rawRows.slice(0, 5);
        setCsvPreview({
          headers: parsed.headers,
          rows: previewRows,
          totalRows: parsed.employees.length
        });

        // Run validation
        const validation = validateEmployeeData(parsed.employees);
        setValidationResult(validation);
        setParsedEmployees(parsed.employees);

        // Move to preview step
        setImportStep(1);
        setError('');
      } catch (parseError) {
        console.error('CSV parse error:', parseError);
        setError(parseError.message || 'Failed to parse CSV file');
        setCsvPreview(null);
        setParsedEmployees([]);
        setValidationResult(null);
      }
    };

    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!parsedEmployees || parsedEmployees.length === 0) return;

    // Re-validate before import
    const validation = validateEmployeeData(parsedEmployees);
    if (!validation.valid) {
      setError('Please fix validation errors before importing');
      return;
    }

    setImportLoading(true);
    setImportProgress(0);
    setError('');

    try {
      const result = await importEmployees(parsedEmployees, {
        createdByUid: user?.uid,
        createdByName: user ? `${user.firstName} ${user.lastName}` : undefined,
        onProgress: (current, total) => {
          setImportProgress(Math.round((current / total) * 100));
        }
      });

      setImportResults({
        success: result.successCount,
        errors: result.errorCount,
        errorDetails: result.errors
      });

      // Move to results step
      setImportStep(2);

      if (result.successCount > 0) {
        setSuccess(`Successfully imported ${result.successCount} employee${result.successCount !== 1 ? 's' : ''}`);
        await loadEmployees();
      }

      if (result.errorCount > 0) {
        setError(`${result.errorCount} employee${result.errorCount !== 1 ? 's' : ''} failed to import. See details below.`);
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      setError('Failed to import CSV: ' + error.message);
    } finally {
      setImportLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      setError('');
      const result = exportEmployeesToCSV(filteredEmployees, {
        selectedCompany,
        selectedDepartment
      });
      if (result.success) {
        setSuccess(`Exported ${result.count} employees to ${result.filename}`);
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setError(error.message || 'Failed to export CSV. Please try again.');
    }
  };

  const resetImportDialog = () => {
    setCsvFile(null);
    setCsvPreview(null);
    setParsedEmployees([]);
    setValidationResult(null);
    setImportResults(null);
    setImportStep(0);
    setImportProgress(0);
    setImportLoading(false);
    setError('');
  };

  const handleAddEmployee = async () => {
    console.log('🚀 Add Employee clicked, form data:', addForm);
    
    if (addLoading) {
      console.log('⏳ Already processing, ignoring click');
      return;
    }
    
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) {
      setError('First name, last name, and email are required');
      console.log('❌ Validation failed: Missing required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const sanitizedEmail = addForm.email.trim().toLowerCase();
    if (!emailRegex.test(sanitizedEmail)) {
      setError('Please enter a valid email address (e.g., user@example.com)');
      console.log('❌ Validation failed: Invalid email format:', sanitizedEmail);
      return;
    }

    if (!addForm.password.trim() || addForm.password.length < 6) {
      setError('Password is required and must be at least 6 characters');
      console.log('❌ Validation failed: Invalid password');
      return;
    }

    if (!addForm.company.trim()) {
      setError('Please select a company');
      console.log('❌ Validation failed: Missing company');
      return;
    }

    console.log('✅ Validation passed, attempting to create employee...');
    setAddLoading(true);
    setError('');

    try {
      // Check if email already exists in Firestore (use sanitizedEmail for consistency)
      const existingQuery = query(
        collection(db, 'users'),
        where('email', '==', sanitizedEmail)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        setError('An employee with this email already exists');
        return;
      }

      console.log('🔐 Creating Firebase Auth account using admin auth instance...');
      console.log('📧 Email being used:', sanitizedEmail);
      // Use admin auth instance to create user without affecting current admin session
      const userCredential = await createUserWithEmailAndPassword(
        adminAuth,
        sanitizedEmail,
        addForm.password
      );
      const authUser = userCredential.user;
      console.log('✅ Firebase Auth account created with UID:', authUser.uid);

      // Create Firestore user record (DO NOT include password)
      const newEmployee = {
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: sanitizedEmail,
        department: addForm.department.trim() || 'General',
        phone: addForm.phone.trim() || '',
        role: addForm.role,
        company: addForm.company,
        originalCompanyName: addForm.company, // For consistency
        branch: addForm.branch || '',
        branchId: addForm.branchId || '',
        branchName: addForm.branch || '', // For compatibility
        position: addForm.position.trim() || '',
        experienceLevel: addForm.experienceLevel || 'entry',
        bankName: addForm.bankName.trim() || '',
        accountNumber: addForm.accountNumber.trim() || '',
        accountHolderName: addForm.accountHolderName.trim() || '',
        payslipMessage: addForm.payslipMessage.trim() || '',
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        // Note: Password is NOT stored here for security
        
        // Salary information
        salary: {
          basicSalary: parseFloat(addForm.basicSalary) || null,
          hourlyRate: parseFloat(addForm.hourlyRate) || null,
          allowances: parseFloat(addForm.allowances) || 0,
          overtimeMultiplier: parseFloat(addForm.overtimeMultiplier) || 1.5,
          currency: 'MYR',
          effectiveDate: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          source: 'admin-created'
        }
      };

      console.log('📝 Creating Firestore user document...');
      // Use the auth UID as the document ID for consistency between Auth and Firestore
      await setDoc(doc(db, 'users', authUser.uid), newEmployee);
      console.log('✅ Employee Firestore record created successfully with UID:', authUser.uid);

      // Sign out the newly created user from admin auth instance
      console.log('🔄 Signing out new employee from admin auth instance...');
      await signOut(adminAuth);

      // Verify that the user document exists and is accessible
      console.log('✅ Verifying user document in Firestore...');
      const verifyDoc = await getDoc(doc(db, 'users', authUser.uid));
      if (!verifyDoc.exists()) {
        console.error('❌ User document not found after creation!');
        throw new Error('User document verification failed');
      }
      console.log('✅ User document verified successfully');

      console.log('✅ Employee created successfully, admin session maintained');
      setSuccess(`Employee ${addForm.firstName} ${addForm.lastName} has been added successfully. They can now log in with their email and password.`);
      setAddDialog(false);
      resetAddForm();
      await loadEmployees();
      
    } catch (error) {
      console.error('❌ Error adding employee:', error);
      
      // Provide more specific error messages
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered in the system');
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else if (error.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters');
      } else {
        setError('Failed to add employee: ' + error.message);
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditEmployee = async () => {
    console.log('🚀 Edit Employee clicked, form data:', editForm);
    
    if (editLoading) {
      console.log('⏳ Already processing, ignoring click');
      return;
    }
    
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      setError('First name, last name, and email are required');
      console.log('❌ Validation failed: Missing required fields');
      return;
    }

    if (!editForm.company.trim()) {
      setError('Please select a company');
      console.log('❌ Validation failed: Missing company');
      return;
    }

    console.log('✅ Validation passed, attempting to update employee...');
    setEditLoading(true);
    setError('');
    
    try {
      // Check if email already exists (excluding current employee)
      const existingQuery = query(
        collection(db, 'users'),
        where('email', '==', editForm.email.trim().toLowerCase())
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      const existingUser = existingSnapshot.docs.find(doc => doc.id !== selectedEmployee.id);
      if (existingUser) {
        setError('An employee with this email already exists');
        return;
      }

      // Update employee data
      const updatedEmployee = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim().toLowerCase(),
        department: editForm.department.trim() || 'General',
        phone: editForm.phone.trim() || '',
        role: editForm.role,
        company: editForm.company,
        originalCompanyName: editForm.company, // For consistency
        branch: editForm.branch || '',
        branchId: editForm.branchId || '',
        branchName: editForm.branch || '', // For compatibility
        position: editForm.position.trim() || '',
        experienceLevel: editForm.experienceLevel || 'entry',
        bankName: editForm.bankName.trim() || '',
        accountNumber: editForm.accountNumber.trim() || '',
        accountHolderName: editForm.accountHolderName.trim() || '',
        payslipMessage: editForm.payslipMessage.trim() || '',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`,
        
        // Update salary information
        salary: {
          basicSalary: parseFloat(editForm.basicSalary) || null,
          hourlyRate: parseFloat(editForm.hourlyRate) || null,
          allowances: parseFloat(editForm.allowances) || 0,
          overtimeMultiplier: parseFloat(editForm.overtimeMultiplier) || 1.5,
          currency: 'MYR',
          lastUpdated: serverTimestamp(),
          source: 'admin-updated'
        }
      };

      console.log('📝 Updating employee with data:', updatedEmployee);
      await updateDoc(doc(db, 'users', selectedEmployee.id), updatedEmployee);
      console.log('✅ Employee updated successfully');
      
      setSuccess(`Employee ${editForm.firstName} ${editForm.lastName} has been updated successfully.`);
      setEditDialog(false);
      handleMenuClose();
      await loadEmployees();
    } catch (error) {
      console.error('❌ Error updating employee:', error);
      setError('Failed to update employee: ' + error.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivateEmployee = async () => {
    if (!selectedEmployee) return;
    
    setDeactivateLoading(true);
    setError('');
    
    try {
      // Update employee's isActive status
      await updateDoc(doc(db, 'users', selectedEmployee.id), {
        isActive: !selectedEmployee.isActive,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`
      });
      
      const action = selectedEmployee.isActive ? 'deactivated' : 'reactivated';
      setSuccess(`Employee ${selectedEmployee.firstName} ${selectedEmployee.lastName} has been ${action} successfully.`);
      setDeactivateDialog(false);
      await loadEmployees();
    } catch (error) {
      console.error('Error updating employee status:', error);
      setError('Failed to update employee status: ' + error.message);
    } finally {
      setDeactivateLoading(false);
      handleMenuClose();
    }
  };

  const resetAddForm = () => {
    setAddForm({
      firstName: '',
      lastName: '',
      email: '',
      department: '',
      phone: '',
      role: 'user',
      company: '',
      branch: '',
      branchId: '',
      position: '',
      experienceLevel: 'entry',
      password: '',
      bankName: '',
      accountNumber: '',
      accountHolderName: '',
      payslipMessage: '',
      // Salary fields
      basicSalary: '',
      hourlyRate: '',
      allowances: '',
      overtimeMultiplier: '1.5'
    });
    setBranchInputValue('');
    setAvailableBranches([]);
  };

  const getRoleColor = (role) => {
    return role === 'admin' ? 'error' : 'primary';
  };

  const getRoleIcon = (role) => {
    return role === 'admin' ? <AdminPanelSettings /> : <People />;
  };

  // Calculate department stats from real employee data
  const calculateDepartmentStats = () => {
    const departmentCount = {};
    const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'info'];
    
    // Count employees by department (exclude admins)
    (employees || [])
      .filter(emp => emp.role !== 'admin')
      .forEach(emp => {
        const dept = emp.department || 'General';
        departmentCount[dept] = (departmentCount[dept] || 0) + 1;
      });

    // Convert to array with colors
    return Object.entries(departmentCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  };

  // Calculate company stats from real employee data
  const calculateCompanyStats = () => {
    const companyCount = {};
    const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'info'];
    
    // Count employees by company (exclude admins)
    (employees || [])
      .filter(emp => emp.role !== 'admin')
      .forEach(emp => {
        const company = getEmployeeCompany(emp);
        companyCount[company] = (companyCount[company] || 0) + 1;
      });

    // Convert to array with colors
    return Object.entries(companyCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  };

  const departmentStats = calculateDepartmentStats();
  const companyStats = calculateCompanyStats();

  // Filter employees based on selected company, department, and search query
  const filteredEmployees = (employees || []).filter(emp => {
    let matchesCompany = true;
    let matchesDepartment = true;
    let matchesSearch = true;
    
    if (selectedCompany) {
      const empCompany = getEmployeeCompany(emp);
      matchesCompany = empCompany === selectedCompany;
    }
    
    if (selectedDepartment) {
      matchesDepartment = emp.department === selectedDepartment;
    }

    // Search filter - search by name, email, department, position, or company
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const department = (emp.department || '').toLowerCase();
      const position = (emp.position || '').toLowerCase();
      const company = getEmployeeCompany(emp).toLowerCase();
      
      matchesSearch = fullName.includes(query) ||
                     email.includes(query) ||
                     department.includes(query) ||
                     position.includes(query) ||
                     company.includes(query);
    }
    
    return matchesCompany && matchesDepartment && matchesSearch;
  });

  // No pagination - show all filtered employees with scroll

  // Calculate filtered companies and departments
  const filteredCompanies = new Set();
  const filteredDepartments = new Set();
  
  filteredEmployees
    .filter(emp => emp.role !== 'admin')
    .forEach(emp => {
      const company = getEmployeeCompany(emp);
      if (company) filteredCompanies.add(company);
      
      const department = emp.department;
      if (department) filteredDepartments.add(department);
    });

  // Calculate filtered department stats
  const calculateFilteredDepartmentStats = () => {
    const departmentCount = {};
    const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'info'];
    
    // Count employees by department (exclude admins) from filtered employees
    filteredEmployees
      .filter(emp => emp.role !== 'admin')
      .forEach(emp => {
        const dept = emp.department || 'General';
        departmentCount[dept] = (departmentCount[dept] || 0) + 1;
      });

    // Convert to array with colors
    return Object.entries(departmentCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  };

  const filteredDepartmentStats = calculateFilteredDepartmentStats();

  // Export functions
  const exportToPDF = async () => {
    try {
      setError(''); // Clear any previous errors
      
      const success = await pdfService.exportEmployees(filteredEmployees, {
        selectedCompany,
        selectedDepartment
      });
      
      if (success) {
        setSuccess('Employee list exported to PDF successfully!');
      } else {
        setError('Failed to export PDF. Please try again.');
      }
    } catch (error) {
      console.error('Error in PDF export:', error);
      setError(`Failed to export: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  // Keep original complex function as backup
  const exportToPDFBackup = () => {
    try {
      setError(''); // Clear any previous errors
      
      // Create a simple text-based PDF without external dependencies
      const createSimplePDF = () => {
        // Create CSV content first for reliable export
        const headers = ['Name', 'Email', 'Role', 'Company', 'Department', 'Position', 'Phone', 'Join Date', 'Status'];
        
        const csvData = filteredEmployees.map(emp => [
          `${emp.firstName || ''} ${emp.lastName || ''}`,
          emp.email || '',
          (emp.role || 'user').charAt(0).toUpperCase() + (emp.role || 'user').slice(1),
          getEmployeeCompany(emp),
          emp.department || 'N/A',
          emp.position || 'N/A',
          emp.phone || 'N/A',
          emp.joinDate ? emp.joinDate.toLocaleDateString('en-GB') : 'N/A',
          emp.isActive ? 'Active' : 'Inactive'
        ]);
        
        // Create formatted text content for PDF
        let content = 'EMPLOYEE LIST REPORT\n';
        content += '='.repeat(50) + '\n\n';
        content += `Generated on: ${new Date().toLocaleDateString('en-GB')}\n`;
        
        // Add filters if any
        if (selectedCompany || selectedDepartment) {
          content += 'Applied Filters: ';
          if (selectedCompany) content += `Company: ${selectedCompany}`;
          if (selectedDepartment) content += `${selectedCompany ? ', ' : ''}Department: ${selectedDepartment}`;
          content += '\n';
        }
        
        content += `Total Employees: ${filteredEmployees.length}\n\n`;
        
        if (filteredEmployees.length === 0) {
          content += 'No employees found to export.\n';
        } else {
          // Add table headers
          content += headers.join(' | ') + '\n';
          content += '-'.repeat(headers.join(' | ').length) + '\n';
          
          // Add employee data
          csvData.forEach(row => {
            content += row.join(' | ') + '\n';
          });
        }
        
        return content;
      };
      
      // Try to use jsPDF with proper table formatting
      const attemptPDFCreation = async () => {
        try {
          const { jsPDF } = await import('jspdf');
          const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for better table fit
          
          // Title
          doc.setFontSize(20);
          doc.setTextColor(25, 118, 210);
          doc.text('Employee List Report', 20, 20);
          
          // Date
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')}`, 20, 30);
          
          // Filters
          let startY = 40;
          if (selectedCompany || selectedDepartment) {
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            let filterText = 'Applied Filters: ';
            if (selectedCompany) filterText += `Company: ${selectedCompany}`;
            if (selectedDepartment) filterText += `${selectedCompany ? ', ' : ''}Department: ${selectedDepartment}`;
            doc.text(filterText, 20, startY);
            startY += 10;
          }
          
          // Employee count
          doc.setFontSize(10);
          doc.setTextColor(100, 100, 100);
          doc.text(`Total Employees: ${filteredEmployees.length}`, 20, startY);
          startY += 15;
          
          if (filteredEmployees.length === 0) {
            doc.setFontSize(12);
            doc.setTextColor(255, 0, 0);
            doc.text('No employees found to export.', 20, startY + 10);
          } else {
            // Create manual table with proper formatting
            const headers = ['Name', 'Email', 'Role', 'Company', 'Department', 'Position', 'Phone', 'Join Date', 'Status'];
            const columnWidths = [30, 45, 20, 25, 25, 30, 30, 25, 20]; // Total: 250mm (fits in landscape)
            const rowHeight = 8;
            
            // Draw table headers
            doc.setFillColor(25, 118, 210);
            doc.rect(20, startY, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            
            let xPos = 20;
            headers.forEach((header, index) => {
              doc.text(header, xPos + 2, startY + 5.5);
              xPos += columnWidths[index];
            });
            
            // Draw table rows
            doc.setTextColor(0, 0, 0);
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
            
            let yPos = startY + rowHeight;
            
            filteredEmployees.forEach((emp, rowIndex) => {
              // Alternate row colors
              if (rowIndex % 2 === 1) {
                doc.setFillColor(245, 245, 245);
                doc.rect(20, yPos, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
              }
              
              const rowData = [
                `${emp.firstName || ''} ${emp.lastName || ''}`,
                emp.email || '',
                (emp.role || 'user').charAt(0).toUpperCase() + (emp.role || 'user').slice(1),
                getEmployeeCompany(emp),
                emp.department || 'N/A',
                emp.position || 'N/A',
                emp.phone || 'N/A',
                emp.joinDate ? emp.joinDate.toLocaleDateString('en-GB') : 'N/A',
                emp.isActive ? 'Active' : 'Inactive'
              ];
              
              xPos = 20;
              rowData.forEach((data, colIndex) => {
                // Truncate text if too long
                let displayText = data;
                if (displayText.length > columnWidths[colIndex] / 3) {
                  displayText = displayText.substring(0, Math.floor(columnWidths[colIndex] / 3) - 2) + '..';
                }
                
                doc.text(displayText, xPos + 2, yPos + 5.5);
                xPos += columnWidths[colIndex];
              });
              
              yPos += rowHeight;
              
              // Check for page break
              if (yPos > 180) { // Leave margin at bottom
                doc.addPage();
                yPos = 20;
                
                // Redraw headers on new page
                doc.setFillColor(25, 118, 210);
                doc.rect(20, yPos, columnWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
                
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(9);
                doc.setFont(undefined, 'bold');
                
                xPos = 20;
                headers.forEach((header, index) => {
                  doc.text(header, xPos + 2, yPos + 5.5);
                  xPos += columnWidths[index];
                });
                
                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'normal');
                doc.setFontSize(8);
                yPos += rowHeight;
              }
            });
            
            // Draw table borders
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            
            // Vertical lines
            xPos = 20;
            for (let i = 0; i <= columnWidths.length; i++) {
              const tableHeight = Math.min(yPos - startY, 180 - startY);
              doc.line(xPos, startY, xPos, startY + tableHeight);
              if (i < columnWidths.length) {
                xPos += columnWidths[i];
              }
            }
            
            // Horizontal lines
            const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
            const numberOfRows = Math.min(filteredEmployees.length + 1, Math.floor((180 - startY) / rowHeight));
            for (let i = 0; i <= numberOfRows; i++) {
              const lineY = startY + (i * rowHeight);
              doc.line(20, lineY, 20 + tableWidth, lineY);
            }
          }
          
          // Save the PDF
          const sanitizeFilename = (str) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const companyPart = selectedCompany ? `${sanitizeFilename(selectedCompany)}_` : '';
          const departmentPart = selectedDepartment ? `${sanitizeFilename(selectedDepartment)}_` : '';
          const datePart = new Date().toISOString().split('T')[0];
          const filename = `employees_${companyPart}${departmentPart}${datePart}.pdf`;
          
          doc.save(filename);
          return true;
        } catch (pdfError) {
          console.warn('PDF creation failed, falling back to text file:', pdfError);
          return false;
        }
      };
      
      // Try PDF first, fallback to text file
      attemptPDFCreation().then(success => {
        if (success) {
          setSuccess('Employee list exported to PDF successfully!');
        } else {
          // Fallback to text file
          const textContent = createSimplePDF();
          const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          
          const sanitizeFilename = (str) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const companyPart = selectedCompany ? `${sanitizeFilename(selectedCompany)}_` : '';
          const departmentPart = selectedDepartment ? `${sanitizeFilename(selectedDepartment)}_` : '';
          const datePart = new Date().toISOString().split('T')[0];
          const filename = `employees_${companyPart}${departmentPart}${datePart}.txt`;
          
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          setSuccess('Employee list exported to text file successfully! (PDF creation unavailable)');
        }
      }).catch(error => {
        console.error('Export failed:', error);
        setError(`Failed to export: ${error.message || 'Unknown error'}. Please try again.`);
      });
      
    } catch (error) {
      console.error('Error in export function:', error);
      setError(`Failed to export: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  // exportToCSV now delegates to handleExportCSV from the utility
  const exportToCSV = handleExportCSV;

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
              <People sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Employee Management
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage employees, roles, and account access
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Desktop Export Buttons */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1 }}>
              <Button 
                variant="outlined" 
                startIcon={<PictureAsPdf />} 
                onClick={exportToPDF}
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'error.main',
                  borderColor: 'error.main',
                  '&:hover': {
                    borderColor: 'error.dark',
                    backgroundColor: 'error.light'
                  }
                }}
              >
                Export PDF
              </Button>
              <Button 
                variant="outlined" 
                startIcon={<GetApp />} 
                onClick={exportToCSV}
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: 'none',
                  color: 'success.main',
                  borderColor: 'success.main',
                  '&:hover': {
                    borderColor: 'success.dark',
                    backgroundColor: 'success.light'
                  }
                }}
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => {
                  resetImportDialog();
                  setCsvDialog(true);
                }}
                sx={{
                  borderRadius: 3,
                  fontWeight: 600,
                  textTransform: 'none'
                }}
              >
                Import CSV
              </Button>
            </Box>

            {/* Mobile Export Menu */}
            <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 1 }}>
              <IconButton 
                onClick={exportToPDF}
                sx={{ 
                  bgcolor: 'error.light', 
                  color: 'error.main',
                  '&:hover': { bgcolor: 'error.main', color: 'white' }
                }}
                size="small"
              >
                <PictureAsPdf />
              </IconButton>
              <IconButton 
                onClick={exportToCSV}
                sx={{ 
                  bgcolor: 'success.light', 
                  color: 'success.main',
                  '&:hover': { bgcolor: 'success.main', color: 'white' }
                }}
                size="small"
              >
                <GetApp />
              </IconButton>
              <IconButton
                onClick={() => {
                  resetImportDialog();
                  setCsvDialog(true);
                }}
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'primary.main', color: 'white' }
                }}
                size="small"
              >
                <CloudUpload />
              </IconButton>
            </Box>

            <Fab 
              color="primary" 
              variant="extended"
              onClick={() => {
                setAddDialog(true);
                // Clear branches initially and they will load when company is selected
                setAvailableBranches([]);
                setBranchInputValue('');
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
              <PersonAdd sx={{ mr: 1 }} />
              {isMobile ? 'Add' : 'Add Employee'}
            </Fab>
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


      {/* Enhanced Summary Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        <Grid item xs={6} sm={6} md={4}>
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
                  <People sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {filteredEmployees.filter(emp => emp.role !== 'admin').length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    {selectedCompany ? `${selectedCompany} Employees` : 'Total Employees'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={4}>
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
                  boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
                }}>  
                  <AccountTree sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {selectedCompany ? filteredDepartments.size : availableDepartments.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    {selectedCompany ? `${selectedCompany} Departments` : 'All Departments'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={12} md={4}>
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
                  <Business sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {selectedCompany ? filteredCompanies.size : availableCompanies.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    {selectedCompany ? `${selectedCompany} Companies` : 'All Companies'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={6}>
          <CompanyStatsCard data={filteredEmployees} title={selectedCompany ? `${selectedCompany} Companies` : "Companies"} />
        </Grid>
        
        <Grid item xs={12} sm={6} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedCompany ? `${selectedCompany} Departments` : 'Departments'}
              </Typography>
              {(filteredDepartmentStats || []).map((dept, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">{dept.name}</Typography>
                  <Chip label={dept.count} color={dept.color} size="small" />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Employees Section */}
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
        <Box sx={{ p: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography 
            variant="h6"
            sx={{ 
              fontWeight: 600,
              color: 'primary.main',
              fontSize: { xs: '1.125rem', sm: '1.25rem' }
            }}
          >
            All Employees {filteredEmployees.length > 0 && `(${filteredEmployees.length})`}
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: { xs: 180, sm: 250 }, flex: { xs: 1, sm: 'none' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchQuery('')}
                      sx={{ p: 0.5 }}
                    >
                      <Clear sx={{ fontSize: 18 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <CompanyFilter 
              selectedCompany={selectedCompany}
              onCompanyChange={setSelectedCompany}
              data={employees}
            />
            <Autocomplete
              size="small"
              sx={{ minWidth: { xs: 150, sm: 200 }, flex: { xs: 1, sm: 'none' } }}
              options={(availableDepartments || []).filter(d => d)}
              value={selectedDepartment || ''}
              onChange={(event, newValue) => setSelectedDepartment(newValue || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter by Department"
                  variant="outlined"
                />
              )}
            />
            {(selectedCompany || selectedDepartment || searchQuery) && (
              <Button
                size="small"
                onClick={() => {
                  setSelectedCompany('');
                  setSelectedDepartment('');
                  setSearchQuery('');
                }}
                sx={{ textTransform: 'none' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </Box>
        <Divider />
        
        {/* Desktop Table View */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <TableContainer sx={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Position</TableCell>
                  <TableCell>Experience</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Join Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: getRoleColor(employee.role) + '.main' }}>
                          {employee.firstName?.charAt(0) || ''}{employee.lastName?.charAt(0) || ''}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {employee.firstName || ''} {employee.lastName || ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {employee.email || ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Chip
                        icon={getRoleIcon(employee.role)}
                        label={(employee.role || 'user').charAt(0).toUpperCase() + (employee.role || 'user').slice(1)}
                        color={getRoleColor(employee.role)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={getEmployeeCompany(employee)}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">{employee.department}</Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">{employee.position || 'N/A'}</Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={(employee.experienceLevel || 'entry').charAt(0).toUpperCase() + (employee.experienceLevel || 'entry').slice(1)}
                        size="small"
                        color={employee.experienceLevel === 'entry' ? 'default' : 
                               employee.experienceLevel === 'mid' ? 'primary' :
                               employee.experienceLevel === 'senior' ? 'secondary' : 'success'}
                        variant="outlined"
                        sx={{ 
                          textTransform: 'capitalize',
                          fontWeight: 500
                        }}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Email sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="caption">{employee.email}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="caption">{employee.phone}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {employee.joinDate.toLocaleDateString('en-GB')}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={employee.isActive ? 'Active' : 'Inactive'}
                        color={employee.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuClick(e, employee)}>
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
          {filteredEmployees.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No employees found
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2, maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              {filteredEmployees.map((employee, index) => (
                <Card 
                  key={employee.id}
                  sx={{
                    mb: 2,
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      borderColor: 'primary.light'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header with Avatar and Name */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar
                        sx={{
                          width: 48,
                          height: 48,
                          mr: 2,
                          bgcolor: getRoleColor(employee.role) + '.main',
                          boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                        }}
                      >
                        {employee.firstName?.charAt(0) || ''}{employee.lastName?.charAt(0) || ''}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.125rem',
                            mb: 0.5
                          }}
                        >
                          {employee.firstName || ''} {employee.lastName || ''}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {employee.email || ''}
                        </Typography>
                      </Box>
                      <IconButton
                        onClick={(e) => handleMenuClick(e, employee)}
                        sx={{
                          bgcolor: 'grey.100',
                          '&:hover': { bgcolor: 'grey.200' }
                        }}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>

                    {/* Role and Status */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        icon={getRoleIcon(employee.role)}
                        label={(employee.role || 'user').charAt(0).toUpperCase() + (employee.role || 'user').slice(1)}
                        color={getRoleColor(employee.role)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip 
                        label={employee.isActive ? 'Active' : 'Inactive'}
                        color={employee.isActive ? 'success' : 'default'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip 
                        label={(employee.experienceLevel || 'entry').charAt(0).toUpperCase() + (employee.experienceLevel || 'entry').slice(1)}
                        size="small"
                        color={employee.experienceLevel === 'entry' ? 'default' : 
                               employee.experienceLevel === 'mid' ? 'primary' :
                               employee.experienceLevel === 'senior' ? 'secondary' : 'success'}
                        variant="outlined"
                        sx={{ 
                          textTransform: 'capitalize',
                          fontWeight: 500
                        }}
                      />
                    </Box>

                    {/* Company and Department */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            COMPANY
                          </Typography>
                          <Chip 
                            label={getEmployeeCompany(employee)}
                            color="primary"
                            variant="outlined"
                            size="small"
                            sx={{ 
                              mt: 0.5,
                              display: 'block',
                              width: 'fit-content',
                              fontWeight: 500
                            }}
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            DEPARTMENT
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {employee.department || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Position and Join Date */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            POSITION
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {employee.position || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            JOIN DATE
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {employee.joinDate.toLocaleDateString('en-GB')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Contact Information */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'grey.50', 
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                        CONTACT INFORMATION
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Email sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {employee.email}
                        </Typography>
                      </Box>
                      {employee.phone && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {employee.phone}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>

        {/* Employee Count - Removed Pagination */}
        {filteredEmployees.length > 0 && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Showing all {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={async () => {
          if (selectedEmployee) {
            console.log('🔧 Opening Edit Dialog for employee:', {
              name: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
              email: selectedEmployee.email,
              role: selectedEmployee.role,
              position: selectedEmployee.position,
              company: selectedEmployee.company,
              originalCompanyName: selectedEmployee.originalCompanyName
            });

            const employeeCompany = selectedEmployee.company || selectedEmployee.originalCompanyName || '';

            setEditForm({
              firstName: selectedEmployee.firstName || '',
              lastName: selectedEmployee.lastName || '',
              email: selectedEmployee.email || '',
              department: selectedEmployee.department || '',
              phone: selectedEmployee.phone || '',
              role: selectedEmployee.role || '',
              company: employeeCompany,
              branch: selectedEmployee.branch || selectedEmployee.branchName || '',
              branchId: selectedEmployee.branchId || '',
              position: selectedEmployee.position || '',
              experienceLevel: selectedEmployee.experienceLevel || 'entry',
              bankName: selectedEmployee.bankName || '',
              accountNumber: selectedEmployee.accountNumber || '',
              accountHolderName: selectedEmployee.accountHolderName || '',
              payslipMessage: selectedEmployee.payslipMessage || '',
              // Salary fields
              basicSalary: selectedEmployee.salary?.basicSalary?.toString() || '',
              hourlyRate: selectedEmployee.salary?.hourlyRate?.toString() || '',
              allowances: selectedEmployee.salary?.allowances?.toString() || '',
              overtimeMultiplier: selectedEmployee.salary?.overtimeMultiplier?.toString() || '1.5'
            });

            // Set input values to match form values and load branches for the selected company
            setEditBranchInputValue(selectedEmployee.branch || selectedEmployee.branchName || '');

            if (employeeCompany) {
              try {
                const branches = await loadBranches(employeeCompany);
                console.log('📋 Edit Dialog - Loaded branches for company:', employeeCompany, 'Available branches:', branches);
              } catch (error) {
                console.error('❌ Error loading branches:', error);
              }
            } else {
              console.log('⚠️ No company set for employee, using system-level positions only');
            }

            setEditDialog(true);
          }
        }}>
          <Edit sx={{ mr: 2 }} />
          Edit Employee
        </MenuItem>
        
        <MenuItem onClick={() => {
          setResetDialog(true);
        }}>
          <LockReset sx={{ mr: 2 }} />
          Reset Password
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => {
          setDeactivateDialog(true);
        }} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 2 }} />
          {selectedEmployee?.isActive ? 'Deactivate' : 'Reactivate'}
        </MenuItem>
      </Menu>

      {/* Password Reset Confirmation Dialog */}
      <Dialog 
        open={resetDialog} 
        onClose={() => setResetDialog(false)} 
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
            <LockReset sx={{ mr: 1, color: 'warning.main' }} />
            Reset Password
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                This will send a password reset email to the employee's registered email address.
              </Alert>
              
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Employee Details:
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {selectedEmployee.firstName} {selectedEmployee.lastName}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {selectedEmployee.email}
                </Typography>
                <Typography variant="body2">
                  <strong>Role:</strong> {selectedEmployee.role}
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                The employee will receive an email with instructions to create a new password. 
                They will need to check their inbox and spam folder.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handlePasswordReset}
            disabled={resetLoading}
          >
            {resetLoading ? 'Sending...' : 'Send Reset Email'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Employee Confirmation Dialog */}
      <Dialog 
        open={deactivateDialog} 
        onClose={() => {
          setDeactivateDialog(false);
          handleMenuClose();
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
            <Warning sx={{ mr: 1, color: 'error.main' }} />
            {selectedEmployee?.isActive ? 'Deactivate Employee' : 'Reactivate Employee'}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box>
              <Alert severity={selectedEmployee.isActive ? "warning" : "info"} sx={{ mb: 2 }}>
                {selectedEmployee.isActive 
                  ? "This will deactivate the employee's account. They will not be able to log in until reactivated."
                  : "This will reactivate the employee's account. They will be able to log in again."
                }
              </Alert>
              
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Employee Details:
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {selectedEmployee.firstName} {selectedEmployee.lastName}
                </Typography>
                <Typography variant="body2">
                  <strong>Email:</strong> {selectedEmployee.email}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Status:</strong> {selectedEmployee.isActive ? 'Active' : 'Inactive'}
                </Typography>
                <Typography variant="body2">
                  <strong>Role:</strong> {selectedEmployee.role}
                </Typography>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {selectedEmployee.isActive 
                  ? "The employee will be unable to access their account after deactivation."
                  : "The employee will regain access to their account after reactivation."
                }
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeactivateDialog(false);
            handleMenuClose();
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color={selectedEmployee?.isActive ? "error" : "success"}
            onClick={handleDeactivateEmployee}
            disabled={deactivateLoading}
          >
            {deactivateLoading 
              ? 'Processing...' 
              : selectedEmployee?.isActive 
                ? 'Deactivate Employee' 
                : 'Reactivate Employee'
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSV Import Dialog - Enhanced with stepper, validation, and preview */}
      <Dialog
        open={csvDialog}
        onClose={() => {
          setCsvDialog(false);
          resetImportDialog();
        }}
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CloudUpload sx={{ mr: 1, color: 'primary.main' }} />
            Import Employees from CSV
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Stepper */}
          <Stepper activeStep={importStep} sx={{ mb: 3, mt: 1 }}>
            <Step>
              <StepLabel>Upload CSV</StepLabel>
            </Step>
            <Step>
              <StepLabel>Preview &amp; Validate</StepLabel>
            </Step>
            <Step>
              <StepLabel>Results</StepLabel>
            </Step>
          </Stepper>

          {/* Step 0: Upload */}
          {importStep === 0 && (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Upload a CSV file to bulk import employees. The CSV should contain one employee per row.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  <strong>Required columns:</strong> firstName, lastName, email
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  <strong>Optional columns:</strong> phone, company, department, position, role
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownload />}
                  onClick={downloadImportTemplate}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600
                  }}
                >
                  Download CSV Template
                </Button>
              </Box>

              <Box
                sx={{
                  mb: 3,
                  p: 4,
                  border: '2px dashed',
                  borderColor: csvFile ? 'success.main' : 'divider',
                  borderRadius: 3,
                  textAlign: 'center',
                  bgcolor: csvFile ? 'success.light' : 'grey.50',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.light'
                  }
                }}
              >
                <input
                  accept=".csv"
                  style={{ display: 'none' }}
                  id="csv-file-input"
                  type="file"
                  onChange={handleCsvFileChange}
                />
                <label htmlFor="csv-file-input">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<CloudUpload />}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5
                    }}
                  >
                    Select CSV File
                  </Button>
                </label>
                {csvFile && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <CheckCircle color="success" fontSize="small" />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      {csvFile.name}
                    </Typography>
                  </Box>
                )}
                {!csvFile && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Drag and drop or click to select a .csv file
                  </Typography>
                )}
              </Box>

              <Alert severity="info" sx={{ borderRadius: 2 }} icon={<Info />}>
                <Typography variant="body2">
                  <strong>Note:</strong> This import creates employee records in the system database only.
                  Employees will still need login credentials set up separately via Firebase Auth or password reset.
                </Typography>
              </Alert>
            </>
          )}

          {/* Step 1: Preview & Validate */}
          {importStep === 1 && (
            <>
              {/* Validation Summary */}
              {validationResult && (
                <Box sx={{ mb: 3 }}>
                  {validationResult.valid ? (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} icon={<CheckCircle />}>
                      <Typography variant="body2" fontWeight={600}>
                        All {parsedEmployees.length} employee records passed validation.
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} icon={<ErrorOutline />}>
                      <Typography variant="body2" fontWeight={600}>
                        {validationResult.errors.length} validation error{validationResult.errors.length !== 1 ? 's' : ''} found. Please fix these before importing.
                      </Typography>
                    </Alert>
                  )}

                  {/* Validation Errors */}
                  {validationResult.errors.length > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 2,
                        maxHeight: 180,
                        overflow: 'auto',
                        borderColor: 'error.light',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="subtitle2" color="error.main" gutterBottom fontWeight={600}>
                        Errors (must fix):
                      </Typography>
                      {validationResult.errors.map((err, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                          <ErrorOutline sx={{ fontSize: 16, color: 'error.main', mt: 0.25 }} />
                          <Typography variant="caption" color="error.main">
                            {err.message}
                          </Typography>
                        </Box>
                      ))}
                    </Paper>
                  )}

                  {/* Validation Warnings */}
                  {validationResult.warnings.length > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 2,
                        maxHeight: 150,
                        overflow: 'auto',
                        borderColor: 'warning.light',
                        borderRadius: 2
                      }}
                    >
                      <Typography variant="subtitle2" color="warning.dark" gutterBottom fontWeight={600}>
                        Warnings ({validationResult.warnings.length}):
                      </Typography>
                      {validationResult.warnings.slice(0, 20).map((warn, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                          <Warning sx={{ fontSize: 16, color: 'warning.main', mt: 0.25 }} />
                          <Typography variant="caption" color="warning.dark">
                            {warn.message}
                          </Typography>
                        </Box>
                      ))}
                      {validationResult.warnings.length > 20 && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          ... and {validationResult.warnings.length - 20} more warnings
                        </Typography>
                      )}
                    </Paper>
                  )}
                </Box>
              )}

              {/* Data Preview Table */}
              {csvPreview && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                    Data Preview ({csvPreview?.totalRows || 0} total employees)
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                      maxHeight: 300,
                      borderRadius: 2,
                      '& .MuiTableHead-root .MuiTableCell-root': {
                        bgcolor: 'primary.main',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.75rem'
                      }
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600, minWidth: 40 }}>#</TableCell>
                          {(csvPreview?.headers || []).map((header, index) => (
                            <TableCell key={index} sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600 }}>
                              {header}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(csvPreview?.rows || []).map((row, rowIndex) => (
                          <TableRow
                            key={rowIndex}
                            sx={{
                              '&:nth-of-type(odd)': { bgcolor: 'grey.50' },
                              '&:hover': { bgcolor: 'action.hover' }
                            }}
                          >
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{rowIndex + 1}</Typography>
                            </TableCell>
                            {(row || []).map((cell, cellIndex) => (
                              <TableCell key={cellIndex}>
                                <Typography variant="caption">{cell || '-'}</Typography>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {(csvPreview?.totalRows || 0) > 5 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Showing first 5 of {csvPreview.totalRows} rows
                    </Typography>
                  )}
                </Box>
              )}

              {/* Parsed Employee Summary Table */}
              {parsedEmployees.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                    Parsed Employee Data
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{
                      maxHeight: 250,
                      borderRadius: 2,
                      '& .MuiTableHead-root .MuiTableCell-root': {
                        bgcolor: 'grey.100',
                        fontWeight: 600,
                        fontSize: '0.75rem'
                      }
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>First Name</TableCell>
                          <TableCell>Last Name</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Company</TableCell>
                          <TableCell>Department</TableCell>
                          <TableCell>Position</TableCell>
                          <TableCell>Role</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parsedEmployees.slice(0, 10).map((emp, idx) => {
                          const hasError = validationResult?.errors?.some(e => e.row === emp._rowNumber);
                          return (
                            <TableRow
                              key={idx}
                              sx={{
                                bgcolor: hasError ? 'error.light' : 'inherit',
                                '&:nth-of-type(odd)': { bgcolor: hasError ? 'error.light' : 'grey.50' },
                                '&:hover': { bgcolor: hasError ? 'error.light' : 'action.hover' }
                              }}
                            >
                              <TableCell>
                                <Typography variant="caption" color={!emp.firstName ? 'error.main' : 'text.primary'}>
                                  {emp.firstName || '(missing)'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color={!emp.lastName ? 'error.main' : 'text.primary'}>
                                  {emp.lastName || '(missing)'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color={!emp.email ? 'error.main' : 'text.primary'}>
                                  {emp.email || '(missing)'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color={!emp.company ? 'text.secondary' : 'text.primary'}>
                                  {emp.company || '(none)'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {emp.department || 'General'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">
                                  {emp.position || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={emp.role || 'user'}
                                  size="small"
                                  color={emp.role === 'admin' ? 'error' : 'primary'}
                                  variant="outlined"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {parsedEmployees.length > 10 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Showing first 10 of {parsedEmployees.length} employees
                    </Typography>
                  )}
                </Box>
              )}

              {/* Progress bar during import */}
              {importLoading && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" fontWeight={600}>
                      Importing employees... {importProgress}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={importProgress}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      '& .MuiLinearProgress-bar': { borderRadius: 4 }
                    }}
                  />
                </Box>
              )}
            </>
          )}

          {/* Step 2: Results */}
          {importStep === 2 && importResults && (
            <>
              <Box sx={{ textAlign: 'center', py: 2 }}>
                {importResults.success > 0 && importResults.errors === 0 ? (
                  <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                ) : importResults.success > 0 ? (
                  <Warning sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
                ) : (
                  <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                )}
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  Import Complete
                </Typography>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: 'success.light',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'success.main'
                    }}
                  >
                    <Typography variant="h4" color="success.dark" fontWeight={700}>
                      {importResults.success}
                    </Typography>
                    <Typography variant="body2" color="success.dark" fontWeight={500}>
                      Successfully Imported
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: importResults.errors > 0 ? 'error.light' : 'grey.100',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: importResults.errors > 0 ? 'error.main' : 'divider'
                    }}
                  >
                    <Typography variant="h4" color={importResults.errors > 0 ? 'error.dark' : 'text.secondary'} fontWeight={700}>
                      {importResults.errors}
                    </Typography>
                    <Typography variant="body2" color={importResults.errors > 0 ? 'error.dark' : 'text.secondary'} fontWeight={500}>
                      Failed
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {(importResults?.errorDetails || []).length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    maxHeight: 200,
                    overflow: 'auto',
                    borderColor: 'error.light',
                    borderRadius: 2,
                    mb: 2
                  }}
                >
                  <Typography variant="subtitle2" color="error.main" gutterBottom fontWeight={600}>
                    Error Details:
                  </Typography>
                  {importResults.errorDetails.map((errMsg, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
                      <ErrorOutline sx={{ fontSize: 16, color: 'error.main', mt: 0.25 }} />
                      <Typography variant="caption" color="error.main">
                        {errMsg}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}

              {importResults.success > 0 && (
                <Alert severity="info" sx={{ borderRadius: 2 }} icon={<Info />}>
                  <Typography variant="body2">
                    Imported employees have been added to the database with <strong>requiresPasswordReset</strong> flag.
                    They will need Firebase Auth credentials set up before they can log in.
                    Use the password reset feature to send them login credentials.
                  </Typography>
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {importStep === 0 && (
            <Button
              onClick={() => {
                setCsvDialog(false);
                resetImportDialog();
              }}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Cancel
            </Button>
          )}
          {importStep === 1 && (
            <>
              <Button
                onClick={() => {
                  setImportStep(0);
                  setCsvFile(null);
                  setCsvPreview(null);
                  setParsedEmployees([]);
                  setValidationResult(null);
                }}
                sx={{ borderRadius: 2, textTransform: 'none' }}
                startIcon={<ArrowBack />}
              >
                Back
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                onClick={handleCsvImport}
                disabled={importLoading || !validationResult?.valid || parsedEmployees.length === 0}
                startIcon={importLoading ? <CircularProgress size={18} color="inherit" /> : <CloudUpload />}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3
                }}
              >
                {importLoading
                  ? `Importing... ${importProgress}%`
                  : `Import ${parsedEmployees.length} Employee${parsedEmployees.length !== 1 ? 's' : ''}`
                }
              </Button>
            </>
          )}
          {importStep === 2 && (
            <>
              <Button
                onClick={() => resetImportDialog()}
                sx={{ borderRadius: 2, textTransform: 'none' }}
                startIcon={<CloudUpload />}
              >
                Import More
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                onClick={() => {
                  setCsvDialog(false);
                  resetImportDialog();
                }}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Done
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => {
          setEditDialog(false);
          handleMenuClose();
        }} 
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Edit sx={{ mr: 1, color: 'primary.main' }} />
            Edit Employee
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="First Name"
                fullWidth
                value={editForm.firstName}
                onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Last Name"
                fullWidth
                value={editForm.lastName}
                onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                required
                disabled
                helperText="Email cannot be changed"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={editForm.phone}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Department"
                fullWidth
                value={editForm.department}
                onChange={(e) => setEditForm({...editForm, department: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={editForm.position}
                  onChange={(e) => setEditForm({...editForm, position: e.target.value})}
                  label="Position"
                >
                  {editForm.company && (availablePositions || []).filter(pos => pos).map((pos) => (
                    <MenuItem key={pos} value={pos}>
                      {pos}
                    </MenuItem>
                  ))}
                  {!editForm.company && (
                    <MenuItem value="" disabled>
                      Select a company first
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Experience Level</InputLabel>
                <Select
                  value={editForm.experienceLevel}
                  label="Experience Level"
                  onChange={(e) => setEditForm({...editForm, experienceLevel: e.target.value})}
                >
                  <MenuItem value="entry">Entry Level</MenuItem>
                  <MenuItem value="mid">Mid Level</MenuItem>
                  <MenuItem value="senior">Senior Level</MenuItem>
                  <MenuItem value="lead">Lead/Manager</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={(availableCompanies || []).filter(c => c)}
                value={editForm.company || ''}
                onChange={(event, newValue) => {
                  setEditForm({...editForm, company: newValue || '', branch: '', branchId: ''});
                  loadBranches(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                  setEditForm({...editForm, company: newInputValue || '', branch: '', branchId: ''});
                  if (newInputValue) loadBranches(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company"
                    required
                    helperText="Type a new company or select from existing ones"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={(availableBranches || []).filter(b => b)}
                value={editForm.branch || ''}
                inputValue={editBranchInputValue || ''}
                onChange={(event, newValue) => {
                  handleEditBranchChange(event, newValue);
                }}
                onInputChange={(event, newInputValue) => {
                  setEditBranchInputValue(newInputValue || '');
                }}
                onBlur={handleEditBranchBlur}
                disabled={!editForm.company}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Branch"
                    helperText={!editForm.company ? "Select a company first" : "Type a new branch or select from existing ones"}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Role"
                select
                fullWidth
                value={editForm.role}
                onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                required
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="company-admin">Company Admin</MenuItem>
                <MenuItem value="branch-admin">Branch Admin</MenuItem>
              </TextField>
            </Grid>
            
            {/* Bank Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'primary.main' }}>
                Bank Information
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Name"
                fullWidth
                value={editForm.bankName}
                onChange={(e) => setEditForm({...editForm, bankName: e.target.value})}
                placeholder="e.g., CIMB Bank, Maybank"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Number"
                fullWidth
                value={editForm.accountNumber}
                onChange={(e) => setEditForm({...editForm, accountNumber: e.target.value})}
                placeholder="Bank account number"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Holder Name"
                fullWidth
                value={editForm.accountHolderName}
                onChange={(e) => setEditForm({...editForm, accountHolderName: e.target.value})}
                placeholder="Name as per bank account"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Payslip Message"
                fullWidth
                multiline
                rows={2}
                value={editForm.payslipMessage}
                onChange={(e) => setEditForm({...editForm, payslipMessage: e.target.value})}
                placeholder="Custom message for payslip"
              />
            </Grid>
            
            {/* Salary Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'success.main' }}>
                Salary Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set salary details for payslip generation. Either use basic salary OR hourly rate.
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Basic Salary (RM)"
                type="number"
                fullWidth
                value={editForm.basicSalary}
                onChange={(e) => setEditForm({...editForm, basicSalary: e.target.value})}
                placeholder="e.g., 5000"
                helperText="Fixed monthly salary"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Hourly Rate (RM)"
                type="number"
                fullWidth
                value={editForm.hourlyRate}
                onChange={(e) => setEditForm({...editForm, hourlyRate: e.target.value})}
                placeholder="e.g., 25.50"
                helperText="For hourly-based payroll"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allowances (RM)"
                type="number"
                fullWidth
                value={editForm.allowances}
                onChange={(e) => setEditForm({...editForm, allowances: e.target.value})}
                placeholder="e.g., 300"
                helperText="Additional allowances"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime Multiplier"
                type="number"
                fullWidth
                value={editForm.overtimeMultiplier}
                onChange={(e) => setEditForm({...editForm, overtimeMultiplier: e.target.value})}
                placeholder="e.g., 1.5"
                helperText="Overtime rate multiplier"
                inputProps={{ min: 1, step: 0.1 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            handleMenuClose();
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleEditEmployee}
            disabled={editLoading}
            startIcon={editLoading ? <CircularProgress size={20} /> : <Edit />}
          >
            {editLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Employee Dialog */}
      <Dialog 
        open={addDialog} 
        onClose={() => setAddDialog(false)} 
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
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PersonAdd sx={{ mr: 1, color: 'primary.main' }} />
            Add New Employee
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Add a new employee to the system. This will create both their Firebase account and user profile.
          </Alert>
          
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="First Name"
                fullWidth
                value={addForm.firstName}
                onChange={(e) => setAddForm({...addForm, firstName: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Last Name"
                fullWidth
                value={addForm.lastName}
                onChange={(e) => setAddForm({...addForm, lastName: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={addForm.email}
                onChange={(e) => {
                  // Auto-sanitize email: remove spaces and convert to lowercase
                  const sanitized = e.target.value.trim().toLowerCase();
                  setAddForm({...addForm, email: sanitized});
                }}
                required
                helperText="This will be their login email"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={addForm.password}
                onChange={(e) => setAddForm({...addForm, password: e.target.value})}
                required
                helperText="Initial password for their account"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                fullWidth
                value={addForm.phone}
                onChange={(e) => setAddForm({...addForm, phone: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Department"
                fullWidth
                value={addForm.department}
                onChange={(e) => setAddForm({...addForm, department: e.target.value})}
                placeholder="e.g., IT, HR, Finance"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Position</InputLabel>
                <Select
                  value={addForm.position}
                  onChange={(e) => setAddForm({...addForm, position: e.target.value})}
                  label="Position"
                >
                  {addForm.company && (availablePositions || []).filter(pos => pos).map((pos) => (
                    <MenuItem key={pos} value={pos}>
                      {pos}
                    </MenuItem>
                  ))}
                  {!addForm.company && (
                    <MenuItem value="" disabled>
                      Select a company first
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Experience Level</InputLabel>
                <Select
                  value={addForm.experienceLevel}
                  label="Experience Level"
                  onChange={(e) => setAddForm({...addForm, experienceLevel: e.target.value})}
                >
                  <MenuItem value="entry">Entry Level</MenuItem>
                  <MenuItem value="mid">Mid Level</MenuItem>
                  <MenuItem value="senior">Senior Level</MenuItem>
                  <MenuItem value="lead">Lead/Manager</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={(availableCompanies || []).filter(c => c)}
                value={addForm.company || ''}
                onChange={(event, newValue) => {
                  setAddForm({...addForm, company: newValue || '', branch: '', branchId: ''});
                  loadBranches(newValue || '');
                }}
                onInputChange={(event, newInputValue) => {
                  setAddForm({...addForm, company: newInputValue || '', branch: '', branchId: ''});
                  if (newInputValue) loadBranches(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company"
                    required
                    helperText="Type a new company or select from existing ones"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={(availableBranches || []).filter(b => b)}
                value={addForm.branch || ''}
                inputValue={branchInputValue || ''}
                onChange={(event, newValue) => {
                  handleBranchChange(event, newValue);
                }}
                onInputChange={(event, newInputValue) => {
                  setBranchInputValue(newInputValue || '');
                }}
                onBlur={handleBranchBlur}
                disabled={!addForm.company}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Branch"
                    helperText={!addForm.company ? "Select a company first" : "Type a new branch or select from existing ones"}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Role"
                select
                fullWidth
                value={addForm.role}
                onChange={(e) => setAddForm({...addForm, role: e.target.value})}
                required
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="company-admin">Company Admin</MenuItem>
                <MenuItem value="branch-admin">Branch Admin</MenuItem>
              </TextField>
            </Grid>
            
            {/* Bank Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Bank Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Optional: Bank details will be displayed on payslips
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bank Name"
                fullWidth
                value={addForm.bankName}
                onChange={(e) => setAddForm({...addForm, bankName: e.target.value})}
                placeholder="e.g., Maybank, CIMB Bank"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Number"
                fullWidth
                value={addForm.accountNumber}
                onChange={(e) => setAddForm({...addForm, accountNumber: e.target.value})}
                placeholder="e.g., 1234567890123"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Account Holder Name"
                fullWidth
                value={addForm.accountHolderName}
                onChange={(e) => setAddForm({...addForm, accountHolderName: e.target.value})}
                placeholder="Name as per bank account"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Payslip Message"
                fullWidth
                multiline
                rows={2}
                value={addForm.payslipMessage}
                onChange={(e) => setAddForm({...addForm, payslipMessage: e.target.value})}
                placeholder="Optional message for payslips"
              />
            </Grid>
            
            {/* Salary Information Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1, color: 'success.main' }}>
                Salary Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Set salary details for auto payslip generation. Either use basic salary OR hourly rate.
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Basic Salary (RM)"
                type="number"
                fullWidth
                value={addForm.basicSalary}
                onChange={(e) => setAddForm({...addForm, basicSalary: e.target.value})}
                placeholder="e.g., 5000"
                helperText="Fixed monthly salary"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Hourly Rate (RM)"
                type="number"
                fullWidth
                value={addForm.hourlyRate}
                onChange={(e) => setAddForm({...addForm, hourlyRate: e.target.value})}
                placeholder="e.g., 25.50"
                helperText="For hourly-based payroll"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allowances (RM)"
                type="number"
                fullWidth
                value={addForm.allowances}
                onChange={(e) => setAddForm({...addForm, allowances: e.target.value})}
                placeholder="e.g., 300"
                helperText="Additional allowances"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime Multiplier"
                type="number"
                fullWidth
                value={addForm.overtimeMultiplier}
                onChange={(e) => setAddForm({...addForm, overtimeMultiplier: e.target.value})}
                placeholder="e.g., 1.5"
                helperText="Overtime rate multiplier"
                inputProps={{ min: 1, step: 0.1 }}
              />
            </Grid>
          </Grid>
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Note: The employee will be able to log in immediately with the provided email and password.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddDialog(false);
            resetAddForm();
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleAddEmployee}
            disabled={addLoading}
            startIcon={addLoading ? <CircularProgress size={20} /> : <PersonAdd />}
          >
            {addLoading ? 'Adding...' : 'Add Employee'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Employees;