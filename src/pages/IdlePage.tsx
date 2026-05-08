import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAudio } from '@/hooks/useAudio';
import { AUDIO } from '@/lib/constants';
import { useKioskStore } from '@/store/kioskStore';
import { enqueueAttendance } from '@/lib/queue';
import { triggerManualSync } from '@/lib/sync';

export function IdlePage() {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  const { play } = useAudio();
  const pendingSyncCount = useKioskStore((s) => s.pendingSyncCount);
  const online = useKioskStore((s) => s.online);
  const refreshPendingCount = useKioskStore((s) => s.refreshPendingCount);
  const [isSyncing, setIsSyncing] = useState(false);

  // Clock ticker
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Optional welcome chime
  useEffect(() => {
    if (AUDIO.IDLE_WELCOME_ENABLED) {
      play('welcome');
    }
  }, [play]);

  const time = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const date = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Dev-only: enqueue a fake record for testing
  const enqueueFakeRecord = async () => {
    await enqueueAttendance({
      capturedAt: new Date().toISOString(),
      captureMethod: 'PIN',
      photoBlob: new Blob(['fake-photo-data'], { type: 'image/jpeg' }),
      matchedEmployeeId: 'dev-test-employee',
      pin: '9999',
    });
    await refreshPendingCount();
  };

  // Dev-only: trigger manual sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const count = await triggerManualSync();
      console.log(`[Dev] Manual sync completed: ${count} records synced`);
    } catch (err) {
      console.error('[Dev] Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="kiosk-container bg-brand-primary text-white">
      <div className="text-center mb-12">
        {/* TODO: Replace with actual SLBBC logo when available */}
        <h1 className="text-kiosk-3xl font-bold tracking-tight">SLBBC</h1>
        <p className="text-kiosk-base mt-2 text-white/80">Sri Lakshmi Balaji Boiler Contractor</p>
      </div>

      <div className="text-center mb-16">
        <div className="text-kiosk-2xl font-semibold tabular-nums">{time}</div>
        <div className="text-kiosk-sm mt-2 text-white/70">{date}</div>
      </div>

      <button
        onClick={() => navigate('/capture')}
        className="bg-brand-accent hover:bg-brand-accent/90 active:scale-95 transition-all rounded-full px-16 py-8 shadow-2xl animate-pulse-slow"
        aria-label="Tap to check in or check out"
      >
        <span className="text-kiosk-xl font-bold text-white">TAP TO CHECK IN / OUT</span>
      </button>

      <p className="mt-12 text-kiosk-xs text-white/60">
        Look at the camera when prompted
      </p>

      {/* Dev-only: queue status and test buttons */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs text-white/40">
              <span className={online ? 'text-green-400' : 'text-red-400'}>
                {online ? '● Online' : '○ Offline'}
              </span>
              {' · '}
              Pending: <span className="font-mono font-bold">{pendingSyncCount}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={enqueueFakeRecord}
                className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded"
              >
                Enqueue Test
              </button>
              <button
                onClick={handleManualSync}
                disabled={isSyncing || pendingSyncCount === 0}
                className="px-3 py-1 text-xs bg-brand-accent/80 hover:bg-brand-accent disabled:opacity-50 disabled:cursor-not-allowed rounded"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
