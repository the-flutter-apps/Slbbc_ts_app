# Backend API Contract

> Load this when working on `src/lib/api.ts` or any backend integration.

The backend (separate repo, NestJS) exposes these endpoints. This document is the contract.

**Base URL**: `VITE_API_BASE_URL` (e.g., `https://api.slbbc.in`)

**Authentication**: Every kiosk request includes header `X-Kiosk-Api-Key: <key>`. Kiosk identified by `X-Kiosk-Id: <id>`.

## Endpoints

### `POST /kiosk/auth/bootstrap`
First-time kiosk registration. Called once per device.

Request:
```json
{
  "kioskId": "string (from URL param or admin entry)",
  "deviceFingerprint": "string (UA + screen + timezone hash)"
}
```

Response 200:
```json
{
  "apiKey": "string",
  "vendorId": "string",
  "vendorName": "string",
  "siteName": "string"
}
```

### `POST /attendance/check-in-out`
Primary attendance endpoint. Backend determines whether this is check-in or check-out.

Headers: `X-Kiosk-Api-Key`, `X-Kiosk-Id`

Request:
```json
{
  "photoBase64": "string (data URL, JPEG)",
  "capturedAt": "ISO 8601 timestamp",
  "captureMethod": "FACE",
  "livenessScore": 0.95,
  "clientGeneratedId": "uuid (for idempotency)"
}
```

Response 200 (success):
```json
{
  "action": "CHECK_IN" | "CHECK_OUT",
  "employee": {
    "id": "string",
    "fullName": "string",
    "employeeCode": "string",
    "photoUrl": "string",
    "designation": "BOILER_OPERATOR" | "BOILER_FIREMAN" | "BOILER_HELPER"
  },
  "recordedAt": "ISO 8601 timestamp",
  "shiftType": "MORNING" | "AFTERNOON" | "NIGHT",
  "confidenceScore": 0.92
}
```

Response 422 (low confidence — fall through to PIN):
```json
{
  "code": "LOW_CONFIDENCE",
  "message": "Could not match employee with sufficient confidence",
  "topMatches": [
    { "employeeId": "...", "confidence": 0.72, "fullName": "..." }
  ]
}
```

Response 404 (no match):
```json
{ "code": "NO_MATCH", "message": "Face not recognized" }
```

### `POST /attendance/check-in-out-by-pin`
PIN fallback endpoint.

Headers: `X-Kiosk-Api-Key`, `X-Kiosk-Id`

Request:
```json
{
  "pin": "string (4 digits)",
  "capturedAt": "ISO 8601",
  "photoBase64": "string (still capture photo for audit)",
  "clientGeneratedId": "uuid"
}
```

Response 200: Same as face success
Response 401: `{ "code": "INVALID_PIN" }`
Response 429: `{ "code": "TOO_MANY_ATTEMPTS", "lockedUntil": "ISO 8601" }`

### `GET /kiosk/employees/descriptors`
Returns face descriptors of all employees for the vendor — used for OFFLINE face matching.

Headers: `X-Kiosk-Api-Key`, `X-Kiosk-Id`

Response 200:
```json
{
  "vendorId": "string",
  "generatedAt": "ISO 8601",
  "employees": [
    {
      "id": "string",
      "employeeCode": "string",
      "fullName": "string",
      "photoUrl": "string",
      "descriptors": [
        [128 floats],
        [128 floats]
      ]
    }
  ]
}
```

Cached aggressively. Refreshed daily or on demand.

### `POST /kiosk/sync/batch`
Bulk sync of offline-queued attendance.

Request:
```json
{
  "records": [
    {
      "clientGeneratedId": "uuid",
      "photoBase64": "string",
      "capturedAt": "ISO 8601",
      "captureMethod": "FACE_OFFLINE" | "PIN_OFFLINE",
      "matchedEmployeeId": "string | null (for offline matches)",
      "pin": "string | null"
    }
  ]
}
```

Response 200:
```json
{
  "results": [
    { "clientGeneratedId": "uuid", "status": "SYNCED", "attendanceId": "..." },
    { "clientGeneratedId": "uuid", "status": "DUPLICATE" },
    { "clientGeneratedId": "uuid", "status": "FAILED", "reason": "..." }
  ]
}
```

### `POST /kiosk/heartbeat`
Periodic ping to confirm kiosk is alive.

Headers: `X-Kiosk-Api-Key`, `X-Kiosk-Id`

Request:
```json
{
  "online": true,
  "queuedRecords": 0,
  "lastSyncAt": "ISO 8601",
  "appVersion": "string"
}
```

Response 200: `{ "ok": true }`

## Error Format (Universal)

All errors follow:
```json
{
  "statusCode": 400,
  "code": "MACHINE_READABLE_CODE",
  "message": "Human readable",
  "details": { "...optional..." }
}
```

## Idempotency

All write endpoints accept `clientGeneratedId` (UUIDv4). Server deduplicates by this ID across retries.

## Rate Limits

- `/attendance/*` — 10 requests/minute per kiosk
- `/kiosk/heartbeat` — 1/minute per kiosk
- `/kiosk/sync/batch` — 1/minute per kiosk, max 50 records per call

## Mock Server (Dev)

For local dev without backend, set `VITE_USE_MOCK_API=true`. The mock at `src/lib/mockApi.ts` simulates responses with fixture data.
