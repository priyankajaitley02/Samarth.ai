import React from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { AccessibilityNew } from '@mui/icons-material';

const ParkinsonsTherapyComponent = () => {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccessibilityNew sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h5">Parkinson's Treatment</Typography>
        </Box>
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>Key Treatments:</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2">• Movement Therapy</Typography>
              <Typography variant="body2">• Balance Training</Typography>
              <Typography variant="body2">• Gait Improvement</Typography>
              <Typography variant="body2">• Tremor Management</Typography>
            </Grid>
          </Grid>
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>Exercise Program:</Typography>
          <Typography variant="body2">
            Customized exercises focusing on flexibility, balance, and coordination to manage symptoms and improve daily function.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default ParkinsonsTherapyComponent;