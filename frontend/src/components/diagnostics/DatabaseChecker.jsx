import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Stack,
  Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import { checkAssessmentData, runSystemDiagnostic } from '../../utils/databaseChecker';
import { migrateAssessmentData } from '../../utils/dataMigration';
import { useAuth } from '../../contexts/AuthContext';

const DatabaseChecker = () => {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const { user } = useAuth();
  
  const handleCheck = async () => {
    if (!user?.id) {
      setError('User is not logged in');
      return;
    }
    
    setChecking(true);
    setError(null);
    
    try {
      const diagnostic = await runSystemDiagnostic();
      setResult(diagnostic);
    } catch (err) {
      setError(`Error running diagnostic: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };
  
  const handleFixDatabase = async () => {
    if (!user?.id) {
      setError('User is not logged in');
      return;
    }
    
    setMigrating(true);
    setError(null);
    
    try {
      const result = await migrateAssessmentData(user.id);
      setMigrationResult(result);
      
      if (result.success) {
        // Re-run diagnostic to see if issues are fixed
        await handleCheck();
      } else {
        setError(`Migration failed: ${result.message}`);
      }
    } catch (err) {
      setError(`Error fixing database: ${err.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'error':
        return <ErrorIcon />;
      default:
        return null;
    }
  };
  
  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <StorageIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Database Diagnostic Tool</Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        This tool checks if your assessment data is properly stored in the database.
        Run this diagnostic if you're experiencing issues with your assessment history.
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={handleCheck}
        disabled={checking || !user?.id}
        fullWidth
        sx={{ mb: 3 }}
      >
        {checking ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
        {checking ? 'Running Diagnostic...' : 'Run Database Check'}
      </Button>
      
      {result?.database?.status === 'issue' && (
        <Button
          variant="contained"
          color="warning"
          onClick={handleFixDatabase}
          disabled={migrating}
          fullWidth
          sx={{ mb: 3, mt: 1 }}
        >
          {migrating ? <CircularProgress size={24} sx={{ mr: 1 }} /> : null}
          {migrating ? 'Fixing Database Issues...' : 'Fix Database Issues'}
        </Button>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {migrationResult && (
        <Alert 
          severity={migrationResult.success ? 'success' : 'error'}
          sx={{ mb: 2 }}
        >
          {migrationResult.message}
        </Alert>
      )}
      
      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert 
            severity={getStatusColor(result.status)}
            icon={getStatusIcon(result.status)}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle1">
              System Status: {result.status.toUpperCase()}
            </Typography>
            {result.status === 'warning' && 
              'There may be issues with your system. Review the details below.'}
            {result.status === 'error' && 
              'System diagnostics detected errors. Review the details below.'}
            {result.status === 'ok' && 
              'All systems are functioning correctly.'}
          </Alert>
          
          <Divider sx={{ mb: 2 }} />
          
          <Stack spacing={2}>
            {/* Auth Status */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Typography>Authentication</Typography>
                  <Chip 
                    label={result.auth.status} 
                    color={getStatusColor(result.auth.status)} 
                    size="small"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">
                  Token Status: {result.auth.hasToken ? 'Present' : 'Missing'}<br />
                  User ID: {result.auth.userId || 'Not found'}
                </Typography>
              </AccordionDetails>
            </Accordion>
            
            {/* API Status */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Typography>API Connectivity</Typography>
                  <Chip 
                    label={result.api.status} 
                    color={getStatusColor(result.api.status)} 
                    size="small"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">
                  Status: {result.api.message}<br />
                  {result.api.details.environment && `Environment: ${result.api.details.environment}`}<br />
                  {result.api.details.database && `Database: ${result.api.details.database.status}`}
                </Typography>
              </AccordionDetails>
            </Accordion>
            
            {/* Database Status */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <Typography>Database Content</Typography>
                  <Chip 
                    label={result.database.status} 
                    color={getStatusColor(result.database.status)} 
                    size="small"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {result.database.status === 'skipped' ? (
                  <Typography variant="body2">
                    Database check skipped: {result.database.message}
                  </Typography>
                ) : result.database.details?.generalAssessments ? (
                  <>
                    <Typography variant="body2" gutterBottom>
                      User has data: {result.database.hasData ? 'Yes' : 'No'}<br />
                      Total assessments found: {result.database.details.summary?.totalAssessments || 0}
                    </Typography>
                    
                    {result.database.details.generalAssessments.count > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 1 }}>
                          Assessment Types:
                        </Typography>
                        {Object.entries(result.database.details.specificAssessments).map(([type, data]) => (
                          <Typography key={type} variant="body2">
                            {type}: {data.count} {data.count === 1 ? 'assessment' : 'assessments'}
                          </Typography>
                        ))}
                      </>
                    )}
                    <Box sx={{ mt: 2, border: '1px solid #eee', p: 1, borderRadius: 1 }}>
                      <Typography variant="subtitle2">Collection Details:</Typography>
                      <Typography variant="body2">
                        General Assessment Collection: {result.database.details.generalAssessments.count} documents
                      </Typography>
                      
                      {Object.entries(result.database.details.specificAssessments).map(([type, data]) => (
                        <Typography key={type} variant="body2">
                          {type} Collection: {data.count} documents
                          {data.sample && ` (Latest ID: ${data.sample.id})`}
                        </Typography>
                      ))}
                      
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2">Sample Document:</Typography>
                        {result.database.details.generalAssessments.samples.length > 0 ? (
                          <pre style={{ fontSize: '0.7rem', overflowX: 'auto' }}>
                            {JSON.stringify(result.database.details.generalAssessments.samples[0], null, 2)}
                          </pre>
                        ) : (
                          <Typography variant="body2" color="text.secondary">No samples available</Typography>
                        )}
                      </Box>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" color="error">
                    {result.database.message || 'Unable to check database content'}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          </Stack>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Diagnostic run at: {new Date(result.timestamp).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default DatabaseChecker;
