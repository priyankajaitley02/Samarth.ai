import FingerTappingAssessment from '../models/FingerTappingAssessment.js';

export const fingerTappingService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }

      // Validate and sanitize metrics to prevent NaN values
      const sanitizedMetrics = validateNumericValues(assessmentData.metrics);

      // Ensure frequency is never zero to avoid division errors
      if (sanitizedMetrics.frequency === 0) {
        sanitizedMetrics.frequency = 0.1;
      }

      // Calculate overall score if not provided
      if (!sanitizedMetrics.overallScore) {
        sanitizedMetrics.overallScore = calculateOverallScore(sanitizedMetrics);
      }

      const assessment = new FingerTappingAssessment({
        userId: assessmentData.userId,
        timestamp: assessmentData.timestamp || new Date(),
        type: assessmentData.type || 'fingerTapping',
        status: assessmentData.status || 'COMPLETED',
        metrics: sanitizedMetrics
      });

      const saved = await assessment.save();
      
      if (!saved) {
        throw new Error('Failed to save finger tapping assessment');
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
      console.error('Error in fingerTappingService.saveAssessment:', error);
      throw error;
    }
  },

  async getHistory(userId, limit = 10) {
    try {
      return await FingerTappingAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting finger tapping history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const baseline = await FingerTappingAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      })
      .sort({ timestamp: -1 })
      .lean();

      return baseline;
    } catch (error) {
      console.error('Error getting finger tapping baseline:', error);
      throw error;
    }
  }
};

// Helper function to calculate overall score
function calculateOverallScore(metrics) {
  const frequencyScore = Math.min(100, metrics.frequency * 20); // Normalize frequency (5 taps/s = 100%)
  const rhythmScore = metrics.rhythm || 0;
  const accuracyScore = metrics.accuracy || 0;
  
  // Weighted score calculation
  return Math.min(100, (
    frequencyScore * 0.4 + 
    rhythmScore * 0.3 + 
    accuracyScore * 0.3
  ));
}

// Helper function to validate all numeric values in the metrics object
function validateNumericValues(obj) {
  if (!obj) return {};
  
  // Create a deep copy to avoid modifying the original object
  const sanitized = JSON.parse(JSON.stringify(obj));
  
  // Recursively check and sanitize all numeric values
  function sanitizeObject(object, path = '') {
    if (!object || typeof object !== 'object') return;
    
    for (const key in object) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = object[key];
      
      if (typeof value === 'number') {
        if (isNaN(value)) {
          console.warn(`NaN value detected at ${currentPath}, replacing with 0`);
          object[key] = 0;
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitizeObject(value, currentPath);
      }
    }
  }
  
  sanitizeObject(sanitized);
  return sanitized;
}
