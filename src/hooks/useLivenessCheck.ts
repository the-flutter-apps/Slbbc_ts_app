import { useEffect, useRef, useState } from 'react';
import type { DetectionResult } from '@/lib/faceDetection';
import type { LivenessPrompt, LivenessStatus } from '@/types';
import {
  getRandomPrompt,
  verifyBlink,
  verifyTurnLeft,
  verifyTurnRight,
  verifySmile,
} from '@/lib/liveness';
import { LIVENESS } from '@/lib/constants';

export interface UseLivenessCheckParams {
  detection: DetectionResult | null;
  isStable: boolean;
  enabled: boolean;
}

export interface UseLivenessCheckReturn {
  status: LivenessStatus;
  currentPrompt: LivenessPrompt | null;
  attemptsRemaining: number;
  timeRemaining: number;
}

export function useLivenessCheck({
  detection,
  isStable,
  enabled,
}: UseLivenessCheckParams): UseLivenessCheckReturn {
  const [status, setStatus] = useState<LivenessStatus>('idle');
  const [currentPrompt, setCurrentPrompt] = useState<LivenessPrompt | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(LIVENESS.MAX_ATTEMPTS);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const baselineRef = useRef<DetectionResult | null>(null);
  const previousDetectionRef = useRef<DetectionResult | null>(null);
  const promptStartTimeRef = useRef<number>(0);
  const smileStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const lastPromptRef = useRef<LivenessPrompt | null>(null);

  // Auto-pass in dev mode if enabled
  useEffect(() => {
    if (enabled && LIVENESS.SKIP_IN_DEV && import.meta.env.DEV) {
      console.log('[Liveness] Auto-passing in dev mode');
      setStatus('pass');
    }
  }, [enabled]);

  // Start liveness check when enabled
  useEffect(() => {
    if (!enabled || status === 'pass') {
      return;
    }

    // Skip liveness in dev mode
    if (LIVENESS.SKIP_IN_DEV && import.meta.env.DEV) {
      return;
    }

    if (status === 'idle' && isStable && detection) {
      // Capture baseline and start prompting
      baselineRef.current = detection;
      const prompt = getRandomPrompt(lastPromptRef.current ?? undefined);
      lastPromptRef.current = prompt;
      setCurrentPrompt(prompt);
      setStatus('prompting');
      promptStartTimeRef.current = Date.now();

      console.log('[Liveness] Starting prompt:', prompt);

      // Start countdown timer
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - promptStartTimeRef.current;
        const remaining = Math.max(0, LIVENESS.TIMEOUT_MS - elapsed);
        setTimeRemaining(Math.ceil(remaining / 1000));

        if (remaining === 0) {
          // Timeout
          handleFailure();
        }
      }, 100);
    }

    return () => {
      if (timerIntervalRef.current !== null) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [enabled, status, isStable, detection]);

  // Verify liveness action when prompting/verifying
  useEffect(() => {
    if (status !== 'prompting' && status !== 'verifying') {
      return;
    }

    if (!detection || !baselineRef.current) {
      return;
    }

    // Skip verification in dev mode
    if (LIVENESS.SKIP_IN_DEV && import.meta.env.DEV) {
      return;
    }

    let verified = false;

    switch (currentPrompt) {
      case 'blink':
        verified = verifyBlink(detection, previousDetectionRef.current);
        break;

      case 'turn-left':
        verified = verifyTurnLeft(detection, baselineRef.current);
        break;

      case 'turn-right':
        verified = verifyTurnRight(detection, baselineRef.current);
        break;

      case 'smile':
        // Smile needs to be sustained for SMILE_DURATION_MS
        if (verifySmile(detection)) {
          if (smileStartTimeRef.current === null) {
            smileStartTimeRef.current = Date.now();
          } else {
            const smileDuration = Date.now() - smileStartTimeRef.current;
            if (smileDuration >= LIVENESS.SMILE_DURATION_MS) {
              verified = true;
            }
          }
        } else {
          // Reset smile timer if expression drops
          smileStartTimeRef.current = null;
        }
        break;
    }

    if (verified) {
      handleSuccess();
    } else {
      // Update status to verifying if we're actively checking
      if (status === 'prompting') {
        setStatus('verifying');
      }
    }

    // Store current detection for next comparison (used by blink)
    previousDetectionRef.current = detection;
  }, [detection, status, currentPrompt]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      reset();
    }
  }, [enabled]);

  function handleSuccess() {
    console.log('[Liveness] Verification passed:', currentPrompt);

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setStatus('pass');
    setCurrentPrompt(null);
    setTimeRemaining(0);
  }

  function handleFailure() {
    console.log('[Liveness] Verification failed:', currentPrompt);

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setAttemptsRemaining((prev) => {
      const newAttemptsRemaining = prev - 1;

      if (newAttemptsRemaining > 0) {
        // Retry with new prompt
        setStatus('idle');
        setCurrentPrompt(null);
        smileStartTimeRef.current = null;
        previousDetectionRef.current = null;
      } else {
        // All attempts exhausted
        setStatus('fail');
        setCurrentPrompt(null);
        setTimeRemaining(0);
      }

      return newAttemptsRemaining;
    });
  }

  function reset() {
    setStatus('idle');
    setCurrentPrompt(null);
    setAttemptsRemaining(LIVENESS.MAX_ATTEMPTS);
    setTimeRemaining(0);
    baselineRef.current = null;
    previousDetectionRef.current = null;
    smileStartTimeRef.current = null;
    lastPromptRef.current = null;

    if (timerIntervalRef.current !== null) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }

  return {
    status,
    currentPrompt,
    attemptsRemaining,
    timeRemaining,
  };
}
