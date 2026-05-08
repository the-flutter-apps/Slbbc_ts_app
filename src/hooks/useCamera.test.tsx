import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCamera } from './useCamera';

/**
 * Note: This hook relies on videoRef being attached to an actual <video> element in the DOM
 * to function properly. Full lifecycle testing (camera access, error handling, etc.) is better
 * suited to component-level tests where we render the actual CapturePage component.
 *
 * These tests verify the hook's basic structure and that the capture function guards
 * against being called when not streaming.
 */
describe('useCamera', () => {
  it('returns expected interface with videoRef, status, error, and capture', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current).toHaveProperty('videoRef');
    expect(result.current).toHaveProperty('status');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('capture');
    expect(typeof result.current.capture).toBe('function');
  });

  it('starts with idle status and null error', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  it('videoRef is initially null', () => {
    const { result } = renderHook(() => useCamera());

    expect(result.current.videoRef.current).toBeNull();
  });

  it('capture returns null when status is not streaming', () => {
    const { result } = renderHook(() => useCamera());

    // Status is 'idle', so capture should return null
    const frame = result.current.capture();
    expect(frame).toBeNull();
  });
});
