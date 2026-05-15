# SLBBC Kiosk PWA — Claude Code Project Context

> **READ THIS FIRST.** This file is the source of truth for the project.
> Detailed reference docs live in `.claude/context/`. Load them only when needed.

## What This Project Is

A **Progressive Web App** that runs on Android tablets mounted at the entrance of pharmaceutical company sites where SLBBC operates boilers. Employees check in/out via face recognition (with PIN fallback) at the start and end of their shifts. The PWA is the **only frontend the 85 boiler workers ever interact with**.

**Parent project**: SLBBC ERP system. This kiosk is one of three frontends. The others (admin dashboard, public website) are separate projects.

## Critical User Constraints (Drive Every Decision)

- **Users are illiterate** — no text-based UI. Icons, faces, large buttons, and Telugu audio prompts only.
- **Users have wet/dirty hands** — single-tap workflows; no typing required (PIN fallback only when face fails).
- **Boiler rooms have flaky WiFi** — must work offline, sync later.
- **Tablets locked in kiosk mode** — Fully Kiosk Browser; no browser controls visible to user.
- **Each tablet is shared** — no per-user login on the device; the device IS the kiosk identity.
- **Power may cut** — tablet must auto-recover; no data loss on unexpected reboot.

## Tech Stack (Locked — Do Not Substitute)

```
Build:        Vite 5
Framework:    React 18 + TypeScript (strict)
Styling:      Tailwind CSS 3
Routing:      React Router 6 (minimal — 3-4 screens total)
State:        Zustand
Forms:        React Hook Form + Zod (only for PIN input + admin enrollment)
PWA:          vite-plugin-pwa (Workbox under the hood)
Offline DB:   IndexedDB via `idb` package
Camera:       getUserMedia API (no library)
Face detect:  face-api.js (on-device detection + descriptor for offline match)
Face match:   CompreFace API (online primary), face-api.js (offline fallback)
Audio:        HTML5 Audio API (zero deps)
HTTP:         Native fetch with custom retry wrapper
Testing:      Vitest (unit), Playwright (e2e on real device)
Linting:      ESLint + Prettier
Hosting:      Vercel (auto-deploy on push to main)
```

**Reject suggestions to add**: Redux, MobX, styled-components, Material UI, Bootstrap, Axios, jQuery, Moment.js, Lodash (use native), classnames (use clsx if needed).

## High-Level Architecture

```
[Tablet at Site Entrance]
    │
    ├─ Fully Kiosk Browser (locked to https://kiosk.slbbc.in/?siteId=XXX)
    │
    └─ SLBBC Kiosk PWA (this repo)
         │
         ├─ Idle Screen → Capture Screen → Success Screen
         │
         ├─ Service Worker
         │    ├─ App shell cache
         │    ├─ Offline attendance queue (IndexedDB)
         │    └─ Background sync when network returns
         │
         └─ API calls → SLBBC Backend (separate repo, NestJS)
                          │
                          └─ CompreFace (face match)
                          └─ PostgreSQL (attendance records)
```

## Deployment

**Production URL:** https://slbbcts.vercel.app/  
**Platform:** Vercel (free tier, auto-deploy from GitHub `master` branch)  
**Region:** Singapore (sin1) — low latency to India  
**Status:** ✅ Live and functional (PWA features verified)

**Environment:**
- `VITE_API_BASE_URL` = `https://api.slbbc.in`
- `VITE_USE_MOCK_API` = `true` (using mock backend until real API deployed)
- Auto-deploy: Push to `master` → Vercel rebuilds and deploys (~2-3 min)

**Build Stats:**
- Dist size: 11MB (7MB face-api models, 3.4MB app assets)
- Service worker: 31 precached files (944KB)
- Build time: ~2-3 minutes

**Custom Domain (Future):**
- Target: `https://kiosk.slbbc.in/?siteId=<SITE_ID>`
- Not configured yet — using `.vercel.app` URL for testing
- Will configure when ready for pilot rollout

**Deployment Checklist (for updates):**
1. Test locally: `npm run build` → `npm run preview`
2. Commit and push to `master`
3. Vercel auto-builds and deploys
4. Verify at production URL
5. Check service worker updates propagate (may take 5 min + idle time)

See `.claude/context/KIOSK_DEPLOYMENT.md` for Fully Kiosk Browser configuration and tablet setup details.

## User Flow (Memorize This)

1. **Idle** — Big SLBBC logo, current time, single button "TAP TO CHECK IN/OUT", subtle ambient pulse
2. **Capture** — Camera turns on, face detection draws bounding box, audio: "కెమెరా వైపు చూడండి" (look at camera)
3. **Liveness** — Random prompt: blink or turn head slightly, audio cue plays
4. **Match** — Frame sent to backend → CompreFace returns employee_id + confidence
5. **Decide** — Backend: is this employee's last record an open check-in? Yes → check-out. No → check-in.
6. **Success** — Show employee photo + name + action (check-in/out) + time, audio confirmation in Telugu, auto-dismiss in 4s
7. **Fallback (if face fails 3x or confidence < 0.70)** — Large numeric keypad, employee enters 4-digit PIN

