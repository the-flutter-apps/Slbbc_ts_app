# Offline Strategy

> Load this when working on service workers, IndexedDB queue, or sync logic.

Boiler rooms have unreliable WiFi. The kiosk MUST function fully offline and sync when network returns. This is non-negotiable.

## Core Principle

**The kiosk never tells the user "no network, try again later."** It always records the check-in/out. Sync is invisible to the user.

## Storage Layers

### IndexedDB (via `idb` package)

Database name: `slbbc-kiosk-db`

Object stores:

```
attendance-queue (keyPath: clientGeneratedId)
  - clientGeneratedId: uuid
  - capturedAt: ISO timestamp
  - captureMethod: 'FACE' | 'FACE_OFFLINE' | 'PIN' | 'PIN_OFFLINE'
  - photoBlob: Blob (the captured frame)
  - matchedEmployeeId: string | null
  - pin: string | null (encrypted at rest)
  - syncStatus: 'PENDING' | 'IN_PROGRESS' | 'FAILED'
  - syncAttempts: number
  - lastError: string | null

employee-descriptors (keyPath: id)
  - id: employee UUID
  - employeeCode: string
  - fullName: string
  - photoBlob: Blob (cached employee photo for success screen)
  - descriptors: Float32Array[]
  - cachedAt: timestamp

config (keyPath: 'singleton')
  - kioskId, apiKey, vendorId
  - lastDescriptorRefresh
  - appSettings
```

### Service Worker Cache

Cached via Workbox:
- App shell (HTML, JS, CSS) — `CacheFirst` with versioning
- face-api.js model files — `CacheFirst` (rarely change)
- Telugu audio files — `CacheFirst`
- Employee photos — `StaleWhileRevalidate`
- API responses (descriptors endpoint) — `NetworkFirst` with 1hr fallback

## Detection of Online Status

`navigator.onLine` is unreliable on Android. Use a heartbeat:

```ts
// Every 30s, ping /kiosk/heartbeat with 5s timeout
// If 2 consecutive failures → mark offline
// If 1 success after offline → mark online
```

Update Zustand store; UI subtly indicates offline mode (small icon, no scary banners).

## Offline Match Strategy

When offline, on-device face match using face-api.js:

1. Capture frame
2. Detect face + extract 128-dim descriptor
3. Compare against cached employee descriptors (Euclidean distance)
4. Best match if distance < 0.5 → high confidence
5. Distance 0.5-0.6 → medium → require PIN confirmation
6. Distance > 0.6 → no match → fallback to PIN

## Sync Logic

```ts
// Triggered on:
//   - Network status change (offline → online)
//   - Every 60s when online
//   - Manual "sync now" from admin screen
//   - Service Worker background sync event

async function syncQueue() {
  const pending = await getQueuedRecords({ status: 'PENDING' });
  if (pending.length === 0) return;
  
  // Mark as IN_PROGRESS
  await markRecords(pending.map(r => r.id), 'IN_PROGRESS');
  
  try {
    const result = await api.batchSync(pending);
    
    for (const r of result.results) {
      if (r.status === 'SYNCED' || r.status === 'DUPLICATE') {
        await deleteRecord(r.clientGeneratedId);
      } else {
        await markFailed(r.clientGeneratedId, r.reason);
      }
    }
  } catch (e) {
    // Roll back IN_PROGRESS to PENDING
    await markRecords(pending.map(r => r.id), 'PENDING');
  }
  
  // Update store
  await store.refreshSyncCount();
}
```

## Conflict Resolution

If a check-in is queued offline, then an online check-in happens for the same employee before sync, the server uses the **earliest capturedAt timestamp** as the canonical record. Duplicates by `clientGeneratedId` are ignored (idempotency).

## Storage Limits

Android Chrome typically allows ~50% of free disk for IndexedDB. At 50KB/photo and 200 records/day, that's ~10MB/day — well within limits even for weeks of offline operation.

Auto-cleanup: photos older than 7 days post-sync are deleted to save space.

## Edge Cases

- **Long offline period (days)**: Queue grows but app stays functional. Show admin a count of pending records.
- **Power loss mid-sync**: Records marked IN_PROGRESS roll back to PENDING on next app start.
- **Descriptor cache stale**: If descriptors haven't refreshed in 7 days, force PIN fallback only (face data may be outdated).
- **Quota exceeded**: Aggressively delete old synced photos, alert admin.

## Testing Offline Mode

Chrome DevTools → Network tab → "Offline" checkbox. Or in Fully Kiosk Browser, disable WiFi from Android settings (with admin password protection).
