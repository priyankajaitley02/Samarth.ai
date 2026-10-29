import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  z: Number
}, { _id: false });

const facialSymmetrySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'IN_PROGRESS'],
    default: 'COMPLETED'
  },
  symmetry_score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  landmarks: {
    leftEye: [pointSchema],
    rightEye: [pointSchema],
    mouth: [pointSchema],
    jawline: [pointSchema],
    nose: [pointSchema],
    leftEyebrow: [pointSchema],
    rightEyebrow: [pointSchema]
  },
  midline: {
    top: {
      x: Number,
      y: Number
    },
    bottom: {
      x: Number,
      y: Number
    },
    slope: Number,
    intercept: Number
  },
  metrics: {
    eye_symmetry: Number,
    mouth_symmetry: Number,
    jaw_symmetry: Number,
    eyebrow_symmetry: Number,
    face_tilt: Number,
    detailed_metrics: {
      eye: {
        left_eye_position: {
          x: Number,
          y: Number
        },
        right_eye_position: {
          x: Number,
          y: Number
        },
        left_eye_size: Number,
        right_eye_size: Number,
        distance_from_midline: {
          left: Number,
          right: Number
        },
        vertical_alignment: Number,
        size_symmetry: Number,
        distance_symmetry: Number
      },
      mouth: {
        center: {
          x: Number,
          y: Number
        },
        midline_position: Number,
        center_deviation: Number,
        normalized_deviation: Number,
        corner_alignment: Number,
        corners: {
          left: {
            x: Number,
            y: Number
          },
          right: {
            x: Number,
            y: Number
          }
        },
        corner_distances: {
          left: Number,
          right: Number,
          ratio: Number
        },
        droop_ratio: Number
      },
      jaw: {
        chin_position: {
          x: Number,
          y: Number
        },
        midline_position: Number,
        chin_deviation: Number,
        jaw_angles: {
          left: Number,
          right: Number,
          difference: Number,
          symmetry: Number
        },
        jaw_lengths: {
          left: Number,
          right: Number,
          ratio: Number
        }
      },
      eyebrow: {
        positions: {
          left: {
            x: Number,
            y: Number
          },
          right: {
            x: Number,
            y: Number
          }
        },
        distance_from_midline: {
          left: Number,
          right: Number,
          ratio: Number
        },
        vertical_alignment: {
          difference: Number,
          symmetry: Number
        },
        heights: {
          left: Number,
          right: Number,
          ratio: Number
        }
      }
    }
  },
  neurological_indicators: {
    bells_palsy: {
      score: Number,
      risk: {
        type: String,
        enum: ['low', 'moderate', 'high']
      }
    },
    stroke: {
      score: Number,
      risk: {
        type: String,
        enum: ['low', 'moderate', 'high']
      }
    },
    parkinsons: {
      score: Number,
      risk: {
        type: String,
        enum: ['low', 'moderate', 'high']
      }
    },
    overall: {
      score: Number,
      risk: {
        type: String,
        enum: ['low', 'moderate', 'high']
      }
    }
  }
});

const FacialSymmetryAssessment = mongoose.model('FacialSymmetryAssessment', facialSymmetrySchema);
export default FacialSymmetryAssessment;
