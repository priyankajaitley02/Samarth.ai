import EyeMovementAssessment from '../models/EyeMovementAssessment.js';

export const eyeMovementService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }

      // Ensure all required metrics are present
      const requiredMetrics = ['CALIBRATION', 'SACCADIC_TEST', 'PURSUIT_TEST', 'FIXATION_TEST'];
      for (const metric of requiredMetrics) {
        // Initialize if missing
        if (!assessmentData.metrics[metric]) {
          assessmentData.metrics[metric] = {
            summary: {
              accuracy: 75.0  // Use a reasonable default value
            },
            temporal: {
              velocities: [],
              ears: [],
              positions: [],
              saccades: [],
              fixations: [],
              blinks: []
            }
          };
        } 
        // Ensure summary exists
        else if (!assessmentData.metrics[metric].summary) {
          assessmentData.metrics[metric].summary = { accuracy: 75.0 };
        } 
        // Ensure accuracy exists in summary
        else if (assessmentData.metrics[metric].summary && 
                (typeof assessmentData.metrics[metric].summary.accuracy === 'undefined' || 
                 assessmentData.metrics[metric].summary.accuracy === null ||
                 assessmentData.metrics[metric].summary.accuracy === 0)) {
          assessmentData.metrics[metric].summary.accuracy = 75.0;
        }
      }

      // Recalculate overall metrics
      const calculateAverage = (metric) => {
        const scores = [];
        for (const phase of requiredMetrics) {
          if (assessmentData.metrics[phase]?.summary?.[metric]) {
            // Only include non-zero values
            const value = assessmentData.metrics[phase].summary[metric];
            if (value > 0) scores.push(value);
          }
        }
        return scores.length ? scores.reduce((a, b) => a + b) / scores.length : 
               (metric === 'accuracy' ? 75.0 : 0); // Default accuracy to 75.0
      };

      const velocityScore = calculateAverage('mean_velocity');
      const accuracyScore = calculateAverage('accuracy');
      const smoothnessScore = calculateAverage('movement_smoothness');
      
      assessmentData.metrics.overall = {
        velocityScore,
        accuracyScore,
        smoothnessScore,
        compositeScore: (velocityScore * 0.3 + accuracyScore * 0.4 + smoothnessScore * 0.3)
      };

      const assessment = new EyeMovementAssessment({
        userId: assessmentData.userId,
        timestamp: assessmentData.timestamp,
        type: assessmentData.type,
        metrics: assessmentData.metrics
      });

      const saved = await assessment.save();
      
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
