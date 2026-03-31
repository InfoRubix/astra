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

function AdminLeaves() {
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
  const [actionType, setActionType] = useState(''); // 'approve' or 'reject'
  const [actionReason, setActionReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [quotaForm, setQuotaForm] = useState({});
  const [bulkQuotaDialog, setBulkQuotaDialog] = useState(false);
  const [bulkQuotaForm, setBulkQuotaForm] = useState({});
  const [bulkQuotaLoading, setBulkQuotaLoading] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('all'); // 'all', 'withoutQuotas', 'withQuotas'
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

  // Default Malaysia Public Holidays 2025
  const getDefaultMalaysianHolidays = () => [
    { date: '2025-01-01', name: 'New Year\'s Day', type: 'National' },
    { date: '2025-01-29', name: 'Chinese New Year', type: 'National' },
    { date: '2025-01-30', name: 'Chinese New Year (2nd Day)', type: 'National' },
    { date: '2025-03-31', name: 'Hari Raya Puasa', type: 'National' },
    { date: '2025-04-01', name: 'Hari Raya Puasa (2nd Day)', type: 'National' },
    { date: '2025-05-01', name: 'Labour Day', type: 'National' },
    { date: '2025-05-12', name: 'Wesak Day', type: 'National' },
    { date: '2025-06-06', name: 'Yang di-Pertuan Agong\'s Birthday', type: 'National' },
    { date: '2025-06-07', name: 'Hari Raya Haji', type: 'National' },
    { date: '2025-08-31', name: 'Merdeka Day', type: 'National' },
    { date: '2025-09-16', name: 'Malaysia Day', type: 'National' },
    { date: '2025-10-20', name: 'Deepavali', type: 'National' },
    { date: '2025-12-25', name: 'Christmas Day', type: 'National' },
    // State holidays (commonly observed)
    { date: '2025-02-01', name: 'Federal Territory Day', type: 'State' },
    { date: '2025-03-11', name: 'Sultan of Selangor\'s Birthday', type: 'State' },
    { date: '2025-07-07', name: 'George Town World Heritage City Day', type: 'State' },
    { date: '2025-10-24', name: 'Sultan of Pahang\'s Birthday', type: 'State' }
  ];

  // Get user's company (supporting legacy fields during transition)
  const getUserCompany = () => {
    return user.originalCompanyName || user.company || 'RUBIX';
  };

  useEffect(() => {
    if (user) {
      console.log('🔍 Admin Leaves useEffect - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        fullUserObject: user
      });
      loadLeaves();
      loadEmployees();
      loadLeaveQuotas();
      initializeAndLoadLeaveTypes();
    } else {
      console.log('🔍 Admin Leaves useEffect - No user yet');
    }
  }, [user]);

  const loadLeaves = async () => {
    if (!user) {
      console.log('No user available for loading leaves');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔍 Admin loading ALL leaves (no company filtering)');
      
      // Load ALL leaves from Firestore - admin sees all companies
      const q = query(collection(db, 'leaves'));
      
      const querySnapshot = await getDocs(q);
      const allLeaves = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('🔍 Total leaves loaded:', allLeaves.length);
      
      // Show breakdown by company
      const companySummary = {};
      allLeaves.forEach(leave => {
        const company = leave.originalCompanyName || leave.company || 'Unknown';
        companySummary[company] = (companySummary[company] || 0) + 1;
      });
      console.log('🔍 Leaves by company:', companySummary);
      
      // Sort by appliedDate (most recent first)
      allLeaves.sort((a, b) => {
        const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
        const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
        return bDate - aDate;
      });
      
      setLeaves(allLeaves);
      console.log('🔍 All leaves set for admin view');
    } catch (error) {
      console.error('Error loading leaves:', error);
      setError('Failed to load leave applications: ' + error.message);
    }
    setLoading(false);
  };

  const loadEmployees = async () => {
    try {
      // Load all users and filter out admins (employees have role 'user')
      const q = query(collection(db, 'users'));
      
      const querySnapshot = await getDocs(q);
      const allUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter out admin users, keep only employees (role !== 'admin')
      const employeesList = allUsers.filter(user => user.role !== 'admin');
      
      console.log('Loaded employees for leave quotas:', employeesList.length);
      setEmployees(employeesList);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadLeaveQuotas = async () => {
    try {
      const q = query(collection(db, 'leaveQuotas'));
      const querySnapshot = await getDocs(q);
      const quotasList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setLeaveQuotas(quotasList);
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
      const defaultHolidays = getDefaultMalaysianHolidays();
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
      setPublicHolidays(getDefaultMalaysianHolidays());
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

      // Create notifications for user and admin
      const adminName = `${user.firstName} ${user.lastName}`;
      const status = actionType === 'approve' ? 'approved' : 'rejected';
      
      // Notification for the employee
      await addDoc(collection(db, 'notifications'), {
        userId: selectedLeave.userId,
        originalCompanyName: getUserCompany(),
        type: 'leave_update',
        title: `Leave ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${getLeaveTypeLabel(selectedLeave.leaveType)} leave request has been ${status} by ${adminName}`,
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

      // Skip admin action notifications - only keep user notifications
      console.log('User notification created for leave action, skipping admin notification');
      
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
        company: selectedEmployee.company || selectedEmployee.originalCompanyName || 'RUBIX',
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

  // Calculate employee leave balance (remaining days)
  const getEmployeeLeaveBalance = (employeeId, leaveType) => {
    // Get employee's quota
    const quota = getEmployeeQuota(employeeId);
    if (!quota) {
      // Return default quotas if no custom quota set
      const defaults = {
        annual: 14,
        sick: 14,
        emergency: 3,
        maternity: 90
      };
      const totalQuota = defaults[leaveType] || 0;

      // Calculate approved leaves for this year
      const currentYear = new Date().getFullYear();
      const approvedLeaves = leaves.filter(leave => {
        if (leave.userId !== employeeId) return false;
        if (leave.leaveType !== leaveType) return false;
        if (leave.status !== 'approved') return false;

        const leaveDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        return leaveDate.getFullYear() === currentYear;
      });

      const usedDays = approvedLeaves.reduce((sum, leave) => sum + (leave.totalDays || 0), 0);
      return { total: totalQuota, used: usedDays, remaining: totalQuota - usedDays };
    }

    // Get total quota from employee's custom quota
    const leaveTypeKey = `${leaveType}Leave`;
    const totalQuota = quota[leaveTypeKey] || 0;

    // Calculate approved leaves for this year
    const currentYear = new Date().getFullYear();
    const approvedLeaves = leaves.filter(leave => {
      if (leave.userId !== employeeId) return false;
      if (leave.leaveType !== leaveType) return false;
      if (leave.status !== 'approved') return false;

      const leaveDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
      return leaveDate.getFullYear() === currentYear;
    });

    const usedDays = approvedLeaves.reduce((sum, leave) => sum + (leave.totalDays || 0), 0);
    return { total: totalQuota, used: usedDays, remaining: totalQuota - usedDays };
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
          company: employee.company || employee.originalCompanyName || 'RUBIX',
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
    if (!window.confirm(`This will reset ALL employee quotas to the new default values. This action cannot be undone. Continue?`)) {
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
          company: employee.company || employee.originalCompanyName || 'RUBIX',
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
      
      setSuccess(`Successfully reset quotas for all ${employees.length} employees`);
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

  const handleAddLeaveType = () => {
    setLeaveTypeForm({
      name: '',
      label: '',
      defaultQuota: 0,
      color: 'primary',
      description: '',
      isActive: true
    });
    setSelectedLeaveType(null);
    setLeaveTypeDialog(true);
  };

  const handleEditLeaveType = (leaveType) => {
    setLeaveTypeForm({
      name: leaveType.name,
      label: leaveType.label,
      defaultQuota: leaveType.defaultQuota,
      color: leaveType.color,
      description: leaveType.description || '',
      isActive: leaveType.isActive
    });
    setSelectedLeaveType(leaveType);
    setLeaveTypeDialog(true);
  };

  const handleSaveLeaveType = async () => {
    if (!leaveTypeForm.name.trim() || !leaveTypeForm.label.trim()) {
      setError('Name and label are required');
      return;
    }

    setLeaveTypeLoading(true);
    setError('');

    try {
      const leaveTypeData = {
        name: leaveTypeForm.name.toLowerCase().replace(/\s+/g, ''),
        label: leaveTypeForm.label.trim(),
        defaultQuota: parseInt(leaveTypeForm.defaultQuota) || 0,
        color: leaveTypeForm.color,
        description: leaveTypeForm.description.trim(),
        isActive: leaveTypeForm.isActive,
        order: selectedLeaveType ? selectedLeaveType.order : (leaveTypes.length + 1),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`
      };

      if (selectedLeaveType) {
        // Update existing leave type
        await updateDoc(doc(db, 'leaveTypes', selectedLeaveType.id), leaveTypeData);
        setSuccess('Leave type updated successfully');
      } else {
        // Create new leave type
        await addDoc(collection(db, 'leaveTypes'), {
          ...leaveTypeData,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByName: `${user.firstName} ${user.lastName}`
        });
        setSuccess('Leave type created successfully');
      }

      setLeaveTypeDialog(false);
      await initializeAndLoadLeaveTypes();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error saving leave type:', error);
      setError('Failed to save leave type: ' + error.message);
    }

    setLeaveTypeLoading(false);
  };

  // PDF Export Functions
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
        { key: 'originalCompanyName', header: 'Company', width: 1.2, formatter: (row) => row.originalCompanyName || row.company || 'RUBIX' },
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
        'Date Range': `Generated on ${format(new Date(), 'dd/MM/yyyy')}`
      };

      const filename = `leave_requests_${currentTab.status}_${format(new Date(), 'yyyy-MM-dd')}`;

      const success = await pdfService.createProfessionalPDF({
        title: 'Leave Management Report',
        data: currentLeaves,
        columns,
        filters,
        orientation: 'landscape',
        filename,
        additionalInfo: {
          totalCount: currentLeaves.length,
          generatedBy: `${user.firstName} ${user.lastName}`,
          company: getUserCompany()
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

  const handleToggleLeaveType = async (leaveType) => {
    try {
      await updateDoc(doc(db, 'leaveTypes', leaveType.id), {
        isActive: !leaveType.isActive,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: `${user.firstName} ${user.lastName}`
      });

      setSuccess(`Leave type ${!leaveType.isActive ? 'activated' : 'deactivated'} successfully`);
      await initializeAndLoadLeaveTypes();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (error) {
      console.error('Error toggling leave type:', error);
      setError('Failed to update leave type: ' + error.message);
    }
  };

  const getTabData = () => [
    { label: 'All Requests', count: leaves.length, status: 'all' },
    { label: 'Pending', count: leaves.filter(l => l.status === 'pending').length, status: 'pending' },
    { label: 'Approved', count: leaves.filter(l => l.status === 'approved').length, status: 'approved' },
    { label: 'Rejected', count: leaves.filter(l => l.status === 'rejected').length, status: 'rejected' },
    { label: 'Leave Calendar', count: leaves.length, status: 'calendar' },
    { label: 'Leave Quotas', count: employees.length, status: 'quotas' },
    { label: 'Leave Types', count: leaveTypes.length, status: 'types' },
    { label: 'Leave Balance', count: employees.length, status: 'balance' }
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
                Leave Management
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Review and manage employee leave requests
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

      {/* Bulk Quota Management */}
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
                  Bulk Quota Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Set default leave quotas for selected employees
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
              Manage Default Quotas
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
                  {bulkQuotaForm.annualLeave}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Annual Days
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
                <Typography variant="h6" color="info.main">
                  {bulkQuotaForm.sickLeave}
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
                    Total Requests
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
        
        {/* Add Leave Type Button for Leave Types Tab */}
        {getTabData()[tabValue].status === 'types' && (
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Button 
              variant="contained" 
              startIcon={<Add />}
              onClick={handleAddLeaveType}
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
              Add New Leave Type
            </Button>
          </Box>
        )}
        
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
                    <TableCell>Company</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </>
                ) : getTabData()[tabValue].status === 'types' ? (
                  <>
                    <TableCell>Leave Type</TableCell>
                    <TableCell>Default Quota</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </>
                ) : getTabData()[tabValue].status === 'balance' ? (
                  <>
                    <TableCell>Employee</TableCell>
                    <TableCell>Annual Leave</TableCell>
                    <TableCell>Sick Leave</TableCell>
                    <TableCell>Emergency Leave</TableCell>
                    <TableCell>Maternity Leave</TableCell>
                    <TableCell>Company</TableCell>
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
                    <TableCell>Actions</TableCell>
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
                            Leave Calendar - {format(currentMonth, 'MMMM yyyy')}
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
                      
                      {/* Calendar Grid */}
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
                      
                      {/* Holiday Statistics */}
                      <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                          Holiday Statistics
                        </Typography>
                        <Grid container spacing={1.5}>
                          <Grid item xs={3} sm={2.4}>
                            <Card variant="outlined" sx={{ 
                              borderRadius: 2,
                              backgroundColor: 'error.50',
                              border: '1px solid rgba(211, 47, 47, 0.2)'
                            }}>
                              <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                                <Typography variant="h6" color="error.main" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 'bold' }}>
                                  {publicHolidays.filter(h => h.type === 'National').length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 'medium' }}>
                                  National
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={3} sm={2.4}>
                            <Card variant="outlined" sx={{ 
                              borderRadius: 2,
                              backgroundColor: 'secondary.50',
                              border: '1px solid rgba(156, 39, 176, 0.2)'
                            }}>
                              <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                                <Typography variant="h6" color="secondary.main" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 'bold' }}>
                                  {publicHolidays.filter(h => h.type === 'Admin Added').length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 'medium' }}>
                                  Admin Added
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={3} sm={2.4}>
                            <Card variant="outlined" sx={{ 
                              borderRadius: 2,
                              backgroundColor: 'warning.50',
                              border: '1px solid rgba(245, 124, 0, 0.2)'
                            }}>
                              <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                                <Typography variant="h6" color="warning.main" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 'bold' }}>
                                  {publicHolidays.filter(h => h.type === 'State').length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 'medium' }}>
                                  State
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={3} sm={2.4}>
                            <Card variant="outlined" sx={{ 
                              borderRadius: 2,
                              backgroundColor: 'primary.50',
                              border: '1px solid rgba(25, 118, 210, 0.2)'
                            }}>
                              <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                                <Typography variant="h6" color="primary.main" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 'bold' }}>
                                  {publicHolidays.filter(h => h.type === 'Company').length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 'medium' }}>
                                  Company
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid item xs={12} sm={2.4}>
                            <Card variant="outlined" sx={{ 
                              borderRadius: 2,
                              backgroundColor: 'success.50',
                              border: '1px solid rgba(46, 125, 50, 0.2)'
                            }}>
                              <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                                <Typography variant="h6" color="success.main" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, fontWeight: 'bold' }}>
                                  {publicHolidays.length}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 'medium' }}>
                                  Total Holidays
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      </Box>

                      {/* Malaysia Holidays List */}
                      <Accordion sx={{ mt: 3 }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                            <EventAvailable sx={{ mr: 1, color: 'error.main' }} />
                            Malaysia Public Holidays 2025 ({publicHolidays.length} holidays)
                          </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ 
                                p: 2, 
                                backgroundColor: 'error.50', 
                                borderRadius: 2, 
                                border: '1px solid rgba(211, 47, 47, 0.2)',
                                mb: 2
                              }}>
                                <Typography variant="subtitle2" color="error.main" gutterBottom sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                                  <EventAvailable sx={{ mr: 1, fontSize: 20 }} />
                                  National Holidays ({publicHolidays.filter(h => h.type === 'National').length})
                                </Typography>
                                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                                  {publicHolidays.filter(h => h.type === 'National').map((holiday, index) => (
                                    <Box key={index} sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      py: 1, 
                                      px: 1.5, 
                                      borderRadius: 1, 
                                      mb: 1, 
                                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                      border: '1px solid rgba(211, 47, 47, 0.1)'
                                    }}>
                                      <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                          {holiday.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {format(new Date(holiday.date), 'EEEE')}
                                        </Typography>
                                      </Box>
                                      <Chip 
                                        label={format(new Date(holiday.date), 'MMM dd')}
                                        color="error" 
                                        size="small"
                                        sx={{ fontWeight: 'bold', minWidth: 65 }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <Box sx={{ 
                                p: 2, 
                                backgroundColor: 'warning.50', 
                                borderRadius: 2, 
                                border: '1px solid rgba(245, 124, 0, 0.2)',
                                mb: 2
                              }}>
                                <Typography variant="subtitle2" color="warning.main" gutterBottom sx={{ fontWeight: 'bold', mb: 2, display: 'flex', alignItems: 'center' }}>
                                  <Business sx={{ mr: 1, fontSize: 20 }} />
                                  State Holidays ({publicHolidays.filter(h => h.type === 'State').length})
                                </Typography>
                                <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                                  {publicHolidays.filter(h => h.type === 'State').map((holiday, index) => (
                                    <Box key={index} sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      py: 1, 
                                      px: 1.5, 
                                      borderRadius: 1, 
                                      mb: 1, 
                                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                      border: '1px solid rgba(245, 124, 0, 0.1)'
                                    }}>
                                      <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                          {holiday.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          {format(new Date(holiday.date), 'EEEE')}
                                        </Typography>
                                      </Box>
                                      <Chip 
                                        label={format(new Date(holiday.date), 'MMM dd')}
                                        color="warning" 
                                        size="small"
                                        sx={{ fontWeight: 'bold', minWidth: 65 }}
                                      />
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
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
                          {quota?.maternityLeave || 90} days
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Chip 
                          label={employee.company || employee.originalCompanyName || 'RUBIX'}
                          color="primary"
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
              ) : getTabData()[tabValue].status === 'types' ? (
                <>
                  {leaveTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <EventBusy sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="h6" color="text.secondary" gutterBottom>
                            No leave types configured
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Add your first leave type to get started
                          </Typography>
                          <Button 
                            variant="contained" 
                            startIcon={<Add />}
                            onClick={handleAddLeaveType}
                          >
                            Add Leave Type
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    leaveTypes.map((leaveType) => (
                      <TableRow key={leaveType.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ 
                              mr: 2, 
                              bgcolor: `${leaveType.color}.main`,
                              width: 40,
                              height: 40
                            }}>
                              {leaveType.label.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2">
                                {leaveType.label}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {leaveType.name}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2">
                            {leaveType.defaultQuota} days
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 200 }}>
                            {leaveType.description || 'No description'}
                          </Typography>
                        </TableCell>
                        
                        <TableCell>
                          <Chip 
                            label={leaveType.isActive ? 'Active' : 'Inactive'}
                            color={leaveType.isActive ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        
                        <TableCell>
                          <Typography variant="body2">
                            {leaveType.createdAt ? 
                              format(leaveType.createdAt.toDate ? leaveType.createdAt.toDate() : new Date(leaveType.createdAt), 'MMM dd, yyyy') :
                              'Unknown'
                            }
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<Edit />}
                              onClick={() => handleEditLeaveType(leaveType)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              color={leaveType.isActive ? 'warning' : 'success'}
                              onClick={() => handleToggleLeaveType(leaveType)}
                            >
                              {leaveType.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </>
              ) : getTabData()[tabValue].status === 'balance' ? (
                employees.map((employee) => {
                  const annualBalance = getEmployeeLeaveBalance(employee.id, 'annual');
                  const sickBalance = getEmployeeLeaveBalance(employee.id, 'sick');
                  const emergencyBalance = getEmployeeLeaveBalance(employee.id, 'emergency');
                  const maternityBalance = getEmployeeLeaveBalance(employee.id, 'maternity');

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
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: annualBalance.remaining > 5 ? 'success.main' : annualBalance.remaining > 0 ? 'warning.main' : 'error.main' }}>
                            {annualBalance.remaining} days left
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used: {annualBalance.used} / {annualBalance.total}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: sickBalance.remaining > 5 ? 'success.main' : sickBalance.remaining > 0 ? 'warning.main' : 'error.main' }}>
                            {sickBalance.remaining} days left
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used: {sickBalance.used} / {sickBalance.total}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: emergencyBalance.remaining > 1 ? 'success.main' : emergencyBalance.remaining > 0 ? 'warning.main' : 'error.main' }}>
                            {emergencyBalance.remaining} days left
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used: {emergencyBalance.used} / {emergencyBalance.total}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: maternityBalance.remaining > 60 ? 'success.main' : maternityBalance.remaining > 0 ? 'warning.main' : 'error.main' }}>
                            {maternityBalance.remaining} days left
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Used: {maternityBalance.used} / {maternityBalance.total}
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={employee.company || employee.originalCompanyName || 'RUBIX'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
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
                      <Typography variant="body2">
                        {(() => {
                          try {
                            const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                            const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                            return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
                          } catch (error) {
                            return 'Invalid date';
                          }
                        })()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }}>
                      {leave.reason?.length > 50 ? `${leave.reason.substring(0, 50)}...` : leave.reason}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {(() => {
                        try {
                          const appliedDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
                          return format(appliedDate, 'MMM dd, yyyy');
                        } catch (error) {
                          return 'Invalid date';
                        }
                      })()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      color={getStatusColor(leave.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell align="right">
                    <IconButton onClick={(e) => handleMenuClick(e, leave)}>
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        </Box>

        {/* Mobile Card View */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {getTabData()[tabValue].status === 'calendar' ? (
            // Mobile Calendar View
            <Box sx={{ p: 2 }}>
              {/* Calendar Controls */}
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                mb: 3,
                gap: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ 
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: 'primary.main',
                    textAlign: 'center'
                  }}>
                    Leave Calendar - {format(currentMonth, 'MMMM yyyy')}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={loadAllHolidays}
                    disabled={holidaysLoading}
                    startIcon={holidaysLoading ? <CircularProgress size={14} /> : null}
                    sx={{ 
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 1,
                      borderRadius: 2,
                      minWidth: 'auto'
                    }}
                  >
                    Refresh
                  </Button>
                </Box>
                <Box sx={{ 
                  display: 'flex',
                  gap: 1,
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}>
                  <Button 
                    variant="outlined"
                    size="small" 
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    sx={{ minWidth: '70px', fontSize: '0.75rem', px: 1, py: 0.5, borderRadius: 2, fontWeight: 'medium' }}
                  >
                    ← Prev
                  </Button>
                  <Button 
                    variant="contained"
                    size="small" 
                    onClick={() => setCurrentMonth(new Date())}
                    sx={{ minWidth: '60px', fontSize: '0.75rem', px: 1, py: 0.5, borderRadius: 2, fontWeight: 'bold' }}
                  >
                    Today
                  </Button>
                  <Button 
                    variant="outlined"
                    size="small" 
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    sx={{ minWidth: '70px', fontSize: '0.75rem', px: 1, py: 0.5, borderRadius: 2, fontWeight: 'medium' }}
                  >
                    Next →
                  </Button>
                </Box>
              </Box>
              
              {/* Mobile Calendar Grid */}
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Grid container spacing={0}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                    <Grid item xs={12/7} key={day}>
                      <Box sx={{ 
                        p: 1, 
                        textAlign: 'center',
                        fontWeight: 'bold', 
                        fontSize: '0.75rem',
                        backgroundColor: 'grey.50',
                        borderBottom: '1px solid',
                        borderColor: 'primary.main',
                        color: index === 0 || index === 6 ? 'error.main' : 'text.primary'
                      }}>
                        {day}
                      </Box>
                    </Grid>
                  ))}
                  
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(currentMonth);
                    const startDate = new Date(monthStart);
                    startDate.setDate(startDate.getDate() - getDay(monthStart));
                    const endDate = new Date(monthEnd);
                    endDate.setDate(endDate.getDate() + (6 - getDay(monthEnd)));
                    
                    const days = eachDayOfInterval({ start: startDate, end: endDate });
                    
                    return days.map(day => {
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
                        <Grid item xs={12/7} key={day.toString()}>
                          <Box 
                            onClick={(e) => handleCalendarDayClick(day, e)}
                            sx={{ 
                              height: 45,
                              p: 0.5,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              bgcolor: !isCurrentMonth ? 'grey.100' : 
                                       isToday(day) ? 'primary.50' : 
                                       (day.getDay() === 0 || day.getDay() === 6) ? 'grey.50' : 'white',
                              border: isToday(day) ? '2px solid' : '1px solid',
                              borderColor: isToday(day) ? 'primary.main' : 'divider',
                              cursor: (isHoliday || dayLeaves.length > 0 || pendingLeaves.length > 0) ? 'pointer' : 'default',
                              '&:hover': {
                                bgcolor: !isCurrentMonth ? 'grey.100' : 'grey.50'
                              }
                            }}
                          >
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: !isCurrentMonth ? 'text.disabled' : 
                                       (day.getDay() === 0 || day.getDay() === 6) ? 'error.main' : 'text.primary',
                                fontWeight: isToday(day) ? 'bold' : (day.getDay() === 0 || day.getDay() === 6) ? 'bold' : 'normal',
                                fontSize: '0.7rem'
                              }}
                            >
                              {format(day, 'd')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.2, flexWrap: 'wrap', justifyContent: 'center' }}>
                              {isHoliday && (
                                <Chip 
                                  label="H" 
                                  size="small" 
                                  color="error" 
                                  sx={{ 
                                    height: 10, 
                                    fontSize: '0.4rem',
                                    minWidth: 15,
                                    '& .MuiChip-label': { px: 0.2 }
                                  }}
                                />
                              )}
                              {(dayLeaves.length > 0 || pendingLeaves.length > 0) && (
                                <Chip 
                                  label="L"
                                  size="small" 
                                  color={dayLeaves.length > 0 ? 'success' : 'warning'}
                                  sx={{ 
                                    height: 10, 
                                    fontSize: '0.4rem',
                                    minWidth: 15,
                                    '& .MuiChip-label': { px: 0.2 }
                                  }}
                                />
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    });
                  })()}
                </Grid>
              </Paper>
              
              {/* Enhanced Mobile Legend */}
              <Box sx={{ 
                display: 'flex', 
                gap: 0.8, 
                mt: 2, 
                flexWrap: 'wrap',
                justifyContent: 'center',
                p: 1.5,
                backgroundColor: 'grey.50',
                borderRadius: 2
              }}>
                <Chip label="Today" color="primary" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="Weekend" color="error" variant="outlined" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="National (H)" color="error" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="Admin Added (H)" color="secondary" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="State (H)" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="Approved (L)" color="success" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
                <Chip label="Pending (L)" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
              </Box>
            </Box>
          ) : getTabData()[tabValue].status === 'quotas' ? (
            // Mobile Quota Cards
            <Box sx={{ p: 2 }}>
              {employees.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  py: 6
                }}>
                  <Avatar sx={{ fontSize: 64, bgcolor: 'grey.200', width: 80, height: 80, mb: 2 }}>
                    👥
                  </Avatar>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No employees found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Employee quotas will appear here once employees are added to the system
                  </Typography>
                </Box>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {(() => {
                      const startIndex = safePage * leavesPerPage;
                      const endIndex = startIndex + leavesPerPage;
                      const paginatedEmployees = employees.slice(startIndex, endIndex);
                      return paginatedEmployees.map((employee) => {
                  const quota = getEmployeeQuota(employee.id);
                  return (
                    <Grid item xs={12} key={employee.id}>
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
                              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {employee.department || 'General'} • {employee.email}
                              </Typography>
                              <Chip 
                                label={employee.company || employee.originalCompanyName || 'RUBIX'}
                                color="primary"
                                variant="outlined"
                                size="small"
                                sx={{ mt: 0.5 }}
                              />
                            </Box>
                          </Box>
                          
                          <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'primary.50', borderRadius: 2 }}>
                                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                                  {quota?.annualLeave || 14}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Annual Leave
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'success.50', borderRadius: 2 }}>
                                <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                                  {quota?.sickLeave || 14}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Sick Leave
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'warning.50', borderRadius: 2 }}>
                                <Typography variant="h6" color="warning.main" sx={{ fontWeight: 'bold' }}>
                                  {quota?.emergencyLeave || 3}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Emergency Leave
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={6}>
                              <Box sx={{ textAlign: 'center', p: 1, backgroundColor: 'error.50', borderRadius: 2 }}>
                                <Typography variant="h6" color="error.main" sx={{ fontWeight: 'bold' }}>
                                  {quota?.maternityLeave || 90}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Maternity Leave
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                          
                          <Button
                            variant="contained"
                            fullWidth
                            startIcon={<Edit />}
                            onClick={() => handleEditQuota(employee)}
                            sx={{ borderRadius: 2 }}
                          >
                            Edit Quota
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                      });
                    })()}
                  </Grid>
                  
                  {/* Mobile Pagination for Quotas */}
                  {employees.length > leavesPerPage && (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      mt: 3,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider'
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        Showing {safePage * leavesPerPage + 1} to{' '}
                        {Math.min((safePage + 1) * leavesPerPage, employees.length)} of{' '}
                        {employees.length} employees
                      </Typography>
                      
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
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {Array.from({ length: Math.ceil(employees.length / leavesPerPage) }, (_, index) => (
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
                          disabled={safePage === Math.ceil(employees.length / leavesPerPage) - 1}
                          endIcon={<ArrowForward />}
                          size="small"
                          sx={{ minWidth: 100 }}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Box>
          ) : getTabData()[tabValue].status === 'types' ? (
            // Mobile Leave Types Cards
            <Box sx={{ p: 2 }}>
              {leaveTypes.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  py: 6
                }}>
                  <EventBusy sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No leave types configured
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Add your first leave type to get started
                  </Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<Add />}
                    onClick={handleAddLeaveType}
                  >
                    Add Leave Type
                  </Button>
                </Box>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {(() => {
                      const startIndex = safePage * leavesPerPage;
                      const endIndex = startIndex + leavesPerPage;
                      const paginatedLeaveTypes = leaveTypes.slice(startIndex, endIndex);
                      return paginatedLeaveTypes.map((leaveType) => (
                    <Grid item xs={12} key={leaveType.id}>
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
                            <Avatar sx={{ 
                              mr: 2, 
                              bgcolor: `${leaveType.color}.main`,
                              width: 50,
                              height: 50
                            }}>
                              {leaveType.label.charAt(0)}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {leaveType.label}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {leaveType.name}
                              </Typography>
                            </Box>
                            <Chip 
                              label={leaveType.isActive ? 'Active' : 'Inactive'}
                              color={leaveType.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">Default Quota:</Typography>
                              <Typography variant="h6" color="primary.main" sx={{ fontWeight: 'bold' }}>
                                {leaveType.defaultQuota} days
                              </Typography>
                            </Box>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Description:
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              backgroundColor: 'grey.50', 
                              p: 1.5, 
                              borderRadius: 1,
                              minHeight: 40,
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              {leaveType.description || 'No description'}
                            </Typography>
                            
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                              Created: {leaveType.createdAt ? 
                                format(leaveType.createdAt.toDate ? leaveType.createdAt.toDate() : new Date(leaveType.createdAt), 'MMM dd, yyyy') :
                                'Unknown'
                              }
                            </Typography>
                          </Box>
                          
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<Edit />}
                              onClick={() => handleEditLeaveType(leaveType)}
                              sx={{ flex: 1, borderRadius: 2 }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              size="small"
                              color={leaveType.isActive ? 'warning' : 'success'}
                              onClick={() => handleToggleLeaveType(leaveType)}
                              sx={{ borderRadius: 2 }}
                            >
                              {leaveType.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                      </Grid>
                      ));
                    })()}
                  </Grid>
                  
                  {/* Mobile Pagination for Leave Types */}
                  {leaveTypes.length > leavesPerPage && (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      mt: 3,
                      pt: 2,
                      borderTop: 1,
                      borderColor: 'divider'
                    }}>
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        Showing {safePage * leavesPerPage + 1} to{' '}
                        {Math.min((safePage + 1) * leavesPerPage, leaveTypes.length)} of{' '}
                        {leaveTypes.length} leave types
                      </Typography>
                      
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
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {Array.from({ length: Math.ceil(leaveTypes.length / leavesPerPage) }, (_, index) => (
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
                          disabled={safePage === Math.ceil(leaveTypes.length / leavesPerPage) - 1}
                          endIcon={<ArrowForward />}
                          size="small"
                          sx={{ minWidth: 100 }}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Box>
          ) : getTabData()[tabValue].status === 'balance' ? (
            // Mobile Leave Balance Cards
            <Box sx={{ p: 2 }}>
              {employees.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  py: 6
                }}>
                  <Avatar sx={{ fontSize: 64, bgcolor: 'grey.200', width: 80, height: 80, mb: 2 }}>
                    📊
                  </Avatar>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No employees found
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Employee leave balances will appear here once employees are added
                  </Typography>
                </Box>
              ) : (
                <>
                  <Grid container spacing={2}>
                    {employees.map((employee) => {
                      const annualBalance = getEmployeeLeaveBalance(employee.id, 'annual');
                      const sickBalance = getEmployeeLeaveBalance(employee.id, 'sick');
                      const emergencyBalance = getEmployeeLeaveBalance(employee.id, 'emergency');
                      const maternityBalance = getEmployeeLeaveBalance(employee.id, 'maternity');

                      return (
                        <Grid item xs={12} key={employee.id}>
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
                              {/* Employee Info */}
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 50, height: 50 }}>
                                  {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                    {employee.firstName} {employee.lastName}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {employee.department || 'General'}
                                  </Typography>
                                  <Chip
                                    label={employee.company || employee.originalCompanyName || 'RUBIX'}
                                    color="primary"
                                    variant="outlined"
                                    size="small"
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                              </Box>

                              {/* Leave Balance Grid */}
                              <Grid container spacing={1.5}>
                                <Grid item xs={6}>
                                  <Box sx={{
                                    textAlign: 'center',
                                    p: 1.5,
                                    backgroundColor: annualBalance.remaining > 5 ? 'success.50' : annualBalance.remaining > 0 ? 'warning.50' : 'error.50',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: annualBalance.remaining > 5 ? 'success.light' : annualBalance.remaining > 0 ? 'warning.light' : 'error.light'
                                  }}>
                                    <Typography variant="h6" sx={{
                                      fontWeight: 'bold',
                                      color: annualBalance.remaining > 5 ? 'success.main' : annualBalance.remaining > 0 ? 'warning.main' : 'error.main'
                                    }}>
                                      {annualBalance.remaining}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                      Annual Leave
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      Used: {annualBalance.used}/{annualBalance.total}
                                    </Typography>
                                  </Box>
                                </Grid>

                                <Grid item xs={6}>
                                  <Box sx={{
                                    textAlign: 'center',
                                    p: 1.5,
                                    backgroundColor: sickBalance.remaining > 5 ? 'success.50' : sickBalance.remaining > 0 ? 'warning.50' : 'error.50',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: sickBalance.remaining > 5 ? 'success.light' : sickBalance.remaining > 0 ? 'warning.light' : 'error.light'
                                  }}>
                                    <Typography variant="h6" sx={{
                                      fontWeight: 'bold',
                                      color: sickBalance.remaining > 5 ? 'success.main' : sickBalance.remaining > 0 ? 'warning.main' : 'error.main'
                                    }}>
                                      {sickBalance.remaining}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                      Sick Leave
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      Used: {sickBalance.used}/{sickBalance.total}
                                    </Typography>
                                  </Box>
                                </Grid>

                                <Grid item xs={6}>
                                  <Box sx={{
                                    textAlign: 'center',
                                    p: 1.5,
                                    backgroundColor: emergencyBalance.remaining > 1 ? 'success.50' : emergencyBalance.remaining > 0 ? 'warning.50' : 'error.50',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: emergencyBalance.remaining > 1 ? 'success.light' : emergencyBalance.remaining > 0 ? 'warning.light' : 'error.light'
                                  }}>
                                    <Typography variant="h6" sx={{
                                      fontWeight: 'bold',
                                      color: emergencyBalance.remaining > 1 ? 'success.main' : emergencyBalance.remaining > 0 ? 'warning.main' : 'error.main'
                                    }}>
                                      {emergencyBalance.remaining}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                      Emergency
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      Used: {emergencyBalance.used}/{emergencyBalance.total}
                                    </Typography>
                                  </Box>
                                </Grid>

                                <Grid item xs={6}>
                                  <Box sx={{
                                    textAlign: 'center',
                                    p: 1.5,
                                    backgroundColor: maternityBalance.remaining > 60 ? 'success.50' : maternityBalance.remaining > 0 ? 'warning.50' : 'error.50',
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: maternityBalance.remaining > 60 ? 'success.light' : maternityBalance.remaining > 0 ? 'warning.light' : 'error.light'
                                  }}>
                                    <Typography variant="h6" sx={{
                                      fontWeight: 'bold',
                                      color: maternityBalance.remaining > 60 ? 'success.main' : maternityBalance.remaining > 0 ? 'warning.main' : 'error.main'
                                    }}>
                                      {maternityBalance.remaining}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>
                                      Maternity
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      Used: {maternityBalance.used}/{maternityBalance.total}
                                    </Typography>
                                  </Box>
                                </Grid>
                              </Grid>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </>
              )}
            </Box>
          ) : (
            // Mobile Leave Request Cards
            <Box sx={{ p: 2 }}>
              {paginatedLeaves.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  textAlign: 'center',
                  py: 6
                }}>
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
                    {getTabData()[tabValue].status === 'pending' ? 'New leave requests will appear here for your review' : 
                     getTabData()[tabValue].status === 'approved' ? 'Approved leave requests will be shown here' :
                     getTabData()[tabValue].status === 'rejected' ? 'Rejected leave requests will be displayed here' :
                     'Leave requests from employees will appear here once submitted'}
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {paginatedLeaves.map((leave) => (
                  <Grid item xs={12} key={leave.id}>
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
                            {leave.avatar || (leave.userName ? leave.userName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U')}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                              {leave.userName || 'Unknown User'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {leave.department || 'General'} • {leave.userEmail || 'No email'}
                            </Typography>
                          </Box>
                          <Chip 
                            label={leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                            color={getStatusColor(leave.status)}
                            size="small"
                          />
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Chip 
                              label={getLeaveTypeLabel(leave.leaveType)}
                              color={getLeaveTypeColor(leave.leaveType)}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                            <Typography variant="body2" color="text.secondary">
                              {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                            </Typography>
                          </Box>
                          
                          <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                            {(() => {
                              try {
                                const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                                const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                                return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
                              } catch (error) {
                                return 'Invalid date';
                              }
                            })()}
                          </Typography>
                          
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>Reason:</strong> {leave.reason}
                          </Typography>
                          
                          <Typography variant="caption" color="text.secondary">
                            Applied: {(() => {
                              try {
                                const appliedDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
                                return format(appliedDate, 'MMM dd, yyyy');
                              } catch (error) {
                                return 'Invalid date';
                              }
                            })()}
                          </Typography>
                        </Box>
                        
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<MoreVert />}
                          onClick={(e) => handleMenuClick(e, leave)}
                          sx={{ borderRadius: 2 }}
                        >
                          Actions
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Box>

        {/* Mobile Pagination */}
        {currentLeaves.length > leavesPerPage && totalPages > 1 && isMobile && (
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
              Showing {safePage * leavesPerPage + 1} to{' '}
              {Math.min((safePage + 1) * leavesPerPage, currentLeaves.length)} of{' '}
              {currentLeaves.length} leaves
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
      </Paper>

      {/* Desktop Pagination */}
      {!isMobile && currentLeaves.length > leavesPerPage && totalPages > 1 && (
        <Paper elevation={1} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {safePage * leavesPerPage + 1} to{' '}
              {Math.min((safePage + 1) * leavesPerPage, currentLeaves.length)} of{' '}
              {currentLeaves.length} leaves
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
        
        {selectedLeave?.status === 'pending' && (
          <>
            <Divider />
            <MenuItem onClick={() => handleAction('approve')} sx={{ color: 'success.main' }}>
              <CheckCircle sx={{ mr: 2 }} />
              Approve Leave
            </MenuItem>
            <MenuItem onClick={() => handleAction('reject')} sx={{ color: 'error.main' }}>
              <Cancel sx={{ mr: 2 }} />
              Reject Leave
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialog} 
        onClose={() => {
          setActionDialog(false);
          setSelectedLeave(null);
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
              <Visibility sx={{ mr: 1, color: 'primary.main' }} />
            ) : actionType === 'approve' ? (
              <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
            ) : (
              <Cancel sx={{ mr: 1, color: 'error.main' }} />
            )}
            {actionType === 'view' ? 'Leave Request Details' : 
             actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedLeave && (
            <Box>
              {actionType !== 'view' && (
                <Alert 
                  severity={actionType === 'approve' ? 'success' : 'error'} 
                  sx={{ mb: 2 }}
                >
                  You are about to {actionType} this leave request. This action will send an email notification to the employee.
                </Alert>
              )}
              
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Leave Request Details:
                </Typography>
                <Typography variant="body2">
                  <strong>Employee:</strong> {selectedLeave.userName}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {getLeaveTypeLabel(selectedLeave.leaveType)}
                </Typography>
                <Typography variant="body2">
                  <strong>Duration:</strong> {(() => {
                    try {
                      const startDate = selectedLeave.startDate?.toDate ? selectedLeave.startDate.toDate() : new Date(selectedLeave.startDate);
                      const endDate = selectedLeave.endDate?.toDate ? selectedLeave.endDate.toDate() : new Date(selectedLeave.endDate);
                      return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
                    } catch (error) {
                      return 'Invalid date range';
                    }
                  })()} ({selectedLeave.totalDays} days)
                </Typography>
                <Typography variant="body2">
                  <strong>Reason:</strong> {selectedLeave.reason}
                </Typography>
                {selectedLeave.emergencyContact && (
                  <Typography variant="body2">
                    <strong>Emergency Contact:</strong> {selectedLeave.emergencyContact}
                  </Typography>
                )}
              </Box>
              
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
                <Typography variant="body2" color="text.secondary">
                  The employee will be notified via email and the leave will be added to their calendar.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setActionDialog(false);
            setSelectedLeave(null);
            setActionReason('');
          }}>
            {actionType === 'view' ? 'Close' : 'Cancel'}
          </Button>
          {actionType !== 'view' && (
            <Button 
              variant="contained" 
              color={actionType === 'approve' ? 'success' : 'error'}
              onClick={handleActionSubmit}
              disabled={actionLoading || (actionType === 'reject' && !actionReason.trim())}
            >
              {actionLoading ? 'Processing...' : (actionType === 'approve' ? 'Approve Leave' : 'Reject Leave')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Leave Quota Dialog */}
      <Dialog 
        open={quotaDialog}
        onClose={() => {
          setQuotaDialog(false);
          setSelectedEmployee(null);
          setQuotaForm({
            annualLeave: 14,
            sickLeave: 14,
            emergencyLeave: 3,
            maternityLeave: 90
          });
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
            <Settings sx={{ mr: 1, color: 'primary.main' }} />
            Edit Leave Quota - {selectedEmployee?.firstName} {selectedEmployee?.lastName}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedEmployee && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                Set individual leave quotas for this employee. This will override default company leave policies.
              </Alert>
              
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 3 }}>
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
                  <strong>Department:</strong> {selectedEmployee.department || 'General'}
                </Typography>
                <Typography variant="body2">
                  <strong>Company:</strong> {selectedEmployee.company || selectedEmployee.originalCompanyName || 'RUBIX'}
                </Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Annual Leave (days)"
                    type="number"
                    fullWidth
                    value={quotaForm.annualLeave}
                    onChange={(e) => setQuotaForm({...quotaForm, annualLeave: e.target.value})}
                    inputProps={{ min: 0, max: 365 }}
                    helperText="Standard: 14 days"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Sick Leave (days)"
                    type="number"
                    fullWidth
                    value={quotaForm.sickLeave}
                    onChange={(e) => setQuotaForm({...quotaForm, sickLeave: e.target.value})}
                    inputProps={{ min: 0, max: 365 }}
                    helperText="Standard: 14 days"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Emergency Leave (days)"
                    type="number"
                    fullWidth
                    value={quotaForm.emergencyLeave}
                    onChange={(e) => setQuotaForm({...quotaForm, emergencyLeave: e.target.value})}
                    inputProps={{ min: 0, max: 365 }}
                    helperText="Standard: 3 days"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Maternity Leave (days)"
                    type="number"
                    fullWidth
                    value={quotaForm.maternityLeave}
                    onChange={(e) => setQuotaForm({...quotaForm, maternityLeave: e.target.value})}
                    inputProps={{ min: 0, max: 365 }}
                    helperText="Standard: 60 days"
                  />
                </Grid>
              </Grid>
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                These quotas will be applied immediately and will be visible to the employee when they apply for leave.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setQuotaDialog(false);
            setSelectedEmployee(null);
            setQuotaForm({
              annualLeave: 14,
              sickLeave: 14,
              emergencyLeave: 3,
              maternityLeave: 90
            });
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveQuota}
            disabled={actionLoading}
          >
            {actionLoading ? 'Saving...' : 'Save Quota'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Quota Management Dialog */}
      <Dialog 
        open={bulkQuotaDialog} 
        onClose={() => {
          setBulkQuotaDialog(false);
          setSelectedEmployees([]);
          setEmployeeFilter('all');
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
            <Settings sx={{ mr: 1, color: 'primary.main' }} />
            Bulk Quota Management
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            Set default leave quotas that will be applied to selected employees. You can choose which specific employees to update, whether they have existing quotas or not.
          </Alert>
          
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Annual Leave (days)"
                type="number"
                fullWidth
                value={bulkQuotaForm.annualLeave}
                onChange={(e) => setBulkQuotaForm({...bulkQuotaForm, annualLeave: e.target.value})}
                inputProps={{ min: 0, max: 365 }}
                helperText="Vacation and personal time off"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Sick Leave (days)"
                type="number"
                fullWidth
                value={bulkQuotaForm.sickLeave}
                onChange={(e) => setBulkQuotaForm({...bulkQuotaForm, sickLeave: e.target.value})}
                inputProps={{ min: 0, max: 365 }}
                helperText="Medical leave and appointments"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Emergency Leave (days)"
                type="number"
                fullWidth
                value={bulkQuotaForm.emergencyLeave}
                onChange={(e) => setBulkQuotaForm({...bulkQuotaForm, emergencyLeave: e.target.value})}
                inputProps={{ min: 0, max: 365 }}
                helperText="Urgent personal emergencies"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Maternity Leave (days)"
                type="number"
                fullWidth
                value={bulkQuotaForm.maternityLeave}
                onChange={(e) => setBulkQuotaForm({...bulkQuotaForm, maternityLeave: e.target.value})}
                inputProps={{ min: 0, max: 365 }}
                helperText="Maternity and paternity leave"
              />
            </Grid>
          </Grid>
          
          {/* Employee Selection */}
          <Accordion sx={{ mt: 3 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Select Employees ({selectedEmployees.length} selected)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {/* Filter and Quick Select Controls */}
              <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <FilterList sx={{ mr: 1 }} />
                  Filter & Quick Select
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                  <Button
                    size="small"
                    variant={employeeFilter === 'all' ? 'contained' : 'outlined'}
                    onClick={() => handleFilterChange('all')}
                    startIcon={<People />}
                  >
                    All ({employees.length})
                  </Button>
                  <Button
                    size="small"
                    variant={employeeFilter === 'withoutQuotas' ? 'contained' : 'outlined'}
                    color="warning"
                    onClick={() => handleFilterChange('withoutQuotas')}
                    startIcon={<Warning />}
                  >
                    Without Quotas ({employees.filter(emp => !leaveQuotas.find(q => q.employeeId === emp.id)).length})
                  </Button>
                  <Button
                    size="small"
                    variant={employeeFilter === 'withQuotas' ? 'contained' : 'outlined'}
                    color="success"
                    onClick={() => handleFilterChange('withQuotas')}
                    startIcon={<CheckCircle />}
                  >
                    With Quotas ({employees.filter(emp => leaveQuotas.find(q => q.employeeId === emp.id)).length})
                  </Button>
                </Box>
              </Box>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={
                        getFilteredEmployees().length > 0 && 
                        getFilteredEmployees().every(emp => selectedEmployees.includes(emp.id))
                      }
                      indeterminate={
                        getFilteredEmployees().some(emp => selectedEmployees.includes(emp.id)) &&
                        !getFilteredEmployees().every(emp => selectedEmployees.includes(emp.id))
                      }
                      onChange={(e) => handleSelectAllEmployees(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="subtitle2">
                      Select All {employeeFilter === 'withoutQuotas' ? 'Without Quotas' : 
                                 employeeFilter === 'withQuotas' ? 'With Quotas' : 'Filtered'} 
                      ({getFilteredEmployees().length})
                    </Typography>
                  }
                />
                <Divider sx={{ my: 1 }} />
                {getFilteredEmployees().map((employee) => {
                  const hasQuota = leaveQuotas.find(q => q.employeeId === employee.id);
                  return (
                    <FormControlLabel
                      key={employee.id}
                      control={
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => handleEmployeeSelection(employee.id, e.target.checked)}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                            {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2">
                              {employee.firstName} {employee.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {employee.email} • {employee.company || employee.originalCompanyName || 'RUBIX'}
                            </Typography>
                          </Box>
                          {hasQuota && (
                            <Chip 
                              label="Has Custom Quota" 
                              size="small" 
                              color="info" 
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                    />
                  );
                })}
              </FormGroup>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Impact Summary:
            </Typography>
            <Typography variant="body2">
              • <strong>{selectedEmployees.length}</strong> employees selected for quota updates
            </Typography>
            <Typography variant="body2">
              • <strong>{selectedEmployees.filter(id => leaveQuotas.find(q => q.employeeId === id)).length}</strong> selected employees already have custom quotas (will be updated)
            </Typography>
            <Typography variant="body2">
              • <strong>{selectedEmployees.filter(id => !leaveQuotas.find(q => q.employeeId === id)).length}</strong> selected employees will receive new quotas
            </Typography>
            <Typography variant="body2">
              • <strong>{employees.length - selectedEmployees.length}</strong> employees will remain unchanged
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ gap: 2, p: 3 }}>
          <Button onClick={() => {
            setBulkQuotaDialog(false);
            setSelectedEmployees([]);
            setEmployeeFilter('all');
          }}>
            Cancel
          </Button>
          <Button 
            variant="outlined"
            onClick={handleResetAllQuotas}
            disabled={bulkQuotaLoading}
            color="warning"
            startIcon={bulkQuotaLoading ? <CircularProgress size={20} /> : <Warning />}
          >
            {bulkQuotaLoading ? 'Processing...' : 'Reset All Employees'}
          </Button>
          <Button 
            variant="contained" 
            onClick={handleBulkQuotaApply}
            disabled={bulkQuotaLoading || selectedEmployees.length === 0}
            startIcon={bulkQuotaLoading ? <CircularProgress size={20} /> : <People />}
          >
            {bulkQuotaLoading ? 'Processing...' : `Apply to Selected Employees (${selectedEmployees.length})`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Leave Types Management Dialog */}
      <Dialog 
        open={leaveTypeDialog} 
        onClose={() => {
          setLeaveTypeDialog(false);
          setSelectedLeaveType(null);
          setLeaveTypeForm({
            name: '',
            label: '',
            defaultQuota: 0,
            color: 'primary',
            description: '',
            isActive: true
          });
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
            <Add sx={{ mr: 1, color: 'primary.main' }} />
            {selectedLeaveType ? 'Edit Leave Type' : 'Add New Leave Type'}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3 }}>
            {selectedLeaveType ? 
              'Update this leave type. Changes will apply to all future leave applications.' :
              'Create a new leave type that will be available to all employees for leave applications.'
            }
          </Alert>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Leave Type Name"
                fullWidth
                value={leaveTypeForm.label}
                onChange={(e) => setLeaveTypeForm({
                  ...leaveTypeForm, 
                  label: e.target.value,
                  name: e.target.value.toLowerCase().replace(/\s+/g, '')
                })}
                placeholder="e.g., Annual Leave"
                helperText="Display name for employees"
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="System Name"
                fullWidth
                value={leaveTypeForm.name}
                onChange={(e) => setLeaveTypeForm({
                  ...leaveTypeForm, 
                  name: e.target.value.toLowerCase().replace(/\s+/g, '')
                })}
                placeholder="e.g., annual"
                helperText="Internal identifier (auto-generated)"
                disabled
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Default Quota (days)"
                type="number"
                fullWidth
                value={leaveTypeForm.defaultQuota}
                onChange={(e) => setLeaveTypeForm({...leaveTypeForm, defaultQuota: e.target.value})}
                inputProps={{ min: 0, max: 365 }}
                helperText="Default days per year"
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Color Theme"
                select
                fullWidth
                value={leaveTypeForm.color}
                onChange={(e) => setLeaveTypeForm({...leaveTypeForm, color: e.target.value})}
                helperText="Visual indicator color"
              >
                <MenuItem value="primary">Blue</MenuItem>
                <MenuItem value="secondary">Purple</MenuItem>
                <MenuItem value="success">Green</MenuItem>
                <MenuItem value="warning">Orange</MenuItem>
                <MenuItem value="error">Red</MenuItem>
                <MenuItem value="info">Cyan</MenuItem>
              </TextField>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={3}
                value={leaveTypeForm.description}
                onChange={(e) => setLeaveTypeForm({...leaveTypeForm, description: e.target.value})}
                placeholder="Describe when this leave type should be used..."
                helperText="Help employees understand when to use this leave type"
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Preview:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar sx={{ 
                mr: 2, 
                bgcolor: `${leaveTypeForm.color}.main`,
                width: 32,
                height: 32
              }}>
                {leaveTypeForm.label.charAt(0) || 'L'}
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {leaveTypeForm.label || 'Leave Type Name'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {leaveTypeForm.defaultQuota || 0} days • {leaveTypeForm.description || 'No description'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setLeaveTypeDialog(false);
            setSelectedLeaveType(null);
            setLeaveTypeForm({
              name: '',
              label: '',
              defaultQuota: 0,
              color: 'primary',
              description: '',
              isActive: true
            });
          }}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveLeaveType}
            disabled={leaveTypeLoading || !leaveTypeForm.label.trim()}
            startIcon={leaveTypeLoading ? <CircularProgress size={20} /> : <Add />}
          >
            {leaveTypeLoading ? 'Saving...' : (selectedLeaveType ? 'Update Leave Type' : 'Create Leave Type')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Calendar Popup Dialog */}
      <Dialog
        open={calendarPopup.open}
        onClose={closeCalendarPopup}
        PaperProps={{
          sx: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            minWidth: 350,
            maxWidth: 500
          }
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)'
          }
        }}
      >
        <DialogTitle sx={{ 
          color: '#1a1a1a', 
          fontWeight: 'bold',
          textAlign: 'center',
          pb: 1,
          background: 'linear-gradient(135deg, #f8f9ff 0%, #e3f2fd 100%)',
          borderBottom: '1px solid rgba(0,0,0,0.1)'
        }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {calendarPopup.data && format(calendarPopup.data.day, 'EEEE, MMMM dd, yyyy')}
            </Typography>
            {calendarPopup.data && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {calendarPopup.data.holiday && (
                  <Chip 
                    label={`${calendarPopup.data.holiday.type} Holiday`}
                    color={calendarPopup.data.holiday.type === 'National' ? 'error' : 'warning'}
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
                {calendarPopup.data.approvedLeaves && calendarPopup.data.approvedLeaves.length > 0 && (
                  <Chip 
                    label={`${calendarPopup.data.approvedLeaves.length} Approved`}
                    color="success"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
                {calendarPopup.data.pendingLeaves && calendarPopup.data.pendingLeaves.length > 0 && (
                  <Chip 
                    label={`${calendarPopup.data.pendingLeaves.length} Pending`}
                    color="warning"
                    size="small"
                    sx={{ fontWeight: 'bold' }}
                  />
                )}
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {calendarPopup.data?.holiday && (
            <Box sx={{ 
              mb: 2, 
              p: 2, 
              borderRadius: 2, 
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}>
              <Chip 
                label={calendarPopup.data.holiday.type} 
                color={calendarPopup.data.holiday.type === 'National' ? 'error' : 'warning'}
                size="small"
                sx={{ mb: 1, fontWeight: 'bold' }}
              />
              <Typography variant="h6" sx={{ 
                color: '#1a1a1a', 
                fontWeight: 'bold',
                mb: 0.5
              }}>
                {calendarPopup.data.holiday.name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#424242' }}>
                {calendarPopup.data.holiday.type === 'National' ? 'National Public Holiday' : 'State Holiday'}
              </Typography>
            </Box>
          )}
          
          {/* Approved Leaves Section */}
          {calendarPopup.data?.approvedLeaves && calendarPopup.data.approvedLeaves.length > 0 && (
            <Box sx={{ 
              mb: 2,
              p: 2, 
              borderRadius: 2, 
              background: 'rgba(76, 175, 80, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(76, 175, 80, 0.3)'
            }}>
              <Typography variant="subtitle1" sx={{ 
                color: 'success.main', 
                fontWeight: 'bold', 
                mb: 1.5,
                display: 'flex',
                alignItems: 'center'
              }}>
                <CheckCircle sx={{ mr: 1, fontSize: 20 }} />
                Approved Leaves ({calendarPopup.data.approvedLeaves.length})
              </Typography>
              {calendarPopup.data.approvedLeaves.map((leave, index) => (
                <Box key={index} sx={{ 
                  mb: index < calendarPopup.data.approvedLeaves.length - 1 ? 2 : 0, 
                  p: 2, 
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(76, 175, 80, 0.2)',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.1)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'success.main' }}>
                        {leave.userName ? leave.userName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
                          {leave.userName || 'Unknown Employee'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {leave.department || 'General'} • {leave.userEmail || 'No email'}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip 
                      label="Approved" 
                      color="success"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Grid container spacing={1} sx={{ mb: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Leave Type
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {getLeaveTypeLabel(leave.leaveType)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Duration
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Leave Period
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {(() => {
                      try {
                        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                        return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
                      } catch {
                        return 'Invalid date range';
                      }
                    })()
                    }
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Reason
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontStyle: 'italic',
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.05)',
                    borderRadius: 1,
                    mb: 1
                  }}>
                    {leave.reason || 'No reason provided'}
                  </Typography>
                  
                  {leave.approvedBy && (
                    <Typography variant="caption" sx={{ 
                      color: 'success.main',
                      fontWeight: 'medium',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <CheckCircle sx={{ fontSize: 14, mr: 0.5 }} />
                      Approved by {leave.approvedBy} on {(() => {
                        try {
                          const approvedDate = leave.approvedDate?.toDate ? leave.approvedDate.toDate() : new Date(leave.approvedDate);
                          return format(approvedDate, 'MMM dd, yyyy');
                        } catch {
                          return 'Unknown date';
                        }
                      })()}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
          
          {/* Pending Leaves Section */}
          {calendarPopup.data?.pendingLeaves && calendarPopup.data.pendingLeaves.length > 0 && (
            <Box sx={{ 
              mb: 2,
              p: 2, 
              borderRadius: 2, 
              background: 'rgba(255, 193, 7, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 193, 7, 0.3)'
            }}>
              <Typography variant="subtitle1" sx={{ 
                color: 'warning.main', 
                fontWeight: 'bold', 
                mb: 1.5,
                display: 'flex',
                alignItems: 'center'
              }}>
                <Schedule sx={{ mr: 1, fontSize: 20 }} />
                Pending Approval ({calendarPopup.data.pendingLeaves.length})
              </Typography>
              {calendarPopup.data.pendingLeaves.map((leave, index) => (
                <Box key={index} sx={{ 
                  mb: index < calendarPopup.data.pendingLeaves.length - 1 ? 2 : 0, 
                  p: 2, 
                  borderRadius: 2,
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(255, 193, 7, 0.2)',
                  boxShadow: '0 2px 8px rgba(255, 193, 7, 0.1)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: 'warning.main' }}>
                        {leave.userName ? leave.userName.split(' ').map(n => n[0]).join('').substring(0, 2) : 'U'}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
                          {leave.userName || 'Unknown Employee'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#666' }}>
                          {leave.department || 'General'} • {leave.userEmail || 'No email'}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip 
                      label="Pending" 
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Grid container spacing={1} sx={{ mb: 1 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Leave Type
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {getLeaveTypeLabel(leave.leaveType)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Duration
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Leave Period
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {(() => {
                      try {
                        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                        return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd, yyyy')}`;
                      } catch {
                        return 'Invalid date range';
                      }
                    })()
                    }
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Reason
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontStyle: 'italic',
                    p: 1,
                    bgcolor: 'rgba(0,0,0,0.05)',
                    borderRadius: 1,
                    mb: 1
                  }}>
                    {leave.reason || 'No reason provided'}
                  </Typography>
                  
                  <Typography variant="caption" sx={{ 
                    color: 'warning.main',
                    fontWeight: 'medium',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <Schedule sx={{ fontSize: 14, mr: 0.5 }} />
                    Applied on {(() => {
                      try {
                        const appliedDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
                        return format(appliedDate, 'MMM dd, yyyy');
                      } catch {
                        return 'Unknown date';
                      }
                    })()}
                  </Typography>
                  
                  {leave.emergencyContact && (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5 }}>
                        Emergency Contact
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {leave.emergencyContact}
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}
          
          {!calendarPopup.data?.holiday && (!calendarPopup.data?.leaves || calendarPopup.data.leaves.length === 0) && (
            <Box sx={{ 
              p: 3, 
              textAlign: 'center',
              borderRadius: 2, 
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}>
              <Typography variant="body2" sx={{ color: '#424242' }}>
                No events on this day
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3, pt: 2 }}>
          <Button 
            onClick={closeCalendarPopup} 
            variant="contained"
            size="large"
            sx={{ 
              background: 'linear-gradient(135deg, #1976d2, #1565c0)',
              color: 'white',
              fontWeight: 'bold',
              px: 4,
              py: 1,
              borderRadius: 2,
              textTransform: 'none'
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default AdminLeaves;