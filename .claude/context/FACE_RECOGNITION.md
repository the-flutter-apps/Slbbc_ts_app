# Face Recognition Integration

> Load this when working on camera, face detection, liveness, or matching code.

Two-tier strategy: **CompreFace API for online (high accuracy), face-api.js for offline (acceptable accuracy).**

## CompreFace (Online, Primary)

Self-hosted on backend infrastructure (separate VPS or same as backend, in Docker).

**Why CompreFace**: Free, open source, 99%+ accuracy, anti-spoofing built in, simple REST API.

The kiosk does NOT call CompreFace directly. It calls the backend, which calls CompreFace with a service-level API key. This keeps CompreFace credentials out of the client.

## face-api.js (Offline + On-device Detection)

Pre-trained TensorFlow.js models running in the browser.

Models needed (place in `public/models/`):
- `tiny_face_detector_model-weights_manifest.json` + shards (smaller, faster)
- `face_landmark_68_model-weights_manifest.json` + shards
- `face_recognition_model-weights_manifest.json` + shards
- `face_expression_model-weights_manifest.json` + shards (for liveness)

Total size: ~6MB. Cached by service worker after first load.

Download from: https://github.com/justadudewhohacks/face-api.js-models

## Camera Setup

```ts
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: 'user',          // Front camera
    width: { ideal: 640 },        // Don't request 4K — wastes CPU
    height: { ideal: 480 },
    frameRate: { ideal: 24 }
  },
  audio: false
});
```

**Permission handling**: First time, browser asks for camera permission. Fully Kiosk Browser can be configured to auto-grant. In dev, manually grant on first run.

## Detection Loop

```ts
// Run at ~10fps (not 24 — that's too aggressive for tablets)
setInterval(async () => {
  const detections = await faceapi
    .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .withFaceExpressions();
  
  if (!detections) {
    setStatus('searching');
    return;
  }
  
  if (detections.detection.score < 0.7) {
    setStatus('low-quality');
    return;
  }
  
  // Face detected with good quality
  // Check liveness, then capture
}, 100);
```

## Liveness Check

Anti-spoofing prevents employees holding up a photo of a coworker.

**Strategy**: Random prompt + verify motion within 3 seconds.

Prompts (rotate randomly):
1. **Blink** — track `eyesClosed` expression briefly hitting >0.8 then back to <0.2
2. **Turn head left** — track face landmarks moving left of frame center
3. **Turn head right** — same logic, opposite direction
4. **Smile** — track `happy` expression > 0.7

Audio prompt plays in Telugu. Visual prompt also shown (icon + animation).

**Failure mode**: 3 failed liveness attempts → fallback to PIN (assume photo spoofing attempt or just bad camera).

## Frame Capture

Once detection + liveness pass:

```ts
const canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 480;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(videoElement, 0, 0, 640, 480);

// Crop to face region with padding
const face = detections.detection.box;
const cropPadding = 20;
const cropped = cropCanvas(canvas, face, cropPadding);

// Convert to JPEG at moderate quality (smaller payload)
const dataUrl = cropped.toDataURL('image/jpeg', 0.85);
```

Send `dataUrl` to backend. Also store as `Blob` in IndexedDB for offline queue.

## Offline Match Algorithm

```ts
import * as faceapi from 'face-api.js';

async function matchOffline(capturedDescriptor: Float32Array) {
  const cached = await db.getAllEmployeeDescriptors();
  
  let best = { employeeId: null, distance: Infinity };
  
  for (const emp of cached) {
    for (const desc of emp.descriptors) {
      const distance = faceapi.euclideanDistance(capturedDescriptor, desc);
      if (distance < best.distance) {
        best = { employeeId: emp.id, distance };
      }
    }
  }
  
  // Thresholds
  if (best.distance < 0.5) return { ...best, confidence: 'HIGH' };
  if (best.distance < 0.6) return { ...best, confidence: 'MEDIUM' };
  return { employeeId: null, distance: best.distance, confidence: 'NONE' };
}
```

## Confidence Thresholds (Online — CompreFace)

| Score | Action |
|---|---|
| ≥ 0.85 | Auto-accept, record check-in/out |
| 0.70 - 0.85 | Show "Is this you?" with employee name + photo, require single tap to confirm |
| < 0.70 | Reject, retry (up to 3x), then fallback to PIN |

## Enrollment (Admin Flow)

When onboarding a new employee, capture 5 reference photos:
- Straight, neutral expression
- Slight left turn
- Slight right turn
- Looking up
- Smiling

Send all 5 to CompreFace `/api/v1/recognition/faces` with `subject={employee_id}`. CompreFace stores embeddings.

For offline, also extract face-api.js descriptors from each photo and store in employee-descriptors object store.

## Common Issues & Mitigations

| Issue | Mitigation |
|---|---|
| Glasses reflection | Capture from slight angle in enrollment photos |
| Beard/mustache changes | Re-enroll quarterly |
| Poor lighting in boiler room | Add ring light to kiosk; lower confidence threshold not advised |
| Sweaty/oily faces | Wipe camera lens weekly (training schedule for site supervisor) |
| Twins/siblings | Rare in workforce, but PIN fallback handles |
| Aging/weight change | Re-enrollment process for affected employees |

## Testing

Use your own face for development. For variety, use Unsplash portrait images (printed photos) to test anti-spoofing — liveness should reject them.
