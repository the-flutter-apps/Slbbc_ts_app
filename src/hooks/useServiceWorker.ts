/**
 * Service Worker update handling for PWA.
 *
 * Listens for SW updates and auto-reloads when idle (kiosk mode).
 * Prevents reload during active check-in flows.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PWA } from '@/lib/constants';
import type { Workbox } from 'workbox-window';

export interface UseServiceWorkerReturn {
  isUpdateAvailable: boolean;
  updateAndReload: () => void;
}

/**
 * Hook to handle service worker updates.
 *
 * Auto-reloads after idle period when update available (kiosk mode).
 * Skips auto-reload during active flows (capture/success).
 */
export function useServiceWorker(): UseServiceWorkerReturn {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);
  const location = useLocation();
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Track user activity (taps, clicks, touches)
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('click', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('keydown', updateActivity);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  // Register service worker and listen for updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service workers not supported');
      return;
    }

    // Dynamically import Workbox (only in browser, not during SSR)
    import('workbox-window')
      .then(({ Workbox: WorkboxClass }) => {
        const workbox = new WorkboxClass('/sw.js');

        // Listen for waiting state (update available)
        workbox.addEventListener('waiting', () => {
          console.log('[SW] New version available, waiting to activate');
          setIsUpdateAvailable(true);
        });

        // Listen for controlling state (update activated)
        workbox.addEventListener('controlling', () => {
          console.log('[SW] New version activated, reloading page');
          window.location.reload();
        });

        // Register the service worker
        workbox
          .register()
          .then((registration) => {
            console.log('[SW] Service worker registered:', registration?.scope);
          })
          .catch((error) => {
            console.error('[SW] Registration failed:', error);
          });

        setWb(workbox);
      })
      .catch((error) => {
        console.error('[SW] Failed to load Workbox:', error);
      });
  }, []);

  // Auto-reload when idle (kiosk mode)
  useEffect(() => {
    if (!isUpdateAvailable || !wb) {
      return;
    }

    // Don't auto-reload on critical pages (capture, success)
    const criticalPaths = ['/capture', '/success'];
    const isCriticalPath = criticalPaths.some((path) => location.pathname.startsWith(path));

    if (isCriticalPath) {
      console.log('[SW] Update available but on critical path, deferring reload');
      return;
    }

    // Check idle state periodically
    const checkIdle = () => {
      const idleTime = Date.now() - lastActivityRef.current;

      if (idleTime >= PWA.IDLE_RELOAD_DELAY_MS) {
        console.log(
          `[SW] User idle for ${PWA.IDLE_RELOAD_DELAY_MS}ms, activating update...`,
        );

        // Tell the waiting SW to skip waiting and take control
        wb.messageSkipWaiting();

        // Clear the timer
        if (idleTimerRef.current !== null) {
          clearInterval(idleTimerRef.current);
          idleTimerRef.current = null;
        }
      }
    };

    // Check every second
    idleTimerRef.current = window.setInterval(checkIdle, 1000);

    return () => {
      if (idleTimerRef.current !== null) {
        clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [isUpdateAvailable, wb, location.pathname]);

  // Manual update trigger (for admin/dev use)
  const updateAndReload = () => {
    if (wb) {
      console.log('[SW] Manual update triggered');
      wb.messageSkipWaiting();
    }
  };

  return {
    isUpdateAvailable,
    updateAndReload,
  };
}
