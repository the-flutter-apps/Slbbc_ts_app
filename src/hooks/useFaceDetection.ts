import { useEffect, useRef, useState } from 'react';
import { loadFaceApiModels, detectFace, type DetectionResult } from '@/lib/faceDetection';
import { FACE_DETECTION } from '@/lib/constants';

export type DetectionStatus = 'loading-models' | 'ready' | 'searching' | 'detected' | 'stable';

export interface UseFaceDetectionReturn {
  detection: DetectionResult | null;
  isStable: boolean;
  status: DetectionStatus;
}

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
): UseFaceDetectionReturn {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [status, setStatus] = useState<DetectionStatus>('loading-models');

  const detectionHistoryRef = useRef<boolean[]>([]);
  const intervalRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const pausedUntilRef = useRef(0);

  // Load models on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await loadFaceApiModels();
        if (mounted) {
          setStatus('ready');
        }
      } catch (error) {
        console.error('[useFaceDetection] Failed to load models:', error);
        // Stay in loading-models state to show error UI
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Start detection loop when models are ready
  useEffect(() => {
    if (status === 'loading-models' || !videoRef.current) {
      return;
    }

    console.log('[useFaceDetection] Starting detection loop');

    intervalRef.current = window.setInterval(async () => {
      // Check if detection is paused due to errors
      if (Date.now() < pausedUntilRef.current) {
        return;
      }

      if (!videoRef.current) {
        return;
      }

      try {
        const result = await detectFace(videoRef.current);

        // Reset error counter on successful detection attempt
        consecutiveErrorsRef.current = 0;

        // Update detection state
        setDetection(result);

        // Update detection history (boolean: face detected or not)
        const history = detectionHistoryRef.current;
        history.push(result !== null);
        if (history.length > FACE_DETECTION.STABILITY_WINDOW_SIZE) {
          history.shift();
        }

        // Calculate stability
        const detectedCount = history.filter((d) => d).length;
        const stable =
          history.length === FACE_DETECTION.STABILITY_WINDOW_SIZE &&
          detectedCount >= FACE_DETECTION.STABILITY_THRESHOLD;

        setIsStable(stable);

        // Update status based on detection and stability
        if (result === null) {
          setStatus('searching');
        } else if (stable) {
          setStatus('stable');
        } else {
          setStatus('detected');
        }
      } catch (error) {
        console.error('[useFaceDetection] Detection error:', error);
        consecutiveErrorsRef.current++;

        // After 5 consecutive errors, pause for 5 seconds
        if (consecutiveErrorsRef.current >= 5) {
          console.warn('[useFaceDetection] Too many errors, pausing detection for 5s');
          pausedUntilRef.current = Date.now() + 5000;
          consecutiveErrorsRef.current = 0;
        }
      }
    }, FACE_DETECTION.DETECTION_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, videoRef]);

  return {
    detection,
    isStable,
    status,
  };
}
