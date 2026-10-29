import mongoose from 'mongoose';

const speechPatternSchema = new mongoose.Schema({
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
    default: 'speechPattern'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  metrics: {
    clarity: {
      score: {
        type: Number,
        default: 0
      }
    },
    speechRate: {
      wordsPerMinute: {
        type: Number,
        default: 0
      }
    },
    volumeControl: {
      score: {
        type: Number,
        default: 0
      }
    },
    emotion: {
      confidence: {
        type: Number,
        default: 0
      },
      hesitation: {
        type: Number,
        default: 0
      },
      stress: {
        type: Number,
        default: 0
      },
      monotony: {
        type: Number,
        default: 0
      }
    },
    overallScore: {
      type: Number,
      default: 0
    },
    // Optional additional metrics that might be present
    articulation: {
      precision: {
        type: Number,
        default: 0
      },
      vowel_formation: {
        type: Number,
        default: 0
      },
      consonant_precision: {
        type: Number,
        default: 0
      },
      slurred_speech: {
        type: Number,
        default: 0
      }
    },
    fluency: {
      fluency_score: {
        type: Number,
        default: 0
      },
      words_per_minute: {
        type: Number,
        default: 0
      },
      pause_rate: {
        type: Number,
        default: 0
      }
    },
    pitch_stability: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Add a pre-save middleware to ensure nested objects exist
speechPatternSchema.pre('save', function(next) {
  if (!this.metrics) {
    this.metrics = {};
  }
  // Set default values for metrics if they're missing
  this.metrics.clarity = this.metrics.clarity || { score: 0 };
  this.metrics.speechRate = this.metrics.speechRate || { wordsPerMinute: 0 };
  this.metrics.volumeControl = this.metrics.volumeControl || { score: 0 };
  this.metrics.emotion = this.metrics.emotion || {
    confidence: 0,
    hesitation: 0,
    stress: 0,
    monotony: 0
  };
  this.metrics.overallScore = this.metrics.overallScore || 0;
  
  // Set nested optional fields
  this.metrics.articulation = this.metrics.articulation || {
    precision: 0,
    vowel_formation: 0,
    consonant_precision: 0,
    slurred_speech: 0
  };
  this.metrics.fluency = this.metrics.fluency || {
    fluency_score: 0,
    words_per_minute: 0,
    pause_rate: 0
  };
  this.metrics.pitch_stability = this.metrics.pitch_stability || 0;
  
  next();
});

// Add method to format the assessment data
speechPatternSchema.methods.toResponseFormat = function() {
  return {
    id: this._id,
    type: this.type,
    timestamp: this.timestamp,
    metrics: {
      clarity: {
        score: this.metrics.clarity.score
      },
      speechRate: {
        wordsPerMinute: this.metrics.speechRate.wordsPerMinute
      },
      volumeControl: {
        score: this.metrics.volumeControl.score
      },
      emotion: {
        confidence: this.metrics.emotion.confidence,
        hesitation: this.metrics.emotion.hesitation,
        stress: this.metrics.emotion.stress,
        monotony: this.metrics.emotion.monotony
      },
      overallScore: this.metrics.overallScore,
      articulation: this.metrics.articulation,
      fluency: this.metrics.fluency,
      pitch_stability: this.metrics.pitch_stability
    },
    userId: this.userId,
    status: this.status
  };
};

const SpeechPatternAssessment = mongoose.model('SpeechPatternAssessment', speechPatternSchema);
export default SpeechPatternAssessment; 