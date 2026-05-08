import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useAudio } from '@/hooks/useAudio';
import { enqueueAttendance } from '@/lib/queue';
import { getMockAttendanceResult } from '@/lib/mockData';
import { useKioskStore } from '@/store/kioskStore';
import { FACE_DETECTION } from '@/lib/constants';

export function CapturePage() {
  const navigate = useNavigate();
  const { videoRef, status: cameraStatus, error, capture } = useCamera();
  const { detection, isStable, status: detectionStatus } = useFaceDetection(videoRef);
  const { play } = useAudio();
  const refreshPendingCount = useKioskStore((s) => s.refreshPendingCount);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const autoCaptureTimerRef = useRef<number | null>(null);
  const detectionHistoryRef = useRef<boolean[]>([]);

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

  // Auto-capture logic when face is stable
  useEffect(() => {
    if (!isStable) {
      // Reset auto-capture when stability breaks
      if (autoCaptureTimerRef.current !== null) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      setAutoCapturing(false);
      setCountdown(0);
      return;
    }

    // Start auto-capture countdown
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
  }, [isStable]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = async () => {
    console.log('[Capture] Attempting to capture frame...');

    try {
      const frame = capture(detection?.boundingBox);
      if (!frame) {
        console.error('[Capture] capture() returned null');
        return;
      }

      console.log('[Capture] Frame captured successfully:', frame.blob.size, 'bytes');

      // For now: use mock PIN to generate result
      const mockPin = '1234';
      const result = getMockAttendanceResult(mockPin);

      console.log('[Capture] Enqueueing attendance record...');

      // Enqueue attendance record
      await enqueueAttendance({
        capturedAt: result.recordedAt,
        captureMethod: 'FACE',
        photoBlob: frame.blob,
        matchedEmployeeId: result.employee.id,
        pin: null,
      });

      await refreshPendingCount();

      console.log('[Capture] Navigating to success page...');

      // Navigate to success page
      navigate('/success', { state: { result } });
    } catch (error) {
      console.error('[Capture] Error during capture:', error);
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

        {cameraStatus === 'streaming' && detectionStatus === 'stable' && !autoCapturing && (
          <div className="bg-green-600/70 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Hold still...</p>
          </div>
        )}

        {cameraStatus === 'streaming' && autoCapturing && countdown > 0 && (
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
            disabled={!isStable}
            className={`w-30 h-30 rounded-full active:scale-95 transition-all shadow-2xl ${
              isStable
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
        </div>
      )}
    </div>
  );
}
