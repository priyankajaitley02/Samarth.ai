import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const BackNavigation = ({ to, title }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      mb: 3,
      '&:hover': { opacity: 0.8 }
    }}>
      <IconButton onClick={() => navigate(to)}>
        <ArrowBack />
      </IconButton>
      <Typography variant="h6" sx={{ ml: 1 }}>
        {title}
      </Typography>
    </Box>
  );
};

BackNavigation.propTypes = {
  to: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired
};

const PhysicalTherapy = () => {
  return (
    <Layout>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <BackNavigation 
            to="/therapies/parkinsons" 
            title="Back to Parkinson's Therapies" 
          />
          {/* Rest of the component content */}
        </Box>
      </Container>
    </Layout>
  );
};

export default BackNavigation;