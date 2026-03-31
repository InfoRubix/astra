import React from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  Container,
  Typography,
  Paper,
  Box,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  IconButton,
  Autocomplete,
  Button,
  Fab
} from '@mui/material';
import { 
  People, 
  Search, 
  Email, 
  Phone, 
  Business, 
  Badge,
  AdminPanelSettings,
  AccountTree,
  Clear,
  PersonAdd,
  ArrowForward,
  ArrowBack
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyEmployees } from '../../hooks/useCompanyEmployees';

function CompanyAdminEmployees() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const {
    employees,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    departmentFilter,
    setDepartmentFilter,
    branchFilter,
    setBranchFilter,
    departments,
    branches,
    totalCount,
    filteredCount
  } = useCompanyEmployees(user?.company);

  const [currentPage, setCurrentPage] = React.useState(0);
  const employeesPerPage = 5;
  
  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredCount / employeesPerPage));
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  
  const getPaginatedData = () => {
    const startIndex = safePage * employeesPerPage;
    return employees.slice(startIndex, startIndex + employeesPerPage);
  };
  
  const paginatedEmployees = getPaginatedData();
  
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
  
  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(0);
  }, [departmentFilter, branchFilter, searchTerm]);

  const getInitials = (firstName, lastName) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  const getStatusColor = (isActive) => {
    return isActive !== false ? 'success' : 'error';
  };

  const getStatusLabel = (isActive) => {
    return isActive !== false ? 'Active' : 'Inactive';
  };
  
  const getRoleColor = (role) => {
    return role === 'admin' || role === 'company-admin' ? 'error' : 'primary';
  };

  const getRoleIcon = (role) => {
    return role === 'admin' || role === 'company-admin' ? <AdminPanelSettings /> : <People />;
  };
  
  // Calculate department stats
  const calculateDepartmentStats = () => {
    const departmentCount = {};
    const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'info'];
    
    employees.forEach(emp => {
      const dept = emp.department || 'General';
      departmentCount[dept] = (departmentCount[dept] || 0) + 1;
    });

    return Object.entries(departmentCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  };
  
  const departmentStats = calculateDepartmentStats();

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg">
        <Alert severity="error" sx={{ mt: 2 }}>
          Error loading employees: {error}
        </Alert>
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
              <People sx={{ fontSize: { xs: 24, sm: 28 } }} />
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
                Company Employees
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Manage all employees across {user?.company} branches ({totalCount} total employees)
              </Typography>
            </Box>
          </Box>
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

      {/* Enhanced Summary Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        <Grid item xs={6} sm={6} md={4}>
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
                  <People sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {totalCount}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Employees
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={4}>
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
                  <AccountTree sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {departments.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Departments
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={12} md={4}>
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
                  <Business sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                    {branches.length}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Branches
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Department Distribution
              </Typography>
              {departmentStats.map((dept, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2">{dept.name}</Typography>
                  <Chip label={dept.count} color={dept.color} size="small" />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Stats
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2">Active Employees</Typography>
                <Chip label={employees.filter(emp => emp.isActive !== false).length} color="success" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2">Inactive Employees</Typography>
                <Chip label={employees.filter(emp => emp.isActive === false).length} color="error" size="small" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2">Company Admins</Typography>
                <Chip label={employees.filter(emp => emp.role === 'company-admin').length} color="warning" size="small" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Enhanced Employees Section */}
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
        <Box sx={{ p: { xs: 2, sm: 4 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography 
            variant="h6"
            sx={{ 
              fontWeight: 600,
              color: 'primary.main',
              fontSize: { xs: '1.125rem', sm: '1.25rem' }
            }}
          >
            All Employees ({filteredCount})
          </Typography>
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ minWidth: { xs: 180, sm: 250 }, flex: { xs: 1, sm: 'none' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setSearchTerm('')}
                      sx={{ p: 0.5 }}
                    >
                      <Clear sx={{ fontSize: 18 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Autocomplete
              size="small"
              sx={{ minWidth: { xs: 150, sm: 200 }, flex: { xs: 1, sm: 'none' } }}
              options={departments}
              value={departmentFilter === 'all' ? null : departmentFilter}
              onChange={(event, newValue) => setDepartmentFilter(newValue || 'all')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter by Department"
                  variant="outlined"
                />
              )}
            />
            <Autocomplete
              size="small"
              sx={{ minWidth: { xs: 150, sm: 200 }, flex: { xs: 1, sm: 'none' } }}
              options={branches}
              value={branchFilter === 'all' ? null : branchFilter}
              onChange={(event, newValue) => setBranchFilter(newValue || 'all')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Filter by Branch"
                  variant="outlined"
                />
              )}
            />
            {(departmentFilter !== 'all' || branchFilter !== 'all' || searchTerm) && (
              <Button
                size="small"
                onClick={() => {
                  setDepartmentFilter('all');
                  setBranchFilter('all');
                  setSearchTerm('');
                }}
                sx={{ textTransform: 'none' }}
              >
                Clear Filters
              </Button>
            )}
          </Box>
        </Box>
        <Divider />
        
        {/* Desktop Table View */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedEmployees.map((employee) => (
                  <TableRow key={employee.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar sx={{ mr: 2, bgcolor: getRoleColor(employee.role) + '.main' }}>
                          {getInitials(employee.firstName, employee.lastName)}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">
                            {employee.firstName} {employee.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {employee.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        icon={getRoleIcon(employee.role)}
                        label={employee.role?.charAt(0).toUpperCase() + employee.role?.slice(1) || 'User'}
                        color={getRoleColor(employee.role)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">{employee.department || 'N/A'}</Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">{employee.branchName || 'N/A'}</Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <Email sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="caption">{employee.email}</Typography>
                        </Box>
                        {employee.phoneNumber && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Phone sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="caption">{employee.phoneNumber}</Typography>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(employee.isActive)}
                        color={getStatusColor(employee.isActive)}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Mobile Card View */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {employees.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                No employees found
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              {paginatedEmployees.map((employee, index) => (
                <Card 
                  key={employee.id}
                  sx={{
                    mb: 2,
                    borderRadius: 3,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    border: '1px solid',
                    borderColor: 'divider',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      borderColor: 'primary.light'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    {/* Header with Avatar and Name */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar 
                        sx={{ 
                          width: 48, 
                          height: 48, 
                          mr: 2, 
                          bgcolor: getRoleColor(employee.role) + '.main',
                          boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                        }}
                      >
                        {getInitials(employee.firstName, employee.lastName)}
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
                          {employee.firstName} {employee.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {employee.email}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Role and Status */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip 
                        icon={getRoleIcon(employee.role)}
                        label={employee.role?.charAt(0).toUpperCase() + employee.role?.slice(1) || 'User'}
                        color={getRoleColor(employee.role)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                      <Chip 
                        label={getStatusLabel(employee.isActive)}
                        color={getStatusColor(employee.isActive)}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>

                    {/* Department and Branch */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            DEPARTMENT
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {employee.department || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            BRANCH
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                            {employee.branchName || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Contact Information */}
                    <Box sx={{ 
                      p: 2, 
                      bgcolor: 'grey.50', 
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                        CONTACT INFORMATION
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Email sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {employee.email}
                        </Typography>
                      </Box>
                      {employee.phoneNumber && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {employee.phoneNumber}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
        
        {/* Pagination Controls */}
        {filteredCount > employeesPerPage && totalPages > 1 && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: 2,
            p: 3, 
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}>
            <Typography variant="body2" color="text.secondary">
              Showing {safePage * employeesPerPage + 1} to{' '}
              {Math.min((safePage + 1) * employeesPerPage, filteredCount)} of{' '}
              {filteredCount} employees
            </Typography>
            
            {/* Navigation Controls */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button 
                variant="outlined" 
                onClick={handlePrevPage}
                disabled={totalPages <= 1}
                startIcon={<ArrowBack />}
                size="small"
                sx={{ 
                  minWidth: { xs: 'auto', sm: 100 },
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Previous</Box>
              </Button>
              
              {/* Page Dots for Mobile */}
              <Box sx={{ 
                display: { xs: 'flex', sm: 'none' },
                gap: 1, 
                alignItems: 'center', 
                mx: 2 
              }}>
                {totalPages > 1 && Array.from({ length: totalPages }).map((_, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: index === safePage ? 'primary.main' : 'grey.300',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'scale(1.2)',
                        bgcolor: index === safePage ? 'primary.main' : 'grey.400'
                      }
                    }}
                    onClick={() => setCurrentPage(index)}
                  />
                ))}
              </Box>
              
              {/* Page Numbers for Desktop */}
              <Box sx={{ 
                display: { xs: 'none', sm: 'flex' }, 
                gap: 1, 
                alignItems: 'center' 
              }}>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                  // Show first 2, current, and last 2 pages when there are many pages
                  let pageIndex;
                  if (totalPages <= 5) {
                    pageIndex = index;
                  } else {
                    if (index < 2) {
                      pageIndex = index;
                    } else if (index === 2) {
                      pageIndex = Math.max(2, Math.min(safePage, totalPages - 3));
                    } else {
                      pageIndex = totalPages - (5 - index);
                    }
                  }
                  
                  const isCurrentPage = pageIndex === safePage;
                  
                  return (
                    <Button
                      key={pageIndex}
                      variant={isCurrentPage ? "contained" : "outlined"}
                      onClick={() => setCurrentPage(pageIndex)}
                      size="small"
                      sx={{ 
                        minWidth: 40,
                        height: 32,
                        fontWeight: isCurrentPage ? 600 : 400,
                        borderRadius: 2
                      }}
                    >
                      {pageIndex + 1}
                    </Button>
                  );
                })}
              </Box>
              
              <Button 
                variant="outlined" 
                onClick={handleNextPage}
                disabled={totalPages <= 1}
                endIcon={<ArrowForward />}
                size="small"
                sx={{ 
                  minWidth: { xs: 'auto', sm: 100 },
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600
                }}
              >
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Next</Box>
              </Button>
            </Box>
            
            {/* Mobile page info */}
            <Typography 
              variant="caption" 
              color="text.secondary" 
              sx={{ 
                display: { xs: 'block', sm: 'none' },
                fontWeight: 500,
                textAlign: 'center'
              }}
            >
              Page {safePage + 1} of {totalPages}
            </Typography>
          </Box>
        )}
      </Paper>

      {employees.length === 0 && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 3, borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No Employees Found
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {searchTerm || departmentFilter !== 'all' || branchFilter !== 'all'
              ? 'No employees match your current filters.'
              : `No employees found for ${user?.company} company.`
            }
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default CompanyAdminEmployees;