/**
 * Offline face matching using face-api.js descriptors.
 *
 * Fallback when backend is unreachable. Compares captured descriptor
 * against cached employee descriptors using Euclidean distance.
 */

import * as faceapi from 'face-api.js';
import { getDescriptors } from './descriptors';

export interface OfflineMatchResult {
  employeeId: string | null;
  employeeName: string | null;
  confidence: number; // 0.0 - 1.0 (inverse of distance, for consistency with API)
  distance: number; // Raw Euclidean distance
}

const DISTANCE_THRESHOLD_HIGH = 0.5; // < 0.5 = high confidence
const DISTANCE_THRESHOLD_MEDIUM = 0.6; // < 0.6 = medium confidence

/**
 * Match a captured face descriptor against cached employee descriptors.
 */
export async function matchOffline(
  capturedDescriptor: Float32Array,
): Promise<OfflineMatchResult> {
  console.log('[OfflineMatch] Starting offline face matching...');

  // Get cached descriptors
  const cache = await getDescriptors();

  if (!cache || cache.employees.length === 0) {
    console.warn('[OfflineMatch] No cached descriptors available');
    return {
      employeeId: null,
      employeeName: null,
      confidence: 0,
      distance: Infinity,
    };
  }

  console.log(`[OfflineMatch] Comparing against ${cache.employees.length} cached employees`);

  // Find best match using Euclidean distance
  let bestMatch = {
    employeeId: null as string | null,
    employeeName: null as string | null,
    distance: Infinity,
  };

  for (const employee of cache.employees) {
    for (const descriptor of employee.descriptors) {
      const distance = faceapi.euclideanDistance(capturedDescriptor, descriptor);

      if (distance < bestMatch.distance) {
        bestMatch = {
          employeeId: employee.id,
          employeeName: employee.fullName,
          distance,
        };
      }
    }
  }

  // Convert distance to confidence score (inverse relationship)
  // distance 0.0 → confidence 1.0
  // distance 1.0 → confidence 0.0
  const confidence = Math.max(0, 1 - bestMatch.distance);

  const result: OfflineMatchResult = {
    employeeId: bestMatch.employeeId,
    employeeName: bestMatch.employeeName,
    confidence,
    distance: bestMatch.distance,
  };

  // Log result with confidence level
  if (result.distance < DISTANCE_THRESHOLD_HIGH) {
    console.log(
      `[OfflineMatch] HIGH confidence match: ${result.employeeName} (distance: ${result.distance.toFixed(3)}, confidence: ${confidence.toFixed(3)})`,
    );
  } else if (result.distance < DISTANCE_THRESHOLD_MEDIUM) {
    console.log(
      `[OfflineMatch] MEDIUM confidence match: ${result.employeeName} (distance: ${result.distance.toFixed(3)}, confidence: ${confidence.toFixed(3)})`,
    );
  } else {
    console.log(
      `[OfflineMatch] LOW confidence - no reliable match (best distance: ${result.distance.toFixed(3)}, confidence: ${confidence.toFixed(3)})`,
    );
    return {
      employeeId: null,
      employeeName: null,
      confidence: 0,
      distance: result.distance,
    };
  }

  return result;
}

/**
 * Check if offline match confidence is acceptable for auto-accept.
 */
export function isOfflineMatchAcceptable(result: OfflineMatchResult): boolean {
  // Only accept high confidence matches (distance < 0.5)
  return result.distance < DISTANCE_THRESHOLD_HIGH;
}

/**
 * Get confidence level description.
 */
export function getConfidenceLevel(
  result: OfflineMatchResult,
): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
  if (result.distance < DISTANCE_THRESHOLD_HIGH) return 'HIGH';
  if (result.distance < DISTANCE_THRESHOLD_MEDIUM) return 'MEDIUM';
  if (result.employeeId) return 'LOW';
  return 'NONE';
}
