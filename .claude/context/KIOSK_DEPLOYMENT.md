# Kiosk Deployment

> Load this when working on deployment, hardware setup, or production launch.

## Hardware

- **Tablet**: Samsung Galaxy Tab A9 (10-inch) or Lenovo Tab M10 (5th gen)
  - Specs: 4GB+ RAM, Android 12+, front camera 5MP+, USB-C, WiFi 5+
- **Stand**: Floor or wall-mount kiosk enclosure with locking faceplate
  - Source: IndiaMart, Amazon Business
- **Power**: Hardwired USB-C cable + 25W adapter (no battery dependency)
- **Optional**: Ring light for low-light boiler rooms (~₹500)
- **Optional**: External small speaker (3.5mm) for noisy environments

## Fully Kiosk Browser Configuration

Install Fully Kiosk Browser from Play Store. Buy license for unlimited use (~₹1,000 one-time per device).

### Critical Settings

**Web Content Settings**:
- Start URL: `https://kiosk.slbbc.in/?siteId=<UNIQUE_ID>`
- JavaScript: ON
- Cookies: ON
- Cache: ON
- DOM Storage: ON
- Service Workers: ON (CRITICAL for PWA)
- WebRTC: ON (CRITICAL for camera)

**Universal Web Automation**:
- Auto Reload on Idle: 30 minutes (recovers from any stuck state)
- Reload on screen on: ON
- Reload on internet connectivity: ON

**Kiosk Mode**:
- Kiosk Mode: ENABLED
- Disable Status Bar: YES
- Disable Navigation Bar: YES
- Disable Volume Buttons: NO (allow volume adjustment)
- Disable Power Button (single press): YES
- Disable Long Press Power: YES
- Disable Recent Apps: YES

**Device Management**:
- Restart on Crash: YES
- Periodic Restart: Daily at 4:00 AM (off-shift)
- Auto-launch on Boot: YES
- Keep Screen On: YES (or screen saver after 5 min, wake on motion)
- Prevent Screen Off: YES (during operating hours)
- Brightness: 80% (boiler rooms can be dim)

**Permissions (Auto-grant)**:
- Camera: ALLOW
- Microphone: ALLOW (for future voice prompts)
- Notifications: ALLOW

**Remote Administration**:
- Remote Admin: ENABLED
- Remote Admin password: STRONG password, stored in 1Password
- Allow restart, reload, screenshots, app version check remotely

**Motion Detection** (Optional):
- Motion sensor: ON
- Wake screen on motion: YES
- Save power during inactive hours

### Advanced Settings

```
Allowed Domains: kiosk.slbbc.in, *.compreface.your-domain.com
Block all other URLs: YES
Disable JavaScript console: YES (prevent tampering)
Disable F11/fullscreen toggle: YES
```

## Tablet Initial Setup

1. Unbox tablet, charge to 100%
2. Skip Google account sign-in if possible (privacy + security)
3. Connect to site WiFi
4. Set timezone to Asia/Kolkata; auto sync time
5. Disable lock screen + screen lock password
6. Disable all notifications globally
7. Install Fully Kiosk Browser from Play Store
8. Buy/activate license
9. Configure as above
10. Mount in stand, route cable through stand
11. Set device admin password (only you/dad know)
12. Test: face capture, audio, offline mode

## Domain Setup

Each kiosk gets a unique URL parameter to identify which site it's at:

```
https://kiosk.slbbc.in/?siteId=hyd-pharma-a
https://kiosk.slbbc.in/?siteId=vsp-pharma-b
```

On first launch, kiosk reads `siteId` from URL → calls `/kiosk/auth/bootstrap` → receives API key → stores in IndexedDB → URL parameter no longer needed (but harmless if present).

## Vercel Deployment

Project deploys automatically from GitHub `main` branch.

**Environment Variables** (Vercel dashboard):
- `VITE_API_BASE_URL` = production backend URL
- `VITE_SENTRY_DSN` = error tracking (optional)
- `VITE_USE_MOCK_API` = `false` in production

**Domain configuration**:
- Add `kiosk.slbbc.in` as custom domain in Vercel
- Vercel issues SSL automatically
- DNS: CNAME `kiosk` → `cname.vercel-dns.com`

## Service Worker Update Strategy

PWAs cache aggressively. New deploys must propagate to tablets without manual intervention.

`vite-plugin-pwa` config: `registerType: 'autoUpdate'`. On new version detected:
1. Service worker downloads new assets in background
2. On next page load (or 24h max), new version activates
3. Forced reload via Fully Kiosk's daily 4AM restart ensures latest code

To force immediate update of all kiosks: bump app version → push → use Fully Kiosk remote admin to trigger reload on each tablet.

## Monitoring

**Heartbeat**: Each kiosk pings `/kiosk/heartbeat` every 60s. Backend dashboard shows last-seen-at for each kiosk. If a kiosk is offline > 15 min, alert admin (WhatsApp).

**Error tracking**: Sentry catches JS errors. Configure with kiosk ID as user context. Filter dashboard by kiosk to debug per-site issues.

**Sync queue depth**: Heartbeat reports `queuedRecords`. If any kiosk has > 50 queued records, alert admin (network problem at site).

## Recovery Procedures

| Problem | Recovery |
|---|---|
| Kiosk frozen | Fully Kiosk auto-restart on idle (30 min) handles most cases |
| Tablet won't power on | Check power cable; spare adapter at each site |
| Camera not working | Restart Fully Kiosk; if persistent, factory reset tablet |
| Sync failing for hours | SSH to backend, check CompreFace; if backend healthy, instruct site to reboot tablet |
| All kiosks offline | Likely backend issue, not kiosks. Check VPS status. |
| Tablet stolen | Remote wipe via Fully Kiosk admin, deactivate API key in backend |

## Pilot Rollout Plan

Don't deploy 10 kiosks day 1.

1. **Week 1**: 1 kiosk at closest Hyderabad site (your dad supervising)
2. **Week 2**: Same site, 2 kiosks (one entry, one exit) if needed
3. **Week 3**: Bug fixes, UX refinements based on real data
4. **Week 4-5**: Roll out to 2 more Hyderabad sites
5. **Week 6+**: Vizag sites (require travel; ensure remote support workflow first)

## Site Supervisor Training

Even though end users are illiterate, each site has a supervisor (older worker, often the senior fireman). Train them on:
- Restarting the tablet (long-press power, hold for 30s, will auto-launch kiosk)
- Wiping camera lens
- WhatsApp number to ping if kiosk has issues
- Manual paper backup form for when kiosk is unavailable (rare, but needed)
