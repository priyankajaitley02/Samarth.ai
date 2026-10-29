import NeckMobilityAssessment from '../models/NeckMobilityAssessment.js';

export const neckMobilityService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }

      // Format metrics data for storage
      const formattedMetrics = {
        flexion: {
          degrees: assessmentData.metrics.flexion_degrees,
          percent: assessmentData.metrics.flexion_percent
        },
        extension: {
          degrees: assessmentData.metrics.extension_degrees,
          percent: assessmentData.metrics.extension_percent
        },
        rotation: {
          left: {
            degrees: assessmentData.metrics.left_rotation_degrees,
            percent: assessmentData.metrics.left_rotation_percent
          },
          right: {
            degrees: assessmentData.metrics.right_rotation_degrees,
            percent: assessmentData.metrics.right_rotation_percent
          }
        },
        overall: {
          mobilityScore: calculateMobilityScore(assessmentData.metrics),
          symmetryScore: calculateSymmetryScore(assessmentData.metrics)
        }
      };

      const assessment = new NeckMobilityAssessment({
        userId: assessmentData.userId,
        timestamp: assessmentData.timestamp,
        type: assessmentData.type,
        metrics: formattedMetrics
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
      return await NeckMobilityAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting neck mobility history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const baseline = await NeckMobilityAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      })
      .sort({ timestamp: -1 })
      .lean();

      return baseline;
    } catch (error) {
      console.error('Error getting neck mobility baseline:', error);
      throw error;
    }
  }
};

// Helper functions
function calculateMobilityScore(metrics) {
  // Normal ranges as percentages
  const normalFlexion = 100;
  const normalExtension = 100;
  const normalRotation = 100;

  // Calculate each component as a percentage of normal range
  const flexionScore = Math.min(100, metrics.flexion_percent || 0);
  const extensionScore = Math.min(100, metrics.extension_percent || 0);
  const leftRotationScore = Math.min(100, metrics.left_rotation_percent || 0);
  const rightRotationScore = Math.min(100, metrics.right_rotation_percent || 0);
  
  // Average of all mobility scores
  const rotationScore = (leftRotationScore + rightRotationScore) / 2;
  return (flexionScore * 0.3 + extensionScore * 0.3 + rotationScore * 0.4);
}

function calculateSymmetryScore(metrics) {
  // Calculate symmetry between left and right sides
  const leftRotation = metrics.left_rotation_percent || 0;
  const rightRotation = metrics.right_rotation_percent || 0;
  
  // Perfect symmetry would be 100%, complete asymmetry would be 0%
  if (leftRotation === 0 && rightRotation === 0) return 100;
  
  const max = Math.max(leftRotation, rightRotation);
  const min = Math.min(leftRotation, rightRotation);
  
  return min / max * 100;
}
