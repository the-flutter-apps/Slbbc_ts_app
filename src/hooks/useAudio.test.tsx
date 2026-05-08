import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAudio } from './useAudio';
import * as audioModule from '@/lib/audio';

vi.mock('@/lib/audio', () => ({
  audio: {
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
  },
}));

describe('useAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without error', () => {
    const { result } = renderHook(() => useAudio());

    expect(result.current.play).toBeDefined();
    expect(result.current.isSupported).toBe(true);
  });

  it('calls audio.play with correct prompt', () => {
    const { result } = renderHook(() => useAudio());

    result.current.play('checkin-success');

    expect(audioModule.audio.play).toHaveBeenCalledWith('checkin-success');
  });

  it('calls audio.stop on unmount', () => {
    const { result, unmount } = renderHook(() => useAudio());

    // Start playing
    result.current.play('welcome');

    // Unmount
    unmount();

    expect(audioModule.audio.stop).toHaveBeenCalled();
  });

  it('isSupported is true when Audio is available', () => {
    const { result } = renderHook(() => useAudio());

    expect(result.current.isSupported).toBe(true);
  });
});
