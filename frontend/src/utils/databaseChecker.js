import axios from 'axios';

/**
 * Utility to check if assessment data exists in the database for a specific user
 * @param {string} userId - The user ID to check
 * @returns {Promise<Object>} Details about the user's assessments
 */
export const checkAssessmentData = async (userId) => {
  if (!userId) {
    console.error('No user ID provided for database check');
    return {
      success: false,
      error: 'Missing user ID',
      assessments: []
    };
  }

  try {
    // Get auth token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No auth token available');
      return {
        success: false,
        error: 'No authentication token available',
        assessments: []
      };
    }

    console.log(`Checking database for user ${userId}...`);
    
    // Check assessment collection directly (general assessments)
    const assessmentResponse = await axios.get(`http://localhost:5000/api/db/checkAssessments`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: { userId }
    });

    // Check specific assessment collections
    const specificResponse = await axios.get(`http://localhost:5000/api/db/checkSpecificAssessments`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: { userId }
    });

    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      userId,
      generalAssessments: {
        count: assessmentResponse.data.count || 0,
        samples: assessmentResponse.data.samples || []
      },
      specificAssessments: specificResponse.data || {}
    };

    // Add overall summary
    const totalAssessments = results.generalAssessments.count + 
      Object.values(results.specificAssessments).reduce((sum, collection) => sum + collection.count, 0);
    
    results.summary = {
      totalAssessments,
      hasData: totalAssessments > 0
    };

    return results;
  } catch (error) {
    console.error('Error checking database:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
      assessments: []
    };
  }
};

/**
 * Runs a comprehensive system diagnostic to check for database and API issues
 * @returns {Promise<Object>} Diagnostic report
 */
export const runSystemDiagnostic = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    auth: { status: 'unknown' },
    api: { status: 'unknown' },
    database: { status: 'unknown' }
  };
  
  try {
    // Check authentication
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    
    report.auth = {
      status: token && userId ? 'ok' : 'issue',
      hasToken: !!token,
      hasUserId: !!userId,
      userId
    };
    
    // Check basic API connectivity
    try {
      const healthResponse = await axios.get('http://localhost:5000/api/health');
      report.api = {
        status: 'ok',
        message: healthResponse.data.message || 'Connected',
        details: healthResponse.data
      };
    } catch (apiError) {
      report.api = {
        status: 'error',
        message: apiError.message,
        details: apiError.response?.data || {}
      };
    }
    
    // Check database if we have a user ID
    if (userId && token) {
      try {
        const dbCheckResponse = await checkAssessmentData(userId);
        report.database = {
          status: dbCheckResponse.success ? 'ok' : 'issue',
          hasData: dbCheckResponse.summary?.hasData || false,
          details: dbCheckResponse
        };
      } catch (dbError) {
        report.database = {
          status: 'error',
          message: dbError.message,
          details: {}
        };
      }
    } else {
      report.database = {
        status: 'skipped',
        message: 'No auth credentials to check database'
      };
    }
    
    // Overall system status
    const statuses = [report.auth.status, report.api.status, report.database.status];
    
    if (statuses.includes('error')) {
      report.status = 'error';
    } else if (statuses.includes('issue')) {
      report.status = 'warning';
    } else {
      report.status = 'ok';
    }
    
    return report;
  } catch (error) {
    console.error('Error running diagnostic:', error);
    return {
      ...report,
      status: 'error',
      error: error.message
    };
  }
};
