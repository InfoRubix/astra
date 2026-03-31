import React, { useState, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Button,
  IconButton,
  Chip,
  Avatar,
  Alert,
  CircularProgress,
  Fab,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Business,
  Search,
  Add,
  MoreVert,
  Edit,
  Delete,
  People,
  LocationOn,
  Phone,
  Email,
  Visibility,
  Download,
  FilterList
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useBranches, useBranchOperations } from '../../hooks/useBranches';
import BranchDetailsModal from '../../components/BranchDetailsModal';

function CompanyAdminBranches() {
  const { user } = useAuth();
  const { branches, loading, error, refetch } = useBranches(user?.company);
  const { createBranch, updateBranch, deleteBranch, operationLoading } = useBranchOperations();

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  // New branch form state
  const [newBranchData, setNewBranchData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    email: '',
    companyName: user?.company || ''
  });

  // Filter and search branches
  const filteredBranches = useMemo(() => {
    let filtered = branches;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(branch =>
        branch.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(branch => {
        if (filterStatus === 'active') return branch.isActive !== false;
        if (filterStatus === 'inactive') return branch.isActive === false;
        return true;
      });
    }

    return filtered;
  }, [branches, searchTerm, filterStatus]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const totalBranches = branches.length;
    const activeBranches = branches.filter(b => b.isActive !== false).length;
    const totalEmployees = branches.reduce((sum, branch) => sum + (branch.employeeCount || 0), 0);
    const avgEmployeesPerBranch = totalBranches > 0 ? Math.round(totalEmployees / totalBranches) : 0;

    return {
      totalBranches,
      activeBranches,
      totalEmployees,
      avgEmployeesPerBranch
    };
  }, [branches]);

  // Handle menu actions
  const handleMenuOpen = (event, branch) => {
    setAnchorEl(event.currentTarget);
    setSelectedBranch(branch);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedBranch(null);
  };

  // Handle branch operations
  const handleAddBranch = async () => {
    try {
      await createBranch(newBranchData);
      setShowAddDialog(false);
      setNewBranchData({
        name: '',
        location: '',
        address: '',
        phone: '',
        email: '',
        companyName: user?.company || ''
      });
      refetch();
    } catch (error) {
      console.error('Error adding branch:', error);
    }
  };

  const handleEditBranch = async () => {
    try {
      await updateBranch(selectedBranch.id, newBranchData);
      setShowEditDialog(false);
      handleMenuClose();
      refetch();
    } catch (error) {
      console.error('Error updating branch:', error);
    }
  };

  const handleDeleteBranch = async () => {
    try {
      await deleteBranch(selectedBranch.id);
      setShowDeleteDialog(false);
      handleMenuClose();
      refetch();
    } catch (error) {
      console.error('Error deleting branch:', error);
    }
  };

  // Open dialogs
  const openEditDialog = () => {
    setNewBranchData({
      name: selectedBranch.name || '',
      location: selectedBranch.location || '',
      address: selectedBranch.address || '',
      phone: selectedBranch.phone || '',
      email: selectedBranch.email || '',
      companyName: selectedBranch.companyName || user?.company || ''
    });
    setShowEditDialog(true);
    handleMenuClose();
  };

  const openDeleteDialog = () => {
    setShowDeleteDialog(true);
    handleMenuClose();
  };

  const openDetailsModal = () => {
    setShowDetailsModal(true);
    handleMenuClose();
  };

  // Export functionality
  const exportBranchData = () => {
    const csvData = [
      ['Branch Name', 'Location', 'Address', 'Phone', 'Email', 'Employees', 'Status'],
      ...filteredBranches.map(branch => [
        branch.name || '',
        branch.location || '',
        branch.address || '',
        branch.phone || '',
        branch.email || '',
        branch.employeeCount || 0,
        branch.isActive === false ? 'Inactive' : 'Active'
      ])
    ];

    const csvContent = csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${user?.company}_branches_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Branch Management
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Manage all branches within {user?.company}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading branch data: {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="primary">
                    {statistics.totalBranches}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Branches
                  </Typography>
                </Box>
                <Business fontSize="large" color="primary" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="success.main">
                    {statistics.activeBranches}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Branches
                  </Typography>
                </Box>
                <Business fontSize="large" color="success" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="info.main">
                    {statistics.totalEmployees}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Employees
                  </Typography>
                </Box>
                <People fontSize="large" color="info" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {statistics.avgEmployeesPerBranch}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg per Branch
                  </Typography>
                </Box>
                <People fontSize="large" color="warning" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Status Filter"
                startAdornment={<FilterList sx={{ mr: 1 }} />}
              >
                <MenuItem value="all">All Branches</MenuItem>
                <MenuItem value="active">Active Only</MenuItem>
                <MenuItem value="inactive">Inactive Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={exportBranchData}
              >
                Export
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowAddDialog(true)}
              >
                Add Branch
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Branches Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Branch Name</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Employees</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBranches
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((branch) => (
                  <TableRow key={branch.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Business />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {branch.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {branch.id.slice(-8)}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2">
                            {branch.location || 'Not specified'}
                          </Typography>
                          {branch.address && (
                            <Typography variant="caption" color="textSecondary">
                              {branch.address}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <People fontSize="small" color="action" />
                        <Typography variant="body2">
                          {branch.employeeCount || 0} employees
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {branch.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Phone fontSize="small" color="action" />
                            <Typography variant="caption">
                              {branch.phone}
                            </Typography>
                          </Box>
                        )}
                        {branch.email && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Email fontSize="small" color="action" />
                            <Typography variant="caption">
                              {branch.email}
                            </Typography>
                          </Box>
                        )}
                        {!branch.phone && !branch.email && (
                          <Typography variant="caption" color="textSecondary">
                            No contact info
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={branch.isActive === false ? 'Inactive' : 'Active'}
                        color={branch.isActive === false ? 'default' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, branch)}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={filteredBranches.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={openDetailsModal}>
          <Visibility sx={{ mr: 1 }} fontSize="small" />
          View Details
        </MenuItem>
        <MenuItem onClick={openEditDialog}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit Branch
        </MenuItem>
        <MenuItem onClick={openDeleteDialog} sx={{ color: 'error.main' }}>
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete Branch
        </MenuItem>
      </Menu>

      {/* Add Branch Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Branch</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Branch Name"
                value={newBranchData.name}
                onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={newBranchData.location}
                onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newBranchData.phone}
                onChange={(e) => setNewBranchData({...newBranchData, phone: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={newBranchData.address}
                onChange={(e) => setNewBranchData({...newBranchData, address: e.target.value})}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newBranchData.email}
                onChange={(e) => setNewBranchData({...newBranchData, email: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleAddBranch} 
            variant="contained"
            disabled={operationLoading || !newBranchData.name}
          >
            {operationLoading ? <CircularProgress size={20} /> : 'Add Branch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Branch</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Branch Name"
                value={newBranchData.name}
                onChange={(e) => setNewBranchData({...newBranchData, name: e.target.value})}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Location"
                value={newBranchData.location}
                onChange={(e) => setNewBranchData({...newBranchData, location: e.target.value})}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={newBranchData.phone}
                onChange={(e) => setNewBranchData({...newBranchData, phone: e.target.value})}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={newBranchData.address}
                onChange={(e) => setNewBranchData({...newBranchData, address: e.target.value})}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newBranchData.email}
                onChange={(e) => setNewBranchData({...newBranchData, email: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEditDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleEditBranch} 
            variant="contained"
            disabled={operationLoading || !newBranchData.name}
          >
            {operationLoading ? <CircularProgress size={20} /> : 'Update Branch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Delete Branch</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the branch "{selectedBranch?.name}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteBranch} 
            color="error" 
            variant="contained"
            disabled={operationLoading}
          >
            {operationLoading ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Branch Details Modal */}
      <BranchDetailsModal
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        branchId={selectedBranch?.id}
        branchName={selectedBranch?.name}
      />
    </Container>
  );
}

export default CompanyAdminBranches;