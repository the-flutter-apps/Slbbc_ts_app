import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NumericKeypad } from '@/components/kiosk/NumericKeypad';
import { checkInOutByPin, ApiError, NetworkError } from '@/lib/api';
import { enqueueAttendance } from '@/lib/queue';
import { useAudio } from '@/hooks/useAudio';
import { useKioskStore } from '@/store/kioskStore';

export function PinEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { play } = useAudio();
  const { kioskId, apiKey, online, refreshPendingCount } = useKioskStore((s) => ({
    kioskId: s.kioskId,
    apiKey: s.apiKey,
    online: s.online,
    refreshPendingCount: s.refreshPendingCount,
  }));

  // Check if redirected here due to face verification failure
  const state = location.state as { reason?: string } | null;
  const failureReason = state?.reason;

  const getMessage = () => {
    switch (failureReason) {
      case 'liveness-failed':
        return "Liveness check didn't work - please use your PIN instead";
      case 'face-match-failed':
        return 'Face not recognized - please use your PIN instead';
      case 'offline':
        return 'Device is offline - please use your PIN instead';
      default:
        return null;
    }
  };

  const message = getMessage();

  // Play prompt on mount
  useEffect(() => {
    play('use-pin');
  }, [play]);

  const handleChange = (value: string) => {
    setPin(value);
  };

  const handleSubmit = async (submittedPin: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const capturedAt = new Date().toISOString();

      // Try online PIN verification first
      if (online) {
        try {
          console.log('[PIN] Attempting online PIN verification...');

          const result = await checkInOutByPin({
            pin: submittedPin,
            capturedAt,
            photoBase64: '', // No photo for PIN entry
            kioskId,
            apiKey,
          });

          console.log('[PIN] PIN verified successfully:', result.employee.fullName);

          // Enqueue for audit trail (already synced)
          await enqueueAttendance({
            capturedAt: result.recordedAt,
            captureMethod: 'PIN',
            photoBlob: null,
            matchedEmployeeId: result.employee.id,
            pin: submittedPin,
          });

          await refreshPendingCount();

          play('pin-success');
          navigate('/success', { state: { result } });
          return;
        } catch (err) {
          if (err instanceof ApiError) {
            console.warn('[PIN] API error:', err.code, err.message);

            // Invalid PIN
            if (err.code === 'INVALID_PIN') {
              setError('Invalid PIN. Please try again.');
              play('error');
              setIsSubmitting(false);
              return;
            }

            // Too many attempts
            if (err.code === 'TOO_MANY_ATTEMPTS') {
              setError('Too many attempts. Please try again later.');
              play('error');
              setIsSubmitting(false);
              return;
            }

            // Other errors → fall through to offline
            console.error('[PIN] API error, falling back to offline queue:', err);
          } else if (err instanceof NetworkError) {
            console.warn('[PIN] Network error, falling back to offline queue:', err.message);
          } else {
            console.error('[PIN] Unexpected error during PIN verification:', err);
          }
        }
      }

      // Offline fallback: queue for later sync
      console.log('[PIN] Enqueueing PIN attendance for offline sync...');

      await enqueueAttendance({
        capturedAt,
        captureMethod: 'PIN',
        photoBlob: null,
        matchedEmployeeId: null, // Will be verified server-side on sync
        pin: submittedPin,
      });

      await refreshPendingCount();

      setError('Device is offline. Your attendance will be synced when connection is restored.');
      play('offline');
      setIsSubmitting(false);

      // Auto-dismiss after showing offline message
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      console.error('[PIN] Error during submission:', err);
      setError('An error occurred. Please try again.');
      play('error');
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="kiosk-container bg-brand-primary text-white">
      <h2 className="text-kiosk-xl font-semibold mb-8">Enter Your PIN</h2>

      {message && (
        <div className="mb-8 bg-yellow-600/20 border-2 border-yellow-600/50 rounded-2xl px-8 py-4 max-w-xl mx-auto">
          <p className="text-kiosk-sm text-center">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-8 bg-red-600/20 border-2 border-red-600/50 rounded-2xl px-8 py-4 max-w-xl mx-auto">
          <p className="text-kiosk-sm text-center">{error}</p>
        </div>
      )}

      <NumericKeypad
        value={pin}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        disabled={isSubmitting}
      />
    </div>
  );
}
