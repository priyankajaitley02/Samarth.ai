import ResponseTimeAssessment from '../models/ResponseTimeAssessment.js';

export const responseTimeService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }

      // Calculate response score (lower times are better)
      const responseScore = calculateResponseScore(assessmentData.metrics);
      
      // Format metrics data for storage
      const formattedMetrics = {
        ...assessmentData.metrics,
        overall: {
          responseScore
        }
      };

      // Add raw data if available
      if (assessmentData.responses) {
        formattedMetrics.rawData = {
          responseTimes: assessmentData.responses
        };
      }

      const assessment = new ResponseTimeAssessment({
        userId: assessmentData.userId,
        timestamp: assessmentData.timestamp || new Date(),
        type: assessmentData.type || 'responseTime',
        metrics: formattedMetrics
      });

      const saved = await assessment.save();
      
      if (!saved) {
        throw new Error('Failed to save response time assessment');
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
      console.error('Error in responseTimeService.saveAssessment:', error);
      throw error;
    }
  },

  async getHistory(userId, limit = 10) {
    try {
      return await ResponseTimeAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting response time history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const baseline = await ResponseTimeAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      })
      .sort({ timestamp: -1 })
      .lean();

      return baseline;
    } catch (error) {
      console.error('Error getting response time baseline:', error);
      throw error;
    }
  }
};

// Helper function to calculate score based on response time
// Lower times are better, so we invert the scale
function calculateResponseScore(metrics) {
  const avgTime = parseFloat(metrics.averageResponseTime);
  if (isNaN(avgTime)) return 50; // Default middle score
  
  // Scale from 0-1000ms response time to 100-0 score
  // 200ms or less = 100 score (excellent)
  // 1000ms or more = 0 score (poor)
  const score = Math.max(0, Math.min(100, 100 - ((avgTime - 200) / 8)));
  return Math.round(score);
}
