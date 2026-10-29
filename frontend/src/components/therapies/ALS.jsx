import React from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { LocalHospital } from '@mui/icons-material';

const ALSTherapyComponent = () => {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <LocalHospital sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h5">ALS Treatment</Typography>
        </Box>
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>Key Treatments:</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2">• Respiratory Therapy</Typography>
              <Typography variant="body2">• Physical Therapy</Typography>
              <Typography variant="body2">• Speech Therapy</Typography>
              <Typography variant="body2">• Occupational Therapy</Typography>
            </Grid>
          </Grid>
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>Care Approach:</Typography>
          <Typography variant="body2">
            Comprehensive care focusing on maintaining muscle function, breathing support, and quality of life improvements.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default ALSTherapyComponent;