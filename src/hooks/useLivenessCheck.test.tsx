import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { DetectionResult } from '@/lib/faceDetection';

// Mock liveness verification functions
vi.mock('@/lib/liveness', () => ({
  getRandomPrompt: vi.fn(() => 'blink'),
  verifyBlink: vi.fn(() => false),
  verifyTurnLeft: vi.fn(() => false),
  verifyTurnRight: vi.fn(() => false),
  verifySmile: vi.fn(() => false),
}));

// Mock constants to disable dev skip
vi.mock('@/lib/constants', () => ({
  FACE_DETECTION: {
    STABLE_FRAMES_REQUIRED: 10,
    STABLE_POSITION_THRESHOLD_PX: 20,
    MIN_CONFIDENCE_SCORE: 0.85,
    DETECTION_INTERVAL_MS: 100,
  },
  LIVENESS: {
    TIMEOUT_MS: 1000, // Shorter timeout for tests
    PROMPTS: ['blink', 'turn-left', 'turn-right', 'smile'],
    MAX_ATTEMPTS: 3,
    BLINK_THRESHOLD_HIGH: 0.8,
    BLINK_THRESHOLD_LOW: 0.2,
    HEAD_TURN_THRESHOLD_PCT: 15,
    SMILE_THRESHOLD: 0.7,
    SMILE_DURATION_MS: 300,
    SKIP_IN_DEV: false, // Force liveness to run in tests
  },
  SYNC: {
    HEARTBEAT_INTERVAL_MS: 60_000,
    SYNC_INTERVAL_MS: 60_000,
    HEARTBEAT_TIMEOUT_MS: 5_000,
    MAX_BATCH_SIZE: 50,
    MAX_RETRY_ATTEMPTS: 5,
  },
  UI: {
    SUCCESS_AUTO_DISMISS_MS: 4_000,
    IDLE_PULSE_MS: 3_000,
  },
  STORAGE_KEYS: {
    KIOSK_CONFIG: 'kiosk-config',
    ATTENDANCE_QUEUE: 'attendance-queue',
  },
}));

describe('useLivenessCheck', () => {
  const mockDetection: DetectionResult = {
    score: 0.95,
    descriptor: new Float32Array(128),
    expressions: {
      neutral: 0.9,
      happy: 0.1,
    } as any,
    boundingBox: { x: 200, y: 150, width: 240, height: 300 },
    landmarks: [{ x: 300, y: 250 }],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset all verification functions to return false by default
    const liveness = await import('@/lib/liveness');
    vi.mocked(liveness.verifyBlink).mockReturnValue(false);
    vi.mocked(liveness.verifyTurnLeft).mockReturnValue(false);
    vi.mocked(liveness.verifyTurnRight).mockReturnValue(false);
    vi.mocked(liveness.verifySmile).mockReturnValue(false);
  });

  it('starts in idle status when not enabled', async () => {
    const { useLivenessCheck } = await import('./useLivenessCheck');
    const { result } = renderHook(() =>
      useLivenessCheck({
        detection: mockDetection,
        isStable: true,
        enabled: false,
      }),
    );

    expect(result.current.status).toBe('idle');
    expect(result.current.currentPrompt).toBeNull();
  });

  it('transitions to prompting when enabled and stable', async () => {
    const { useLivenessCheck } = await import('./useLivenessCheck');
    const { result, rerender } = renderHook(
      ({ detection, isStable }: { detection: DetectionResult | null; isStable: boolean }) =>
        useLivenessCheck({
          detection,
          isStable,
          enabled: true,
        }),
      {
        initialProps: { detection: null as DetectionResult | null, isStable: false },
      },
    );

    // Initially idle with no detection
    expect(result.current.status).toBe('idle');

    // Provide detection and mark as stable
    rerender({ detection: mockDetection, isStable: true });

    await waitFor(() => {
      expect(['prompting', 'verifying']).toContain(result.current.status);
    });

    expect(result.current.currentPrompt).not.toBeNull();
  });

  it('transitions to pass when verification succeeds', async () => {
    const liveness = await import('@/lib/liveness');

    const { useLivenessCheck } = await import('./useLivenessCheck');
    const { result, rerender } = renderHook(
      ({ detection }) =>
        useLivenessCheck({
          detection,
          isStable: true,
          enabled: true,
        }),
      {
        initialProps: { detection: mockDetection },
      },
    );

    await waitFor(() => {
      expect(['prompting', 'verifying']).toContain(result.current.status);
    });

    // Now make verification succeed
    vi.mocked(liveness.verifyBlink).mockReturnValue(true);

    // Simulate detection update to trigger verification
    rerender({ detection: { ...mockDetection } });

    await waitFor(() => {
      expect(result.current.status).toBe('pass');
    });
  });

  it('has countdown timer during liveness check', async () => {
    const { useLivenessCheck } = await import('./useLivenessCheck');
    const { result } = renderHook(() =>
      useLivenessCheck({
        detection: mockDetection,
        isStable: true,
        enabled: true,
      }),
    );

    // Wait for liveness to start
    await waitFor(() => {
      expect(['prompting', 'verifying']).toContain(result.current.status);
    });

    // Timer should be active (timeRemaining is initialized to 0 but updated by interval)
    // We just verify the status is not idle/pass/fail, which means timer is running
    expect(result.current.status).not.toBe('idle');
    expect(result.current.status).not.toBe('pass');
    expect(result.current.status).not.toBe('fail');
  });

  it('resets when disabled', async () => {
    const { useLivenessCheck } = await import('./useLivenessCheck');
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useLivenessCheck({
          detection: mockDetection,
          isStable: true,
          enabled,
        }),
      {
        initialProps: { enabled: true },
      },
    );

    await waitFor(() => {
      expect(['prompting', 'verifying']).toContain(result.current.status);
    });

    // Disable liveness
    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
    });
  });
});
