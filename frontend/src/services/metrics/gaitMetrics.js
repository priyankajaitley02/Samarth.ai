// Enhanced gait analysis metrics with improved accuracy
import * as tf from '@tensorflow/tfjs';
import { GaitAnalysisHelper } from './gaitAnalysisHelper';

export class GaitMetricsAnalyzer {
  constructor() {
    this.baselineData = null;
    this.historicalData = [];
    this.normalRanges = {
      walkingSpeed: { min: 1.0, max: 1.4 }, // meters/second
      strideLength: { min: 0.5, max: 0.8 }, // meters
      stepSymmetry: { min: 90, max: 100 }, // percentage
      balanceScore: { min: 85, max: 100 } // percentage
    };
    this.metrics = [];
    this.lastPose = null;
    this.lastTimestamp = null;
    
    // Initialize the enhanced analysis helper
    this.analysisHelper = new GaitAnalysisHelper({
      smoothingWindow: 5,
      confidenceThreshold: 0.65
    });
    
    // Buffer for storing pose history for advanced analysis
    this.poseBuffer = [];
    this.maxBufferSize = 90; // Store ~3 seconds at 30fps
    
    // Store steps detected for stride analysis
    this.stepsDetected = {
      left: [],
      right: []
    };
    
    // Constants for calibration
    this.calibrationFactors = {
      velocityScaleFactor: 1.2, // Scaling for pixel-to-real-world
      strideScaleFactor: 0.01,  // For stride length estimation
      heightEstimate: 170       // Default height in cm if not provided
    };
  }

  calculateInstantMetrics(currentPose, lastPose, deltaTime) {
    if (!currentPose || !currentPose.keypoints) {
      return {
        timestamp: Date.now(),
        velocity: { x: 0, y: 0 },
        balance: 0,
        symmetry: { overall: 0, legSymmetry: 0, armSymmetry: 0 },
        stability: { score: 0, lateralSway: 0, verticalSway: 0 },
        jointAngles: [],
        gait: {
          cadence: 0,
          strideLength: 0,
          speed: 0,
          symmetry: 0,
          doubleSupportPercentage: 0
        }
      };
    }
    
    // Filter out low confidence keypoints with increased threshold
    currentPose.keypoints = currentPose.keypoints.map(kp => {
      return {
        ...kp,
        score: kp.score < 0.4 ? 0 : kp.score // Increased threshold for more reliable data
      };
    });
    
    // Apply enhanced smoothing to pose data
    const smoothedPose = this.analysisHelper.smoothPose(currentPose);
    
    // Store pose in buffer for advanced analysis
    this.poseBuffer.push(smoothedPose);
    if (this.poseBuffer.length > this.maxBufferSize) {
      this.poseBuffer.shift();
    }
    
    // Calculate enhanced metrics
    const velocity = this.calculateVelocity(smoothedPose, lastPose, deltaTime);
    const balance = this.calculateBalance(smoothedPose);
    const symmetry = this.calculateSymmetry(smoothedPose);
    
    // Use a window of poses for stability calculation instead of just the current pose
    const stabilityWindow = this.poseBuffer.slice(-15); // Use last ~0.5 sec of data
    const stability = this.calculateStability(stabilityWindow);
    
    const jointAngles = this.calculateJointAngles(smoothedPose);
    
    // Detect steps for stride analysis with improved detection
    if (lastPose) {
      this.detectSteps(smoothedPose, lastPose);
    }
    
    // Calculate overall gait metrics
    const gaitMetrics = this.calculateOverallGaitMetrics();
    
    // Add gait phase detection
    const gaitPhase = lastPose ? 
      this.analysisHelper.detectGaitPhase(smoothedPose, lastPose) : 'unknown';

    const metrics = {
      timestamp: Date.now(),
      velocity,
      balance,
      symmetry,
      stability,
      jointAngles,
      gaitPhase,
      gait: {
        cadence: gaitMetrics.cadence,
        strideLength: gaitMetrics.strideLength,
        speed: gaitMetrics.speed,
        symmetry: gaitMetrics.symmetry,
        doubleSupportPercentage: gaitMetrics.doubleSupportTime
      }
    };

    this.metrics.push(metrics);
    this.lastPose = smoothedPose;
    this.lastTimestamp = Date.now();

    return metrics;
  }

  calculateDisplacement(currentPose, lastPose) {
    if (!lastPose || !currentPose) {
      return { x: 0, y: 0 };
    }

    // Use hip center for more stable displacement calculation
    const getCurrentHipCenter = (pose) => {
      const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
      const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
      
      if (!leftHip || !rightHip || leftHip.score < 0.5 || rightHip.score < 0.5) {
        const hip = leftHip?.score > rightHip?.score ? leftHip : rightHip;
        return hip || { x: 0, y: 0 };
      }
      
      return {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
        score: (leftHip.score + rightHip.score) / 2
      };
    };
    
    const currentHipCenter = getCurrentHipCenter(currentPose);
    const lastHipCenter = getCurrentHipCenter(lastPose);

    if (currentHipCenter.score < 0.5 || lastHipCenter.score < 0.5) {
      return { x: 0, y: 0 };
    }

    return {
      x: currentHipCenter.x - lastHipCenter.x,
      y: currentHipCenter.y - lastHipCenter.y
    };
  }

  calculateVelocity(currentPose, lastPose, deltaTime) {
    if (!lastPose || !currentPose || deltaTime === 0) {
      return { x: 0, y: 0 };
    }

    const displacement = this.calculateDisplacement(currentPose, lastPose);
    
    // Apply Kalman-like filtering to reduce noise
    const alpha = 0.7; // Filter strength (0-1)
    
    // Initialize with current values if no previous velocity
    const prevVelocityX = this.lastVelocity?.x || displacement.x / deltaTime;
    const prevVelocityY = this.lastVelocity?.y || displacement.y / deltaTime;
    
    // Filter velocity
    const filteredVelocity = {
      x: alpha * (displacement.x / deltaTime) + (1 - alpha) * prevVelocityX,
      y: alpha * (displacement.y / deltaTime) + (1 - alpha) * prevVelocityY
    };
    
    // Store filtered velocity for next frame
    this.lastVelocity = filteredVelocity;
    
    return filteredVelocity;
  }

