import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IdlePage } from '@/pages/IdlePage';
import { CapturePage } from '@/pages/CapturePage';
import { SuccessPage } from '@/pages/SuccessPage';
import { PinEntryPage } from '@/pages/PinEntryPage';
import { rollbackInProgress } from '@/lib/queue';
import { startHeartbeat, stopHeartbeat, setupNetworkListeners } from '@/lib/network';
import { refreshDescriptorsIfNeeded } from '@/lib/descriptors';
import { fetchEmployeeDescriptors } from '@/lib/api';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useKioskStore } from '@/store/kioskStore';

export default function App() {
  const refreshPendingCount = useKioskStore((s) => s.refreshPendingCount);
  const kioskId = useKioskStore((s) => s.kioskId);
  const apiKey = useKioskStore((s) => s.apiKey);
  const online = useKioskStore((s) => s.online);

  // Register service worker and handle updates
  useServiceWorker();

  // On app startup: rollback any IN_PROGRESS records to PENDING (crash recovery)
  useEffect(() => {
    rollbackInProgress()
      .then(() => refreshPendingCount())
      .catch((err) => {
        console.error('[Queue] Failed to rollback in-progress records:', err);
      });
  }, [refreshPendingCount]);

  // Start network monitoring and sync scheduler
  useEffect(() => {
    setupNetworkListeners();
    startHeartbeat();

    return () => {
      stopHeartbeat();
    };
  }, []);

  // Refresh employee descriptors cache on startup and periodically
  useEffect(() => {
    const refreshDescriptors = async () => {
      if (!online) {
        console.log('[App] Offline, skipping descriptor refresh');
        return;
      }

      try {
        await refreshDescriptorsIfNeeded(() => fetchEmployeeDescriptors(kioskId, apiKey));
      } catch (error) {
        console.error('[App] Failed to refresh descriptors:', error);
      }
    };

    // Refresh on startup
    refreshDescriptors();

    // Refresh every 24 hours
    const interval = setInterval(refreshDescriptors, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [kioskId, apiKey, online]);

  return (
    <Routes>
      <Route path="/" element={<IdlePage />} />
      <Route path="/capture" element={<CapturePage />} />
      <Route path="/success" element={<SuccessPage />} />
      <Route path="/pin" element={<PinEntryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
