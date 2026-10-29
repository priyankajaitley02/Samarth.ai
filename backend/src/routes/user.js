import express from 'express';
import { auth } from '../middleware/auth.js';
import { UserController } from '../controllers/userController.js';

const router = express.Router();
const userController = new UserController();

// Public routes
router.post('/auth/register', userController.register.bind(userController));
router.post('/auth/login', userController.login.bind(userController));

// Protected routes
router.get('/auth/me', auth, userController.getCurrentUser.bind(userController));
router.get('/profile', auth, userController.getProfile.bind(userController));
router.put('/profile', auth, userController.updateProfile.bind(userController));
router.get('/assessments', auth, userController.getAssessments.bind(userController));

export default router; 