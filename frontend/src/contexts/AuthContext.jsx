import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext(null);

const getStoredToken = () => localStorage.getItem('token');
const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return null;
      }

      const userData = await auth.getCurrentUser();
      if (userData) {
        setUser(userData);
        setLoading(false);  // Set loading to false on success
        return userData;
      }
    } catch (error) {
      console.error('Load user error:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setUser(null);
      }
      setError(error.message);
    }
    setLoading(false);  // Ensure loading is set to false even if there's an error
    return null;
  };

  // Initialize auth state
  useEffect(() => {
    loadUser();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);  // Set loading true when login starts
      setError(null);
      const response = await auth.login(credentials);
      
      if (response.token && response.user) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('userId', response.user.id); // Store user ID in localStorage
        setUser(response.user);
        setLoading(false);  // Set loading false on success
        return response.user;
      }
      throw new Error('Invalid login response');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      setLoading(false);  // Set loading false on error
      throw error;
    }
  };

  const signup = async (email, password, profile) => {
    try {
      setError(null);
      setLoading(true);

      const response = await auth.register({
        email,
        password,
        firstName: profile.firstName,
        lastName: profile.lastName
      });
      
      if (response.success && response.token) {
        setStoredToken(response.token);
        setUser(response.user);
        return response;
      }
      
      throw new Error(response.message || 'Registration failed');
    } catch (error) {
      console.error('Signup error:', error);
      const message = error.errors 
        ? Object.values(error.errors).join(', ') 
        : error.message;
      setError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId'); // Also remove userId on logout
    setUser(null);
    setError(null);
  };

  // Debug auth state changes
  useEffect(() => {
    console.log('Auth state changed:', { 
      isAuthenticated: !!user, 
      hasToken: !!getStoredToken(),
      loading,
      error: error || 'none'
    });
  }, [user, loading, error]);

  return (
    <AuthContext.Provider 
      value={{
        user,
        login,
        logout,
        signup,
        loading,
        error,
        isAuthenticated: !!user,
        refreshUser: loadUser // Add this to allow manual refresh
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;