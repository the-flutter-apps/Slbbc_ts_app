import { useEffect, useRef, useState } from 'react';
import { startCamera as startCameraLib, stopCamera, captureFrame } from '@/lib/faceDetection';

export type CameraStatus = 'idle' | 'requesting' | 'streaming' | 'error';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  capture: () => { dataUrl: string; blob: Blob } | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initCamera() {
      if (!videoRef.current) {
        return;
      }

      setStatus('requesting');
      setError(null);

      try {
        const stream = await startCameraLib(videoRef.current);
        if (!mounted) {
          stopCamera(stream);
          return;
        }

        streamRef.current = stream;
        setStatus('streaming');
      } catch (err) {
        if (!mounted) return;

        const message = err instanceof Error ? err.message : 'Unknown camera error';
        setError(message);
        setStatus('error');
      }
    }

    initCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  const capture = () => {
    if (!videoRef.current) {
      console.error('[useCamera] capture() called but videoRef.current is null');
      return null;
    }

    if (status !== 'streaming') {
      console.error('[useCamera] capture() called but status is:', status);
      return null;
    }

    console.log('[useCamera] Capturing frame from video element');
    return captureFrame(videoRef.current);
  };

  return {
    videoRef,
    status,
    error,
    capture,
  };
}
