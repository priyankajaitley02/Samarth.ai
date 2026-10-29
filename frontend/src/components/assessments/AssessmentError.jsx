import React, { Suspense } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';

// Lazy load icons
const RefreshIcon = React.lazy(() => import('@mui/icons-material/Refresh'));
const ErrorOutlineIcon = React.lazy(() => import('@mui/icons-material/ErrorOutline'));

const IconFallback = () => (
  <CircularProgress size={24} />
);

const AssessmentError = ({ onRetry }) => {
  return (
    <Box 
      sx={{ 
        p: 4, 
        textAlign: 'center',
        maxWidth: 400,
        mx: 'auto'
      }}
    >
      <Suspense fallback={<IconFallback />}>
        <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      </Suspense>
      <Typography variant="h5" gutterBottom>
        Assessment Error
      </Typography>
      <Typography color="text.secondary" paragraph>
        There was a problem processing your assessment. Please try again.
      </Typography>
      <Button
        variant="contained"
        onClick={onRetry}
        startIcon={
          <Suspense fallback={<IconFallback />}>
            <RefreshIcon />
          </Suspense>
        }
      >
        Retry Assessment
      </Button>
    </Box>
  );
};

export default AssessmentError;