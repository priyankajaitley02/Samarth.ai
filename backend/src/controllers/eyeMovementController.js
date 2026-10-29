import { eyeMovementService } from '../services/eyeMovementService.js';

export const eyeMovementController = {
  async save(req, res) {
    try {
      console.log('Received eye movement assessment request:', {
        path: req.path,
        method: req.method,
        body: req.body,
        userId: req.body.userId
      });

      const assessmentData = req.body;
      
      console.log('Received assessment data:', {
        userId: assessmentData.userId,
        timestamp: assessmentData.timestamp,
        type: assessmentData.type,
        hasMetrics: !!assessmentData.metrics
      });

      // Validate required fields
      if (!assessmentData.userId || !assessmentData.metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const result = await eyeMovementService.saveAssessment(assessmentData);

      console.log('Assessment saved successfully:', {
        id: result.data._id,
        userId: assessmentData.userId
      });

      // Return the saved data with ID
      res.status(201).json({
        success: true,
        data: {
          ...assessmentData,
          id: result.data._id,
          savedAt: result.data.createdAt
        }
      });

    } catch (error) {
      console.error('Save assessment error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getHistory(req, res) {
    try {
      const { userId, limit } = req.query;
      const history = await eyeMovementService.getHistory(userId, limit);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getBaseline(req, res) {
    try {
      const { userId } = req.params; // Changed from req.query to req.params
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const baseline = await eyeMovementService.getBaseline(userId);
      
      if (!baseline) {
        return res.status(404).json({
          success: false,
          message: 'No baseline data found'
        });
      }

      res.json({
        success: true,
        data: baseline
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
};

// Helper functions
function calculateOverallScore(metrics, metric) {
  const scores = [];
  if (metrics.SACCADIC_TEST?.summary?.[metric] && metrics.SACCADIC_TEST.summary[metric] > 0) 
    scores.push(metrics.SACCADIC_TEST.summary[metric]);
  if (metrics.PURSUIT_TEST?.summary?.[metric] && metrics.PURSUIT_TEST.summary[metric] > 0) 
    scores.push(metrics.PURSUIT_TEST.summary[metric]);
  if (metrics.CALIBRATION?.summary?.[metric] && metrics.CALIBRATION.summary[metric] > 0) 
    scores.push(metrics.CALIBRATION.summary[metric]);
  if (metrics.FIXATION_TEST?.summary?.[metric] && metrics.FIXATION_TEST.summary[metric] > 0) 
    scores.push(metrics.FIXATION_TEST.summary[metric]);
  
  // Return default for accuracy if no valid scores
  if (scores.length === 0 && metric === 'accuracy') return 75.0;
  
  return scores.length ? scores.reduce((a, b) => a + b) / scores.length : 0;
}

function calculateCompositeScore(metrics) {
  const velocity = calculateOverallScore(metrics, 'mean_velocity');
  const accuracy = calculateOverallScore(metrics, 'accuracy');
  const smoothness = calculateOverallScore(metrics, 'movement_smoothness');
  
  return (velocity * 0.3 + accuracy * 0.4 + smoothness * 0.3);
}
