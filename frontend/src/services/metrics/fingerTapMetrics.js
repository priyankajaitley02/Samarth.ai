// New file for sophisticated finger tapping metrics
import * as tf from '@tensorflow/tfjs';

export class FingerTapMetricsAnalyzer {
  constructor() {
    this.baselineData = null;
    this.historicalData = [];
    this.normalRanges = {
      tapFrequency: { min: 3.5, max: 5.5 }, // taps per second
      tapAmplitude: { min: 30, max: 50 }, // mm
      tapRegularity: { min: 85, max: 100 }, // percentage
      tapPrecision: { min: 90, max: 100 } // percentage
    };
  }

  calculateInstantMetrics(currentHand, lastHand, deltaTime) {
    if (!lastHand) return null;

    const metrics = {
      // Instantaneous tap characteristics
      tapCharacteristics: this.calculateTapCharacteristics(currentHand, lastHand, deltaTime),
      
      // Finger movement precision
      movementPrecision: this.calculateMovementPrecision(currentHand),
      
      // Force estimation from finger positions
      tapForce: this.estimateTapForce(currentHand, lastHand),
      
      // Movement smoothness
      smoothness: this.calculateMovementSmoothness(currentHand, lastHand)
    };

    this.historicalData.push({
      timestamp: Date.now(),
      metrics: metrics
    });

    return metrics;
  }

  calculateTapCharacteristics(currentHand, lastHand, deltaTime) {
    return {
      velocity: this.calculateTapVelocity(currentHand, lastHand, deltaTime),
      amplitude: this.calculateTapAmplitude(currentHand, lastHand),
      acceleration: this.calculateTapAcceleration(currentHand, lastHand, deltaTime),
      trajectory: this.analyzeTapTrajectory(currentHand, lastHand)
    };
  }

  calculateMovementPrecision(hand) {
    // Calculate spatial and temporal precision metrics
    return {
      spatialPrecision: this.calculateSpatialPrecision(hand),
      temporalPrecision: this.calculateTemporalPrecision(hand),
      targetDeviation: this.calculateTargetDeviation(hand)
    };
  }

  calculateAggregateMetrics(timeWindow = 5000) {
    // Filter recent data
    const recentData = this.filterRecentData(timeWindow);
    
    return {
      // Frequency analysis
      frequencyMetrics: this.calculateFrequencyMetrics(recentData),
      
      // Rhythm analysis
      rhythmMetrics: this.calculateRhythmMetrics(recentData),
      
      // Fatigue indicators
      fatigueMetrics: this.calculateFatigueMetrics(recentData),
      
      // Movement quality
      qualityMetrics: this.calculateQualityMetrics(recentData)
    };
  }

  compareToBaseline(currentMetrics) {
    if (!this.baselineData) return null;

    return {
      frequencyChange: this.calculateFrequencyChange(
        currentMetrics.frequencyMetrics,
        this.baselineData.frequencyMetrics
      ),
      rhythmChange: this.calculateRhythmChange(
        currentMetrics.rhythmMetrics,
        this.baselineData.rhythmMetrics
      ),
      fatigueComparison: this.calculateFatigueComparison(
        currentMetrics.fatigueMetrics,
        this.baselineData.fatigueMetrics
      ),
      qualityComparison: this.calculateQualityComparison(
        currentMetrics.qualityMetrics,
        this.baselineData.qualityMetrics
      )
    };
  }

  // Additional helper methods...
} 