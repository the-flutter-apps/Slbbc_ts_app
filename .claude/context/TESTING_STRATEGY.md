# Testing Strategy

> Load this when writing tests or debugging test failures.

## Layers

```
1. Unit tests (Vitest)        — Pure logic in src/lib/
2. Component tests (Vitest +  — UI components in isolation
   React Testing Library)
3. E2E tests (Playwright)     — Full user flows on real device
4. Manual device testing      — Real tablet, real conditions
```

## Unit Tests

Target: 90%+ coverage on `src/lib/`. These are pure functions; no excuses.

```ts
// src/lib/queue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enqueue, dequeue, getQueueDepth } from './queue';

describe('attendance queue', () => {
  beforeEach(() => clearTestDb());
  
  it('enqueues a record', async () => {
    await enqueue({ ... });
    expect(await getQueueDepth()).toBe(1);
  });
  
  // ...
});
```

Critical modules to test thoroughly:
- `src/lib/queue.ts` (offline queue logic)
- `src/lib/api.ts` (request/response handling, retries)
- `src/lib/faceDetection.ts` (descriptor extraction, distance calc)
- `src/lib/audio.ts` (playback orchestration)

## Component Tests

For interactive components (BigButton, NumericKeypad, CameraView mock):

```ts
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericKeypad } from './NumericKeypad';

it('calls onSubmit with PIN when 4 digits entered', () => {
  const onSubmit = vi.fn();
  render(<NumericKeypad onSubmit={onSubmit} />);
  
  ['1', '2', '3', '4'].forEach(d => fireEvent.click(screen.getByText(d)));
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(onSubmit).toHaveBeenCalledWith('1234');
});
```

## E2E Tests (Playwright)

Run against built+previewed app, mocked backend.

```ts
// e2e/idle-to-success.spec.ts
test('full check-in flow', async ({ page }) => {
  await page.goto('/?siteId=test-site');
  
  // Bootstrap phase
  await expect(page.getByText(/SLBBC/i)).toBeVisible();
  await page.getByRole('button', { name: /tap to check/i }).click();
  
  // Camera mock — Playwright can fake getUserMedia with --use-fake-device-for-media-stream
  await expect(page.getByText(/look at camera/i)).toBeVisible();
  
  // ... etc
});
```

Run on real Android tablet via Playwright's Android support (limited but possible).

## Manual Device Testing Checklist

Before each release, walk through on a real tablet:

- [ ] First launch → bootstrap completes
- [ ] Check-in via face works (use your own face enrolled as test employee)
- [ ] Check-out via face works (after a check-in)
- [ ] PIN fallback works
- [ ] Liveness check rejects a printed photo
- [ ] Liveness check accepts a real face
- [ ] Audio plays at correct volume in actual boiler room conditions
- [ ] Camera works in dim lighting (if ring light isn't on)
- [ ] Disconnect WiFi → check-in → reconnect → record syncs within 60s
- [ ] Long offline period (10+ minutes) → multiple records → all sync correctly
- [ ] Tablet survives unexpected power cut (no data loss)
- [ ] Auto-restart at 4AM (verify next morning)
- [ ] Heartbeat updates backend dashboard
- [ ] Error in code → user sees recovery screen, not raw error

## Performance Testing

Before launch, run Lighthouse on production URL:

```
Performance: 95+
Accessibility: 90+
Best Practices: 95+
SEO: N/A (kiosk, not for search)
PWA: 100
```

Real-device performance: Chrome DevTools remote debugging on the tablet, throttle to "Slow 4G", verify check-in still completes in <5s.

## Test Data

Fixtures in `src/test/fixtures.ts`:
- Mock employees (3-5 with different photos)
- Mock vendor + kiosk credentials
- Mock face descriptors (Float32Array of 128 random floats — won't actually match, but exercises code paths)

Mock CompreFace responses in `src/lib/mockApi.ts`.

## CI

GitHub Actions runs on every PR:
1. Install deps
2. Lint
3. Type check
4. Run unit tests
5. Run component tests
6. Build production bundle
7. (Optional) Run Playwright e2e against built bundle

PR cannot merge if any step fails.
