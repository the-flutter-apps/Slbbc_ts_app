/**
 * Offline attendance queue, backed by IndexedDB.
 *
 * See `.claude/context/OFFLINE_STRATEGY.md` for full design.
 *
 * All write operations refresh the pending count in the kiosk store
 * so the UI updates immediately.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import type { QueuedAttendance } from '@/types';

/**
 * Enqueue a new attendance record for sync.
 * Auto-generates clientGeneratedId and sets default sync metadata.
 */
export async function enqueueAttendance(
  record: Omit<
    QueuedAttendance,
    'clientGeneratedId' | 'syncStatus' | 'syncAttempts' | 'lastError'
  > & {
    clientGeneratedId?: string;
  },
): Promise<void> {
  const db = await getDb();

  const fullRecord: QueuedAttendance = {
    clientGeneratedId: record.clientGeneratedId ?? uuidv4(),
    capturedAt: record.capturedAt,
    captureMethod: record.captureMethod,
    photoBlob: record.photoBlob,
    matchedEmployeeId: record.matchedEmployeeId,
    pin: record.pin, // TODO: encrypt PIN before storing
    syncStatus: 'PENDING',
    syncAttempts: 0,
    lastError: null,
  };

  await db.put('attendance-queue', fullRecord);
}

/**
 * Get all pending records (PENDING status only), sorted oldest-first.
 */
export async function getPendingRecords(limit?: number): Promise<QueuedAttendance[]> {
  const db = await getDb();

  let cursor = await db
    .transaction('attendance-queue', 'readonly')
    .objectStore('attendance-queue')
    .index('syncStatus')
    .openCursor(IDBKeyRange.only('PENDING'));

  const results: QueuedAttendance[] = [];

  while (cursor) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  // Sort by capturedAt ascending (oldest first - FIFO)
  results.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  // Apply limit if provided
  return limit ? results.slice(0, limit) : results;
}

/**
 * Get total queue depth (all records, regardless of status).
 */
export async function getQueueDepth(): Promise<number> {
  const db = await getDb();
  return db.count('attendance-queue');
}

/**
 * Get count of pending records only.
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDb();
  return db.countFromIndex('attendance-queue', 'syncStatus', 'PENDING');
}

/**
 * Mark a record as in-progress (during sync).
 */
export async function markRecordInProgress(clientGeneratedId: string): Promise<void> {
  const db = await getDb();
  const record = await db.get('attendance-queue', clientGeneratedId);

  if (!record) {
    throw new Error(`Record not found: ${clientGeneratedId}`);
  }

  record.syncStatus = 'IN_PROGRESS';
  await db.put('attendance-queue', record);
}

/**
 * Mark a record as successfully synced — deletes it from the queue.
 */
export async function markRecordSynced(clientGeneratedId: string): Promise<void> {
  const db = await getDb();
  await db.delete('attendance-queue', clientGeneratedId);
}

/**
 * Mark a record as failed, increment attempts, record error reason.
 */
export async function markRecordFailed(
  clientGeneratedId: string,
  reason: string,
): Promise<void> {
  const db = await getDb();
  const record = await db.get('attendance-queue', clientGeneratedId);

  if (!record) {
    throw new Error(`Record not found: ${clientGeneratedId}`);
  }

  record.syncStatus = 'FAILED';
  record.syncAttempts += 1;
  record.lastError = reason;

  await db.put('attendance-queue', record);
}

/**
 * Roll back all IN_PROGRESS records to PENDING.
 * Called on app startup to handle crash/reload during sync.
 */
export async function rollbackInProgress(): Promise<void> {
  const db = await getDb();

  let cursor = await db
    .transaction('attendance-queue', 'readwrite')
    .objectStore('attendance-queue')
    .index('syncStatus')
    .openCursor(IDBKeyRange.only('IN_PROGRESS'));

  while (cursor) {
    const record = cursor.value;
    record.syncStatus = 'PENDING';
    await cursor.update(record);
    cursor = await cursor.continue();
  }
}

/**
 * Delete old FAILED records (already-synced records are deleted on sync success).
 * Returns count of deleted records.
 */
export async function pruneOldRecords(olderThanDays: number): Promise<number> {
  const db = await getDb();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffISO = cutoffDate.toISOString();

  const tx = db.transaction('attendance-queue', 'readwrite');
  const store = tx.objectStore('attendance-queue');

  let cursor = await store.index('syncStatus').openCursor(IDBKeyRange.only('FAILED'));

  let deletedCount = 0;

  while (cursor) {
    const record = cursor.value;
    if (record.capturedAt < cutoffISO) {
      await cursor.delete();
      deletedCount++;
    }
    cursor = await cursor.continue();
  }

  await tx.done;

  return deletedCount;
}
