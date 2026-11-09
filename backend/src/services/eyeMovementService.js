import EyeMovementAssessment from '../models/EyeMovementAssessment.js';

export const eyeMovementService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.assessmentId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }

      const calculateAverage = (metric) => {
        const values = ['CALIBRATION', 'SACCADIC_TEST', 'PURSUIT_TEST', 'FIXATION_TEST']
          .map(phase => assessmentData.metrics[phase]?.summary?.[metric])
          .filter(value => typeof value === 'number' && Number.isFinite(value));
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      };

      const velocityScore = calculateAverage('mean_velocity');
      const accuracyScore = calculateAverage('accuracy');
      const smoothnessScore = calculateAverage('movement_smoothness');
      
      const metrics = {
        ...assessmentData.metrics,
        assessmentType: 'eyeMovement',
        overall: {
          ...assessmentData.metrics.overall,
          velocityScore,
          accuracyScore,
          smoothnessScore,
          compositeScore: (velocityScore * 0.3 + accuracyScore * 0.4 + smoothnessScore * 0.3)
        }
      };

      const saved = await EyeMovementAssessment.findOneAndUpdate(
        { userId: assessmentData.userId, assessmentId: assessmentData.assessmentId },
        { $set: {
          userId: assessmentData.userId,
          assessmentId: assessmentData.assessmentId,
          timestamp: assessmentData.timestamp || new Date(),
          type: 'eyeMovement',
          status: 'COMPLETED',
          metrics
        } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );

      if (!saved) {
        throw new Error('Failed to save assessment');
      }

      return {
        success: true,
        data: {
          _id: saved._id,
          id: saved._id,
          ...saved.toObject()
        }
      };
    } catch (error) {
      console.error('Error in saveAssessment:', error);
      throw error;
    }
  },

  async getHistory(userId, limit = 10) {
    try {
      return await EyeMovementAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting eye movement history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const baseline = await EyeMovementAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      })
      .sort({ timestamp: -1 })
      .lean();

      return baseline;
    } catch (error) {
      console.error('Error getting eye movement baseline:', error);
      throw error;
    }
  },

  async analyzeNeurologicalIndicators(assessmentData) {
    // Add specialized analysis logic here
    return assessmentData;
  }
};
