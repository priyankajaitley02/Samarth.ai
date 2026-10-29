import { facialSymmetryService } from '../services/facialSymmetryService.js';

// Make validation a standalone function to avoid "this" binding issues
const validateNeurologicalIndicators = (indicators) => {
  if (!indicators) return null;
  
  const validatedIndicators = { ...indicators };
  
  // Ensure risk levels match scores
  for (const key of Object.keys(validatedIndicators)) {
    if (validatedIndicators[key] && typeof validatedIndicators[key] === 'object') {
      const score = validatedIndicators[key].score;
      
      // Validate score is a number
      if (typeof score !== 'number' || isNaN(score)) {
        validatedIndicators[key].score = 0;
      }
      
      // Ensure risk levels match scores
      if (score > 0.4) {
        validatedIndicators[key].risk = 'high';
      } else if (score > 0.25) {
        validatedIndicators[key].risk = 'moderate';
      } else {
        validatedIndicators[key].risk = 'low';
      }
    }
  }
  
  return validatedIndicators;
};

export const facialSymmetryController = {
  async save(req, res) {
    try {
      const { userId, symmetry_score, landmarks, midline, metrics, neurological_indicators } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      // Use the standalone validation function instead of a method
      const validatedIndicators = neurological_indicators ? validateNeurologicalIndicators(neurological_indicators) : neurological_indicators;

      // Save assessment with original format
      const assessment = await facialSymmetryService.saveAssessment({
        userId,
        symmetry_score,
        landmarks,
        midline,
        metrics,
        neurological_indicators: validatedIndicators,
        timestamp: new Date(),
        status: 'COMPLETED'
      });

      res.status(201).json({
        success: true,
        data: assessment
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getHistory(req, res) {
    try {
      const { userId, limit } = req.query;
      const history = await facialSymmetryService.getHistory(userId, limit);
      
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
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const baseline = await facialSymmetryService.getBaseline(userId);
      
      // If no baseline found, return empty data with 200 status
      if (!baseline) {
        return res.json({
          success: true,
          data: null
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
