import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';

// Mock the faceDetection module
const mockLoadFaceApiModels = vi.fn();
const mockDetectFace = vi.fn();

vi.mock('@/lib/faceDetection', () => ({
  loadFaceApiModels: mockLoadFaceApiModels,
  detectFace: mockDetectFace,
}));

describe('useFaceDetection', () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    videoRef = createRef<HTMLVideoElement>();
    // Create a mock video element
    const videoEl = document.createElement('video');
    Object.defineProperty(videoEl, 'videoWidth', { value: 640, writable: true });
    Object.defineProperty(videoEl, 'videoHeight', { value: 480, writable: true });
    (videoRef as any).current = videoEl;

    mockLoadFaceApiModels.mockResolvedValue(undefined);
    mockDetectFace.mockResolvedValue(null);

    vi.clearAllMocks();
  });

  it('starts with loading-models status', async () => {
    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    expect(result.current.status).toBe('loading-models');
    expect(result.current.detection).toBeNull();
    expect(result.current.isStable).toBe(false);
  });

  it('loads models on mount and transitions to ready', async () => {
    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(mockLoadFaceApiModels).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
  });

  it('transitions to searching when no face detected', async () => {
    mockDetectFace.mockResolvedValue(null);

    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Wait for detection loop to run
    await waitFor(
      () => {
        expect(result.current.status).toBe('searching');
      },
      { timeout: 500 },
    );
  });

  it('transitions to detected when face found but not stable', async () => {
    const mockDetection = {
      score: 0.95,
      descriptor: new Float32Array(128),
      expressions: { neutral: 0.9 },
      boundingBox: { x: 100, y: 100, width: 200, height: 250 },
      landmarks: [{ x: 150, y: 150 }],
    };

    mockDetectFace.mockResolvedValue(mockDetection);

    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Wait for detection loop to run and status to update
    await waitFor(
      () => {
        expect(result.current.status).toBe('detected');
      },
      { timeout: 500 },
    );

    // First detections won't be stable (need 8 of 10)
    expect(result.current.detection).toBeDefined();
    expect(result.current.isStable).toBe(false);
  });

  it('tracks stability across detection window', async () => {
    const mockDetection = {
      score: 0.95,
      descriptor: new Float32Array(128),
      expressions: { neutral: 0.9 },
      boundingBox: { x: 100, y: 100, width: 200, height: 250 },
      landmarks: [{ x: 150, y: 150 }],
    };

    mockDetectFace.mockResolvedValue(mockDetection);

    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Wait long enough for 10 detections at 100ms interval (~1.2s)
    await waitFor(
      () => {
        expect(result.current.isStable).toBe(true);
      },
      { timeout: 1500 },
    );

    expect(result.current.status).toBe('stable');
  });

  it('cleans up interval on unmount', async () => {
    const { useFaceDetection } = await import('./useFaceDetection');
    const { unmount } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(mockLoadFaceApiModels).toHaveBeenCalled();
    });

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('handles detection errors gracefully', async () => {
    mockDetectFace.mockRejectedValue(new Error('Detection error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { useFaceDetection } = await import('./useFaceDetection');
    const { result } = renderHook(() => useFaceDetection(videoRef));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    // Wait for detection attempts
    await waitFor(
      () => {
        expect(mockDetectFace).toHaveBeenCalled();
      },
      { timeout: 500 },
    );

    // Should log error but continue running
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useFaceDetection] Detection error:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
