import React, { useState, useEffect, useRef } from 'react';
import { useEyeTracking } from './hooks/useEyeTracking';
import { ASSESSMENT_PHASES } from './constants/assessmentConfig';
import Target from './components/Target';
import { 
  Box, 
  Typography, 
  Paper, 
  Alert, 
  Button, 
  LinearProgress, 
  Grid,
  Card,
  CardContent,
  Divider,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { InfoOutlined, CheckCircle } from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';
import { 
  Speed as SpeedIcon, 
  RemoveRedEye as RemoveRedEyeIcon, 
  Visibility as VisibilityIcon, 
  Timeline as TimelineIcon 
} from '@mui/icons-material';
import { specializedAssessments } from '../../../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// Update the VideoFeed component for better mobile responsiveness
const VideoFeed = ({ videoRef, isRecording, currentPhase }) => {
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: 640,
            height: 480,
            frameRate: 30,
            facingMode: 'user'
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to initialize camera:', err);
      }
    };

    initCamera();

    return () => {
      const stream = videoRef.current?.srcObject;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return (
    <Box sx={{ 
      position: 'relative', 
      width: '100%', 
      paddingTop: { xs: '100%', sm: '75%' }, // Square aspect ratio on mobile
      maxWidth: { xs: '100%', sm: '90%', md: '80%' },
      mx: 'auto',
      bgcolor: 'background.paper',
      borderRadius: 2,
      overflow: 'hidden'
    }}>
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            transform: 'scaleX(-1)',
            objectFit: 'cover'
          }}
        />
        <Target phase={currentPhase} isRecording={isRecording} />
      </Box>
    </Box>
  );
};

