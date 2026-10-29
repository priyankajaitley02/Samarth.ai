import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { FitnessCenter } from '@mui/icons-material';

const PhysicalTherapyCard = ({ title, description, techniques }) => {
  return (
    <Card sx={{ height: '100%', boxShadow: 2, '&:hover': { boxShadow: 4 } }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FitnessCenter sx={{ fontSize: 30, mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography paragraph color="text.secondary">
          {description}
        </Typography>
        {techniques && (
          <>
            <Typography variant="subtitle2" color="primary" gutterBottom>
              Techniques:
            </Typography>
            <Box component="ul" sx={{ pl: 2, mt: 1 }}>
              {techniques.map((technique, i) => (
                <Typography component="li" key={i} variant="body2">
                  {technique}
                </Typography>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PhysicalTherapyCard;