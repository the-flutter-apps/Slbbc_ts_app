import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NumericKeypad } from '@/components/kiosk/NumericKeypad';
import { getMockAttendanceResult } from '@/lib/mockData';
import { useAudio } from '@/hooks/useAudio';

export function PinEntryPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const { play } = useAudio();

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
      <h2 className="text-kiosk-xl font-semibold mb-12">Enter Your PIN</h2>

      <NumericKeypad
        value={pin}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
