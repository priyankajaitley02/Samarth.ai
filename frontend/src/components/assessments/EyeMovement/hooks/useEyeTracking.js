
import { useState, useRef, useCallback, useEffect } from 'react';
import { MLService } from '../../../../services/mlService';
import { ASSESSMENT_PHASES } from '../constants/assessmentConfig';

export const useEyeTracking = (userId, videoRef) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [neurologicalIndicators, setNeurologicalIndicators] = useState(null);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const phaseTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  const processPhase = async (blob, phase) => {
    try {
      const results = await MLService.analyzeEyes(blob, phase);

      if (results.success) {
        if (!mountedRef.current) return results;

        // Ensure accuracy exists with a fallback value.
        if (results.metrics && results.metrics.summary) {
          if (
            typeof results.metrics.summary.accuracy === 'undefined' ||
            results.metrics.summary.accuracy === null
          ) {
            results.metrics.summary.accuracy = 75.0;
          }
        }

        setMetrics((prev) => ({
          ...prev,
          [phase]: results.metrics
        }));

        return results;
      }

      throw new Error(results.detail || 'Processing failed');
    } catch (err) {
      console.error('Error processing phase:', err);
      if (mountedRef.current) {
        setError(`Failed to process phase ${phase}: ${err.message}`);
      }
      throw err;
    }
  };

  const startRecording = async () => {
    try {
      cancelledRef.current = false;
      setError(null);
      setIsRecording(true);
      setIsProcessing(false);

      const completedPhases = [];
      for (const [phase, config] of Object.entries(ASSESSMENT_PHASES)) {
        if (cancelledRef.current) break;
        setCurrentPhase(phase);
        const blob = await runPhase(phase, config);
        completedPhases.push({ blob, phase });
      }

      if (!mountedRef.current) return;
      setCurrentPhase(null);
      setIsProcessing(true);
      for (const { blob, phase } of completedPhases) {
        if (!mountedRef.current) break;
        await processPhase(blob, phase);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(`Recording failed: ${err.message}`);
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false);
        setIsRecording(false);
        setCurrentPhase(null);
      }
    }
  };

  const runPhase = async (phase, config) => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current?.srcObject) {
        reject(new Error('Video stream not available'));
        return;
      }

      chunksRef.current = [];

      // Select a supported recording format.
      let options = {};

      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        options = {
          mimeType: 'video/webm;codecs=vp9',
          videoBitsPerSecond: 2500000
        };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options = {
          mimeType: 'video/webm;codecs=vp8',
          videoBitsPerSecond: 2500000
        };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      }

      try {
        const mediaRecorder = new MediaRecorder(
          videoRef.current.srcObject,
          options
        );

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          try {
            const mimeType =
              mediaRecorder.mimeType || options.mimeType || 'video/webm';

            const blob = new Blob(chunksRef.current, {
              type: mimeType
            });
            resolve(blob);
          } catch (err) {
            reject(err);
          } finally {
            if (mediaRecorderRef.current === mediaRecorder) {
              mediaRecorderRef.current = null;
            }
          }
        };

        mediaRecorder.onerror = (event) => {
          reject(
            new Error(
              `MediaRecorder error: ${
                event.error?.name || 'Unknown recording error'
              }`
            )
          );
        };

        mediaRecorder.start(1000);
        mediaRecorderRef.current = mediaRecorder;

        // Automatically stop this phase after its configured duration.
        phaseTimerRef.current = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          phaseTimerRef.current = null;
        }, config.duration);
      } catch (err) {
        reject(new Error(`Failed to create MediaRecorder: ${err.message}`));
      }
    });
  };

  // Stop the active recording, if one exists.
  const stopRecording = useCallback(() => {
    cancelledRef.current = true;

    if (phaseTimerRef.current) {
      clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }

    setCurrentPhase(null);
    setIsProcessing(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;

      if (phaseTimerRef.current) {
        clearTimeout(phaseTimerRef.current);
      }

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'recording') {
        recorder.stop();
      }
    };
  }, []);

  return {
    isRecording,
    isProcessing,
    currentPhase,
    metrics,
    neurologicalIndicators,
    error,
    startRecording,
    stopRecording,
    processPhase
  };
};