  calculateBalance(pose) {
    if (!pose || !pose.keypoints) {
      return 0;
    }

    const hipLeft = pose.keypoints.find(kp => kp.name === 'left_hip');
    const hipRight = pose.keypoints.find(kp => kp.name === 'right_hip');
    const shoulderLeft = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const shoulderRight = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
    const nose = pose.keypoints.find(kp => kp.name === 'nose');

    if (!hipLeft || !hipRight || !shoulderLeft || !shoulderRight) {
      return 0;
    }

    // Calculate center points with confidence weighting
    const hipCenter = {
      x: (hipLeft.x * hipLeft.score + hipRight.x * hipRight.score) / (hipLeft.score + hipRight.score),
      y: (hipLeft.y * hipLeft.score + hipRight.y * hipRight.score) / (hipLeft.score + hipRight.score)
    };

    const shoulderCenter = {
      x: (shoulderLeft.x * shoulderLeft.score + shoulderRight.x * shoulderRight.score) / 
         (shoulderLeft.score + shoulderRight.score),
      y: (shoulderLeft.y * shoulderLeft.score + shoulderRight.y * shoulderRight.score) / 
         (shoulderLeft.score + shoulderRight.score)
    };
    
    // Calculate ankle center if available for improved balance calculation
    let ankleCenter = null;
    if (leftAnkle && rightAnkle && leftAnkle.score > 0.5 && rightAnkle.score > 0.5) {
      ankleCenter = {
        x: (leftAnkle.x * leftAnkle.score + rightAnkle.x * rightAnkle.score) / 
           (leftAnkle.score + rightAnkle.score),
        y: (leftAnkle.y * leftAnkle.score + rightAnkle.y * rightAnkle.score) / 
           (leftAnkle.score + rightAnkle.score)
      };
    }

    // Calculate vertical alignment of body segments (normalized by height)
    const bodyHeight = shoulderCenter.y - hipCenter.y;
    const verticalAlignmentNorm = bodyHeight > 0 ? 
      Math.abs(hipCenter.x - shoulderCenter.x) / bodyHeight : 0;
    
    // Calculate head position relative to shoulders (head control)
    let headControl = 0;
    if (nose && nose.score > 0.5) {
      headControl = Math.abs(nose.x - shoulderCenter.x) / bodyHeight;
    }
    
    // Calculate sagittal alignment (front-back balance)
    let sagittalAlignment = 0;
    if (ankleCenter) {
      // Calculate projection of COM onto support base
      const projectedHipX = hipCenter.x;
      const ankleBaseX = ankleCenter.x;
      sagittalAlignment = Math.abs(projectedHipX - ankleBaseX) / bodyHeight;
    }
    
    // Calculate weight distribution between legs
    let weightDistribution = 0;
    if (leftAnkle && rightAnkle && leftAnkle.score > 0.5 && rightAnkle.score > 0.5) {
      const leftLegLoad = this.calculateDistanceWithConfidence(hipCenter, leftAnkle);
      const rightLegLoad = this.calculateDistanceWithConfidence(hipCenter, rightAnkle);
      const totalLoad = leftLegLoad + rightLegLoad;
      
      // Perfect distribution would be 50/50
      const leftPercentage = totalLoad > 0 ? (leftLegLoad / totalLoad) * 100 : 50;
      weightDistribution = Math.abs(leftPercentage - 50) / 25; // Normalize to 0-2 range
    }
    
    // Combine metrics with appropriate weights
    const verticalFactor = 25.0; // Higher = more sensitivity to vertical alignment
    const sagittalFactor = 20.0;
    const weightFactor = 15.0;
    const headFactor = 15.0;
    
    // Calculate balance score (0-100)
    const balanceScore = Math.max(0, 100 - 
      (verticalAlignmentNorm * verticalFactor) - 
      (sagittalAlignment * sagittalFactor) -
      (weightDistribution * weightFactor) -
      (headControl * headFactor));
      
    return Math.min(100, Math.max(0, balanceScore));
  }

  calculateDistanceWithConfidence(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const confidence = (point1.score || 1) * (point2.score || 1);
    
    return Math.sqrt(dx * dx + dy * dy) * confidence;
  }

  calculateSymmetry(pose) {
    if (!pose || !pose.keypoints) {
      return { overall: 0, legSymmetry: 0, armSymmetry: 0 };
    }
    
    // Get all required keypoints
    const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const leftKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
    const rightKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    const leftElbow = pose.keypoints.find(kp => kp.name === 'left_elbow');
    const rightElbow = pose.keypoints.find(kp => kp.name === 'right_elbow');
    const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
    const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
    
    // Calculate leg symmetry
    let legSymmetry = 0;
    if (leftHip && rightHip && leftKnee && rightKnee && leftAnkle && rightAnkle &&
        leftHip.score > 0.5 && rightHip.score > 0.5 && 
        leftKnee.score > 0.5 && rightKnee.score > 0.5 && 
        leftAnkle.score > 0.5 && rightAnkle.score > 0.5) {
      
      // Calculate leg segment lengths
      const leftThighLength = Math.sqrt(
        Math.pow(leftHip.x - leftKnee.x, 2) + Math.pow(leftHip.y - leftKnee.y, 2)
      );
      
      const rightThighLength = Math.sqrt(
        Math.pow(rightHip.x - rightKnee.x, 2) + Math.pow(rightHip.y - rightKnee.y, 2)
      );
      
      const leftShinLength = Math.sqrt(
        Math.pow(leftKnee.x - leftAnkle.x, 2) + Math.pow(leftKnee.y - leftAnkle.y, 2)
      );
      
      const rightShinLength = Math.sqrt(
        Math.pow(rightKnee.x - rightAnkle.x, 2) + Math.pow(rightKnee.y - rightAnkle.y, 2)
      );
      
      // Calculate thigh angle symmetry
      const leftThighAngle = this.calculateAngleBetweenPoints(
        {x: leftHip.x, y: leftHip.y - 10}, // Vertical reference
        leftHip,
        leftKnee
      );
      
      const rightThighAngle = this.calculateAngleBetweenPoints(
        {x: rightHip.x, y: rightHip.y - 10}, // Vertical reference
        rightHip,
        rightKnee
      );
      
      // Calculate knee angle symmetry
      const leftKneeAngle = this.calculateAngleBetweenPoints(
        leftHip,
        leftKnee,
        leftAnkle
      );
      
      const rightKneeAngle = this.calculateAngleBetweenPoints(
        rightHip,
        rightKnee,
        rightAnkle
      );
      
      // Calculate symmetry scores (higher is better)
      const thighLengthSymmetry = 100 - (Math.abs(leftThighLength - rightThighLength) / 
                                        ((leftThighLength + rightThighLength) / 2) * 100);
                                        
      const shinLengthSymmetry = 100 - (Math.abs(leftShinLength - rightShinLength) / 
                                       ((leftShinLength + rightShinLength) / 2) * 100);
                                       
      const thighAngleSymmetry = 100 - (Math.abs(leftThighAngle - rightThighAngle) / 1.8);
      const kneeAngleSymmetry = 100 - (Math.abs(leftKneeAngle - rightKneeAngle) / 1.8);
      
      // Combine leg symmetry metrics with weights
      legSymmetry = 
        thighLengthSymmetry * 0.15 +
        shinLengthSymmetry * 0.15 +
        thighAngleSymmetry * 0.35 +
        kneeAngleSymmetry * 0.35;
    }
    
    // Calculate arm symmetry similarly
    let armSymmetry = 0;
    if (leftShoulder && rightShoulder && leftElbow && rightElbow && leftWrist && rightWrist &&
        leftShoulder.score > 0.3 && rightShoulder.score > 0.3 && 
        leftElbow.score > 0.3 && rightElbow.score > 0.3 && 
        leftWrist.score > 0.3 && rightWrist.score > 0.3) {
      
      // Calculate arm segment lengths
      const leftUpperArmLength = Math.sqrt(
        Math.pow(leftShoulder.x - leftElbow.x, 2) + Math.pow(leftShoulder.y - leftElbow.y, 2)
      );
      
      const rightUpperArmLength = Math.sqrt(
        Math.pow(rightShoulder.x - rightElbow.x, 2) + Math.pow(rightShoulder.y - rightElbow.y, 2)
      );
      
      const leftForearmLength = Math.sqrt(
        Math.pow(leftElbow.x - leftWrist.x, 2) + Math.pow(leftElbow.y - leftWrist.y, 2)
      );
      
      const rightForearmLength = Math.sqrt(
        Math.pow(rightElbow.x - rightWrist.x, 2) + Math.pow(rightElbow.y - rightWrist.y, 2)
      );
      
      // Calculate shoulder angle symmetry
      const leftShoulderAngle = this.calculateAngleBetweenPoints(
        {x: leftShoulder.x, y: leftShoulder.y - 10}, // Vertical reference
        leftShoulder,
        leftElbow
      );
      
      const rightShoulderAngle = this.calculateAngleBetweenPoints(
        {x: rightShoulder.x, y: rightShoulder.y - 10}, // Vertical reference
        rightShoulder,
        rightElbow
      );
      
      // Calculate elbow angle symmetry
      const leftElbowAngle = this.calculateAngleBetweenPoints(
        leftShoulder,
        leftElbow,
        leftWrist
      );
      
      const rightElbowAngle = this.calculateAngleBetweenPoints(
        rightShoulder,
        rightElbow,
        rightWrist
      );
      
      // Calculate symmetry scores
      const upperArmLengthSymmetry = 100 - (Math.abs(leftUpperArmLength - rightUpperArmLength) / 
                                          ((leftUpperArmLength + rightUpperArmLength) / 2) * 100);
                                          
      const forearmLengthSymmetry = 100 - (Math.abs(leftForearmLength - rightForearmLength) / 
                                         ((leftForearmLength + rightForearmLength) / 2) * 100);
                                         
      const shoulderAngleSymmetry = 100 - (Math.abs(leftShoulderAngle - rightShoulderAngle) / 1.8);
      const elbowAngleSymmetry = 100 - (Math.abs(leftElbowAngle - rightElbowAngle) / 1.8);
      
      // Combine arm symmetry metrics
      armSymmetry = 
        upperArmLengthSymmetry * 0.1 +
        forearmLengthSymmetry * 0.1 +
        shoulderAngleSymmetry * 0.4 +
        elbowAngleSymmetry * 0.4;
    }
    
    // Overall symmetry (leg symmetry weighted higher for gait)
    const overall = legSymmetry * 0.7 + armSymmetry * 0.3;
    
    return {
      overall: Math.min(100, Math.max(0, overall)),
      legSymmetry: Math.min(100, Math.max(0, legSymmetry)),
      armSymmetry: Math.min(100, Math.max(0, armSymmetry))
    };
  }

