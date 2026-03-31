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
  CardActions,
  Chip,
  Avatar,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Fab,
  Pagination
} from '@mui/material';
import { 
  Add,
  Announcement,
  Edit,
  Delete,
  MoreVert,
  Public,
  Business,
  Group,
  Schedule,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function Announcements() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [form, setForm] = useState({
    title: '',
    content: '',
    visibility: 'all',
    company: '',
    department: '',
    isActive: true
  });

  useEffect(() => {
    if (user) {
      loadAnnouncements();
      loadAvailableCompanies();
    }
  }, [user]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      // Simple query without orderBy to avoid index requirement
      const q = query(collection(db, 'announcements'));
      
      const querySnapshot = await getDocs(q);
      const announcementsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      // Sort by createdAt on client side (most recent first)
      const sortedAnnouncements = announcementsList.sort((a, b) => {
        try {
          return b.createdAt - a.createdAt;
        } catch (error) {
          return 0;
        }
      });
      
      setAnnouncements(sortedAnnouncements);
    } catch (error) {
      console.error('Error loading announcements:', error);
      setError('Failed to load announcements: ' + error.message);
    }
    setLoading(false);
  };

  const loadAvailableCompanies = async () => {
    try {
      // Load companies from companySettings collection
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
      
      // Combine and deduplicate companies
      const allCompanies = [...new Set([...companies, ...userCompanies])].sort();
      setAvailableCompanies(allCompanies);
      
      console.log('Loaded companies for announcements:', allCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const createNotificationsForAnnouncement = async (announcement, announcementId) => {
    try {
      // Query users based on announcement visibility
      let usersQuery;
      if (announcement.visibility === 'all') {
        usersQuery = query(collection(db, 'users'));
      } else if (announcement.visibility === 'company') {
        usersQuery = query(collection(db, 'users'));
      } else if (announcement.visibility === 'department') {
        usersQuery = query(collection(db, 'users'));
      }

      const usersSnapshot = await getDocs(usersQuery);
      const notifications = [];

      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const userId = doc.id;
        
        // Skip admin users
        if (userData.role === 'admin') return;

        // Filter based on visibility
        let shouldNotify = false;
        if (announcement.visibility === 'all') {
          shouldNotify = true;
        } else if (announcement.visibility === 'company') {
          const userCompany = userData.originalCompanyName || userData.company || 'RUBIX';
          shouldNotify = userCompany.toUpperCase() === announcement.company.toUpperCase();
        } else if (announcement.visibility === 'department') {
          const userCompany = userData.originalCompanyName || userData.company || 'RUBIX';
          const companyMatch = userCompany.toUpperCase() === announcement.company.toUpperCase();
          const departmentMatch = userData.department === announcement.department;
          shouldNotify = companyMatch && departmentMatch;
        }

        if (shouldNotify) {
          notifications.push({
            userId,
            type: 'announcement',
            title: 'New Announcement',
            message: `${announcement.title}`,
            priority: 'normal',
            read: false,
            createdAt: serverTimestamp(),
            relatedData: {
              announcementId,
              announcementTitle: announcement.title,
              visibility: announcement.visibility,
              company: announcement.company,
              department: announcement.department || null
            }
          });
        }
      });

      // Batch create notifications
      if (notifications.length > 0) {
        const batch = writeBatch(db);
        notifications.forEach(notification => {
          const notificationRef = doc(collection(db, 'notifications'));
          batch.set(notificationRef, notification);
        });
        await batch.commit();
        console.log(`Created ${notifications.length} notifications for announcement`);
      }
    } catch (error) {
      console.error('Error creating notifications:', error);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required');
      return;
    }

    // Validate company selection for company/department visibility
    if (form.visibility !== 'all' && !form.company) {
      setError('Please select a company for company-specific announcements');
      return;
    }
    if (form.visibility === 'department' && !form.department) {
      setError('Please select a department for department-specific announcements');
      return;
    }

    try {
      const newAnnouncement = {
        title: form.title.trim(),
        content: form.content.trim(),
        priority: 'normal',
        visibility: form.visibility,
        isActive: form.isActive,
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Set company field based on visibility
      if (form.visibility === 'all') {
        newAnnouncement.company = 'ALL';
      } else {
        newAnnouncement.company = form.company;
        if (form.visibility === 'department') {
          newAnnouncement.department = form.department;
        }
      }

      // Create the announcement
      const announcementRef = await addDoc(collection(db, 'announcements'), newAnnouncement);
      console.log('Announcement created:', announcementRef.id);

      // Create notifications for affected users
      await createNotificationsForAnnouncement(newAnnouncement, announcementRef.id);

      setSuccess('Announcement created successfully and notifications sent to users');
      setCreateDialog(false);
      resetForm();
      await loadAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      setError('Failed to create announcement: ' + error.message);
    }
  };

  const handleUpdateAnnouncement = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (!editingAnnouncement || !editingAnnouncement.id) {
      setError('No announcement selected for update');
      return;
    }

    try {
      const announcementRef = doc(db, 'announcements', editingAnnouncement.id);
      await updateDoc(announcementRef, {
        title: form.title.trim(),
        content: form.content.trim(),
        priority: 'normal',
        visibility: form.visibility,
        isActive: form.isActive,
        updatedAt: serverTimestamp()
      });

      setSuccess('Announcement updated successfully');
      setEditDialog(false);
      resetForm();
      setEditingAnnouncement(null);
      await loadAnnouncements();
    } catch (error) {
      console.error('Error updating announcement:', error);
      setError('Failed to update announcement: ' + error.message);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteDoc(doc(db, 'announcements', announcementId));
        setSuccess('Announcement deleted successfully');
        await loadAnnouncements();
      } catch (error) {
        console.error('Error deleting announcement:', error);
        setError('Failed to delete announcement: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      content: '',
      visibility: 'all',
      company: '',
      department: '',
      isActive: true
    });
  };

  const handleMenuClick = (event, announcement) => {
    setAnchorEl(event.currentTarget);
    setSelectedAnnouncement(announcement);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedAnnouncement(null);
  };

  const handleEdit = () => {
    if (selectedAnnouncement) {
      setEditingAnnouncement(selectedAnnouncement);
      setForm({
        title: selectedAnnouncement.title,
        content: selectedAnnouncement.content,
        visibility: selectedAnnouncement.visibility,
        company: selectedAnnouncement.company || '',
        department: selectedAnnouncement.department || '',
        isActive: selectedAnnouncement.isActive
      });
      setEditDialog(true);
    }
    handleMenuClose();
  };

  const getVisibilityIcon = (visibility) => {
    switch(visibility) {
      case 'all': return <Public />;
      case 'company': return <Business />;
      case 'department': return <Group />;
      default: return <Public />;
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(announcements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentAnnouncements = announcements.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'info.main', 
                mr: 2,
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 15px rgba(2, 136, 209, 0.3)'
              }}
            >
              <Announcement sx={{ fontSize: { xs: 24, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #0288d1, #29b6f6)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                Announcements & Memos
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Create and manage company-wide announcements and memos
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
            {isMobile ? 'New' : 'Create Announcement'}
          </Fab>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'info.main',
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
                  <Announcement sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {announcements.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Announcements
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
                  <Visibility sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {announcements.filter(a => a.isActive).length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Active
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
                ? 'linear-gradient(135deg, #1a1a1a 0%, #1a1a1a 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                borderColor: 'grey.400'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'grey.600', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(117, 117, 117, 0.3)'
                }}>  
                  <VisibilityOff sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'grey.600'
                    }}
                  >
                    {announcements.filter(a => !a.isActive).length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Inactive
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Announcements List */}
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
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'info.main' }}>
              All Announcements
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, announcements.length)} of {announcements.length} announcements
            </Typography>
          </Box>

          {currentAnnouncements.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Announcement sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No announcements found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create your first announcement to get started.
              </Typography>
            </Box>
          ) : (
            <>
              <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
                {currentAnnouncements.map((announcement) => (
                  <Grid item xs={12} md={6} lg={4} key={announcement.id}>
                    <Card
                      sx={{
                        height: '100%',
                        borderRadius: 3,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                          borderColor: 'info.light'
                        }
                      }}
                    >
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Chip 
                            icon={getVisibilityIcon(announcement.visibility)}
                            label={announcement.visibility}
                            variant="outlined"
                            size="small"
                          />
                          <IconButton onClick={(e) => handleMenuClick(e, announcement)}>
                            <MoreVert />
                          </IconButton>
                        </Box>
                        
                        <Typography variant="h6" gutterBottom>
                          {announcement.title}
                        </Typography>
                        
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {announcement.content.length > 150 
                            ? announcement.content.substring(0, 150) + '...'
                            : announcement.content
                          }
                        </Typography>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            By {announcement.createdByName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {format(announcement.createdAt, 'dd/MM/yyyy')}
                          </Typography>
                        </Box>
                      </CardContent>
                      
                      <CardActions>
                        <Chip 
                          icon={announcement.isActive ? <Visibility /> : <VisibilityOff />}
                          label={announcement.isActive ? 'Active' : 'Inactive'}
                          color={announcement.isActive ? 'success' : 'default'}
                          size="small"
                        />
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </Paper>

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
            handleDeleteAnnouncement(selectedAnnouncement?.id);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Announcement Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Announcement</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Title"
                fullWidth
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Content"
                fullWidth
                multiline
                rows={4}
                value={form.content}
                onChange={(e) => setForm({...form, content: e.target.value})}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={form.visibility}
                  label="Visibility"
                  onChange={(e) => setForm({...form, visibility: e.target.value, company: '', department: ''})}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Public sx={{ mr: 1, color: 'primary.main' }} />
                      All Companies
                    </Box>
                  </MenuItem>
                  <MenuItem value="company">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Business sx={{ mr: 1, color: 'primary.main' }} />
                      Specific Company
                    </Box>
                  </MenuItem>
                  <MenuItem value="department">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Group sx={{ mr: 1, color: 'primary.main' }} />
                      Specific Department
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Company Selection - Show when visibility is company or department */}
            {(form.visibility === 'company' || form.visibility === 'department') && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={form.company}
                    label="Company"
                    onChange={(e) => setForm({...form, company: e.target.value, department: ''})}
                  >
                    {availableCompanies.map((company) => (
                      <MenuItem key={company} value={company}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Business sx={{ mr: 1, color: 'primary.main' }} />
                          {company}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Department Selection - Show when visibility is department */}
            {form.visibility === 'department' && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={form.department}
                    label="Department"
                    onChange={(e) => setForm({...form, department: e.target.value})}
                  >
                    <MenuItem value="Engineering">Engineering</MenuItem>
                    <MenuItem value="Sales">Sales</MenuItem>
                    <MenuItem value="Marketing">Marketing</MenuItem>
                    <MenuItem value="HR">HR</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Operations">Operations</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({...form, isActive: e.target.checked})}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAnnouncement}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Announcement Dialog */}
      <Dialog open={editDialog} onClose={() => {
        setEditDialog(false);
        setEditingAnnouncement(null);
        resetForm();
      }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Announcement</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                label="Title"
                fullWidth
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Content"
                fullWidth
                multiline
                rows={4}
                value={form.content}
                onChange={(e) => setForm({...form, content: e.target.value})}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Visibility</InputLabel>
                <Select
                  value={form.visibility}
                  label="Visibility"
                  onChange={(e) => setForm({...form, visibility: e.target.value, company: '', department: ''})}
                >
                  <MenuItem value="all">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Public sx={{ mr: 1, color: 'primary.main' }} />
                      All Companies
                    </Box>
                  </MenuItem>
                  <MenuItem value="company">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Business sx={{ mr: 1, color: 'primary.main' }} />
                      Specific Company
                    </Box>
                  </MenuItem>
                  <MenuItem value="department">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Group sx={{ mr: 1, color: 'primary.main' }} />
                      Specific Department
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Company Selection - Show when visibility is company or department */}
            {(form.visibility === 'company' || form.visibility === 'department') && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Company</InputLabel>
                  <Select
                    value={form.company}
                    label="Company"
                    onChange={(e) => setForm({...form, company: e.target.value, department: ''})}
                  >
                    {availableCompanies.map((company) => (
                      <MenuItem key={company} value={company}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Business sx={{ mr: 1, color: 'primary.main' }} />
                          {company}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Department Selection - Show when visibility is department */}
            {form.visibility === 'department' && (
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={form.department}
                    label="Department"
                    onChange={(e) => setForm({...form, department: e.target.value})}
                  >
                    <MenuItem value="Engineering">Engineering</MenuItem>
                    <MenuItem value="Sales">Sales</MenuItem>
                    <MenuItem value="Marketing">Marketing</MenuItem>
                    <MenuItem value="HR">HR</MenuItem>
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Operations">Operations</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm({...form, isActive: e.target.checked})}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialog(false);
            setEditingAnnouncement(null);
            resetForm();
          }}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateAnnouncement}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Announcements;