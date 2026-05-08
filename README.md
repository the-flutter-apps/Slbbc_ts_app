# SLBBC Kiosk PWA

Progressive Web App that runs on Android tablets at SLBBC's pharmaceutical client sites. Employees check in/out via face recognition, with PIN fallback. Works offline.

> This is the **kiosk** frontend. The companion **admin dashboard** and **public website** live in separate repositories.

---

## Quick Start

**Prerequisites**: Node.js 20+, pnpm 9+ (`npm install -g pnpm`).

```bash
# Install dependencies
pnpm install

# Copy env template and edit values
cp .env.example .env.local

# Run dev server
pnpm dev
# → http://localhost:5173
```

## Available Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server with hot reload |
| `pnpm build` | Production build (outputs to `dist/`) |
| `pnpm preview` | Preview production build locally |
| `pnpm typecheck` | TypeScript check (no emit) |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier write |
| `pnpm test` | Vitest watch mode |
| `pnpm test:run` | Vitest single run |
| `pnpm test:coverage` | Vitest with coverage report |

## Project Structure

```
.claude/                  # Claude Code project context (READ THIS)
  CLAUDE.md (in root)     # Main context file
  context/                # Detailed reference docs
  commands/               # Reusable slash commands
  settings.json           # Tool permissions

public/                   # Static assets
  audio/                  # Telugu MP3 prompts
  models/                 # face-api.js model files (download separately)
  icons/                  # PWA icons

src/
  components/
    ui/                   # Generic primitives (Button, etc.)
    kiosk/                # Kiosk-specific composites
    layout/               # Layout shells
  pages/                  # Route components
  lib/                    # Pure logic (no React)
  hooks/                  # Custom React hooks
  store/                  # Zustand stores
  types/                  # Shared TypeScript types
  styles/                 # Global CSS
  workers/                # Service worker source (custom)
  App.tsx
  main.tsx

vite.config.ts            # Vite + PWA plugin config
tailwind.config.ts        # Tailwind theme + scale
tsconfig.json             # TypeScript strict
eslint.config.js          # ESLint flat config
package.json
```

## Working with Claude Code

This project is **designed for AI-assisted development**. Claude Code reads `CLAUDE.md` and the `.claude/` folder for context.

### First-Time Setup

When you first open Claude Code in this project:

```
/bootstrap
```

This walks through the initial setup interactively.

### Common Slash Commands

- `/feature <description>` — Plan and implement a new feature
- `/debug <issue>` — Diagnose a problem methodically
- `/review` — Review uncommitted changes
- `/explain <file or concept>` — Get a plain-language explanation

### Token-Efficient Context

The main `CLAUDE.md` is intentionally compact. Detailed docs live in `.claude/context/` and are loaded only when relevant:

- `ARCHITECTURE.md` — Component hierarchy, data flow, state management
- `API_CONTRACT.md` — Backend endpoints (request/response shapes)
- `OFFLINE_STRATEGY.md` — Service worker + IndexedDB queue
- `FACE_RECOGNITION.md` — CompreFace + face-api.js integration
- `AUDIO_PROMPTS.md` — Telugu audio inventory
- `KIOSK_DEPLOYMENT.md` — Tablet setup, Fully Kiosk Browser config
- `TESTING_STRATEGY.md` — Test approach across all layers

When working on a specific area, ask Claude to read the matching context doc.

## What's Implemented

This is a **scaffold**. The structure, configs, types, and stubs are in place. The actual logic is mostly TODOs that you'll implement with Claude Code's help.

### Working out of the box

- Project bootstraps (npm/pnpm install, dev server, type check, lint, build)
- Routing skeleton (Idle → Capture → Success → Pin)
- Idle page UI (clock, big button, branding)
- Tailwind theming with SLBBC brand palette
- PWA manifest (full-screen kiosk mode)
- Service worker registration

### TODOs (next development phases)

- [ ] Camera capture (`src/lib/faceDetection.ts`)
- [ ] Face detection with face-api.js
- [ ] Liveness check
- [ ] Backend API integration (`src/lib/api.ts`)
- [ ] IndexedDB offline queue (`src/lib/queue.ts`)
- [ ] Service worker custom logic for sync
- [ ] CompreFace integration (via backend)
- [ ] Telugu audio file recording + integration
- [ ] PIN entry numeric keypad component
- [ ] Success state with employee photo + name
- [ ] Heartbeat + sync intervals
- [ ] Admin enrollment flow
- [ ] Lighthouse audit + optimization
- [ ] Real device testing on Samsung Galaxy Tab A9

## Deployment

Auto-deploys to Vercel on push to `main`. Custom domain: `kiosk.slbbc.in`.

See `.claude/context/KIOSK_DEPLOYMENT.md` for tablet setup and Fully Kiosk Browser config.

## License

Proprietary — Internal use by SLBBC only.
