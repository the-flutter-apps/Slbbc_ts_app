import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

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

// Mock HTMLCanvasElement for captureFrame tests
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
  transform: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  isPointInPath: vi.fn(),
  isPointInStroke: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  fillText: vi.fn(),
  strokeText: vi.fn(),
}) as any;

HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,');
HTMLCanvasElement.prototype.toBlob = vi.fn();
