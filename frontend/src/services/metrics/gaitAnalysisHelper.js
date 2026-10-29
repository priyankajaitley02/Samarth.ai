import * as tf from '@tensorflow/tfjs';

export class GaitAnalysisHelper {
  constructor(options = {}) {
    this.options = {
      smoothingWindow: 5,
      confidenceThreshold: 0.6,
      velocityThreshold: 0.05,
      ...options
    };
    
    this.dataBuffer = {
      keypoints: [],
      timestamps: []
    };
    
    this.kalmanFilters = {};
    this.initializeKalmanFilters();
  }
  
  initializeKalmanFilters() {
    // Initialize simple Kalman filter parameters for joint positions
    const jointNames = [
      'left_hip', 'right_hip', 'left_knee', 'right_knee', 
      'left_ankle', 'right_ankle', 'left_shoulder', 'right_shoulder'
    ];
    
    jointNames.forEach(joint => {
      this.kalmanFilters[joint] = {
        x: { estimate: 0, error: 1.0, processNoise: 0.01, measurementNoise: 0.1 },
        y: { estimate: 0, error: 1.0, processNoise: 0.01, measurementNoise: 0.1 }
      };
    });
  }
  
  // Apply Kalman filter to smooth joint motion
  applyKalmanFilter(joint, position) {
    if (!position || position.score < this.options.confidenceThreshold) {
      return position;
    }
    
    const filter = this.kalmanFilters[joint.name];
    if (!filter) return position;
    
    // X coordinate filtering
    const kfX = filter.x;
    const kalmanGainX = kfX.error / (kfX.error + kfX.measurementNoise);
    kfX.estimate = kfX.estimate + kalmanGainX * (position.x - kfX.estimate);
    kfX.error = (1 - kalmanGainX) * kfX.error + kfX.processNoise;
    
    // Y coordinate filtering
    const kfY = filter.y;
    const kalmanGainY = kfY.error / (kfY.error + kfY.measurementNoise);
    kfY.estimate = kfY.estimate + kalmanGainY * (position.y - kfY.estimate);
    kfY.error = (1 - kalmanGainY) * kfY.error + kfY.processNoise;
    
    return {
      ...position,
      x: kfX.estimate,
      y: kfY.estimate
    };
  }
  
  // Apply temporal smoothing to pose keypoints
  smoothPose(pose) {
    if (!pose || !pose.keypoints) return pose;
    
    // Add to buffer
    this.dataBuffer.keypoints.push(pose.keypoints);
    this.dataBuffer.timestamps.push(Date.now());
    
    // Keep buffer at smoothing window size
    if (this.dataBuffer.keypoints.length > this.options.smoothingWindow) {
      this.dataBuffer.keypoints.shift();
      this.dataBuffer.timestamps.shift();
    }
    
    // Not enough data for smoothing yet
    if (this.dataBuffer.keypoints.length < 3) return pose;
    
    // Deep clone the pose to avoid modifying the original
    const smoothedPose = JSON.parse(JSON.stringify(pose));
    
    // Apply weighted moving average to each keypoint
    smoothedPose.keypoints = pose.keypoints.map(keypoint => {
      // Find this keypoint in each frame of the buffer
      const keypointHistory = this.dataBuffer.keypoints.map(
        frame => frame.find(kp => kp.name === keypoint.name)
      ).filter(Boolean);
      
      // Skip if not enough history or low confidence
      if (keypointHistory.length < 3) return keypoint;
      
      // Apply temporal smoothing with more weight to recent frames
      const totalWeight = keypointHistory.reduce((sum, _, i) => sum + (i + 1), 0);
      
      const smoothedX = keypointHistory.reduce(
        (sum, kp, i) => sum + kp.x * (i + 1), 0
      ) / totalWeight;
      
      const smoothedY = keypointHistory.reduce(
        (sum, kp, i) => sum + kp.y * (i + 1), 0
      ) / totalWeight;
      
      // Apply Kalman filter on top of temporal smoothing for optimal results
      const filteredKeypoint = this.applyKalmanFilter(keypoint, {
        ...keypoint,
        x: smoothedX,
        y: smoothedY
      });
      
      return filteredKeypoint;
    });
    
    return smoothedPose;
  }
  
