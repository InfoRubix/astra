import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Avatar
} from '@mui/material';
import {
  AccessTime,
  Warning,
  Info,
  CheckCircle
} from '@mui/icons-material';
import { format, differenceInMinutes } from 'date-fns';
import { getRawCheckIn, getRawCheckOut } from '../../utils/attendanceHelpers';
import { forgottenCheckoutService } from '../../utils/forgottenCheckoutService';
import { useAuth } from '../../contexts/AuthContext';

/**
 * ForgottenCheckoutDialog - Modal dialog for submitting a forgotten check-out request.
 *
 * Displays the current attendance record's check-in time, lets the user
 * pick a requested check-out time, select a reason, and provide an
 * optional description. Validates the requested time against the
 * check-in time, calculates working hours, and submits the request
 * to the forgottenCheckoutService for admin approval.
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is visible.
 * @param {Function} props.onClose - Callback to close the dialog.
 * @param {Object} props.attendanceRecord - The attendance record missing a check-out. Should include fields such as `id`, `date`/`dateString`, `checkInTime`, etc.
 * @param {Function} [props.onSuccess] - Optional callback invoked after a successful submission so the parent can refresh data.
 * @returns {JSX.Element|null} Returns null when no attendanceRecord is provided.
 */
function ForgottenCheckoutDialog({ open, onClose, attendanceRecord, onSuccess }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    requestedCheckOutTime: '',
    reason: 'forgot',
    description: ''
  });
  const [validation, setValidation] = useState(null);

  const handleTimeChange = (time) => {
    setForm(prev => ({ ...prev, requestedCheckOutTime: time }));
    
    if (time && checkInTime) {
      try {
        // Use the resolved checkInTime from our helper function
        const dateString = attendanceRecord.dateString || 
          (attendanceRecord.date?.toDate ? 
            attendanceRecord.date.toDate().toISOString().split('T')[0] :
            (typeof attendanceRecord.date === 'string' ? 
              attendanceRecord.date.split('T')[0] : 
              new Date(attendanceRecord.date).toISOString().split('T')[0]));
        
        const requestedTime = new Date(`${dateString}T${time}:00`);
        
        const validationResult = forgottenCheckoutService.validateCheckoutTime(
          checkInTime, 
          requestedTime, 
          attendanceRecord.date || attendanceRecord.dateString
        );
        
        setValidation(validationResult);
      } catch (error) {
        console.error('Error validating checkout time:', error);
        setValidation({
          valid: false,
          message: 'Invalid date format',
          workingHours: 0
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!form.requestedCheckOutTime) {
      setError('Please select a check-out time');
      return;
    }

    if (!validation?.valid) {
      setError(validation?.message || 'Invalid check-out time');
      return;
    }

    // Check if there's already a pending request for this attendance record
    try {
      const canSubmit = await forgottenCheckoutService.canSubmitRequest(
        user.uid, 
        attendanceRecord.date, 
        attendanceRecord.id
      );
      
      if (!canSubmit.canSubmit) {
        setError(canSubmit.message);
        return;
      }
    } catch (error) {
      console.error('Error checking if can submit:', error);
    }

    setLoading(true);
    setError('');

    try {
      const dateString = attendanceRecord.dateString || 
        (attendanceRecord.date?.toDate ? 
          attendanceRecord.date.toDate().toISOString().split('T')[0] :
          (typeof attendanceRecord.date === 'string' ? 
            attendanceRecord.date.split('T')[0] : 
            new Date(attendanceRecord.date).toISOString().split('T')[0]));

      const requestData = {
        userId: user.uid,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        company: user.company || user.originalCompanyName || 'RUBIX',
        attendanceId: attendanceRecord.id,
        date: attendanceRecord.date || attendanceRecord.dateString,
        checkInTime: checkInTime, // Use the resolved checkInTime
        requestedCheckOutTime: new Date(`${dateString}T${form.requestedCheckOutTime}:00`),
        reason: form.reason,
        description: form.description.trim()
      };

      const result = await forgottenCheckoutService.submitForgottenCheckoutRequest(requestData);
      
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          onSuccess && onSuccess();
          onClose();
          resetForm();
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting forgotten check-out request:', error);
      setError(error.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      requestedCheckOutTime: '',
      reason: 'forgot',
      description: ''
    });
    setValidation(null);
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!attendanceRecord) return null;

  const checkInTime = (() => {
    try {
      // Check for various possible field names for check-in time
      const possibleCheckInFields = ['checkInTime', 'clockInTime', 'checkinTime', 'timeIn', 'startTime'];
      let checkInValue = null;
      
      for (const field of possibleCheckInFields) {
        if (attendanceRecord[field] !== undefined && attendanceRecord[field] !== null) {
          checkInValue = attendanceRecord[field];
          break;
        }
      }
      
      if (!checkInValue) {
        // If no actual check-in time exists, create a default one (9 AM on the record date)
        const recordDate = attendanceRecord.dateString || attendanceRecord.date;
        if (recordDate) {
          const defaultTime = new Date(recordDate);
          defaultTime.setHours(9, 0, 0, 0); // Default to 9:00 AM
          return defaultTime;
        }
        return null;
      }
      
      return checkInValue?.toDate ? checkInValue.toDate() : new Date(checkInValue);
    } catch (error) {
      console.error('Error parsing check-in time:', error);
      return null;
    }
  })();

  const workingHours = validation?.workingHours || 0;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
            <AccessTime />
          </Avatar>
          <Box>
            <Typography variant="h6">
              Request Forgotten Check-out
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(() => {
                try {
                  // Handle both dateString and date fields
                  let date;
                  if (attendanceRecord.dateString) {
                    date = new Date(attendanceRecord.dateString);
                  } else if (attendanceRecord.date?.toDate) {
                    date = attendanceRecord.date.toDate();
                  } else if (attendanceRecord.date) {
                    date = new Date(attendanceRecord.date);
                  } else {
                    return 'No date available';
                  }
                  
                  if (isNaN(date.getTime())) {
                    return 'Invalid date';
                  }
                  
                  return format(date, 'dd/MM/yyyy');
                } catch (error) {
                  console.error('Error formatting date:', error);
                  return 'Invalid date';
                }
              })()}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Current Attendance Info */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            Current Attendance Record
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Check-in Time:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {(() => {
                  try {
                    if (!checkInTime) return 'N/A';
                    return format(checkInTime, 'HH:mm');
                  } catch (error) {
                    console.error('Error formatting check-in time:', error);
                    return 'N/A';
                  }
                })()}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Check-out Time:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                <Chip 
                  label="Missing" 
                  size="small" 
                  color="warning" 
                  variant="outlined"
                />
              </Typography>
            </Grid>
          </Grid>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              label="Requested Check-out Time"
              type="time"
              fullWidth
              value={form.requestedCheckOutTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
              helperText="Enter the time you actually left the office"
            />
          </Grid>

          {/* Validation Display */}
          {validation && (
            <Grid item xs={12}>
              {validation.valid ? (
                <Alert 
                  severity={validation.isReasonable ? "success" : "warning"} 
                  icon={validation.isReasonable ? <CheckCircle /> : <Warning />}
                >
                  <Typography variant="body2">
                    <strong>Working Hours: {workingHours.toFixed(1)} hours</strong>
                    {validation.warningMessage && (
                      <>
                        <br />
                        {validation.warningMessage}
                      </>
                    )}
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="error">
                  <Typography variant="body2">
                    {validation.message}
                  </Typography>
                </Alert>
              )}
            </Grid>
          )}

          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Reason</InputLabel>
              <Select
                value={form.reason}
                label="Reason"
                onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
              >
                <MenuItem value="forgot">Forgot to check out</MenuItem>
                <MenuItem value="emergency">Emergency situation</MenuItem>
                <MenuItem value="system_error">System error/malfunction</MenuItem>
                <MenuItem value="meeting">Extended meeting/overtime</MenuItem>
                <MenuItem value="other">Other reason</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              label="Additional Description"
              multiline
              rows={3}
              fullWidth
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Please provide additional details about the situation (optional)"
              helperText={`${form.description.length}/500 characters`}
              inputProps={{ maxLength: 500 }}
            />
          </Grid>

          {/* Info Box */}
          <Grid item xs={12}>
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>What happens next?</strong>
                <br />
                • Your request will be sent to admin for review
                <br />
                • You'll receive a notification once it's processed
                <br />
                • If approved, your attendance record will be updated
                <br />
                • You can track the status in your attendance history
              </Typography>
            </Alert>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          sx={{ mr: 1 }}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading || !validation?.valid}
          sx={{ minWidth: 120 }}
        >
          {loading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ForgottenCheckoutDialog;