  calculateAngleBetweenPoints(joint1, joint, joint2) {
    if (!joint || !joint1) {
      return 0;
    }
    
    if (!joint2) {
      // Calculate angle relative to vertical for end joints
      const dy = joint1.y - joint.y;
      const dx = joint1.x - joint.x;
      return Math.atan2(dy, dx) * (180 / Math.PI);
    }

    // Calculate angle between three points
    const angle1 = Math.atan2(joint1.y - joint.y, joint1.x - joint.x);
    const angle2 = Math.atan2(joint2.y - joint.y, joint2.x - joint.x);
    let angle = (angle1 - angle2) * (180 / Math.PI);

    // Normalize angle to 0-180 range
    if (angle < 0) angle += 360;
    if (angle > 180) angle = 360 - angle;

    return angle;
  }

  calculateStability(poses) {
    // Use the enhanced dynamic stability metric from helper
    if (!poses || poses.length === 0) {
      return { score: 0, lateralSway: 0, verticalSway: 0 };
    }
    
    if (poses.length === 1) {
      // Fall back to simple stability calculation for a single pose
      const pose = poses[0];
      const nose = pose.keypoints.find(kp => kp.name === 'nose');
      const hipLeft = pose.keypoints.find(kp => kp.name === 'left_hip');
      const hipRight = pose.keypoints.find(kp => kp.name === 'right_hip');
      const shoulderLeft = pose.keypoints.find(kp => kp.name === 'left_shoulder');
      const shoulderRight = pose.keypoints.find(kp => kp.name === 'right_shoulder');
      
      if (!nose || !hipLeft || !hipRight) {
        return { score: 0, lateralSway: 0, verticalSway: 0 };
      }
      
      // Calculate hip center
      const hipCenter = {
        x: (hipLeft.x + hipRight.x) / 2,
        y: (hipLeft.y + hipRight.y) / 2
      };

      // Calculate shoulder center
      const shoulderCenter = shoulderLeft && shoulderRight ? {
        x: (shoulderLeft.x + shoulderRight.x) / 2,
        y: (shoulderLeft.y + shoulderRight.y) / 2
      } : null;
      
      // Calculate lateral sway (side-to-side movement)
      const lateralSway = Math.abs(nose.x - hipCenter.x) / 100;
      
      // Calculate vertical sway (up-down movement)
      const verticalSway = shoulderCenter ? 
        Math.abs(nose.y - shoulderCenter.y) / 100 : 0;
      
      // Calculate stability score (higher is better)
      const score = Math.max(0, 100 - (lateralSway * 50 + verticalSway * 50));
      
      return { 
        score, 
        lateralSway, 
        verticalSway 
      };
    } 
    
    // Enhanced stability calculation using multiple poses
    const nosePositions = [];
    const hipCenterPositions = [];
    const shoulderCenterPositions = [];
    
    // Extract position time series from poses
    poses.forEach(pose => {
      const nose = pose.keypoints.find(kp => kp.name === 'nose');
      const hipLeft = pose.keypoints.find(kp => kp.name === 'left_hip');
      const hipRight = pose.keypoints.find(kp => kp.name === 'right_hip');
      const shoulderLeft = pose.keypoints.find(kp => kp.name === 'left_shoulder');
      const shoulderRight = pose.keypoints.find(kp => kp.name === 'right_shoulder');
      
      if (nose && nose.score > 0.5) {
        nosePositions.push({ x: nose.x, y: nose.y });
      }
      
      if (hipLeft && hipRight && hipLeft.score > 0.5 && hipRight.score > 0.5) {
        hipCenterPositions.push({ 
          x: (hipLeft.x + hipRight.x) / 2, 
          y: (hipLeft.y + hipRight.y) / 2 
        });
      }
      
      if (shoulderLeft && shoulderRight && shoulderLeft.score > 0.5 && shoulderRight.score > 0.5) {
        shoulderCenterPositions.push({ 
          x: (shoulderLeft.x + shoulderRight.x) / 2, 
          y: (shoulderLeft.y + shoulderRight.y) / 2 
        });
      }
    });
    
    // Calculate sway metrics if we have enough data
    if (nosePositions.length > 3 && hipCenterPositions.length > 3) {
      // Calculate lateral sway (variability in x positions)
      const lateralSwayNose = this.calculateVariability(nosePositions.map(p => p.x));
      const lateralSwayHip = this.calculateVariability(hipCenterPositions.map(p => p.x));
      
      // Calculate vertical sway
      const verticalSwayNose = this.calculateVariability(nosePositions.map(p => p.y));
      const verticalSwayHip = shoulderCenterPositions.length > 3 ? 
        this.calculateVariability(shoulderCenterPositions.map(p => p.y)) : 0;
      
      // Combined sway measures
      const lateralSway = (lateralSwayNose * 0.7 + lateralSwayHip * 0.3) / 100;
      const verticalSway = (verticalSwayNose * 0.7 + verticalSwayHip * 0.3) / 100;
      
      // Calculate path smoothness
      const pathSmoothness = this.calculatePathSmoothness(nosePositions);
      
      // Calculate stability score combining all metrics
      const rawScore = 100 - (lateralSway * 40 + verticalSway * 30 + (1 - pathSmoothness) * 30);
      const score = Math.max(0, Math.min(100, rawScore));
      
      return {
        score,
        lateralSway,
        verticalSway,
        pathSmoothness
      };
    }
    
    // Not enough data points, return simple estimation
    return { score: 50, lateralSway: 0.5, verticalSway: 0.5 };
  }
  
