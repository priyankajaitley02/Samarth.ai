import mongoose from 'mongoose';

const responseTimeSchema = new mongoose.Schema({
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
    default: 'responseTime'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  metrics: {
    averageResponseTime: {
      type: String,
      required: true
    },
    fastestResponse: {
      type: String,
      required: true
    },
    slowestResponse: {
      type: String,
      required: true
    },
    totalRounds: {
      type: Number,
      required: true
    },
    completedRounds: {
      type: Number,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    assessmentType: {
      type: String,
      default: 'responseTime'
    },
    rawData: {
      responseTimes: [Number]
    },
    overall: {
      responseScore: Number
    }
  }
}, {
  timestamps: true
});

const ResponseTimeAssessment = mongoose.model('ResponseTimeAssessment', responseTimeSchema);
export default ResponseTimeAssessment;
