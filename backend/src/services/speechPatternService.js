import SpeechPatternAssessment from '../models/SpeechPatternAssessment.js';

export const speechPatternService = {
  async saveAssessment(assessmentData) {
    try {
      if (!assessmentData.userId || !assessmentData.metrics) {
        throw new Error('Missing required fields');
      }
      
      // Handle nested metrics structure - if metrics contains another metrics object, use that
      const metricsData = assessmentData.metrics.metrics || assessmentData.metrics;
      
      // Ensure we have all required metric fields with defaults if missing
      const metrics = {
        clarity: {
          score: ensureNumber(metricsData.clarity?.score || metricsData.clarity)
        },
        speechRate: {
          wordsPerMinute: ensureNumber(metricsData.speechRate?.wordsPerMinute || metricsData.speechRate)
        },
        volumeControl: {
          score: ensureNumber(metricsData.volumeControl?.score || metricsData.volumeControl)
        },
        emotion: {
          confidence: ensureNumber(metricsData.emotion?.confidence || 0),
          hesitation: ensureNumber(metricsData.emotion?.hesitation || 0),
          stress: ensureNumber(metricsData.emotion?.stress || 0),
          monotony: ensureNumber(metricsData.emotion?.monotony || 0)
        },
        overallScore: ensureNumber(metricsData.overallScore),
        // Include additional metrics data if available
        articulation: metricsData.articulation || {
          precision: 0,
          vowel_formation: 0,
          consonant_precision: 0,
          slurred_speech: 0
        },
        fluency: metricsData.fluency || {
          fluency_score: 0,
          words_per_minute: ensureNumber(metricsData.speechRate?.wordsPerMinute || 0),
          pause_rate: 0
        },
        pitch_stability: ensureNumber(metricsData.pitch_stability || 0)
      };

      // Create the assessment object with the processed metrics
      const assessment = new SpeechPatternAssessment({
        userId: assessmentData.userId,
        timestamp: metricsData.timestamp || assessmentData.timestamp || new Date(),
        type: assessmentData.type || 'speechPattern',
        status: assessmentData.status || 'COMPLETED',
        metrics
      });

      const saved = await assessment.save();
      
      if (!saved) {
        throw new Error('Failed to save speech pattern assessment');
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
      console.error('Error in speechPatternService.saveAssessment:', error);
      throw error;
    }
  },

  async getHistory(userId, limit = 10) {
    try {
      return await SpeechPatternAssessment.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting speech pattern history:', error);
      throw error;
    }
  },

  async getBaseline(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const baseline = await SpeechPatternAssessment.findOne({ 
        userId,
        status: 'COMPLETED'
      })
      .sort({ timestamp: -1 })
      .lean();

      return baseline;
    } catch (error) {
      console.error('Error getting speech pattern baseline:', error);
      throw error;
    }
  }
};

// Helper functions to ensure we never save NaN values
function ensureNumber(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return 0;
  }
  return value;
}

function calculateIntelligibilityScore(metrics) {
  // Weighted calculation of intelligibility based on clarity and cognitive factors
  const clarity = metrics.clarity.score || 0;
  const stutterSeverity = metrics.cognition.stutter.severity || 0;
  const hesitationImpact = Math.max(0, 100 - (metrics.cognition.hesitations * 5)) || 0;
  
  return (clarity * 0.6 + hesitationImpact * 0.2 + (100 - stutterSeverity) * 0.2);
}

function calculateNaturalnessScore(metrics) {
  // Weighted calculation for how natural the speech sounds
  const prosodyScore = (
    (metrics.prosody.pitchVariability || 0) +
    (metrics.prosody.intonation || 0) +
    (metrics.prosody.rhythm || 0) +
    (metrics.prosody.stress || 0)
  ) / 4;
  
  const fluidityScore = Math.max(0, 100 - (
    (metrics.cognition.hesitations || 0) * 2 +
    (metrics.cognition.repetitions || 0) * 3 +
    (metrics.cognition.stutter.count || 0) * 5
  ));

  return (prosodyScore * 0.6 + fluidityScore * 0.4);
}

function calculateCommunicationEfficiencyScore(metrics) {
  // Efficiency combines rate, clarity and cognitive factors
  const speechRateScore = Math.min(100, metrics.fluency.speechRate / 1.5);
  const clarityScore = metrics.clarity.score || 0;
  const pauseImpact = Math.max(0, 100 - (metrics.fluency.pauseCount * 5));
  
  return (speechRateScore * 0.4 + clarityScore * 0.4 + pauseImpact * 0.2);
}

function calculateCompositeScore(metrics) {
  // Calculate overall speech assessment score if not provided
  const clarityWeight = 0.3;
  const fluencyWeight = 0.2;
  const prosodyWeight = 0.2;
  const cognitiveWeight = 0.2;
  const volumeWeight = 0.1;
  
  const clarityScore = metrics.clarity.score || 0;
  const fluencyScore = metrics.fluency.speechRate ? Math.min(100, metrics.fluency.speechRate / 1.5) : 0;
  const volumeScore = metrics.volume.control || 0;
  
  // Calculate prosody score
  const prosodyScore = (
    (metrics.prosody.pitchVariability || 0) + 
    (metrics.prosody.intonation || 0) + 
    (metrics.prosody.rhythm || 0) + 
    (metrics.prosody.stress || 0)
  ) / 4;
  
  // Calculate cognitive impact score (higher is better)
  const cognitiveImpact = Math.max(0, 100 - (
    (metrics.cognition.hesitations || 0) * 2 +
    (metrics.cognition.repetitions || 0) * 3 +
    (metrics.cognition.stutter.count || 0) * 5
  ));
  
  // Weighted average
  return (
    clarityScore * clarityWeight +
    fluencyScore * fluencyWeight +
    volumeScore * volumeWeight +
    prosodyScore * prosodyWeight +
    cognitiveImpact * cognitiveWeight
  );
}