## Project Structure

```
ts_app/
├── .claude/                    # Claude Code context & commands
│   ├── context/                # Detailed reference docs (load on demand)
│   ├── commands/               # Reusable slash commands
│   └── settings.json           # Tool permissions
├── .vscode/                    # VS Code workspace settings
├── public/
│   ├── audio/                  # Telugu MP3 prompts
│   ├── models/                 # face-api.js model files (download separately)
│   ├── icons/                  # PWA icons (multiple sizes)
│   └── manifest.json           # PWA manifest
├── src/
│   ├── components/
│   │   ├── ui/                 # Generic primitives (Button, Card)
│   │   ├── kiosk/              # Kiosk-specific (CameraView, BigButton, NumericKeypad)
│   │   └── layout/             # Layout shells
│   ├── pages/                  # Route components (Idle, Capture, Success, PinEntry)
│   ├── lib/                    # Pure logic (api, audio, queue, faceDetection, kiosk)
│   ├── store/                  # Zustand stores
│   ├── hooks/                  # Reusable React hooks
│   ├── types/                  # TypeScript type definitions
│   ├── styles/                 # Global CSS
│   ├── workers/                # Service worker source (if customizing Workbox)
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Coding Standards (Non-Negotiable)

- **TypeScript strict mode**. No `any`. Use `unknown` if truly unknown.
- **Function components only**. No class components.
- **One component per file**. Filename matches component name (PascalCase).
- **Tailwind utilities only**. No CSS modules, no styled-components, no inline styles except dynamic values.
- **Pure functions for logic**. Logic in `src/lib/` should be testable without React.
- **No magic strings**. Constants in `src/lib/constants.ts`.
- **Errors are explicit**. Never silently catch; log and surface.
- **Async with try/catch**, not promise chains.
- **Imports ordered**: external → internal absolute (`@/...`) → relative.

## Performance Targets (Test Against These)

| Metric | Target |
|---|---|
| First load (cold) | < 3s on 4G |
| Subsequent load (cached) | < 500ms |
| Tap → camera ready | < 200ms |
| Face detection FPS | ≥ 24fps |
| Face match round-trip (online) | < 1.5s |
| Total check-in time | < 5s |
| Lighthouse PWA score | 100 |
| Lighthouse Performance | 95+ |

## Working Protocol

When given a task:

1. **Confirm scope.** Restate; ask only blocking clarifications.
2. **Check `.claude/context/` for relevant detail docs** before guessing.
3. **Plan briefly** for non-trivial work — files to create/modify, order, tests.
4. **Implement incrementally** — green build before next change.
5. **Test as you go** — Vitest for logic, manual verification for UI.
6. **Update context docs** if assumptions change.
7. **Reference user-facing constraints** (illiterate users, dirty hands, flaky WiFi) when designing UX.

## Domain Glossary (Brief)

| Term | Meaning |
|---|---|
| Kiosk | A mounted tablet at one vendor site running this PWA |
| Vendor | Pharmaceutical company where SLBBC employees work |
| Site | A vendor's physical location (sometimes synonymous with vendor) |
| Employee | A boiler operator/fireman/helper deployed at a site |
| Check-in / Check-out | Start / end of a shift, captured via this PWA |
| Shift | Morning (6-2), Afternoon (2-10), Night (10-6) |
| Liveness | Anti-spoofing check (blink/head-turn) before face match |
| Confidence | Face match confidence score (0.0-1.0); ≥0.85 auto-accept |

## Key References (In `.claude/context/`)

- `ARCHITECTURE.md` — Detailed component/data flow
- `API_CONTRACT.md` — Backend API endpoints this PWA calls
- `OFFLINE_STRATEGY.md` — Service worker + IndexedDB queue logic
- `FACE_RECOGNITION.md` — CompreFace + face-api.js integration details
- `AUDIO_PROMPTS.md` — Telugu audio file inventory and triggers
- `KIOSK_DEPLOYMENT.md` — Fully Kiosk Browser config + tablet setup
- `TESTING_STRATEGY.md` — Unit + e2e testing approach

Load these only when working on the relevant area. The current file is sufficient for general work.

## Project Owner Context

- **You are working with**: Venkateshwar (IT professional, son of SLBBC's proprietor)
- **Skill level on PWA**: Beginner — explain concepts when introducing them; don't assume PWA familiarity
- **Skill level on TypeScript/React**: Some exposure but not expert
- **Available time**: Evenings + weekends
- **Tone preference**: Direct, no-fluff, technical but explained when needed
