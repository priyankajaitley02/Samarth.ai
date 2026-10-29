import { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Layout from '../components/Layout';

const Settings = () => {
  const { currentUser } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [openDialog, setOpenDialog] = useState(false);

  const handleDeleteAccount = () => {
    // Implement account deletion logic
    setOpenDialog(false);
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Settings
        </Typography>

        <Paper sx={{ mt: 3 }}>
          <List>
            <ListItem>
              <ListItemText 
                primary="Dark Mode" 
                secondary="Toggle dark/light theme"
              />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  checked={darkMode}
                  onChange={toggleDarkMode}
                />
              </ListItemSecondaryAction>
            </ListItem>

            <Divider />

            <ListItem>
              <ListItemText 
                primary="Email Notifications" 
                secondary="Receive email updates about your assessments"
              />
              <ListItemSecondaryAction>
                <Switch
                  edge="end"
                  // Add notification toggle logic here
                />
              </ListItemSecondaryAction>
            </ListItem>

            <Divider />

            <ListItem>
              <ListItemText 
                primary="Account Information" 
                secondary={currentUser?.email}
              />
            </ListItem>
          </List>
        </Paper>

        <Box sx={{ mt: 4 }}>
          <Button 
            variant="outlined" 
            color="error"
            onClick={() => setOpenDialog(true)}
          >
            Delete Account
          </Button>
        </Box>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete your account? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleDeleteAccount} color="error">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default Settings; 