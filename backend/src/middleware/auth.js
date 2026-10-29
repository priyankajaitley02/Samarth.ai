import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    console.log('Auth middleware running...');
    const authHeader = req.header('Authorization');
    
    // Log the auth header for debugging (don't log in production)
    console.log('Auth header:', authHeader);
    
    if (!authHeader) {
      console.log('No authorization header provided');
      return res.status(401).json({
        success: false,
        message: 'No authentication token, authorization denied'
      });
    }

    // Ensure the Authorization header follows the Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      console.log('Invalid auth header format:', authHeader);
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Use Bearer token'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.log('Token extraction failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Verify token
    console.log('Verifying token...');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }
    
    try {
      const decoded = jwt.verify(token, secret);
      console.log('Token decoded successfully', decoded);
      
      if (!decoded || !decoded.userId) {
        console.log('Invalid token payload:', decoded);
        return res.status(401).json({
          success: false,
          message: 'Invalid token payload'
        });
      }

      // Find user
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        console.log('User not found for ID:', decoded.userId);
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // Add user info to request
      req.user = user;
      req.token = token;
      console.log('Authentication successful for user:', user._id.toString());
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};