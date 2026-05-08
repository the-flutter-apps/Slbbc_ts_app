/**
 * Domain types. Mirror backend API_CONTRACT.md.
 */

export type Designation = 'BOILER_OPERATOR' | 'BOILER_FIREMAN' | 'BOILER_HELPER';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'GENERAL';

export type CaptureMethod = 'FACE' | 'FACE_OFFLINE' | 'PIN' | 'PIN_OFFLINE';

export type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT';

export interface Employee {
  id: string;
  fullName: string;
  employeeCode: string;
  photoUrl: string;
  designation: Designation;
}

export interface AttendanceResult {
  action: AttendanceAction;
  employee: Employee;
  recordedAt: string;
  shiftType: ShiftType;
  confidenceScore: number;
}

export interface KioskConfig {
  kioskId: string;
  apiKey: string;
  vendorId: string;
  vendorName: string;
  siteName: string;
  bootstrapped: boolean;
}

export interface QueuedAttendance {
  clientGeneratedId: string;
  capturedAt: string;
  captureMethod: CaptureMethod;
  photoBlob: Blob;
  matchedEmployeeId: string | null;
  pin: string | null;
  syncStatus: 'PENDING' | 'IN_PROGRESS' | 'FAILED';
  syncAttempts: number;
  lastError: string | null;
}

export interface CachedEmployeeDescriptor {
  id: string;
  employeeCode: string;
  fullName: string;
  photoBlob: Blob;
  descriptors: Float32Array[];
  cachedAt: number;
}

export type LivenessPrompt = (typeof import('@/lib/constants').LIVENESS.PROMPTS)[number];
export type LivenessStatus = 'idle' | 'prompting' | 'verifying' | 'pass' | 'fail';