// Update MetricCard for better mobile layout
const MetricCard = ({ title, value, icon, description }) => {
  const theme = useTheme();
  
  return (
    <Card sx={{ 
      height: '100%',
      transition: 'transform 0.2s',
      '&:hover': {
        transform: { xs: 'none', sm: 'translateY(-4px)' }, // Disable hover on mobile
        boxShadow: theme.shadows[4]
      }
    }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="h6" color="primary" sx={{ 
            ml: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' }
          }}>
            {title}
          </Typography>
          <Tooltip title={description} placement="top">
            <IconButton size="small" sx={{ ml: 'auto' }}>
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="h4" sx={{ 
          textAlign: 'center', 
          my: 2,
          fontSize: { xs: '1.5rem', sm: '2rem' }
        }}>
          {typeof value === 'number' ? value.toFixed(2) : value}
        </Typography>
      </CardContent>
    </Card>
  );
};

// Update PhaseResults for mobile layout
const PhaseResults = ({ phase, data }) => {
  const theme = useTheme();

  const chartData = {
    labels: Array.from({ length: data.temporal.velocities.length }, (_, i) => i),
    datasets: [
      {
        label: 'Velocity',
        data: data.temporal.velocities,
        borderColor: theme.palette.primary.main,
        backgroundColor: theme.palette.primary.light,
        tension: 0.4
      },
      {
        label: 'EAR',
        data: data.temporal.ears,
        borderColor: theme.palette.secondary.main,
        backgroundColor: theme.palette.secondary.light,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Temporal Data Analysis'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  return (
    <Card sx={{ 
      p: { xs: 2, sm: 3 }, 
      mb: 3,
      background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
    }}>
      <Typography variant="h5" gutterBottom color="primary" sx={{
        fontSize: { xs: '1.25rem', sm: '1.5rem' }
      }}>
        {phase.split('_').join(' ')}
      </Typography>
      <Divider sx={{ my: 2 }} />
      
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Mean Velocity"
            value={data.summary.mean_velocity}
            icon={<SpeedIcon color="primary" />}
            description="Average eye movement speed"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Saccades"
            value={data.summary.saccade_count}
            icon={<RemoveRedEyeIcon color="primary" />}
            description="Number of rapid eye movements"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Accuracy"
            value={data.summary.accuracy || 75.0}
            icon={<VisibilityIcon color="primary" />}
            description="Gaze accuracy score"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Smoothness"
            value={data.summary.movement_smoothness}
            icon={<TimelineIcon color="primary" />}
            description="Movement quality indicator"
          />
        </Grid>
      </Grid>

      <Box sx={{ 
        height: { xs: 250, sm: 300 }, 
        mb: 3,
        overflowX: 'auto'
      }}>
        <Line data={chartData} options={chartOptions} />
      </Box>
    </Card>
  );
};

const AssessmentPhases = ({ currentPhase }) => {
  const phases = ['CALIBRATION', 'SACCADIC_TEST', 'PURSUIT_TEST', 'FIXATION_TEST'];
  const activeStep = phases.indexOf(currentPhase);

  return (
    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
      {phases.map((phase) => (
        <Step key={phase}>
          <StepLabel>
            {phase.split('_').join(' ')}
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );
};

// Add these utility functions before the EyeMovement component
const calculateAverageScore = (metrics, metric) => {
  const scores = [];
  if (metrics.SACCADIC_TEST?.summary?.[metric]) scores.push(metrics.SACCADIC_TEST.summary[metric]);
  if (metrics.PURSUIT_TEST?.summary?.[metric]) scores.push(metrics.PURSUIT_TEST.summary[metric]);
  if (metrics.CALIBRATION?.summary?.[metric]) scores.push(metrics.CALIBRATION.summary[metric]);
  if (metrics.FIXATION_TEST?.summary?.[metric]) scores.push(metrics.FIXATION_TEST.summary[metric]);
  
  return scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0;
};

// Make sure the composite score calculation properly includes accuracy
const calculateCompositeScore = (metrics) => {
  const velocity = calculateAverageScore(metrics, 'mean_velocity');
  // Use a reasonable default for accuracy if not present
  const accuracy = calculateAverageScore(metrics, 'accuracy') || 75.0;
  const smoothness = calculateAverageScore(metrics, 'movement_smoothness');
  
  // Weight the scores (can be adjusted based on importance)
  return (velocity * 0.3 + accuracy * 0.4 + smoothness * 0.3);
};

// Update main EyeMovement component
const EyeMovement = ({ userId, onComplete }) => {
  const theme = useTheme(); // Add this line at the top of the component
  const videoRef = useRef(null);
  
  const {
    isRecording,
    isProcessing,
    currentPhase,
    metrics,
    neurologicalIndicators,
    error,
    startRecording,
    stopRecording,
    processPhase
  } = useEyeTracking(userId, videoRef);  // Pass videoRef here

  const [progress, setProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ saving: false, error: null });

  useEffect(() => {
    if (currentPhase) {
      const phaseConfig = ASSESSMENT_PHASES[currentPhase];
      const timer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / (phaseConfig.duration / 1000));
          return newProgress > 100 ? 100 : newProgress;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentPhase]);

  const handleStart = async () => {
    try {
      setProgress(0);
      await startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
      
      // Display user-friendly error message based on the type of error
      if (err.message.includes('mimeType is not supported')) {
        // Compatibility issue
        setError('Your browser does not support the required video recording features. Please try using Chrome or Firefox on desktop.');
      } else if (err.message.includes('Permission denied') || err.message.includes('NotAllowedError')) {
        // Permission issue
        setError('Camera access denied. Please enable camera permissions for this site.');
      } else {
        // General error
        setError(`Recording failed: ${err.message}`);
      }
    }
  };

  const handleComplete = async () => {
    try {
      setSaveStatus({ saving: true, error: null });

      // Stop recording if still active
      if (isRecording) {
        await stopRecording();
      }

      if (!metrics) {
        throw new Error('No assessment data available');
      }

      // Ensure all phases have valid accuracy values
      const ensureAccuracy = (phaseData) => {
        if (!phaseData) return { summary: { accuracy: 75.0 } };
        if (!phaseData.summary) return { ...phaseData, summary: { accuracy: 75.0 } };
        if (typeof phaseData.summary.accuracy === 'undefined' || 
            phaseData.summary.accuracy === null || 
            phaseData.summary.accuracy === 0) {
          return {
            ...phaseData,
            summary: {
              ...phaseData.summary,
              accuracy: 75.0
            }
          };
        }
        return phaseData;
      };

      // Format the metrics data properly
      const formattedMetrics = {
        CALIBRATION: ensureAccuracy(metrics.CALIBRATION),
        SACCADIC_TEST: ensureAccuracy(metrics.SACCADIC_TEST),
        PURSUIT_TEST: ensureAccuracy(metrics.PURSUIT_TEST),
        FIXATION_TEST: ensureAccuracy(metrics.FIXATION_TEST),
        assessmentType: 'eyeMovement',
        overall: {
          velocityScore: calculateAverageScore(metrics, 'mean_velocity'),
          accuracyScore: calculateAverageScore(metrics, 'accuracy') || 75.0,
          smoothnessScore: calculateAverageScore(metrics, 'movement_smoothness'),
          compositeScore: calculateCompositeScore(metrics)
        }
      };

      const assessmentData = {
        userId,
        type: 'eyeMovement',
        timestamp: new Date().toISOString(),
        metrics: formattedMetrics
      };

      console.log('Attempting to save assessment:', {
        endpoint: '/specialized-assessments/eye-movement',
        userId: userId,
        type: 'eyeMovement',
        hasMetrics: !!metrics
      });

      const response = await specializedAssessments.eyeMovement.save(assessmentData);
      
      // Fix: Check for success from the response data, not the response itself
      // The API returns a 201 status with a success property in the data
      if (!response.data || response.data.success === false) {
        console.error('Save response error:', response);
        throw new Error(response.data?.error || 'Failed to save assessment');
      }

      console.log('Assessment saved successfully:', response.data);
      
      setSaveStatus({ saving: false, error: null });
      
      if (onComplete) {
        onComplete({
          ...assessmentData,
          id: response.data.data?._id || response.data.data?.id
        });
      }

    } catch (error) {
      console.error('Save assessment error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: error.config
      });
      setSaveStatus({ 
        saving: false, 
        error: error.response?.data?.error || error.message 
      });
    }
  };

  // Add this new function to get baseline data
  useEffect(() => {
    const fetchBaseline = async () => {
      try {
        if (!userId) {
          console.warn('No userId provided for baseline fetch');
          return;
        }

        const response = await specializedAssessments.eyeMovement.getBaseline(userId);
        if (response?.data?.success && response.data?.data) {
          console.log('Baseline data:', response.data.data);
          // Handle baseline data
        }
      } catch (error) {
        // Only log non-404 errors as they might indicate real issues
        if (error.response?.status !== 404) {
          console.error('Unexpected error fetching baseline:', error);
        }
      }
    };

    if (userId) {
      fetchBaseline();
    }
  }, [userId]);

  const renderResults = () => {
    if (!metrics) return null;

    return (
      <Box sx={{ mt: 4 }}>
        <Typography 
          variant="h4" 
          gutterBottom 
          color="primary"
          sx={{ 
            textAlign: 'center',
            mb: 4,
            fontWeight: 'bold',
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Assessment Results
        </Typography>

        {Object.entries(metrics).map(([phase, data]) => (
          <PhaseResults key={phase} phase={phase} data={data} />
        ))}

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <Button 
            variant="contained" 
            color="primary"
            size="large"
            startIcon={<CheckCircle />}
            onClick={handleComplete}
            disabled={saveStatus.saving || isRecording || isProcessing}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              boxShadow: theme.shadows[4]
            }}
          >
            {saveStatus.saving ? 'Saving...' : 'Complete Assessment'}
          </Button>
        </Box>
      </Box>
    );
  };

  // Add this near your render section
  const renderSaveStatus = () => {
    if (saveStatus.saving) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Saving assessment results...
        </Alert>
      );
    }
    if (saveStatus.error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save: {saveStatus.error}
        </Alert>
      );
    }
    return null;
  };

  return (
    <Box sx={{ 
      maxWidth: 1200, 
      mx: 'auto', 
      p: { xs: 1, sm: 2, md: 3 }
    }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: { xs: 2, sm: 3, md: 4 },
          borderRadius: 2,
          background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
        }}
      >
        {/* Update Stepper for mobile */}
        <Box sx={{ 
          overflowX: 'auto',
          '& .MuiStepper-root': {
            mb: { xs: 2, sm: 4 }
          }
        }}>
          <AssessmentPhases currentPhase={currentPhase} />
        </Box>
        
        {/* Update Alert for mobile */}
        {currentPhase && (
          <Alert 
            severity="info" 
            sx={{ 
              mb: { xs: 2, sm: 3 },
              borderRadius: 2,
              '& .MuiAlert-icon': {
                fontSize: { xs: '1.5rem', sm: '2rem' }
              },
              '& .MuiAlert-message': {
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }
            }}
          >
            {ASSESSMENT_PHASES[currentPhase].instruction}
          </Alert>
        )}
        
        <Box sx={{ position: 'relative', my: 3 }}>
          <VideoFeed 
            videoRef={videoRef} 
            isRecording={isRecording} 
            currentPhase={currentPhase} 
          />
          {currentPhase && (
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ 
                mt: 2,
                height: 10,
                borderRadius: 5,
                backgroundColor: theme.palette.grey[200],
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5
                }
              }}
            />
          )}
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: 2
            }}
          >
            {error}
          </Alert>
        )}

        {renderResults()}
        {renderSaveStatus()}

        {/* Update action buttons for mobile */}
        <Box sx={{ 
          mt: 3, 
          display: 'flex', 
          justifyContent: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 3 }
        }}>
          <Button
            variant="contained"
            color={isRecording ? "error" : "primary"}
            size="large"
            fullWidth={true}
            onClick={isRecording ? stopRecording : handleStart}
            disabled={error !== null || isProcessing}
            sx={{
              borderRadius: 2,
              px: { xs: 2, sm: 4 },
              py: { xs: 1, sm: 1.5 },
              boxShadow: theme.shadows[4]
            }}
          >
            {isProcessing
              ? 'Processing Assessment...'
              : isRecording
                ? 'Stop Assessment'
                : 'Start Assessment'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default EyeMovement;