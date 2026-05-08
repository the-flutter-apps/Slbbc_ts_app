/**
 * Backend API client.
 *
 * See `.claude/context/API_CONTRACT.md` for full contract.
 *
 * TODO: Implement all endpoints. Each function should:
 *   - Add X-Kiosk-Api-Key + X-Kiosk-Id headers from kioskStore
 *   - Use fetch with timeout (5s default)
 *   - Throw NetworkError for connectivity issues (caller queues offline)
 *   - Throw ApiError for 4xx/5xx with structured error body
 *   - Generate clientGeneratedId (uuidv4) for write requests
 */

import { v4 as uuidv4 } from 'uuid';
import type { AttendanceResult, KioskConfig } from '@/types';

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface BootstrapRequest {
  kioskId: string;
  deviceFingerprint: string;
}

export async function bootstrapKiosk(
  _req: BootstrapRequest,
): Promise<Omit<KioskConfig, 'kioskId' | 'bootstrapped'>> {
  // TODO: POST /kiosk/auth/bootstrap
  void API_BASE;
  void uuidv4;
  throw new Error('Not implemented');
}

interface CheckInOutRequest {
  photoBase64: string;
  capturedAt: string;
  livenessScore: number;
}

export async function checkInOutByFace(_req: CheckInOutRequest): Promise<AttendanceResult> {
  // TODO: POST /attendance/check-in-out
  throw new Error('Not implemented');
}

interface PinCheckInRequest {
  pin: string;
  capturedAt: string;
  photoBase64: string;
}

export async function checkInOutByPin(_req: PinCheckInRequest): Promise<AttendanceResult> {
  // TODO: POST /attendance/check-in-out-by-pin
  throw new Error('Not implemented');
}

export async function fetchEmployeeDescriptors(): Promise<unknown> {
  // TODO: GET /kiosk/employees/descriptors
  throw new Error('Not implemented');
}

interface SyncBatchRecord {
  clientGeneratedId: string;
  photoBase64: string;
  capturedAt: string;
  captureMethod: string;
  matchedEmployeeId: string | null;
  pin: string | null;
}

interface SyncBatchResponse {
  results: Array<{
    clientGeneratedId: string;
    status: 'SYNCED' | 'DUPLICATE' | 'FAILED';
    attendanceId?: string;
    reason?: string;
  }>;
}

export async function syncBatch(records: SyncBatchRecord[]): Promise<SyncBatchResponse> {
  // TODO: Implement POST /kiosk/sync/batch
  // For now, mock success response for all records
  console.warn('[API] Using mock syncBatch (backend not implemented yet)');

  return {
    results: records.map((r) => ({
      clientGeneratedId: r.clientGeneratedId,
      status: 'SYNCED',
      attendanceId: `mock-${Date.now()}`,
    })),
  };
}

interface HeartbeatPayload {
  online: boolean;
  queuedRecords: number;
  lastSyncAt: string | null;
  appVersion: string;
}

export async function heartbeat(payload: HeartbeatPayload): Promise<void> {
  // TODO: Implement POST /kiosk/heartbeat
  // For now, just log
  void payload;
  // Mock successful heartbeat (backend not implemented yet)
}
