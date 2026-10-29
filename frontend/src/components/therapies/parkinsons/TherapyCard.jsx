import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import PropTypes from 'prop-types';

const TherapyCard = ({ title, description, icon: Icon, techniques }) => {
  return (
    <Card sx={{ height: '100%', boxShadow: 2, '&:hover': { boxShadow: 4 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {Icon && <Icon sx={{ fontSize: 30, mr: 2, color: 'primary.main' }} />}
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography paragraph color="text.secondary">
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
  techniques: PropTypes.arrayOf(PropTypes.string)
};

export default TherapyCard;