import { tremorService } from '../services/tremorService.js';

export const tremorController = {
  async save(req, res) {
    try {
      const assessmentData = { ...req.body, userId: req.user._id.toString() };

      // Attach raw buffer from device if client didn't include rawData
      try {
        const deviceId = assessmentData.deviceId || assessmentData.metrics?.deviceId || req.query.deviceId || null;
        if (deviceId && !assessmentData.metrics?.rawData) {
          const raw = await tremorService.getLatestRaw(deviceId);
          if (raw && raw.samples && raw.samples.length > 0) {
            assessmentData.metrics = assessmentData.metrics || {};
            assessmentData.metrics.rawData = {
              sampleRate: raw.sampleRate,
              samples: raw.samples 
            };
            console.log('Attached raw buffer from device to assessmentData.metrics.rawData', { deviceId, sampleCount: raw.samples.length });
          }
        }
      } catch (e) {
        console.warn('Failed to attach raw buffer:', e.message || e);
      }

      // Validate required fields
      if (!assessmentData.userId || !assessmentData.metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      const result = await tremorService.saveAssessment(assessmentData);

      console.log('Tremor assessment saved successfully:', {
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
      console.error('Save tremor assessment error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  async getHistory(req, res) {
    try {
      const { limit } = req.query;
      const history = await tremorService.getHistory(req.user._id.toString(), limit);
      
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
      const userId = req.user._id.toString();
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      const baseline = await tremorService.getBaseline(userId);
      
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
