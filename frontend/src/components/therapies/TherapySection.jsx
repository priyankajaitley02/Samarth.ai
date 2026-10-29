import React from 'react';
import { Card, CardContent, CardActionArea, Typography, Box } from '@mui/material';
import PropTypes from 'prop-types';

const TherapySection = ({ title, description, icon: Icon, techniques, onClick, videoUrl }) => {
  return (
    <Card 
      sx={{ 
        height: '100%',
        borderRadius: 2,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          '& .icon': {
            transform: 'scale(1.1)',
            color: 'primary.main',
          }
        }
      }}
    >
      <CardActionArea 
        onClick={onClick}
        sx={{
          height: '100%',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.02)'
          }
        }}
      >
        <CardContent>
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center"
            sx={{ p: 2 }}
          >
            {Icon && (
              <Icon 
                className="icon"
                sx={{ 
                  fontSize: 48,
                  mb: 2,
                  transition: 'all 0.3s ease-in-out',
                  color: 'text.secondary'
                }} 
              />
            )}
            <Typography 
              variant="h6" 
              component="h2" 
              gutterBottom
              sx={{
                fontWeight: 600,
                textAlign: 'center',
                color: 'primary.main'
              }}
            >
              {title}
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              gutterBottom
              sx={{ 
                textAlign: 'center',
                mb: 3
              }}
            >
              {description}
            </Typography>
            {techniques && (
              <Box 
                mt={2} 
                sx={{
                  width: '100%',
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  p: 2
                }}
              >
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    color: 'primary.main',
                    fontWeight: 600,
                    mb: 1
                  }}
                >
                  Key techniques:
                </Typography>
                <Box 
                  component="ul" 
                  sx={{ 
                    m: 0,
                    pl: 2,
                    listStyle: 'none'
                  }}
                >
                  {techniques.map((technique, index) => (
                    <Box
                      component="li"
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 0.5,
                        '&:before': {
                          content: '"•"',
                          color: 'primary.main',
                          fontWeight: 'bold',
                          mr: 1
                        }
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                      >
                        {technique}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

TherapySection.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  techniques: PropTypes.arrayOf(PropTypes.string),
  onClick: PropTypes.func
};

export default TherapySection;