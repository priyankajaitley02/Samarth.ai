import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { RecordVoiceOver } from '@mui/icons-material';

const SpeechTherapyCard = ({ title, description, techniques }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <RecordVoiceOver sx={{ fontSize: 30, mr: 2, color: 'primary.main' }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography paragraph color="text.secondary">
          {description}
        </Typography>
        <Typography variant="subtitle2" color="primary" gutterBottom>
          Techniques:
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          {techniques.map((technique, index) => (
            <Typography component="li" key={index} variant="body2">
              {technique}
            </Typography>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default SpeechTherapyCard;