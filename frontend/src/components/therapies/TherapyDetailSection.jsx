import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import PropTypes from 'prop-types';

const TherapyDetailSection = ({ title, description, icon: Icon, techniques, exercises }) => {
  return (
    <Card sx={{ 
      height: '100%',
      boxShadow: 2,
      '&:hover': { 
        boxShadow: 4,
        transform: 'translateY(-4px)'
      },
      transition: 'all 0.3s ease'
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {Icon && <Icon sx={{ fontSize: 30, mr: 2, color: 'primary.main' }} />}
          <Typography variant="h6">{title}</Typography>
        </Box>
        
        <Typography paragraph color="text.secondary">
          {description}
        </Typography>

        {techniques && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Techniques:
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              {techniques.map((technique, i) => (
                <Typography component="li" key={i} variant="body2" sx={{ mb: 0.5 }}>
                  {technique}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {exercises && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Exercises:
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              {exercises.map((exercise, i) => (
                <Typography component="li" key={i} variant="body2" sx={{ mb: 0.5 }}>
                  {exercise}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

TherapyDetailSection.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  techniques: PropTypes.arrayOf(PropTypes.string),
  exercises: PropTypes.arrayOf(PropTypes.string)
};

export default TherapyDetailSection;