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
  LinearProgress,
  Avatar,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge,
  CircularProgress,
  Fab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Skeleton
} from '@mui/material';
import { 
  Add, 
  EventAvailable, 
  EventBusy, 
  CheckCircle, 
  Schedule, 
  Cancel,
  CalendarToday,
  Warning,
  Info,
  History,
  Description,
  WbSunny,
  Business,
  ExpandMore
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { format, differenceInDays, addDays, startOfDay, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from 'date-fns';
import { collection, addDoc, query, where, orderBy, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getLeaveBalanceConfig, checkAnnualLeaveReset } from '../../utils/leaveBalanceReset';
import { loadLeaveTypes, getDefaultQuotaConfig } from '../../utils/leaveTypesMigration';

function Leaves() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [tabValue, setTabValue] = useState(0);
  const [applyDialog, setApplyDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({
    annual: { used: 0, total: 12 },
    sick: { used: 0, total: 14 },
    emergency: { used: 0, total: 3 },
    maternity: { used: 0, total: 90 }
  });
  const [leaveForm, setLeaveForm] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    emergencyContact: '',
    documents: null,
    replacementTeamMember: ''
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarPopup, setCalendarPopup] = useState({ open: false, data: null, anchorPosition: null });
  const [dynamicLeaveTypes, setDynamicLeaveTypes] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);

  // Generate leave types from dynamic data with current balance
  const leaveTypes = dynamicLeaveTypes.map(type => ({
    value: type.name,
    label: type.label,
    balance: leaveBalance[type.name] || { used: 0, total: type.defaultQuota },
    color: type.color,
    description: type.description
  }));

  // Default Malaysian public holidays for 2025
  const getDefaultMalaysianHolidays = () => {
    return [
      { date: '2025-01-01', name: 'New Year\'s Day', type: 'National' },
      { date: '2025-01-29', name: 'Chinese New Year', type: 'National' },
      { date: '2025-01-30', name: 'Chinese New Year (2nd Day)', type: 'National' },
      { date: '2025-03-30', name: 'Hari Raya Aidilfitri', type: 'National' },
      { date: '2025-03-31', name: 'Hari Raya Aidilfitri (2nd Day)', type: 'National' },
      { date: '2025-05-01', name: 'Labour Day', type: 'National' },
      { date: '2025-05-12', name: 'Wesak Day', type: 'National' },
      { date: '2025-06-07', name: 'Hari Raya Haji', type: 'National' },
      { date: '2025-06-09', name: 'Yang di-Pertuan Agong\'s Birthday', type: 'National' },
      { date: '2025-06-28', name: 'Awal Muharram (Islamic New Year)', type: 'National' },
      { date: '2025-08-31', name: 'National Day', type: 'National' },
      { date: '2025-09-01', name: 'Replacement Holiday (National Day)', type: 'National' },
      { date: '2025-09-05', name: 'Maulidur Rasul', type: 'National' },
      { date: '2025-09-16', name: 'Malaysia Day', type: 'National' },
      { date: '2025-10-20', name: 'Deepavali', type: 'National' },
      { date: '2025-12-25', name: 'Christmas Day', type: 'National' },
      // State holidays (commonly observed)
      { date: '2025-02-01', name: 'Federal Territory Day', type: 'State' },
      { date: '2025-03-11', name: 'Sultan of Selangor\'s Birthday', type: 'State' },
      { date: '2025-07-07', name: 'George Town World Heritage City Day', type: 'State' }
    ];
  };

  // Load custom holidays from Firestore (holidays added by admin)
  const loadCustomHolidays = async () => {
    try {
      const customHolidaysQuery = query(collection(db, 'customHolidays'));
      const customHolidaysSnapshot = await getDocs(customHolidaysQuery);
      return customHolidaysSnapshot.docs.map(doc => ({
        id: doc.id,
        date: format(doc.data().date.toDate ? doc.data().date.toDate() : new Date(doc.data().date), 'yyyy-MM-dd'),
        name: doc.data().name,
        type: doc.data().type === 'replacement' ? 'Admin Added' : 
              doc.data().type === 'company' ? 'Company' : 
              doc.data().type === 'special' ? 'Special' : 'Admin Added',
        addedBy: doc.data().createdByName || 'Admin',
        addedAt: doc.data().createdAt
      }));
    } catch (error) {
      console.warn('Failed to load custom holidays:', error);
      return [];
    }
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

  // Load all holidays (default + custom)
  const loadAllHolidays = async () => {
    try {
      const defaultHolidays = getDefaultMalaysianHolidays();
      const customHolidays = await loadCustomHolidays();
      
      // Combine holidays and remove duplicates (prioritize custom over default)
      const allHolidays = [...customHolidays, ...defaultHolidays];
      const uniqueHolidays = [];
      const seenDates = new Set();
      
      allHolidays.forEach(holiday => {
        if (!seenDates.has(holiday.date)) {
          seenDates.add(holiday.date);
          uniqueHolidays.push(holiday);
        }
      });
      
      // Sort by date
      uniqueHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      setPublicHolidays(uniqueHolidays);
      console.log('🎉 Loaded holidays:', uniqueHolidays.length, 'total holidays');
      console.log('📊 Holiday breakdown:', {
        custom: customHolidays.length,
        default: defaultHolidays.length,
        unique: uniqueHolidays.length
      });
    } catch (error) {
      console.error('Error loading holidays:', error);
      // Fallback to default holidays only
      setPublicHolidays(getDefaultMalaysianHolidays());
    }
  };

  useEffect(() => {
    if (user) {
      loadUserLeaves();
      loadLeaveBalance();
      loadDynamicLeaveTypes();
      loadTeamMembers();
      loadAllHolidays(); // Load all holidays including admin-added ones
    }
  }, [user]);

  const loadDynamicLeaveTypes = async () => {
    try {
      const types = await loadLeaveTypes();
      setDynamicLeaveTypes(types);
      console.log('Loaded dynamic leave types:', types);
    } catch (error) {
      console.error('Error loading dynamic leave types:', error);
      // Fallback to empty array, component will handle gracefully
      setDynamicLeaveTypes([]);
    }
  };

  const loadTeamMembers = async () => {
    try {
      // Get user's company for filtering team members
      const userCompany = user.originalCompanyName || user.company || 'RUBIX';
      console.log('Loading team members for company:', userCompany);
      
      // Load all users from the same company (excluding the current user)
      const q = query(
        collection(db, 'users'),
        where('originalCompanyName', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      const companyUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter out current user, admin users, and inactive users
      const availableTeamMembers = companyUsers.filter(member => 
        member.id !== user.uid && 
        member.role !== 'admin' &&
        member.isActive !== false
      );
      
      setTeamMembers(availableTeamMembers);
      console.log('Loaded team members:', availableTeamMembers.length, 'members from', userCompany);
    } catch (error) {
      console.error('Error loading team members:', error);
      // Try fallback query without originalCompanyName filter
      try {
        const fallbackQuery = query(collection(db, 'users'));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const allUsers = fallbackSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Filter by company field as fallback
        const userCompany = user.originalCompanyName || user.company || 'RUBIX';
        const filteredUsers = allUsers.filter(member => 
          member.id !== user.uid && 
          member.role !== 'admin' && 
          member.isActive !== false &&
          (member.originalCompanyName === userCompany || member.company === userCompany)
        );
        
        setTeamMembers(filteredUsers);
        console.log('Loaded team members (fallback):', filteredUsers.length, 'members');
      } catch (fallbackError) {
        console.error('Error in fallback team member loading:', fallbackError);
        setTeamMembers([]);
      }
    }
  };

  const loadUserLeaves = async () => {
    setLeavesLoading(true);
    try {
      // Simple query to avoid index issues
      const q = query(
        collection(db, 'leaves'),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      const userLeaves = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by appliedDate on client side (most recent first)
      userLeaves.sort((a, b) => {
        const aDate = a.appliedDate?.toDate ? a.appliedDate.toDate() : new Date(a.appliedDate);
        const bDate = b.appliedDate?.toDate ? b.appliedDate.toDate() : new Date(b.appliedDate);
        return bDate - aDate;
      });

      setLeaves(userLeaves);
      console.log('Loaded user leaves:', userLeaves);
      console.log('Current leaves state for calendar:', userLeaves.map(l => ({
        id: l.id,
        leaveType: l.leaveType,
        status: l.status,
        startDate: l.startDate,
        endDate: l.endDate,
        totalDays: l.totalDays
      })));
    } catch (error) {
      console.error('Error loading leaves:', error);
    } finally {
      setLeavesLoading(false);
    }
  };

  const loadLeaveBalance = async () => {
    setBalanceLoading(true);
    try {
      // Load user's approved leaves for this year
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear + 1, 0, 1);

      const q = query(
        collection(db, 'leaves'),
        where('userId', '==', user.uid),
        where('status', '==', 'approved')
      );

      const querySnapshot = await getDocs(q);
      const usedLeaves = {};

      querySnapshot.docs.forEach(doc => {
        const leave = doc.data();
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);

        // Count only this year's leaves
        if (startDate >= yearStart && startDate < yearEnd) {
          const leaveType = leave.leaveType;
          usedLeaves[leaveType] = (usedLeaves[leaveType] || 0) + (leave.totalDays || 0);
        }
      });

      // Get default quotas from dynamic leave types first, then check for admin overrides
      let leaveBalanceConfig = {};

      try {
        // Load default quotas from dynamic leave types
        const defaultConfig = await getDefaultQuotaConfig();
        leaveBalanceConfig = defaultConfig;
        console.log('Loaded default quota config from leave types:', defaultConfig);
      } catch (error) {
        console.warn('Error loading dynamic quota config, using hardcoded fallback:', error);
        leaveBalanceConfig = getLeaveBalanceConfig(currentYear);
      }

      try {
        const quotaQuery = query(
          collection(db, 'leaveQuotas'),
          where('employeeId', '==', user.uid)
        );
        const quotaSnapshot = await getDocs(quotaQuery);

        if (!quotaSnapshot.empty) {
          const userQuota = quotaSnapshot.docs[0].data();
          console.log('Found custom quota for user:', userQuota);

          // Override with admin-set quotas
          // Map from old quota field names to new dynamic leave type names
          const quotaMapping = {
            annualLeave: 'annual',
            sickLeave: 'sick',
            emergencyLeave: 'emergency',
            maternityLeave: 'maternity'
          };

          Object.entries(quotaMapping).forEach(([quotaField, leaveTypeName]) => {
            if (userQuota[quotaField] !== undefined) {
              leaveBalanceConfig[leaveTypeName] = userQuota[quotaField];
            }
          });

          console.log('Using custom quota config:', leaveBalanceConfig);
        } else {
          console.log('No custom quota found, using default config');
        }
      } catch (quotaError) {
        console.warn('Error loading custom quota, using defaults:', quotaError);
      }

      // Build balance object dynamically from leave types config
      const balanceObject = {};
      Object.entries(leaveBalanceConfig).forEach(([leaveTypeName, totalQuota]) => {
        balanceObject[leaveTypeName] = {
          used: usedLeaves[leaveTypeName] || 0,
          total: totalQuota
        };
      });

      setLeaveBalance(balanceObject);

      console.log(`Leave balance loaded for ${currentYear}:`, {
        usedLeaves,
        totalBalances: leaveBalanceConfig,
        resetDate: `January 1, ${currentYear}`
      });
    } catch (error) {
      console.error('Error loading leave balance:', error);
    } finally {
      setBalanceLoading(false);
    }
  };

  // Leave balance configuration with auto-reset logic
  const getLeaveBalanceConfig = (year) => {
    // Base configuration for leave types
    const baseConfig = {
      annual: 12,      // 12 days per year
      sick: 14,        // 14 days per year
      emergency: 3,    // 3 days per year
      maternity: 90    // 90 days per year
    };

    // Handle special cases for different years if needed
    switch (year) {
      case 2025:
        return {
          ...baseConfig,
          // 2025: Standard allocation
        };
      case 2026:
        return {
          ...baseConfig,
          // 2026: Could have different allocations if company policy changes
          annual: 15, // Example: Increased to 15 days in 2026
        };
      default:
        return baseConfig;
    }
  };

  // Auto-check for new year reset when component loads
  useEffect(() => {
    if (user && dynamicLeaveTypes.length > 0) {
      const resetCheck = checkAnnualLeaveReset(user.uid);
      
      if (resetCheck.isNewYear) {
        // Show new year notification with dynamic leave types
        const leaveTypeMessages = dynamicLeaveTypes.map(type => 
          `${type.label}: ${type.defaultQuota} days`
        ).join(', ');
        
        setSuccess(
          `🎉 Happy New Year ${resetCheck.currentYear}! Your leave balances have been reset: ${leaveTypeMessages}`
        );
        setTimeout(() => setSuccess(''), 8000);
        
        console.log('New year detected:', {
          previousYear: resetCheck.lastResetYear,
          currentYear: resetCheck.currentYear,
          leaveTypes: dynamicLeaveTypes
        });
      }
    }
  }, [user, dynamicLeaveTypes]);

  const handleFormChange = (e) => {
    setLeaveForm({
      ...leaveForm,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setLeaveForm({
      ...leaveForm,
      documents: e.target.files
    });
  };

  const calculateLeaveDays = () => {
    if (!leaveForm.startDate || !leaveForm.endDate) return 0;
    
    const start = new Date(leaveForm.startDate + 'T00:00:00');
    const end = new Date(leaveForm.endDate + 'T23:59:59');
    
    if (end < start) return 0;
    
    // Calculate business days (excluding weekends)
    let days = 0;
    let current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        days++;
      }
      current = addDays(current, 1);
    }
    
    console.log('Leave calculation:', {
      startDate: leaveForm.startDate,
      endDate: leaveForm.endDate,
      startParsed: start,
      endParsed: end,
      businessDays: days
    });
    
    return days;
  };

  const validateLeaveApplication = () => {
    const errors = [];
    
    if (!leaveForm.leaveType) errors.push('Please select leave type');
    if (!leaveForm.startDate) errors.push('Please select start date');
    if (!leaveForm.endDate) errors.push('Please select end date');
    if (!leaveForm.reason.trim()) errors.push('Please provide reason for leave');
    
    const startDate = new Date(leaveForm.startDate + 'T00:00:00');
    const endDate = new Date(leaveForm.endDate + 'T23:59:59');
    
    if (startDate < startOfDay(new Date())) {
      errors.push('Start date cannot be in the past');
    }
    
    if (endDate < startDate) {
      errors.push('End date must be after start date');
    }
    
    const leaveDays = calculateLeaveDays();
    const selectedLeaveType = leaveTypes.find(type => type.value === leaveForm.leaveType);
    const availableDays = selectedLeaveType?.balance.total - selectedLeaveType?.balance.used || 0;
    
    if (leaveDays > availableDays) {
      errors.push(`Insufficient leave balance. Available: ${availableDays} days`);
    }
    
    return errors;
  };

  const handleSubmitLeave = async () => {
    const validationErrors = validateLeaveApplication();
    
    if (validationErrors.length > 0) {
      setError(validationErrors.join('. '));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Debug: Check what company value we're using for leaves
      const resolvedCompany = user.originalCompanyName || user.company || 'RUBIX';
      console.log('🔍 Creating leave with company data:', {
        userOriginalCompanyName: user.originalCompanyName,
        userCompany: user.company,
        resolvedCompany: resolvedCompany,
        userProfile: { originalCompanyName: user.originalCompanyName, company: user.company }
      });
      console.log('🔍 LEAVE SAVE: Will save originalCompanyName =', resolvedCompany);

      // Find selected replacement team member details
      const selectedReplacement = teamMembers.find(member => member.id === leaveForm.replacementTeamMember);
      
      const branchName = getBranchName();
      console.log('🏢 Leave application - Branch info:', {
        userBranch: user?.branch,
        userBranchId: user?.branchId,
        userBranchName: user?.branchName,
        resolvedBranchName: branchName
      });

      const leaveApplication = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        department: user.department || 'General',
        originalCompanyName: resolvedCompany,
        branchName: branchName,
        leaveType: leaveForm.leaveType,
        startDate: new Date(leaveForm.startDate + 'T00:00:00'),
        endDate: new Date(leaveForm.endDate + 'T23:59:59'),
        totalDays: calculateLeaveDays(),
        reason: leaveForm.reason,
        emergencyContact: leaveForm.emergencyContact,
        replacementTeamMember: leaveForm.replacementTeamMember || null,
        replacementTeamMemberName: selectedReplacement ? `${selectedReplacement.firstName} ${selectedReplacement.lastName}` : null,
        replacementTeamMemberEmail: selectedReplacement ? selectedReplacement.email : null,
        status: 'pending',
        appliedDate: serverTimestamp()
      };

      console.log('Submitting leave application:', leaveApplication);
      
      const docRef = await addDoc(collection(db, 'leaves'), leaveApplication);
      console.log('Leave application submitted with ID:', docRef.id);

      // Skip user self-notification for submissions - they get success message instead

      try {
        // Create notification for admins about new leave request
        const adminNotification = {
          originalCompanyName: user.originalCompanyName || user.company || 'RUBIX',
          isAdminNotification: true, // Flag to identify admin notifications
          type: 'pending_approval',
          title: 'New Leave Request Requires Approval',
          message: `${user.firstName} ${user.lastName} applied for ${leaveForm.leaveType} leave (${leaveApplication.totalDays} days) from ${leaveForm.startDate} to ${leaveForm.endDate}${selectedReplacement ? `. Replacement: ${selectedReplacement.firstName} ${selectedReplacement.lastName}` : ''}`,
          priority: 'medium',
          read: false,
          createdAt: serverTimestamp(),
          leaveId: docRef.id,
          submittedBy: user.uid,
          userName: `${user.firstName} ${user.lastName}`,
          relatedData: {
            employeeName: `${user.firstName} ${user.lastName}`,
            employeeEmail: user.email,
            employeeDepartment: user.department || 'General',
            leaveType: leaveForm.leaveType,
            startDate: leaveForm.startDate,
            endDate: leaveForm.endDate,
            totalDays: leaveApplication.totalDays,
            reason: leaveForm.reason,
            emergencyContact: leaveForm.emergencyContact,
            replacementTeamMember: selectedReplacement ? selectedReplacement.id : null,
            replacementTeamMemberName: selectedReplacement ? `${selectedReplacement.firstName} ${selectedReplacement.lastName}` : null,
            replacementTeamMemberEmail: selectedReplacement ? selectedReplacement.email : null,
            appliedDate: new Date().toLocaleDateString(),
            status: 'pending'
          }
        };

        const adminNotifRef = await addDoc(collection(db, 'notifications'), adminNotification);
        console.log('✅ Admin notification created successfully for leave request:', {
          notificationId: adminNotifRef.id,
          title: adminNotification.title,
          type: adminNotification.type,
          employee: adminNotification.userName,
          leaveType: adminNotification.relatedData.leaveType,
          isAdminNotification: adminNotification.isAdminNotification,
          createdAt: 'serverTimestamp()'
        });
      } catch (adminNotifError) {
        console.error('Failed to create admin notification (non-blocking):', adminNotifError);
      }
      
      setSuccess('Leave application submitted successfully!');
      setApplyDialog(false);
      setLeaveForm({
        leaveType: '',
        startDate: '',
        endDate: '',
        reason: '',
        emergencyContact: '',
        documents: null,
        replacementTeamMember: ''
      });
      
      // Reload leaves and balance (non-blocking)
      try {
        await loadUserLeaves();
        console.log('User leaves reloaded successfully');
      } catch (reloadError) {
        console.error('Failed to reload leaves (non-blocking):', reloadError);
      }

      try {
        await loadLeaveBalance();
        console.log('Leave balance reloaded successfully');
      } catch (balanceError) {
        console.error('Failed to reload leave balance (non-blocking):', balanceError);
      }
      
      // Force re-render by updating a dummy state to ensure calendar refreshes
      setCurrentMonth(prev => new Date(prev));
      
      // Switch to calendar tab to show the newly applied leave
      setTimeout(() => {
        setTabValue(1); // Switch to Leave Calendar tab
      }, 1000);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to submit leave application: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave application?')) {
      return;
    }

    try {
      setError('');
      await updateDoc(doc(db, 'leaves', leaveId), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: user.uid
      });
      
      setSuccess('Leave application cancelled successfully');
      
      // Reload leaves and balance
      await loadUserLeaves();
      await loadLeaveBalance();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error cancelling leave:', error);
      setError('Failed to cancel leave application: ' + error.message);
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

  const isHoliday = (date) => {
    return publicHolidays.some(holiday => 
      isSameDay(new Date(holiday.date), new Date(date))
    );
  };

  const handleCalendarDayClick = (day, event) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const holiday = publicHolidays.find(h => h.date === dayStr);
    const dayLeaves = leaves.filter(leave => {
      try {
        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
        return day >= startDate && day <= endDate;
      } catch {
        return false;
      }
    });

    if (holiday || dayLeaves.length > 0) {
      const rect = event.currentTarget.getBoundingClientRect();
      setCalendarPopup({
        open: true,
        data: { day, holiday, leaves: dayLeaves },
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

  const TabPanel = ({ children, value, index }) => (
    <div role="tabpanel" hidden={value !== index} style={{ width: '100%' }}>
      {value === index && <Box sx={{ py: 3, width: '100%' }}>{children}</Box>}
    </div>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'secondary.main', 
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                mr: 2,
                boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)'
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
                  background: 'linear-gradient(45deg, #9c27b0, #e1bee7)',
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
                Manage your time off and view leave balance
              </Typography>
            </Box>
          </Box>
          <Fab 
            color="secondary" 
            variant="extended"
            onClick={() => setApplyDialog(true)}
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
              boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(156, 39, 176, 0.4)',
                transform: 'translateY(-1px)'
              }
            }}
          >
            <Add sx={{ mr: 1 }} />
            {isMobile ? 'Apply' : 'Apply Leave'}
          </Fab>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'secondary.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Enhanced Leave Balance Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {balanceLoading ? (
          // Skeleton loading for leave balance cards
          [1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="70%" height={28} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="90%" height={20} />
                    </Box>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Skeleton variant="text" width={60} height={20} />
                      <Skeleton variant="text" width={80} height={20} />
                    </Box>
                    <Skeleton variant="rectangular" width="100%" height={10} sx={{ borderRadius: 5, mb: 1 }} animation="wave" />
                    <Skeleton variant="text" width="50%" height={18} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          leaveTypes.map((leave, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid',
                borderColor: 'divider',
                background: theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, #1a1a1a 0%, ${theme.palette[leave.color]?.dark || '#0d0d1f'}40 100%)`
                  : `linear-gradient(135deg, #ffffff 0%, ${theme.palette[leave.color]?.light || '#f8f9ff'}20 100%)`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                  borderColor: `${leave.color}.light`
                }
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                  <Avatar 
                    sx={{ 
                      bgcolor: `${leave.color}.main`, 
                      mr: 2,
                      width: 48,
                      height: 48,
                      boxShadow: `0 4px 15px ${theme.palette[leave.color]?.main || '#1976d2'}30`
                    }}
                  >
                    <EventAvailable sx={{ fontSize: 24 }} />
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
                      {leave.label}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{ fontSize: '0.875rem' }}
                    >
                      {leave.description}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ fontWeight: 600 }}
                    >
                      Available
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 600,
                        color: leave.balance.total - leave.balance.used > 2 ? 'success.main' : 'warning.main'
                      }}
                    >
                      {leave.balance.total - leave.balance.used} / {leave.balance.total} days
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={(leave.balance.used / leave.balance.total) * 100}
                    sx={{ 
                      height: 10, 
                      borderRadius: 5,
                      bgcolor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        bgcolor: leave.balance.total - leave.balance.used > 2 ? 'success.main' : 'warning.main'
                      }
                    }}
                  />
                </Box>
                
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  Used: {leave.balance.used} days
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          ))
        )}
      </Grid>

      {/* Enhanced Tabs for Leave History and Calendar */}
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
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<History />} label="Leave History" />
          <Tab icon={<CalendarToday />} label="Leave Calendar" />
          <Tab icon={<Info />} label="Public Holidays" />
        </Tabs>

        {/* Leave History Tab */}
        <TabPanel value={tabValue} index={0}>
          {leavesLoading ? (
            // Skeleton loading for leaves list
            <List>
              {[1, 2, 3, 4, 5].map((item) => (
                <ListItem key={item} divider={item < 5}>
                  <ListItemIcon>
                    <Skeleton variant="circular" width={40} height={40} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Skeleton variant="text" width={120} height={24} />
                        <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Skeleton variant="text" width="70%" height={20} sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="90%" height={20} sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="50%" height={16} />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : leaves.length > 0 ? (
            <List>
              {leaves.map((leave, index) => (
                <ListItem key={leave.id} divider={index < leaves.length - 1}>
                  <ListItemIcon>
                    {getStatusIcon(leave.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {leaveTypes.find(type => type.value === leave.leaveType)?.label || leave.leaveType}
                        </Typography>
                        <Chip 
                          label={leave.status} 
                          color={getStatusColor(leave.status)}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {(() => {
                            try {
                              const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                              const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                              return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()} {' • '}{leave.totalDays} {leave.totalDays === 1 ? 'day' : 'days'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Reason: {leave.reason}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Applied: {(() => {
                            try {
                              const appliedDate = leave.appliedDate?.toDate ? leave.appliedDate.toDate() : new Date(leave.appliedDate);
                              return format(appliedDate, 'MMM dd, yyyy HH:mm');
                            } catch (error) {
                              return 'Invalid date';
                            }
                          })()}
                        </Typography>
                      </Box>
                    }
                  />
                  {leave.status === 'pending' && (
                    <Button 
                      size="small" 
                      color="error" 
                      variant="outlined"
                      onClick={() => handleCancelLeave(leave.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <EventBusy sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No leave applications yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Click "Apply Leave" to submit your first leave request
              </Typography>
            </Box>
          )}
        </TabPanel>

        {/* Leave Calendar Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3, px: { xs: 1, sm: 2 } }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 3,
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 0 }
            }}>
              <Typography variant="h6" sx={{ 
                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                fontWeight: 'bold',
                color: 'primary.main'
              }}>
                {format(currentMonth, 'MMMM yyyy')}
              </Typography>
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
                    fontWeight: 'medium',
                    '&:hover': {
                      backgroundColor: 'primary.50',
                      borderColor: 'primary.main'
                    }
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
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(25, 118, 210, 0.3)',
                    '&:hover': {
                      boxShadow: '0 4px 8px rgba(25, 118, 210, 0.4)'
                    }
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
                    fontWeight: 'medium',
                    '&:hover': {
                      backgroundColor: 'primary.50',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  Next →
                </Button>
              </Box>
            </Box>
            
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
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
                              // Show approved leaves and pending leaves (for user to see their applications)
                              return day >= startDate && day <= endDate && (leave.status === 'approved' || leave.status === 'pending');
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
                                height: { xs: 45, sm: 50 },
                                verticalAlign: 'top',
                                bgcolor: !isCurrentMonth ? 'grey.100' : 
                                         isToday(day) ? 'primary.50' : 
                                         (day.getDay() === 0 || day.getDay() === 6) ? 'grey.50' : 'white',
                                border: isToday(day) ? '2px solid' : '1px solid',
                                borderColor: isToday(day) ? 'primary.main' : 'divider',
                                cursor: (isHoliday || dayLeaves.length > 0) ? 'pointer' : 'default',
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
                                  {isHoliday && (
                                    <Chip 
                                      label="H" 
                                      size="small" 
                                      color="error" 
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
                                  {dayLeaves.length > 0 && (
                                    <Chip 
                                      label="L" 
                                      size="small" 
                                      color={dayLeaves.some(l => l.status === 'approved') ? 'success' : 'warning'}
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
            </TableContainer>
            
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
              <Chip label="Holiday (H)" color="error" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
              <Chip label="Approved (L)" color="success" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
              <Chip label="Pending (L)" color="warning" size="small" sx={{ fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' } }} />
            </Box>
          </Box>
        </TabPanel>

        {/* Public Holidays Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3, px: { xs: 1, sm: 2 } }}>
            {/* Malaysia Public Holidays Title with Background */}
            <Box sx={{ 
              p: 2, 
              backgroundColor: 'primary.50', 
              borderRadius: 2, 
              border: '1px solid rgba(25, 118, 210, 0.2)',
              mb: 2,
              textAlign: 'center'
            }}>
              <Typography variant="h6" gutterBottom sx={{ 
                fontWeight: 'bold', 
                color: 'primary.main',
                mb: 0
              }}>
                Malaysia Public Holidays 2025
              </Typography>
            </Box>
            
            {/* Quick Stats with Background Container */}
            <Box sx={{ 
              p: 2, 
              backgroundColor: 'grey.50', 
              borderRadius: 2, 
              border: '1px solid rgba(158, 158, 158, 0.2)',
              mb: 2
            }}>
              <Grid container spacing={1.5}>
                <Grid item xs={4} sm={4}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    backgroundColor: 'primary.50',
                    border: '1px solid rgba(25, 118, 210, 0.2)'
                  }}>
                    <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                      <Typography variant="h6" color="primary.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, fontWeight: 'bold' }}>
                        {publicHolidays.filter(h => h.type === 'National').length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, fontWeight: 'medium' }}>
                        National
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4} sm={4}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    backgroundColor: 'warning.50',
                    border: '1px solid rgba(245, 124, 0, 0.2)'
                  }}>
                    <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                      <Typography variant="h6" color="warning.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, fontWeight: 'bold' }}>
                        {publicHolidays.filter(h => h.type === 'State').length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, fontWeight: 'medium' }}>
                        State
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={4} sm={4}>
                  <Card variant="outlined" sx={{ 
                    borderRadius: 2,
                    backgroundColor: 'success.50',
                    border: '1px solid rgba(46, 125, 50, 0.2)'
                  }}>
                    <CardContent sx={{ textAlign: 'center', py: 1, px: 1 }}>
                      <Typography variant="h6" color="success.main" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, fontWeight: 'bold' }}>
                        {publicHolidays.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, fontWeight: 'medium' }}>
                        Total
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Holiday Type Legend */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                Holiday Types Legend
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'error.main', borderRadius: 0.5 }}></Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>National</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'secondary.main', borderRadius: 0.5 }}></Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Admin Added</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'info.main', borderRadius: 0.5 }}></Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>Company</Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, bgcolor: 'warning.main', borderRadius: 0.5 }}></Box>
                    <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>State</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>
            
            {/* Calendar View for Holidays */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 3,
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 2, sm: 0 }
              }}>
                <Typography variant="h6" sx={{ 
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                  fontWeight: 'bold',
                  color: 'primary.main',
                  textAlign: { xs: 'center', sm: 'left' }
                }}>
                  Holiday Calendar - {format(currentMonth, 'MMMM yyyy')}
                </Typography>
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
                      fontWeight: 'medium',
                      '&:hover': {
                        backgroundColor: 'primary.50',
                        borderColor: 'primary.main'
                      }
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
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(25, 118, 210, 0.3)',
                      '&:hover': {
                        boxShadow: '0 4px 8px rgba(25, 118, 210, 0.4)'
                      }
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
                      fontWeight: 'medium',
                      '&:hover': {
                        backgroundColor: 'primary.50',
                        borderColor: 'primary.main'
                      }
                    }}
                  >
                    Next →
                  </Button>
                </Box>
              </Box>
              
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
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
                            const holiday = publicHolidays.find(h => h.date === dayStr);
                            
                            return (
                              <TableCell 
                                key={day.toString()} 
                                align="center" 
                                onClick={(e) => handleCalendarDayClick(day, e)}
                                sx={{ 
                                  height: { xs: 50, sm: 65 },
                                  verticalAlign: 'top',
                                  bgcolor: !isCurrentMonth ? 'grey.100' : 
                                           isToday(day) ? 'primary.50' : 
                                           (day.getDay() === 0 || day.getDay() === 6) ? 'grey.50' :
                                           holiday ? (
                                             holiday.type === 'National' ? 'error.50' : 
                                             holiday.type === 'Admin Added' ? 'secondary.50' :
                                             holiday.type === 'Company' ? 'info.50' :
                                             holiday.type === 'Special' ? 'success.50' :
                                             'warning.50'
                                           ) : 'white',
                                  border: isToday(day) ? '2px solid' : '1px solid',
                                  borderColor: isToday(day) ? 'primary.main' : 'divider',
                                  cursor: holiday ? 'pointer' : 'default',
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
                                        fontWeight: isToday(day) || holiday || (day.getDay() === 0 || day.getDay() === 6) ? 'bold' : 'normal',
                                        fontSize: { xs: '0.65rem', sm: '0.75rem' }
                                      }}
                                    >
                                      {format(day, 'd')}
                                    </Typography>
                                    {(day.getDay() === 0 || day.getDay() === 6) && (
                                      <Typography variant="caption" sx={{ 
                                        fontSize: { xs: '0.45rem', sm: '0.5rem' },
                                        color: 'error.main',
                                        fontWeight: 'bold'
                                      }}>
                                        {day.getDay() === 0 ? 'SUN' : 'SAT'}
                                      </Typography>
                                    )}
                                  </Box>
                                  {holiday && (
                                    <Box sx={{ mt: { xs: 0.2, sm: 0.3 } }}>
                                      <Chip 
                                        label={
                                          holiday.type === 'National' ? 'Nat' : 
                                          holiday.type === 'Admin Added' ? 'Adm' :
                                          holiday.type === 'Company' ? 'Com' :
                                          holiday.type === 'Special' ? 'Spc' :
                                          'State'
                                        } 
                                        size="small" 
                                        color={
                                          holiday.type === 'National' ? 'error' : 
                                          holiday.type === 'Admin Added' ? 'secondary' :
                                          holiday.type === 'Company' ? 'info' :
                                          holiday.type === 'Special' ? 'success' :
                                          'warning'
                                        }
                                        sx={{ 
                                          height: { xs: 12, sm: 14 }, 
                                          fontSize: { xs: '0.45rem', sm: '0.5rem' },
                                          mb: { xs: 0.2, sm: 0.3 },
                                          minWidth: { xs: 22, sm: 26 },
                                          '& .MuiChip-label': {
                                            px: { xs: 0.2, sm: 0.3 }
                                          }
                                        }}
                                      />
                                      <Typography variant="caption" sx={{ 
                                        display: 'block', 
                                        fontSize: { xs: '0.45rem', sm: '0.55rem' },
                                        lineHeight: 1.1,
                                        px: 0.1,
                                        textAlign: 'center'
                                      }}>
                                        {holiday.name.length > (window.innerWidth < 600 ? 6 : 12) ? 
                                          holiday.name.substring(0, window.innerWidth < 600 ? 4 : 8) + '...' : 
                                          holiday.name
                                        }
                                      </Typography>
                                    </Box>
                                  )}
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
              </TableContainer>
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
        </TabPanel>
      </Paper>

      {/* Enhanced Apply Leave Dialog */}
      <Dialog 
        open={applyDialog} 
        onClose={() => setApplyDialog(false)}
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
            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
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
                Apply for Leave
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Submit your leave request for approval
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, bgcolor: 'grey.50' }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                name="leaveType"
                label="Leave Type"
                select
                fullWidth
                value={leaveForm.leaveType}
                onChange={handleFormChange}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: 'primary.main'
                    }
                  }
                }}
              >
                {leaveTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Available: {option.balance.total - option.balance.used} days
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Alert 
                severity="info" 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center',
                  borderRadius: 2,
                  bgcolor: 'info.50',
                  border: '1px solid',
                  borderColor: 'info.light'
                }}
              >
                <Typography variant="caption">
                  {calculateLeaveDays()} {calculateLeaveDays() === 1 ? 'day' : 'days'} selected
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                name="startDate"
                label="Start Date"
                type="date"
                fullWidth
                value={leaveForm.startDate}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: format(new Date(), 'yyyy-MM-dd') }}
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
                name="endDate"
                label="End Date"
                type="date"
                fullWidth
                value={leaveForm.endDate}
                onChange={handleFormChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: leaveForm.startDate || format(new Date(), 'yyyy-MM-dd') }}
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
                name="reason"
                label="Reason for Leave"
                multiline
                rows={3}
                fullWidth
                value={leaveForm.reason}
                onChange={handleFormChange}
                placeholder="Please provide details about your leave request..."
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
                name="emergencyContact"
                label="Emergency Contact (Optional)"
                fullWidth
                value={leaveForm.emergencyContact}
                onChange={handleFormChange}
                placeholder="Name and phone number for emergency contact"
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
                name="replacementTeamMember"
                label="Replacement Team Member (Optional)"
                select
                fullWidth
                value={leaveForm.replacementTeamMember}
                onChange={handleFormChange}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper',
                    '&:hover fieldset': {
                      borderColor: 'primary.main'
                    }
                  }
                }}
                helperText="Select a team member to cover your responsibilities during leave"
              >
                <MenuItem value="">
                  <em>No replacement selected</em>
                </MenuItem>
                {teamMembers.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                        {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">
                          {member.firstName} {member.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {member.department || 'General'} • {member.email}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12}>
              <TextField
                name="documents"
                label="Supporting Documents (Optional)"
                type="file"
                fullWidth
                onChange={handleFileChange}
                InputLabelProps={{ shrink: true }}
                inputProps={{ multiple: true, accept: '.pdf,.doc,.docx,.jpg,.png' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: 'background.paper'
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Supported formats: PDF, DOC, DOCX, JPG, PNG
              </Typography>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 4, bgcolor: 'grey.50', gap: 2 }}>
          <Button 
            onClick={() => setApplyDialog(false)}
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
            onClick={handleSubmitLeave}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
            size="large"
            sx={{
              py: 1.5,
              px: 4,
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
            {loading ? 'Submitting...' : 'Submit Application'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Glass Calendar Popup */}
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
            maxWidth: 450,
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
        <DialogTitle sx={{ 
          color: '#1a1a1a', 
          fontWeight: 'bold',
          textAlign: 'center',
          pb: 1,
          textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
        }}>
          {calendarPopup.data && format(calendarPopup.data.day, 'EEEE, MMMM dd, yyyy')}
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
                color={
                  calendarPopup.data.holiday.type === 'National' ? 'error' : 
                  calendarPopup.data.holiday.type === 'Admin Added' ? 'secondary' :
                  calendarPopup.data.holiday.type === 'Company' ? 'info' :
                  calendarPopup.data.holiday.type === 'Special' ? 'success' :
                  'warning'
                }
                size="small"
                sx={{ 
                  mb: 1,
                  fontWeight: 'bold',
                  '& .MuiChip-label': {
                    textShadow: 'none'
                  }
                }}
              />
              <Typography variant="h6" sx={{ 
                color: '#1a1a1a', 
                fontWeight: 'bold',
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
                mb: 0.5
              }}>
                {calendarPopup.data.holiday.name}
              </Typography>
              <Typography variant="body2" sx={{ 
                color: '#424242',
                fontWeight: 'medium',
                textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)',
                mb: calendarPopup.data.holiday.addedBy ? 0.5 : 0
              }}>
                {calendarPopup.data.holiday.type === 'National' ? 'National Public Holiday' : 
                 calendarPopup.data.holiday.type === 'Admin Added' ? 'Holiday Added by Admin' :
                 calendarPopup.data.holiday.type === 'Company' ? 'Company Holiday' :
                 calendarPopup.data.holiday.type === 'Special' ? 'Special Holiday' :
                 'State Holiday'}
              </Typography>
              {calendarPopup.data.holiday.addedBy && (
                <Typography variant="caption" sx={{ 
                  color: '#666',
                  fontStyle: 'italic',
                  textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)'
                }}>
                  Added by {calendarPopup.data.holiday.addedBy}
                </Typography>
              )}
            </Box>
          )}
          
          {calendarPopup.data?.leaves && calendarPopup.data.leaves.length > 0 && (
            <Box sx={{ 
              p: 2, 
              borderRadius: 2, 
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}>
              <Typography variant="subtitle1" sx={{ 
                color: '#1a1a1a', 
                fontWeight: 'bold', 
                mb: 1.5,
                textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)'
              }}>
                Your Leaves
              </Typography>
              {calendarPopup.data.leaves.map((leave, index) => (
                <Box key={index} sx={{ 
                  mb: 2, 
                  p: 1.5, 
                  borderRadius: 1.5,
                  background: 'rgba(255, 255, 255, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Chip 
                      label={leave.status} 
                      color={getStatusColor(leave.status)}
                      size="small"
                      sx={{
                        fontWeight: 'bold',
                        '& .MuiChip-label': {
                          textShadow: 'none'
                        }
                      }}
                    />
                    <Typography variant="body2" sx={{ 
                      color: '#1a1a1a', 
                      fontWeight: 'bold',
                      textShadow: '0 1px 1px rgba(255, 255, 255, 0.8)'
                    }}>
                      {leaveTypes.find(type => type.value === leave.leaveType)?.label || leave.leaveType}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ 
                    color: '#2e2e2e',
                    fontWeight: 'medium',
                    textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)',
                    mb: 0.5
                  }}>
                    {(() => {
                      try {
                        const startDate = leave.startDate?.toDate ? leave.startDate.toDate() : new Date(leave.startDate);
                        const endDate = leave.endDate?.toDate ? leave.endDate.toDate() : new Date(leave.endDate);
                        return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')} (${leave.totalDays} ${leave.totalDays === 1 ? 'day' : 'days'})`;
                      } catch (error) {
                        return 'Invalid date';
                      }
                    })()} 
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: '#424242',
                    fontWeight: 'medium',
                    textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)',
                    fontSize: '0.75rem'
                  }}>
                    Reason: {leave.reason}
                  </Typography>
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
              <Typography variant="body2" sx={{ 
                color: '#424242',
                fontWeight: 'medium',
                textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)'
              }}>
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
              textTransform: 'none',
              fontSize: '1rem',
              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1565c0, #0d47a1)',
                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.6)',
                transform: 'translateY(-1px)'
              },
              '&:active': {
                transform: 'translateY(0px)'
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Leaves;