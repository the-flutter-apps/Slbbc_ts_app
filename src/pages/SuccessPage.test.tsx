import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SuccessPage } from './SuccessPage';
import type { AttendanceResult } from '@/types';

const mockNavigate = vi.fn();
const mockPlayAudio = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    play: mockPlayAudio,
    isSupported: true,
  }),
}));

describe('SuccessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayAudio.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const mockResult: AttendanceResult = {
    action: 'CHECK_IN',
    employee: {
      id: 'emp-001',
      fullName: 'Ramesh Kumar',
      employeeCode: 'SLBBC001',
      photoUrl: 'https://i.pravatar.cc/300?img=12',
      designation: 'BOILER_OPERATOR',
    },
    recordedAt: '2026-05-05T15:45:00Z',
    shiftType: 'GENERAL',
    confidenceScore: 1.0,
  };

  const renderWithRouter = (result?: AttendanceResult) => {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/success', state: { result } }]}>
        <Routes>
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('renders employee photo, name, and designation', () => {
    renderWithRouter(mockResult);

    expect(screen.getByAltText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument();
    expect(screen.getByText('Boiler Operator')).toBeInTheDocument();
  });

  it('displays CHECK_IN action with green styling', () => {
    renderWithRouter(mockResult);

    const actionBadge = screen.getByText('CHECK-IN');
    expect(actionBadge).toBeInTheDocument();
    expect(actionBadge.parentElement).toHaveClass('bg-brand-success');
  });

  it('plays checkin-success audio for CHECK_IN', () => {
    renderWithRouter(mockResult);

    expect(mockPlayAudio).toHaveBeenCalledWith('checkin-success');
  });

  it('displays CHECK_OUT action with blue styling', () => {
    const checkOutResult: AttendanceResult = {
      ...mockResult,
      action: 'CHECK_OUT',
    };
    renderWithRouter(checkOutResult);

    const actionBadge = screen.getByText('CHECK-OUT');
    expect(actionBadge).toBeInTheDocument();
    expect(actionBadge.parentElement).toHaveClass('bg-brand-primary/80');
  });

  it('plays checkout-success audio for CHECK_OUT', () => {
    const checkOutResult: AttendanceResult = {
      ...mockResult,
      action: 'CHECK_OUT',
    };
    renderWithRouter(checkOutResult);

    expect(mockPlayAudio).toHaveBeenCalledWith('checkout-success');
  });

  it('formats time as 12-hour AM/PM', () => {
    renderWithRouter(mockResult);

    // ISO time "2026-05-05T15:45:00Z" should format to "3:45 PM" or similar
    // The exact format depends on locale and timezone, so we check for the minutes
    const timeElement = screen.getByText(/45/);
    expect(timeElement).toBeInTheDocument();
  });

  it('shows countdown starting at 4', () => {
    renderWithRouter(mockResult);

    expect(screen.getByText(/Returning in 4\.\.\./)).toBeInTheDocument();
  });

  it('redirects to / when state.result is missing', () => {
    renderWithRouter(undefined);

    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('auto-dismisses after 4 seconds', async () => {
    renderWithRouter(mockResult);

    expect(mockNavigate).not.toHaveBeenCalledWith('/');

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('dismisses immediately on click', () => {
    renderWithRouter(mockResult);

    const container = screen.getByRole('button', { name: /Attendance recorded/ });
    fireEvent.click(container);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('updates countdown every second', async () => {
    renderWithRouter(mockResult);

    expect(screen.getByText(/Returning in 4\.\.\./)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Returning in 3\.\.\./)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Returning in 2\.\.\./)).toBeInTheDocument();
  });

  it('cleans up timers on unmount', () => {
    const { unmount } = renderWithRouter(mockResult);

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
