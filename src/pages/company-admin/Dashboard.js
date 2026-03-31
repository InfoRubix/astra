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
  CircularProgress
} from '@mui/material';
import {
  People,
  Business,
  EventAvailable,
  Receipt,
  TrendingUp,
  Assessment
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyDashboard } from '../../hooks/useCompanyDashboard';

function CompanyAdminDashboard() {
  const { user } = useAuth();
  const { dashboardData, loading, error } = useCompanyDashboard(user?.company);

  const stats = [
    {
      title: 'Total Employees',
      value: loading ? '...' : dashboardData.totalEmployees.toString(),
      icon: <People fontSize="large" color="primary" />,
      color: '#1976d2'
    },
    {
      title: 'Active Branches',
      value: loading ? '...' : dashboardData.activeBranches.toString(),
      icon: <Business fontSize="large" color="success" />,
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Company Dashboard
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Welcome back, {user?.firstName}! Here's your {user?.company} company overview.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Company Admin Access:</strong> You have full access to manage all employees, 
          branches, and company-wide settings for {user?.company}.
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

      {/* Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
              Company Performance
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Company-wide metrics and trends
            </Typography>
            <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="textSecondary">
                Performance charts will be displayed here
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
              Quick Actions
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Review pending leave requests
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Process employee claims  
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Check branch performance
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                • Update company settings
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Branch Overview */}
      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Branch Overview - {user?.company}
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                Error loading branch data: {error}
              </Alert>
            ) : dashboardData.branches.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                No branch data available. Employees may not have assigned branches.
              </Alert>
            ) : (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {dashboardData.branches.map((branch, index) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6">{branch.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {branch.employeeCount} Employees • {branch.pendingLeaves} Pending Leaves
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default CompanyAdminDashboard;