  // Detect gait cycle phases based on ankle movements
  detectGaitPhase(currentPose, previousPose) {
    if (!currentPose || !previousPose) return 'unknown';
    
    const leftAnkle = currentPose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = currentPose.keypoints.find(kp => kp.name === 'right_ankle');
    const prevLeftAnkle = previousPose.keypoints.find(kp => kp.name === 'left_ankle');
    const prevRightAnkle = previousPose.keypoints.find(kp => kp.name === 'right_ankle');
    
    if (!leftAnkle || !rightAnkle || !prevLeftAnkle || !prevRightAnkle) return 'unknown';
    
    // Calculate vertical velocity of both ankles
    const leftVelocityY = leftAnkle.y - prevLeftAnkle.y;
    const rightVelocityY = rightAnkle.y - prevRightAnkle.y;
    
    // Basic gait phase detection logic
    if (leftVelocityY < -this.options.velocityThreshold && rightVelocityY > this.options.velocityThreshold) {
      return 'left_swing';
    } else if (rightVelocityY < -this.options.velocityThreshold && leftVelocityY > this.options.velocityThreshold) {
      return 'right_swing';
    } else if (Math.abs(leftVelocityY) < this.options.velocityThreshold && 
               Math.abs(rightVelocityY) < this.options.velocityThreshold) {
      return 'double_support';
    } else {
      return 'transition';
    }
  }

  // Calculate more accurate stride length based on ankle displacement
  calculateStrideLength(poses, frameRate) {
    if (!poses || poses.length < 10) return 0;
    
    let maxDisplacement = 0;
    let lastLeftSwing = null;
    let lastRightSwing = null;
    
    // Analyze sequences to find stride length
    for (let i = 1; i < poses.length; i++) {
      const currentPose = poses[i];
      const previousPose = poses[i-1];
      
      const phase = this.detectGaitPhase(currentPose, previousPose);
      
      if (phase === 'left_swing') {
        if (lastLeftSwing) {
          const leftAnkle = currentPose.keypoints.find(kp => kp.name === 'left_ankle');
          const prevLeftAnkle = lastLeftSwing.keypoints.find(kp => kp.name === 'left_ankle');
          
          if (leftAnkle && prevLeftAnkle) {
            const displacement = Math.sqrt(
              Math.pow(leftAnkle.x - prevLeftAnkle.x, 2) + 
              Math.pow(leftAnkle.y - prevLeftAnkle.y, 2)
            );
            maxDisplacement = Math.max(maxDisplacement, displacement);
          }
        }
        lastLeftSwing = currentPose;
      } else if (phase === 'right_swing') {
        if (lastRightSwing) {
          const rightAnkle = currentPose.keypoints.find(kp => kp.name === 'right_ankle');
          const prevRightAnkle = lastRightSwing.keypoints.find(kp => kp.name === 'right_ankle');
          
          if (rightAnkle && prevRightAnkle) {
            const displacement = Math.sqrt(
              Math.pow(rightAnkle.x - prevRightAnkle.x, 2) + 
              Math.pow(rightAnkle.y - prevRightAnkle.y, 2)
            );
            maxDisplacement = Math.max(maxDisplacement, displacement);
          }
        }
        lastRightSwing = currentPose;
      }
    }
    
    // Convert pixel displacement to approximate meters
    // This requires calibration based on camera parameters
    const pixelToMeterRatio = 0.003; // Approximate value, should be calibrated
    return maxDisplacement * pixelToMeterRatio;
  }

  // Calculate cadence (steps per minute)
  calculateCadence(poses, durationMs) {
    if (!poses || poses.length < 10 || !durationMs) return 0;
    
    let stepCount = 0;
    let inLeftSwing = false;
    let inRightSwing = false;
    
    // Count step transitions
    for (let i = 1; i < poses.length; i++) {
      const currentPose = poses[i];
      const previousPose = poses[i-1];
      
      const phase = this.detectGaitPhase(currentPose, previousPose);
      
      if (phase === 'left_swing' && !inLeftSwing) {
        stepCount++;
        inLeftSwing = true;
        inRightSwing = false;
      } else if (phase === 'right_swing' && !inRightSwing) {
        stepCount++;
        inRightSwing = true;
        inLeftSwing = false;
      } else if (phase === 'double_support') {
        inLeftSwing = false;
        inRightSwing = false;
      }
    }
    
    // Convert to steps per minute
    const durationMinutes = durationMs / 60000;
    return stepCount / durationMinutes;
  }

