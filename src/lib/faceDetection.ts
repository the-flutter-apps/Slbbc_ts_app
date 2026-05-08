/**
 * Camera + face detection orchestration.
 *
 * See `.claude/context/FACE_RECOGNITION.md` for full strategy.
 */

import * as faceapi from 'face-api.js';
import { FACE_DETECTION } from './constants';

export async function startCamera(videoEl: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera not supported in this browser');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
        frameRate: { ideal: 24 },
      },
      audio: false,
    });

    videoEl.srcObject = stream;
    await videoEl.play();

    return stream;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Camera permission denied');
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera found');
      }
      throw new Error(`Camera error: ${error.message}`);
    }
    throw error;
  }
}

export function stopCamera(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }
}

let modelsLoaded = false;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) {
    console.log('[faceapi] Models already loaded');
    return;
  }

  const startTime = Date.now();
  console.log('[faceapi] Loading models from /models...');

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    ]);

    modelsLoaded = true;
    const elapsed = Date.now() - startTime;
    console.log(`[faceapi] ✓ All models loaded in ${elapsed}ms`);
  } catch (error) {
    console.error('[faceapi] Failed to load models:', error);
    throw new Error(
      'Face detection models missing. Run: pnpm models:download\n' +
      'Then reload the page.',
    );
  }
}

export interface DetectionResult {
  score: number;
  descriptor: Float32Array;
  expressions: faceapi.FaceExpressions;
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks: Array<{ x: number; y: number }>;
}

export async function detectFace(videoEl: HTMLVideoElement): Promise<DetectionResult | null> {
  try {
    const detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()
      .withFaceExpressions();

    if (!detection) {
      return null;
    }

    // Filter by minimum score
    if (detection.detection.score < FACE_DETECTION.MIN_DETECTION_SCORE) {
      return null;
    }

    // Map to our DetectionResult interface
    return {
      score: detection.detection.score,
      descriptor: detection.descriptor,
      expressions: detection.expressions,
      boundingBox: {
        x: detection.detection.box.x,
        y: detection.detection.box.y,
        width: detection.detection.box.width,
        height: detection.detection.box.height,
      },
      landmarks: detection.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    };
  } catch (error) {
    console.error('[detectFace] Detection error:', error);
    return null;
  }
}

export function captureFrame(
  videoEl: HTMLVideoElement,
  boundingBox?: { x: number; y: number; width: number; height: number },
): { dataUrl: string; blob: Blob } {
  // Check if video has valid dimensions
  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    throw new Error('Video dimensions not available - video may not be ready');
  }

  const canvas = document.createElement('canvas');

  if (boundingBox) {
    // Crop to face region with padding
    const padding = FACE_DETECTION.CROP_PADDING_PX;
    const x = Math.max(0, boundingBox.x - padding);
    const y = Math.max(0, boundingBox.y - padding);
    const width = Math.min(
      videoEl.videoWidth - x,
      boundingBox.width + padding * 2,
    );
    const height = Math.min(
      videoEl.videoHeight - y,
      boundingBox.height + padding * 2,
    );

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw cropped region
    ctx.drawImage(videoEl, x, y, width, height, 0, 0, width, height);

    console.log('[captureFrame] Cropped to face:', width, 'x', height);
  } else {
    // Full frame capture
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    console.log('[captureFrame] Full frame:', canvas.width, 'x', canvas.height);
  }

  const dataUrl = canvas.toDataURL('image/jpeg', FACE_DETECTION.CAPTURE_JPEG_QUALITY);

  // toBlob is async but we need sync return - use dataURLtoBlob helper
  const blob = dataURLtoBlob(dataUrl);

  console.log('[captureFrame] Captured:', blob.size, 'bytes');

  return { dataUrl, blob };
}

function dataURLtoBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const contentType = parts[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const base64 = parts[1] || '';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: contentType });
}
