import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Button,
  Alert,
  Box,
  LinearProgress,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import { Storage, PlayArrow, CheckCircle, Error } from '@mui/icons-material';
import { migrateCompanyFields, getMigrationStatus } from '../../utils/migrateToCompanyField';
import { cleanupCompanyFields, previewCompanyFieldsCleanup } from '../../utils/cleanupCompanyFields';
import { migrateClaimsAndLeavesToOriginalCompanyName, previewClaimsLeavesMigration } from '../../utils/migrateClaimsLeavesToOriginalCompanyName';

/**
 * DatabaseMigration - Admin tool for running Firestore data migrations.
 *
 * Provides three migration workflows:
 * 1. Migrate `companyName` to `company` across users, attendance, leaves, and claims.
 * 2. Cleanup duplicate company fields by consolidating `originalCompanyName`
 *    and `companyName` into a single `company` field on user documents.
 * 3. Migrate claims, leaves, and attendance from `companyName` to
 *    `originalCompanyName` for consistent field naming.
 *
 * Each workflow supports a status check, optional preview, and execution
 * with progress feedback. This component has no props; it reads
 * migration utilities imported from the utils directory.
 *
 * @returns {JSX.Element}
 */
function DatabaseMigration() {
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cleanupPreview, setCleanupPreview] = useState(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [claimsLeavesPreview, setClaimsLeavesPreview] = useState(null);
  const [claimsLeavesLoading, setClaimsLeavesLoading] = useState(false);
  const [claimsLeavesResult, setClaimsLeavesResult] = useState(null);

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    setLoading(true);
    try {
      const status = await getMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Error checking migration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const migrationResult = await migrateCompanyFields();
      setResult(migrationResult);
      
      // Refresh status after migration
      if (migrationResult.success) {
        await checkMigrationStatus();
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const previewCleanup = async () => {
    setCleanupLoading(true);
    try {
      const preview = await previewCompanyFieldsCleanup();
      setCleanupPreview(preview);
    } catch (error) {
      console.error('Error previewing cleanup:', error);
    } finally {
      setCleanupLoading(false);
    }
  };

  const runCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    
    try {
      const result = await cleanupCompanyFields();
      setCleanupResult(result);
    } catch (error) {
      setCleanupResult({ success: false, error: error.message });
    } finally {
      setCleanupLoading(false);
    }
  };

  const previewClaimsLeavesMigration = async () => {
    setClaimsLeavesLoading(true);
    try {
      const preview = await previewClaimsLeavesMigration();
      setClaimsLeavesPreview(preview);
    } catch (error) {
      console.error('Error previewing claims/leaves migration:', error);
    } finally {
      setClaimsLeavesLoading(false);
    }
  };

  const runClaimsLeavesMigration = async () => {
    setClaimsLeavesLoading(true);
    setClaimsLeavesResult(null);
    
    try {
      const result = await migrateClaimsAndLeavesToOriginalCompanyName();
      setClaimsLeavesResult(result);
    } catch (error) {
      setClaimsLeavesResult({ success: false, error: error.message });
    } finally {
      setClaimsLeavesLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Storage color="primary" />
        <Typography variant="h5">Database Migration Tool</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        This tool will migrate your existing Firebase data from the old `companyName` field to the new `company` field structure with support for multiple companies: ASIAH HISAM, RUBIX, AFC, KFC, and LITIGATION.
      </Alert>

      {loading && (
        <Box sx={{ mb: 3 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            {result ? 'Running migration...' : 'Checking migration status...'}
          </Typography>
        </Box>
      )}

      {migrationStatus && !loading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Migration Status</Typography>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip 
              label={`Total Users: ${migrationStatus.totalUsers}`}
              color="primary"
              variant="outlined"
            />
            <Chip 
              label={`Users with old field: ${migrationStatus.usersWithOldField}`}
              color={migrationStatus.usersWithOldField > 0 ? "warning" : "success"}
            />
            <Chip 
              label={`Users with new field: ${migrationStatus.usersWithNewField}`}
              color="success"
            />
          </Stack>
          
          {migrationStatus.needsMigration ? (
            <Alert severity="warning">
              Migration needed! {migrationStatus.usersWithOldField} users still have the old companyName field.
            </Alert>
          ) : (
            <Alert severity="success">
              ✅ Migration appears to be complete! All users have the new company field.
            </Alert>
          )}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Box display="flex" gap={2} alignItems="center">
        <Button
          variant="contained"
          onClick={runMigration}
          disabled={loading || (migrationStatus && !migrationStatus.needsMigration)}
          startIcon={<PlayArrow />}
          size="large"
        >
          {loading ? 'Running Migration...' : 'Run Migration'}
        </Button>
        
        <Button
          variant="outlined"
          onClick={checkMigrationStatus}
          disabled={loading}
        >
          Refresh Status
        </Button>
      </Box>

      {result && (
        <Box sx={{ mt: 3 }}>
          <Alert 
            severity={result.success ? "success" : "error"}
            icon={result.success ? <CheckCircle /> : <Error />}
          >
            {result.success ? result.message : `Migration failed: ${result.error}`}
          </Alert>
        </Box>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>What this migration does:</Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li>Updates all users: changes `companyName` → `company`</li>
            <li>Updates attendance records: changes `companyName` → `company`</li>
            <li>Updates leave records: changes `companyName` → `company`</li>
            <li>Updates claim records: changes `companyName` → `company`</li>
            <li>Maps 'RUBIX TECHNOLOGY' → 'RUBIX' automatically</li>
            <li>Supports companies: ASIAH HISAM, RUBIX, AFC, KFC, LITIGATION</li>
          </ul>
        </Typography>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Company Fields Cleanup Section */}
      <Box>
        <Typography variant="h5" gutterBottom>
          Company Fields Cleanup
        </Typography>
        
        <Alert severity="warning" sx={{ mb: 3 }}>
          This tool will consolidate duplicate company fields in the users collection. It will use `originalCompanyName` as the primary source and remove both `companyName` and `originalCompanyName`, creating a single `company` field.
        </Alert>

        {cleanupLoading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {cleanupResult ? 'Running cleanup...' : 'Loading preview...'}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            onClick={previewCleanup}
            disabled={cleanupLoading}
          >
            Preview Changes
          </Button>
          
          <Button
            variant="contained"
            color="warning"
            onClick={runCleanup}
            disabled={cleanupLoading}
            startIcon={<PlayArrow />}
          >
            {cleanupLoading ? 'Running Cleanup...' : 'Run Cleanup'}
          </Button>
        </Stack>

        {cleanupPreview && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Preview of Changes:</Typography>
            <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.75rem' }}>
                {cleanupPreview.changes?.map((change, index) => (
                  <div key={index}>
                    {`User: ${change.user}`}<br/>
                    {`  companyName: ${change.currentCompanyName} → will be removed`}<br/>
                    {`  originalCompanyName: ${change.currentOriginalCompanyName} → will be removed`}<br/>
                    {`  company: ${change.newCompany} (new field)`}<br/>
                    ---<br/>
                  </div>
                ))}
              </Typography>
            </Paper>
            <Typography variant="caption" color="text.secondary">
              Total users to be updated: {cleanupPreview.totalUsers}
            </Typography>
          </Box>
        )}

        {cleanupResult && (
          <Box sx={{ mt: 3 }}>
            <Alert 
              severity={cleanupResult.success ? "success" : "error"}
              icon={cleanupResult.success ? <CheckCircle /> : <Error />}
            >
              {cleanupResult.success ? cleanupResult.message : `Cleanup failed: ${cleanupResult.error}`}
            </Alert>
          </Box>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>What this cleanup does:</Typography>
          <Typography variant="body2" component="div">
            <ul>
              <li>Uses `originalCompanyName` as the primary company value if it exists</li>
              <li>Falls back to `companyName` if `originalCompanyName` doesn't exist</li>
              <li>Creates a single `company` field with the correct value</li>
              <li>Removes both `companyName` and `originalCompanyName` fields</li>
              <li>Ensures each user has exactly one company field</li>
            </ul>
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Claims and Leaves Migration Section */}
      <Box>
        <Typography variant="h5" gutterBottom>
          Claims & Leaves Migration
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          This tool will migrate Claims, Leaves, and Attendance collections from `companyName` to `originalCompanyName` to match the Users collection standard.
        </Alert>

        {claimsLeavesLoading && (
          <Box sx={{ mb: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {claimsLeavesResult ? 'Running migration...' : 'Loading preview...'}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            onClick={previewClaimsLeavesMigration}
            disabled={claimsLeavesLoading}
          >
            Preview Migration
          </Button>
          
          <Button
            variant="contained"
            color="secondary"
            onClick={runClaimsLeavesMigration}
            disabled={claimsLeavesLoading}
            startIcon={<PlayArrow />}
          >
            {claimsLeavesLoading ? 'Running Migration...' : 'Migrate Collections'}
          </Button>
        </Stack>

        {claimsLeavesPreview && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Migration Preview:</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2">
                <strong>Collections to migrate:</strong>
              </Typography>
              <Typography variant="body2">
                • Claims: {claimsLeavesPreview.preview?.claims.length || 0} documents
              </Typography>
              <Typography variant="body2">
                • Leaves: {claimsLeavesPreview.preview?.leaves.length || 0} documents
              </Typography>
              <Typography variant="body2">
                • Attendance: {claimsLeavesPreview.preview?.attendance.length || 0} documents
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>Total documents:</strong> {claimsLeavesPreview.totalCount || 0}
              </Typography>
            </Paper>
          </Box>
        )}

        {claimsLeavesResult && (
          <Box sx={{ mt: 3 }}>
            <Alert 
              severity={claimsLeavesResult.success ? "success" : "error"}
              icon={claimsLeavesResult.success ? <CheckCircle /> : <Error />}
            >
              {claimsLeavesResult.success ? claimsLeavesResult.message : `Migration failed: ${claimsLeavesResult.error}`}
            </Alert>
          </Box>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>What this migration does:</Typography>
          <Typography variant="body2" component="div">
            <ul>
              <li>Updates all Claims documents: `companyName` → `originalCompanyName`</li>
              <li>Updates all Leaves documents: `companyName` → `originalCompanyName`</li>
              <li>Updates all Attendance documents: `companyName` → `originalCompanyName`</li>
              <li>Removes the old `companyName` field from all documents</li>
              <li>Ensures consistent field naming across all collections</li>
            </ul>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default DatabaseMigration;