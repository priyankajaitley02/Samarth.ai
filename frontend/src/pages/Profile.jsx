import { useState, useEffect } from 'react';
import { 
  Container, Box, Paper, Typography, Avatar, Grid, Button,
  TextField, Snackbar, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, IconButton, DialogActions
} from '@mui/material';
import { Edit, PhotoCamera, Save, Cancel, Close } from '@mui/icons-material';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// Add avatar options - these could be moved to a configuration file later
const avatarOptions = [
  { id: 'default', url: '/avatars/default.png', name: 'Default' },
  { id: 'avatar1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Felix', name: 'Robot 1' },
  { id: 'avatar2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Aneka', name: 'Robot 2' },
  { id: 'avatar3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Midnight', name: 'Person 1' },
  { id: 'avatar4', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna', name: 'Person 2' },
  { id: 'avatar5', url: 'https://api.dicebear.com/7.x/micah/svg?seed=Felix', name: 'Minimal 1' },
  { id: 'avatar6', url: 'https://api.dicebear.com/7.x/micah/svg?seed=Coco', name: 'Minimal 2' },
  { id: 'avatar7', url: 'https://api.dicebear.com/7.x/thumbs/svg?seed=Daisy', name: 'Thumb 1' },
  { id: 'avatar8', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Pepper', name: 'Portrait 1' }
];

const Profile = () => {
  const { user: authUser, refreshUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });
  
  // Add new state for avatar functionality
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  // Fetch user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        if (authUser) {
          // Get more detailed profile data from the server if needed
          const userId = localStorage.getItem('userId');
          if (userId) {
            try {
              const response = await api.get('/auth/me');
              if (response.data && response.data.user) {
                // Check for locally stored avatar
                const userData = response.data.user;
                const savedAvatarId = localStorage.getItem(`avatar_${userData.id}`);
                const savedAvatarUrl = localStorage.getItem(`avatarUrl_${userData.id}`);
                
                if (savedAvatarId) {
                  // Merge with locally stored avatar data
                  userData.profile = {
                    ...(userData.profile || {}),
                    avatarId: savedAvatarId,
                    avatarUrl: savedAvatarUrl
                  };
                }
                
                setUser(userData);
              } else {
                // Check for locally stored avatar for authUser
                const enhancedUser = {...authUser};
                const savedAvatarId = localStorage.getItem(`avatar_${authUser.id}`);
                const savedAvatarUrl = localStorage.getItem(`avatarUrl_${authUser.id}`);
                
                if (savedAvatarId) {
                  enhancedUser.profile = {
                    ...(enhancedUser.profile || {}),
                    avatarId: savedAvatarId,
                    avatarUrl: savedAvatarUrl
                  };
                }
                
                setUser(enhancedUser);
              }
            } catch (error) {
              console.error("Error fetching detailed profile:", error);
              
              // Still check for locally stored avatar for authUser
              const enhancedUser = {...authUser};
              const savedAvatarId = localStorage.getItem(`avatar_${authUser.id}`);
              const savedAvatarUrl = localStorage.getItem(`avatarUrl_${authUser.id}`);
              
              if (savedAvatarId) {
                enhancedUser.profile = {
                  ...(enhancedUser.profile || {}),
                  avatarId: savedAvatarId,
                  avatarUrl: savedAvatarUrl
                };
              }
              
              setUser(enhancedUser);
            }
          } else {
            setUser(authUser);
          }

          // Initialize form data from user object
          setFormData({
            firstName: authUser.profile?.firstName || authUser.firstName || '',
            lastName: authUser.profile?.lastName || authUser.lastName || '',
            email: authUser.email || ''
          });
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        setSnackbar({
          open: true,
          message: 'Failed to load user profile',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [authUser]);

  const handleEditToggle = () => {
    if (editing) {
      // Cancel editing - reset form data
      setFormData({
        firstName: user?.profile?.firstName || user?.firstName || '',
        lastName: user?.profile?.lastName || user?.lastName || '',
        email: user?.email || ''
      });
    }
    setEditing(!editing);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      
      // Change this line to use the correct endpoint
      const response = await api.put('/auth/profile', {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        profile: {
          firstName: formData.firstName,
          lastName: formData.lastName
        }
      });
      
      if (response.data && response.data.user) {
        setUser({
          ...user,
          ...response.data.user,
        });
        
        // Refresh auth context
        await refreshUser();
        
        setSnackbar({
          open: true,
          message: 'Profile updated successfully',
          severity: 'success'
        });
        
        setEditing(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || 'Failed to update profile',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false
    });
  };

  // Add new functions for avatar functionality
  const handleOpenAvatarDialog = () => {
    setAvatarDialogOpen(true);
    // Set initial selected avatar based on user's current avatar if it exists
    const currentAvatarId = localStorage.getItem(`avatar_${user?.id}`) || 'default';
    setSelectedAvatar(currentAvatarId);
  };

  const handleCloseAvatarDialog = () => {
    setAvatarDialogOpen(false);
  };

  const handleSelectAvatar = (avatarId) => {
    setSelectedAvatar(avatarId);
  };

  const handleSaveAvatar = async () => {
    if (!selectedAvatar) return;
    
    try {
      setLoading(true);
      
      // Find the selected avatar object
      const avatar = avatarOptions.find(a => a.id === selectedAvatar);
      
      // Store avatar in localStorage instead of API call
      localStorage.setItem(`avatar_${user?.id}`, selectedAvatar);
      localStorage.setItem(`avatarUrl_${user?.id}`, avatar?.url || '');
      
      // Update local state
      setUser({
        ...user,
        profile: {
          ...user.profile,
          avatarId: selectedAvatar,
          avatarUrl: avatar?.url
        }
      });
      
      setSnackbar({
        open: true,
        message: 'Avatar updated successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update avatar',
        severity: 'error'
      });
    } finally {
      setLoading(false);
      setAvatarDialogOpen(false);
    }
  };

  // Get current avatar URL from localStorage
  const getCurrentAvatarUrl = () => {
    if (!user?.id) return '';
    
    // First check localStorage
    const savedAvatarId = localStorage.getItem(`avatar_${user.id}`);
    const savedAvatarUrl = localStorage.getItem(`avatarUrl_${user.id}`);
    
    if (savedAvatarUrl) {
      return savedAvatarUrl;
    }
    
    // Fall back to finding by ID if we have an ID but no URL
    if (savedAvatarId) {
      const avatar = avatarOptions.find(a => a.id === savedAvatarId);
      return avatar?.url || '';
    }
    
    // Fall back to profile data if available
    return user?.profile?.avatarUrl || '';
  };

  if (loading && !user) {
    return (
      <Layout>
        <Container maxWidth="sm">
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
            <CircularProgress />
          </Box>
        </Container>
      </Layout>
    );
  }

  const fullName = user?.name || `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim();

  return (
    <Layout>
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '3rem',
                }}
                src={getCurrentAvatarUrl() || user?.profilePic}
              >
                {fullName.charAt(0) || 'U'}
              </Avatar>
              <Button
                startIcon={<PhotoCamera />}
                variant="outlined"
                size="small"
                sx={{ mb: 2 }}
                onClick={handleOpenAvatarDialog}
              >
                Change Avatar
              </Button>
              <Typography variant="h5" gutterBottom>
                {fullName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6">Personal Information</Typography>
                    {!editing ? (
                      <Button 
                        startIcon={<Edit />} 
                        size="small"
                        onClick={handleEditToggle}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Box>
                        <Button 
                          startIcon={<Save />} 
                          size="small" 
                          color="primary"
                          onClick={handleSaveProfile}
                          disabled={loading}
                          sx={{ mr: 1 }}
                        >
                          Save
                        </Button>
                        <Button 
                          startIcon={<Cancel />} 
                          size="small" 
                          color="inherit"
                          onClick={handleEditToggle}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </Box>
                    )}
                  </Box>
                  
                  {editing ? (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="First Name"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          margin="dense"
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Last Name"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          margin="dense"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          margin="dense"
                        />
                      </Grid>
                    </Grid>
                  ) : (
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          First Name
                        </Typography>
                        <Typography>{user?.profile?.firstName || user?.firstName || ''}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Last Name
                        </Typography>
                        <Typography>{user?.profile?.lastName || user?.lastName || ''}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography>{user?.email}</Typography>
                      </Grid>
                    </Grid>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Activity Summary
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No activities to show yet.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Container>
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Add avatar selection dialog */}
      <Dialog 
        open={avatarDialogOpen} 
        onClose={handleCloseAvatarDialog}
        maxWidth="md"
      >
        <DialogTitle>
          Choose an Avatar
          <IconButton
            aria-label="close"
            onClick={handleCloseAvatarDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {avatarOptions.map((avatar) => (
              <Grid item xs={4} sm={3} key={avatar.id}>
                <Paper
                  elevation={selectedAvatar === avatar.id ? 8 : 1}
                  sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    border: selectedAvatar === avatar.id ? '2px solid' : '1px solid',
                    borderColor: selectedAvatar === avatar.id ? 'primary.main' : 'divider',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'scale(1.05)',
                    },
                  }}
                  onClick={() => handleSelectAvatar(avatar.id)}
                >
                  <Avatar 
                    src={avatar.url} 
                    sx={{ width: 64, height: 64, mb: 1 }}
                  />
                  <Typography variant="body2" align="center">
                    {avatar.name}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAvatarDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveAvatar} 
            variant="contained" 
            disabled={!selectedAvatar}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default Profile;