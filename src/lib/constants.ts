/**
 * Application-wide constants. Avoid magic strings/numbers elsewhere.
 */

export const APP_VERSION = '0.1.0';

export const FACE_DETECTION = {
  MIN_DETECTION_SCORE: 0.7,
  ONLINE_AUTO_ACCEPT_CONFIDENCE: 0.85,
  ONLINE_CONFIRM_CONFIDENCE: 0.7,
  OFFLINE_HIGH_CONFIDENCE_DISTANCE: 0.5,
  OFFLINE_MEDIUM_CONFIDENCE_DISTANCE: 0.6,
  MAX_RETRY_ATTEMPTS: 3,
  DETECTION_INTERVAL_MS: 100, // ~10fps
  STABILITY_WINDOW_SIZE: 10,
  STABILITY_THRESHOLD: 8,
  AUTO_CAPTURE_AFTER_STABLE_MS: 2000,
  CROP_PADDING_PX: 20,
  CAPTURE_JPEG_QUALITY: 0.85,
} as const;

export const LIVENESS = {
  TIMEOUT_MS: 5000,
  PROMPTS: ['blink', 'turn-left', 'turn-right', 'smile'] as const,
  MAX_ATTEMPTS: 3,
  BLINK_THRESHOLD_HIGH: 0.8,
  BLINK_THRESHOLD_LOW: 0.2,
  HEAD_TURN_THRESHOLD_PCT: 15, // Percent of bounding box width
  SMILE_THRESHOLD: 0.7,
  SMILE_DURATION_MS: 300,
  SKIP_IN_DEV: true, // Auto-pass in development mode
} as const;

export const SYNC = {
  HEARTBEAT_INTERVAL_MS: 60_000,
  SYNC_INTERVAL_MS: 60_000,
  HEARTBEAT_TIMEOUT_MS: 5_000,
  MAX_BATCH_SIZE: 50,
  MAX_RETRY_ATTEMPTS: 5,
} as const;

export const UI = {
  SUCCESS_AUTO_DISMISS_MS: 4_000,
  IDLE_PULSE_MS: 3_000,
} as const;

export const STORAGE_KEYS = {
  KIOSK_CONFIG: 'kiosk-config',
  ATTENDANCE_QUEUE: 'attendance-queue',
  EMPLOYEE_DESCRIPTORS: 'employee-descriptors',
} as const;

export const AUDIO = {
  DEFAULT_VOLUME: 0.8,
  IDLE_WELCOME_ENABLED: false, // Disable by default (quiet hours)
} as const;

export const PWA = {
  VERSION: '1.0.0', // Bump on each release
  CACHE_NAME: 'slbbc-kiosk-v1',
  UPDATE_CHECK_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  IDLE_RELOAD_DELAY_MS: 5000, // 5s idle before auto-reload on SW update
} as const;
