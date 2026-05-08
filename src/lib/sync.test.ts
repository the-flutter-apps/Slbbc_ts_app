import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { syncQueue } from './sync';
import { enqueueAttendance, getPendingCount, getPendingRecords } from './queue';
import { resetDb } from './db';
import * as apiModule from './api';

// Mock the API module
vi.mock('./api', () => ({
  syncBatch: vi.fn(),
  heartbeat: vi.fn(),
  NetworkError: class NetworkError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NetworkError';
    }
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public statusCode: number, public code: string, public details?: unknown) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

describe('Sync Worker', () => {
  beforeEach(async () => {
    // Reset fake IndexedDB
    global.indexedDB = new IDBFactory();
    resetDb();

    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('slbbc-kiosk-db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });

    vi.clearAllMocks();
  });

  it('syncs pending records successfully', async () => {
    // Enqueue 2 test records
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test1'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-001',
      pin: '1234',
      clientGeneratedId: 'rec-1',
    });

    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test2'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-002',
      pin: '5678',
      clientGeneratedId: 'rec-2',
    });

    expect(await getPendingCount()).toBe(2);

    // Mock successful API response
    vi.mocked(apiModule.syncBatch).mockResolvedValue({
      results: [
        { clientGeneratedId: 'rec-1', status: 'SYNCED', attendanceId: 'att-1' },
        { clientGeneratedId: 'rec-2', status: 'SYNCED', attendanceId: 'att-2' },
      ],
    });

    const syncedCount = await syncQueue();

    expect(syncedCount).toBe(2);
    expect(await getPendingCount()).toBe(0);
    expect(apiModule.syncBatch).toHaveBeenCalledTimes(1);
  });

  it('handles DUPLICATE status by removing record', async () => {
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-001',
      pin: '1234',
      clientGeneratedId: 'rec-1',
    });

    vi.mocked(apiModule.syncBatch).mockResolvedValue({
      results: [
        { clientGeneratedId: 'rec-1', status: 'DUPLICATE' },
      ],
    });

    const syncedCount = await syncQueue();

    expect(syncedCount).toBe(1); // DUPLICATE counts as synced
    expect(await getPendingCount()).toBe(0);
  });

  it('handles FAILED status by marking record as failed', async () => {
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-001',
      pin: '1234',
      clientGeneratedId: 'rec-1',
    });

    vi.mocked(apiModule.syncBatch).mockResolvedValue({
      results: [
        { clientGeneratedId: 'rec-1', status: 'FAILED', reason: 'Invalid employee' },
      ],
    });

    const syncedCount = await syncQueue();

    expect(syncedCount).toBe(0);
    expect(await getPendingCount()).toBe(0); // No longer PENDING

    // Verify record is marked as FAILED
    const { getDb } = await import('./db');
    const db = await getDb();
    const record = await db.get('attendance-queue', 'rec-1');

    expect(record?.syncStatus).toBe('FAILED');
    expect(record?.lastError).toBe('Invalid employee');
    expect(record?.syncAttempts).toBe(1);
  });

  it('rolls back to PENDING on network error', async () => {
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-001',
      pin: '1234',
      clientGeneratedId: 'rec-1',
    });

    // Mock network error
    vi.mocked(apiModule.syncBatch).mockRejectedValue(new Error('Network timeout'));

    await expect(syncQueue()).rejects.toThrow('Network timeout');

    // Record should be rolled back to PENDING
    const pending = await getPendingRecords();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.syncStatus).toBe('PENDING');
  });

  it('returns 0 when no pending records', async () => {
    const syncedCount = await syncQueue();
    expect(syncedCount).toBe(0);
    expect(apiModule.syncBatch).not.toHaveBeenCalled();
  });

  it('converts Blob to base64 in API call', async () => {
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['test-photo'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'emp-001',
      pin: '1234',
      clientGeneratedId: 'rec-1',
    });

    vi.mocked(apiModule.syncBatch).mockResolvedValue({
      results: [
        { clientGeneratedId: 'rec-1', status: 'SYNCED', attendanceId: 'att-1' },
      ],
    });

    await syncQueue();

    // Verify it was called and photoBase64 is a base64 data URL
    expect(apiModule.syncBatch).toHaveBeenCalled();
    const callArg = vi.mocked(apiModule.syncBatch).mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    expect(callArg?.[0]?.photoBase64).toMatch(/^data:/);
    expect(callArg?.[0]?.photoBase64).toContain('base64,');
  });

  it('respects MAX_BATCH_SIZE limit', async () => {
    // Enqueue more than MAX_BATCH_SIZE (50) records
    for (let i = 0; i < 55; i++) {
      await enqueueAttendance({
        capturedAt: new Date().toISOString(),
        captureMethod: 'PIN',
        photoBlob: new Blob([`test${i}`], { type: 'image/jpeg' }),
        matchedEmployeeId: `emp-${i}`,
        pin: '1234',
        clientGeneratedId: `rec-${i}`,
      });
    }

    vi.mocked(apiModule.syncBatch).mockResolvedValue({
      results: Array.from({ length: 50 }, (_, i) => ({
        clientGeneratedId: `rec-${i}`,
        status: 'SYNCED',
        attendanceId: `att-${i}`,
      })),
    });

    await syncQueue();

    // Should only sync first 50
    const callArg = vi.mocked(apiModule.syncBatch).mock.calls[0]?.[0];
    expect(callArg).toHaveLength(50);
  });
});
