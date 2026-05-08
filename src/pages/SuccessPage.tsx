import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { AttendanceResult } from '@/types';
import { UI } from '@/lib/constants';
import { formatTime12Hour, formatDesignation } from '@/lib/utils/formatters';
import { cn } from '@/lib/cn';
import { useAudio } from '@/hooks/useAudio';

export function SuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [countdown, setCountdown] = useState(Math.floor(UI.SUCCESS_AUTO_DISMISS_MS / 1000));
  const { play } = useAudio();

  // Type-safe state extraction with guard
  const state = location.state as { result?: AttendanceResult } | null;
  const result = state?.result;

  // Debug logging
  useEffect(() => {
    console.log('[SuccessPage] Received state:', state);
    console.log('[SuccessPage] Extracted result:', result);
  }, [state, result]);

  // Redirect immediately if no valid state
  useEffect(() => {
    if (!result) {
      console.log('[SuccessPage] No result found, redirecting to home');
      navigate('/', { replace: true });
    } else {
      console.log('[SuccessPage] Showing success for:', result.employee.fullName, result.action);
    }
  }, [result, navigate]);

  // Play success audio
  useEffect(() => {
    if (!result) return;

    const audioPrompt = result.action === 'CHECK_IN' ? 'checkin-success' : 'checkout-success';
    play(audioPrompt);
  }, [result, play]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!result) return;

    const redirectTimer = setTimeout(() => {
      navigate('/');
    }, UI.SUCCESS_AUTO_DISMISS_MS);

    return () => clearTimeout(redirectTimer);
  }, [result, navigate]);

  // Countdown ticker
  useEffect(() => {
    if (!result) return;

    const countdownTimer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [result]);

  const handleDismiss = () => {
    navigate('/');
  };

  // Guard render - don't show anything if redirecting
  if (!result) {
    return null;
  }

  const { action, employee } = result;
  const isCheckIn = action === 'CHECK_IN';

  return (
    <div
      className="kiosk-container bg-brand-primary text-white cursor-pointer"
      onClick={handleDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleDismiss()}
      aria-label="Attendance recorded. Tap to continue."
    >
      {/* Success Checkmark */}
      <div className="text-kiosk-3xl mb-8 text-brand-success animate-fade-in">✓</div>

      {/* Employee Photo */}
      <img
        src={employee.photoUrl}
        alt={employee.fullName}
        className="w-52 h-52 rounded-full mb-8 object-cover border-4 border-white/20 animate-fade-in"
      />

      {/* Employee Name */}
      <h2 className="text-kiosk-xl font-bold mb-2 animate-slide-up">{employee.fullName}</h2>

      {/* Designation */}
      <p className="text-kiosk-sm text-white/70 mb-8 animate-slide-up">
        {formatDesignation(employee.designation)}
      </p>

      {/* Action Badge */}
      <div
        className={cn(
          'px-12 py-4 rounded-full mb-6 animate-slide-up',
          isCheckIn ? 'bg-brand-success' : 'bg-brand-primary/80 border-2 border-white/30',
        )}
      >
        <span className="text-kiosk-2xl font-bold">
          {action === 'CHECK_IN' ? 'CHECK-IN' : 'CHECK-OUT'}
        </span>
      </div>

      {/* Time */}
      <p className="text-kiosk-lg text-white/90 mb-12 animate-slide-up">
        {formatTime12Hour(result.recordedAt)}
      </p>

      {/* Countdown */}
      <div className="text-kiosk-xs text-white/60 space-y-1">
        <p>Returning in {countdown}...</p>
        <p>Tap anywhere to continue</p>
      </div>
    </div>
  );
}
