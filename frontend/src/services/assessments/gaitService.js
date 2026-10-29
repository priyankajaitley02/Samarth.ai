import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import { GaitMetricsAnalyzer } from '../metrics/gaitMetrics';
import { assessmentService } from '../assessmentService';

let detector = null;
let isAnalyzing = false;
let animationFrameId = null;

const initializeDetector = async () => {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    
    if (!detector) {
      const model = poseDetection.SupportedModels.BlazePose;
      const detectorConfig = {
        runtime: 'tfjs',
        enableSmoothing: true,
        modelType: 'full',
        scoreThreshold: 0.65
      };
      detector = await poseDetection.createDetector(model, detectorConfig);
    }
    return detector;
  } catch (error) {
    console.error('Error initializing detector:', error);
    throw error;
  }
};

export const startGaitAnalysis = async (videoElement, onMetricsUpdate) => {
  try {
    const detector = await initializeDetector();
    isAnalyzing = true;

    const analyzeFrame = async () => {
      if (!isAnalyzing) return;

      try {
        const poses = await detector.estimatePoses(videoElement, {
          flipHorizontal: false,
          maxPoses: 1
        });

        if (poses && poses.length > 0) {
          const metrics = calculateMetrics(poses[0]);
          if (metrics) {
            onMetricsUpdate(metrics);
          }
        }
      } catch (error) {
        console.error('Frame analysis error:', error);
      }

      if (isAnalyzing) {
        animationFrameId = requestAnimationFrame(analyzeFrame);
      }
    };

    analyzeFrame();
  } catch (error) {
    console.error('Error starting gait analysis:', error);
    throw error;
  }
};

export const stopGaitAnalysis = () => {
  isAnalyzing = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const calculateMetrics = (pose) => {
  if (!pose || !pose.keypoints || !pose.keypoints.length) {
    return null;
  }

  const keypoints = pose.keypoints3D || pose.keypoints;
  const findKeypoint = (name) => keypoints.find(kp => kp.name === name);

  const nose = findKeypoint('nose');
  const leftHip = findKeypoint('left_hip');
  const rightHip = findKeypoint('right_hip');
  const leftKnee = findKeypoint('left_knee');
  const rightKnee = findKeypoint('right_knee');
  const leftAnkle = findKeypoint('left_ankle');
  const rightAnkle = findKeypoint('right_ankle');
  const leftShoulder = findKeypoint('left_shoulder');
  const rightShoulder = findKeypoint('right_shoulder');

  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return null;
  }

  // Calculate center of mass (COM)
  const com = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  // Calculate velocity relative to frame size
  const velocity = {
    x: com.x / 640, // normalized by video width
    y: com.y / 480  // normalized by video height
  };

  const stability = calculateStabilityMetrics(nose, leftHip, rightHip, leftShoulder, rightShoulder);
  const symmetry = calculateSymmetryMetrics(leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle);
  const balance = calculateBalanceMetrics(leftHip, rightHip, leftShoulder, rightShoulder);
  const jointAngles = calculateJointAnglesMetrics(leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle);

  return {
    stability,
    symmetry,
    balance,
    jointAngles,
    velocity,
    keypoints: pose.keypoints,
    phaseData: {
      x: velocity.x,
      y: velocity.y,
      timestamp: Date.now()
    }
  };
};

const calculateStabilityMetrics = (nose, leftHip, rightHip, leftShoulder, rightShoulder) => {
  if (!nose || !leftHip || !rightHip || !leftShoulder || !rightShoulder) {
    return { score: 0, lateralSway: 0, verticalSway: 0 };
  }

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };

  const lateralSway = Math.abs(nose.x - hipCenter.x);
  const verticalSway = Math.abs(nose.y - shoulderCenter.y) / 100;
  const score = Math.max(0, 100 - (lateralSway * 2 + verticalSway * 50));

  return { score, lateralSway, verticalSway };
};

