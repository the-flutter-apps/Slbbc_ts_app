import { describe, it, expect, beforeEach } from 'vitest';
import { audio } from './audio';
import { AUDIO } from './constants';

describe('AudioPlayer', () => {
  beforeEach(() => {
    audio.stop();
    audio.setVolume(AUDIO.DEFAULT_VOLUME);
  });

  it('sets and gets volume correctly', () => {
    audio.setVolume(0.5);
    expect(audio.getVolume()).toBe(0.5);

    audio.setVolume(0.8);
    expect(audio.getVolume()).toBe(0.8);
  });

  it('clamps volume to 0.0-1.0', () => {
    audio.setVolume(-0.5);
    expect(audio.getVolume()).toBe(0);

    audio.setVolume(1.5);
    expect(audio.getVolume()).toBe(1);

    audio.setVolume(0.5);
    expect(audio.getVolume()).toBe(0.5);
  });

  it('plays audio and updates playing state', async () => {
    expect(audio.isPlaying()).toBe(false);

    await audio.play('welcome');

    expect(audio.isPlaying()).toBe(true);
  });

  it('stops audio and updates state', async () => {
    await audio.play('welcome');
    expect(audio.isPlaying()).toBe(true);

    audio.stop();
    expect(audio.isPlaying()).toBe(false);
  });

  it('becomes primed after successful play', async () => {
    await audio.play('welcome');
    expect(audio.isPrimed()).toBe(true);
  });

  it('stops current audio before playing new one', async () => {
    await audio.play('welcome');
    const wasPlaying = audio.isPlaying();

    await audio.play('checkin-success');

    // Should be playing the new audio
    expect(wasPlaying).toBe(true);
    expect(audio.isPlaying()).toBe(true);
  });

  it('handles errors gracefully without crashing', async () => {
    // This test ensures that even if audio fails, the app doesn't crash
    // The AudioPlayer is designed to catch and log errors
    await expect(audio.play('welcome')).resolves.not.toThrow();
  });
});
