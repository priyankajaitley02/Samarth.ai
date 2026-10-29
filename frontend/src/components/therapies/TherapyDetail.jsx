import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, Grid, IconButton } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import Layout from '../Layout';
import { TherapyDetailCard } from './index';

const TherapyDetail = () => {
  const { condition, type } = useParams();
  const navigate = useNavigate();

  return (
    <Layout>
      <Container maxWidth="lg">
        <Box sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton 
              onClick={() => navigate(`/therapies/${condition}`)}
              sx={{ mr: 2 }}
            >
              <ArrowBack />
            </IconButton>
            <Typography variant="h4" component="h1">
              {type.charAt(0).toUpperCase() + type.slice(1)} Therapy
              for {condition.charAt(0).toUpperCase() + condition.slice(1)}
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TherapyDetailCard
                title={`${type.charAt(0).toUpperCase() + type.slice(1)} Therapy`}
                description={`${condition.charAt(0).toUpperCase() + condition.slice(1)} specific therapy exercises and techniques`}
              />
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Layout>
  );
};

export default TherapyDetail;