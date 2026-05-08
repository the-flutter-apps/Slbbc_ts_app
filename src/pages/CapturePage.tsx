import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useAudio } from '@/hooks/useAudio';
import { enqueueAttendance } from '@/lib/queue';
import { getMockAttendanceResult } from '@/lib/mockData';
import { useKioskStore } from '@/store/kioskStore';

export function CapturePage() {
  const navigate = useNavigate();
  const { videoRef, status, error, capture } = useCamera();
  const { play } = useAudio();
  const refreshPendingCount = useKioskStore((s) => s.refreshPendingCount);
  const [captureReady, setCaptureReady] = useState(false);

  // Play "look at camera" audio when streaming starts
  useEffect(() => {
    if (status === 'streaming') {
      play('look-at-camera');

      // 1-second delay before capture is ready (liveness placeholder)
      const timer = setTimeout(() => {
        setCaptureReady(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, play]);

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

  const handleCapture = async () => {
    if (!captureReady) {
      console.log('[Capture] Button clicked but not ready yet');
      return;
    }

    console.log('[Capture] Attempting to capture frame...');

    try {
      const frame = capture();
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

      {/* Overlay frame guide */}
      {status === 'streaming' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="border-4 border-white/30 rounded-3xl"
            style={{ width: '70%', height: '60%' }}
          />
        </div>
      )}

      {/* Status overlay */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        {status === 'requesting' && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Starting camera...</p>
          </div>
        )}

        {status === 'streaming' && !captureReady && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Hold still...</p>
          </div>
        )}

        {status === 'streaming' && captureReady && (
          <div className="bg-black/60 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">Look at camera</p>
          </div>
        )}

        {status === 'error' && error && (
          <div className="bg-red-600/80 px-8 py-4 rounded-full">
            <p className="text-kiosk-base">{error}</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-6">
        {status === 'streaming' && (
          <button
            onClick={handleCapture}
            disabled={!captureReady}
            className="w-30 h-30 rounded-full bg-brand-accent hover:bg-brand-accent/90 disabled:bg-white/20 disabled:cursor-not-allowed active:scale-95 transition-all shadow-2xl"
            aria-label="Capture photo"
          >
            <span className="text-kiosk-base font-bold">CAPTURE</span>
          </button>
        )}

        {status === 'error' && error !== 'No camera found' && (
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
    </div>
  );
}