  // Enhanced joint angle calculation with improved accuracy
  calculateJointAngle(jointPoint, connectedPoint1, connectedPoint2) {
    if (!jointPoint || !connectedPoint1 || 
        jointPoint.score < this.options.confidenceThreshold || 
        connectedPoint1.score < this.options.confidenceThreshold) {
      return 0;
    }
    
    if (!connectedPoint2) {
      // Single segment angle (relative to vertical)
      const dx = connectedPoint1.x - jointPoint.x;
      const dy = connectedPoint1.y - jointPoint.y;
      return Math.atan2(dx, -dy) * (180 / Math.PI); // Convert to degrees
    }
    
    if (connectedPoint2.score < this.options.confidenceThreshold) {
      return 0;
    }
    
    // Calculate vectors
    const v1 = {
      x: connectedPoint1.x - jointPoint.x,
      y: connectedPoint1.y - jointPoint.y
    };
    
    const v2 = {
      x: connectedPoint2.x - jointPoint.x,
      y: connectedPoint2.y - jointPoint.y
    };
    
    // Calculate dot product
    const dotProduct = v1.x * v2.x + v1.y * v2.y;
    
    // Calculate magnitudes
    const v1Mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const v2Mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    // Calculate angle in radians and convert to degrees
    const cosAngle = dotProduct / (v1Mag * v2Mag);
    
    // Handle potential numerical errors
    const clampedCosAngle = Math.min(1, Math.max(-1, cosAngle));
    const angle = Math.acos(clampedCosAngle) * (180 / Math.PI);
    
    return angle;
  }
  
  // Calculate improved dynamic stability metrics
  calculateDynamicStability(poses, timeWindow) {
    if (!poses || poses.length < 3) {
      return { score: 0, lateralSway: 0, verticalSway: 0, pathDeviation: 0 };
    }
    
    // Extract head and hip positions over time
    const headPositions = poses.map(pose => 
      pose.keypoints.find(kp => kp.name === 'nose')
    ).filter(Boolean);
    
    const hipPositions = poses.map(pose => {
      const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
      const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
      
      if (!leftHip || !rightHip) return null;
      
      return {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
      };
    }).filter(Boolean);
    
    if (headPositions.length < 3 || hipPositions.length < 3) {
      return { score: 0, lateralSway: 0, verticalSway: 0, pathDeviation: 0 };
    }
    
    // Calculate lateral sway (variation in x direction)
    const lateralSwayHead = this.calculateStandardDeviation(
      headPositions.map(pos => pos.x)
    );
    
    const lateralSwayHip = this.calculateStandardDeviation(
      hipPositions.map(pos => pos.x)
    );
    
    // Calculate vertical sway (variation in y direction)
    const verticalSwayHead = this.calculateStandardDeviation(
      headPositions.map(pos => pos.y)
    );
    
    // Calculate path deviation (how much the trajectory deviates from a straight line)
    const pathDeviation = this.calculatePathDeviation(hipPositions);
    
    // Calculate normalized stability score (higher is better)
    // Scale factors determined empirically for typical pixel values
    const lateralFactor = 0.05;
    const verticalFactor = 0.03;
    const pathFactor = 0.02;
    
    const lateralSway = (lateralSwayHead + lateralSwayHip) / 2;
    const verticalSway = verticalSwayHead;
    
    const stabilityScore = Math.max(0, 100 - 
      (lateralSway * lateralFactor * 100) - 
      (verticalSway * verticalFactor * 100) - 
      (pathDeviation * pathFactor * 100)
    );
    
    return {
      score: Math.min(100, stabilityScore),
      lateralSway,
      verticalSway,
      pathDeviation
    };
  }
  
  // Calculate standard deviation helper
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  // Calculate path deviation from straight line
  calculatePathDeviation(positions) {
    if (positions.length < 3) return 0;
    
    // Find line of best fit
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    positions.forEach(pos => {
      sumX += pos.x;
      sumY += pos.y;
      sumXY += pos.x * pos.y;
      sumX2 += pos.x * pos.x;
    });
    
    const n = positions.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate perpendicular distances to the line
    const distances = positions.map(pos => {
      // Distance from point to line: |ax + by + c| / sqrt(a² + b²)
      // Line: y = mx + b --> mx - y + b = 0
      const a = slope;
      const b = -1;
      const c = intercept;
      
      return Math.abs(a * pos.x + b * pos.y + c) / Math.sqrt(a * a + b * b);
    });
    
    // Return average deviation
    return distances.reduce((sum, dist) => sum + dist, 0) / distances.length;
  }
  
