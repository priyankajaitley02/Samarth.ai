import { analytics } from './firebaseService';
import { assessmentService } from './assessmentService';

export const analyticsService = {
  // Track assessment completion
  trackAssessmentCompletion: async (userId, assessmentType, score) => {
    if (analytics) {
      analytics.logEvent('assessment_completed', {
        assessment_type: assessmentType,
        user_id: userId,
        score: score
      });
    }
  },

  // Get assessment progress over time
  getProgressData: async (userId, assessmentType, timeRange = 'month') => {
    try {
      const assessments = await assessmentService.getAssessmentHistory(userId);
      const filteredAssessments = assessments.filter(a => a.type === assessmentType);
      
      // Group by date
      const groupedData = groupAssessmentsByDate(filteredAssessments, timeRange);
      
      return {
        labels: Object.keys(groupedData),
        datasets: [{
          label: `${assessmentType} Progress`,
          data: Object.values(groupedData).map(day => calculateDayAverage(day))
        }]
      };
    } catch (error) {
      console.error('Error getting progress data:', error);
      throw error;
    }
  },

  // Get performance summary
  getPerformanceSummary: async (userId) => {
    try {
      const stats = await assessmentService.getAssessmentStats(userId);
      
      return {
        totalAssessments: Object.values(stats).reduce((sum, type) => sum + type.count, 0),
        lastAssessment: findLastAssessment(stats),
        improvements: calculateImprovements(stats),
        recommendations: generateRecommendations(stats)
      };
    } catch (error) {
      console.error('Error getting performance summary:', error);
      throw error;
    }
  },

  // Get comparative analytics
  getComparativeAnalytics: async (userId) => {
    try {
      const stats = await assessmentService.getAssessmentStats(userId);
      
      return Object.entries(stats).map(([type, data]) => ({
        type,
        score: data.averageScore,
        trend: data.trend,
        lastCompleted: data.lastCompleted
      }));
    } catch (error) {
      console.error('Error getting comparative analytics:', error);
      throw error;
    }
  }
};

// Helper Functions
const groupAssessmentsByDate = (assessments, timeRange) => {
  const grouped = {};
  const now = new Date();
  const timeRanges = {
    week: 7,
    month: 30,
    year: 365
  };
  
  const daysToInclude = timeRanges[timeRange] || timeRanges.month;
  
  // Initialize all dates in range
  for (let i = 0; i < daysToInclude; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    grouped[dateStr] = [];
  }
  
  // Group assessments by date
  assessments.forEach(assessment => {
    const dateStr = assessment.timestamp.split('T')[0];
    if (grouped[dateStr]) {
      grouped[dateStr].push(assessment);
    }
  });
  
  return grouped;
};

const calculateDayAverage = (assessments) => {
  if (!assessments.length) return null;
  return assessments.reduce((sum, assessment) => {
    return sum + (parseFloat(assessment.data.score) || 0);
  }, 0) / assessments.length;
};

const findLastAssessment = (stats) => {
  let lastAssessment = null;
  let lastTimestamp = null;

  Object.entries(stats).forEach(([type, data]) => {
    if (!lastTimestamp || new Date(data.lastCompleted) > new Date(lastTimestamp)) {
      lastAssessment = type;
      lastTimestamp = data.lastCompleted;
    }
  });

  return {
    type: lastAssessment,
    timestamp: lastTimestamp
  };
};

const calculateImprovements = (stats) => {
  return Object.entries(stats)
    .filter(([_, data]) => data.trend === 'improving')
    .map(([type]) => type);
};

const generateRecommendations = (stats) => {
  const recommendations = [];
  
  Object.entries(stats).forEach(([type, data]) => {
    if (data.trend === 'declining') {
      recommendations.push(`Focus on improving ${type} performance`);
    }
    if (data.count < 3) {
      recommendations.push(`Complete more ${type} assessments for better tracking`);
    }
  });
  
  return recommendations;
}; 