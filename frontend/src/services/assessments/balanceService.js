import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';

let detector = null;
let isAnalyzing = false;
let animationFrameId = null;

const initializeDetector = async () => {
  if (!detector) {
    const model = poseDetection.SupportedModels.BlazePose;
    const detectorConfig = {
      runtime: 'tfjs',
      enableSmoothing: true,
      modelType: 'full'
    };
    detector = await poseDetection.createDetector(model, detectorConfig);
  }
  return detector;
};

export const startBalanceAssessment = async (videoElement, onMetricsUpdate) => {
  try {
    await initializeDetector();
    isAnalyzing = true;

    const analyzeFrame = async () => {
      if (!isAnalyzing) return;

      try {
        const poses = await detector.estimatePoses(videoElement);
        if (poses.length > 0) {
          const metrics = calculateBalanceMetrics(poses[0]);
          onMetricsUpdate(metrics);
        }
      } catch (error) {
        console.error('Frame analysis error:', error);
      }

      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    analyzeFrame();
  } catch (error) {
    console.error('Error starting balance assessment:', error);
    throw error;
  }
};

export const stopBalanceAssessment = () => {
  isAnalyzing = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const calculateBalanceMetrics = (pose) => {
  if (!pose || !pose.keypoints) {
    return {
      overallBalance: 0,
      posturalSway: { lateral: 0, anterior: 0 },
      weightDistribution: { left: 0, right: 0 },
      stabilityScore: 0
    };
  }

  const keypoints = pose.keypoints;
  const nose = keypoints.find(kp => kp.name === 'nose');
  const leftHip = keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = keypoints.find(kp => kp.name === 'right_hip');
  const leftShoulder = keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = keypoints.find(kp => kp.name === 'right_shoulder');
  const leftAnkle = keypoints.find(kp => kp.name === 'left_ankle');
  const rightAnkle = keypoints.find(kp => kp.name === 'right_ankle');

  if (!nose || !leftHip || !rightHip || !leftShoulder || !rightShoulder || !leftAnkle || !rightAnkle) {
    return {
      overallBalance: 0,
      posturalSway: { lateral: 0, anterior: 0 },
      weightDistribution: { left: 0, right: 0 },
      stabilityScore: 0
    };
  }

  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  const shoulderCenter = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };

  const ankleCenter = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2
  };

  // Calculate postural sway
  const lateralSway = Math.abs(nose.x - ankleCenter.x);
  const anteriorSway = Math.abs(nose.y - shoulderCenter.y);

  // Calculate weight distribution
  const leftWeight = calculateWeightDistribution(leftAnkle, rightAnkle);
  const rightWeight = 100 - leftWeight;

  // Calculate stability score
  const verticalAlignment = Math.abs(hipCenter.x - shoulderCenter.x);
  const stabilityScore = Math.max(0, 100 - (verticalAlignment * 5 + lateralSway * 2));

  // Calculate overall balance score
  const overallBalance = calculateOverallBalance(lateralSway, anteriorSway, leftWeight, rightWeight);

  return {
    overallBalance,
    posturalSway: {
      lateral: lateralSway,
      anterior: anteriorSway
    },
    weightDistribution: {
      left: leftWeight,
      right: rightWeight
    },
    stabilityScore
  };
};

const calculateWeightDistribution = (leftAnkle, rightAnkle) => {
  if (!leftAnkle || !rightAnkle) return 50;

  const totalDistance = Math.abs(leftAnkle.x - rightAnkle.x);
  if (totalDistance === 0) return 50;

  const leftWeight = (leftAnkle.score || 0.5) * 100;
  return Math.min(Math.max(leftWeight, 0), 100);
};

const calculateOverallBalance = (lateralSway, anteriorSway, leftWeight, rightWeight) => {
  const swayPenalty = (lateralSway + anteriorSway) * 2;
  const weightImbalancePenalty = Math.abs(leftWeight - rightWeight) / 2;
  
  return Math.max(0, 100 - (swayPenalty + weightImbalancePenalty));
}; 