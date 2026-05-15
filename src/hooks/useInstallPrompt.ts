/**
 * PWA install prompt handling.
 *
 * Captures the beforeinstallprompt event and exposes an install() function.
 * Used for admin panel "Install PWA" button (kiosks are pre-installed).
 */

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UseInstallPromptReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  install: () => Promise<boolean>;
}

/**
 * Hook to handle PWA installation.
 *
 * Returns install() function to trigger install prompt.
 * Automatically detects if PWA is already installed.
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (running as standalone PWA)
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }

      // iOS Safari
      if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
        setIsInstalled(true);
        return true;
      }

      return false;
    };

    if (checkInstalled()) {
      console.log('[Install] PWA already installed');
      return;
    }

    // Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      console.log('[Install] Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      console.log('[Install] PWA installed successfully');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  /**
   * Trigger the install prompt.
   * Returns true if user accepted, false if dismissed.
   */
  const install = async (): Promise<boolean> => {
    if (!installPrompt) {
      console.warn('[Install] No install prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await installPrompt.prompt();

      // Wait for user response
      const choice = await installPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        console.log('[Install] User accepted install prompt');
        setInstallPrompt(null);
        return true;
      } else {
        console.log('[Install] User dismissed install prompt');
        return false;
      }
    } catch (error) {
      console.error('[Install] Error showing install prompt:', error);
      return false;
    }
  };

  return {
    isInstallable: installPrompt !== null,
    isInstalled,
    install,
  };
}
