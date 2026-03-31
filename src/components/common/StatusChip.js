import React from 'react';
import { Chip } from '@mui/material';
import { CheckCircle, Cancel, Schedule, HourglassEmpty } from '@mui/icons-material';

/**
 * Maps a status string to an MUI Chip color.
 * @param {string} status
 * @returns {string} MUI color value for Chip
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'approved':
    case 'completed':
      return 'success';
    case 'rejected':
      return 'error';
    case 'pending':
      return 'warning';
    case 'in_progress':
    case 'present':
      return 'info';
    default:
      return 'default';
  }
};

/**
 * Maps a status string to a corresponding MUI icon element.
 * @param {string} status
 * @returns {React.ReactElement} icon component
 */
export const getStatusIcon = (status) => {
  switch (status) {
    case 'approved':
    case 'completed':
      return <CheckCircle />;
    case 'rejected':
      return <Cancel />;
    case 'pending':
      return <HourglassEmpty />;
    case 'in_progress':
    case 'present':
      return <Schedule />;
    default:
      return <Schedule />;
  }
};

/**
 * Formats a status string for display.
 * Capitalizes the first letter and replaces underscores with spaces.
 * @param {string} status
 * @returns {string} formatted label
 */
const formatStatusLabel = (status) => {
  if (!status) return '';
  const label = status.replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/**
 * A reusable status chip component that renders an MUI Chip
 * with color and icon derived from the given status string.
 *
 * @param {object} props
 * @param {string} props.status - The status value (e.g. 'approved', 'pending', 'rejected')
 * @param {string} [props.size='small'] - Chip size
 * @param {object} chipProps - Any additional props forwarded to the MUI Chip
 */
const StatusChip = ({ status, size = 'small', ...chipProps }) => {
  return (
    <Chip
      label={formatStatusLabel(status)}
      color={getStatusColor(status)}
      icon={getStatusIcon(status)}
      size={size}
      {...chipProps}
    />
  );
};

export default StatusChip;
