import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  getBaselineData,
  saveAssessment,
  getAssessmentHistory,
  deleteAssessment
} from '../controllers/assessmentController.js';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get baseline data
router.get('/baseline', getBaselineData);

// Save assessment
router.post('/', saveAssessment);

// Get assessment history
router.get('/history', getAssessmentHistory);

// Delete assessment
router.delete('/:id', deleteAssessment);

export default router;