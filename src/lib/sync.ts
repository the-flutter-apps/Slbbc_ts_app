/**
 * Sync worker: pushes queued attendance records to backend.
 *
 * Triggered by:
 * - Network status change (offline → online)
 * - Every 60s when online
 * - Manual sync request
 *
 * See `.claude/context/OFFLINE_STRATEGY.md` for design.
 */

import {
  getPendingRecords,
  markRecordInProgress,
  markRecordSynced,
  markRecordFailed,
} from './queue';
import { syncBatch } from './api';
import { SYNC } from './constants';

/**
 * Convert Blob to base64 data URL.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sync pending attendance records to backend.
 * Returns number of records successfully synced.
 */
export async function syncQueue(): Promise<number> {
  const pending = await getPendingRecords(SYNC.MAX_BATCH_SIZE);

  if (pending.length === 0) {
    return 0;
  }

  console.log(`[Sync] Starting sync of ${pending.length} pending records`);

  // Mark all as IN_PROGRESS
  await Promise.all(pending.map((r) => markRecordInProgress(r.clientGeneratedId)));

  try {
    // Convert records to API format
    const records = await Promise.all(
      pending.map(async (r) => ({
        clientGeneratedId: r.clientGeneratedId,
        photoBase64: await blobToBase64(r.photoBlob),
        capturedAt: r.capturedAt,
        captureMethod: r.captureMethod,
        matchedEmployeeId: r.matchedEmployeeId,
        pin: r.pin,
      })),
    );

    // Call batch sync API
    const result = await syncBatch(records);

    let syncedCount = 0;

    // Process each result
    for (const res of result.results) {
      if (res.status === 'SYNCED' || res.status === 'DUPLICATE') {
        await markRecordSynced(res.clientGeneratedId);
        syncedCount++;
        console.log(`[Sync] ✓ ${res.clientGeneratedId}: ${res.status}`);
      } else if (res.status === 'FAILED') {
        await markRecordFailed(res.clientGeneratedId, res.reason || 'Unknown error');
        console.warn(`[Sync] ✗ ${res.clientGeneratedId}: ${res.reason}`);
      }
    }

    console.log(`[Sync] Completed: ${syncedCount}/${pending.length} synced successfully`);
    return syncedCount;
  } catch (error) {
    // Rollback all IN_PROGRESS to PENDING on error
    console.error('[Sync] Batch sync failed, rolling back:', error);

    await Promise.all(
      pending.map(async (r) => {
        // Reset to PENDING (without incrementing attempts - network error, not record error)
        const { getDb } = await import('./db');
        const db = await getDb();
        const record = await db.get('attendance-queue', r.clientGeneratedId);
        if (record && record.syncStatus === 'IN_PROGRESS') {
          record.syncStatus = 'PENDING';
          await db.put('attendance-queue', record);
        }
      }),
    );

    throw error;
  }
}

/**
 * Sync scheduler state.
 */
let syncIntervalId: number | null = null;
let isSyncing = false;

/**
 * Start auto-sync timer (runs every 60s when online).
 */
export function startSyncScheduler(): void {
  if (syncIntervalId !== null) {
    return; // Already running
  }

  console.log('[Sync] Starting sync scheduler');

  syncIntervalId = window.setInterval(async () => {
    if (isSyncing) {
      console.log('[Sync] Skipping sync (already in progress)');
      return;
    }

    try {
      isSyncing = true;
      await syncQueue();

      // Refresh store count after sync
      const { useKioskStore } = await import('@/store/kioskStore');
      await useKioskStore.getState().refreshPendingCount();
    } catch (error) {
      console.error('[Sync] Auto-sync failed:', error);
    } finally {
      isSyncing = false;
    }
  }, SYNC.SYNC_INTERVAL_MS);
}

/**
 * Stop auto-sync timer.
 */
export function stopSyncScheduler(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[Sync] Stopped sync scheduler');
  }
}

/**
 * Manual sync trigger (for dev/admin use).
 */
export async function triggerManualSync(): Promise<number> {
  if (isSyncing) {
    console.warn('[Sync] Sync already in progress');
    return 0;
  }

  try {
    isSyncing = true;
    const count = await syncQueue();

    // Refresh store count
    const { useKioskStore } = await import('@/store/kioskStore');
    await useKioskStore.getState().refreshPendingCount();

    return count;
  } finally {
    isSyncing = false;
  }
}
