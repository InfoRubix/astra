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
  Switch,
  FormControlLabel,
  Fab,
  Autocomplete,
  Collapse
} from '@mui/material';
import { 
  Add,
  Business,
  Edit,
  Delete,
  MoreVert,
  Schedule,
  AccessTime,
  Settings,
  WbSunny,
  Nightlight,
  ExpandMore,
  ExpandLess,
  Info,
  Close
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function CompanySettings() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [companySettings, setCompanySettings] = useState([]);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    company: '',
    workStartTime: '09:00',
    workEndTime: '18:00',
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'Asia/Kuala_Lumpur',
    allowFlexibleHours: false,
    flexibleHoursWindow: 30, // minutes
    overtimeRateMultiplier: 1.5,
    isActive: true,
    // Notification settings
    enableNotifications: true,
    checkInReminderMinutes: 15, // minutes before workStartTime
    checkOutReminderMinutes: 10 // minutes before workEndTime
  });

  const weekDays = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  useEffect(() => {
    if (user) {
      loadCompanySettings();
      loadAvailableCompanies();
    }
  }, [user]);

  const loadCompanySettings = async () => {
    setLoading(true);
    try {
      // Simple query without orderBy to avoid index requirement
      const q = query(collection(db, 'companySettings'));
      
      const querySnapshot = await getDocs(q);
      const settingsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      // Sort by createdAt on client side (most recent first)
      const sortedSettings = settingsList.sort((a, b) => {
        try {
          return b.createdAt - a.createdAt;
        } catch (error) {
          return 0;
        }
      });
      
      setCompanySettings(sortedSettings);
    } catch (error) {
      console.error('Error loading company settings:', error);
      setError('Failed to load company settings: ' + error.message);
    }
    setLoading(false);
  };

  const loadAvailableCompanies = async () => {
    try {
      // Load companies from companySettings collection first (like Announcements.js)
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companies = companySettingsSnapshot.docs.map(doc => doc.data().company);
      
      // Also get companies from users collection as fallback
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const userCompanies = new Set();
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const company = userData.originalCompanyName || userData.company;
        if (company) userCompanies.add(company);
      });
      
      // Combine and deduplicate companies (same logic as Announcements.js)
      const allCompanies = [...new Set([...companies, ...userCompanies])].sort();
      setAvailableCompanies(allCompanies);
      
      console.log('Loaded companies for settings:', allCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleCreateSetting = async () => {
    if (!form.company.trim()) {
      setError('Company name is required');
      return;
    }

    // Validate time format
    if (!form.workStartTime || !form.workEndTime) {
      setError('Work start and end times are required');
      return;
    }

    try {
      // Check if company settings already exist
      const existingQuery = query(
        collection(db, 'companySettings'),
        where('company', '==', form.company)
      );
      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        setError('Settings for this company already exist. Please edit the existing settings.');
        return;
      }

      const newSetting = {
        company: form.company,
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime,
        lunchStartTime: form.lunchStartTime,
        lunchEndTime: form.lunchEndTime,
        workDays: form.workDays,
        timezone: form.timezone,
        allowFlexibleHours: form.allowFlexibleHours,
        flexibleHoursWindow: parseInt(form.flexibleHoursWindow),
        overtimeRateMultiplier: parseFloat(form.overtimeRateMultiplier),
        isActive: form.isActive,
        enableNotifications: form.enableNotifications,
        checkInReminderMinutes: parseInt(form.checkInReminderMinutes),
        checkOutReminderMinutes: parseInt(form.checkOutReminderMinutes),
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'companySettings'), newSetting);
      setSuccess('Company settings created successfully');
      setCreateDialog(false);
      resetForm();
      await loadCompanySettings();
    } catch (error) {
      console.error('Error creating company settings:', error);
      setError('Failed to create company settings: ' + error.message);
    }
  };

  const handleUpdateSetting = async () => {
    console.log('handleUpdateSetting called');
    console.log('selectedSetting:', selectedSetting);
    console.log('form:', form);
    
    if (!form.company.trim()) {
      setError('Company name is required');
      return;
    }

    if (!selectedSetting || !selectedSetting.id) {
      console.log('selectedSetting is null or has no id');
      setError('No setting selected for update');
      return;
    }

    try {
      console.log('Updating setting with id:', selectedSetting.id);
      const settingRef = doc(db, 'companySettings', selectedSetting.id);
      await updateDoc(settingRef, {
        company: form.company,
        workStartTime: form.workStartTime,
        workEndTime: form.workEndTime,
        lunchStartTime: form.lunchStartTime,
        lunchEndTime: form.lunchEndTime,
        workDays: form.workDays,
        timezone: form.timezone,
        allowFlexibleHours: form.allowFlexibleHours,
        flexibleHoursWindow: parseInt(form.flexibleHoursWindow),
        overtimeRateMultiplier: parseFloat(form.overtimeRateMultiplier),
        isActive: form.isActive,
        enableNotifications: form.enableNotifications,
        checkInReminderMinutes: parseInt(form.checkInReminderMinutes),
        checkOutReminderMinutes: parseInt(form.checkOutReminderMinutes),
        updatedAt: serverTimestamp()
      });

      setSuccess('Company settings updated successfully');
      setEditDialog(false);
      resetForm();
      setSelectedSetting(null);
      await loadCompanySettings();
    } catch (error) {
      console.error('Error updating company settings:', error);
      setError('Failed to update company settings: ' + error.message);
    }
  };

  const handleDeleteSetting = async (settingId) => {
    if (window.confirm('Are you sure you want to delete these company settings?')) {
      try {
        await deleteDoc(doc(db, 'companySettings', settingId));
        setSuccess('Company settings deleted successfully');
        await loadCompanySettings();
      } catch (error) {
        console.error('Error deleting company settings:', error);
        setError('Failed to delete company settings: ' + error.message);
      }
    }
  };

  const calculateReminderTime = (timeString, minutesBefore) => {
    if (!timeString) return 'N/A';
    try {
      const [hours, minutes] = timeString.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes - minutesBefore;
      const reminderHours = Math.floor(totalMinutes / 60);
      const reminderMinutes = totalMinutes % 60;
      return `${String(reminderHours).padStart(2, '0')}:${String(reminderMinutes).padStart(2, '0')}`;
    } catch (error) {
      return 'Invalid time';
    }
  };

  const resetForm = () => {
    setForm({
      company: '',
      workStartTime: '09:00',
      workEndTime: '18:00',
      lunchStartTime: '12:00',
      lunchEndTime: '13:00',
      workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timezone: 'Asia/Kuala_Lumpur',
      allowFlexibleHours: false,
      flexibleHoursWindow: 30,
      overtimeRateMultiplier: 1.5,
      isActive: true,
      enableNotifications: true,
      checkInReminderMinutes: 15,
      checkOutReminderMinutes: 10
    });
  };

  const handleMenuClick = (event, setting) => {
    setAnchorEl(event.currentTarget);
    setSelectedSetting(setting);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedSetting here - it's needed for edit/delete operations
  };

  const handleEdit = () => {
    console.log('Desktop handleEdit called, selectedSetting:', selectedSetting);
    if (selectedSetting) {
      setForm({
        company: selectedSetting.company,
        workStartTime: selectedSetting.workStartTime,
        workEndTime: selectedSetting.workEndTime,
        lunchStartTime: selectedSetting.lunchStartTime,
        lunchEndTime: selectedSetting.lunchEndTime,
        workDays: selectedSetting.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        timezone: selectedSetting.timezone || 'Asia/Kuala_Lumpur',
        allowFlexibleHours: selectedSetting.allowFlexibleHours || false,
        flexibleHoursWindow: selectedSetting.flexibleHoursWindow || 30,
        overtimeRateMultiplier: selectedSetting.overtimeRateMultiplier || 1.5,
        isActive: selectedSetting.isActive !== false,
        enableNotifications: selectedSetting.enableNotifications !== false,
        checkInReminderMinutes: selectedSetting.checkInReminderMinutes || 15,
        checkOutReminderMinutes: selectedSetting.checkOutReminderMinutes || 10
      });
      console.log('Opening edit dialog for desktop view');
      setEditDialog(true);
    }
    handleMenuClose();
  };

  const handleWorkDayChange = (day) => {
    const updatedDays = form.workDays.includes(day)
      ? form.workDays.filter(d => d !== day)
      : [...form.workDays, day];
    setForm({...form, workDays: updatedDays});
  };

  const handleCardExpand = (settingId) => {
    setExpandedCard(expandedCard === settingId ? null : settingId);
  };

  const calculateWorkHours = (startTime, endTime, lunchStart, lunchEnd) => {
    const start = new Date(`2000-01-01T${startTime}:00`);
    const end = new Date(`2000-01-01T${endTime}:00`);
    const lunchStartDate = new Date(`2000-01-01T${lunchStart}:00`);
    const lunchEndDate = new Date(`2000-01-01T${lunchEnd}:00`);
    
    const totalMinutes = (end - start) / (1000 * 60);
    const lunchMinutes = (lunchEndDate - lunchStartDate) / (1000 * 60);
    
    return ((totalMinutes - lunchMinutes) / 60).toFixed(1);
  };

  // Calculate statistics
  const totalCompanies = companySettings.length;
  const activeSettings = companySettings.filter(s => s.isActive !== false).length;
  const flexibleCompanies = companySettings.filter(s => s.allowFlexibleHours).length;
  const averageWorkHours = companySettings.length > 0 ? 
    (companySettings.reduce((sum, s) => sum + parseFloat(calculateWorkHours(s.workStartTime, s.workEndTime, s.lunchStartTime, s.lunchEndTime)), 0) / companySettings.length).toFixed(1) : 0;

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
                boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
              }}
            >
              <Settings sx={{ fontSize: { xs: 24, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #ff9800, #ffb74d)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                Company Settings
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Configure work schedules and attendance policies for each company
              </Typography>
            </Box>
          </Box>
          <Fab 
            color="primary" 
            variant="extended"
            onClick={() => setCreateDialog(true)}
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
            {isMobile ? 'Add' : 'Add Company Settings'}
          </Fab>
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
                  <Business sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {totalCompanies}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Companies
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
                  <Settings sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {activeSettings}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Active Settings
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
                  <Schedule sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {flexibleCompanies}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Flexible Hours
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
                  <AccessTime sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {averageWorkHours}h
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Avg Work Hours
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Company Settings - Mobile Cards / Desktop Table */}
      {isMobile ? (
        /* Mobile: Card Layout with Expandable Details */
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              px: 1
            }}
          >
            Company Work Schedule Settings
          </Typography>
          
          {companySettings.map((setting) => (
            <Card
              key={setting.id}
              sx={{
                borderRadius: 3,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <CardContent sx={{ p: 0 }}>
                {/* Main Card Header - Always Visible */}
                <Box
                  sx={{
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => handleCardExpand(setting.id)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 48, height: 48 }}>
                      <Business sx={{ fontSize: 24 }} />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {setting.company}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {setting.workStartTime} - {setting.workEndTime} • {setting.timezone}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Chip 
                          label={setting.isActive !== false ? 'Active' : 'Inactive'}
                          color={setting.isActive !== false ? 'success' : 'default'}
                          size="small"
                        />
                        <Chip 
                          label={setting.allowFlexibleHours ? `±${setting.flexibleHoursWindow}min` : 'Fixed'}
                          color={setting.allowFlexibleHours ? 'info' : 'default'}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </Box>
                  <IconButton>
                    {expandedCard === setting.id ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>

                {/* Expandable Details */}
                <Collapse in={expandedCard === setting.id} timeout="auto" unmountOnExit>
                  <Divider />
                  <Box sx={{ p: 3, bgcolor: 'background.paper' }}>
                    
                    {/* Detailed Information Grid */}
                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center' }}>
                          <Info sx={{ mr: 1, fontSize: 20 }} />
                          Schedule Details
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            WORK HOURS
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {setting.workStartTime} - {setting.workEndTime}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {calculateWorkHours(setting.workStartTime, setting.workEndTime, setting.lunchStartTime, setting.lunchEndTime)} hours/day
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            LUNCH BREAK
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {setting.lunchStartTime} - {setting.lunchEndTime}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                            WORK DAYS
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {setting.workDays?.map(day => (
                              <Chip 
                                key={day} 
                                label={day.charAt(0).toUpperCase() + day.slice(1)} 
                                size="small" 
                                variant="outlined"
                                color="primary"
                              />
                            ))}
                          </Box>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            OVERTIME RATE
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {setting.overtimeRateMultiplier}x
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            TIMEZONE
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {setting.timezone}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    
                    {/* Action Buttons */}
                    <Divider sx={{ my: 3 }} />
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<Edit />}
                        onClick={() => {
                          console.log('Mobile edit button clicked for setting:', setting);
                          // Set selected setting first, then form data
                          setSelectedSetting(setting);
                          setForm({
                            company: setting.company,
                            workStartTime: setting.workStartTime,
                            workEndTime: setting.workEndTime,
                            lunchStartTime: setting.lunchStartTime,
                            lunchEndTime: setting.lunchEndTime,
                            workDays: setting.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            timezone: setting.timezone || 'Asia/Kuala_Lumpur',
                            allowFlexibleHours: setting.allowFlexibleHours || false,
                            flexibleHoursWindow: setting.flexibleHoursWindow || 30,
                            overtimeRateMultiplier: setting.overtimeRateMultiplier || 1.5,
                            isActive: setting.isActive !== false
                          });
                          console.log('About to open edit dialog');
                          setEditDialog(true);
                        }}
                        sx={{
                          flex: 1,
                          py: 1.5,
                          fontWeight: 600,
                          borderRadius: 2,
                          textTransform: 'none'
                        }}
                      >
                        Edit Settings
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Delete />}
                        onClick={() => handleDeleteSetting(setting.id)}
                        sx={{
                          flex: 1,
                          py: 1.5,
                          fontWeight: 600,
                          borderRadius: 2,
                          textTransform: 'none'
                        }}
                      >
                        Delete
                      </Button>
                    </Box>
                    
                    {/* Created/Updated Info */}
                    {setting.createdByName && (
                      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Created by {setting.createdByName} • {setting.createdAt && format(setting.createdAt, 'MMM dd, yyyy')}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      ) : (
        /* Desktop: Original Table Layout */
        <Paper
          sx={{
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: 'text.primary'
              }}
            >
              Company Work Schedule Settings
            </Typography>
          </Box>
          <Divider />
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Company</TableCell>
                  <TableCell>Work Hours</TableCell>
                  <TableCell>Lunch Break</TableCell>
                  <TableCell>Work Days</TableCell>
                  <TableCell>Flexible Hours</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {companySettings.map((setting) => (
                  <TableRow key={setting.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                          <Business />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {setting.company}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {setting.timezone}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body2">
                          {setting.workStartTime} - {setting.workEndTime}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {calculateWorkHours(setting.workStartTime, setting.workEndTime, setting.lunchStartTime, setting.lunchEndTime)} hours/day
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {setting.lunchStartTime} - {setting.lunchEndTime}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {setting.workDays?.slice(0, 3).map(day => (
                          <Chip 
                            key={day} 
                            label={day.substring(0, 3).toUpperCase()} 
                            size="small" 
                            variant="outlined"
                          />
                        ))}
                        {setting.workDays?.length > 3 && (
                          <Chip 
                            label={`+${setting.workDays.length - 3}`} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={setting.allowFlexibleHours ? `±${setting.flexibleHoursWindow}min` : 'Fixed'}
                        color={setting.allowFlexibleHours ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={setting.isActive !== false ? 'Active' : 'Inactive'}
                        color={setting.isActive !== false ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuClick(e, setting)}>
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
        <MenuItem 
          onClick={() => {
            handleDeleteSetting(selectedSetting?.id);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Company Settings Dialog */}
      <Dialog 
        open={createDialog} 
        onClose={() => setCreateDialog(false)} 
        maxWidth={isMobile ? "xs" : "sm"} 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 1,
            maxHeight: isMobile ? '100vh' : '85vh',
            maxWidth: isMobile ? '100vw' : '600px'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <Add />
            </Avatar>
            <Typography variant={isMobile ? "h6" : "h5"} component="div" sx={{ fontWeight: 600 }}>
              Create Company Settings
            </Typography>
          </Box>
          {isMobile && (
            <IconButton edge="end" onClick={() => setCreateDialog(false)}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent 
          sx={{ 
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#c1c1c1',
              borderRadius: '4px',
            },
          }}
        >
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                fullWidth
                freeSolo
                options={availableCompanies}
                value={form.company}
                onChange={(event, newValue) => {
                  setForm({...form, company: newValue || ''});
                }}
                onInputChange={(event, newInputValue) => {
                  setForm({...form, company: newInputValue});
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Company *"
                    required
                    helperText="Select existing company or type new name"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Avatar sx={{ mr: 2, bgcolor: 'primary.main', width: 32, height: 32 }}>
                        <Business sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {option}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                startIcon={<Add />}
                onClick={() => {
                  window.open('/admin/company-profile', '_blank');
                }}
                sx={{
                  mt: 1,
                  textTransform: 'none',
                  borderRadius: 2,
                  '&:hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px rgba(25, 118, 210, 0.2)'
                  }
                }}
              >
                Add New Company Profile
              </Button>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={form.timezone}
                  label="Timezone"
                  onChange={(e) => setForm({...form, timezone: e.target.value})}
                >
                  <MenuItem value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur</MenuItem>
                  <MenuItem value="Asia/Singapore">Asia/Singapore</MenuItem>
                  <MenuItem value="Asia/Jakarta">Asia/Jakarta</MenuItem>
                  <MenuItem value="Asia/Bangkok">Asia/Bangkok</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Work Start Time"
                type="time"
                fullWidth
                value={form.workStartTime}
                onChange={(e) => setForm({...form, workStartTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Work End Time"
                type="time"
                fullWidth
                value={form.workEndTime}
                onChange={(e) => setForm({...form, workEndTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lunch Start Time"
                type="time"
                fullWidth
                value={form.lunchStartTime}
                onChange={(e) => setForm({...form, lunchStartTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lunch End Time"
                type="time"
                fullWidth
                value={form.lunchEndTime}
                onChange={(e) => setForm({...form, lunchEndTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Work Days
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {weekDays.map(day => (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Switch
                        checked={form.workDays.includes(day.value)}
                        onChange={() => handleWorkDayChange(day.value)}
                      />
                    }
                    label={day.label}
                  />
                ))}
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.allowFlexibleHours}
                    onChange={(e) => setForm({...form, allowFlexibleHours: e.target.checked})}
                  />
                }
                label="Allow Flexible Hours"
              />
            </Grid>
            
            {form.allowFlexibleHours && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Flexible Hours Window (minutes)"
                  type="number"
                  fullWidth
                  value={form.flexibleHoursWindow}
                  onChange={(e) => setForm({...form, flexibleHoursWindow: e.target.value})}
                  inputProps={{ min: 0, max: 120 }}
                  helperText="±minutes employees can arrive early/late"
                />
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime Rate Multiplier"
                type="number"
                fullWidth
                value={form.overtimeRateMultiplier}
                onChange={(e) => setForm({...form, overtimeRateMultiplier: e.target.value})}
                inputProps={{ min: 1, step: 0.1 }}
                helperText="e.g., 1.5 = 150% of regular rate"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({...form, isActive: e.target.checked})}
                  />
                }
                label="Active Setting"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            gap: { xs: 1, sm: 1.5 },
            flexDirection: { xs: 'column', sm: 'row' },
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Button 
            onClick={() => setCreateDialog(false)}
            fullWidth={isMobile}
            sx={{
              py: { xs: 1.5, sm: 1 },
              order: { xs: 2, sm: 1 },
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSetting}
            fullWidth={isMobile}
            sx={{
              py: { xs: 1.5, sm: 1 },
              order: { xs: 1, sm: 2 },
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Create Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Company Settings Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => {
          setEditDialog(false);
          // Don't clear selectedSetting here - only clear after successful update or explicit cancel
        }} 
        maxWidth={isMobile ? "xs" : "sm"} 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 3,
            m: isMobile ? 0 : 1,
            maxHeight: isMobile ? '100vh' : '85vh',
            maxWidth: isMobile ? '100vw' : '600px'
          }
        }}
      >
        <DialogTitle 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <Edit />
            </Avatar>
            <Typography variant={isMobile ? "h6" : "h5"} component="div" sx={{ fontWeight: 600 }}>
              Edit Company Settings
            </Typography>
          </Box>
          {isMobile && (
            <IconButton edge="end" onClick={() => {
              setEditDialog(false);
              resetForm();
              setSelectedSetting(null);
            }}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent 
          sx={{ 
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#c1c1c1',
              borderRadius: '4px',
            },
          }}
        >
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Company"
                fullWidth
                value={form.company}
                disabled
                helperText="Company cannot be changed"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={form.timezone}
                  label="Timezone"
                  onChange={(e) => setForm({...form, timezone: e.target.value})}
                >
                  <MenuItem value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur</MenuItem>
                  <MenuItem value="Asia/Singapore">Asia/Singapore</MenuItem>
                  <MenuItem value="Asia/Jakarta">Asia/Jakarta</MenuItem>
                  <MenuItem value="Asia/Bangkok">Asia/Bangkok</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Work Start Time"
                type="time"
                fullWidth
                value={form.workStartTime}
                onChange={(e) => setForm({...form, workStartTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Work End Time"
                type="time"
                fullWidth
                value={form.workEndTime}
                onChange={(e) => setForm({...form, workEndTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lunch Start Time"
                type="time"
                fullWidth
                value={form.lunchStartTime}
                onChange={(e) => setForm({...form, lunchStartTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Lunch End Time"
                type="time"
                fullWidth
                value={form.lunchEndTime}
                onChange={(e) => setForm({...form, lunchEndTime: e.target.value})}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Work Days
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {weekDays.map(day => (
                  <FormControlLabel
                    key={day.value}
                    control={
                      <Switch
                        checked={form.workDays.includes(day.value)}
                        onChange={() => handleWorkDayChange(day.value)}
                      />
                    }
                    label={day.label}
                  />
                ))}
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.allowFlexibleHours}
                    onChange={(e) => setForm({...form, allowFlexibleHours: e.target.checked})}
                  />
                }
                label="Allow Flexible Hours"
              />
            </Grid>
            
            {form.allowFlexibleHours && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Flexible Hours Window (minutes)"
                  type="number"
                  fullWidth
                  value={form.flexibleHoursWindow}
                  onChange={(e) => setForm({...form, flexibleHoursWindow: e.target.value})}
                  inputProps={{ min: 0, max: 120 }}
                  helperText="±minutes employees can arrive early/late"
                />
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime Rate Multiplier"
                type="number"
                fullWidth
                value={form.overtimeRateMultiplier}
                onChange={(e) => setForm({...form, overtimeRateMultiplier: e.target.value})}
                inputProps={{ min: 1, step: 0.1 }}
                helperText="e.g., 1.5 = 150% of regular rate"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({...form, isActive: e.target.checked})}
                  />
                }
                label="Active Setting"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: { xs: 1.5, sm: 2 },
            gap: { xs: 1, sm: 1.5 },
            flexDirection: { xs: 'column', sm: 'row' },
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper'
          }}
        >
          <Button 
            onClick={() => {
              setEditDialog(false);
              resetForm();
              setSelectedSetting(null);
            }}
            fullWidth={isMobile}
            sx={{
              py: { xs: 1.5, sm: 1 },
              order: { xs: 2, sm: 1 },
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdateSetting}
            fullWidth={isMobile}
            sx={{
              py: { xs: 1.5, sm: 1 },
              order: { xs: 1, sm: 2 },
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Update Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompanySettings;