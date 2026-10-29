import { useState } from 'react';
import { Box, Button, TextField, Alert, Typography } from '@mui/material';
import { auth, firestore } from '../config/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const FirestoreTest = () => {
  const [status, setStatus] = useState(null);
  const [testData, setTestData] = useState('');

  const runTests = async () => {
    if (!auth.currentUser) {
      setStatus({
        type: 'error',
        message: 'Please sign in first to test Firestore rules'
      });
      return;
    }

    try {
      setStatus({ type: 'info', message: 'Running Firestore tests...' });

      // Test 1: Create an assessment
      const assessmentData = {
        userId: auth.currentUser.uid,
        type: 'test',
        data: { testValue: testData || 'test data' },
        timestamp: new Date()
      };

      const docRef = await addDoc(
        collection(firestore, 'assessments'),
        assessmentData
      );

      // Test 2: Read assessments
      const q = query(
        collection(firestore, 'assessments'),
        where('userId', '==', auth.currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const assessments = [];
      querySnapshot.forEach((doc) => {
        assessments.push({ id: doc.id, ...doc.data() });
      });

      setStatus({
        type: 'success',
        message: `Tests passed! Created assessment ID: ${docRef.id}, Found ${assessments.length} assessments`
      });

    } catch (error) {
      console.error('Test error:', error);
      setStatus({
        type: 'error',
        message: `Error: ${error.message}`
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Firestore Security Rules Test
      </Typography>

      <TextField
        label="Test Data"
        value={testData}
        onChange={(e) => setTestData(e.target.value)}
        fullWidth
        margin="normal"
      />

      <Button 
        variant="contained" 
        onClick={runTests}
        sx={{ mt: 2, mb: 2 }}
      >
        Run Firestore Tests
      </Button>

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default FirestoreTest; 