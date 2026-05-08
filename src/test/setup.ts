import '@testing-library/jest-dom/vitest';

// Mock HTMLAudioElement for audio tests
class MockAudioElement {
  public src = '';
  public volume = 1;
  public preload = '';
  public paused = true;
  public currentTime = 0;
  private playPromise: Promise<void> | null = null;

  constructor(src?: string) {
    if (src) {
      this.src = src;
    }
  }

  play(): Promise<void> {
    this.paused = false;
    this.playPromise = Promise.resolve();
    return this.playPromise;
  }

  pause(): void {
    this.paused = true;
  }

  load(): void {
    // No-op
  }
}

global.Audio = MockAudioElement as any;

// Mock FileReader for blob-to-base64 conversion
class MockFileReader {
  public result: string | ArrayBuffer | null = null;
  public onloadend: (() => void) | null = null;
  public onerror: ((error: Error) => void) | null = null;

  readAsDataURL(blob: Blob): void {
    // Simple mock: convert blob to data URL
    // Use a microtask to simulate async behavior
    Promise.resolve().then(() => {
      // Read blob as text by reading its internal data
      const reader = new Response(blob);
      reader.text().then((text) => {
        this.result = `data:${blob.type};base64,${btoa(text)}`;
        if (this.onloadend) {
          this.onloadend();
        }
      });
    });
  }

  readAsText(blob: Blob): void {
    Promise.resolve().then(() => {
      const reader = new Response(blob);
      reader.text().then((text) => {
        this.result = text;
        if (this.onloadend) {
          this.onloadend();
        }
      });
    });
  }
}

global.FileReader = MockFileReader as any;