  // Calculate improved symmetry with all limbs
  calculateDetailedSymmetry(pose) {
    if (!pose || !pose.keypoints) {
      return { overall: 0, legSymmetry: 0, armSymmetry: 0, stepSymmetry: 0 };
    }
    
    const keypoints = pose.keypoints;
    const findKeypoint = (name) => keypoints.find(kp => kp.name === name);
    
    const leftHip = findKeypoint('left_hip');
    const rightHip = findKeypoint('right_hip');
    const leftKnee = findKeypoint('left_knee');
    const rightKnee = findKeypoint('right_knee');
    const leftAnkle = findKeypoint('left_ankle');
    const rightAnkle = findKeypoint('right_ankle');
    const leftShoulder = findKeypoint('left_shoulder');
    const rightShoulder = findKeypoint('right_shoulder');
    const leftElbow = findKeypoint('left_elbow');
    const rightElbow = findKeypoint('right_elbow');
    const leftWrist = findKeypoint('left_wrist');
    const rightWrist = findKeypoint('right_wrist');
    
    // Check for required keypoints
    if (!leftHip || !rightHip || !leftKnee || !rightKnee || 
        !leftAnkle || !rightAnkle || !leftShoulder || !rightShoulder) {
      return { overall: 0, legSymmetry: 0, armSymmetry: 0, stepSymmetry: 0 };
    }
    
    // Calculate leg segment lengths
    const leftThighLength = this.calculateDistance(leftHip, leftKnee);
    const rightThighLength = this.calculateDistance(rightHip, rightKnee);
    
    const leftCalfLength = this.calculateDistance(leftKnee, leftAnkle);
    const rightCalfLength = this.calculateDistance(rightKnee, rightAnkle);
    
    // Calculate arm segment lengths if available
    let leftArmLength = 0, rightArmLength = 0;
    if (leftElbow && rightElbow && leftWrist && rightWrist) {
      const leftUpperArmLength = this.calculateDistance(leftShoulder, leftElbow);
      const rightUpperArmLength = this.calculateDistance(rightShoulder, rightElbow);
      
      const leftForearmLength = this.calculateDistance(leftElbow, leftWrist);
      const rightForearmLength = this.calculateDistance(rightElbow, rightWrist);
      
      leftArmLength = leftUpperArmLength + leftForearmLength;
      rightArmLength = rightUpperArmLength + rightForearmLength;
    }
    
    // Calculate total leg lengths
    const leftLegLength = leftThighLength + leftCalfLength;
    const rightLegLength = rightThighLength + rightCalfLength;
    
    // Calculate symmetry scores (100 is perfect symmetry)
    // Symmetry = (1 - abs(left - right) / max(left, right)) * 100
    const calculateSymmetryScore = (left, right) => {
      if (left === 0 && right === 0) return 0;
      const max = Math.max(left, right);
      return (1 - Math.abs(left - right) / max) * 100;
    };
    
    const thighSymmetry = calculateSymmetryScore(leftThighLength, rightThighLength);
    const calfSymmetry = calculateSymmetryScore(leftCalfLength, rightCalfLength);
    const legSymmetry = calculateSymmetryScore(leftLegLength, rightLegLength);
    
    // Calculate arm symmetry if available
    const armSymmetry = leftElbow && rightElbow ? 
      calculateSymmetryScore(leftArmLength, rightArmLength) : 0;
    
    // Calculate step length symmetry if available
    const stepSymmetry = 90; // Placeholder - would require gait cycle analysis
    
    // Calculate weighted overall symmetry score
    const overall = legSymmetry * 0.6 + armSymmetry * 0.2 + stepSymmetry * 0.2;
    
    return {
      overall: Math.min(100, overall),
      legSymmetry: Math.min(100, legSymmetry),
      armSymmetry: Math.min(100, armSymmetry),
      thighSymmetry: Math.min(100, thighSymmetry),
      calfSymmetry: Math.min(100, calfSymmetry),
      stepSymmetry: Math.min(100, stepSymmetry)
    };
  }
  
  // Calculate distance between two points
  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 0;
    
    return Math.sqrt(
      Math.pow(point2.x - point1.x, 2) + 
      Math.pow(point2.y - point1.y, 2)
    );
  }
}