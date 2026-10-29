import express from 'express';
import { auth } from '../middleware/auth.js';
import { checkAssessments, checkSpecificAssessments, checkHealth, migrateAssessmentData, analyzeAssessmentSchema } from '../controllers/diagnosticController.js';

const router = express.Router();

// Public health check route
router.get('/health', checkHealth);

// Protected routes for database checks - require authentication
router.get('/db/checkAssessments', auth, checkAssessments);
router.get('/db/checkSpecificAssessments', auth, checkSpecificAssessments);

// Add a migration route
router.post('/db/migrate-assessments', auth, migrateAssessmentData);
router.get('/db/analyze-schema', auth, analyzeAssessmentSchema);

export default router;
