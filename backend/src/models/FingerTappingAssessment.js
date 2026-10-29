import mongoose from 'mongoose';

const fingerTappingSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    default: 'fingerTapping'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  metrics: {
    frequency: {
      type: Number,
      default: 0
    },
    amplitude: {
      type: Number,
      default: 0
    },
    rhythm: {
      type: Number,
      default: 0
    },
    accuracy: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      default: 0
    },
    overallScore: {
      type: Number,
      default: 0
    },
    tapData: [{
      time: Number,
      amplitude: Number,
      speed: Number
    }],
    rhythmData: {
      timestamps: [Number],
      intervals: [Number],
      targetInterval: Number
    },
    fatigueData: {
      timestamps: [Number],
      speedMetrics: [Number],
      accuracyMetrics: [Number],
      consistencyMetrics: [Number]
    },
    precisionData: [{
      frequency: Number,
      deviation: Number
    }],
    rawData: {
      tapIntervals: [Number],
      tapForce: [Number],
      timestamps: [Number]
    }
  }
}, {
  timestamps: true
});

const FingerTappingAssessment = mongoose.model('FingerTappingAssessment', fingerTappingSchema);
export default FingerTappingAssessment;
