import api from '../services/api';

/**
 * Utility to fix inconsistent data in the database
 * This migrates older assessment formats to match the current schema
 */
export const migrateAssessmentData = async (userId) => {
  try {
    if (!userId) {
      console.error('User ID required for data migration');
      return { success: false, message: 'User ID required' };
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('Authentication token required for data migration');
      return { success: false, message: 'Authentication token required' };
    }
    
    console.log('Starting assessment data migration for user:', userId);
    
    // Call the migration endpoint
    const response = await api.post('/db/migrate-assessments', {
      userId
    });
    
    return {
      success: true,
      message: 'Assessment data migration completed',
      details: response.data
    };
  } catch (error) {
    console.error('Error during assessment data migration:', error);
    return {
      success: false,
      message: 'Migration failed',
      error: error.message
    };
  }
};

/**
 * Analyze schema differences in assessment collections
 */
export const analyzeAssessmentSchema = async (userId) => {
  try {
    const response = await api.get('/db/analyze-schema', {
      params: { userId }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error analyzing assessment schema:', error);
    return { success: false, error: error.message };
  }
};