const calculateSymmetryMetrics = (leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle) => {
  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return { overall: 0, legSymmetry: 0, armSymmetry: 0 };
  }

  const leftLegLength = Math.sqrt(
    Math.pow(leftHip.x - leftKnee.x, 2) + Math.pow(leftHip.y - leftKnee.y, 2)
  );

  const rightLegLength = Math.sqrt(
    Math.pow(rightHip.x - rightKnee.x, 2) + Math.pow(rightHip.y - rightKnee.y, 2)
  );

  const legSymmetry = Math.max(0, 100 - Math.abs(leftLegLength - rightLegLength) * 10);
  
  return {
    overall: legSymmetry,
    legSymmetry,
    armSymmetry: legSymmetry
  };
};

const calculateBalanceMetrics = (leftHip, rightHip, leftShoulder, rightShoulder) => {
  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) {
    return 0;
  }

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };

  const verticalAlignment = Math.abs(hipCenter.x - shoulderCenter.x);
  return Math.max(0, 100 - (verticalAlignment * 5));
};

const calculateJointAnglesMetrics = (leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle) => {
  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return [];
  }

  const calculateAngle = (p1, p2, p3) => {
    if (!p1 || !p2 || !p3) return 0;
    
    const angle = Math.atan2(p3.y - p2.y, p3.x - p2.x) - 
                 Math.atan2(p1.y - p2.y, p1.x - p2.x);
    return Math.abs((angle * 180 / Math.PI + 360) % 360);
  };

  const leftHipAngle = calculateAngle(
    { x: leftHip.x, y: leftHip.y - 100 },
    leftHip,
    leftKnee
  );
  const rightHipAngle = calculateAngle(
    { x: rightHip.x, y: rightHip.y - 100 },
    rightHip,
    rightKnee
  );

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  return [
    { joint: 'left_hip', angle: leftHipAngle, confidence: leftHip.score },
    { joint: 'right_hip', angle: rightHipAngle, confidence: rightHip.score },
    { joint: 'left_knee', angle: leftKneeAngle, confidence: leftKnee.score },
    { joint: 'right_knee', angle: rightKneeAngle, confidence: rightKnee.score }
  ];
};

const calculateVelocityMetrics = (leftHip, rightHip) => {
  if (!leftHip || !rightHip) {
    return { x: 0, y: 0 };
  }

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  return { x: hipCenter.x / 100, y: hipCenter.y / 100 };
};

class GaitService {
  constructor() {
    this.analyzer = new GaitMetricsAnalyzer();
    this.isRecording = false;
    this.recordingStartTime = null;
    this.lastProcessedTime = null;
  }

  startRecording() {
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.lastProcessedTime = this.recordingStartTime;
    this.analyzer.metrics = []; // Reset metrics array
    return this.recordingStartTime;
  }

  stopRecording() {
    this.isRecording = false;
    const recordingEndTime = Date.now();
    const duration = (recordingEndTime - this.recordingStartTime) / 1000; // Convert to seconds
    
    const aggregateMetrics = this.analyzer.calculateAggregateMetrics();
    const assessmentData = {
      startTime: this.recordingStartTime,
      endTime: recordingEndTime,
      duration,
      metrics: aggregateMetrics,
      rawData: this.analyzer.metrics
    };

    // Save assessment data
    assessmentService.saveAssessment('GAIT_ANALYSIS', assessmentData);
    
    return assessmentData;
  }

  processFrame(pose, timestamp) {
    if (!this.isRecording || !pose) return null;

    const deltaTime = (timestamp - this.lastProcessedTime) / 1000; // Convert to seconds
    this.lastProcessedTime = timestamp;

    const metrics = this.analyzer.calculateInstantMetrics(pose, this.analyzer.lastPose, deltaTime);
    
    return {
      timestamp,
      ...metrics,
      isRecording: this.isRecording
    };
  }

  async getBaselineData() {
    try {
      const baselineData = await assessmentService.getBaselineData('GAIT_ANALYSIS');
      return baselineData;
    } catch (error) {
      console.error('Error fetching gait baseline data:', error);
      return null;
    }
  }

  async getAssessmentHistory() {
    try {
      const history = await assessmentService.getAssessmentHistory('GAIT_ANALYSIS');
      return history;
    } catch (error) {
      console.error('Error fetching gait assessment history:', error);
      return [];
    }
  }
}

export const gaitService = new GaitService(); 