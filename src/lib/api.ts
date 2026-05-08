/**
 * Backend API client.
 *
 * See `.claude/context/API_CONTRACT.md` for full contract.
 */

import { v4 as uuidv4 } from 'uuid';
import type { AttendanceResult, KioskConfig } from '@/types';
import { getMockAttendanceResult, MOCK_EMPLOYEES } from './mockData';

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
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Fetch wrapper with timeout and error handling.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }
      if (error.message.includes('fetch') || error.message.includes('network')) {
        throw new NetworkError(error.message);
      }
    }
    throw error;
  }
}

/**
 * Get kiosk headers from store.
 */
function getKioskHeaders(kioskId: string | null, apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (kioskId) {
    headers['X-Kiosk-Id'] = kioskId;
  }
  if (apiKey) {
    headers['X-Kiosk-Api-Key'] = apiKey;
  }

  return headers;
}

/**
 * Parse API error response.
 */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    return new ApiError(
      data.message ?? 'Request failed',
      response.status,
      data.code ?? 'UNKNOWN_ERROR',
      data.details,
    );
  } catch {
    return new ApiError(
      `Request failed with status ${response.status}`,
      response.status,
      'PARSE_ERROR',
    );
  }
}

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
  kioskId?: string | null;
  apiKey?: string | null;
}

export async function checkInOutByFace(req: CheckInOutRequest): Promise<AttendanceResult> {
  // Mock mode for development
  if (USE_MOCK_API) {
    console.log('[API] Using mock mode for checkInOutByFace');
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network delay

    // Randomly pick an employee for mock
    const randomEmployee = MOCK_EMPLOYEES[Math.floor(Math.random() * MOCK_EMPLOYEES.length)]!;
    const action = Math.random() > 0.5 ? 'CHECK_IN' : 'CHECK_OUT';

    return {
      action,
      employee: randomEmployee,
      recordedAt: req.capturedAt,
      shiftType: 'GENERAL',
      confidenceScore: 0.85 + Math.random() * 0.15, // Random confidence 0.85-1.0
    };
  }

  // Real API call
  const clientGeneratedId = uuidv4();
  const headers = getKioskHeaders(req.kioskId ?? null, req.apiKey ?? null);

  const response = await fetchWithTimeout(`${API_BASE}/attendance/check-in-out`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      photoBase64: req.photoBase64,
      capturedAt: req.capturedAt,
      captureMethod: 'FACE',
      livenessScore: req.livenessScore,
      clientGeneratedId,
    }),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = await response.json();
  return data as AttendanceResult;
}

interface PinCheckInRequest {
  pin: string;
  capturedAt: string;
  photoBase64: string;
  kioskId?: string | null;
  apiKey?: string | null;
}

export async function checkInOutByPin(req: PinCheckInRequest): Promise<AttendanceResult> {
  // Mock mode for development
  if (USE_MOCK_API) {
    console.log('[API] Using mock mode for checkInOutByPin');
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

    // Use existing mock logic
    return getMockAttendanceResult(req.pin);
  }

  // Real API call
  const clientGeneratedId = uuidv4();
  const headers = getKioskHeaders(req.kioskId ?? null, req.apiKey ?? null);

  const response = await fetchWithTimeout(`${API_BASE}/attendance/check-in-out-by-pin`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pin: req.pin,
      capturedAt: req.capturedAt,
      photoBase64: req.photoBase64,
      clientGeneratedId,
    }),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = await response.json();
  return data as AttendanceResult;
}

interface EmployeeDescriptor {
  id: string;
  employeeCode: string;
  fullName: string;
  photoUrl: string;
  designation: string;
  descriptors: number[][];
}

interface DescriptorsResponse {
  vendorId: string;
  generatedAt: string;
  employees: EmployeeDescriptor[];
}

export async function fetchEmployeeDescriptors(
  kioskId: string | null,
  apiKey: string | null,
): Promise<DescriptorsResponse> {
  // Mock mode for development
  if (USE_MOCK_API) {
    console.log('[API] Using mock mode for fetchEmployeeDescriptors');
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Return mock descriptors (random 128-dimensional vectors)
    return {
      vendorId: 'vendor-001',
      generatedAt: new Date().toISOString(),
      employees: MOCK_EMPLOYEES.map((emp) => ({
        ...emp,
        descriptors: [
          // Generate 2 random descriptors per employee (simulating multiple enrollment photos)
          Array.from({ length: 128 }, () => Math.random() * 2 - 1),
          Array.from({ length: 128 }, () => Math.random() * 2 - 1),
        ],
      })),
    };
  }

  // Real API call
  const headers = getKioskHeaders(kioskId, apiKey);

  const response = await fetchWithTimeout(`${API_BASE}/kiosk/employees/descriptors`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  const data = await response.json();
  return data as DescriptorsResponse;
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
