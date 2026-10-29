import { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { firestore } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

const FirestoreConnectionTest = () => {
  const [status, setStatus] = useState({ type: 'info', message: 'Initializing...' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testConnection = async () => {
      try {
        // First, log the Firestore instance
        console.log('Firestore instance:', firestore);

        // Try to get a collection reference
        const testCollectionRef = collection(firestore, 'test');
        console.log('Collection reference created');

        // Try to read from the collection
        const snapshot = await getDocs(testCollectionRef);
        console.log('Successfully connected to Firestore');
        console.log('Documents in collection:', snapshot.size);

        setStatus({
          type: 'success',
          message: `Successfully connected to Firestore. Found ${snapshot.size} documents.`
        });
      } catch (error) {
        console.error('Firestore connection error:', error);
        setStatus({
          type: 'error',
          message: `Connection error: ${error.message}`
        });
      } finally {
        setLoading(false);
      }
    };

    testConnection();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Firestore Connection Test
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default FirestoreConnectionTest; 