  calculateVariability(values) {
    if (!values || values.length < 2) return 0;
    
    // Calculate standard deviation
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  calculatePathSmoothness(positions) {
    if (!positions || positions.length < 4) return 1;
    
    // Calculate path smoothness based on angle changes
    let totalAngleChange = 0;
    
    for (let i = 1; i < positions.length - 1; i++) {
      const prev = positions[i-1];
      const curr = positions[i];
      const next = positions[i+1];
      
      const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
      
      // Calculate absolute angle change
      let angleChange = Math.abs(angle1 - angle2);
      if (angleChange > Math.PI) {
        angleChange = 2 * Math.PI - angleChange;
      }
      
      totalAngleChange += angleChange;
    }
    
    // Normalize to 0-1 range (0 = very unsmooth, 1 = perfectly smooth)
    const avgAngleChange = totalAngleChange / (positions.length - 2);
    return Math.max(0, 1 - (avgAngleChange / Math.PI));
  }
  
  detectSteps(currentPose, lastPose) {
    const leftAnkle = currentPose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = currentPose.keypoints.find(kp => kp.name === 'right_ankle');
    const leftKnee = currentPose.keypoints.find(kp => kp.name === 'left_knee');
    const rightKnee = currentPose.keypoints.find(kp => kp.name === 'right_knee');
    const lastLeftAnkle = lastPose.keypoints.find(kp => kp.name === 'left_ankle');
    const lastRightAnkle = lastPose.keypoints.find(kp => kp.name === 'right_ankle');
    const lastLeftKnee = lastPose.keypoints.find(kp => kp.name === 'left_knee');
    const lastRightKnee = lastPose.keypoints.find(kp => kp.name === 'right_knee');
    
    // Check if we have all the necessary data with sufficient confidence
    if (!leftAnkle || !rightAnkle || !lastLeftAnkle || !lastRightAnkle ||
        !leftKnee || !rightKnee || !lastLeftKnee || !lastRightKnee ||
        leftAnkle.score < 0.6 || rightAnkle.score < 0.6 || 
        leftKnee.score < 0.6 || rightKnee.score < 0.6 ||
        lastLeftAnkle.score < 0.6 || lastRightAnkle.score < 0.6 ||
        lastLeftKnee.score < 0.6 || lastRightKnee.score < 0.6) {
      return;
    }
    
    // Calculate vertical velocities (positive = moving up)
    const leftYVelocity = lastLeftAnkle.y - leftAnkle.y;
    const rightYVelocity = lastRightAnkle.y - rightAnkle.y;
    
    // Store previous velocities if not already set
    this.lastLeftYVelocity = this.lastLeftYVelocity !== undefined ? this.lastLeftYVelocity : 0;
    this.lastRightYVelocity = this.lastRightYVelocity !== undefined ? this.lastRightYVelocity : 0;
    
    // Calculate knee angles to better detect gait phases
    const leftKneeAngle = this.calculateKneeAngle(currentPose, 'left');
    const rightKneeAngle = this.calculateKneeAngle(currentPose, 'right');
    const lastLeftKneeAngle = this.calculateKneeAngle(lastPose, 'left');
    const lastRightKneeAngle = this.calculateKneeAngle(lastPose, 'right');
    
    // Calculate rate of change of knee angles
    const leftKneeRateOfChange = leftKneeAngle - lastLeftKneeAngle;
    const rightKneeRateOfChange = rightKneeAngle - lastRightKneeAngle;
    
    const timestamp = Date.now();
    
    // Store current positions for step length calculations
    const currentLeftPosition = { x: leftAnkle.x, y: leftAnkle.y, timestamp };
    const currentRightPosition = { x: rightAnkle.x, y: rightAnkle.y, timestamp };
    
    // Enhanced step detection logic using multiple indicators
    
    // Left foot step detection (heel strike pattern with knee angle change)
    if ((leftYVelocity > 3 && this.lastLeftYVelocity < 0) || 
        (leftKneeRateOfChange < -8 && leftKneeAngle < 160 && leftKneeAngle > 140)) {
      
      // Check time since last step to avoid duplicates (minimum 300ms between steps)
      const lastLeftStep = this.stepsDetected.left[this.stepsDetected.left.length - 1];
      if (!lastLeftStep || (timestamp - lastLeftStep.timestamp) > 300) {
        // Calculate step info
        const stepInfo = {
          side: 'left',
          timestamp,
          position: currentLeftPosition
        };
        
        // Calculate stride length if we have a previous step from the same side
        if (lastLeftStep) {
          const strideLengthPixels = Math.sqrt(
            Math.pow(currentLeftPosition.x - lastLeftStep.position.x, 2) +
            Math.pow(currentLeftPosition.y - lastLeftStep.position.y, 2)
          );
          
          // Convert to real-world units using calibration factor
          const strideLength = strideLengthPixels * this.calibrationFactors.strideScaleFactor;
          stepInfo.strideLength = strideLength;
          
          // Calculate stride time
          stepInfo.strideTime = (timestamp - lastLeftStep.timestamp) / 1000; // seconds
          
          // Estimate velocity
          stepInfo.velocity = strideLength / stepInfo.strideTime;
        }
        
        this.stepsDetected.left.push(stepInfo);
        
        // Calculate step symmetry if we have steps from both sides
        if (this.stepsDetected.right.length > 0) {
          this.calculateStepSymmetry();
        }
      }
    }
    
    // Right foot step detection with similar logic
    if ((rightYVelocity > 3 && this.lastRightYVelocity < 0) ||
        (rightKneeRateOfChange < -8 && rightKneeAngle < 160 && rightKneeAngle > 140)) {
      
      const lastRightStep = this.stepsDetected.right[this.stepsDetected.right.length - 1];
      if (!lastRightStep || (timestamp - lastRightStep.timestamp) > 300) {
        // Calculate step info
        const stepInfo = {
          side: 'right',
          timestamp,
          position: currentRightPosition
        };
        
        // Calculate stride length if we have a previous step from the same side
        if (lastRightStep) {
          const strideLengthPixels = Math.sqrt(
            Math.pow(currentRightPosition.x - lastRightStep.position.x, 2) +
            Math.pow(currentRightPosition.y - lastRightStep.position.y, 2)
          );
          
          // Convert to real-world units using calibration factor
          const strideLength = strideLengthPixels * this.calibrationFactors.strideScaleFactor;
          stepInfo.strideLength = strideLength;
          
          // Calculate stride time
          stepInfo.strideTime = (timestamp - lastRightStep.timestamp) / 1000; // seconds
          
          // Estimate velocity
          stepInfo.velocity = strideLength / stepInfo.strideTime;
        }
        
        this.stepsDetected.right.push(stepInfo);
        
        // Calculate step symmetry if we have steps from both sides
        if (this.stepsDetected.left.length > 0) {
          this.calculateStepSymmetry();
        }
      }
    }
    
    // Track double support phases for stability analysis
    this.detectDoubleSupportPhase(leftYVelocity, rightYVelocity, leftKneeAngle, rightKneeAngle);
    
    // Store current velocities for next frame
    this.lastLeftYVelocity = leftYVelocity;
    this.lastRightYVelocity = rightYVelocity;
  }

  calculateKneeAngle(pose, side) {
    const hip = pose.keypoints.find(kp => kp.name === `${side}_hip`);
    const knee = pose.keypoints.find(kp => kp.name === `${side}_knee`);
    const ankle = pose.keypoints.find(kp => kp.name === `${side}_ankle`);
    
    if (!hip || !knee || !ankle || hip.score < 0.5 || knee.score < 0.5 || ankle.score < 0.5) {
      return 180; // Default to straight leg
    }
    
    return this.calculateAngleBetweenPoints(hip, knee, ankle);
  }
  
  calculateStepSymmetry() {
    // Need at least one step from each side
    if (this.stepsDetected.left.length === 0 || this.stepsDetected.right.length === 0) {
      return;
    }
    
    // Get the most recent steps
    const leftSteps = this.stepsDetected.left.slice(-3); // Use up to 3 recent steps
    const rightSteps = this.stepsDetected.right.slice(-3);
    
    // Calculate average stride lengths
    const avgLeftStrideLength = leftSteps
      .filter(step => step.strideLength)
      .reduce((sum, step) => sum + step.strideLength, 0) / 
      leftSteps.filter(step => step.strideLength).length || 0;
      
    const avgRightStrideLength = rightSteps
      .filter(step => step.strideLength)
      .reduce((sum, step) => sum + step.strideLength, 0) / 
      rightSteps.filter(step => step.strideLength).length || 0;
    
    // Calculate average stride times
    const avgLeftStrideTime = leftSteps
      .filter(step => step.strideTime)
      .reduce((sum, step) => sum + step.strideTime, 0) / 
      leftSteps.filter(step => step.strideTime).length || 0;
      
    const avgRightStrideTime = rightSteps
      .filter(step => step.strideTime)
      .reduce((sum, step) => sum + step.strideTime, 0) / 
      rightSteps.filter(step => step.strideTime).length || 0;
    
    // Calculate symmetry ratios (perfect symmetry = 1.0)
    if (avgLeftStrideLength > 0 && avgRightStrideLength > 0) {
      const lengthRatio = Math.min(avgLeftStrideLength, avgRightStrideLength) / 
                          Math.max(avgLeftStrideLength, avgRightStrideLength);
      this.strideSymmetryRatio = lengthRatio;
    }
    
    if (avgLeftStrideTime > 0 && avgRightStrideTime > 0) {
      const timeRatio = Math.min(avgLeftStrideTime, avgRightStrideTime) / 
                        Math.max(avgLeftStrideTime, avgRightStrideTime);
      this.strideTimeSymmetryRatio = timeRatio;
    }
    
    // Calculate cadence (steps per minute)
    if (this.stepsDetected.left.length >= 2 && this.stepsDetected.right.length >= 2) {
      const allSteps = [...this.stepsDetected.left, ...this.stepsDetected.right].sort((a, b) => a.timestamp - b.timestamp);
      const timeSpanSeconds = (allSteps[allSteps.length - 1].timestamp - allSteps[0].timestamp) / 1000;
      if (timeSpanSeconds > 0) {
        this.cadence = ((allSteps.length - 1) / timeSpanSeconds) * 60; // steps per minute
      }
    }
  }
  
  detectDoubleSupportPhase(leftYVelocity, rightYVelocity, leftKneeAngle, rightKneeAngle) {
    // Double support phase occurs when both feet are on the ground
    // This is typically when one foot is finishing stance phase and the other is beginning
    const isLeftStance = leftYVelocity <= 1 && leftKneeAngle > 165;
    const isRightStance = rightYVelocity <= 1 && rightKneeAngle > 165;
    
    const inDoubleSupport = isLeftStance && isRightStance;
    
    // Track double support duration as percentage of gait cycle
    if (this._lastDoubleSupportState !== inDoubleSupport) {
      const now = Date.now();
      
      if (inDoubleSupport) {
        // Entering double support
        this._doubleSupportStartTime = now;
      } else if (this._doubleSupportStartTime) {
        // Exiting double support
        const doubleSupportDuration = now - this._doubleSupportStartTime;
        
        // Store for later analysis
        if (!this._doubleSupportDurations) {
          this._doubleSupportDurations = [];
        }
        this._doubleSupportDurations.push(doubleSupportDuration);
        
        // Keep only recent values
        if (this._doubleSupportDurations.length > 10) {
          this._doubleSupportDurations.shift();
        }
        
        // Calculate average
        this.avgDoubleSupportTime = this._doubleSupportDurations.reduce((sum, val) => sum + val, 0) / 
                                    this._doubleSupportDurations.length;
      }
    }
    
    this._lastDoubleSupportState = inDoubleSupport;
  }
  
  // Add this method to calculate overall gait metrics
  calculateOverallGaitMetrics() {
    if (!this.stepsDetected || 
        (!this.stepsDetected.left.length && !this.stepsDetected.right.length)) {
      return {
        cadence: 0,
        speed: 0,
        strideLength: 0,
        strideTime: 0,
        symmetry: 0,
        doubleSupportTime: 0
      };
    }
    
    // Calculate average stride length
    let avgStrideLength = 0;
    let totalStrides = 0;
    
    if (this.stepsDetected.left.length > 1) {
      const leftStrides = this.stepsDetected.left.filter(step => step.strideLength);
      avgStrideLength += leftStrides.reduce((sum, step) => sum + step.strideLength, 0);
      totalStrides += leftStrides.length;
    }
    
    if (this.stepsDetected.right.length > 1) {
      const rightStrides = this.stepsDetected.right.filter(step => step.strideLength);
      avgStrideLength += rightStrides.reduce((sum, step) => sum + step.strideLength, 0);
      totalStrides += rightStrides.length;
    }
    
    avgStrideLength = totalStrides > 0 ? avgStrideLength / totalStrides : 0;
    
    // Calculate gait speed based on stride length and cadence
    const walkingSpeed = this.cadence > 0 ? (avgStrideLength * this.cadence) / 120 : 0;
    
    // Calculate overall symmetry score (0-100)
    const symmetryScore = this.strideSymmetryRatio ? 
                          Math.min(100, this.strideSymmetryRatio * 100) : 0;
    
    // Double support time as percentage of gait cycle
    const doubleSupportPercentage = this.avgDoubleSupportTime && this.avgStrideTime ?
                                   (this.avgDoubleSupportTime / this.avgStrideTime) * 100 :
                                   0;
    
    return {
      cadence: this.cadence || 0,
      speed: walkingSpeed,
      strideLength: avgStrideLength,
      strideTime: (this.stepsDetected.left[0]?.strideTime || this.stepsDetected.right[0]?.strideTime || 0),
      symmetry: symmetryScore,
      doubleSupportTime: doubleSupportPercentage
    };
  }
  
  // Add this method to enhance joint angle calculations for each frame
  calculateJointAngles(pose) {
    if (!pose || !pose.keypoints || pose.keypoints.length === 0) {
      return {
        hip: { left: 0, right: 0 },
        knee: { left: 0, right: 0 },
        ankle: { left: 0, right: 0 }
      };
    }
    
    // Get joint keypoints
    const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    const leftKnee = pose.keypoints.find(kp => kp.name === 'left_knee');
    const rightKnee = pose.keypoints.find(kp => kp.name === 'right_knee');
    const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
    const leftShoulder = pose.keypoints.find(kp => kp.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find(kp => kp.name === 'right_shoulder');
    
    // Calculate hip angles (angle between vertical and thigh)
    const leftHipAngle = leftHip && leftShoulder && leftKnee && leftHip.score > 0.5 && leftShoulder.score > 0.5 && leftKnee.score > 0.5 ?
                         this.calculateAngleBetweenPoints(leftShoulder, leftHip, leftKnee) : 0;
                         
    const rightHipAngle = rightHip && rightShoulder && rightKnee && rightHip.score > 0.5 && rightShoulder.score > 0.5 && rightKnee.score > 0.5 ?
                          this.calculateAngleBetweenPoints(rightShoulder, rightHip, rightKnee) : 0;
    
    // Calculate knee angles
    const leftKneeAngle = leftHip && leftKnee && leftAnkle && leftHip.score > 0.5 && leftKnee.score > 0.5 && leftAnkle.score > 0.5 ?
                          this.calculateAngleBetweenPoints(leftHip, leftKnee, leftAnkle) : 0;
                          
    const rightKneeAngle = rightHip && rightKnee && rightAnkle && rightHip.score > 0.5 && rightKnee.score > 0.5 && rightAnkle.score > 0.5 ?
                           this.calculateAngleBetweenPoints(rightHip, rightKnee, rightAnkle) : 0;
    
    // Calculate ankle angles (approximation of dorsiflexion/plantarflexion)
    // For ankle angles, we need to create a reference point to represent the ground/horizontal plane
    const leftAnkleRefPoint = leftAnkle ? { x: leftAnkle.x + 20, y: leftAnkle.y } : null;
    const rightAnkleRefPoint = rightAnkle ? { x: rightAnkle.x + 20, y: rightAnkle.y } : null;
    
    const leftAnkleAngle = leftKnee && leftAnkle && leftAnkleRefPoint && leftKnee.score > 0.5 && leftAnkle.score > 0.5 ?
                           this.calculateAngleBetweenPoints(leftKnee, leftAnkle, leftAnkleRefPoint) : 0;
                           
    const rightAnkleAngle = rightKnee && rightAnkle && rightAnkleRefPoint && rightKnee.score > 0.5 && rightAnkle.score > 0.5 ?
                            this.calculateAngleBetweenPoints(rightKnee, rightAnkle, rightAnkleRefPoint) : 0;
    
    return {
      hip: { left: leftHipAngle, right: rightHipAngle },
      knee: { left: leftKneeAngle, right: rightKneeAngle },
      ankle: { left: leftAnkleAngle, right: rightAnkleAngle }
    };
  }

  generateGaitAssessmentSummary() {
    if (this.metrics.length === 0) {
      return {
        overallScore: 0,
        gaitSpeed: 0,
        cadence: 0,
        strideLength: 0,
        balance: 0,
        stability: 0,
        symmetry: 0,
        jointRanges: {
          hip: { left: 0, right: 0 },
          knee: { left: 0, right: 0 },
          ankle: { left: 0, right: 0 }
        },
        doubleSupportTime: 0,
        notes: ["Insufficient data for analysis"]
      };
    }
    
    // Calculate average values from collected metrics
    const avgBalance = this.metrics.reduce((sum, m) => sum + m.balance, 0) / this.metrics.length;
    const avgStability = this.metrics.reduce((sum, m) => sum + m.stability.score, 0) / this.metrics.length;
    const avgSymmetry = this.metrics.reduce((sum, m) => sum + m.symmetry.overall, 0) / this.metrics.length;
    
    // Get gait metrics
    const gaitMetrics = this.calculateOverallGaitMetrics();
    
    // Calculate joint ranges of motion
    const jointRanges = this.calculateJointRanges();
    
    // Generate automatic notes based on analysis
    const notes = this.generateClinicalNotes(avgBalance, avgStability, gaitMetrics, avgSymmetry, jointRanges);
    
    // Calculate overall score (weighted average of key metrics)
    const speedScore = this.normalizeToScore(gaitMetrics.speed, this.normalRanges.walkingSpeed.min, this.normalRanges.walkingSpeed.max);
    const overallScore = Math.round(
      speedScore * 0.25 +
      avgBalance * 0.2 +
      avgStability * 0.2 +
      avgSymmetry * 0.2 +
      gaitMetrics.symmetry * 0.15
    );
    
    return {
      overallScore: Math.min(100, Math.max(0, overallScore)),
      gaitSpeed: gaitMetrics.speed,
      cadence: gaitMetrics.cadence,
      strideLength: gaitMetrics.strideLength,
      balance: avgBalance,
      stability: avgStability,
      symmetry: avgSymmetry,
      jointRanges,
      doubleSupportTime: gaitMetrics.doubleSupportTime,
      notes
    };
  }
  
  normalizeToScore(value, min, max) {
    if (value < min) return Math.max(0, 70 * (value / min));
    if (value > max) return Math.max(0, 100 - 10 * ((value - max) / max));
    return 70 + 30 * ((value - min) / (max - min));
  }
  
  calculateJointRanges() {
    if (this.metrics.length < 5) {
      return {
        hip: { left: 0, right: 0 },
        knee: { left: 0, right: 0 },
        ankle: { left: 0, right: 0 }
      };
    }
    
    // Track min/max values for each joint
    let minHipLeft = 180, maxHipLeft = 0;
    let minHipRight = 180, maxHipRight = 0;
    let minKneeLeft = 180, maxKneeLeft = 0;
    let minKneeRight = 180, maxKneeRight = 0;
    let minAnkleLeft = 180, maxAnkleLeft = 0;
    let minAnkleRight = 180, maxAnkleRight = 0;
    
    // Analyze joint angles across all frames
    this.metrics.forEach(metric => {
      if (!metric.jointAngles) return;
      
      const { hip, knee, ankle } = metric.jointAngles;
      
      // Update hip ranges
      if (hip?.left) {
        minHipLeft = Math.min(minHipLeft, hip.left);
        maxHipLeft = Math.max(maxHipLeft, hip.left);
      }
      if (hip?.right) {
        minHipRight = Math.min(minHipRight, hip.right);
        maxHipRight = Math.max(maxHipRight, hip.right);
      }
      
      // Update knee ranges
      if (knee?.left) {
        minKneeLeft = Math.min(minKneeLeft, knee.left);
        maxKneeLeft = Math.max(maxKneeLeft, knee.left);
      }
      if (knee?.right) {
        minKneeRight = Math.min(minKneeRight, knee.right);
        maxKneeRight = Math.max(maxKneeRight, knee.right);
      }
      
      // Update ankle ranges
      if (ankle?.left) {
        minAnkleLeft = Math.min(minAnkleLeft, ankle.left);
        maxAnkleLeft = Math.max(maxAnkleLeft, ankle.left);
      }
      if (ankle?.right) {
        minAnkleRight = Math.min(minAnkleRight, ankle.right);
        maxAnkleRight = Math.max(maxAnkleRight, ankle.right);
      }
    });
    
    // Calculate ranges of motion
    return {
      hip: {
        left: Math.round(maxHipLeft - minHipLeft),
        right: Math.round(maxHipRight - minHipRight)
      },
      knee: {
        left: Math.round(maxKneeLeft - minKneeLeft),
        right: Math.round(maxKneeRight - minKneeRight)
      },
      ankle: {
        left: Math.round(maxAnkleLeft - minAnkleLeft),
        right: Math.round(maxAnkleRight - minAnkleRight)
      }
    };
  }
  
  generateClinicalNotes(balance, stability, gaitMetrics, symmetry, jointRanges) {
    const notes = [];
    
    // Speed assessment
    if (gaitMetrics.speed < 0.8) {
      notes.push("Significantly reduced gait speed, indicating possible mobility limitation");
    } else if (gaitMetrics.speed < this.normalRanges.walkingSpeed.min) {
      notes.push("Moderately reduced gait speed");
    } else if (gaitMetrics.speed > this.normalRanges.walkingSpeed.max) {
      notes.push("Increased walking speed, possibly indicating altered gait pattern");
    }
    
    // Cadence assessment
    if (gaitMetrics.cadence < 90) {
      notes.push("Reduced step frequency (cadence)");
    } else if (gaitMetrics.cadence > 130) {
      notes.push("Increased step frequency (cadence)");
    }
    
    // Stride length assessment
    if (gaitMetrics.strideLength < this.normalRanges.strideLength.min) {
      notes.push("Reduced stride length");
    }
    
    // Balance assessment
    if (balance < 70) {
      notes.push("Significant balance impairment detected");
    } else if (balance < 85) {
      notes.push("Mild to moderate balance limitations");
    }
    
    // Stability assessment
    if (stability < 70) {
      notes.push("Reduced stability during walking, increased risk of falls");
    }
    
    // Symmetry assessment
    if (symmetry < 80) {
      notes.push("Significant gait asymmetry detected");
      
      // Check which side might be affected
      const { hip, knee } = jointRanges;
      const leftTotal = hip.left + knee.left;
      const rightTotal = hip.right + knee.right;
      
      // If one side has significantly less range of motion, it might be affected
      if (leftTotal < rightTotal * 0.8) {
        notes.push("Left side mobility appears more limited than right");
      } else if (rightTotal < leftTotal * 0.8) {
        notes.push("Right side mobility appears more limited than left");
      }
    }
    
    // Double support time assessment
    if (gaitMetrics.doubleSupportPercentage > 30) {
      notes.push("Increased double support time, indicating cautious gait pattern");
    }
    
    // Joint range assessment
    const normalKneeFlexion = 60; // Normal knee flexion during gait is around 60°
    
    if (jointRanges.knee.left < normalKneeFlexion * 0.7 || 
        jointRanges.knee.right < normalKneeFlexion * 0.7) {
      notes.push("Reduced knee flexion during gait cycle");
    }
    
    if (Math.abs(jointRanges.knee.left - jointRanges.knee.right) > 15) {
      notes.push("Asymmetrical knee motion during gait");
    }
    
    if (Math.abs(jointRanges.hip.left - jointRanges.hip.right) > 15) {
      notes.push("Asymmetrical hip motion during gait");
    }
    
    // Add comprehensive assessment if multiple issues are detected
    if (notes.length >= 3) {
      notes.push("Recommend comprehensive gait evaluation and possible intervention");
    }
    
    return notes;
  }
  
  // Enhances calibration using estimated height
  calibrateWithHeight(heightCm) {
    if (!heightCm || heightCm < 100 || heightCm > 220) {
      heightCm = this.calibrationFactors.heightEstimate;
    }
    
    // Update calibration factors based on height
    // Typical leg length is ~45% of height
    const estimatedLegLength = heightCm * 0.45;
    
    // Update stride scale factor based on estimated leg length
    this.calibrationFactors.strideScaleFactor = 0.007 + (estimatedLegLength / 10000);
    
    // Update velocity scale factor
    this.calibrationFactors.velocityScaleFactor = 1.0 + (estimatedLegLength / 1000);
    
    return {
      strideScaleFactor: this.calibrationFactors.strideScaleFactor,
      velocityScaleFactor: this.calibrationFactors.velocityScaleFactor
    };
  }
  
  // Calculate foot pressure distribution (approximation from pose)
  estimateFootPressure(pose) {
    if (!pose || !pose.keypoints) return null;
    
    const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
    const leftHip = pose.keypoints.find(kp => kp.name === 'left_hip');
    const rightHip = pose.keypoints.find(kp => kp.name === 'right_hip');
    
    if (!leftAnkle || !rightAnkle || !leftHip || !rightHip || 
        leftAnkle.score < 0.6 || rightAnkle.score < 0.6) {
      return null;
    }
    
    // Calculate hip center
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2
    };
    
    // Calculate relative positions of ankles to hip center in Y axis
    const leftAnkleRelY = leftAnkle.y - hipCenter.y;
    const rightAnkleRelY = rightAnkle.y - hipCenter.y;
    
    // Compare the relative Y positions to determine weight-bearing status
    // Lower Y value means the foot is higher (less weight-bearing)
    const totalY = Math.abs(leftAnkleRelY) + Math.abs(rightAnkleRelY);
    
    if (totalY === 0) return null;
    
    // Calculate approximate weight distribution (percentage)
    const leftWeightPercentage = (Math.abs(leftAnkleRelY) / totalY) * 100;
    const rightWeightPercentage = (Math.abs(rightAnkleRelY) / totalY) * 100;
    
    return {
      left: Math.min(100, Math.max(0, leftWeightPercentage)),
      right: Math.min(100, Math.max(0, rightWeightPercentage))
    };
  }
  
  // Enhanced step detection for greater accuracy
  enhancedStepDetection(currentPose, lastPose, deltaTime) {
    // First perform existing step detection
    if (lastPose) {
      this.detectSteps(currentPose, lastPose);
    }
    
    // Add frequency domain analysis for cadence estimation
    if (this.poseBuffer.length > 45) {  // At least 1.5 seconds of data at 30fps
      const recentPoses = this.poseBuffer.slice(-45);
      
      // Extract ankle height signals
      const leftAnkleSignal = [];
      const rightAnkleSignal = [];
      
      recentPoses.forEach(pose => {
        const leftAnkle = pose.keypoints.find(kp => kp.name === 'left_ankle');
        const rightAnkle = pose.keypoints.find(kp => kp.name === 'right_ankle');
        
        if (leftAnkle && leftAnkle.score > 0.6) {
          leftAnkleSignal.push(leftAnkle.y);
        } else {
          leftAnkleSignal.push(null);
        }
        
        if (rightAnkle && rightAnkle.score > 0.6) {
          rightAnkleSignal.push(rightAnkle.y);
        } else {
          rightAnkleSignal.push(null);
        }
      });
      
      // Interpolate missing values
      this.interpolateMissingValues(leftAnkleSignal);
      this.interpolateMissingValues(rightAnkleSignal);
      
      // Detect periodicity for each side
      const leftCadenceEstimate = this.estimateCadenceFromSignal(leftAnkleSignal, 30);
      const rightCadenceEstimate = this.estimateCadenceFromSignal(rightAnkleSignal, 30);
      
      // Average the two estimates if both are valid
      if (leftCadenceEstimate > 0 && rightCadenceEstimate > 0) {
        const avgCadence = (leftCadenceEstimate + rightCadenceEstimate) / 2;
        
        // Update cadence with exponential smoothing if we already have a value
        if (this.cadence) {
          this.cadence = 0.3 * avgCadence + 0.7 * this.cadence;
        } else {
          this.cadence = avgCadence;
        }
      } else if (leftCadenceEstimate > 0) {
        this.cadence = this.cadence ? 0.3 * leftCadenceEstimate + 0.7 * this.cadence : leftCadenceEstimate;
      } else if (rightCadenceEstimate > 0) {
        this.cadence = this.cadence ? 0.3 * rightCadenceEstimate + 0.7 * this.cadence : rightCadenceEstimate;
      }
    }
    
    return {
      stepCount: {
        left: this.stepsDetected.left.length,
        right: this.stepsDetected.right.length,
        total: this.stepsDetected.left.length + this.stepsDetected.right.length
      },
      cadence: this.cadence || 0,
      strideLength: this.calculateOverallGaitMetrics().strideLength
    };
  }
  
  interpolateMissingValues(signal) {
    let lastValidIndex = -1;
    
    // Forward pass - fill in gaps
    for (let i = 0; i < signal.length; i++) {
      if (signal[i] !== null) {
        // If we had previous valid values, interpolate the gap
        if (lastValidIndex !== -1 && i - lastValidIndex > 1) {
          const startValue = signal[lastValidIndex];
          const endValue = signal[i];
          const gap = i - lastValidIndex;
          
          for (let j = 1; j < gap; j++) {
            signal[lastValidIndex + j] = startValue + (endValue - startValue) * (j / gap);
          }
        }
        lastValidIndex = i;
      }
    }
    
    // Handle trailing nulls by extending last value
    if (lastValidIndex !== -1) {
      for (let i = lastValidIndex + 1; i < signal.length; i++) {
        if (signal[i] === null) {
          signal[i] = signal[lastValidIndex];
        }
      }
    }
    
    // Handle leading nulls by using first valid value
    let firstValidIndex = signal.findIndex(val => val !== null);
    if (firstValidIndex > 0) {
      const firstValidValue = signal[firstValidIndex];
      for (let i = 0; i < firstValidIndex; i++) {
        signal[i] = firstValidValue;
      }
    }
  }
  
  estimateCadenceFromSignal(signal, fps) {
    if (!signal || signal.length < 30 || fps <= 0) {
      return 0;
    }
    
    // Normalize signal
    const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
    const normalizedSignal = signal.map(val => val - mean);
    
    // Calculate autocorrelation to find periodicity
    const maxLag = Math.floor(signal.length / 2);
    let bestLag = 0;
    let bestCorrelation = 0;
    
    for (let lag = 5; lag < maxLag; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < signal.length - lag; i++) {
        correlation += normalizedSignal[i] * normalizedSignal[i + lag];
        count++;
      }
      
      if (count > 0) {
        correlation /= count;
        
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestLag = lag;
        }
      }
    }
    
    // Convert lag to cadence (steps per minute)
    if (bestLag >= 5) {  // Minimum lag for reliable detection
      // Period in seconds = lag / fps
      // Cadence = 60 / period * 2 (both feet)
      return (60 / (bestLag / fps)) * 2;
    }
    
    return 0;
  }
  
  // Reset analyzer for a new assessment
  reset() {
    this.metrics = [];
    this.lastPose = null;
    this.lastTimestamp = null;
    this.poseBuffer = [];
    this.stepsDetected = {
      left: [],
      right: []
    };
    this.lastVelocity = null;
    this.lastLeftYVelocity = undefined;
    this.lastRightYVelocity = undefined;
    this.strideSymmetryRatio = null;
    this.strideTimeSymmetryRatio = null;
    this.cadence = null;
    this._doubleSupportDurations = [];
    this.avgDoubleSupportTime = 0;
    this._lastDoubleSupportState = false;
    this._doubleSupportStartTime = null;
  }
}