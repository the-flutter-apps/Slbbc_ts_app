import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useLivenessCheck } from '@/hooks/useLivenessCheck';
import { useAudio } from '@/hooks/useAudio';
import { enqueueAttendance } from '@/lib/queue';
import { checkInOutByFace, ApiError, NetworkError } from '@/lib/api';
import { useKioskStore } from '@/store/kioskStore';
import { FACE_DETECTION, LIVENESS } from '@/lib/constants';
import type { LivenessPrompt } from '@/types';

export function CapturePage() {
  const navigate = useNavigate();
  const { videoRef, status: cameraStatus, error, capture } = useCamera();
  const { detection, isStable, status: detectionStatus } = useFaceDetection(videoRef);
  const { play } = useAudio();
  const { refreshPendingCount, kioskId, apiKey, online } = useKioskStore((s) => ({
    refreshPendingCount: s.refreshPendingCount,
    kioskId: s.kioskId,
    apiKey: s.apiKey,
    online: s.online,
  }));
  const [livenessComplete, setLivenessComplete] = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const detectionHistoryRef = useRef<boolean[]>([]);

  // Liveness check (only runs when face is stable and not yet complete)
  const {
    status: livenessStatus,
    currentPrompt,
    attemptsRemaining,
    timeRemaining,
  } = useLivenessCheck({
    detection,
    isStable,
    enabled: isStable && !livenessComplete,
  });

  // Play "look at camera" audio when camera starts streaming
  useEffect(() => {
    if (cameraStatus === 'streaming' && detectionStatus === 'searching') {
      play('look-at-camera');
    }
  }, [cameraStatus, detectionStatus, play]);

  // Auto-navigate to idle if no camera found
  useEffect(() => {
    if (error === 'No camera found') {
      const timer = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, navigate]);

  // Play liveness prompt audio
  useEffect(() => {
    if (livenessStatus === 'prompting' && currentPrompt) {
      play(currentPrompt as LivenessPrompt);
    }
  }, [livenessStatus, currentPrompt, play]);

  // Handle liveness completion
  useEffect(() => {
    if (livenessStatus === 'pass') {
      console.log('[Liveness] Passed - proceeding to capture');
      setLivenessComplete(true);
    } else if (livenessStatus === 'fail') {
      console.log('[Liveness] Failed all attempts - redirecting to PIN');
      navigate('/pin', {
        state: { reason: 'liveness-failed' },
      });
    }
  }, [livenessStatus, navigate]);

  // Auto-capture logic when liveness is complete
  useEffect(() => {
    if (!isStable || !livenessComplete) {
      // Reset auto-capture when stability breaks or liveness not complete
      if (autoCaptureTimerRef.current !== null) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      setAutoCapturing(false);
      setCountdown(0);
      return;
    }

    // Start auto-capture countdown (after liveness passed)
    setAutoCapturing(true);
    const startTime = Date.now();
    const duration = FACE_DETECTION.AUTO_CAPTURE_AFTER_STABLE_MS;

    // Update countdown every 100ms
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setCountdown(Math.ceil(remaining / 1000));
    }, 100);

    // Trigger capture after duration
    autoCaptureTimerRef.current = window.setTimeout(() => {
      handleCapture();
    }, duration);

    return () => {
      clearInterval(countdownInterval);
      if (autoCaptureTimerRef.current !== null) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
    };
  }, [isStable, livenessComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = async () => {
    console.log('[Capture] Attempting to capture frame...');

    try {
      const frame = capture(detection?.boundingBox);
      if (!frame) {
        console.error('[Capture] capture() returned null');
        return;
      }

      console.log('[Capture] Frame captured successfully:', frame.blob.size, 'bytes');

      const capturedAt = new Date().toISOString();

      // Calculate liveness score (1.0 if passed, 0.5 if skipped in dev)
      const livenessScore = livenessComplete ? 1.0 : 0.5;

      // Try online face matching first
      if (online) {
        try {
          console.log('[Capture] Attempting online face match...');

          const result = await checkInOutByFace({
            photoBase64: frame.dataUrl,
            capturedAt,
            livenessScore,
            kioskId,
            apiKey,
          });

          console.log('[Capture] Face matched successfully:', result.employee.fullName);

          // Enqueue for audit trail (already synced)
          await enqueueAttendance({
            capturedAt: result.recordedAt,
            captureMethod: 'FACE',
            photoBlob: frame.blob,
            matchedEmployeeId: result.employee.id,
            pin: null,
          });

          await refreshPendingCount();

          // Navigate to success
          navigate('/success', { state: { result } });
          return;
        } catch (err) {
          if (err instanceof ApiError) {
            console.warn('[Capture] API error:', err.code, err.message);

            // Low confidence or no match → redirect to PIN
            if (err.code === 'LOW_CONFIDENCE' || err.code === 'NO_MATCH') {
              console.log('[Capture] Face match failed, redirecting to PIN entry');
              play('error');
              navigate('/pin', { state: { reason: 'face-match-failed' } });
              return;
            }

            // Other API errors → treat as network error and queue offline
            console.error('[Capture] API error, falling back to offline queue:', err);
          } else if (err instanceof NetworkError) {
            console.warn('[Capture] Network error, falling back to offline queue:', err.message);
          } else {
            console.error('[Capture] Unexpected error during face match:', err);
          }
        }
      }

      // Offline fallback: queue for later sync
      console.log('[Capture] Enqueueing attendance for offline sync...');

      await enqueueAttendance({
        capturedAt,
        captureMethod: 'FACE',
        photoBlob: frame.blob,
        matchedEmployeeId: null, // Will be matched server-side on sync
        pin: null,
      });

      await refreshPendingCount();

      // TODO: Implement offline face matching with face-api.js descriptors
      // For now, redirect to PIN as fallback
      console.log('[Capture] Offline mode, redirecting to PIN entry');
      play('offline');
      navigate('/pin', { state: { reason: 'offline' } });
    } catch (error) {
      console.error('[Capture] Error during capture:', error);
      play('error');
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  const handleRetry = () => {
    window.location.reload();
  };

  // Track detection history for dev UI
  useEffect(() => {
    detectionHistoryRef.current.push(detection !== null);
    if (detectionHistoryRef.current.length > FACE_DETECTION.STABILITY_WINDOW_SIZE) {
      detectionHistoryRef.current.shift();
    }
  }, [detection]);

  // Calculate stability count for dev UI
  const stabilityCount = detectionHistoryRef.current.filter((d) => d).length;

  // Determine frame guide color
  const frameGuideColor = isStable
    ? 'border-green-500/50'
    : detection
      ? 'border-yellow-500/30'
      : 'border-white/30';

  return (
    <div className="kiosk-container bg-black text-white relative">
      {/* Video preview (full screen, mirrored) */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
        autoPlay
        playsInline
        muted
      />

      {/* Bounding box overlay (when face detected) */}
      {detection && cameraStatus === 'streaming' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <rect
            x={`${(detection.boundingBox.x / 640) * 100}%`}
            y={`${(detection.boundingBox.y / 480) * 100}%`}
            width={`${(detection.boundingBox.width / 640) * 100}%`}
            height={`${(detection.boundingBox.height / 480) * 100}%`}
            fill="none"
            stroke={isStable ? '#22c55e' : '#eab308'}
            strokeWidth="3"
            opacity="0.6"
            rx="8"
            style={{ transform: 'scaleX(-1)', transformOrigin: 'center' }}
          />
        </svg>
      )}

      {/* Overlay frame guide */}
      {cameraStatus === 'streaming' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`border-4 rounded-3xl transition-colors duration-300 ${frameGuideColor}`}
            style={{ width: '70%', height: '60%' }}
          />
        </div>
      )}

      {/* Liveness prompt overlay */}
      {(livenessStatus === 'prompting' || livenessStatus === 'verifying') && currentPrompt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div
            className={`${
              livenessStatus === 'prompting' ? 'bg-blue-600/90' : 'bg-yellow-600/90'
            } px-16 py-12 rounded-3xl text-center max-w-md animate-pulse-slow`}
          >
            {/* Icon */}
            <div className="text-9xl mb-6">
              {currentPrompt === 'blink' && '👁️'}
              {currentPrompt === 'turn-left' && '⬅️'}
              {currentPrompt === 'turn-right' && '➡️'}
              {currentPrompt === 'smile' && '😊'}
            </div>

            {/* Prompt text */}
            <p className="text-kiosk-xl font-bold mb-4">
              {currentPrompt === 'blink' && 'BLINK'}
              {currentPrompt === 'turn-left' && 'TURN LEFT'}
              {currentPrompt === 'turn-right' && 'TURN RIGHT'}
              {currentPrompt === 'smile' && 'SMILE'}
            </p>

            {/* Countdown */}
            <p className="text-kiosk-lg">{timeRemaining} seconds</p>

            {/* Attempts */}
            <p className="text-kiosk-sm mt-4 text-white/70">
              Attempt {LIVENESS.MAX_ATTEMPTS - attemptsRemaining + 1} of {LIVENESS.MAX_ATTEMPTS}
            </p>
          </div>
        </div>
      )}

      {/* Status overlay */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        {cameraStatus === 'requesting' && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Starting camera...</p>
          </div>
        )}

        {detectionStatus === 'loading-models' && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Loading face detection...</p>
          </div>
        )}

        {cameraStatus === 'streaming' && detectionStatus === 'searching' && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Look at the camera</p>
          </div>
        )}

        {cameraStatus === 'streaming' && detectionStatus === 'detected' && (
          <div className="bg-yellow-600/70 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Face detected</p>
          </div>
        )}

        {cameraStatus === 'streaming' &&
          detectionStatus === 'stable' &&
          !livenessComplete &&
          livenessStatus === 'idle' && (
            <div className="bg-green-600/70 px-8 py-4 rounded-full">
              <p className="text-kiosk-base">Hold still...</p>
            </div>
          )}

        {livenessStatus === 'prompting' && (
          <div className="bg-blue-600/80 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Follow the prompt</p>
          </div>
        )}

        {livenessStatus === 'verifying' && (
          <div className="bg-yellow-600/80 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Checking...</p>
          </div>
        )}

        {cameraStatus === 'streaming' && livenessComplete && autoCapturing && countdown > 0 && (
          <div className="bg-green-600/80 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Auto-capturing in {countdown}...</p>
          </div>
        )}

        {cameraStatus === 'error' && error && (
          <div className="bg-red-600/80 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">{error}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-6">
        {cameraStatus === 'streaming' && (
          <button
            onClick={handleCapture}
            disabled={!isStable || !livenessComplete}
            className={`w-30 h-30 rounded-full active:scale-95 transition-all shadow-2xl ${
              isStable && livenessComplete
                ? 'bg-green-500 hover:bg-green-600 shadow-green-500/50'
                : 'bg-white/20 cursor-not-allowed'
            }`}
            aria-label="Capture photo"
          >
            <span className="text-kiosk-base font-bold">CAPTURE</span>
          </button>
        )}

        {cameraStatus === 'error' && error !== 'No camera found' && (
          <button
            onClick={handleRetry}
            className="px-12 py-6 rounded-full bg-brand-accent hover:bg-brand-accent/90 active:scale-95 transition-all shadow-lg"
          >
            <span className="text-kiosk-base font-bold">RETRY</span>
          </button>
        )}

        <button
          onClick={handleCancel}
          className="px-12 py-6 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
        >
          <span className="text-kiosk-base font-bold">CANCEL</span>
        </button>
      </div>

      {/* Dev UI */}
      {import.meta.env.DEV && cameraStatus === 'streaming' && (
        <div className="absolute bottom-32 left-4 bg-black/70 px-4 py-2 rounded text-xs font-mono">
          <div>Detection: {detection ? detection.score.toFixed(3) : '—'}</div>
          <div>
            Stability: {stabilityCount}/{FACE_DETECTION.STABILITY_WINDOW_SIZE} {isStable && '✓'}
          </div>
          <div>Status: {detectionStatus}</div>
          <div>
            Liveness: {livenessStatus}
            {LIVENESS.SKIP_IN_DEV && ' (skipped)'}
          </div>
          {livenessStatus !== 'idle' && livenessStatus !== 'pass' && (
            <div>Prompt: {currentPrompt}</div>
          )}
        </div>
      )}
    </div>
  );
}
