import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NumericKeypad } from '@/components/kiosk/NumericKeypad';
import { getMockAttendanceResult } from '@/lib/mockData';
import { useAudio } from '@/hooks/useAudio';

export function PinEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pin, setPin] = useState('');
  const { play } = useAudio();

  // Check if redirected here due to liveness failure
  const state = location.state as { reason?: string } | null;
  const livenessCheckFailed = state?.reason === 'liveness-failed';

  // Play prompt on mount
  useEffect(() => {
    play('use-pin');
  }, [play]);

  const handleChange = (value: string) => {
    setPin(value);
  };

  const handleSubmit = (submittedPin: string) => {
    play('pin-success');
    const result = getMockAttendanceResult(submittedPin);
    navigate('/success', {
      state: { result },
    });
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="kiosk-container bg-brand-primary text-white">
      <h2 className="text-kiosk-xl font-semibold mb-8">Enter Your PIN</h2>

      {livenessCheckFailed && (
        <div className="mb-8 bg-yellow-600/20 border-2 border-yellow-600/50 rounded-2xl px-8 py-4 max-w-xl mx-auto">
          <p className="text-kiosk-sm text-center">
            Face verification didn't work — please use your PIN instead
          </p>
        </div>
      )}

      <NumericKeypad
        value={pin}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
