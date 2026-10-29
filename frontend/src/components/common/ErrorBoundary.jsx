import React, { Suspense } from 'react';
import { Box, Typography, Button } from '@mui/material';

const ErrorOutlineIcon = React.lazy(() => import('@mui/icons-material/ErrorOutline'));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box 
          sx={{ 
            p: 3, 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2 
          }}
        >
          <Suspense fallback={<div>Loading...</div>}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />
          </Suspense>
          <Typography variant="h6" color="error">
            Something went wrong
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;