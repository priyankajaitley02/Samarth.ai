import { useState, useRef, useEffect } from 'react';
import { Container, Box, Button, Paper, Typography } from '@mui/material';
import { PhotoCamera, Cameraswitch } from '@mui/icons-material';
import Layout from '../components/Layout';

const Camera = () => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please make sure you have granted camera permissions.');
    }
  };

  const switchCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      
      // You can handle the photo data here
      const photoData = canvas.toDataURL('image/jpeg');
      console.log('Photo taken:', photoData);
      
      // Here you would typically send this data to your backend
      // or process it further as needed
    }
  };

  return (
    <Layout>
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Paper 
            sx={{ 
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2
            }}
          >
            {error ? (
              <Typography color="error" align="center">
                {error}
              </Typography>
            ) : (
              <Box
                sx={{
                  width: '100%',
                  position: 'relative',
                  '& video': {
                    width: '100%',
                    height: 'auto',
                    borderRadius: 1
                  }
                }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<PhotoCamera />}
                onClick={takePhoto}
                disabled={!stream}
              >
                Take Photo
              </Button>
              <Button
                variant="outlined"
                startIcon={<Cameraswitch />}
                onClick={switchCamera}
                disabled={!stream}
              >
                Switch Camera
              </Button>
            </Box>
          </Paper>
        </Box>
      </Container>
    </Layout>
  );
};

export default Camera; 