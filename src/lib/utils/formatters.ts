/**
 * Formatting utilities for dates, times, and display strings.
 */

import type { Designation } from '@/types';

/**
 * Format ISO 8601 timestamp to 12-hour time with AM/PM.
 * Example: "2026-05-05T15:45:00Z" → "3:45 PM"
 */
export function formatTime12Hour(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format designation enum to human-readable string.
 * Example: "BOILER_OPERATOR" → "Boiler Operator"
 */
export function formatDesignation(designation: Designation): string {
  return designation
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
