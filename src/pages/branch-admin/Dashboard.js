import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  People,
  EventAvailable,
  Receipt,
  TrendingUp,
  Assignment,
  CheckCircle,
  Business,
  AccessTime
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useBranchDashboard } from '../../hooks/useBranchDashboard';

function BranchAdminDashboard() {
  const { user } = useAuth();
  const { dashboardData, loading, error, branchName } = useBranchDashboard(user);

  const stats = [
    {
      title: 'Branch Employees',
      value: loading ? '...' : dashboardData.totalEmployees.toString(),
      icon: <People fontSize="large" color="primary" />,
      color: '#1976d2'
    },
    {
      title: 'Present Today',
      value: loading ? '...' : dashboardData.presentToday.toString(),
      icon: <CheckCircle fontSize="large" color="success" />,
      color: '#2e7d32'
    },
    {
      title: 'Pending Leaves',
      value: loading ? '...' : dashboardData.pendingLeaves.toString(),
      icon: <EventAvailable fontSize="large" color="warning" />,
      color: '#ed6c02'
    },
    {
      title: 'Pending Claims',
      value: loading ? '...' : dashboardData.pendingClaims.toString(),
      icon: <Receipt fontSize="large" color="error" />,
      color: '#d32f2f'
    }
  ];

  // Format activity time
  const formatActivityTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const activityTime = timestamp.seconds 
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);
    
    const diffInHours = Math.floor((now - activityTime) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return activityTime.toLocaleDateString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Branch Dashboard
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Welcome back, {user?.firstName}! Managing {user?.company} - {branchName}.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading dashboard data: {error}
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Branch Admin Access:</strong> You have access to manage employees, 
          leaves, and operations for the {branchName} branch only.
        </Typography>
      </Alert>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" component="div" sx={{ color: stat.color }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {stat.title}
                    </Typography>
                  </Box>
                  {stat.icon}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Branch Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
              Branch Performance
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              {branchName} metrics and trends
            </Typography>
            <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="textSecondary">
                Branch performance charts will be displayed here
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Assignment sx={{ mr: 1, verticalAlign: 'middle' }} />
              Quick Actions
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Review {dashboardData.pendingLeaves} pending leave requests
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Process {dashboardData.pendingClaims} expense claims
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Check attendance reports
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Update branch announcements
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <AccessTime sx={{ mr: 1, verticalAlign: 'middle' }} />
              Recent Branch Activity
            </Typography>
            {dashboardData.recentActivity.length > 0 ? (
              <List sx={{ mt: 1 }}>
                {dashboardData.recentActivity.map((activity, index) => (
                  <React.Fragment key={activity.id || index}>
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {activity.type === 'leave' ? (
                              <EventAvailable fontSize="small" color="warning" />
                            ) : (
                              <Receipt fontSize="small" color="error" />
                            )}
                            <Typography variant="body2">
                              {activity.message}
                            </Typography>
                            <Chip 
                              label={activity.status} 
                              size="small" 
                              color={activity.status === 'pending' ? 'warning' : 'success'}
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="textSecondary" sx={{ ml: 3 }}>
                            {formatActivityTime(activity.time)}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < dashboardData.recentActivity.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Assignment fontSize="large" color="disabled" />
                <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
                  No recent activity in your branch
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Branch Info Summary */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
              Branch Summary
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h6" color="primary">
                    {dashboardData.totalEmployees}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Total Employees
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h6" color="success.main">
                    {Math.round((dashboardData.presentToday / dashboardData.totalEmployees) * 100) || 0}%
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Attendance Rate
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h6" color="warning.main">
                    {dashboardData.pendingLeaves}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Pending Requests
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="h6" color="error.main">
                    {dashboardData.pendingClaims}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Pending Claims
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default BranchAdminDashboard;