import React from 'react';
import { Card, CardContent, Typography, Box, useTheme, useMediaQuery } from '@mui/material';
import PropTypes from 'prop-types';

const TherapyDetailCard = ({ title, description, icon: Icon, techniques, exercises }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Card 
      sx={{ 
        height: '100%',
        boxShadow: 2,
        '&:hover': { 
          boxShadow: 6,
          transform: 'translateY(-4px)'
        },
        transition: 'all 0.3s ease'
      }}
    >
      <CardContent>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 2,
          flexDirection: isMobile ? 'column' : 'row'
        }}>
          {Icon && (
            <Icon sx={{ 
              fontSize: isMobile ? 40 : 30, 
              mb: isMobile ? 1 : 0,
              mr: isMobile ? 0 : 2, 
              color: 'primary.main' 
            }} />
          )}
          <Typography variant="h6" align={isMobile ? 'center' : 'left'}>
            {title}
          </Typography>
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

TherapyDetailCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  techniques: PropTypes.arrayOf(PropTypes.string),
  exercises: PropTypes.arrayOf(PropTypes.string)
};

export default TherapyDetailCard;