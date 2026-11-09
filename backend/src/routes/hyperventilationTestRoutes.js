import express from 'express';
import { startTest, phaseAction, completeTest, getTest } from '../controllers/hyperventilationTestController.js';
import { ingestSignalData } from '../controllers/hyperventilationSignalController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.use(auth);
router.use((req, res, next) => {
  req.body = { ...(req.body || {}), userId: req.user._id.toString() };
  next();
});

router.post('/start', startTest);
router.post('/phase', phaseAction);
router.post('/data', ingestSignalData);
router.post('/complete', completeTest);
router.get('/:testId', getTest);

export default router;
