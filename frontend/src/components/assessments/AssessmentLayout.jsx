import React from 'react';
import { Box, Typography, Paper, LinearProgress, Alert, useTheme } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const AssessmentLayout = ({
  title,
  description,
  children,
  isLoading,
  isAssessing,
  error,
  metrics
}) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {title}
        </Typography>
        
        {description && (
          <Box sx={{ mb: 2 }}>
            {React.isValidElement(description) ? (
              description
            ) : (
              <Typography variant="body1" color="text.secondary">
                {description}
              </Typography>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isLoading && <LinearProgress sx={{ mb: 2 }} />}

        {children}
      </Paper>

      {metrics && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Assessment Results
          </Typography>
          {/* Render metrics visualization components */}
        </Paper>
      )}
    </Box>
  );
};

export default AssessmentLayout; 