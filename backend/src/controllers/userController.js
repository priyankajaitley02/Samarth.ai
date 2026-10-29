import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export class UserController {
  async register(req, res) {
    try {
      const { firstName, lastName, email, password } = req.body;
      
      console.log('Registration attempt for:', email); // Add logging

      // Validate required fields
      if (!firstName || !lastName || !email || !password) {
        console.log('Missing required fields:', { firstName, lastName, email });
        return res.status(400).json({ 
          success: false,
          message: 'Please provide all required fields' 
        });
      }

      // Check if user already exists
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('User already exists:', email);
        return res.status(400).json({ 
          success: false,
          message: 'User already exists' 
        });
      }

      // Create new user
      const user = new User({
        email,
        password,
        name: `${firstName} ${lastName}`,
        profile: {
          firstName,
          lastName
        }
      });

      await user.save();

      // Generate token for immediate login
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return user data and token
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profile: user.profile
        }
      });
    } catch (error) {
      console.error('Registration error details:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error registering user',
        error: error.message // Include error message for debugging
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      const user = await User.findById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (name) user.name = name;
      if (email) user.email = email;

      await user.save();
      res.json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  async getAssessments(req, res) {
    try {
      const user = await User.findById(req.user.userId)
        .populate('assessments')
        .select('assessments');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user.assessments);
    } catch (error) {
      console.error('Get assessments error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }

  async getCurrentUser(req, res) {
    try {
      // User is already attached to req by auth middleware
      const user = req.user;
      
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          profile: user.profile,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching user data'
      });
    }
  }
} 