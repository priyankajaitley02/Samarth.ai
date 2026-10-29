import mongoose from 'mongoose';

const neckMobilitySchema = new mongoose.Schema({
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
    default: 'neckMobility'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  metrics: {
    flexion: {
      degrees: Number,
      percent: Number
    },
    extension: {
      degrees: Number,
      percent: Number
    },
    rotation: {
      left: {
        degrees: Number,
        percent: Number
      },
      right: {
        degrees: Number,
        percent: Number
      }
    },
    lateralBending: {
      left: {
        degrees: Number,
        percent: Number
      },
      right: {
        degrees: Number,
        percent: Number
      }
    },
    overall: {
      mobilityScore: Number,
      symmetryScore: Number
    },
    rawData: {
      angles: Object,
      timestamps: [Date]
    }
  }
}, {
  timestamps: true
});

const NeckMobilityAssessment = mongoose.model('NeckMobilityAssessment', neckMobilitySchema);
export default NeckMobilityAssessment;
