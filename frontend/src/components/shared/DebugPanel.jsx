import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Collapse } from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';

const DebugPanel = ({ data, title = 'Debug Information' }) => {
  const [open, setOpen] = useState(false);
  const isDev = import.meta.env.DEV;
  
  if (!isDev) return null;
  
  return (
    <Box sx={{ mt: 2, opacity: 0.7, '&:hover': { opacity: 1 } }}>
      <Button 
        size="small" 
        startIcon={<CodeIcon />}
        onClick={() => setOpen(!open)}
        sx={{ mb: 1 }}
      >
        {open ? 'Hide' : 'Show'} Debug Info
      </Button>
      
      <Collapse in={open}>
        <Paper sx={{ p: 2, bgcolor: 'black', color: 'lightgreen' }}>
          <Typography variant="subtitle2">{title}</Typography>
          <pre style={{ overflowX: 'auto' }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </Paper>
      </Collapse>
    </Box>
  );
};

export default DebugPanel;
