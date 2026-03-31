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
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress
} from '@mui/material';
import { 
  Settings,
  Edit,
  Schedule,
  AccessTime,
  WbSunny,
  Nightlight,
  Info,
  Close,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function CompanyAdminSettings() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
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
    isActive: true
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
      console.log('🔍 Company Admin Settings useEffect - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        fullUserObject: user
      });
      
      const userCompany = user.originalCompanyName || user.company || 'RUBIX';
      setForm(prev => ({
        ...prev,
        company: userCompany
      }));
      
      loadCompanySettings();
    }
  }, [user]);

  const loadCompanySettings = async () => {
    setLoading(true);
    try {
      const userCompany = user.originalCompanyName || user.company || 'RUBIX';
      console.log('🔍 Company Admin loading settings for company:', userCompany);
      
      // Load settings for this specific company only
      const q = query(
        collection(db, 'companySettings'),
        where('company', '==', userCompany)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const settingDoc = querySnapshot.docs[0];
        const settingData = {
          id: settingDoc.id,
          ...settingDoc.data(),
          createdAt: settingDoc.data().createdAt?.toDate ? settingDoc.data().createdAt.toDate() : new Date(settingDoc.data().createdAt || Date.now())
        };
        setCompanySettings(settingData);
        console.log('🔍 Company settings loaded:', settingData);
      } else {
        setCompanySettings(null);
        console.log('🔍 No company settings found for:', userCompany);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
      setError('Failed to load company settings: ' + error.message);
    }
    setLoading(false);
  };

  const handleCreateSetting = async () => {
    if (!form.workStartTime || !form.workEndTime) {
      setError('Work start and end times are required');
      return;
    }

    try {
      const userCompany = user.originalCompanyName || user.company || 'RUBIX';
      
      const newSetting = {
        company: userCompany, // Always use company admin's company
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
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'companySettings'), newSetting);
      setSuccess('Company settings created successfully');
      setCreateDialog(false);
      await loadCompanySettings();
    } catch (error) {
      console.error('Error creating company settings:', error);
      setError('Failed to create company settings: ' + error.message);
    }
  };

  const handleUpdateSetting = async () => {
    if (!form.workStartTime || !form.workEndTime) {
      setError('Work start and end times are required');
      return;
    }

    if (!companySettings || !companySettings.id) {
      setError('No settings found to update');
      return;
    }

    try {
      const userCompany = user.originalCompanyName || user.company || 'RUBIX';
      
      const settingRef = doc(db, 'companySettings', companySettings.id);
      await updateDoc(settingRef, {
        company: userCompany, // Always use company admin's company
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
        updatedAt: serverTimestamp()
      });

      setSuccess('Company settings updated successfully');
      setEditDialog(false);
      await loadCompanySettings();
    } catch (error) {
      console.error('Error updating company settings:', error);
      setError('Failed to update company settings: ' + error.message);
    }
  };

  const handleEdit = () => {
    if (companySettings) {
      setForm({
        company: companySettings.company,
        workStartTime: companySettings.workStartTime,
        workEndTime: companySettings.workEndTime,
        lunchStartTime: companySettings.lunchStartTime,
        lunchEndTime: companySettings.lunchEndTime,
        workDays: companySettings.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        timezone: companySettings.timezone || 'Asia/Kuala_Lumpur',
        allowFlexibleHours: companySettings.allowFlexibleHours || false,
        flexibleHoursWindow: companySettings.flexibleHoursWindow || 30,
        overtimeRateMultiplier: companySettings.overtimeRateMultiplier || 1.5,
        isActive: companySettings.isActive !== false
      });
      setEditDialog(true);
    }
  };

  const handleCreate = () => {
    const userCompany = user.originalCompanyName || user.company || 'RUBIX';
    setForm(prev => ({
      ...prev,
      company: userCompany
    }));
    setCreateDialog(true);
  };

  const handleWorkDayChange = (day) => {
    const updatedDays = form.workDays.includes(day)
      ? form.workDays.filter(d => d !== day)
      : [...form.workDays, day];
    setForm({...form, workDays: updatedDays});
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

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading company settings...
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
              <Settings sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Configure work schedules and policies for {user.originalCompanyName || user.company || 'your company'}
              </Typography>
            </Box>
          </Box>
          
          {!companySettings && (
            <Button 
              variant="contained" 
              startIcon={<Settings />}
              onClick={handleCreate}
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
                }
              }}
            >
              {isMobile ? 'Create' : 'Create Settings'}
            </Button>
          )}
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

      {/* Company Settings Display */}
      {companySettings ? (
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
                Work Schedule Configuration
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
                Edit Settings
              </Button>
            </Box>

            <Grid container spacing={4}>
              {/* Work Hours Card */}
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
                        <AccessTime />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Work Hours
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'info.main', mb: 1 }}>
                      {companySettings.workStartTime} - {companySettings.workEndTime}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {calculateWorkHours(
                        companySettings.workStartTime, 
                        companySettings.workEndTime, 
                        companySettings.lunchStartTime, 
                        companySettings.lunchEndTime
                      )} hours per day
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Lunch Break Card */}
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
                        <Schedule />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Lunch Break
                      </Typography>
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main', mb: 1 }}>
                      {companySettings.lunchStartTime} - {companySettings.lunchEndTime}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {((new Date(`2000-01-01T${companySettings.lunchEndTime}:00`) - new Date(`2000-01-01T${companySettings.lunchStartTime}:00`)) / (1000 * 60))} minutes break
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Work Days Card */}
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
                      <Avatar sx={{ mr: 2, bgcolor: 'success.main' }}>
                        <WbSunny />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Work Days
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {weekDays
                        .filter(dayObj => companySettings.workDays?.includes(dayObj.value))
                        .map(dayObj => (
                        <Chip 
                          key={dayObj.value} 
                          label={dayObj.label} 
                          color="success" 
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Flexibility & Overtime Card */}
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
                      <Avatar sx={{ mr: 2, bgcolor: 'purple' }}>
                        <Schedule />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Flexibility
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Chip 
                        label={companySettings.allowFlexibleHours ? `±${companySettings.flexibleHoursWindow} min` : 'Fixed Schedule'}
                        color={companySettings.allowFlexibleHours ? 'info' : 'default'}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Overtime Rate: {companySettings.overtimeRateMultiplier}x
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Status & Timezone Card */}
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
                        <Info />
                      </Avatar>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Configuration
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Chip 
                        label={companySettings.isActive !== false ? 'Active' : 'Inactive'}
                        color={companySettings.isActive !== false ? 'success' : 'default'}
                        icon={companySettings.isActive !== false ? <CheckCircle /> : <Warning />}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Timezone: {companySettings.timezone}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Created/Updated Info */}
            {companySettings.createdByName && (
              <Box sx={{ mt: 4, p: 3, bgcolor: 'action.hover', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Created by {companySettings.createdByName} • {companySettings.createdAt && format(companySettings.createdAt, 'MMM dd, yyyy')}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      ) : (
        // No Settings Found
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
            <Settings sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            No Settings Configured
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400, mx: 'auto' }}>
            Set up work schedules, lunch breaks, and attendance policies for your company.
          </Typography>
          <Button 
            variant="contained" 
            size="large"
            startIcon={<Settings />}
            onClick={handleCreate}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 3,
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Create Company Settings
          </Button>
        </Paper>
      )}

      {/* Create Settings Dialog */}
      <Dialog 
        open={createDialog} 
        onClose={() => setCreateDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <Settings />
            </Avatar>
            Create Company Settings
          </Box>
          {isMobile && (
            <Button onClick={() => setCreateDialog(false)}>
              <Close />
            </Button>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Company"
                fullWidth
                value={form.company}
                disabled
                helperText="Company is automatically set based on your profile"
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
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSetting}>
            Create Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Settings Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => setEditDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <Edit />
            </Avatar>
            Edit Company Settings
          </Box>
          {isMobile && (
            <Button onClick={() => setEditDialog(false)}>
              <Close />
            </Button>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
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
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateSetting}>
            Update Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CompanyAdminSettings;