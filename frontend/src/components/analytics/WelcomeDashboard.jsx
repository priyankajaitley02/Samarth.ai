import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button, 
  Card, 
  CardContent,
  CardActionArea,
  Divider
} from '@mui/material';
import {
  Timeline,
  TrendingUp,
  Assessment,
  Psychology,
  BubbleChart,
  Favorite
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const FeatureCard = ({ icon, title, description, color, onClick }) => (
  <Card 
    elevation={1} 
    sx={{ 
      height: '100%',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: 4
      }
    }}
  >
    <CardActionArea 
      onClick={onClick} 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        p: 1 
      }}
    >
      <CardContent sx={{ width: '100%' }}>
        <Box sx={{ mb: 2, color: `${color}.main` }}>
          {icon}
        </Box>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </CardActionArea>
  </Card>
);

const WelcomeDashboard = ({ onStartAssessment }) => {
  const navigate = useNavigate();

  const handleNavigateToAssessments = () => {
    navigate('/assessment');
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 3, mb: 4, backgroundColor: 'primary.50', borderRadius: 2 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom>
              Welcome to Your Samarth Health Dashboard
            </Typography>
            <Typography variant="body1" paragraph>
              Track your neuromotor health with regular assessments and gain valuable insights through advanced analytics and AI analysis.
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                size="large" 
                onClick={handleNavigateToAssessments}
                sx={{ mr: 2 }}
              >
                Start an Assessment
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Box 
              component="img" 
              src="/assets/images/analytics-illustration.svg" 
              alt="Analytics Dashboard" 
              sx={{ 
                width: '100%', 
                maxHeight: '200px',
                objectFit: 'contain'
              }} 
            />
          </Grid>
        </Grid>
      </Paper>
      
      <Typography variant="h5" gutterBottom>
        Explore Your Analytics Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Use these features to track your neuromotor health and get valuable insights
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard 
            icon={<Assessment fontSize="large" />}
            title="Assessment Results"
            description="View detailed results from all your completed assessments."
            color="primary"
            onClick={() => {}}  // Already on this tab
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard 
            icon={<Timeline fontSize="large" />}
            title="Progress Tracking"
            description="Monitor your progress over time with interactive charts and trends."
            color="secondary"
            onClick={() => {}}  // Handle tab change
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <FeatureCard 
            icon={<Psychology fontSize="large" />}
            title="AI Analysis"
            description="Get AI-powered analysis of your neuromotor health and potential indicators."
            color="info"
            onClick={() => {}}  // Handle tab change
          />
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 4, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Why Regular Assessment Matters
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', mb: 1 }}>
              <BubbleChart color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Early Detection</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Regular assessments help detect neuromotor changes early when interventions are most effective.
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', mb: 1 }}>
              <TrendingUp color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Track Progress</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Monitor how your neuromotor function changes over time and respond to treatments.
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', mb: 1 }}>
              <Favorite color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Proactive Health</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Take control of your neurological health with data-driven insights and recommendations.
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: 'flex', mb: 1 }}>
              <Assessment color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">Doctor Communication</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Share comprehensive reports with your healthcare provider for more informed care.
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default WelcomeDashboard;
