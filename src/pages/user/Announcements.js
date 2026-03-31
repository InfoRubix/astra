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
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  Divider,
  Alert,
  Pagination,
  Skeleton
} from '@mui/material';
import { 
  Announcement,
  Public,
  Business,
  Group,
  Schedule,
  Visibility,
  PriorityHigh,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function UserAnnouncements() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    if (user) {
      loadAnnouncements();
    }
  }, [user]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      console.log('🔍 User Announcements - User object:', {
        uid: user.uid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        company: user.company,
        originalCompanyName: user.originalCompanyName,
        department: user.department,
        fullUserObject: user
      });

      // Simple query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'announcements'),
        where('isActive', '==', true)
      );
      
      // Helper function to get company consistently (same pattern as other components)
      const getUserCompany = () => {
        return user.originalCompanyName || user.company || 'RUBIX';
      };
      
      const getAnnouncementCompany = (announcement) => {
        return announcement.company || announcement.originalCompanyName || 'RUBIX';
      };
      
      // Normalize company names for comparison (handle case sensitivity and whitespace)
      const normalizeCompany = (companyName) => {
        return companyName ? companyName.toString().trim().toUpperCase() : 'RUBIX';
      };

      const querySnapshot = await getDocs(q);
      const announcementsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      const userCompany = getUserCompany();
      console.log('🔍 All announcements loaded:', announcementsList.length);
      console.log('🔍 Current user company:', userCompany);
      console.log('🔍 Current user full info:', {
        originalCompanyName: user.originalCompanyName,
        company: user.company,
        department: user.department,
        email: user.email
      });
      
      announcementsList.forEach((announcement, index) => {
        const announcementCompany = getAnnouncementCompany(announcement);
        const shouldShow = announcement.visibility === 'all' || 
                          (announcement.visibility === 'company' && normalizeCompany(announcementCompany) === normalizeCompany(userCompany));
        console.log(`📢 Announcement ${index + 1}:`, {
          id: announcement.id,
          title: announcement.title,
          visibility: announcement.visibility,
          company: announcement.company,
          originalCompanyName: announcement.originalCompanyName,
          department: announcement.department,
          isActive: announcement.isActive,
          announcementCompany,
          userCompany,
          shouldShow
        });
      });

      // Filter announcements based on visibility rules
      const filteredAnnouncements = announcementsList.filter(announcement => {
        const userCompany = getUserCompany();
        const announcementCompany = getAnnouncementCompany(announcement);
        const userCompanyNorm = normalizeCompany(userCompany);
        const announcementCompanyNorm = normalizeCompany(announcementCompany);
        
        // Handle new visibility system
        if (announcement.visibility === 'all') {
          console.log('✅ All visibility - showing to everyone');
          return true;
        } else if (announcement.visibility === 'company') {
          const match = userCompanyNorm === announcementCompanyNorm;
          console.log('🏢 Company filtering:', { 
            userCompany, 
            announcementCompany, 
            userCompanyNorm, 
            announcementCompanyNorm, 
            match 
          });
          return match;
        } else if (announcement.visibility === 'department') {
          const companyMatch = userCompanyNorm === announcementCompanyNorm;
          const departmentMatch = user.department === announcement.department;
          console.log('🏬 Department filtering:', { 
            userCompany, 
            announcementCompany, 
            userCompanyNorm, 
            announcementCompanyNorm, 
            userDept: user.department, 
            announcementDept: announcement.department, 
            companyMatch, 
            departmentMatch 
          });
          return companyMatch && departmentMatch;
        } 
        // Handle backward compatibility - old system used company names as visibility values
        else {
          const visibilityAsCompany = normalizeCompany(announcement.visibility);
          const isOldSystemCompanyMatch = userCompanyNorm === visibilityAsCompany;
          console.log('🔄 Backward compatibility check:', {
            visibility: announcement.visibility,
            visibilityAsCompany,
            userCompanyNorm,
            isOldSystemCompanyMatch
          });
          return isOldSystemCompanyMatch;
        }
      });
      
      // Sort by createdAt on client side (most recent first)
      const sortedAnnouncements = filteredAnnouncements.sort((a, b) => {
        try {
          return b.createdAt - a.createdAt;
        } catch (error) {
          return 0;
        }
      });
      
      console.log('🔍 Final filtered announcements:', sortedAnnouncements.length, 'out of', announcementsList.length, 'total');
      console.log('🔍 User company:', getUserCompany());
      console.log('🔍 Announcements breakdown:');
      console.log('  - All visibility:', announcementsList.filter(a => a.visibility === 'all').length);
      console.log('  - Company visibility:', announcementsList.filter(a => a.visibility === 'company').length);
      console.log('  - Department visibility:', announcementsList.filter(a => a.visibility === 'department').length);
      console.log('  - Old system (company as visibility):', announcementsList.filter(a => !['all', 'company', 'department'].includes(a.visibility)).length);
      
      setAnnouncements(sortedAnnouncements);
    } catch (error) {
      console.error('Error loading announcements:', error);
      setError('Failed to load announcements: ' + error.message);
    }
    setLoading(false);
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'normal': return 'primary';
      default: return 'primary';
    }
  };

  const getVisibilityIcon = (visibility) => {
    switch(visibility) {
      case 'all': return <Public />;
      case 'company': return <Business />;
      case 'department': return <Group />;
      default: return <Public />;
    }
  };

  const getVisibilityLabel = (visibility) => {
    switch(visibility) {
      case 'all': return 'All Companies';
      case 'company': return 'Company Only';
      case 'department': return 'Department Only';
      default: return visibility;
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(announcements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentAnnouncements = announcements.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (event, value) => {
    setCurrentPage(value);
  };

  // Summary stats
  const totalAnnouncements = announcements.length;
  const companySpecific = announcements.filter(a => a.visibility === 'company').length;
  const recentAnnouncements = announcements.filter(a => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return a.createdAt >= weekAgo;
  }).length;

  const handleViewDetails = (announcement) => {
    setSelectedAnnouncement(announcement);
    setDetailDialog(true);
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Skeleton variant="circular" width={56} height={56} sx={{ mr: 2 }} />
              <Box>
                <Skeleton variant="text" width={300} height={45} sx={{ mb: 0.5 }} />
                <Skeleton variant="text" width={400} height={25} />
              </Box>
            </Box>
          </Box>
          <Skeleton variant="rectangular" width={60} height={4} sx={{ borderRadius: 2 }} />
        </Box>

        {/* Announcements Grid Skeleton */}
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
              <Skeleton variant="text" width={250} height={30} />
              <Skeleton variant="text" width={200} height={20} />
            </Box>

            <Grid container spacing={3}>
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Grid item xs={12} md={6} lg={4} key={item}>
                  <Card
                    elevation={2}
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider'
                    }}
                  >
                    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Skeleton variant="rectangular" width={120} height={24} sx={{ borderRadius: 12 }} />
                      </Box>

                      {/* Title */}
                      <Skeleton variant="text" width="90%" height={32} sx={{ mb: 1 }} />

                      {/* Content */}
                      <Box sx={{ flexGrow: 1 }}>
                        <Skeleton variant="text" width="100%" height={20} />
                        <Skeleton variant="text" width="95%" height={20} />
                        <Skeleton variant="text" width="85%" height={20} />
                        <Skeleton variant="text" width="70%" height={20} />
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      {/* Footer */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Skeleton variant="text" width={100} height={16} />
                          <Skeleton variant="text" width={80} height={16} />
                        </Box>
                        <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 12 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Pagination Skeleton */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Skeleton variant="rectangular" width={300} height={40} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
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
                Company Announcements
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Stay updated with the latest company news and announcements
              </Typography>
            </Box>
          </Box>
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
              Company Announcements
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, totalAnnouncements)} of {totalAnnouncements} announcements
            </Typography>
          </Box>

          {currentAnnouncements.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Announcement sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No announcements found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                There are no active announcements at the moment.
              </Typography>
            </Box>
          ) : (
            <>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {currentAnnouncements.map((announcement) => (
                  <Grid item xs={12} md={6} lg={4} key={announcement.id}>
                    <Card 
                      elevation={2}
                      sx={{ 
                        height: '100%',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          elevation: 4,
                          transform: 'translateY(-2px)'
                        }
                      }}
                      onClick={() => handleViewDetails(announcement)}
                    >
                      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Header with visibility */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Chip 
                            icon={getVisibilityIcon(announcement.visibility)}
                            label={getVisibilityLabel(announcement.visibility)}
                            variant="outlined"
                            size="small"
                          />
                        </Box>
                        
                        {/* Title */}
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                          {announcement.title}
                        </Typography>
                        
                        {/* Content */}
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          paragraph 
                          sx={{ 
                            flexGrow: 1,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            '-webkit-line-clamp': 4,
                            '-webkit-box-orient': 'vertical',
                          }}
                        >
                          {announcement.content}
                        </Typography>
                        
                        <Divider sx={{ my: 2 }} />
                        
                        {/* Footer */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              By {announcement.createdByName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {format(announcement.createdAt, 'dd/MM/yyyy')}
                            </Typography>
                          </Box>
                          <Chip 
                            icon={<Visibility />}
                            label="Active"
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
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

      {/* Announcement Detail Dialog */}
      <Dialog 
        open={detailDialog} 
        onClose={() => setDetailDialog(false)} 
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
        {selectedAnnouncement && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Announcement sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">{selectedAnnouncement.title}</Typography>
                </Box>
                <Chip 
                  icon={getVisibilityIcon(selectedAnnouncement.visibility)}
                  label={getVisibilityLabel(selectedAnnouncement.visibility)}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Typography variant="body1" paragraph sx={{ whiteSpace: 'pre-line' }}>
                  {selectedAnnouncement.content}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 3 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Posted By
                    </Typography>
                    <Typography variant="body2">
                      {selectedAnnouncement.createdByName}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Date Posted
                    </Typography>
                    <Typography variant="body2">
                      {format(selectedAnnouncement.createdAt, 'dd/MM/yyyy')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {format(selectedAnnouncement.createdAt, 'h:mm a')}
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      Visibility
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getVisibilityIcon(selectedAnnouncement.visibility)}
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {getVisibilityLabel(selectedAnnouncement.visibility)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setDetailDialog(false)} variant="contained">
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default UserAnnouncements;