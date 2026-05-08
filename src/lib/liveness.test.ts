import { describe, it, expect } from 'vitest';
import {
  getRandomPrompt,
  verifyBlink,
  verifyTurnLeft,
  verifyTurnRight,
  verifySmile,
} from './liveness';
import type { DetectionResult } from './faceDetection';

describe('liveness', () => {
  const createMockDetection = (overrides: Partial<DetectionResult> = {}): DetectionResult => ({
    score: 0.95,
    descriptor: new Float32Array(128),
    expressions: {
      neutral: 0.9,
      happy: 0.1,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
      eyesClosed: 0.1,
    } as any,
    boundingBox: { x: 200, y: 150, width: 240, height: 300 },
    landmarks: Array(68)
      .fill(null)
      .map(() => ({ x: 300, y: 250 })),
    ...overrides,
  });

  describe('getRandomPrompt', () => {
    it('returns a valid prompt', () => {
      const prompt = getRandomPrompt();
      expect(['blink', 'turn-left', 'turn-right', 'smile']).toContain(prompt);
    });

    it('excludes specified prompt', () => {
      const results = Array.from({ length: 20 }, () => getRandomPrompt('blink'));
      expect(results).not.toContain('blink');
      expect(results.some((p) => p === 'turn-left')).toBe(true);
    });

    it('can return any prompt when no exclusion', () => {
      // Run multiple times to get different prompts
      const results = new Set(Array.from({ length: 50 }, () => getRandomPrompt()));
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('verifyBlink', () => {
    it('returns false when no previous detection', () => {
      const current = createMockDetection();
      expect(verifyBlink(current, null)).toBe(false);
    });

    it('returns true when eyes were closed and now open', () => {
      const previous = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.9, // High (closed)
        } as any,
      });

      const current = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.1, // Low (open)
        } as any,
      });

      expect(verifyBlink(current, previous)).toBe(true);
    });

    it('returns false when eyes remain open', () => {
      const previous = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.1,
        } as any,
      });

      const current = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.1,
        } as any,
      });

      expect(verifyBlink(current, previous)).toBe(false);
    });

    it('returns false when eyes remain closed', () => {
      const previous = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.9,
        } as any,
      });

      const current = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          eyesClosed: 0.9,
        } as any,
      });

      expect(verifyBlink(current, previous)).toBe(false);
    });
  });

  describe('verifyTurnLeft', () => {
    it('returns true when head shifted left significantly', () => {
      const baseline = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 320, y: 250 })),
      });

      // Shifted left by 40px (40/240 = 16.7% > 15% threshold)
      const current = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 280, y: 250 })),
      });

      expect(verifyTurnLeft(current, baseline)).toBe(true);
    });

    it('returns false when head shifted right', () => {
      const baseline = createMockDetection({
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 320, y: 250 })),
      });

      const current = createMockDetection({
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 360, y: 250 })),
      });

      expect(verifyTurnLeft(current, baseline)).toBe(false);
    });

    it('returns false when shift is below threshold', () => {
      const baseline = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 320, y: 250 })),
      });

      // Shifted left by only 20px (20/240 = 8.3% < 15% threshold)
      const current = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 300, y: 250 })),
      });

      expect(verifyTurnLeft(current, baseline)).toBe(false);
    });
  });

  describe('verifyTurnRight', () => {
    it('returns true when head shifted right significantly', () => {
      const baseline = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 320, y: 250 })),
      });

      // Shifted right by 40px (40/240 = 16.7% > 15% threshold)
      const current = createMockDetection({
        boundingBox: { x: 200, y: 150, width: 240, height: 300 },
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 360, y: 250 })),
      });

      expect(verifyTurnRight(current, baseline)).toBe(true);
    });

    it('returns false when head shifted left', () => {
      const baseline = createMockDetection({
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 320, y: 250 })),
      });

      const current = createMockDetection({
        landmarks: Array(68)
          .fill(null)
          .map(() => ({ x: 280, y: 250 })),
      });

      expect(verifyTurnRight(current, baseline)).toBe(false);
    });
  });

  describe('verifySmile', () => {
    it('returns true when happy expression exceeds threshold', () => {
      const detection = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          happy: 0.8,
        } as any,
      });

      expect(verifySmile(detection)).toBe(true);
    });

    it('returns false when happy expression below threshold', () => {
      const detection = createMockDetection({
        expressions: {
          ...createMockDetection().expressions,
          happy: 0.5,
        } as any,
      });

      expect(verifySmile(detection)).toBe(false);
    });

    it('handles missing happy expression', () => {
      const detection = createMockDetection({
        expressions: {
          neutral: 0.9,
        } as any,
      });

      expect(verifySmile(detection)).toBe(false);
    });
  });
});
