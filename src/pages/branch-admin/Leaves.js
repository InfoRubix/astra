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
  CircularProgress,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  MoreVert,
  CheckCircle,
  Cancel,
  Schedule,
  EventAvailable,
  EventBusy,
  Person,
  CalendarToday,
  Download,
  Visibility,
  Settings,
  Edit,
  People,
  Warning,
  Add,
  ExpandMore,
  FilterList,
  SelectAll,
  Business,
  ArrowForward,
  ArrowBack
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isSameDay, addDays, startOfDay } from 'date-fns';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { initializeLeaveTypes, loadLeaveTypes, getDefaultQuotaConfig } from '../../utils/leaveTypesMigration';
import { pdfService } from '../../services/pdfService';

function BranchAdminLeaves() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leaveQuotas, setLeaveQuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [actionDialog, setActionDialog] = useState(false);
  const [quotaDialog, setQuotaDialog] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [quotaForm, setQuotaForm] = useState({});
  const [bulkQuotaDialog, setBulkQuotaDialog] = useState(false);
  const [bulkQuotaForm, setBulkQuotaForm] = useState({});
  const [bulkQuotaLoading, setBulkQuotaLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [leaveTypeDialog, setLeaveTypeDialog] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState(null);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    label: '',
    defaultQuota: 0,
    color: 'primary',
    description: '',
    isActive: true
  });
  const [leaveTypeLoading, setLeaveTypeLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarPopup, setCalendarPopup] = useState({ open: false, data: null, anchorPosition: null });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const leavesPerPage = 4;
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false);

  // Fetch Malaysia Public Holidays dynamically for current year
  const getDefaultMalaysianHolidays = async () => {
    try {
      const { holidayService } = await import('../../services/holidayService');
      const year = new Date().getFullYear();
      const result = await holidayService.getMalaysiaHolidays(year);
      if (result.success && result.data.length > 0) {
        return result.data.map(h => ({
          date: h.date instanceof Date ? h.date.toISOString().split('T')[0] : h.date,
          name: h.name || h.localName,
          type: h.global ? 'National' : 'State'
        }));
      }
    } catch (err) {
      console.warn('Holiday API failed:', err);
    }
    return [];
  };

  // Get user's branch
  const getUserBranch = () => {
    // Use branchName as primary field since that's what the system uses
    return user.branchName || user.branch || user.branchId || 'Main Branch';
  };

  // Get user's company (following company-admin pattern)
  const getUserCompany = () => {
    return user.originalCompanyName || user.company || '';
  };

  useEffect(() => {
    if (user) {
      console.log('🔍 Branch Admin Leaves useEffect - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        companyName: user.companyName,
        branch: user.branch,
        branchName: user.branchName,
        branchId: user.branchId,
        fullUserObject: user
      });
      console.log('🔍 Using company:', getUserCompany(), 'and branch:', getUserBranch());
      loadLeaves();
      loadEmployees();
      loadLeaveQuotas();
      initializeAndLoadLeaveTypes();
    } else {
      console.log('🔍 Branch Admin Leaves useEffect - No user yet');
    }
  }, [user]);

  const loadLeaves = async () => {
    if (!user) {
      console.log('No user available for loading leaves');
      return;
    }
    
    setLoading(true);
    try {
      const userCompany = getUserCompany();
      const userBranch = getUserBranch();
      console.log('🔍 Branch Admin loading leaves for company:', userCompany, 'branch:', userBranch);
      
      // Load leaves filtered by company (following company-admin pattern)
      const q = query(
        collection(db, 'leaves'),
        where('originalCompanyName', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      const allLeaves = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('🔍 All company leaves loaded:', allLeaves.length);
      console.log('🔍 User branch:', userBranch);
      console.log('🔍 Sample leave data structure:', allLeaves[0]);
      
      // Filter leaves for this specific branch
      const branchLeaves = allLeaves.filter(leave => {
        console.log('🔍 Checking leave:', {
          leaveId: leave.id,
          userName: leave.userName,
          leaveBranchName: leave.branchName,
          leaveBranch: leave.branch,
          userBranch: userBranch,
          matches: leave.branchName === userBranch
        });
        // Filter by branchName (primary field for branches)
        return leave.branchName === userBranch;
      });
      
      console.log('🔍 Filtered branch leaves:', branchLeaves.length);
      console.log('🔍 Sample filtered leave data:', branchLeaves[0]);
      
      // Sort by appliedDate (most recent first)
      branchLeaves.sort((a, b) => {
        const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
        const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
        return bDate - aDate;
      });
      
      setLeaves(branchLeaves);
      console.log('🔍 Branch leaves set for branch admin view');
    } catch (error) {
      console.error('Error loading leaves:', error);
      setError('Failed to load leave applications: ' + error.message);
    }
    setLoading(false);
  };

  const loadEmployees = async () => {
    try {
      const userCompany = getUserCompany();
      const userBranch = getUserBranch();
      console.log('🔍 Loading employees for company:', userCompany, 'branch:', userBranch);
      
      // Load users from the same company (following company-admin pattern)
      const q = query(
        collection(db, 'users'),
        where('originalCompanyName', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('🔍 All company users loaded:', allUsers.length);
      console.log('🔍 User branch for employee filtering:', userBranch);
      console.log('🔍 Sample employee data structure:', allUsers[0]);
      
      // Filter out admin users and keep only employees from this branch
      const branchEmployees = allUsers.filter(empUser => {
        // Exclude admin roles (following company-admin pattern)
        if (empUser.role === 'admin' || empUser.role === 'companyAdmin') {
          return false;
        }
        
        console.log('🔍 Checking employee:', {
          userId: empUser.id,
          userName: empUser.firstName + ' ' + empUser.lastName,
          empBranchName: empUser.branchName,
          empBranch: empUser.branch,
          userBranch: userBranch,
          matches: empUser.branchName === userBranch
        });
        
        // Filter by branchName for this specific branch
        return empUser.branchName === userBranch;
      });
      
      console.log('🔍 Filtered branch employees:', branchEmployees.length);
      console.log('🔍 Sample filtered employee data:', branchEmployees[0]);
      setEmployees(branchEmployees);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadLeaveQuotas = async () => {
    try {
      const userCompany = getUserCompany();
      const userBranch = getUserBranch();
      
      // Load quotas for the company (following company-admin pattern)
      const q = query(
        collection(db, 'leaveQuotas'),
        where('company', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      const allQuotas = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('🔍 All company quotas loaded:', allQuotas.length);
      
      // Filter quotas for this specific branch
      const branchQuotas = allQuotas.filter(quota => {
        return quota.branchName === userBranch;
      });
      
      console.log('🔍 Filtered branch quotas:', branchQuotas.length);
      setLeaveQuotas(branchQuotas);
    } catch (error) {
      console.error('Error loading leave quotas:', error);
    }
  };

  // Load custom holidays from Firestore
  const loadCustomHolidays = async () => {
    try {
      const customHolidaysQuery = query(collection(db, 'customHolidays'));
      const customHolidaysSnapshot = await getDocs(customHolidaysQuery);
      return customHolidaysSnapshot.docs.map(doc => ({
        id: doc.id,
        date: format(doc.data().date.toDate(), 'yyyy-MM-dd'),
        name: doc.data().name,
        type: doc.data().type || 'Admin Added',
        addedBy: doc.data().addedBy
      }));
    } catch (error) {
      console.error('Error loading custom holidays:', error);
      return [];
    }
  };

  // Load all holidays (default + custom)
  const loadAllHolidays = async () => {
    setHolidaysLoading(true);
    try {
      const defaultHolidays = await getDefaultMalaysianHolidays();
      const customHolidays = await loadCustomHolidays();
      
      console.log('🎄 Default holidays:', defaultHolidays.length);
      console.log('🎄 Custom holidays:', customHolidays.length, customHolidays);
      
      // Combine and remove duplicates by date
      const allHolidays = [...customHolidays, ...defaultHolidays];
      const uniqueHolidays = allHolidays.reduce((acc, holiday) => {
        const existing = acc.find(h => h.date === holiday.date);
        if (!existing) {
          acc.push(holiday);
        } else if (holiday.type === 'Admin Added') {
          // Prioritize admin-added holidays over default ones
          const index = acc.findIndex(h => h.date === holiday.date);
          acc[index] = holiday;
        }
        return acc;
      }, []);
      
      // Sort by date
      uniqueHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      console.log('🎄 Total unique holidays:', uniqueHolidays.length);
      console.log('🎄 Admin added holidays in final list:', uniqueHolidays.filter(h => h.type === 'Admin Added'));
      
      setPublicHolidays(uniqueHolidays);
      setSuccess(`Holidays loaded: ${uniqueHolidays.length} total (${customHolidays.length} admin-added)`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error loading holidays:', error);
      setError('Failed to load holidays: ' + error.message);
      // Fallback to default holidays
      getDefaultMalaysianHolidays().then(h => setPublicHolidays(h));
    }
    setHolidaysLoading(false);
  };

  const initializeAndLoadLeaveTypes = async () => {
    setMigrationLoading(true);
    try {
      // Initialize leave types if they don't exist
      await initializeLeaveTypes();
      
      // Load leave types
      const types = await loadLeaveTypes();
      setLeaveTypes(types);
      
      // Set bulk quota form defaults from leave types
      const defaultConfig = {};
      types.forEach(type => {
        defaultConfig[`${type.name}Leave`] = type.defaultQuota || 0;
      });
      setBulkQuotaForm(defaultConfig);
      
      console.log('Leave types loaded:', types);
    } catch (error) {
      console.error('Error initializing leave types:', error);
      setError('Failed to load leave types: ' + error.message);
    }
    setMigrationLoading(false);
  };

  // Function to update existing leaves with branch information
  const updateLeavesWithBranchInfo = async () => {
    if (!window.confirm('This will update all existing leaves with branch information. This may take a few minutes. Continue?')) {
      return;
    }

    setMigrationLoading(true);
    setError('');
    setSuccess('Updating leaves with branch information...');

    try {
      const userCompany = getUserCompany();
      
      // Get all company leaves
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('originalCompanyName', '==', userCompany)
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      
      // Get all company users to map userId to branchName
      const usersQuery = query(
        collection(db, 'users'),
        where('originalCompanyName', '==', userCompany)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      // Create userId to branchName mapping
      const userBranchMap = {};
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        userBranchMap[userData.uid] = userData.branchName || 'Main Branch';
      });
      
      console.log('User branch mapping:', userBranchMap);
      
      // Update leaves with branch information
      let updatedCount = 0;
      const batch = writeBatch(db);
      
      leavesSnapshot.docs.forEach(doc => {
        const leaveData = doc.data();
        const userBranch = userBranchMap[leaveData.userId];
        
        if (userBranch && !leaveData.branchName) {
          batch.update(doc.ref, { 
            branchName: userBranch,
            updatedAt: serverTimestamp(),
            updatedBy: user.uid 
          });
          updatedCount++;
        }
      });
      
      if (updatedCount > 0) {
        await batch.commit();
        setSuccess(`Successfully updated ${updatedCount} leaves with branch information!`);
      } else {
        setSuccess('All leaves already have branch information.');
      }
      
      // Reload leaves to show updated data
      setTimeout(() => {
        loadLeaves();
        setSuccess('');
      }, 2000);
      
    } catch (error) {
      console.error('Error updating leaves:', error);
      setError('Failed to update leaves: ' + error.message);
    }
    
    setMigrationLoading(false);
  };

  const handleMenuClick = (event, leave) => {
    setAnchorEl(event.currentTarget);
    setSelectedLeave(leave);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedLeave(null);
  };

  const handleAction = (action) => {
    setActionType(action);
    setActionDialog(true);
    // Close the menu but keep selectedLeave for the dialog
    setAnchorEl(null);
  };

  const handleActionSubmit = async () => {
    if (!selectedLeave) {
      console.log('No selected leave');
      return;
    }
    
    console.log('Starting action submit:', { actionType, selectedLeave: selectedLeave.id });
    setActionLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Update Firestore document
      const updateData = {
        status: actionType === 'approve' ? 'approved' : 'rejected',
        [`${actionType === 'approve' ? 'approved' : 'rejected'}By`]: `${user.firstName} ${user.lastName}`,
        [`${actionType === 'approve' ? 'approved' : 'rejected'}ById`]: user.uid,
        [`${actionType === 'approve' ? 'approved' : 'rejected'}Date`]: serverTimestamp(),
        ...(actionType === 'reject' && { rejectionReason: actionReason }),
        ...(actionType === 'approve' && { adminComments: actionReason })
      };

      console.log('Update data:', updateData);
      
      await updateDoc(doc(db, 'leaves', selectedLeave.id), updateData);
      console.log(`Leave ${actionType}d successfully:`, selectedLeave.id);

      // Create notification for the employee
      const adminName = `${user.firstName} ${user.lastName}`;
      const status = actionType === 'approve' ? 'approved' : 'rejected';
      
      // Notification for the employee
      await addDoc(collection(db, 'notifications'), {
        userId: selectedLeave.userId,
        originalCompanyName: getUserCompany(),
        company: getUserCompany(),
        branchName: getUserBranch(),
        branch: getUserBranch(),
        type: 'leave_update',
        title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${getLeaveTypeLabel(selectedLeave.leaveType)} leave request has been ${status} by ${adminName} (Branch Admin)`,
        priority: 'high',
        read: false,
        createdAt: serverTimestamp(),
        relatedData: {
          leaveType: selectedLeave.leaveType,
          startDate: selectedLeave.startDate,
          endDate: selectedLeave.endDate,
          totalDays: selectedLeave.totalDays,
          approvedBy: adminName,
          ...(actionReason && { reason: actionReason })
        }
      });

      console.log('User notification created for leave action');
      
      // Reload leaves to show updated status
      console.log('Reloading leaves...');
      await loadLeaves();
      
      setSuccess(`Leave request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setActionDialog(false);
      setActionReason('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      setSelectedLeave(null);
    } catch (error) {
      console.error('Error updating leave:', error);
      setError(`Failed to ${actionType} leave request: ${error.message}`);
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

  const getLeaveTypeColor = (type) => {
    const leaveType = leaveTypes.find(lt => lt.name === type);
    return leaveType ? leaveType.color : 'default';
  };

  const getLeaveTypeLabel = (type) => {
    const leaveType = leaveTypes.find(lt => lt.name === type);
    return leaveType ? leaveType.label : type;
  };

  const filterLeavesByStatus = (status) => {
    if (status === 'all') return leaves;
    return leaves.filter(leave => leave.status === status);
  };

  const handleEditQuota = (employee) => {
    const existingQuota = leaveQuotas.find(q => q.employeeId === employee.id);
    const formData = {};
    
    // Map from quota field names to form fields for each leave type
    leaveTypes.forEach(leaveType => {
      const quotaField = `${leaveType.name}Leave`;
      if (existingQuota && existingQuota[quotaField] !== undefined) {
        formData[quotaField] = existingQuota[quotaField];
      } else {
        formData[quotaField] = leaveType.defaultQuota;
      }
    });
    
    setQuotaForm(formData);
    setSelectedEmployee(employee);
    setQuotaDialog(true);
  };

  const handleSaveQuota = async () => {
    if (!selectedEmployee) return;

    try {
      const existingQuota = leaveQuotas.find(q => q.employeeId === selectedEmployee.id);
      
      const quotaData = {
        employeeId: selectedEmployee.id,
        employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
        employeeEmail: selectedEmployee.email,
        company: selectedEmployee.company || selectedEmployee.originalCompanyName || getUserCompany(),
        branchName: selectedEmployee.branchName || getUserBranch(),
        branch: selectedEmployee.branch || getUserBranch(),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      };
      
      // Add dynamic leave type quotas
      leaveTypes.forEach(leaveType => {
        const quotaField = `${leaveType.name}Leave`;
        quotaData[quotaField] = parseInt(quotaForm[quotaField] || leaveType.defaultQuota);
      });

      if (existingQuota) {
        await updateDoc(doc(db, 'leaveQuotas', existingQuota.id), quotaData);
        setSuccess('Leave quota updated successfully');
      } else {
        await addDoc(collection(db, 'leaveQuotas'), {
          ...quotaData,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        });
        setSuccess('Leave quota created successfully');
      }

      setQuotaDialog(false);
      setSelectedEmployee(null);
      await loadLeaveQuotas();
    } catch (error) {
      console.error('Error saving leave quota:', error);
      setError('Failed to save leave quota: ' + error.message);
    }
  };

  const getEmployeeQuota = (employeeId) => {
    return leaveQuotas.find(q => q.employeeId === employeeId);
  };

  const handleEmployeeSelection = (employeeId, checked) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeId));
    }
  };

  const handleSelectAllEmployees = (checked) => {
    if (checked) {
      const filteredEmployeeIds = getFilteredEmployees().map(emp => emp.id);
      setSelectedEmployees(prev => [...new Set([...prev, ...filteredEmployeeIds])]);
    } else {
      const filteredEmployeeIds = getFilteredEmployees().map(emp => emp.id);
      setSelectedEmployees(prev => prev.filter(id => !filteredEmployeeIds.includes(id)));
    }
  };

  const getFilteredEmployees = () => {
    switch (employeeFilter) {
      case 'withoutQuotas':
        return employees.filter(emp => !leaveQuotas.find(q => q.employeeId === emp.id));
      case 'withQuotas':
        return employees.filter(emp => leaveQuotas.find(q => q.employeeId === emp.id));
      default:
        return employees;
    }
  };

  const handleFilterChange = (filter) => {
    setEmployeeFilter(filter);
  };

  const handleQuickSelect = (filter) => {
    setEmployeeFilter(filter);
    const filteredEmployees = filter === 'withoutQuotas' 
      ? employees.filter(emp => !leaveQuotas.find(q => q.employeeId === emp.id))
      : filter === 'withQuotas'
      ? employees.filter(emp => leaveQuotas.find(q => q.employeeId === emp.id))
      : employees;
    
    setSelectedEmployees(filteredEmployees.map(emp => emp.id));
  };

  const handleBulkQuotaApply = async () => {
    if (selectedEmployees.length === 0) {
      setError('Please select at least one employee to apply quotas to.');
      return;
    }

    if (!window.confirm(`This will set default quotas for ${selectedEmployees.length} selected employees. Continue?`)) {
      return;
    }

    setBulkQuotaLoading(true);
    setError('');
    
    try {
      // Filter selected employees
      const selectedEmployeesList = employees.filter(emp => 
        selectedEmployees.includes(emp.id)
      );
      
      console.log(`Applying bulk quotas to ${selectedEmployeesList.length} selected employees`);
      
      // Use batch write for better performance
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const employee of selectedEmployeesList) {
        const existingQuota = leaveQuotas.find(q => q.employeeId === employee.id);
        const quotaData = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeEmail: employee.email,
          company: employee.company || employee.originalCompanyName || getUserCompany(),
          branchName: employee.branchName || getUserBranch(),
          branch: employee.branch || getUserBranch(),
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: `${user.firstName} ${user.lastName}`,
          isBulkApplied: true
        };
        
        // Add dynamic leave type quotas
        leaveTypes.forEach(leaveType => {
          const quotaField = `${leaveType.name}Leave`;
          quotaData[quotaField] = parseInt(bulkQuotaForm[quotaField] || leaveType.defaultQuota);
        });
        
        if (existingQuota) {
          // Update existing quota
          const docRef = doc(db, 'leaveQuotas', existingQuota.id);
          batch.update(docRef, quotaData);
        } else {
          // Create new quota
          const docRef = doc(collection(db, 'leaveQuotas'));
          batch.set(docRef, quotaData);
        }
        batchCount++;
        
        // Firestore batch limit is 500, commit if we reach it
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }
      
      setSuccess(`Successfully applied quotas to ${selectedEmployeesList.length} selected employees`);
      setBulkQuotaDialog(false);
      setSelectedEmployees([]);
      
      // Reload quotas
      await loadLeaveQuotas();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (error) {
      console.error('Error applying bulk quotas:', error);
      setError('Failed to apply bulk quotas: ' + error.message);
    }
    
    setBulkQuotaLoading(false);
  };

  const handleResetAllQuotas = async () => {
    if (!window.confirm(`This will reset ALL employee quotas in your branch to the new default values. This action cannot be undone. Continue?`)) {
      return;
    }

    setBulkQuotaLoading(true);
    setError('');
    
    try {
      // Use batch write to update all existing quotas
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const employee of employees) {
        const existingQuota = leaveQuotas.find(q => q.employeeId === employee.id);
        
        const quotaData = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeEmail: employee.email,
          company: employee.company || employee.originalCompanyName || getUserCompany(),
          branchName: employee.branchName || getUserBranch(),
          branch: employee.branch || getUserBranch(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
          updatedByName: `${user.firstName} ${user.lastName}`,
          isBulkReset: true
        };
        
        // Add dynamic leave type quotas
        leaveTypes.forEach(leaveType => {
          const quotaField = `${leaveType.name}Leave`;
          quotaData[quotaField] = parseInt(bulkQuotaForm[quotaField] || leaveType.defaultQuota);
        });
        
        if (existingQuota) {
          // Update existing quota
          const docRef = doc(db, 'leaveQuotas', existingQuota.id);
          batch.update(docRef, quotaData);
        } else {
          // Create new quota
          const docRef = doc(collection(db, 'leaveQuotas'));
          batch.set(docRef, {
            ...quotaData,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            createdByName: `${user.firstName} ${user.lastName}`
          });
        }
        
        batchCount++;
        
        // Firestore batch limit is 500, commit if we reach it
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }
      
      setSuccess(`Successfully reset quotas for all ${employees.length} branch employees`);
      setBulkQuotaDialog(false);
      
      // Reload quotas
      await loadLeaveQuotas();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (error) {
      console.error('Error resetting all quotas:', error);
      setError('Failed to reset quotas: ' + error.message);
    }
    
    setBulkQuotaLoading(false);
  };

  // PDF Export Functions - Updated for branch
  const handleExportLeaves = async () => {
    if (currentLeaves.length === 0) {
      setError('No leave data to export');
      return;
    }

    setPdfLoading(true);
    setError('');

    try {
      const columns = [
        { key: 'userName', header: 'Employee', width: 1.5 },
        { key: 'originalCompanyName', header: 'Company', width: 1.2, formatter: (row) => row.originalCompanyName || row.company || getUserCompany() },
        { key: 'branch', header: 'Branch', width: 1.2, formatter: (row) => row.branch || getUserBranch() },
        { key: 'department', header: 'Department', width: 1.2 },
        { key: 'leaveType', header: 'Leave Type', width: 1.2, formatter: (row) => getLeaveTypeLabel(row.leaveType) },
        { key: 'startDate', header: 'Start Date', width: 1.2, formatter: (row) => {
          try {
            const date = row.startDate?.toDate ? row.startDate.toDate() : new Date(row.startDate);
            return format(date, 'dd/MM/yyyy');
          } catch {
            return 'Invalid';
          }
        }},
        { key: 'endDate', header: 'End Date', width: 1.2, formatter: (row) => {
          try {
            const date = row.endDate?.toDate ? row.endDate.toDate() : new Date(row.endDate);
            return format(date, 'dd/MM/yyyy');
          } catch {
            return 'Invalid';
          }
        }},
        { key: 'totalDays', header: 'Days', width: 0.8 },
        { key: 'status', header: 'Status', width: 1, formatter: (row) => row.status.charAt(0).toUpperCase() + row.status.slice(1) },
        { key: 'appliedDate', header: 'Applied Date', width: 1.2, formatter: (row) => {
          try {
            const date = row.appliedDate?.toDate ? row.appliedDate.toDate() : new Date(row.appliedDate);
            return format(date, 'dd/MM/yyyy');
          } catch {
            return 'Invalid';
          }
        }},
        { key: 'reason', header: 'Reason', width: 2, formatter: (row) => row.reason?.length > 50 ? row.reason.substring(0, 47) + '...' : row.reason || 'N/A' }
      ];

      const tabData = getTabData();
      const currentTab = tabData[tabValue];
      const statusFilter = currentTab.status === 'all' ? 'All Requests' : currentTab.label;

      const filters = {
        Status: statusFilter,
        Company: getUserCompany(),
        Branch: getUserBranch(),
        'Date Range': `Generated on ${format(new Date(), 'dd/MM/yyyy')}`
      };

      const filename = `${getUserCompany()}_${getUserBranch()}_leave_requests_${currentTab.status}_${format(new Date(), 'yyyy-MM-dd')}`;

      const success = await pdfService.createProfessionalPDF({
        title: `${getUserCompany()} - ${getUserBranch()} Branch Leave Management Report`,
        data: currentLeaves,
        columns,
        filters,
        orientation: 'landscape',
        filename,
        additionalInfo: {
          totalCount: currentLeaves.length,
          generatedBy: `${user.firstName} ${user.lastName}`,
          company: getUserCompany(),
          branch: getUserBranch()
        }
      });

      if (success) {
        setSuccess('Leave report exported successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to export leave report. Please try again.');
      }
    } catch (error) {
      console.error('Error exporting leaves:', error);
      setError('Failed to export leave report: ' + error.message);
    }

    setPdfLoading(false);
  };

  const getTabData = () => [
    { label: 'All Requests', count: leaves.length, status: 'all' },
    { label: 'Pending', count: leaves.filter(l => l.status === 'pending').length, status: 'pending' },
    { label: 'Approved', count: leaves.filter(l => l.status === 'approved').length, status: 'approved' },
    { label: 'Rejected', count: leaves.filter(l => l.status === 'rejected').length, status: 'rejected' },
    { label: 'Leave Calendar', count: leaves.length, status: 'calendar' },
    { label: 'Leave Quotas', count: employees.length, status: 'quotas' }
  ];

  // Calendar Functions
  const handleCalendarDayClick = (day, event) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const holiday = publicHolidays.find(h => h.date === dayStr);
    
    // Get both approved and pending leaves for this day
    const approvedLeaves = leaves.filter(leave => {
      try {
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
        return day >= startDate && day <= endDate && leave.status === 'approved';
      } catch {
        return false;
      }
    });
    
    const pendingLeaves = leaves.filter(leave => {
      try {
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
        return day >= startDate && day <= endDate && leave.status === 'pending';
      } catch {
        return false;
      }
    });
    
    const allDayLeaves = [...approvedLeaves, ...pendingLeaves];

    if (holiday || allDayLeaves.length > 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      setCalendarPopup({
        open: true,
        data: { 
          day, 
          holiday, 
          leaves: allDayLeaves,
          approvedLeaves,
          pendingLeaves
        },
        anchorPosition: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX + rect.width / 2
        }
      });
    }
  };

  const closeCalendarPopup = () => {
    setCalendarPopup({ open: false, data: null, anchorPosition: null });
  };

  const isHoliday = (date) => {
    return publicHolidays.some(holiday => 
      isSameDay(new Date(holiday.date), new Date(date))
    );
  };

  const getHolidayColor = (holiday) => {
    switch (holiday?.type) {
      case 'National': return 'error';
      case 'Admin Added': return 'secondary';
      case 'Company': return 'primary';
      case 'State': return 'warning';
      default: return 'error';
    }
  };

  const currentLeaves = filterLeavesByStatus(getTabData()[tabValue].status);
  
  // Reset pagination when tab changes and reload holidays for calendar tab
  useEffect(() => {
    setCurrentPage(0);
    // Reload holidays when switching to calendar tab
    if (getTabData()[tabValue].status === 'calendar' && user) {
      loadAllHolidays();
    }
  }, [tabValue]);

  // Get paginated data
  const getPaginatedData = () => {
    const startIndex = safePage * leavesPerPage;
    return currentLeaves.slice(startIndex, startIndex + leavesPerPage);
  };

  const totalPages = Math.max(1, Math.ceil(currentLeaves.length / leavesPerPage));

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

  // Get paginated leaves for display
  const paginatedLeaves = getPaginatedData();

  // Summary stats
  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedThisMonth = leaves.filter(l => {
    if (l.status !== 'approved' || !l.approvedDate) return false;
    try {
      const approvedDate = l.approvedDate?.toDate ? l.approvedDate.toDate() : new Date(l.approvedDate);
      return approvedDate.getMonth() === new Date().getMonth();
    } catch (error) {
      return false;
    }
  }).length;
  const totalDaysRequested = leaves.reduce((sum, leave) => sum + leave.totalDays, 0);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'warning.main', 
                mr: 2,
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 15px rgba(237, 108, 2, 0.3)'
              }}
            >
              <EventAvailable sx={{ fontSize: { xs: 24, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #ed6c02, #ff9800)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                Branch Leave Management
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage leave requests for {getUserBranch()} - {getUserCompany()}
              </Typography>
            </Box>
          </Box>
          <Button 
            variant="contained" 
            startIcon={pdfLoading ? <CircularProgress size={20} color="inherit" /> : <Download />}
            onClick={handleExportLeaves}
            disabled={pdfLoading || currentLeaves.length === 0}
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
              },
              '&:disabled': {
                opacity: 0.6
              }
            }}
          >
            {pdfLoading ? 'Generating...' : 'Export Report'}
          </Button>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'warning.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Branch Quota Management */}
      <Paper 
        elevation={0}
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          mb: 4,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 4, background: 'linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: 48,
                height: 48,
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}>
                <Settings />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Branch Quota Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage leave quotas for {getUserBranch()} employees
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              onClick={() => {
                setBulkQuotaDialog(true);
                setEmployeeFilter('withoutQuotas');
                // Pre-select employees without quotas by default
                const employeesWithoutQuotas = employees.filter(emp => 
                  !leaveQuotas.find(q => q.employeeId === emp.id)
                );
                setSelectedEmployees(employeesWithoutQuotas.map(emp => emp.id));
              }}
              startIcon={<Settings />}
              sx={{
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
              Manage Branch Quotas
            </Button>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h6" color="primary.main">
                  {employees.filter(emp => !leaveQuotas.find(q => q.employeeId === emp.id)).length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Without Quotas
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h6" color="success.main">
                  {leaveQuotas.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  With Quotas
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h6" color="warning.main">
                  {bulkQuotaForm.annualLeave || 14}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Annual Days
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h6" color="info.main">
                  {bulkQuotaForm.sickLeave || 14}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sick Days
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

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
                    Pending Approval
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
                  <CalendarToday sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {totalDaysRequested}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Days Requested
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
                  <Person sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {leaves.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Branch Requests
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Leave Requests Table */}
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
                  color: 'warning.main',
                  fontWeight: 700
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: 'warning.main',
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
                {getTabData()[tabValue].status === 'quotas' ? (
                  <>
                    <TableCell>Employee</TableCell>
                    <TableCell>Annual Leave</TableCell>
                    <TableCell>Sick Leave</TableCell>
                    <TableCell>Emergency Leave</TableCell>
                    <TableCell>Maternity Leave</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </>
                ) : getTabData()[tabValue].status === 'calendar' ? (
                  // Calendar view - no table headers needed
                  <>
                  </>
                ) : (
                  <>
                    <TableCell>Employee</TableCell>
                    <TableCell>Leave Type</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Applied Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {getTabData()[tabValue].status === 'calendar' ? (
                // Calendar View Content
                <TableRow>
                  <TableCell colSpan={12} sx={{ p: 0, border: 'none' }}>
                    <Box sx={{ p: 3 }}>
                      {/* Calendar Controls */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        mb: 3,
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: { xs: 2, sm: 0 }
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="h6" sx={{ 
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                            fontWeight: 'bold',
                            color: 'primary.main'
                          }}>
                            {getUserBranch()} Branch Leave Calendar - {format(currentMonth, 'MMMM yyyy')}
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={loadAllHolidays}
                            disabled={holidaysLoading}
                            startIcon={holidaysLoading ? <CircularProgress size={16} /> : null}
                            sx={{ 
                              fontSize: '0.75rem',
                              py: 0.5,
                              px: 1.5,
                              borderRadius: 2
                            }}
                          >
                            Refresh Holidays
                          </Button>
                        </Box>
                        <Box sx={{ 
                          display: 'flex',
                          gap: 1,
                          flexWrap: { xs: 'wrap', sm: 'nowrap' },
                          justifyContent: 'center'
                        }}>
                          <Button 
                            variant="outlined"
                            size="small" 
                            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                            sx={{
                              minWidth: { xs: '70px', sm: '80px' },
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              px: { xs: 1, sm: 2 },
                              py: 0.5,
                              borderRadius: 2,
                              fontWeight: 'medium'
                            }}
                          >
                            ← Prev
                          </Button>
                          <Button 
                            variant="contained"
                            size="small" 
                            onClick={() => setCurrentMonth(new Date())}
                            sx={{
                              minWidth: { xs: '60px', sm: '70px' },
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              px: { xs: 1, sm: 2 },
                              py: 0.5,
                              borderRadius: 2,
                              fontWeight: 'bold'
                            }}
                          >
                            Today
                          </Button>
                          <Button 
                            variant="outlined"
                            size="small" 
                            onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                            sx={{
                              minWidth: { xs: '70px', sm: '80px' },
                              fontSize: { xs: '0.75rem', sm: '0.875rem' },
                              px: { xs: 1, sm: 2 },
                              py: 0.5,
                              borderRadius: 2,
                              fontWeight: 'medium'
                            }}
                          >
                            Next →
                          </Button>
                        </Box>
                      </Box>
                      
                      {/* Calendar Grid - Similar to company admin but for branch */}
                      <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <TableCell key={day} align="center" sx={{ 
                                  fontWeight: 'bold', 
                                  py: { xs: 0.5, sm: 1 },
                                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                  backgroundColor: 'grey.50',
                                  borderBottom: '2px solid',
                                  borderColor: 'primary.main'
                                }}>
                                  {day}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              const monthStart = startOfMonth(currentMonth);
                              const monthEnd = endOfMonth(currentMonth);
                              const startDate = new Date(monthStart);
                              startDate.setDate(startDate.getDate() - getDay(monthStart));
                              const endDate = new Date(monthEnd);
                              endDate.setDate(endDate.getDate() + (6 - getDay(monthEnd)));
                              
                              const days = eachDayOfInterval({ start: startDate, end: endDate });
                              const weeks = [];
                              
                              for (let i = 0; i < days.length; i += 7) {
                                weeks.push(days.slice(i, i + 7));
                              }
                              
                              return weeks.map((week, weekIndex) => (
                                <TableRow key={weekIndex}>
                                  {week.map(day => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                                    const isHoliday = publicHolidays.some(h => h.date === dayStr);
                                    const dayLeaves = leaves.filter(leave => {
                                      try {
                                        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                                        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                                        return day >= startDate && day <= endDate && leave.status === 'approved';
                                      } catch {
                                        return false;
                                      }
                                    });
                                    
                                    const pendingLeaves = leaves.filter(leave => {
                                      try {
                                        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                                        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                                        return day >= startDate && day <= endDate && leave.status === 'pending';
                                      } catch {
                                        return false;
                                      }
                                    });
                                    
                                    return (
                                      <TableCell 
                                        key={day.toString()} 
                                        align="center" 
                                        onClick={(e) => handleCalendarDayClick(day, e)}
                                        sx={{ 
                                          height: { xs: 50, sm: 60 },
                                          verticalAlign: 'top',
                                          bgcolor: !isCurrentMonth ? 'grey.100' : 
                                                   isToday(day) ? 'primary.50' : 
                                                   (day.getDay() === 0 || day.getDay() === 6) ? 'grey.50' : 'white',
                                          border: isToday(day) ? '2px solid' : '1px solid',
                                          borderColor: isToday(day) ? 'primary.main' : 'divider',
                                          cursor: (isHoliday || dayLeaves.length > 0 || pendingLeaves.length > 0) ? 'pointer' : 'default',
                                          p: { xs: 0.3, sm: 0.5 },
                                          '&:hover': {
                                            bgcolor: !isCurrentMonth ? 'grey.100' : 'grey.50'
                                          }
                                        }}
                                      >
                                        <Box sx={{ p: { xs: 0.2, sm: 0.3 }, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Typography 
                                              variant="body2" 
                                              sx={{ 
                                                color: !isCurrentMonth ? 'text.disabled' : 
                                                       (day.getDay() === 0 || day.getDay() === 6) ? 'error.main' : 'text.primary',
                                                fontWeight: isToday(day) ? 'bold' : (day.getDay() === 0 || day.getDay() === 6) ? 'bold' : 'normal',
                                                fontSize: { xs: '0.7rem', sm: '0.8rem' }
                                              }}
                                            >
                                              {format(day, 'd')}
                                            </Typography>
                                            {(day.getDay() === 0 || day.getDay() === 6) && (
                                              <Typography variant="caption" sx={{ 
                                                fontSize: { xs: '0.5rem', sm: '0.55rem' },
                                                color: 'error.main',
                                                fontWeight: 'bold'
                                              }}>
                                                {day.getDay() === 0 ? 'SUN' : 'SAT'}
                                              </Typography>
                                            )}
                                          </Box>
                                          <Box sx={{ display: 'flex', gap: { xs: 0.2, sm: 0.25 }, flexWrap: 'wrap', justifyContent: 'center', mt: 0.2 }}>
                                            {isHoliday && (() => {
                                              const holiday = publicHolidays.find(h => h.date === dayStr);
                                              return (
                                                <Chip 
                                                  label="H" 
                                                  size="small" 
                                                  color={getHolidayColor(holiday)}
                                                  sx={{ 
                                                    height: { xs: 12, sm: 14 }, 
                                                    fontSize: { xs: '0.45rem', sm: '0.5rem' },
                                                    minWidth: { xs: 18, sm: 20 },
                                                    '& .MuiChip-label': {
                                                      px: { xs: 0.2, sm: 0.3 }
                                                    }
                                                  }}
                                                />
                                              );
                                            })()}
                                            {(dayLeaves.length > 0 || pendingLeaves.length > 0) && (
                                              <Chip 
                                                label="L"
                                                size="small" 
                                                color={dayLeaves.length > 0 ? 'success' : 'warning'}
                                                sx={{ 
                                                  height: { xs: 12, sm: 14 }, 
                                                  fontSize: { xs: '0.45rem', sm: '0.5rem' },
                                                  minWidth: { xs: 18, sm: 20 },
                                                  '& .MuiChip-label': {
                                                    px: { xs: 0.2, sm: 0.3 }
                                                  }
                                                }}
                                              />
                                            )}
                                          </Box>
                                        </Box>
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ));
                            })()
                            }
                          </TableBody>
                        </Table>
                      </Paper>
                      
                      {/* Enhanced Legend */}
                      <Box sx={{ 
                        display: 'flex', 
                        gap: { xs: 0.8, sm: 1.5 }, 
                        mt: 2, 
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        p: { xs: 1.5, sm: 2 },
                        backgroundColor: 'grey.50',
                        borderRadius: 2
                      }}>
                        <Chip label="Today" color="primary" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="Weekend" color="error" variant="outlined" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="National Holiday (H)" color="error" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="Admin Added (H)" color="secondary" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="State Holiday (H)" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="Approved (L)" color="success" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                        <Chip label="Pending (L)" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
                      </Box>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : getTabData()[tabValue].status === 'quotas' ? (
                employees.map((employee) => {
                  const quota = getEmployeeQuota(employee.id);
                  return (
                    <TableRow key={employee.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                            {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2">
                              {employee.firstName} {employee.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {employee.department || 'General'} • {employee.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {quota?.annualLeave || 14} days
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {quota?.sickLeave || 14} days
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {quota?.emergencyLeave || 3} days
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {quota?.maternityLeave || 60} days
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={employee.branch || getUserBranch()}
                          color="secondary"
                          variant="outlined"
                          size="small"
                        />
                      </TableCell>
                      
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => handleEditQuota(employee)}
                        >
                          Edit Quota
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                paginatedLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <Avatar sx={{ fontSize: 64, bgcolor: 'grey.200', width: 80, height: 80, mb: 2 }}>
                          📝
                        </Avatar>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          {getTabData()[tabValue].status === 'pending' ? 'No pending requests' : 
                           getTabData()[tabValue].status === 'approved' ? 'No approved requests yet' :
                           getTabData()[tabValue].status === 'rejected' ? 'No rejected requests' :
                           'No leave requests yet'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {getTabData()[tabValue].status === 'pending' ? `New leave requests from ${getUserBranch()} employees will appear here for your review` : 
                           getTabData()[tabValue].status === 'approved' ? 'Approved leave requests will be shown here' :
                           getTabData()[tabValue].status === 'rejected' ? 'Rejected leave requests will be displayed here' :
                           `Leave requests from ${getUserBranch()} employees will appear here once submitted`}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLeaves.map((leave) => (
                  <TableRow key={leave.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          {leave.avatar || (leave.userName ? leave.userName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U')}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {leave.userName || 'Unknown User'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {leave.department || 'General'} • {leave.userEmail || 'No email'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={getLeaveTypeLabel(leave.leaveType)}
                        color={getLeaveTypeColor(leave.leaveType)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {format(leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate), 'MMM dd')} - {format(leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate), 'MMM dd, yyyy')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200 }}>
                        {leave.reason?.length > 50 ? leave.reason.substring(0, 47) + '...' : leave.reason || 'No reason provided'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {format(leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate), 'MMM dd, yyyy')}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        icon={getStatusIcon(leave.status)}
                        label={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        color={getStatusColor(leave.status)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      {leave.status === 'pending' ? (
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleMenuClick(e, leave)}
                          sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <MoreVert />
                        </IconButton>
                      ) : (
                        <Button 
                          size="small" 
                          variant="outlined"
                          startIcon={<Visibility />}
                          onClick={() => {
                            setSelectedLeave(leave);
                            setViewDetailsDialog(true);
                          }}
                        >
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
                )
              )}
            </TableBody>
            </Table>
          </TableContainer>
        </Box>
        
        {/* Mobile Card View */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {getTabData()[tabValue].status !== 'calendar' && getTabData()[tabValue].status !== 'quotas' && (
            <Box sx={{ p: 2 }}>
              {paginatedLeaves.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Avatar sx={{ fontSize: 48, bgcolor: 'grey.200', width: 64, height: 64, mb: 2, mx: 'auto' }}>
                    📝
                  </Avatar>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {getTabData()[tabValue].status === 'pending' ? 'No pending requests' : 
                     getTabData()[tabValue].status === 'approved' ? 'No approved requests yet' :
                     getTabData()[tabValue].status === 'rejected' ? 'No rejected requests' :
                     'No leave requests yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Leave requests from {getUserBranch()} employees will appear here
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {paginatedLeaves.map((leave) => (
                    <Card key={leave.id} sx={{ border: 1, borderColor: 'divider' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                            {leave.avatar || (leave.userName ? leave.userName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U')}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2">
                              {leave.userName || 'Unknown User'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {leave.department || 'General'}
                            </Typography>
                          </Box>
                          <Chip 
                            icon={getStatusIcon(leave.status)}
                            label={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                            color={getStatusColor(leave.status)}
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Leave Type:</strong> {getLeaveTypeLabel(leave.leaveType)}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Duration:</strong> {format(leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate), 'MMM dd')} - {format(leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate), 'MMM dd, yyyy')} ({leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'})
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Applied:</strong> {format(leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate), 'MMM dd, yyyy')}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Reason:</strong> {leave.reason || 'No reason provided'}
                          </Typography>
                        </Box>
                        
                        {leave.status === 'pending' && (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              color="error"
                              onClick={() => {
                                setSelectedLeave(leave);
                                handleAction('reject');
                              }}
                            >
                              Reject
                            </Button>
                            <Button 
                              size="small" 
                              variant="contained"
                              color="success"
                              onClick={() => {
                                setSelectedLeave(leave);
                                handleAction('approve');
                              }}
                            >
                              Approve
                            </Button>
                          </Box>
                        )}
                        
                        {leave.status !== 'pending' && (
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                              size="small" 
                              variant="outlined"
                              startIcon={<Visibility />}
                              onClick={() => {
                                setSelectedLeave(leave);
                                setViewDetailsDialog(true);
                              }}
                            >
                              View Details
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
        
        {/* Pagination */}
        {getTabData()[tabValue].status !== 'calendar' && getTabData()[tabValue].status !== 'quotas' && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={handlePrevPage}
              disabled={safePage === 0}
              startIcon={<ArrowBack />}
              sx={{ mr: 2 }}
            >
              Previous
            </Button>
            <Typography variant="body2" sx={{ mx: 2 }}>
              Page {safePage + 1} of {totalPages}
            </Typography>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={handleNextPage}
              disabled={safePage >= totalPages - 1}
              endIcon={<ArrowForward />}
              sx={{ ml: 2 }}
            >
              Next
            </Button>
          </Box>
        )}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleAction('approve')} sx={{ color: 'success.main' }}>
          <CheckCircle sx={{ mr: 1 }} />
          Approve
        </MenuItem>
        <MenuItem onClick={() => handleAction('reject')} sx={{ color: 'error.main' }}>
          <Cancel sx={{ mr: 1 }} />
          Reject
        </MenuItem>
      </Menu>

      {/* Action Dialog */}
      <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionType === 'approve' ? 'Approve' : 'Reject'} Leave Request
        </DialogTitle>
        <DialogContent>
          {selectedLeave && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Employee:</strong> {selectedLeave.userName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Leave Type:</strong> {getLeaveTypeLabel(selectedLeave.leaveType)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                <strong>Duration:</strong> {format(selectedLeave.startDate?.toDate ? selectedLeave.startDate.toDate() : new Date(selectedLeave.startDate), 'MMM dd')} - {format(selectedLeave.endDate?.toDate ? selectedLeave.endDate.toDate() : new Date(selectedLeave.endDate), 'MMM dd, yyyy')} ({selectedLeave.totalDays} days)
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            rows={3}
            label={actionType === 'approve' ? 'Admin Comments (Optional)' : 'Rejection Reason'}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder={actionType === 'approve' ? 'Add any comments for the employee...' : 'Please provide a reason for rejecting this request...'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleActionSubmit} 
            variant="contained" 
            color={actionType === 'approve' ? 'success' : 'error'}
            disabled={actionLoading}
          >
            {actionLoading && <CircularProgress size={20} sx={{ mr: 1 }} />}
            {actionType === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quota Dialog */}
      <Dialog open={quotaDialog} onClose={() => setQuotaDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit Leave Quota - {selectedEmployee?.firstName} {selectedEmployee?.lastName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {leaveTypes.map((leaveType) => {
              const quotaField = `${leaveType.name}Leave`;
              return (
                <TextField
                  key={leaveType.id}
                  fullWidth
                  type="number"
                  label={`${leaveType.label} (days)`}
                  value={quotaForm[quotaField] || ''}
                  onChange={(e) => setQuotaForm(prev => ({
                    ...prev,
                    [quotaField]: e.target.value
                  }))}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0 }}
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuotaDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveQuota} variant="contained">
            Save Quota
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Quota Dialog */}
      <Dialog open={bulkQuotaDialog} onClose={() => setBulkQuotaDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Bulk Quota Management - {getUserBranch()} Branch
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {/* Employee Selection */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Select Employees</Typography>
              
              {/* Filter and Quick Select */}
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant={employeeFilter === 'all' ? 'contained' : 'outlined'}
                  onClick={() => handleFilterChange('all')}
                >
                  All ({employees.length})
                </Button>
                <Button
                  size="small"
                  variant={employeeFilter === 'withoutQuotas' ? 'contained' : 'outlined'}
                  onClick={() => handleFilterChange('withoutQuotas')}
                >
                  Without Quotas ({employees.filter(emp => !leaveQuotas.find(q => q.employeeId === emp.id)).length})
                </Button>
                <Button
                  size="small"
                  variant={employeeFilter === 'withQuotas' ? 'contained' : 'outlined'}
                  onClick={() => handleFilterChange('withQuotas')}
                >
                  With Quotas ({leaveQuotas.length})
                </Button>
                <Divider orientation="vertical" flexItem />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SelectAll />}
                  onClick={() => handleQuickSelect(employeeFilter)}
                >
                  Select All Filtered
                </Button>
              </Box>
              
              {/* Employee List */}
              <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1 }}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={getFilteredEmployees().length > 0 && getFilteredEmployees().every(emp => selectedEmployees.includes(emp.id))}
                        indeterminate={getFilteredEmployees().some(emp => selectedEmployees.includes(emp.id)) && !getFilteredEmployees().every(emp => selectedEmployees.includes(emp.id))}
                        onChange={(e) => handleSelectAllEmployees(e.target.checked)}
                      />
                    }
                    label={`Select All (${getFilteredEmployees().length} employees)`}
                    sx={{ fontWeight: 'bold', borderBottom: 1, borderColor: 'divider', pb: 1, mb: 1 }}
                  />
                  {getFilteredEmployees().map((employee) => (
                    <FormControlLabel
                      key={employee.id}
                      control={
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => handleEmployeeSelection(employee.id, e.target.checked)}
                        />
                      }
                      label={`${employee.firstName} ${employee.lastName} - ${employee.department || 'General'}`}
                    />
                  ))}
                </FormGroup>
              </Paper>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {selectedEmployees.length} employees selected
              </Typography>
            </Box>
            
            {/* Default Quota Settings */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Default Quota Settings</Typography>
              <Grid container spacing={2}>
                {leaveTypes.map((leaveType) => {
                  const quotaField = `${leaveType.name}Leave`;
                  return (
                    <Grid item xs={12} sm={6} key={leaveType.id}>
                      <TextField
                        fullWidth
                        type="number"
                        label={`${leaveType.label} (days)`}
                        value={bulkQuotaForm[quotaField] || ''}
                        onChange={(e) => setBulkQuotaForm(prev => ({
                          ...prev,
                          [quotaField]: e.target.value
                        }))}
                        inputProps={{ min: 0 }}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkQuotaDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleResetAllQuotas} 
            color="warning" 
            disabled={bulkQuotaLoading}
            startIcon={bulkQuotaLoading ? <CircularProgress size={20} /> : <Warning />}
          >
            Reset All Branch Quotas
          </Button>
          <Button 
            onClick={handleBulkQuotaApply} 
            variant="contained" 
            disabled={bulkQuotaLoading || selectedEmployees.length === 0}
            startIcon={bulkQuotaLoading ? <CircularProgress size={20} /> : null}
          >
            Apply to Selected ({selectedEmployees.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsDialog} onClose={() => setViewDetailsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Leave Request Details
        </DialogTitle>
        <DialogContent>
          {selectedLeave && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Employee</Typography>
                  <Typography variant="body1">{selectedLeave.userName}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Leave Type</Typography>
                  <Typography variant="body1">{getLeaveTypeLabel(selectedLeave.leaveType)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip 
                    icon={getStatusIcon(selectedLeave.status)}
                    label={selectedLeave.status.charAt(0).toUpperCase() + selectedLeave.status.slice(1)}
                    color={getStatusColor(selectedLeave.status)}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Start Date</Typography>
                  <Typography variant="body1">
                    {format(selectedLeave.startDate?.toDate ? selectedLeave.startDate.toDate() : new Date(selectedLeave.startDate), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">End Date</Typography>
                  <Typography variant="body1">
                    {format(selectedLeave.endDate?.toDate ? selectedLeave.endDate.toDate() : new Date(selectedLeave.endDate), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total Days</Typography>
                  <Typography variant="body1">{selectedLeave.totalDays} {selectedLeave.totalDays === 1 ? 'day' : 'days'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">Applied Date</Typography>
                  <Typography variant="body1">
                    {format(selectedLeave.appliedDate?.toDate ? selectedLeave.appliedDate.toDate() : new Date(selectedLeave.appliedDate), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Reason</Typography>
                  <Typography variant="body1">{selectedLeave.reason || 'No reason provided'}</Typography>
                </Grid>
                {selectedLeave.status === 'approved' && selectedLeave.approvedBy && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Approved By</Typography>
                      <Typography variant="body1">{selectedLeave.approvedBy}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Approved Date</Typography>
                      <Typography variant="body1">
                        {selectedLeave.approvedDate && format(selectedLeave.approvedDate?.toDate ? selectedLeave.approvedDate.toDate() : new Date(selectedLeave.approvedDate), 'MMMM dd, yyyy')}
                      </Typography>
                    </Grid>
                    {selectedLeave.adminComments && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Admin Comments</Typography>
                        <Typography variant="body1">{selectedLeave.adminComments}</Typography>
                      </Grid>
                    )}
                  </>
                )}
                {selectedLeave.status === 'rejected' && selectedLeave.rejectedBy && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Rejected By</Typography>
                      <Typography variant="body1">{selectedLeave.rejectedBy}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2" color="text.secondary">Rejected Date</Typography>
                      <Typography variant="body1">
                        {selectedLeave.rejectedDate && format(selectedLeave.rejectedDate?.toDate ? selectedLeave.rejectedDate.toDate() : new Date(selectedLeave.rejectedDate), 'MMMM dd, yyyy')}
                      </Typography>
                    </Grid>
                    {selectedLeave.rejectionReason && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">Rejection Reason</Typography>
                        <Typography variant="body1">{selectedLeave.rejectionReason}</Typography>
                      </Grid>
                    )}
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Calendar Popup */}
      {calendarPopup.open && (
        <Dialog
          open={calendarPopup.open}
          onClose={closeCalendarPopup}
          maxWidth="sm"
          fullWidth
          anchorEl={null}
        >
          <DialogTitle>
            {format(calendarPopup.data?.day, 'MMMM dd, yyyy')}
          </DialogTitle>
          <DialogContent>
            {calendarPopup.data?.holiday && (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'error.50', borderRadius: 1, border: 1, borderColor: 'error.main' }}>
                <Typography variant="subtitle2" color="error.main">
                  🎉 {calendarPopup.data.holiday.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {calendarPopup.data.holiday.type} Holiday
                </Typography>
              </Box>
            )}
            
            {calendarPopup.data?.leaves?.length > 0 ? (
              <Box>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Leave Requests ({calendarPopup.data.leaves.length})
                </Typography>
                {calendarPopup.data.leaves.map((leave, index) => (
                  <Box 
                    key={index} 
                    sx={{ 
                      mb: 2, 
                      p: 2, 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1,
                      bgcolor: leave.status === 'approved' ? 'success.50' : 'warning.50'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2">{leave.userName}</Typography>
                      <Chip 
                        label={leave.status}
                        color={leave.status === 'approved' ? 'success' : 'warning'}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {getLeaveTypeLabel(leave.leaveType)} • {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {format(leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate), 'MMM dd')} - {format(leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate), 'MMM dd')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              !calendarPopup.data?.holiday && (
                <Typography variant="body2" color="text.secondary">
                  No leave requests for this day.
                </Typography>
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCalendarPopup}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
}

export default BranchAdminLeaves;