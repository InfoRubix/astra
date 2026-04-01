import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  TextField,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  InputAdornment,
  Autocomplete,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Business,
  Store,
  Person,
  Edit,
  MyLocation,
  Save,
  RadioButtonChecked,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';

const RADIUS_MARKS = [
  { value: 50, label: '50m' },
  { value: 100, label: '100m' },
  { value: 200, label: '200m' },
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
];

function GeofenceSettings() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Edit state
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { type, id, name, currentRadius }
  const [editRadius, setEditRadius] = useState(200);

  // Filters
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load companies
      const companiesSnap = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompanies(companiesData);

      // Load branches
      const branchesSnap = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBranches(branchesData);

      // Load employees (users)
      const usersSnap = await getDocs(query(collection(db, 'users'), where('isActive', '==', true)));
      const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(usersData);

      // Auto-select first company
      if (companiesData.length > 0 && !selectedCompany) {
        setSelectedCompany(companiesData[0]);
      }
    } catch (err) {
      console.error('Error loading geofence data:', err);
      setError('Failed to load data. Please try again.');
    }
    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Clear messages after 3s
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Open edit dialog
  const handleEdit = (type, id, name, currentRadius) => {
    setEditTarget({ type, id, name });
    setEditRadius(currentRadius || 200);
    setEditDialog(true);
  };

  // Save radius
  const handleSave = async () => {
    if (!editTarget) return;

    try {
      const { type, id } = editTarget;
      let collectionName;

      if (type === 'company') {
        // Update companySettings document
        // First find the companySettings doc for this company
        const settingsSnap = await getDocs(query(
          collection(db, 'companySettings'),
          where('company', '==', editTarget.name)
        ));
        if (!settingsSnap.empty) {
          await updateDoc(doc(db, 'companySettings', settingsSnap.docs[0].id), {
            geofenceRadius: editRadius,
            updatedAt: serverTimestamp()
          });
        } else {
          // Also update the companies doc directly
          await updateDoc(doc(db, 'companies', id), {
            geofenceRadius: editRadius,
            updatedAt: serverTimestamp()
          });
        }
        // Update local state
        setCompanies(prev => prev.map(c => c.id === id ? { ...c, geofenceRadius: editRadius } : c));
      } else if (type === 'branch') {
        collectionName = 'branches';
        await updateDoc(doc(db, collectionName, id), {
          geofenceRadius: editRadius,
          updatedAt: serverTimestamp()
        });
        setBranches(prev => prev.map(b => b.id === id ? { ...b, geofenceRadius: editRadius } : b));
      } else if (type === 'staff') {
        collectionName = 'users';
        await updateDoc(doc(db, collectionName, id), {
          geofenceRadius: editRadius,
          updatedAt: serverTimestamp()
        });
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, geofenceRadius: editRadius } : e));
      }

      setSuccess(`Geofence radius for "${editTarget.name}" updated to ${editRadius}m`);
      setEditDialog(false);
      setEditTarget(null);
    } catch (err) {
      console.error('Error saving geofence:', err);
      setError('Failed to save. Please try again.');
    }
  };

  // Clear staff override
  const handleClearOverride = async (type, id, name) => {
    try {
      const collectionName = type === 'branch' ? 'branches' : 'users';
      await updateDoc(doc(db, collectionName, id), {
        geofenceRadius: null,
        updatedAt: serverTimestamp()
      });

      if (type === 'branch') {
        setBranches(prev => prev.map(b => b.id === id ? { ...b, geofenceRadius: null } : b));
      } else {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, geofenceRadius: null } : e));
      }

      setSuccess(`Geofence override removed for "${name}". Will use parent default.`);
    } catch (err) {
      console.error('Error clearing override:', err);
      setError('Failed to clear override.');
    }
  };

  // Get effective radius for display
  const getEffectiveRadius = (employee) => {
    if (employee.geofenceRadius) return { value: employee.geofenceRadius, source: 'Staff Override' };
    const branch = branches.find(b => b.id === employee.branchId || b.name === employee.branchName);
    if (branch?.geofenceRadius) return { value: branch.geofenceRadius, source: `Branch (${branch.name})` };
    const company = companies.find(c => c.name === employee.company || c.id === employee.companyId);
    if (company?.geofenceRadius) return { value: company.geofenceRadius, source: `Company` };
    return { value: 200, source: 'Default' };
  };

  // Filtered data
  const filteredBranches = selectedCompany
    ? branches.filter(b => b.companyId === selectedCompany.id || b.companyName === selectedCompany.name)
    : branches;

  const filteredEmployees = (() => {
    let result = employees;
    if (selectedCompany) {
      result = result.filter(e => e.companyId === selectedCompany.id || e.company === selectedCompany.name);
    }
    if (selectedBranch) {
      result = result.filter(e => e.branchId === selectedBranch.id || e.branchName === selectedBranch.name);
    }
    return result.filter(e => e.role === 'user');
  })();

  // ========== RENDER ==========

  const RadiusChip = ({ radius, source }) => (
    <Tooltip title={`Source: ${source}`}>
      <Chip
        icon={<RadioButtonChecked />}
        label={`${radius}m`}
        color={source === 'Staff Override' ? 'secondary' : source === 'Default' ? 'default' : 'primary'}
        size="small"
        variant={source === 'Default' ? 'outlined' : 'filled'}
      />
    </Tooltip>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Geofence Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Set check-in radius by company, branch, or individual staff.
          Priority: Staff Override {'>'} Branch {'>'} Company {'>'} Default (200m)
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Info Card */}
      <Card sx={{ mb: 3, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Info color="info" fontSize="small" />
            <Typography variant="body2" color="info.dark">
              Radius determines how close a staff member must be to the office to check in.
              Staff override takes highest priority, followed by branch, then company default.
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab icon={<Business />} label="Company" iconPosition="start" />
          <Tab icon={<Store />} label="Branch" iconPosition="start" />
          <Tab icon={<Person />} label="Staff" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ========== COMPANY TAB ========== */}
      {tab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Company</strong></TableCell>
                <TableCell align="center"><strong>Geofence Radius</strong></TableCell>
                <TableCell align="center"><strong>Branches</strong></TableCell>
                <TableCell align="center"><strong>Staff</strong></TableCell>
                <TableCell align="right"><strong>Action</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {companies.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No companies found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                companies.map(company => {
                  const companyBranches = branches.filter(b => b.companyId === company.id || b.companyName === company.name);
                  const companyStaff = employees.filter(e => e.companyId === company.id || e.company === company.name);
                  return (
                    <TableRow key={company.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Business color="primary" fontSize="small" />
                          <Box>
                            <Typography fontWeight={600}>{company.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {company.registrationNumber || ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          icon={<MyLocation />}
                          label={`${company.geofenceRadius || 200}m`}
                          color={company.geofenceRadius ? 'primary' : 'default'}
                          variant={company.geofenceRadius ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="center">{companyBranches.length}</TableCell>
                      <TableCell align="center">{companyStaff.length}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          color="primary"
                          onClick={() => handleEdit('company', company.id, company.name, company.geofenceRadius)}
                        >
                          <Edit />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ========== BRANCH TAB ========== */}
      {tab === 1 && (
        <>
          {/* Company filter */}
          <Box sx={{ mb: 2 }}>
            <Autocomplete
              options={companies}
              getOptionLabel={(o) => o.name || ''}
              value={selectedCompany}
              onChange={(_, v) => { setSelectedCompany(v); setSelectedBranch(null); }}
              renderInput={(params) => <TextField {...params} label="Filter by Company" size="small" />}
              sx={{ maxWidth: 400 }}
            />
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Branch</strong></TableCell>
                  <TableCell><strong>Company</strong></TableCell>
                  <TableCell align="center"><strong>Geofence Radius</strong></TableCell>
                  <TableCell align="center"><strong>Source</strong></TableCell>
                  <TableCell align="right"><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredBranches.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No branches found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBranches.map(branch => {
                    const company = companies.find(c => c.id === branch.companyId || c.name === branch.companyName);
                    const companyRadius = company?.geofenceRadius || 200;
                    const hasOverride = branch.geofenceRadius != null;
                    const effectiveRadius = hasOverride ? branch.geofenceRadius : companyRadius;

                    return (
                      <TableRow key={branch.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Store color="secondary" fontSize="small" />
                            <Box>
                              <Typography fontWeight={600}>{branch.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {branch.address || branch.location || ''}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{branch.companyName || company?.name || '-'}</TableCell>
                        <TableCell align="center">
                          <Chip
                            icon={<MyLocation />}
                            label={`${effectiveRadius}m`}
                            color={hasOverride ? 'secondary' : 'default'}
                            variant={hasOverride ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={hasOverride ? 'Branch Override' : 'Company Default'}
                            size="small"
                            variant="outlined"
                            color={hasOverride ? 'secondary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <IconButton
                              color="primary"
                              onClick={() => handleEdit('branch', branch.id, branch.name, branch.geofenceRadius || companyRadius)}
                            >
                              <Edit />
                            </IconButton>
                            {hasOverride && (
                              <Button
                                size="small"
                                color="warning"
                                onClick={() => handleClearOverride('branch', branch.id, branch.name)}
                              >
                                Reset
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ========== STAFF TAB ========== */}
      {tab === 2 && (
        <>
          {/* Filters */}
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Autocomplete
              options={companies}
              getOptionLabel={(o) => o.name || ''}
              value={selectedCompany}
              onChange={(_, v) => { setSelectedCompany(v); setSelectedBranch(null); }}
              renderInput={(params) => <TextField {...params} label="Filter by Company" size="small" />}
              sx={{ minWidth: 250 }}
            />
            <Autocomplete
              options={filteredBranches}
              getOptionLabel={(o) => o.name || ''}
              value={selectedBranch}
              onChange={(_, v) => setSelectedBranch(v)}
              renderInput={(params) => <TextField {...params} label="Filter by Branch" size="small" />}
              sx={{ minWidth: 250 }}
            />
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Staff</strong></TableCell>
                  <TableCell><strong>Branch</strong></TableCell>
                  <TableCell><strong>Department</strong></TableCell>
                  <TableCell align="center"><strong>Effective Radius</strong></TableCell>
                  <TableCell align="center"><strong>Source</strong></TableCell>
                  <TableCell align="right"><strong>Action</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No staff found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(emp => {
                    const effective = getEffectiveRadius(emp);
                    const hasOverride = emp.geofenceRadius != null;

                    return (
                      <TableRow key={emp.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person color="action" fontSize="small" />
                            <Box>
                              <Typography fontWeight={600}>
                                {emp.firstName} {emp.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {emp.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{emp.branchName || '-'}</TableCell>
                        <TableCell>{emp.department || '-'}</TableCell>
                        <TableCell align="center">
                          <RadiusChip radius={effective.value} source={effective.source} />
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={effective.source}
                            size="small"
                            variant="outlined"
                            color={hasOverride ? 'secondary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            <IconButton
                              color="primary"
                              onClick={() => handleEdit('staff', emp.id, `${emp.firstName} ${emp.lastName}`, effective.value)}
                            >
                              <Edit />
                            </IconButton>
                            {hasOverride && (
                              <Button
                                size="small"
                                color="warning"
                                onClick={() => handleClearOverride('staff', emp.id, `${emp.firstName} ${emp.lastName}`)}
                              >
                                Reset
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* ========== EDIT DIALOG ========== */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MyLocation color="primary" />
            Edit Geofence Radius
          </Box>
        </DialogTitle>
        <DialogContent>
          {editTarget && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Setting radius for: <strong>{editTarget.name}</strong> ({editTarget.type})
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Radius slider */}
              <Typography variant="subtitle2" gutterBottom>
                Radius: <strong>{editRadius}m</strong>
                {editRadius >= 1000 && ` (${(editRadius / 1000).toFixed(1)} km)`}
              </Typography>

              <Slider
                value={editRadius}
                onChange={(_, v) => setEditRadius(v)}
                min={20}
                max={2000}
                step={10}
                marks={RADIUS_MARKS}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
                sx={{ mt: 2, mb: 3 }}
              />

              {/* Manual input */}
              <TextField
                label="Radius (meters)"
                type="number"
                value={editRadius}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1 && v <= 10000) setEditRadius(v);
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">m</InputAdornment>,
                }}
                size="small"
                fullWidth
                helperText="Min: 1m, Max: 10,000m. Recommended: 100-500m"
              />

              {/* Quick presets */}
              <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                  Quick presets:
                </Typography>
                {[50, 100, 200, 300, 500, 1000].map(preset => (
                  <Chip
                    key={preset}
                    label={`${preset}m`}
                    onClick={() => setEditRadius(preset)}
                    color={editRadius === preset ? 'primary' : 'default'}
                    variant={editRadius === preset ? 'filled' : 'outlined'}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Save />} onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default GeofenceSettings;
