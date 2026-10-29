import { useState } from 'react';
import { Box, Button, Alert, Typography } from '@mui/material';
import { firestore } from '../config/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

const FirestoreDevTest = () => {
  const [status, setStatus] = useState(null);

  const testFirestore = async () => {
    try {
      setStatus({ type: 'info', message: 'Testing Firestore connection...' });

      // Test Collection
      const testCollection = collection(firestore, 'dev_test');

      // Try writing
      const testDoc = await addDoc(testCollection, {
        test: true,
        timestamp: new Date(),
        message: 'Test document'
      });

      // Try reading
      const querySnapshot = await getDocs(testCollection);
      const docsCount = querySnapshot.size;

      setStatus({
        type: 'success',
        message: `Success! Write test ID: ${testDoc.id}, Read test count: ${docsCount}`
      });

    } catch (error) {
      console.error('Firestore test error:', error);
      setStatus({
        type: 'error',
        message: `Error: ${error.message}`
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Firestore Development Test
      </Typography>

      <Button 
        variant="contained" 
        onClick={testFirestore}
        sx={{ mb: 2 }}
      >
        Test Firestore Connection
      </Button>

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default FirestoreDevTest; 