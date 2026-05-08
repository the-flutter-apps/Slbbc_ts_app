/**
 * Global kiosk state.
 *
 * Holds: kiosk identity, online status, queue depth.
 * UI state (current step, captured frame) lives in component-local useState.
 */

import { create } from 'zustand';

interface KioskState {
  // Identity
  kioskId: string | null;
  apiKey: string | null;
  vendorId: string | null;
  vendorName: string | null;
  siteName: string | null;

  // Status
  online: boolean;
  pendingSyncCount: number;
  lastSyncAt: Date | null;

  // Actions
  setIdentity: (config: {
    kioskId: string;
    apiKey: string;
    vendorId: string;
    vendorName: string;
    siteName: string;
  }) => void;
  setOnline: (online: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncAt: (date: Date) => void;
  refreshPendingCount: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  kioskId: null,
  apiKey: null,
  vendorId: null,
  vendorName: null,
  siteName: null,
  online: navigator.onLine,
  pendingSyncCount: 0,
  lastSyncAt: null,
};

export const useKioskStore = create<KioskState>((set) => ({
  ...initialState,
  setIdentity: (config) => set(config),
  setOnline: (online) => set({ online }),
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
  setLastSyncAt: (date) => set({ lastSyncAt: date }),
  refreshPendingCount: async () => {
    const { getPendingCount } = await import('@/lib/queue');
    const count = await getPendingCount();
    set({ pendingSyncCount: count });
  },
  reset: () => set(initialState),
}));
