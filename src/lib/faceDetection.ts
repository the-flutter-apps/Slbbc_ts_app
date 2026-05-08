/**
 * Camera + face detection orchestration.
 *
 * See `.claude/context/FACE_RECOGNITION.md` for full strategy.
 *
 * TODO:
 *   - Wrap getUserMedia with proper error handling
 *   - Load face-api.js models from /models on first init
 *   - Provide detect() that returns face + descriptor + expressions
 *   - Provide capture() that returns JPEG dataUrl + Blob
 */

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

export async function loadFaceApiModels(): Promise<void> {
  // TODO: faceapi.nets.tinyFaceDetector.loadFromUri('/models'), etc.
}

export interface DetectionResult {
  score: number;
  descriptor: Float32Array;
  expressions: Record<string, number>;
  // Add bounding box, landmarks as needed
}

export async function detectFace(_videoEl: HTMLVideoElement): Promise<DetectionResult | null> {
  // TODO
  return null;
}

export function captureFrame(videoEl: HTMLVideoElement): { dataUrl: string; blob: Blob } {
  // Check if video has valid dimensions
  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    throw new Error('Video dimensions not available - video may not be ready');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  console.log('[captureFrame] Canvas size:', canvas.width, 'x', canvas.height);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

  // toBlob is async but we need sync return - use dataURLtoBlob helper
  const blob = dataURLtoBlob(dataUrl);

  console.log('[captureFrame] Captured frame:', blob.size, 'bytes');

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
