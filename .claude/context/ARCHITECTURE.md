# Architecture Reference

> Load this when working on cross-cutting architectural decisions.

## Component Hierarchy

```
App
├── KioskProvider (context: kioskId, apiKey, online status)
├── Router
│   ├── IdlePage         (default route)
│   ├── CapturePage      (face capture flow)
│   ├── SuccessPage      (post-checkin confirmation)
│   └── PinEntryPage     (fallback when face fails)
└── ServiceWorkerRegistration
```

## Data Flow

### Online Path (Happy)

```
User taps button
  → CapturePage mounts
  → useCamera() opens stream
  → useFaceDetection() runs face-api.js at 24fps
  → On stable face + liveness pass → captureFrame()
  → api.checkInOut(frame, kioskId, apiKey)
     → Backend: CompreFace.recognize()
     → Backend: determine action (in/out)
     → Backend: insert attendance row
     → Returns { employee, action, time }
  → Navigate to SuccessPage with payload
  → Audio plays
  → 4s timer → navigate back to IdlePage
```

### Offline Path

```
User taps button
  → CapturePage mounts
  → Same camera + detection flow
  → On capture: api.checkInOut() throws NetworkError
  → queue.enqueue({ frame, timestamp, kioskId, ... })
  → Run face-api.js local match against cached employee descriptors
  → Best match → SuccessPage with "offline" badge
  → Service worker tries sync every 60s + on network restore
```

### PIN Fallback

```
Face capture fails 3x or confidence < 0.70
  → Navigate to PinEntryPage
  → Big numeric keypad (0-9, clear, submit)
  → On submit: api.checkInOutByPin(pin, kioskId, apiKey)
  → Same response handling as face flow
```

## State Management

**Zustand** — single store at `src/store/kioskStore.ts`:

```ts
interface KioskState {
  kioskId: string;          // from URL or localStorage
  apiKey: string;           // bootstrapped on first launch
  vendorId: string;         // associated with kioskId
  online: boolean;          // navigator.onLine + heartbeat
  pendingSyncCount: number; // queue depth
  lastSyncAt: Date | null;
  setOnline: (b: boolean) => void;
  refreshSyncCount: () => Promise<void>;
}
```

UI state (current step, captured frame, etc.) is local to components via `useState`.

## Routing

React Router 6, `createBrowserRouter`. Routes:

- `/` — IdlePage
- `/capture` — CapturePage
- `/success` — SuccessPage (state passed via location.state)
- `/pin` — PinEntryPage
- `/admin` — AdminPage (protected, for enrollment & diagnostics)
- `*` — IdlePage (catch-all)

## Folder Conventions

- `src/lib/` — pure logic, no React imports
- `src/hooks/` — custom hooks, can use React
- `src/components/ui/` — generic primitives reused everywhere
- `src/components/kiosk/` — kiosk-specific composite components
- `src/pages/` — full-screen route components

## Module Boundaries

```
pages/  → can import from: components/, hooks/, lib/, store/
components/  → can import from: components/, hooks/, lib/
hooks/  → can import from: lib/, store/
lib/  → can import from: lib/ only (no React, no UI)
store/  → can import from: lib/ only
```

Enforce with ESLint `import/no-restricted-paths` if violated.

## Error Handling Strategy

- Network errors → queue for offline sync
- Face detection errors → retry up to 3x → fallback to PIN
- API auth errors (401/403) → show "kiosk not registered, contact admin"
- Camera permission errors → show admin recovery screen
- Unexpected errors → log to console + Sentry, show generic retry screen

Error boundary at App root catches React render errors → recovery screen with auto-restart in 10s.

## Build & Deploy

- Local dev: `pnpm dev` → http://localhost:5173
- Production build: `pnpm build` → outputs to `dist/`
- Preview: `pnpm preview` → serves `dist/` locally
- Deploy: push to `main` → Vercel auto-builds & deploys

Environment variables prefixed with `VITE_` are exposed to client. Anything secret (API keys for kiosk) must be bootstrapped at runtime, NOT compiled in.
