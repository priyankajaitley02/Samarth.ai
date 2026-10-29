import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';

let detector = null;
let isAnalyzing = false;
let animationFrameId = null;
let lastFrameTime = 0;
const FRAME_THROTTLE = 30; // Only process every 30ms to reduce CPU load

// Add these variables for improved tap detection
let lastTapTimestamps = [];
let intervalHistory = [];
let consecutiveSkippedIntervals = 0;
let adaptiveMinInterval = 100;
let adaptiveMaxInterval = 2000;

const initializeDetector = async () => {
  try {
    await tf.ready();
    await tf.setBackend('webgl');
    
    // Configure TensorFlow.js for better performance
    tf.env().set('WEBGL_CPU_FORWARD', false);
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    
    if (!detector) {
      const modelConfig = {
        maxHands: 1, // Only detect one hand to improve performance
        detectionConfidence: 0.7 // Slightly higher threshold for better performance
      };
      detector = await handpose.load(modelConfig);
    }
    return detector;
  } catch (error) {
    console.error('Error initializing hand detector:', error);
    throw error;
  }
};

// Optimized draw function - only draws essential elements when needed
const drawHand = (landmarks, ctx, isTapping) => {
  // Only clear specific regions of the canvas rather than the whole thing
  if (landmarks.length === 0) return;
  
  // Get bounding box of the hand to optimize clearing
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  landmarks.forEach(point => {
    const [x, y] = point;
    minX = Math.min(minX, x - 10);
    minY = Math.min(minY, y - 10);
    maxX = Math.max(maxX, x + 10);
    maxY = Math.max(maxY, y + 10);
  });
  
  // Add padding
  minX = Math.max(0, minX - 20);
  minY = Math.max(0, minY - 20);
  maxX = Math.min(ctx.canvas.width, maxX + 20);
  maxY = Math.min(ctx.canvas.height, maxY + 20);
  
  // Clear only the hand region
  ctx.clearRect(minX, minY, maxX - minX, maxY - minY);
  
  // Draw only key points (thumb and index) to save CPU
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  
  if (thumbTip && indexTip) {
    // Draw thumb tip
    ctx.beginPath();
    ctx.arc(thumbTip[0], thumbTip[1], 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    
    // Draw index tip
    ctx.beginPath();
    ctx.arc(indexTip[0], indexTip[1], 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'red';
    ctx.fill();
    
    // Draw line connecting them
    ctx.beginPath();
    ctx.moveTo(thumbTip[0], thumbTip[1]);
    ctx.lineTo(indexTip[0], indexTip[1]);
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add visual feedback for taps
    if (isTapping) {
      ctx.beginPath();
      ctx.arc((thumbTip[0] + indexTip[0])/2, 
              (thumbTip[1] + indexTip[1])/2, 
              15, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();
    }
  }
};

// Faster distance calculation using approximation
const fastDistance = (p1, p2) => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = (p1[2] || 0) - (p2[2] || 0);
  
  // Use approximation for square root (faster than Math.sqrt for this use case)
  // We don't need perfect accuracy for this application
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absDz = Math.abs(dz);
  
  const max = Math.max(absDx, absDy, absDz);
  const min1 = absDx === max ? absDy : absDx;
  const min2 = absDx === max || absDy === max ? absDz : absDy;
  
  // Approximation: max + min1*0.4 + min2*0.2
  return max + (min1 * 0.4) + (min2 * 0.2);
};

const calculateTapMetrics = (landmarks) => {
  if (!landmarks || landmarks.length === 0) return null;

  // Get thumb and index finger positions
  const thumb = landmarks[4];
  const index = landmarks[8];

  if (!thumb || !index) return null;

  // Calculate distance between thumb and index finger with faster method
  const distance = fastDistance(thumb, index);

  // Determine if a tap occurred using adaptive threshold
  // Decreased threshold for more sensitive detection
  const tapThreshold = 40; 
  const isTapping = distance < tapThreshold;

  // Calculate tap force as inverse of distance (closer = stronger)
  const maxDistance = 150; // Reduced from 200 for better force normalization
  const normalizedForce = Math.max(0, Math.min(1, 1 - (distance / maxDistance)));

  return {
    distance: Math.max(1, distance), // Ensure distance is never zero
    isTapping,
    thumbPosition: thumb,
    indexPosition: index,
    timestamp: Date.now(),
    force: normalizedForce // Smooth force value between 0-1
  };
};

// New function to process tap intervals with adaptive thresholds
const processTapInterval = (interval, now, lastTapTime, intervalHistory) => {
  // Adapt interval thresholds based on recent history
  if (intervalHistory.length >= 5) {
    // Sort and get median to avoid outlier effects
    const sortedIntervals = [...intervalHistory].sort((a, b) => a - b);
    const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    
    // Adapt thresholds, but keep them within reasonable bounds
    adaptiveMinInterval = Math.max(80, Math.min(300, medianInterval * 0.4));
    adaptiveMaxInterval = Math.min(2500, Math.max(600, medianInterval * 2.5));
  }
  
  // Check if interval is within adaptive thresholds
  if (lastTapTime === 0 || (interval >= adaptiveMinInterval && interval <= adaptiveMaxInterval)) {
    // Valid interval
    return {
      valid: true,
      interval: interval,
      adjusted: false
    };
  } else {
    // Handle potentially missed taps (when interval is too long)
    if (interval > adaptiveMaxInterval && interval < adaptiveMaxInterval * 3) {
      // Determine how many taps might have been missed
      const likelyMissedTaps = Math.round(interval / (adaptiveMaxInterval * 0.7));
      
      if (likelyMissedTaps > 1) {
        // Distribute the interval among missed taps
        const distributedInterval = interval / likelyMissedTaps;
        console.log(`Detected ${likelyMissedTaps} missed taps, using interval: ${distributedInterval.toFixed(0)}ms`);
        
        return {
          valid: true,
          interval: distributedInterval,
          adjusted: true,
          missedTaps: likelyMissedTaps - 1 // Number of taps we're assuming were missed
        };
      }
    }
    
    // Log anomalous interval
    console.log(`Skipping anomalous tap interval: ${interval}ms (thresholds: ${adaptiveMinInterval}-${adaptiveMaxInterval}ms)`);
    
    // If we've skipped too many consecutive intervals, adapt thresholds temporarily
    if (consecutiveSkippedIntervals >= 3) {
      console.log("Too many skipped intervals, temporarily expanding acceptance range");
      adaptiveMinInterval = Math.max(50, adaptiveMinInterval * 0.8);
      adaptiveMaxInterval = Math.min(3000, adaptiveMaxInterval * 1.2);
    }
    
    return {
      valid: false,
      interval: interval,
      adjusted: false
    };
  }
};

export const startFingerTapping = async (videoElement, canvasElement, onUpdate) => {
  try {
    const detector = await initializeDetector();
    isAnalyzing = true;
    
    // Reset detection variables
    lastTapTimestamps = [];
    intervalHistory = [];
    consecutiveSkippedIntervals = 0;
    adaptiveMinInterval = 100;
    adaptiveMaxInterval = 2000;

    // Set canvas dimensions to match video but potentially at lower resolution
    if (canvasElement) {
      // Use smaller dimensions to improve performance if needed
      const scaleFactor = 1.0; // Can reduce to 0.75 or 0.5 for better performance if needed
      canvasElement.width = (videoElement.videoWidth || 640) * scaleFactor;
      canvasElement.height = (videoElement.videoHeight || 480) * scaleFactor;
      
      // Clear canvas once at start
      const ctx = canvasElement.getContext('2d');
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }

    let lastTapState = false;
    let lastTapTime = 0;
    let tapCount = 0;
    let consecutiveEmptyFrames = 0;
    let lastLandmarks = null;
    let lastInterval = 200;
    let debounceTimer = null;
    let lastUpdateTime = 0;
    let pendingUpdate = false;
    let lastMetrics = null;

    const analyze = async () => {
      if (!isAnalyzing) return;

      try {
        const now = Date.now();
        
        // Only process frames at a reasonable rate (every FRAME_THROTTLE ms)
        if (now - lastFrameTime < FRAME_THROTTLE) {
          animationFrameId = requestAnimationFrame(analyze);
          return;
        }
        
        lastFrameTime = now;
        
        const hands = await detector.estimateHands(videoElement);
        
        if (hands.length > 0) {
          consecutiveEmptyFrames = 0;
          const landmarks = hands[0].landmarks;
          lastLandmarks = landmarks; // Store for smoothing
          const metrics = calculateTapMetrics(landmarks);
          lastMetrics = metrics;
          
          // Draw hand landmarks if canvas is provided
          if (canvasElement) {
            const ctx = canvasElement.getContext('2d');
            drawHand(landmarks, ctx, metrics.isTapping);
          }
          
          if (metrics && typeof onUpdate === 'function' && !pendingUpdate) {
            // Track tap state changes for better metrics
            if (metrics.isTapping && !lastTapState) {
              // Store timestamp for multi-tap detection
              lastTapTimestamps.push(now);
              // Keep only recent timestamps (last 5 seconds)
              const cutoffTime = now - 5000;
              lastTapTimestamps = lastTapTimestamps.filter(t => t > cutoffTime);
              
              const interval = lastTapTime > 0 ? now - lastTapTime : 200;
              
              // Process the interval with adaptive thresholds
              const processedInterval = processTapInterval(interval, now, lastTapTime, intervalHistory);
              
              if (processedInterval.valid) {
                // Valid tap detected
                lastTapTime = now;
                tapCount++;
                lastInterval = processedInterval.interval;
                consecutiveSkippedIntervals = 0;
                
                // Add to interval history
                intervalHistory.push(processedInterval.interval);
                if (intervalHistory.length > 15) {
                  intervalHistory.shift(); // Keep recent history
                }
                
                // Only count if this isn't the first detected tap
                if (tapCount > 1) {
                  console.log(`Tap detected! Interval: ${processedInterval.interval}ms, Force: ${metrics.force.toFixed(2)}`);
                  
                  // Use non-blocking update pattern
                  pendingUpdate = true;
                  setTimeout(() => {
                    onUpdate({
                      interval: processedInterval.interval,
                      force: metrics.force,
                      timestamp: metrics.timestamp,
                      landmarks: landmarks,
                      isTapping: metrics.isTapping
                    });
                    pendingUpdate = false;
                  }, 0);
                } else {
                  // For first tap, still send update but use a default interval
                  pendingUpdate = true;
                  setTimeout(() => {
                    onUpdate({
                      interval: 200, // Default first interval
                      force: metrics.force,
                      timestamp: metrics.timestamp,
                      landmarks: landmarks,
                      isTapping: metrics.isTapping
                    });
                    pendingUpdate = false;
                  }, 0);
                }
              } else {
                // Handle consecutive skipped intervals
                consecutiveSkippedIntervals++;
              }
            } else if (!metrics.isTapping && lastTapState) {
              // State change from tapping to not tapping
              // Delay updating the tap state to reduce sensitivity to quick movements
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }
              
              debounceTimer = setTimeout(() => {
                lastTapState = false;
                // Throttle updates - only send if significant time has passed
                if (now - lastUpdateTime > 100) {
                  lastUpdateTime = now;
                  onUpdate({
                    interval: lastInterval,
                    force: 0.1, // Low but non-zero force for visualization
                    timestamp: Date.now(),
                    landmarks: landmarks,
                    isTapping: false
                  });
                }
              }, 50); // 50ms debounce for tap release
            } else if (!lastTapState && !metrics.isTapping) {
              // If we're consistently not tapping, send updates very infrequently
              // to reduce processing load
              if (now - lastUpdateTime > 500) { // Only update every 500ms when not tapping
                lastUpdateTime = now;
                onUpdate({
                  interval: lastInterval,
                  force: metrics.force,
                  timestamp: metrics.timestamp,
                  landmarks: landmarks,
                  isTapping: false
                });
              }
            }
            
            // Only update tap state when going from not tapping to tapping
            // For tap release, we use the debounce timer
            if (metrics.isTapping) {
              lastTapState = true;
            }
          }
        } else {
          // If no hands detected multiple frames in a row
          consecutiveEmptyFrames++;
          
          if (canvasElement && consecutiveEmptyFrames > 15) {
            const ctx = canvasElement.getContext('2d');
            
            // Only redraw the warning every 30 frames to save CPU
            if (consecutiveEmptyFrames % 30 === 0) {
              ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
              ctx.font = '24px Arial';
              ctx.fillStyle = 'red';
              ctx.textAlign = 'center';
              ctx.fillText('Hand not detected', canvasElement.width/2, canvasElement.height/2);
            }
          }
          
          // Reset tap state if hand lost
          if (lastTapState) {
            lastTapState = false;
            
            // Send update with zero force but limit the update rate
            if (typeof onUpdate === 'function' && now - lastUpdateTime > 200) {
              lastUpdateTime = now;
              onUpdate({
                interval: lastInterval || 200,
                force: 0,
                timestamp: now,
                landmarks: null,
                isTapping: false
              });
            }
          }
        }

        if (isAnalyzing) {
          animationFrameId = requestAnimationFrame(analyze);
        }
      } catch (error) {
        console.error('Error during hand analysis:', error);
        stopFingerTapping();
      }
    };

    analyze();

    return {
      stop: stopFingerTapping,
      getTapCount: () => tapCount,
      getLastMetrics: () => lastMetrics
    };
  } catch (error) {
    console.error('Error starting finger tapping analysis:', error);
    throw error;
  }
};

export const stopFingerTapping = () => {
  isAnalyzing = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
};

export default {
  startFingerTapping,
  stopFingerTapping
};