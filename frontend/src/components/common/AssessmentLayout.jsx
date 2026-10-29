import React from 'react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress
} from '@mui/material';
import CustomButton from './CustomButton';

const AssessmentLayout = ({
  title,
  description,
  isLoading,
  isAssessing,
  error,
  onStart,
  onStop,
  onComplete,
  loadingText,
  children,
  actions,
  metrics,
  showCompleteButton = false,
  completeButtonText = 'Complete'
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 2 }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      
      {error ? (
        <Typography color="error" align="center">
          {error}
        </Typography>
      ) : (
        <>
          {React.isValidElement(description) ? (
            description
          ) : (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }} component="div">
              {description}
            </Typography>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                {loadingText || 'Loading...'}
              </Typography>
            </Box>
          ) : (
            <>
              {children}

              {actions || (
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  {!showCompleteButton && (
                    <CustomButton
                      variant="contained"
                      color={isAssessing ? 'error' : 'primary'}
                      onClick={isAssessing ? onStop : onStart}
                      sx={{ minWidth: 200 }}
                    >
                      {isAssessing ? 'Stop Assessment' : 'Start Assessment'}
                    </CustomButton>
                  )}
                  {showCompleteButton && onComplete && (
                    <CustomButton
                      variant="contained"
                      color="success"
                      onClick={onComplete}
                      sx={{ minWidth: 200 }}
                    >
                      {completeButtonText}
                    </CustomButton>
                  )}
                </Box>
              )}

              {metrics && !showCompleteButton && (
                <Paper sx={{ p: 2, width: '100%', maxWidth: 500 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Assessment Metrics
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {Object.entries(metrics).map(([key, value]) => (
                      <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}:
                        </Typography>
                        <Typography variant="body2">
                          {typeof value === 'object' ? JSON.stringify(value) : value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};

export default AssessmentLayout;