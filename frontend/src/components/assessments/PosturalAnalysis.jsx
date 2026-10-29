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
  Accessibility as PostureIcon,
  Straighten as SpineIcon,
  CompareArrows as AlignmentIcon,
  Face as HeadIcon,
} from '@mui/icons-material';
import AssessmentLayout from './AssessmentLayout';
import { startPosturalAssessment, stopPosturalAssessment } from '../../services/assessments/posturalService';
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

const PosturalAnalysis = ({ userId, onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realtimeData, setRealtimeData] = useState({
    timestamps: [],
    spinalAlignment: [],
    shoulderAlignment: [],
    hipAlignment: [],
    headPosition: {
      forward: [],
      tilt: []
    }
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
    stopPosturalAssessment();
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

      // Start postural analysis
      startPosturalAssessment(videoRef.current, handleRealtimeUpdate);

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
      stopPosturalAssessment();

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
        spinalAlignment: [...prevData.spinalAlignment.slice(sliceStart), data.spinalAlignment || 0],
        shoulderAlignment: [...prevData.shoulderAlignment.slice(sliceStart), data.shoulderAlignment || 0],
        hipAlignment: [...prevData.hipAlignment.slice(sliceStart), data.hipAlignment || 0],
        headPosition: {
          forward: [...prevData.headPosition.forward.slice(sliceStart), data.headPosition?.forward || 0],
          tilt: [...prevData.headPosition.tilt.slice(sliceStart), data.headPosition?.tilt || 0]
        }
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
        type: 'POSTURAL_ANALYSIS',
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
            title="Overall Posture"
            value={`${Math.round(metrics.overallPosture)}%`}
            icon={<PostureIcon color="primary" />}
            description="Overall posture score based on alignment and head position"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Spinal Alignment"
            value={`${Math.round(metrics.spinalAlignment)}%`}
            icon={<SpineIcon color="primary" />}
            description="Vertical alignment of the spine"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Shoulder/Hip"
            value={`${Math.round((metrics.shoulderAlignment + metrics.hipAlignment) / 2)}%`}
            icon={<AlignmentIcon color="primary" />}
            description="Combined shoulder and hip alignment score"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Head Position"
            value={`${Math.round((metrics.headPosition.forward + metrics.headPosition.tilt) / 2)}%`}
            icon={<HeadIcon color="primary" />}
            description="Head forward position and tilt assessment"
          />
        </Grid>
      </Grid>
    );
  };

  return (
    <AssessmentLayout
      title="Postural Analysis"
      description="This assessment analyzes your posture and body alignment."
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

export default PosturalAnalysis; 