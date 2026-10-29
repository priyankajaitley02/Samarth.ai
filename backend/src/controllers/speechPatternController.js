import { speechPatternService } from '../services/speechPatternService.js';

export const speechPatternController = {
  async save(req, res) {
    try {
      console.log('Received speech pattern assessment request:', {
        path: req.path,
        method: req.method,
        userId: req.body.userId
      });

      const assessmentData = req.body;
      
      // Validate required fields
      if (!assessmentData.userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: userId'
        });
      }

      if (!assessmentData.metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: metrics'
        });
      }

      const result = await speechPatternService.saveAssessment(assessmentData);

      console.log('Speech pattern assessment saved successfully:', {
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
      console.error('Save speech pattern assessment error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getHistory(req, res) {
    try {
      const { userId, limit } = req.query;
      const history = await speechPatternService.getHistory(userId, limit);
      
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

      const baseline = await speechPatternService.getBaseline(userId);
      
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
