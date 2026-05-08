/**
 * Network status detection and heartbeat.
 *
 * navigator.onLine is unreliable on Android, so we use periodic heartbeats
 * to detect true connectivity.
 *
 * See `.claude/context/OFFLINE_STRATEGY.md` for design.
 */

import { heartbeat } from './api';
import { SYNC } from './constants';
import { useKioskStore } from '@/store/kioskStore';
import { getPendingCount } from './queue';
import { startSyncScheduler, stopSyncScheduler, triggerManualSync } from './sync';

let heartbeatIntervalId: number | null = null;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Perform a single heartbeat check.
 * Returns true if online, false if offline.
 */
async function performHeartbeat(): Promise<boolean> {
  try {
    const pendingCount = await getPendingCount();

    await heartbeat({
      online: true,
      queuedRecords: pendingCount,
      lastSyncAt: useKioskStore.getState().lastSyncAt?.toISOString() || null,
      appVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
    });

    consecutiveFailures = 0;
    return true;
  } catch (error) {
    consecutiveFailures++;
    console.warn(`[Network] Heartbeat failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error);
    return false;
  }
}

/**
 * Start heartbeat monitoring.
 */
export function startHeartbeat(): void {
  if (heartbeatIntervalId !== null) {
    return; // Already running
  }

  console.log('[Network] Starting heartbeat monitor');

  // Initial heartbeat
  performHeartbeat().then((online) => {
    useKioskStore.getState().setOnline(online);
    if (online) {
      startSyncScheduler();
    }
  });

  // Periodic heartbeat
  heartbeatIntervalId = window.setInterval(async () => {
    const wasOnline = useKioskStore.getState().online;
    const isOnline = await performHeartbeat();

    // Detect online status change
    if (isOnline !== wasOnline) {
      console.log(`[Network] Status changed: ${wasOnline ? 'online' : 'offline'} → ${isOnline ? 'online' : 'offline'}`);
      useKioskStore.getState().setOnline(isOnline);

      if (isOnline && !wasOnline) {
        // Just came back online → trigger immediate sync
        console.log('[Network] Back online, triggering sync');
        startSyncScheduler();
        triggerManualSync().catch((err) => {
          console.error('[Network] Failed to sync on reconnect:', err);
        });
      } else if (!isOnline && wasOnline) {
        // Just went offline → stop sync scheduler
        console.log('[Network] Went offline, stopping sync scheduler');
        stopSyncScheduler();
      }
    }

    // Mark offline after 2 consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && wasOnline) {
      console.warn('[Network] Multiple heartbeat failures, marking offline');
      useKioskStore.getState().setOnline(false);
      stopSyncScheduler();
    }
  }, SYNC.HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat monitoring.
 */
export function stopHeartbeat(): void {
  if (heartbeatIntervalId !== null) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
    consecutiveFailures = 0;
    console.log('[Network] Stopped heartbeat monitor');
  }
}

/**
 * Listen to browser online/offline events (supplementary to heartbeat).
 */
export function setupNetworkListeners(): void {
  window.addEventListener('online', () => {
    console.log('[Network] Browser reports online');
    // Trigger heartbeat to confirm
    performHeartbeat().then((online) => {
      if (online) {
        useKioskStore.getState().setOnline(true);
        startSyncScheduler();
        triggerManualSync();
      }
    });
  });

  window.addEventListener('offline', () => {
    console.log('[Network] Browser reports offline');
    useKioskStore.getState().setOnline(false);
    stopSyncScheduler();
  });
}
