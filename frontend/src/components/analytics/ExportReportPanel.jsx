import { useState } from 'react';
import { Box, Typography, Paper, Grid, Button, Checkbox, FormControlLabel, Alert, CircularProgress } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { generatePdfReport } from '../../services/assessmentService';

const ExportReportPanel = ({ userId, assessmentTypes, fullAssessmentData = [] }) => {
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSelectAll = (event) => {
    const checked = event.target.checked;
    setSelectAll(checked);
    setSelectedTypes(checked ? assessmentTypes.map(type => type.type) : []);
  };

  const handleSelectType = (type) => {
    if (selectedTypes.includes(type)) {
      // Remove type
      setSelectedTypes(selectedTypes.filter(t => t !== type));
      setSelectAll(false);
    } else {
      // Add type
      const newSelected = [...selectedTypes, type];
      setSelectedTypes(newSelected);
      setSelectAll(newSelected.length === assessmentTypes.length);
    }
  };

  const handleExportReport = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      if (selectedTypes.length === 0) {
        setError('Please select at least one assessment type');
        setLoading(false);
        return;
      }
      
      console.log('Exporting report for types:', selectedTypes);
      
      // Create assessment data object with only selected types
      const filteredAssessmentData = {};
      
      // Map selected types to their data from fullAssessmentData
      selectedTypes.forEach(type => {
        const assessmentsOfType = fullAssessmentData.filter(assessment => assessment.type === type);
        if (assessmentsOfType.length > 0) {
          // Use the most recent assessment of this type
          filteredAssessmentData[type] = assessmentsOfType.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          )[0];
        }
      });
      
      console.log('Filtered assessment data:', filteredAssessmentData);
      
      // Pass the filtered data along with user ID
      await generatePdfReport(userId, filteredAssessmentData);
      
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
      setLoading(false);
    }
  };

  // Show debugging info in dev mode
  // const showDebug = () => {
  //   if (!import.meta.env.DEV) return null;
    
  //   return (
  //     <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', fontSize: '0.75rem', borderRadius: 1 }}>
  //       <Typography variant="caption" component="div" sx={{ fontWeight: 'bold' }}>Debug Info:</Typography>
  //       <div>Selected Types: {selectedTypes.join(', ')}</div>
  //       <div>All Types Count: {assessmentTypes.length}</div>
  //       <div>Full Assessment Data: {fullAssessmentData.length} assessments</div>
  //       <div>Available Type IDs: {assessmentTypes.map(t => t.type).join(', ')}</div>
  //     </Box>
  //   );
  // };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Assessment Report
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        Generate a comprehensive PDF report of your selected assessment types. This report includes detailed metrics, 
        visualizations, and progress tracking.
      </Typography>
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Report generated successfully! Check your downloads folder.
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Checkbox 
              checked={selectAll} 
              onChange={handleSelectAll}
              disabled={loading || assessmentTypes.length === 0}
            />
          }
          label="Select All Assessment Types"
        />
      </Box>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {assessmentTypes.map((type) => (
          <Grid item xs={12} sm={6} md={4} key={type.type}>
            <FormControlLabel
              control={
                <Checkbox 
                  checked={selectedTypes.includes(type.type)} 
                  onChange={() => handleSelectType(type.type)}
                  disabled={loading}
                />
              }
              label={`${type.name} (${type.count})`}
            />
          </Grid>
        ))}
      </Grid>
      
      {assessmentTypes.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No assessment data available. Complete some assessments first to generate a report.
        </Alert>
      )}
      
      <Button 
        variant="contained" 
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
        onClick={handleExportReport}
        disabled={loading || selectedTypes.length === 0}
        sx={{ mt: 2 }}
      >
        {loading ? 'Generating Report...' : 'Generate PDF Report'}
      </Button>
      
      {/* Debug information in dev mode */}
      {/* {import.meta.env.DEV && showDebug()} */}
    </Paper>
  );
};

export default ExportReportPanel;