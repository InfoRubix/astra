import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import DatabaseMigration from '../../components/admin/DatabaseMigration';

function Migration() {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Database Migration
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Update your Firebase database to support multiple companies
        </Typography>
        
        <DatabaseMigration />
      </Box>
    </Container>
  );
}

export default Migration;