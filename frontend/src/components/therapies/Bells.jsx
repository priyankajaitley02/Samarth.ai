import React from 'react';
import { Box, Paper, Typography, Grid } from '@mui/material';
import { RecordVoiceOver } from '@mui/icons-material';

const BellsPalsyTherapyComponent = () => {
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RecordVoiceOver sx={{ fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h5">Bell's Palsy Treatment</Typography>
        </Box>
        
        <Box>
          <Typography variant="subtitle1" gutterBottom>Key Treatments:</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2">• Facial Exercises</Typography>
              <Typography variant="body2">• Muscle Stimulation</Typography>
              <Typography variant="body2">• Eye Care</Typography>
              <Typography variant="body2">• Speech Therapy</Typography>
            </Grid>
          </Grid>
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>Recovery Program:</Typography>
          <Typography variant="body2">
            Targeted facial exercises and nerve stimulation techniques to restore muscle function and symmetry.
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default BellsPalsyTherapyComponent;