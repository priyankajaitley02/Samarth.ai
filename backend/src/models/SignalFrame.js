import mongoose from 'mongoose';

const SignalFrameSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'EpilepsyTest', required: true },
  timestamp: { type: Number, required: true }, // ms since epoch, when the server received the samples
  phase: { type: String, enum: ['baseline', 'hyperventilation', 'recovery'], required: false },
  eeg: { type: [Number], default: [] },
  ecg: { type: [Number], default: [] },
  hr: { type: Number }
}, { timestamps: true });

SignalFrameSchema.index({ testId: 1, timestamp: 1 });

const SignalFrame = mongoose.model('SignalFrame', SignalFrameSchema);
export default SignalFrame;
