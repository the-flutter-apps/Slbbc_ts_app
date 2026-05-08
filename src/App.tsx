import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IdlePage } from '@/pages/IdlePage';
import { CapturePage } from '@/pages/CapturePage';
import { SuccessPage } from '@/pages/SuccessPage';
import { PinEntryPage } from '@/pages/PinEntryPage';
import { rollbackInProgress } from '@/lib/queue';
import { startHeartbeat, stopHeartbeat, setupNetworkListeners } from '@/lib/network';
import { useKioskStore } from '@/store/kioskStore';

export default function App() {
  const refreshPendingCount = useKioskStore((s) => s.refreshPendingCount);

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IdlePage />} />
        <Route path="/capture" element={<CapturePage />} />
        <Route path="/success" element={<SuccessPage />} />
        <Route path="/pin" element={<PinEntryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
