import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericKeypad } from './NumericKeypad';

describe('NumericKeypad', () => {
  const mockOnChange = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    value: '',
    onChange: mockOnChange,
    onSubmit: mockOnSubmit,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 10 digit buttons (0-9)', () => {
    render(<NumericKeypad {...defaultProps} />);

    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: `Digit ${i}` })).toBeInTheDocument();
    }
  });

  it('renders Clear, Submit, Cancel buttons', () => {
    render(<NumericKeypad {...defaultProps} />);

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('clicking digit calls onChange with appended digit', () => {
    render(<NumericKeypad {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Digit 1' }));
    expect(mockOnChange).toHaveBeenCalledWith('1');

    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    expect(mockOnChange).toHaveBeenCalledWith('5');
  });

  it('does NOT append digit when at maxLength (4)', () => {
    render(<NumericKeypad {...defaultProps} value="1234" />);

    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('Clear button calls onChange with empty string', () => {
    render(<NumericKeypad {...defaultProps} value="123" />);

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('Submit button disabled when PIN length < 4', () => {
    render(<NumericKeypad {...defaultProps} value="123" />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
  });

  it('Submit button enabled when PIN length === 4', () => {
    render(<NumericKeypad {...defaultProps} value="1234" />);

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('clicking enabled Submit calls onSubmit with PIN', () => {
    render(<NumericKeypad {...defaultProps} value="1234" />);

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(mockOnSubmit).toHaveBeenCalledWith('1234');
  });

  it('Cancel button calls onCancel', () => {
    render(<NumericKeypad {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('PIN display shows correct number of filled/empty circles', () => {
    const { rerender } = render(<NumericKeypad {...defaultProps} value="" />);

    let circles = screen.getAllByRole('generic', { hidden: true }).filter((el) =>
      el.className.includes('rounded-full'),
    );
    expect(circles.filter((el) => el.className.includes('bg-white/20'))).toHaveLength(4);

    rerender(<NumericKeypad {...defaultProps} value="12" />);
    circles = screen.getAllByRole('generic', { hidden: true }).filter((el) =>
      el.className.includes('rounded-full'),
    );
    expect(circles.filter((el) => el.className.includes('bg-white') && !el.className.includes('bg-white/20'))).toHaveLength(2);
    expect(circles.filter((el) => el.className.includes('bg-white/20'))).toHaveLength(2);
  });

  it('disabled prop disables all buttons except Cancel', () => {
    render(<NumericKeypad {...defaultProps} value="1234" disabled />);

    for (let i = 0; i <= 9; i++) {
      expect(screen.getByRole('button', { name: `Digit ${i}` })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /submit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled();
  });
});
