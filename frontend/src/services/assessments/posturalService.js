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

export const startPosturalAssessment = async (videoElement, onMetricsUpdate) => {
  try {
    await initializeDetector();
    isAnalyzing = true;

    const analyzeFrame = async () => {
      if (!isAnalyzing) return;

      try {
        const poses = await detector.estimatePoses(videoElement);
        if (poses.length > 0) {
          const metrics = calculatePosturalMetrics(poses[0]);
          onMetricsUpdate(metrics);
        }
      } catch (error) {
        console.error('Frame analysis error:', error);
      }

      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    analyzeFrame();
  } catch (error) {
    console.error('Error starting postural assessment:', error);
    throw error;
  }
};

export const stopPosturalAssessment = () => {
  isAnalyzing = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

const calculatePosturalMetrics = (pose) => {
  if (!pose || !pose.keypoints) {
    return {
      spinalAlignment: 0,
      shoulderAlignment: 0,
      hipAlignment: 0,
      headPosition: { forward: 0, tilt: 0 },
      overallPosture: 0
    };
  }

  const keypoints = pose.keypoints;
  const nose = keypoints.find(kp => kp.name === 'nose');
  const leftEye = keypoints.find(kp => kp.name === 'left_eye');
  const rightEye = keypoints.find(kp => kp.name === 'right_eye');
  const leftShoulder = keypoints.find(kp => kp.name === 'left_shoulder');
  const rightShoulder = keypoints.find(kp => kp.name === 'right_shoulder');
  const leftHip = keypoints.find(kp => kp.name === 'left_hip');
  const rightHip = keypoints.find(kp => kp.name === 'right_hip');

  if (!nose || !leftEye || !rightEye || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return {
      spinalAlignment: 0,
      shoulderAlignment: 0,
      hipAlignment: 0,
      headPosition: { forward: 0, tilt: 0 },
      overallPosture: 0
    };
  }

  // Calculate shoulder alignment
  const shoulderSlope = Math.abs(
    (rightShoulder.y - leftShoulder.y) / (rightShoulder.x - leftShoulder.x)
  );
  const shoulderAlignment = Math.max(0, 100 - (shoulderSlope * 100));

  // Calculate hip alignment
  const hipSlope = Math.abs(
    (rightHip.y - leftHip.y) / (rightHip.x - leftHip.x)
  );
  const hipAlignment = Math.max(0, 100 - (hipSlope * 100));

  // Calculate head position
  const eyeMidpoint = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2
  };
  
  const headTilt = Math.abs(
    Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI
  );
  
  const forwardHead = Math.abs(nose.x - eyeMidpoint.x);

  // Calculate spinal alignment
  const shoulderMidpoint = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2
  };
  
  const hipMidpoint = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };

  const spinalDeviation = Math.abs(shoulderMidpoint.x - hipMidpoint.x);
  const spinalAlignment = Math.max(0, 100 - (spinalDeviation * 10));

  // Calculate overall posture score
  const overallPosture = calculateOverallPosture(
    shoulderAlignment,
    hipAlignment,
    spinalAlignment,
    headTilt,
    forwardHead
  );

  return {
    spinalAlignment,
    shoulderAlignment,
    hipAlignment,
    headPosition: {
      forward: Math.max(0, 100 - (forwardHead * 10)),
      tilt: Math.max(0, 100 - (headTilt * 2))
    },
    overallPosture
  };
};

const calculateOverallPosture = (shoulderAlign, hipAlign, spinalAlign, headTilt, forwardHead) => {
  const weights = {
    shoulder: 0.25,
    hip: 0.25,
    spine: 0.3,
    head: 0.2
  };

  const headScore = Math.max(0, 100 - (headTilt * 2 + forwardHead * 5));
  
  return Math.round(
    shoulderAlign * weights.shoulder +
    hipAlign * weights.hip +
    spinalAlign * weights.spine +
    headScore * weights.head
  );
}; 