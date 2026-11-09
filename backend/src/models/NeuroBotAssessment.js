import mongoose from 'mongoose';

const neuroBotAssessmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  sessionId: {
    type: String
  },
  type: {
    type: String,
    default: 'neurobot'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  failureReason: {
    type: String
  },
  history: {
    type: Array,
    default: []
  },
  metrics: {
    riskLevel: String,
    summary: String,
    recommendations: [String],
    extractedData: Object,
    overallScore: Number
  },
  report: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

neuroBotAssessmentSchema.index(
  { userId: 1, sessionId: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: 'string' } } }
);

const NeuroBotAssessment = mongoose.model('NeuroBotAssessment', neuroBotAssessmentSchema);

export default NeuroBotAssessment;
