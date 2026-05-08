/**
 * Telugu audio prompt player.
 *
 * See `.claude/context/AUDIO_PROMPTS.md` for full inventory.
 *
 * Usage:
 *   await audio.play('look-at-camera');
 *   audio.setVolume(0.8);
 *   audio.stop();
 */

import { AUDIO } from './constants';

export type AudioPrompt =
  | 'welcome'
  | 'look-at-camera'
  | 'blink'
  | 'turn-left'
  | 'turn-right'
  | 'smile'
  | 'checkin-success'
  | 'checkout-success'
  | 'try-again'
  | 'use-pin'
  | 'pin-success'
  | 'pin-wrong'
  | 'offline'
  | 'error';

class AudioPlayer {
  private current: HTMLAudioElement | null = null;
  private volume: number = AUDIO.DEFAULT_VOLUME;
  private primed: boolean = false;

  async play(prompt: AudioPrompt): Promise<void> {
    this.stop();

    try {
      this.current = new Audio(`/audio/${prompt}.mp3`);
      this.current.preload = 'auto';
      this.current.volume = this.volume;

      await this.current.play();

      // Mark as primed after first successful play
      if (!this.primed) {
        this.primed = true;
      }
    } catch (e) {
      // Handle different error types
      if (e instanceof Error) {
        // 404: File not found (dev mode, files not generated yet)
        if (e.message.includes('404') || e.message.includes('Not Found')) {
          console.warn(`[Audio] File not found: ${prompt}.mp3 (run 'pnpm audio:generate')`);
          return;
        }

        // Autoplay blocked: Browser requires user interaction first
        if (e.name === 'NotAllowedError' || e.message.includes('play')) {
          console.warn(`[Audio] Playback blocked for "${prompt}" (requires user interaction)`);
          return;
        }
      }

      // Other errors: log but don't crash
      console.error(`[Audio] Failed to play "${prompt}":`, e);
    }
  }

  stop(): void {
    if (this.current) {
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
  }

  setVolume(level: number): void {
    // Clamp to 0.0-1.0
    this.volume = Math.max(0, Math.min(1, level));
    if (this.current) {
      this.current.volume = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  isPrimed(): boolean {
    return this.primed;
  }

  isPlaying(): boolean {
    return this.current !== null && !this.current.paused;
  }
}

export const audio = new AudioPlayer();
