import mongoose from 'mongoose';

const temporalDataSchema = {
  velocities: [Number],
  positions: [[Number]],
  ears: [Number],
  saccades: [Boolean],
  fixations: [Boolean],
  blinks: [Boolean],
  pursuitQuality: [Number]
};

const summaryMetricsSchema = {
  mean_velocity: Number,
  peak_velocity: Number,
  saccade_count: Number,
  fixation_count: Number,
  blink_count: Number,
  mean_ear: Number,
  movement_smoothness: Number,
  symmetry_score: Number,
  accuracy: Number
};

const eyeMovementSchema = new mongoose.Schema({
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
    default: 'eyeMovement'
  },
  assessmentId: {
    type: String
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  metrics: {
    CALIBRATION: {
      summary: summaryMetricsSchema,
      temporal: temporalDataSchema
    },
    SACCADIC_TEST: {
      summary: summaryMetricsSchema,
      temporal: temporalDataSchema
    },
    PURSUIT_TEST: {
      summary: summaryMetricsSchema,
      temporal: temporalDataSchema
    },
    FIXATION_TEST: {
      summary: summaryMetricsSchema,
      temporal: temporalDataSchema
    },
    assessmentType: {
      type: String,
      default: 'eyeMovement'
    },
    overall: {
      velocityScore: Number,
      accuracyScore: Number,
      smoothnessScore: Number,
      compositeScore: Number
    }
  }
}, {
  timestamps: true
});

eyeMovementSchema.index(
  { userId: 1, assessmentId: 1 },
  { unique: true, partialFilterExpression: { assessmentId: { $type: 'string' } } }
);

const EyeMovementAssessment = mongoose.model('EyeMovementAssessment', eyeMovementSchema);
export default EyeMovementAssessment;
