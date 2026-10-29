import FacialSymmetryAssessment from '../models/FacialSymmetryAssessment.js';

export const facialSymmetryService = {
  async saveAssessment(assessmentData) {
    try {
      // Simply pass the assessment data as is to preserve the format
      const assessment = new FacialSymmetryAssessment(assessmentData);
      return await assessment.save();
    } catch (error) {
      console.error('Error saving facial symmetry assessment:', error);
      throw error;
    }
  },

  async getHistory(userId, limit = 10) {
    try {
      return await FacialSymmetryAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting facial symmetry history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      return await FacialSymmetryAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      }).sort({ timestamp: -1 });
    } catch (error) {
      console.error('Error getting facial symmetry baseline:', error);
      throw error;
    }
  }
};
