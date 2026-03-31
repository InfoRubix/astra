import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * LoadingSpinner - A full-screen centered loading indicator.
 *
 * Displays an MUI CircularProgress spinner with an optional
 * text message beneath it. Intended to be shown while data
 * or authentication state is being resolved.
 *
 * @param {Object} props
 * @param {string} [props.message="Loading..."] - Text displayed below the spinner.
 * @returns {JSX.Element}
 */
function LoadingSpinner({ message = "Loading..." }) {
  return (
    <Box 
      className="loading-container"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 2
      }}
    >
      <CircularProgress size={60} />
      <Typography variant="h6" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

export default LoadingSpinner;