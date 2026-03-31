import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Avatar,
  Skeleton
} from '@mui/material';
import {
  Notifications
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import NotificationSettings from '../../components/user/NotificationSettings';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

function Settings() {
  const { user } = useAuth();
  const [companySettings, setCompanySettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCompanySettings();
    }
  }, [user]);

  const loadCompanySettings = async () => {
    try {
      setLoading(true);
      const companyName = user.originalCompanyName || user.company || user.companyName;

      const settingsQuery = query(
        collection(db, 'companySettings'),
        where('company', '==', companyName)
      );

      const settingsSnapshot = await getDocs(settingsQuery);

      if (!settingsSnapshot.empty) {
        const settings = settingsSnapshot.docs[0].data();
        setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 2.5 } }}>
        {/* Header Skeleton */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Skeleton
              variant="circular"
              width={48}
              height={48}
              sx={{ mr: 2 }}
            />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={45} sx={{ mb: 0.5 }} />
              <Skeleton variant="text" width="50%" height={25} />
            </Box>
          </Box>
          <Skeleton variant="rectangular" width={50} height={3} sx={{ borderRadius: 2 }} />
        </Box>

        {/* Notification Settings Content Skeleton */}
        <Grid container spacing={2}>
          <Grid item xs={12} lg={10} xl={8}>
            <Box>
              {/* Settings Card Skeleton */}
              {[1, 2].map((section) => (
                <Box
                  key={section}
                  sx={{
                    mb: 3,
                    p: 3,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  {/* Section Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="30%" height={30} sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="60%" height={20} />
                    </Box>
                  </Box>

                  {/* Settings Items */}
                  {[1, 2, 3].map((item) => (
                    <Box
                      key={item}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 2,
                        borderBottom: item < 3 ? '1px solid' : 'none',
                        borderColor: 'divider'
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Skeleton variant="text" width="40%" height={24} sx={{ mb: 0.5 }} />
                        <Skeleton variant="text" width="70%" height={18} />
                      </Box>
                      <Skeleton variant="rectangular" width={50} height={30} sx={{ borderRadius: 15 }} />
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 2.5 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: 'warning.main',
              mr: 2,
              width: { xs: 44, sm: 48 },
              height: { xs: 44, sm: 48 },
              boxShadow: '0 4px 15px rgba(237, 108, 2, 0.3)'
            }}
          >
            <Notifications sx={{ fontSize: { xs: 22, sm: 24 } }} />
          </Avatar>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.5rem', sm: '2rem' },
                fontWeight: 700,
                background: 'linear-gradient(45deg, #ed6c02, #ff9800)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Notification Settings
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.875rem', sm: '1rem' },
                fontWeight: 500
              }}
            >
              Manage your check-in and check-out reminders
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 50,
            height: 3,
            bgcolor: 'warning.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {/* Notification Settings Content */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={10} xl={8}>
          <NotificationSettings companySettings={companySettings} />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Settings;
