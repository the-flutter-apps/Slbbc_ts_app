import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  enqueueAttendance,
  getPendingRecords,
  getQueueDepth,
  getPendingCount,
  markRecordInProgress,
  markRecordSynced,
  markRecordFailed,
  rollbackInProgress,
  pruneOldRecords,
} from './queue';
import { resetDb } from './db';
import type { QueuedAttendance } from '@/types';

describe('Queue (IndexedDB)', () => {
  beforeEach(async () => {
    // Reset fake IndexedDB
    global.indexedDB = new IDBFactory();
    resetDb();

    // Delete existing database
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('slbbc-kiosk-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  });

  const createMockRecord = (
    overrides: Partial<
      Omit<QueuedAttendance, 'syncStatus' | 'syncAttempts' | 'lastError'>
    > = {},
  ) => ({
    capturedAt: new Date().toISOString(),
    captureMethod: 'PIN' as const,
    photoBlob: new Blob(['test'], { type: 'image/jpeg' }),
    matchedEmployeeId: 'emp-001',
    pin: '1234',
    ...overrides,
  });

  it('enqueues a record with auto-generated UUID', async () => {
    const record = createMockRecord();
    await enqueueAttendance(record);

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.clientGeneratedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('enqueues a record with provided clientGeneratedId', async () => {
    const record = createMockRecord({ clientGeneratedId: 'custom-id-123' });
    await enqueueAttendance(record);

    const pending = await getPendingRecords();
    expect(pending[0]?.clientGeneratedId).toBe('custom-id-123');
  });

  it('sets default syncStatus, syncAttempts, and lastError', async () => {
    const record = createMockRecord();
    await enqueueAttendance(record);

    const pending = await getPendingRecords();
    expect(pending[0]?.syncStatus).toBe('PENDING');
    expect(pending[0]?.syncAttempts).toBe(0);
    expect(pending[0]?.lastError).toBeNull();
  });

  it('getQueueDepth returns total count (all statuses)', async () => {
    await enqueueAttendance(createMockRecord());
    await enqueueAttendance(createMockRecord());

    const depth = await getQueueDepth();
    expect(depth).toBe(2);
  });

  it('getPendingCount returns only PENDING count', async () => {
    const record1 = createMockRecord({ clientGeneratedId: 'rec-1' });
    const record2 = createMockRecord({ clientGeneratedId: 'rec-2' });
    const record3 = createMockRecord({ clientGeneratedId: 'rec-3' });

    await enqueueAttendance(record1);
    await enqueueAttendance(record2);
    await enqueueAttendance(record3);

    await markRecordInProgress('rec-2');
    await markRecordFailed('rec-3', 'test error');

    const count = await getPendingCount();
    expect(count).toBe(1); // Only rec-1 is PENDING
  });

  it('getPendingRecords returns only PENDING records', async () => {
    const record1 = createMockRecord({ clientGeneratedId: 'rec-1' });
    const record2 = createMockRecord({ clientGeneratedId: 'rec-2' });
    const record3 = createMockRecord({ clientGeneratedId: 'rec-3' });

    await enqueueAttendance(record1);
    await enqueueAttendance(record2);
    await enqueueAttendance(record3);

    await markRecordInProgress('rec-2');
    await markRecordFailed('rec-3', 'test error');

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.clientGeneratedId).toBe('rec-1');
  });

  it('getPendingRecords sorts by capturedAt ascending (oldest first)', async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 10000);
    const latest = new Date(now.getTime() + 10000);

    await enqueueAttendance(
      createMockRecord({ clientGeneratedId: 'rec-2', capturedAt: now.toISOString() }),
    );
    await enqueueAttendance(
      createMockRecord({ clientGeneratedId: 'rec-1', capturedAt: earlier.toISOString() }),
    );
    await enqueueAttendance(
      createMockRecord({ clientGeneratedId: 'rec-3', capturedAt: latest.toISOString() }),
    );

    const pending = await getPendingRecords();
    expect(pending.map((r) => r.clientGeneratedId)).toEqual(['rec-1', 'rec-2', 'rec-3']);
  });

  it('getPendingRecords respects limit parameter', async () => {
    await enqueueAttendance(createMockRecord());
    await enqueueAttendance(createMockRecord());
    await enqueueAttendance(createMockRecord());

    const pending = await getPendingRecords(2);
    expect(pending).toHaveLength(2);
  });

  it('markRecordSynced deletes the record', async () => {
    const record = createMockRecord({ clientGeneratedId: 'rec-1' });
    await enqueueAttendance(record);

    await markRecordSynced('rec-1');

    const depth = await getQueueDepth();
    expect(depth).toBe(0);
  });

  it('markRecordFailed updates status and increments syncAttempts', async () => {
    const record = createMockRecord({ clientGeneratedId: 'rec-1' });
    await enqueueAttendance(record);

    await markRecordFailed('rec-1', 'Network error');

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(0); // No longer PENDING

    const depth = await getQueueDepth();
    expect(depth).toBe(1); // Still in queue, but FAILED
  });

  it('markRecordFailed stores error reason in lastError', async () => {
    const record = createMockRecord({ clientGeneratedId: 'rec-1' });
    await enqueueAttendance(record);

    await markRecordFailed('rec-1', 'Network timeout');

    // Query directly from DB to check FAILED record
    const { getDb } = await import('./db');
    const db = await getDb();
    const failedRecord = await db.get('attendance-queue', 'rec-1');

    expect(failedRecord?.syncStatus).toBe('FAILED');
    expect(failedRecord?.syncAttempts).toBe(1);
    expect(failedRecord?.lastError).toBe('Network timeout');
  });

  it('rollbackInProgress converts IN_PROGRESS to PENDING', async () => {
    const record1 = createMockRecord({ clientGeneratedId: 'rec-1' });
    const record2 = createMockRecord({ clientGeneratedId: 'rec-2' });

    await enqueueAttendance(record1);
    await enqueueAttendance(record2);

    await markRecordInProgress('rec-1');
    await markRecordInProgress('rec-2');

    await rollbackInProgress();

    const pending = await getPendingRecords();
    expect(pending).toHaveLength(2);
  });

  it('pruneOldRecords deletes only old FAILED records', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

    const oldRecord = createMockRecord({
      clientGeneratedId: 'old-rec',
      capturedAt: oldDate.toISOString(),
    });
    const recentRecord = createMockRecord({
      clientGeneratedId: 'recent-rec',
      capturedAt: recentDate.toISOString(),
    });

    await enqueueAttendance(oldRecord);
    await enqueueAttendance(recentRecord);

    await markRecordFailed('old-rec', 'old error');
    await markRecordFailed('recent-rec', 'recent error');

    const deletedCount = await pruneOldRecords(7); // Delete records older than 7 days

    expect(deletedCount).toBe(1);

    const depth = await getQueueDepth();
    expect(depth).toBe(1); // Only recent-rec remains
  });

  it('pruneOldRecords does NOT delete recent FAILED records', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2); // 2 days ago

    const record = createMockRecord({
      clientGeneratedId: 'recent-rec',
      capturedAt: recentDate.toISOString(),
    });

    await enqueueAttendance(record);
    await markRecordFailed('recent-rec', 'error');

    const deletedCount = await pruneOldRecords(7);

    expect(deletedCount).toBe(0);

    const depth = await getQueueDepth();
    expect(depth).toBe(1);
  });

  it('concurrent enqueues do not corrupt state', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      enqueueAttendance(createMockRecord({ matchedEmployeeId: `emp-${i}` })),
    );

    await Promise.all(promises);

    const depth = await getQueueDepth();
    expect(depth).toBe(10);
  });

  it('enqueue, sync, enqueue again — queue depth updates correctly', async () => {
    const record1 = createMockRecord({ clientGeneratedId: 'rec-1' });
    await enqueueAttendance(record1);

    expect(await getQueueDepth()).toBe(1);

    await markRecordSynced('rec-1');
    expect(await getQueueDepth()).toBe(0);

    const record2 = createMockRecord({ clientGeneratedId: 'rec-2' });
    await enqueueAttendance(record2);

    expect(await getQueueDepth()).toBe(1);
  });
});
