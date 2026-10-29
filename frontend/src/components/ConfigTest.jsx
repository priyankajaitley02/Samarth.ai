import { useState } from 'react';
import { Box, Button, Alert, Typography, CircularProgress } from '@mui/material';
import { auth, firestore } from '../config/firebase';
import { 
  collection, 
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';

const ConfigTest = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const updateStatus = (message, type = 'info') => {
    setStatus({ message, type });
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  const runAuthTest = async () => {
    try {
      updateStatus('Testing authentication...', 'info');
      
      // Test user credentials
      const testEmail = `test${Date.now()}@example.com`;
      const testPassword = 'Test123!';

      // 1. Create test user
      updateStatus('Creating test user...', 'info');
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        testEmail, 
        testPassword
      );
      updateStatus('Test user created successfully', 'success');

      // 2. Create user document
      updateStatus('Creating user document...', 'info');
      await setDoc(doc(firestore, 'users', userCredential.user.uid), {
        email: testEmail,
        createdAt: new Date()
      });
      updateStatus('User document created successfully', 'success');

      // 3. Sign out
      updateStatus('Signing out...', 'info');
      await signOut(auth);
      updateStatus('Signed out successfully', 'success');

      return true;
    } catch (error) {
      updateStatus(`Auth Test Error: ${error.message}`, 'error');
      throw error;
    }
  };

  const runFirestoreTest = async () => {
    try {
      updateStatus('Testing Firestore...', 'info');

      // 1. Try to write to test collection
      const testData = {
        timestamp: new Date(),
        testId: 'test-' + Date.now()
      };

      updateStatus('Writing to test collection...', 'info');
      const docRef = await addDoc(collection(firestore, 'test'), testData);
      updateStatus('Successfully wrote to test collection', 'success');

      // 2. Try to read from test collection
      updateStatus('Reading from test collection...', 'info');
      const querySnapshot = await getDocs(collection(firestore, 'test'));
      updateStatus(`Successfully read ${querySnapshot.size} documents`, 'success');

      return true;
    } catch (error) {
      updateStatus(`Firestore Test Error: ${error.message}`, 'error');
      throw error;
    }
  };

  const runTests = async () => {
    setLoading(true);
    try {
      updateStatus('Starting tests...', 'info');
      
      // Run auth test
      await runAuthTest();
      
      // Run Firestore test
      await runFirestoreTest();
      
      updateStatus('All tests completed successfully!', 'success');
    } catch (error) {
      updateStatus(`Test Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Firebase Configuration Test
      </Typography>

      <Button 
        variant="contained" 
        onClick={runTests}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        {loading ? <CircularProgress size={24} /> : 'Run All Tests'}
      </Button>

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default ConfigTest; 