import api from './api.js';

/**
 * Service for managing hyperventilation test data and integration with assessments
 */
export const hyperventilationService = {
  /**
   * Retrieve hyperventilation test results from assessments
   */
  async getTestResults() {
    try {
      const response = await api.get('/assessments/history', {
        params: { type: 'HYPERVENTILATION_TEST' }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error retrieving hyperventilation test results:', error);
      throw error;
    }
  },

  /**
   * Get test summary for display in reports
   */
  formatTestSummary(test) {
    return {
      timestamp: test.timestamp,
      riskLevel: test.metrics.riskLevel,
      screeningFlag: test.metrics.screeningFlag,
      recommendedAction: test.metrics.recommendedAction,
      findings: {
        baselineSpikes: test.metrics.baselineSpikes,
        hyperventilationSpikes: test.metrics.hyperventilationSpikes,
        recoverySpikes: test.metrics.recoverySpikes,
        alphaSuppression: `${test.metrics.alphaSuppression}%`,
        deltaIncrease: `${test.metrics.deltaIncrease}%`
      }
    };
  }
};

export default hyperventilationService;
