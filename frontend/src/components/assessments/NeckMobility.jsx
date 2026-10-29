import { useState, useRef, useEffect } from 'react';
import { Box, Button, Typography, Grid, CircularProgress, Alert } from '@mui/material';
import AssessmentLayout from '../common/AssessmentLayout';
import { MLService } from '../../services/mlService';
import { specializedAssessments } from '../../services/api';
import { CheckCircle } from '@mui/icons-material';

const NeckMobility = ({ userId, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [currentPosition, setCurrentPosition] = useState('neutral');
  const [positionComplete, setPositionComplete] = useState({
    neutral: false,
    flexion: false,
    extension: false,
    rotation: false
  });
  const [allPositionsCompleted, setAllPositionsCompleted] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ saving: false, error: null });
  const assessmentStartTime = useRef(null);
  const canvasRef = useRef(null);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Add effect to check if all positions are completed
  useEffect(() => {
    if (positionComplete.neutral && 
        positionComplete.flexion && 
        positionComplete.extension && 
        positionComplete.rotation) {
      setAllPositionsCompleted(true);
    }
  }, [positionComplete]);

  useEffect(() => {
    if (isAssessing) {
      const drawCanvas = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame
        ctx.save();
        ctx.scale(-1, 1); // Mirror the image
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        // Draw guide overlay based on current position
        drawGuideOverlay(ctx);

        requestAnimationFrame(drawCanvas);
      };

      drawCanvas();
    }
  }, [isAssessing, currentPosition]);

  const captureFrame = async () => {
    if (!videoRef.current) return null;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const measurePosition = async (position) => {
    try {
      const imageBlob = await captureFrame();
      if (!imageBlob) {
        throw new Error('Failed to capture image');
      }

      let result;
      if (position === 'neutral') {
        result = await MLService.setNeckNeutral(imageBlob);
      } else {
        result = await MLService.measureNeckPosition(imageBlob, position);
      }

      if (result.success) {
        setPositionComplete(prev => ({ ...prev, [position]: true }));
        
        // Move to next position
        if (position === 'neutral') setCurrentPosition('flexion');
        else if (position === 'flexion') setCurrentPosition('extension');
        else if (position === 'extension') setCurrentPosition('rotation');
        else if (position === 'rotation') {
          // Get final results
          const finalResults = await MLService.getNeckMobilityResults();
          if (finalResults.success) {
            setMetrics(finalResults.metrics);
          }
          // We'll stop assessment manually with the Complete button now
          // stopAssessment();
        }
      } else {
        setError(result.error || 'Failed to measure position. Please try again.');
      }
    } catch (err) {
      console.error('Error measuring position:', err);
      setError('Error measuring neck position. Please try again.');
    }
  };

  const startAssessment = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setIsAssessing(true);
      setError(null);
      setCurrentPosition('neutral');
      setPositionComplete({
        neutral: false,
        flexion: false,
        extension: false,
        rotation: false
      });
      assessmentStartTime.current = Date.now();
    } catch (err) {
      setError('Failed to access camera. Please check camera permissions and try again.');
    }
  };

  const stopAssessment = async () => {
    setSaveStatus({ saving: true, error: null });
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsAssessing(false);

    if (metrics) {
      try {
        // Save assessment results using specialized assessment API
        const assessmentData = {
          userId,
          type: 'neckMobility',
          timestamp: new Date().toISOString(),
          metrics: metrics
        };
        
        const response = await specializedAssessments.neckMobility.save(assessmentData);
        
        // Check for success in the response data rather than the response itself
        if (!response.data || !response.data.success) {
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
      } catch (err) {
        console.error('Error saving assessment results:', err);
        setSaveStatus({ saving: false, error: err.message });
        setError('Error saving assessment results. Your progress may not be saved.');
      }
    } else {
      setSaveStatus({ saving: false, error: null });
    }
  };

  const drawGuideOverlay = (ctx) => {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Draw face guide box
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    const boxSize = Math.min(width, height) * 0.4;
    const x = (width - boxSize) / 2;
    const y = (height - boxSize) / 2;
    ctx.strokeRect(x, y, boxSize, boxSize);

    // Draw position-specific guides
    ctx.strokeStyle = '#4CAF50';
    ctx.beginPath();
    
    switch (currentPosition) {
      case 'neutral':
        // Draw horizontal and vertical center lines
        ctx.moveTo(width/2 - 50, height/2);
        ctx.lineTo(width/2 + 50, height/2);
        ctx.moveTo(width/2, height/2 - 50);
        ctx.lineTo(width/2, height/2 + 50);
        break;
      case 'flexion':
        // Draw downward arrow
        ctx.moveTo(width/2, height/2);
        ctx.lineTo(width/2, height/2 + 100);
        ctx.lineTo(width/2 - 20, height/2 + 80);
        ctx.moveTo(width/2, height/2 + 100);
        ctx.lineTo(width/2 + 20, height/2 + 80);
        break;
      case 'extension':
        // Draw upward arrow
        ctx.moveTo(width/2, height/2);
        ctx.lineTo(width/2, height/2 - 100);
        ctx.lineTo(width/2 - 20, height/2 - 80);
        ctx.moveTo(width/2, height/2 - 100);
        ctx.lineTo(width/2 + 20, height/2 - 80);
        break;
      case 'rotation':
        // Draw rotation arrows
        ctx.arc(width/2, height/2, 50, 0, Math.PI * 2);
        ctx.moveTo(width/2 + 60, height/2);
        ctx.lineTo(width/2 + 40, height/2 - 10);
        ctx.moveTo(width/2 + 60, height/2);
        ctx.lineTo(width/2 + 40, height/2 + 10);
        break;
    }
    ctx.stroke();

    // Add text instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(getPositionInstructions(), width/2, height - 30);
  };

  const getPositionInstructions = () => {
    switch (currentPosition) {
      case 'neutral':
        return 'Align your face within the box and look straight ahead';
      case 'flexion':
        return 'Slowly look down following the arrow';
      case 'extension':
        return 'Slowly look up following the arrow';
      case 'rotation':
        return 'Slowly rotate your head left and right';
      default:
        return '';
    }
  };

  const renderPositionIndicator = () => {
    return (
      <Grid container spacing={2} sx={{ mt: 2 }}>
        {['neutral', 'flexion', 'extension', 'rotation'].map(position => (
          <Grid item xs={3} key={position}>
            <Box 
              sx={{ 
                p: 1, 
                textAlign: 'center',
                bgcolor: currentPosition === position ? 'primary.main' : 
                         positionComplete[position] ? 'success.main' : 'grey.300',
                color: (currentPosition === position || positionComplete[position]) ? 'white' : 'text.primary',
                borderRadius: 1
              }}
            >
              <Typography variant="body2">
                {position.charAt(0).toUpperCase() + position.slice(1)}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  };

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
    <AssessmentLayout
      title="Neck Mobility Assessment"
      description="This assessment will measure your neck's range of motion. Follow the visual guides for each position."
      isLoading={isLoading}
      isAssessing={isAssessing}
      error={error}
      onStart={startAssessment}
      onStop={stopAssessment}
      metrics={metrics}
    >
      <Box sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
        {showGuide && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body1">
              Position yourself about 2-3 feet from the camera, ensuring your face is clearly visible.
              Follow the on-screen guides for each movement.
            </Typography>
          </Alert>
        )}

        <Box sx={{ 
          position: 'relative',
          aspectRatio: '4/3', 
          bgcolor: 'black', 
          borderRadius: 2, 
          overflow: 'hidden',
          boxShadow: 3
        }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ 
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              visibility: 'hidden'
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          {isLoading && (
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}>
              <CircularProgress />
            </Box>
          )}
        </Box>
        
        {isAssessing && (
          <>
            {renderPositionIndicator()}
            
            <Typography variant="body1" sx={{ mt: 2, textAlign: 'center' }}>
              {getPositionInstructions()}
            </Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => measurePosition(currentPosition)}
              >
                Capture Position
              </Button>
            </Box>
          </>
        )}
        
        {metrics && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Assessment Results
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  Flexion: {metrics.flexion_degrees.toFixed(1)}° ({metrics.flexion_percent.toFixed(1)}%)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  Extension: {metrics.extension_degrees.toFixed(1)}° ({metrics.extension_percent.toFixed(1)}%)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  Left Rotation: {Math.abs(metrics.left_rotation_degrees).toFixed(1)}° ({metrics.left_rotation_percent.toFixed(1)}%)
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="body1">
                  Right Rotation: {metrics.right_rotation_degrees.toFixed(1)}° ({metrics.right_rotation_percent.toFixed(1)}%)
                </Typography>
              </Grid>
            </Grid>
            
            {renderSaveStatus()}
            
            {/* Add Complete Assessment button */}
            {allPositionsCompleted && (
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<CheckCircle />}
                  onClick={stopAssessment}
                  disabled={saveStatus.saving}
                  sx={{
                    borderRadius: 2,
                    px: 4,
                    py: 1.5,
                    boxShadow: 4
                  }}
                >
                  {saveStatus.saving ? 'Saving...' : 'Complete Assessment'}
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </AssessmentLayout>
  );
};

export default NeckMobility;