import assessmentService from '../services/assessmentService';

/**
 * Helper function to load baseline data for any assessment type
 * @param {string} type - Assessment type from assessmentService.ASSESSMENT_TYPES
 * @param {function} setBaselineData - State setter for baseline data
 * @param {function} [setLoading] - Optional state setter for loading state
 * @param {function} [setError] - Optional state setter for error state
 * @returns {Promise<void>}
 */
export const loadBaselineData = async (type, setBaselineData, setLoading, setError) => {
  try {
    if (setLoading) setLoading(true);
    
    // Get user ID from localStorage
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      console.warn('No user ID available for baseline data');
      setBaselineData(null);
      return;
    }
    
    console.log(`Loading baseline data for ${type} with user ID:`, userId);
    
    // Call getBaselineData with both type and userId
    const data = await assessmentService.getBaselineData(type, userId);
    
    if (data) {
      console.log('Baseline data loaded:', data);
      setBaselineData(data);
    } else {
      console.log(`No baseline data found for ${type}`);
      setBaselineData(null);
    }
  } catch (error) {
    console.error(`Error loading baseline data for ${type}:`, error);
    if (setError) setError(`Failed to load baseline data: ${error.message}`);
    setBaselineData(null);
  } finally {
    if (setLoading) setLoading(false);
  }
};

/**
 * Helper function to get auth headers for API requests
 * @returns {Object} Headers object with Authorization if token exists
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  } : {
    'Content-Type': 'application/json'
  };
};

/**
 * Helper function to handle API errors consistently
 * @param {Error} error - Error object from API call
 * @param {function} [setError] - Optional state setter for error display
 * @returns {string} Error message
 */
export const handleApiError = (error, setError) => {
  const errorMessage = error.response?.data?.message || error.message || 'Unknown error occurred';
  
  console.error('API Error:', errorMessage);
  if (setError) {
    setError(errorMessage);
  }
  
  return errorMessage;
};
