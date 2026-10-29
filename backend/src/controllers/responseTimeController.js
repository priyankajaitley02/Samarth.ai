import { responseTimeService } from '../services/responseTimeService.js';

export const responseTimeController = {
  async save(req, res) {
    try {
      console.log('Received response time assessment request:', {
        path: req.path,
        method: req.method,
        body: req.body,
        userId: req.body.userId
      });

      const assessmentData = req.body;
      
      // Validate required fields
      if (!assessmentData.userId || !assessmentData.metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const result = await responseTimeService.saveAssessment(assessmentData);

      console.log('Response time assessment saved successfully:', {
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
      console.error('Save response time assessment error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getHistory(req, res) {
    try {
      const { userId, limit } = req.query;
      const history = await responseTimeService.getHistory(userId, limit);
      
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

      const baseline = await responseTimeService.getBaseline(userId);
      
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
