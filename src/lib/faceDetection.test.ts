import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as faceapi from 'face-api.js';
import { captureFrame } from './faceDetection';

vi.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: {
      loadFromUri: vi.fn().mockResolvedValue(undefined),
    },
    faceLandmark68Net: {
      loadFromUri: vi.fn().mockResolvedValue(undefined),
    },
    faceRecognitionNet: {
      loadFromUri: vi.fn().mockResolvedValue(undefined),
    },
    faceExpressionNet: {
      loadFromUri: vi.fn().mockResolvedValue(undefined),
    },
  },
  detectSingleFace: vi.fn(),
  TinyFaceDetectorOptions: vi.fn(),
}));

describe('faceDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadFaceApiModels', () => {
    it('loads all models from /models directory', async () => {
      vi.resetModules();
      const { loadFaceApiModels } = await import('./faceDetection');

      await loadFaceApiModels();

      expect(faceapi.nets.tinyFaceDetector.loadFromUri).toHaveBeenCalledWith('/models');
      expect(faceapi.nets.faceLandmark68Net.loadFromUri).toHaveBeenCalledWith('/models');
      expect(faceapi.nets.faceRecognitionNet.loadFromUri).toHaveBeenCalledWith('/models');
      expect(faceapi.nets.faceExpressionNet.loadFromUri).toHaveBeenCalledWith('/models');
    });

    it('throws clear error when models fail to load', async () => {
      vi.mocked(faceapi.nets.tinyFaceDetector.loadFromUri).mockRejectedValue(
        new Error('Network error'),
      );

      vi.resetModules();
      const { loadFaceApiModels } = await import('./faceDetection');

      await expect(loadFaceApiModels()).rejects.toThrow('Face detection models missing');
    });
  });

  describe('detectFace', () => {
    it('returns null when no face detected', async () => {
      vi.mocked(faceapi.detectSingleFace).mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockReturnValue({
            withFaceExpressions: vi.fn().mockResolvedValue(null),
          }),
        }),
      } as any);

      const { detectFace } = await import('./faceDetection');
      const videoEl = document.createElement('video');

      const result = await detectFace(videoEl);

      expect(result).toBeNull();
    });

    it('returns null when detection score is below threshold', async () => {
      const mockDetection = {
        detection: {
          score: 0.5, // Below MIN_DETECTION_SCORE (0.7)
          box: { x: 100, y: 100, width: 200, height: 250 },
        },
        descriptor: new Float32Array(128),
        expressions: { neutral: 0.9 },
        landmarks: { positions: [{ x: 150, y: 150 }] },
      };

      vi.mocked(faceapi.detectSingleFace).mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockReturnValue({
            withFaceExpressions: vi.fn().mockResolvedValue(mockDetection),
          }),
        }),
      } as any);

      const { detectFace } = await import('./faceDetection');
      const videoEl = document.createElement('video');

      const result = await detectFace(videoEl);

      expect(result).toBeNull();
    });

    it('returns DetectionResult with proper shape when face detected', async () => {
      const mockDetection = {
        detection: {
          score: 0.95,
          box: { x: 100, y: 100, width: 200, height: 250 },
        },
        descriptor: new Float32Array(128).fill(0.5),
        expressions: { neutral: 0.9, happy: 0.1 },
        landmarks: { positions: [{ x: 150, y: 150 }, { x: 160, y: 160 }] },
      };

      vi.mocked(faceapi.detectSingleFace).mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockReturnValue({
            withFaceExpressions: vi.fn().mockResolvedValue(mockDetection),
          }),
        }),
      } as any);

      const { detectFace } = await import('./faceDetection');
      const videoEl = document.createElement('video');

      const result = await detectFace(videoEl);

      expect(result).toBeDefined();
      expect(result?.score).toBe(0.95);
      expect(result?.descriptor).toBeInstanceOf(Float32Array);
      expect(result?.descriptor.length).toBe(128);
      expect(result?.boundingBox).toEqual({ x: 100, y: 100, width: 200, height: 250 });
      expect(result?.landmarks).toHaveLength(2);
      expect(result?.landmarks[0]).toEqual({ x: 150, y: 150 });
    });

    it('returns null and logs error when detection throws', async () => {
      vi.mocked(faceapi.detectSingleFace).mockReturnValue({
        withFaceLandmarks: vi.fn().mockReturnValue({
          withFaceDescriptor: vi.fn().mockReturnValue({
            withFaceExpressions: vi.fn().mockRejectedValue(new Error('Detection failed')),
          }),
        }),
      } as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { detectFace } = await import('./faceDetection');
      const videoEl = document.createElement('video');

      const result = await detectFace(videoEl);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[detectFace] Detection error:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('captureFrame', () => {
    it('captures full frame when no bounding box provided', () => {
      const videoEl = document.createElement('video');
      Object.defineProperty(videoEl, 'videoWidth', { value: 640, writable: true });
      Object.defineProperty(videoEl, 'videoHeight', { value: 480, writable: true });

      const result = captureFrame(videoEl);

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('blob');
      expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('crops to bounding box with padding when provided', () => {
      const videoEl = document.createElement('video');
      Object.defineProperty(videoEl, 'videoWidth', { value: 640, writable: true });
      Object.defineProperty(videoEl, 'videoHeight', { value: 480, writable: true });

      const boundingBox = { x: 200, y: 150, width: 240, height: 300 };

      const result = captureFrame(videoEl, boundingBox);

      expect(result).toHaveProperty('dataUrl');
      expect(result).toHaveProperty('blob');
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('throws error when video dimensions not available', () => {
      const videoEl = document.createElement('video');
      // videoWidth and videoHeight default to 0

      expect(() => captureFrame(videoEl)).toThrow('Video dimensions not available');
    });
  });
});
