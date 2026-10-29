import { specializedAssessments } from '../api';

const formatLandmarks = (landmarks) => {
  // Convert landmarks object to expected format
  const formattedLandmarks = {};
  
  if (landmarks) {
    Object.entries(landmarks).forEach(([key, points]) => {
      if (Array.isArray(points)) {
        formattedLandmarks[key] = points.map(point => ({
          x: point.x || point._x || 0,
          y: point.y || point._y || 0,
          z: point.z || point._z || 0
        }));
      }
    });
  }
  
  return formattedLandmarks;
};

// Helper function to validate and fix risk indicators
const validateRiskIndicators = (indicators) => {
  if (!indicators) return {};
  
  const result = { ...indicators };
  
  // Process each risk indicator
  for (const key of Object.keys(result)) {
    if (result[key] && typeof result[key] === 'object') {
      // Ensure score is a number
      if (typeof result[key].score !== 'number' || isNaN(result[key].score)) {
        result[key].score = 0;
      }
      
      // Ensure risk level is consistent with score
      const score = result[key].score;
      if (score > 0.4) {
        result[key].risk = 'high';
      } else if (score > 0.25) {
        result[key].risk = 'moderate';
      } else {
        result[key].risk = 'low';
      }
    }
  }
  
  return result;
};

export const saveFacialAssessment = async (assessmentData) => {
  try {
    if (!assessmentData.userId || !assessmentData.metrics) {
      throw new Error('Missing required fields');
    }

    // Validate jaw symmetry if present in metrics
    if (assessmentData.metrics.metrics && 
        assessmentData.metrics.metrics.jaw_symmetry !== undefined && 
        assessmentData.metrics.metrics.jaw_symmetry <= 0) {
      // Ensure jaw_symmetry has a minimum non-zero value if metrics exist
      if (assessmentData.metrics.metrics.detailed_metrics && 
          assessmentData.metrics.metrics.detailed_metrics.jaw) {
        assessmentData.metrics.metrics.jaw_symmetry = 0.1; // Minimum reasonable value
      }
    }

    // Validate neurological indicators
    const neurological_indicators = validateRiskIndicators(assessmentData.metrics.neurologicalIndicators);

    // Don't restructure the data, use it as is
    const payload = {
      userId: assessmentData.userId,
      timestamp: new Date().toISOString(),
      type: 'FACIAL_SYMMETRY',
      // Use the original data format
      symmetry_score: assessmentData.metrics.symmetry_score || assessmentData.metrics.overallSymmetry,
      landmarks: formatLandmarks(assessmentData.metrics.landmarks),
      midline: assessmentData.metrics.midline || {},
      metrics: assessmentData.metrics.metrics || {},
      neurological_indicators: neurological_indicators,
      status: 'COMPLETED'
    };

    const response = await specializedAssessments.facialSymmetry.save(payload);
    
    if (!response.data) {
      throw new Error('Failed to save assessment');
    }

    return response.data;

  } catch (error) {
    console.error('Error in saveFacialAssessment:', error);
    throw error;
  }
};
