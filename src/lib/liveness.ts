/**
 * Liveness verification logic for anti-spoofing.
 *
 * Detects real human actions (blink, head turn, smile) to prevent
 * photo-based spoofing attacks.
 *
 * See `.claude/context/FACE_RECOGNITION.md` for strategy.
 */

import type { DetectionResult } from './faceDetection';
import { LIVENESS } from './constants';

export type LivenessPrompt = (typeof LIVENESS.PROMPTS)[number];

/**
 * Pick a random liveness prompt, optionally excluding one.
 */
export function getRandomPrompt(exclude?: LivenessPrompt): LivenessPrompt {
  const available = exclude
    ? LIVENESS.PROMPTS.filter((p) => p !== exclude)
    : LIVENESS.PROMPTS;

  const index = Math.floor(Math.random() * available.length);
  return available[index] as LivenessPrompt;
}

/**
 * Verify blink: eyesClosed expression must spike high then drop low.
 */
export function verifyBlink(
  current: DetectionResult,
  previous: DetectionResult | null,
): boolean {
  if (!previous) {
    return false;
  }

  const currentEyesClosed = (current.expressions as any).eyesClosed ?? 0;
  const previousEyesClosed = (previous.expressions as any).eyesClosed ?? 0;

  // Blink detected: was high, now low
  if (
    previousEyesClosed >= LIVENESS.BLINK_THRESHOLD_HIGH &&
    currentEyesClosed <= LIVENESS.BLINK_THRESHOLD_LOW
  ) {
    return true;
  }

  return false;
}

/**
 * Calculate center-of-mass of facial landmarks.
 */
function getLandmarkCenter(landmarks: Array<{ x: number; y: number }>): { x: number; y: number } {
  const sum = landmarks.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / landmarks.length,
    y: sum.y / landmarks.length,
  };
}

/**
 * Verify head turn left: landmark center shifted left from baseline.
 */
export function verifyTurnLeft(
  current: DetectionResult,
  baseline: DetectionResult,
): boolean {
  const currentCenter = getLandmarkCenter(current.landmarks);
  const baselineCenter = getLandmarkCenter(baseline.landmarks);

  // Calculate horizontal shift as percentage of bounding box width
  const shift = baselineCenter.x - currentCenter.x;
  const shiftPercent = (shift / baseline.boundingBox.width) * 100;

  return shiftPercent >= LIVENESS.HEAD_TURN_THRESHOLD_PCT;
}

/**
 * Verify head turn right: landmark center shifted right from baseline.
 */
export function verifyTurnRight(
  current: DetectionResult,
  baseline: DetectionResult,
): boolean {
  const currentCenter = getLandmarkCenter(current.landmarks);
  const baselineCenter = getLandmarkCenter(baseline.landmarks);

  // Calculate horizontal shift as percentage of bounding box width
  const shift = currentCenter.x - baselineCenter.x;
  const shiftPercent = (shift / baseline.boundingBox.width) * 100;

  return shiftPercent >= LIVENESS.HEAD_TURN_THRESHOLD_PCT;
}

/**
 * Verify smile: happy expression exceeds threshold.
 */
export function verifySmile(current: DetectionResult): boolean {
  const happy = current.expressions.happy ?? 0;
  return happy >= LIVENESS.SMILE_THRESHOLD;
}
