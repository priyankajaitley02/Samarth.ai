import { useState } from 'react';
import { Box, Button, TextField, Alert, Typography } from '@mui/material';
import { auth } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const AuthTest = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);

  const handleSignUp = async () => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setStatus({
        type: 'success',
        message: `User created: ${result.user.email}`
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message
      });
    }
  };

  const handleSignIn = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setStatus({
        type: 'success',
        message: `Signed in as: ${result.user.email}`
      });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.message
      });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Authentication Test
      </Typography>
      
      <TextField
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        margin="normal"
      />
      
      <TextField
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        fullWidth
        margin="normal"
      />

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <Button variant="contained" onClick={handleSignUp}>
          Sign Up
        </Button>
        <Button variant="contained" onClick={handleSignIn}>
          Sign In
        </Button>
      </Box>

      {status && (
        <Alert severity={status.type} sx={{ mt: 2 }}>
          {status.message}
        </Alert>
      )}
    </Box>
  );
};

export default AuthTest; 