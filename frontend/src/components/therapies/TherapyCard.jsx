import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import PropTypes from 'prop-types';

const TherapyCard = ({ title, description, icon: Icon, onClick }) => {
  return (
    <Card 
      onClick={onClick}
      sx={{ 
        height: '100%', 
        cursor: 'pointer',
        boxShadow: 2, 
        '&:hover': { 
          transform: 'scale(1.02)',
          transition: 'all 0.2s'
        } 
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {Icon && <Icon sx={{ fontSize: 30, mr: 2, color: 'primary.main' }} />}
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};

TherapyCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  onClick: PropTypes.func
};

export default TherapyCard;