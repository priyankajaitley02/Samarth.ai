import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Balance as BalanceIcon,
  Accessibility as PostureIcon,
  Scale as WeightIcon,
  Timeline as SwayIcon,
} from '@mui/icons-material';
import AssessmentLayout from './AssessmentLayout';
import { startBalanceAssessment, stopBalanceAssessment } from '../../services/assessments/balanceService';
import { assessment } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// MetricCard component
const MetricCard = ({ title, value, icon, description }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {icon}
        <Typography variant="h6" sx={{ ml: 1 }}>
          {title}
        </Typography>
      </Box>
      <Typography variant="h4" gutterBottom>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </CardContent>
  </Card>
);

const BalanceAnalysis = ({ userId, onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realtimeData, setRealtimeData] = useState({
    timestamps: [],
    posturalSway: {
      lateral: [],
      anterior: []
    },
    weightDistribution: {
      left: [],
      right: []
    },
    stabilityScore: []
  });

  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const streamRef = useRef(null);
  const { currentUser } = useAuth();

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    stopBalanceAssessment();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startAssessment = async () => {
    try {
      cleanup(); // Clear any existing assessment
      setLoading(true);
      setIsRecording(true);
      setError(null);
      setMetrics(null);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      await new Promise((resolve) => {
        videoRef.current.onloadeddata = () => {
          videoRef.current.play();
          resolve();
        };
      });

      // Start balance analysis
      startBalanceAssessment(videoRef.current, handleRealtimeUpdate);

      // Auto-stop after 30 seconds
      timeoutRef.current = setTimeout(() => {
        stopAssessment();
      }, 30000);

    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const stopAssessment = async () => {
    try {
      setIsRecording(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Stop video stream and analysis
      const stream = videoRef.current?.srcObject;
      stream?.getTracks().forEach(track => track.stop());
      stopBalanceAssessment();

      // Save assessment results if metrics exist
      if (metrics) {
        await saveAssessmentResults();
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleRealtimeUpdate = (data) => {
    if (data.error) {
      handleError(new Error(data.error));
      return;
    }

    // Update realtime data for visualizations
    setRealtimeData(prevData => {
      // Keep only the last 100 data points for performance
      const maxDataPoints = 100;
      const sliceStart = prevData.timestamps.length > maxDataPoints ? 1 : 0;

      return {
        timestamps: [...prevData.timestamps.slice(sliceStart), Date.now()],
        posturalSway: {
          lateral: [...prevData.posturalSway.lateral.slice(sliceStart), data.posturalSway?.lateral || 0],
          anterior: [...prevData.posturalSway.anterior.slice(sliceStart), data.posturalSway?.anterior || 0]
        },
        weightDistribution: {
          left: [...prevData.weightDistribution.left.slice(sliceStart), data.weightDistribution?.left || 50],
          right: [...prevData.weightDistribution.right.slice(sliceStart), data.weightDistribution?.right || 50]
        },
        stabilityScore: [...prevData.stabilityScore.slice(sliceStart), data.stabilityScore || 0]
      };
    });

    // Update metrics for display
    setMetrics(data);
  };

  const handleError = (err) => {
    console.error('Assessment error:', err);
    setError(err.message || 'An error occurred during the assessment');
    setIsRecording(false);
    cleanup();
  };

  const saveAssessmentResults = async () => {
    try {
      await assessment.save({
        type: 'BALANCE_ANALYSIS',
        data: {
          metrics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('Failed to save assessment results:', err);
    }
  };

  const renderMetrics = () => {
    if (!metrics) return null;

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overall Balance"
            value={`${Math.round(metrics.overallBalance)}%`}
            icon={<BalanceIcon color="primary" />}
            description="Overall balance score based on postural control and stability"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Postural Sway"
            value={`${Math.round((metrics.posturalSway.lateral + metrics.posturalSway.anterior) / 2)}%`}
            icon={<SwayIcon color="primary" />}
            description="Combined lateral and anterior postural sway measurement"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Weight Distribution"
            value={`${Math.round(metrics.weightDistribution.left)}/${Math.round(metrics.weightDistribution.right)}`}
            icon={<WeightIcon color="primary" />}
            description="Left/Right weight distribution percentage"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Stability Score"
            value={`${Math.round(metrics.stabilityScore)}%`}
            icon={<PostureIcon color="primary" />}
            description="Overall stability and balance control score"
          />
        </Grid>
      </Grid>
    );
  };

  return (
    <AssessmentLayout
      title="Balance Assessment"
      description="This assessment analyzes your balance and postural control."
      onStart={startAssessment}
      onStop={stopAssessment}
      isRecording={isRecording}
      loading={loading}
      error={error}
    >
      <Box sx={{ width: '100%', mb: 4 }}>
        <video
          ref={videoRef}
          style={{
            width: '100%',
            maxWidth: '640px',
            margin: '0 auto',
            display: 'block',
            marginBottom: '2rem'
          }}
        />
        {renderMetrics()}
      </Box>
    </AssessmentLayout>
  );
};

export default BalanceAnalysis; 