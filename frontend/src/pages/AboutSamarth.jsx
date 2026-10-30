import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Paper, 
  Card, 
  Button,
  Avatar,
  useTheme,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';

// Icons for features
import {
  Face as FaceIcon,
  RemoveRedEye as EyeIcon,
  RecordVoiceOver as VoiceIcon,
  Vibration as TremorIcon,
  TouchApp as TouchIcon,
  DirectionsWalk as WalkIcon,
  SmartToy as AIIcon,
  Code as CodeIcon,
  Analytics as AnalyticsIcon,
  Storage as StorageIcon,
  Biotech as BiotechIcon,
} from '@mui/icons-material';

// Simple motion components
const MotionContainer = motion(Container);
const MotionPaper = motion(Paper);
const MotionBox = motion(Box);

const AboutPage = () => {
  const theme = useTheme();
  
  // Create a simple alpha function if it's not available
  const alpha = (color, value) => {
    if (color.startsWith('#')) {
      // For hex colors
      return color + Math.round(value * 255).toString(16).padStart(2, '0');
    }
    // For named colors, use rgba
    return `rgba(${color}, ${value})`;
  };

  // Features
  const features = [
    { 
      icon: <FaceIcon fontSize="large" />, 
      title: 'Facial Analysis', 
      description: 'Detecting subtle cues with precision',
      color: '#2196F3'
    },
    { 
      icon: <EyeIcon fontSize="large" />, 
      title: 'Eye Tracking', 
      description: 'Revealing hidden movement patterns',
      color: '#03A9F4'
    },
    { 
      icon: <VoiceIcon fontSize="large" />, 
      title: 'Speech Analysis', 
      description: 'Deciphering the nuances of speech',
      color: '#9C27B0'
    },
    { 
      icon: <TremorIcon fontSize="large" />, 
      title: 'Tremor Metrics', 
      description: 'Quantifying movement with scientific rigor',
      color: '#FF9800'
    },
    { 
      icon: <TouchIcon fontSize="large" />, 
      title: 'Motor Skill Tests', 
      description: 'Evaluating fine motor control',
      color: '#4CAF50'
    },
    { 
      icon: <WalkIcon fontSize="large" />, 
      title: 'Gait Analysis', 
      description: 'Unveiling the story in every step',
      color: '#F44336'
    }
  ];

  // Technologies
  const technologies = [
    { icon: <CodeIcon />, name: 'TensorFlow.js', color: '#FF9800' },
    { icon: <AnalyticsIcon />, name: 'MediaPipe', color: '#4CAF50' },
    { icon: <EyeIcon />, name: 'OpenCV', color: '#2196F3' },
    { icon: <VoiceIcon />, name: 'Librosa', color: '#9C27B0' },
    { icon: <AIIcon />, name: 'MIET AI Services', color: '#F44336' },
    { icon: <StorageIcon />, name: 'WebGL', color: '#03A9F4' }
  ];

  // Benefits
  const benefits = [
    { title: "Early Detection", desc: "Catch subtle changes before they escalate" },
    { title: "Remote Monitoring", desc: "Take control from anywhere" },
    { title: "Data-Driven Decisions", desc: "Objective insights for healthcare providers" },
    { title: "Personalized Reports", desc: "AI-generated natural language analysis" },
    { title: "Accessibility", desc: "Breaking down barriers to quality care" }
  ];

  return (
    <Layout>
      <Box sx={{ 
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(to bottom, #121212, #1a237e)' 
          : 'linear-gradient(to bottom, #e3f2fd, #bbdefb)',
        pt: 5,
        pb: 10,
        overflow: 'hidden'
      }}>
        <Container maxWidth="lg">
          {/* Header Section */}
          <Box 
            sx={{ 
              textAlign: 'center', 
              mb: 8 
            }}
          >
            <Box 
              sx={{ 
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
                mb: 3
              }}
            >
              <Box 
                component="img"
                src="/images/loogo.png"
                alt="Samarth Logo"
                sx={{ 
                    marginTop: 2,
                  height: 200, 
                  filter: theme.palette.mode === 'dark' 
                    ? 'brightness(1.2) contrast(1.1)' 
                    : 'none',
                }}
              />
            </Box>
            
            {/* <Typography 
              variant="h2" 
              component="h1" 
              fontWeight="bold" 
              gutterBottom
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Samarth
            </Typography> */}
            
            <Typography variant="h4" color="primary" gutterBottom>
              Unlocking Neurological Wellness with AI & Insight
            </Typography>
          </Box>

          {/* Who We Are Section */}
          <Paper
            elevation={0}
            sx={{
              mb: 8,
              p: 4,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar sx={{ bgcolor: '#9C27B0', mr: 2, width: 48, height: 48 }}>
                <AIIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  Who We Are
                </Typography>
                <Typography variant="h6" color="primary">
                  The Architects of Accessible Neurological Care
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              At Samarth, we are a team of innovators, technologists, and healthcare enthusiasts
              driven by a shared vision: to empower individuals facing neuromotor challenges. We're building a future where 
              neurological health is proactive, accessible, and deeply understood.
            </Typography>
          </Paper>

          {/* What is Samarth Section */}
          <Box sx={{ mb: 8 }}>
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar sx={{ bgcolor: '#2196F3', mr: 2, width: 48, height: 48 }}>
                  <AnalyticsIcon fontSize="large" />
                </Avatar>
                <Box>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    What is Samarth
                  </Typography>
                  <Typography variant="h6" color="primary">
                    The Intelligent Neurological Assessment Platform
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 4 }}>
                Samarth is not just an app; it's a comprehensive platform that brings the power of advanced neurological assessment 
                directly into your hands. We integrate cutting-edge AI and machine learning to provide:
              </Typography>

              <Grid container spacing={3}>
                {features.map((feature, index) => (
                  <Grid 
                    item 
                    xs={12} 
                    md={6} 
                    lg={4} 
                    key={index}
                  >
                    <Paper
                      sx={{
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 2,
                        padding: 3,
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        height: '100%',
                        transition: '0.3s',
                        '&:hover': {
                          transform: 'translateY(-5px)',
                          boxShadow: 3,
                        },
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <Avatar
                        sx={{ 
                          backgroundColor: feature.color,
                          marginBottom: 2,
                          width: 56,
                          height: 56,
                        }}
                      >
                        {feature.icon}
                      </Avatar>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Box>

          {/* Why Samarth Section */}
          <Paper
            elevation={0}
            sx={{
              mb: 8,
              p: 4,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar sx={{ bgcolor: '#4CAF50', mr: 2, width: 48, height: 48 }}>
                <BiotechIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  Why Samarth
                </Typography>
                <Typography variant="h6" color="primary">
                  Bridging the Gap, Transforming Lives
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 4 }}>
              Neuromotor disorders demand continuous, insightful monitoring. Traditional methods fall short. 
              Samarth rises to the challenge, offering:
            </Typography>

            <List>
              {benefits.map((benefit, index) => (
                <ListItem 
                  key={index}
                  sx={{ 
                    p: 0, 
                    mb: 2,
                    alignItems: 'flex-start'
                  }}
                >
                  <ListItemIcon sx={{ mt: 0, mr: 1, minWidth: 'auto' }}>
                    <Box 
                      sx={{ 
                        width: 3, 
                        height: 24, 
                        bgcolor: '#2196F3',
                        borderRadius: 4,
                        mr: 2
                      }} 
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={<Typography variant="h6" color="primary">{benefit.title}</Typography>}
                    secondary={<Typography variant="body2">{benefit.desc}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>

          {/* Technology Section */}
          <Paper
            elevation={0}
            sx={{
              mb: 8,
              p: 4,
              borderRadius: 4,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Avatar sx={{ bgcolor: '#FF9800', mr: 2, width: 48, height: 48 }}>
                <CodeIcon fontSize="large" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                  How We Build
                </Typography>
                <Typography variant="h6" color="primary">
                  The Symphony of Technology
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 4 }}>
              Samarth is powered by a powerful ecosystem of technologies:
            </Typography>

            <Grid container spacing={3}>
              {technologies.map((tech, index) => (
                <Grid 
                  item 
                  xs={6} 
                  sm={4}
                  key={index}
                >
                  <Card 
                    elevation={0}
                    sx={{ 
                      textAlign: 'center',
                      p: 2,
                      bgcolor: `${tech.color}1A`, // 10% opacity
                      border: `1px solid ${tech.color}33`, // 20% opacity
                      borderRadius: 2,
                      transition: '0.3s',
                      '&:hover': {
                        bgcolor: `${tech.color}29`, // 15% opacity
                        transform: 'translateY(-5px)'
                      }
                    }}
                  >
                    <Avatar 
                      sx={{ 
                        bgcolor: `${tech.color}33`, // 20% opacity
                        color: tech.color,
                        mx: 'auto',
                        mb: 1
                      }}
                    >
                      {tech.icon}
                    </Avatar>
                    <Typography variant="body1" fontWeight="bold" color="text.primary">
                      {tech.name}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Our Pledge */}
          <Paper
            sx={{
              mb: 8,
              p: 4,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #1a237e 0%, #4527a0 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Simple content without decorative elements */}
            <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Our Pledge
              </Typography>
              <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.9)', mb: 3 }}>
                Pioneering the Future of Neurological Wellness
              </Typography>
              <Typography variant="body1" sx={{ mb: 4, maxWidth: 800, mx: 'auto' }}>
                We are committed to continuous innovation and unwavering support for those facing neuromotor challenges. 
                Join us as we redefine the boundaries of neurological care, one assessment at a time.
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                size="large"
                sx={{ 
                  borderRadius: 8,
                  px: 4,
                  py: 1.5,
                  bgcolor: 'white',
                  color: '#2196F3',
                  fontWeight: 'bold',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.9)'
                  }
                }}
              >
                Join Our Journey
              </Button>
            </Box>
          </Paper>
        </Container>
      </Box>
    </Layout>
  );
};

export default AboutPage;