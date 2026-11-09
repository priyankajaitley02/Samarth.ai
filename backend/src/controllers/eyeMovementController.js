import { eyeMovementService } from '../services/eyeMovementService.js';

export const eyeMovementController = {
  async save(req, res) {
    try {
      const assessmentData = {
        ...req.body,
        userId: req.user._id.toString()
      };

      // Validate required fields
      if (!assessmentData.assessmentId || !assessmentData.metrics) {
        return res.status(400).json({
          success: false,
          error: 'assessmentId and metrics are required'
        });
      }

      const result = await eyeMovementService.saveAssessment(assessmentData);

      // Return the saved data with ID
      res.status(201).json({
        success: true,
        data: {
          ...result.data,
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
      const { limit } = req.query;
      const history = await eyeMovementService.getHistory(req.user._id.toString(), limit);
      
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
