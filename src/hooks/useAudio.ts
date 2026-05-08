/**
 * React hook for playing Telugu audio prompts.
 *
 * Wraps the singleton AudioPlayer with React lifecycle management.
 * Ensures audio stops on component unmount.
 *
 * Usage:
 *   const { play } = useAudio();
 *   play('checkin-success');
 */

import { useEffect, useRef } from 'react';
import { audio, type AudioPrompt } from '@/lib/audio';

export function useAudio() {
  const isPlayingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isPlayingRef.current) {
        audio.stop();
      }
    };
  }, []);

  const play = (prompt: AudioPrompt) => {
    isPlayingRef.current = true;
    audio.play(prompt).finally(() => {
      isPlayingRef.current = false;
    });
  };

  // Check if audio is supported (server-side rendering guard)
  const isSupported = typeof Audio !== 'undefined';

  return {
    play,
    isSupported,
  };
}
