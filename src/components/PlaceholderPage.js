import React from 'react';
import {
  Container,
  Typography,
  Paper,
  Box
} from '@mui/material';

function PlaceholderPage({ title, description, icon }) {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {icon && <span style={{ marginRight: '8px', verticalAlign: 'middle' }}>{icon}</span>}
          {title}
        </Typography>
        {description && (
          <Typography variant="subtitle1" color="textSecondary">
            {description}
          </Typography>
        )}
      </Box>

      <Paper sx={{ p: 3, textAlign: 'center', height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          {title} Interface Coming Soon
        </Typography>
      </Paper>
    </Container>
  );
}

export default PlaceholderPage;