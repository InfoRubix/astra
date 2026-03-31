import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider
} from '@mui/material';
import {
  CloudSync,
  CheckCircle,
  Warning,
  Info
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { migratePositionsToFirebase, checkMigrationStatus } from '../../utils/migratePositionsToFirebase';

/**
 * PositionMigration - Admin tool for syncing predefined positions to Firebase.
 *
 * Checks the current migration status, allows the admin to preview
 * which positions will be added, and runs the migration to copy
 * hard-coded position definitions (per company) into the Firestore
 * "positions" collection. Existing positions are skipped.
 *
 * @param {Object} props
 * @param {Function} [props.onMigrationComplete] - Optional callback invoked after a successful migration so the parent can reload position data.
 * @returns {JSX.Element}
 */
function PositionMigration({ onMigrationComplete }) {
  const { user } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (err) {
      console.error('Error checking migration status:', err);
      setError('Failed to check migration status');
    }
    setLoading(false);
  };

  const handleMigrate = async () => {
    setConfirmDialog(false);
    setMigrating(true);
    setError('');
    setResults(null);

    try {
      const migrationResults = await migratePositionsToFirebase(
        user.uid,
        `${user.firstName} ${user.lastName}`
      );

      setResults(migrationResults);

      // Refresh status after migration
      await checkStatus();

      // Notify parent component to reload positions
      if (onMigrationComplete && typeof onMigrationComplete === 'function') {
        onMigrationComplete();
      }

    } catch (err) {
      console.error('Migration error:', err);
      setError('Migration failed: ' + err.message);
    }

    setMigrating(false);
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CloudSync sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="h6">
            Sync Predefined Positions to Database
          </Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This will sync all predefined positions from the code to Firebase so they can be managed through the Position Management UI.
        </Typography>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {migrationStatus && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity={migrationStatus.needsMigration ? 'warning' : 'success'}
              icon={migrationStatus.needsMigration ? <Warning /> : <CheckCircle />}
            >
              <strong>Status:</strong> {migrationStatus.totalPositions} total positions in database,{' '}
              {migrationStatus.migratedPositions} from previous migrations.
              {migrationStatus.needsMigration && ' Migration recommended.'}
            </Alert>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {migrating && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Migrating positions...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {results && (
          <Box sx={{ mb: 2 }}>
            <Alert severity={results.errors.length > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
              <strong>Migration Complete!</strong>
              <br />
              Processed: {results.totalProcessed} | Added: {results.added} | Skipped: {results.skipped} | Errors: {results.errors.length}
            </Alert>

            {results.added > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Added Positions ({results.added}):
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  <List dense>
                    {results.positions.map((pos, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={pos.name}
                          secondary={`${pos.company} - Level ${pos.level}`}
                        />
                        <Chip label={`Level ${pos.level}`} size="small" color="primary" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Box>
            )}

            {results.errors.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Errors ({results.errors.length}):
                </Typography>
                <Box sx={{ maxHeight: 150, overflow: 'auto', border: '1px solid', borderColor: 'error.main', borderRadius: 1, p: 1 }}>
                  <List dense>
                    {results.errors.map((err, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={err.position}
                          secondary={`${err.company}: ${err.error}`}
                          primaryTypographyProps={{ color: 'error' }}
                          secondaryTypographyProps={{ color: 'error' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<CloudSync />}
            onClick={() => setConfirmDialog(true)}
            disabled={migrating || loading}
          >
            Sync Positions to Database
          </Button>

          <Button
            variant="outlined"
            onClick={checkStatus}
            disabled={migrating || loading}
          >
            Refresh Status
          </Button>
        </Box>

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)}>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Info sx={{ mr: 1, color: 'warning.main' }} />
              Confirm Position Migration
            </Box>
          </DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              This will sync all predefined positions from the code to Firebase.
            </Alert>
            <Typography variant="body2" paragraph>
              This process will:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="• Add all predefined positions for each company (ASIAH HISAM, LITIGATION, AFC, RUBIX)" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Add system-level positions (Admin, System Administrator, Super Admin)" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Skip positions that already exist in the database" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Mark all synced positions as 'predefined' for tracking" />
              </ListItem>
            </List>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Existing positions will not be modified. This operation is safe to run multiple times.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleMigrate}
              color="primary"
            >
              Confirm & Sync
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default PositionMigration;
