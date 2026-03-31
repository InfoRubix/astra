import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Checkbox,
  Toolbar,
  CircularProgress
} from '@mui/material';
import {
  BusinessCenter,
  LayersOutlined,
  Edit,
  Delete,
  Add,
  DeleteSweep
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { COMPANY_POSITIONS, getPositionLevelName } from '../../utils/positionHierarchy';
import PositionMigration from '../../components/admin/PositionMigration';

function PositionManagement() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [addDialog, setAddDialog] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // Bulk delete states
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Position usage tracking
  const [positionUsage, setPositionUsage] = useState({});
  const [usageLoading, setUsageLoading] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    positionName: '',
    level: 3
  });

  // Available companies from COMPANY_POSITIONS
  const availableCompanies = Object.keys(COMPANY_POSITIONS);

  // Set default company on mount
  useEffect(() => {
    if (availableCompanies.length > 0 && !selectedCompany) {
      setSelectedCompany(availableCompanies[0]);
    }
  }, []);

  // Load positions when company is selected
  useEffect(() => {
    if (selectedCompany) {
      loadPositions();
      loadPositionUsage();
    }
  }, [selectedCompany]);

  const loadPositions = async () => {
    try {
      setLoading(true);

      // Load all positions from database (now includes both pre-defined and custom)
      const positionsQuery = query(
        collection(db, 'positions'),
        where('companyName', '==', selectedCompany)
      );
      const snapshot = await getDocs(positionsQuery);
      const dbPositions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isFromDB: true
      }));

      // Filter out deleted positions and get list of deleted position names
      const activeDBPositions = dbPositions.filter(p => !p.isDeleted);
      const deletedPositionNames = dbPositions
        .filter(p => p.isDeleted)
        .map(p => p.positionName);

      // Get pre-defined positions from COMPANY_POSITIONS
      const companyPositions = COMPANY_POSITIONS[selectedCompany];
      const positionsList = [];

      if (companyPositions) {
        // Check which pre-defined positions are NOT in database and NOT deleted
        Object.entries(companyPositions).forEach(([level, positionNames]) => {
          positionNames.forEach(positionName => {
            // Check if this position is deleted
            const isDeleted = deletedPositionNames.includes(positionName);

            // Check if this position already exists in database (active)
            const existsInDB = activeDBPositions.find(
              p => p.positionName === positionName
            );

            // Only add if not deleted and not already in active DB positions
            if (!existsInDB && !isDeleted) {
              // Add pre-defined position that's not yet in DB
              positionsList.push({
                id: `predefined-${selectedCompany}-${level}-${positionName}`,
                companyName: selectedCompany,
                positionName: positionName,
                level: parseInt(level),
                isPreDefined: true
              });
            }
          });
        });
      }

      // Add all active positions from database
      positionsList.push(...activeDBPositions);

      // Sort by level (ascending) and then by name
      positionsList.sort((a, b) => {
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        return a.positionName.localeCompare(b.positionName);
      });

      setPositions(positionsList);
      setLoading(false);
    } catch (err) {
      console.error('Error loading positions:', err);
      setError('Failed to load positions');
      setLoading(false);
    }
  };

  const loadPositionUsage = async () => {
    if (!selectedCompany) return;

    try {
      setUsageLoading(true);

      // Query all employees for the selected company
      const usersQuery = query(
        collection(db, 'users'),
        where('company', '==', selectedCompany)
      );
      const usersSnapshot = await getDocs(usersQuery);

      // Also check for employees with originalCompanyName
      const usersQuery2 = query(
        collection(db, 'users'),
        where('originalCompanyName', '==', selectedCompany)
      );
      const usersSnapshot2 = await getDocs(usersQuery2);

      // Combine both results
      const allUsers = [
        ...usersSnapshot.docs.map(doc => doc.data()),
        ...usersSnapshot2.docs.map(doc => doc.data())
      ];

      // Remove duplicates based on email
      const uniqueUsers = Array.from(
        new Map(allUsers.map(user => [user.email, user])).values()
      );

      // Count employees by position
      const usageCounts = {};

      uniqueUsers.forEach(user => {
        const position = user.position;
        if (position) {
          usageCounts[position] = (usageCounts[position] || 0) + 1;
        }
      });

      console.log('📊 Position usage counts for', selectedCompany, ':', usageCounts);
      setPositionUsage(usageCounts);
      setUsageLoading(false);
    } catch (err) {
      console.error('Error loading position usage:', err);
      setUsageLoading(false);
    }
  };

  const handleAddPosition = async () => {
    try {
      setError('');

      if (!formData.positionName) {
        setError('Position name is required');
        return;
      }

      // Check if position already exists
      const existingPosition = positions.find(
        p => p.positionName.toLowerCase() === formData.positionName.toLowerCase()
      );

      if (existingPosition) {
        setError('This position already exists for the selected company');
        return;
      }

      // Add to database
      await addDoc(collection(db, 'positions'), {
        companyName: selectedCompany,
        positionName: formData.positionName.trim(),
        level: parseInt(formData.level),
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });

      setSuccess('Position added successfully');
      setAddDialog(false);
      setFormData({ positionName: '', level: 3 });
      await loadPositions();
      await loadPositionUsage();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error adding position:', err);
      setError('Failed to add position: ' + err.message);
    }
  };

  const handleEditPosition = async () => {
    try {
      setError('');

      if (!formData.positionName) {
        setError('Position name is required');
        return;
      }

      // If it's a pre-defined position not yet in DB, save it to DB first
      if (selectedPosition.isPreDefined && !selectedPosition.isFromDB) {
        // Create new entry in database for this pre-defined position
        await addDoc(collection(db, 'positions'), {
          companyName: selectedCompany,
          positionName: formData.positionName.trim(),
          level: parseInt(formData.level),
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          originalName: selectedPosition.positionName, // Track original name
          wasPreDefined: true
        });
      } else {
        // Update existing database entry
        await updateDoc(doc(db, 'positions', selectedPosition.id), {
          positionName: formData.positionName.trim(),
          level: parseInt(formData.level),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
      }

      setSuccess('Position updated successfully');
      setEditDialog(false);
      setSelectedPosition(null);
      setFormData({ positionName: '', level: 3 });
      await loadPositions();
      await loadPositionUsage();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating position:', err);
      setError('Failed to update position: ' + err.message);
    }
  };

  const handleDeletePosition = async () => {
    try {
      setError('');

      // If it's a pre-defined position not in DB, add it to DB as deleted
      if (selectedPosition.isPreDefined && !selectedPosition.isFromDB) {
        // Mark as deleted in database so it won't show anymore
        await addDoc(collection(db, 'positions'), {
          companyName: selectedCompany,
          positionName: selectedPosition.positionName,
          level: selectedPosition.level,
          isDeleted: true, // Mark as deleted
          deletedAt: serverTimestamp(),
          deletedBy: user.uid,
          wasPreDefined: true
        });
      } else {
        // Either mark as deleted or actually delete from database
        await updateDoc(doc(db, 'positions', selectedPosition.id), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid
        });
      }

      setSuccess('Position deleted successfully');
      setDeleteDialog(false);
      setSelectedPosition(null);
      await loadPositions();
      await loadPositionUsage();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting position:', err);
      setError('Failed to delete position: ' + err.message);
    }
  };

  // Bulk delete functions
  const handleSelectPosition = (position) => {
    const positionId = position.id;
    setSelectedPositions(prev => {
      if (prev.includes(positionId)) {
        return prev.filter(id => id !== positionId);
      } else {
        return [...prev, positionId];
      }
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      const allIds = positions.map(pos => pos.id);
      setSelectedPositions(allIds);
    } else {
      setSelectedPositions([]);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleteLoading(true);
    setError('');

    try {
      let deletedCount = 0;
      let errorCount = 0;

      for (const positionId of selectedPositions) {
        try {
          const position = positions.find(p => p.id === positionId);

          if (!position) continue;

          // If it's a pre-defined position not in DB, add it to DB as deleted
          if (position.isPreDefined && !position.isFromDB) {
            await addDoc(collection(db, 'positions'), {
              companyName: selectedCompany,
              positionName: position.positionName,
              level: position.level,
              isDeleted: true,
              deletedAt: serverTimestamp(),
              deletedBy: user.uid,
              wasPreDefined: true
            });
          } else {
            // Mark as deleted in database
            await updateDoc(doc(db, 'positions', position.id), {
              isDeleted: true,
              deletedAt: serverTimestamp(),
              deletedBy: user.uid
            });
          }

          deletedCount++;
        } catch (err) {
          console.error('Error deleting position:', err);
          errorCount++;
        }
      }

      setSuccess(`Successfully deleted ${deletedCount} position(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
      setBulkDeleteDialog(false);
      setSelectedPositions([]);
      await loadPositions();
      await loadPositionUsage();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error in bulk delete:', err);
      setError('Failed to delete positions: ' + err.message);
    }

    setBulkDeleteLoading(false);
  };

  const openAddDialog = () => {
    setFormData({
      positionName: '',
      level: 3
    });
    setError('');
    setAddDialog(true);
  };

  const openEditDialog = (position) => {
    setSelectedPosition(position);
    setFormData({
      positionName: position.positionName,
      level: position.level
    });
    setError('');
    setEditDialog(true);
  };

  const openDeleteDialog = (position) => {
    setSelectedPosition(position);
    setError('');
    setDeleteDialog(true);
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 0: return 'error';
      case 1: return 'warning';
      case 2: return 'info';
      case 3: return 'success';
      default: return 'default';
    }
  };

  // Get position counts by level
  const getPositionStats = () => {
    const stats = {
      total: positions.length,
      byLevel: {
        0: 0,
        1: 0,
        2: 0,
        3: 0
      }
    };

    positions.forEach(pos => {
      if (stats.byLevel[pos.level] !== undefined) {
        stats.byLevel[pos.level]++;
      }
    });

    return stats;
  };

  const stats = getPositionStats();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
              Position Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage organizational positions and hierarchy levels for each company
            </Typography>
          </Box>
        </Box>

        {/* Alerts */}
        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        {/* Position Migration Component */}
        <PositionMigration onMigrationComplete={loadPositions} />

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Total Positions
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {stats.total}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'error.main' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Level 0 - Top Management
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {stats.byLevel[0]}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'warning.main' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Level 1 - Managers
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {stats.byLevel[1]}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: 4, borderColor: 'info.main' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom variant="body2">
                  Level 2 - Seniors
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {stats.byLevel[2]}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Company Selection and Actions */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <FormControl sx={{ minWidth: 250 }}>
              <InputLabel>Select Company</InputLabel>
              <Select
                value={selectedCompany}
                label="Select Company"
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                {availableCompanies.map((company) => (
                  <MenuItem key={company} value={company}>
                    {company}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={openAddDialog}
                disabled={!selectedCompany}
              >
                Add Custom Position
              </Button>

              {selectedPositions.length > 0 && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<DeleteSweep />}
                  onClick={() => setBulkDeleteDialog(true)}
                >
                  Delete Selected ({selectedPositions.length})
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Positions Table */}
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {selectedCompany ? `Positions - ${selectedCompany}` : 'Select a company to view positions'}
            </Typography>
            {selectedCompany && positions.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {selectedPositions.length > 0 ? `${selectedPositions.length} selected` : `${positions.length} total`}
              </Typography>
            )}
          </Box>

          {selectedCompany && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedPositions.length > 0 && selectedPositions.length < positions.length}
                        checked={positions.length > 0 && selectedPositions.length === positions.length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '30%' }}>Position Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '12%' }}>Level</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '25%' }}>Hierarchy</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '13%' }}>Used By</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: '15%' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        Loading positions...
                      </TableCell>
                    </TableRow>
                  ) : positions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Box sx={{ py: 4 }}>
                          <BusinessCenter sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                          <Typography variant="body1" color="text.secondary">
                            No positions found for this company
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    positions.map((position) => (
                      <TableRow
                        key={position.id}
                        hover
                        selected={selectedPositions.includes(position.id)}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedPositions.includes(position.id)}
                            onChange={() => handleSelectPosition(position)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {position.positionName}
                            {position.isCustom && (
                              <Chip
                                label="Custom"
                                size="small"
                                color="primary"
                                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                              />
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={`Level ${position.level}`}
                            color={getLevelColor(position.level)}
                            size="small"
                            icon={<LayersOutlined />}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {getPositionLevelName(position.level)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {usageLoading ? (
                              <CircularProgress size={20} />
                            ) : (
                              <>
                                <Chip
                                  label={positionUsage[position.positionName] || 0}
                                  size="small"
                                  color={
                                    (positionUsage[position.positionName] || 0) === 0 ? 'default' :
                                    (positionUsage[position.positionName] || 0) < 5 ? 'info' :
                                    (positionUsage[position.positionName] || 0) < 10 ? 'primary' : 'success'
                                  }
                                  sx={{ fontWeight: 600, minWidth: 40 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {(positionUsage[position.positionName] || 0) === 1 ? 'employee' : 'employees'}
                                </Typography>
                              </>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openEditDialog(position)}
                              title="Edit position"
                            >
                              <Edit />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => openDeleteDialog(position)}
                              title="Delete position"
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      {/* Add Position Dialog */}
      <Dialog open={addDialog} onClose={() => setAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Custom Position</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info">
              Adding a custom position for <strong>{selectedCompany}</strong>
            </Alert>

            <TextField
              label="Position Name"
              value={formData.positionName}
              onChange={(e) => setFormData({ ...formData, positionName: e.target.value })}
              fullWidth
              required
              autoFocus
            />

            <FormControl fullWidth>
              <InputLabel>Hierarchy Level</InputLabel>
              <Select
                value={formData.level}
                label="Hierarchy Level"
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              >
                <MenuItem value={0}>Level 0 - Top Management (CEO, Directors, Partners)</MenuItem>
                <MenuItem value={1}>Level 1 - Managers & Department Heads</MenuItem>
                <MenuItem value={2}>Level 2 - Seniors & Supervisors</MenuItem>
                <MenuItem value={3}>Level 3 - Staff & Executives</MenuItem>
              </Select>
            </FormControl>

            <Alert severity="info">
              <Typography variant="body2">
                <strong>Note:</strong> Custom positions will be added to the database and appear alongside pre-defined positions.
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddPosition} variant="contained">
            Add Position
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Position Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Position</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {selectedPosition?.isPreDefined && !selectedPosition?.isFromDB && (
              <Alert severity="info">
                This is a pre-defined position. Editing it will save your changes to the database and override the default.
              </Alert>
            )}

            <TextField
              label="Position Name"
              value={formData.positionName}
              onChange={(e) => setFormData({ ...formData, positionName: e.target.value })}
              fullWidth
              required
              autoFocus
            />

            <FormControl fullWidth>
              <InputLabel>Hierarchy Level</InputLabel>
              <Select
                value={formData.level}
                label="Hierarchy Level"
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              >
                <MenuItem value={0}>Level 0 - Top Management (CEO, Directors, Partners)</MenuItem>
                <MenuItem value={1}>Level 1 - Managers & Department Heads</MenuItem>
                <MenuItem value={2}>Level 2 - Seniors & Supervisors</MenuItem>
                <MenuItem value={3}>Level 3 - Staff & Executives</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button
            onClick={handleEditPosition}
            variant="contained"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Position</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography>
            Are you sure you want to delete the position <strong>{selectedPosition?.positionName}</strong>?
            This will remove it from the system permanently.
          </Typography>

          {selectedPosition?.isPreDefined && !selectedPosition?.isFromDB && (
            <Alert severity="info" sx={{ mt: 2 }}>
              This position will be marked as deleted and will not appear in employee forms.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button
            onClick={handleDeletePosition}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialog} onClose={() => setBulkDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'error.main' }}>
            <DeleteSweep sx={{ mr: 1 }} />
            Bulk Delete Positions
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are about to delete {selectedPositions.length} position(s). This action cannot be undone.
          </Alert>

          <Typography variant="body2" gutterBottom>
            The following positions will be deleted:
          </Typography>

          <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            {selectedPositions.map(posId => {
              const position = positions.find(p => p.id === posId);
              return position ? (
                <Box key={posId} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LayersOutlined sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2">
                    {position.positionName}
                    <Chip
                      label={`Level ${position.level}`}
                      size="small"
                      color={getLevelColor(position.level)}
                      sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                    />
                  </Typography>
                </Box>
              ) : null;
            })}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            All selected positions will be marked as deleted and will not appear in employee forms.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialog(false)} disabled={bulkDeleteLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant="contained"
            color="error"
            disabled={bulkDeleteLoading}
            startIcon={bulkDeleteLoading ? <CircularProgress size={20} /> : <DeleteSweep />}
          >
            {bulkDeleteLoading ? 'Deleting...' : `Delete ${selectedPositions.length} Position(s)`}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default PositionManagement;
