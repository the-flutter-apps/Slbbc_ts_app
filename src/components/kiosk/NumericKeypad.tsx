import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
  maxLength?: number;
  disabled?: boolean;
}

export function NumericKeypad({
  value,
  onChange,
  onSubmit,
  onCancel,
  maxLength = 4,
  disabled = false,
}: NumericKeypadProps) {
  const handleDigitClick = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleClear = () => {
    onChange('');
  };

  const handleSubmit = () => {
    if (value.length === maxLength) {
      onSubmit(value);
    }
  };

  const isSubmitEnabled = value.length === maxLength && !disabled;

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="flex flex-col items-center gap-8">
      {/* PIN Display */}
      <div className="flex gap-4" aria-live="polite" aria-label={`PIN entered: ${value.length} of ${maxLength} digits`}>
        {Array.from({ length: maxLength }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'w-6 h-6 rounded-full transition-colors',
              index < value.length ? 'bg-white' : 'bg-white/20',
            )}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Digits 1-9 */}
        {digits.map((digit) => (
          <Button
            key={digit}
            size="kiosk"
            variant="primary"
            onClick={() => handleDigitClick(digit)}
            disabled={disabled}
            aria-label={`Digit ${digit}`}
          >
            {digit}
          </Button>
        ))}

        {/* Bottom Row: Clear, 0, Submit */}
        <Button
          size="kiosk"
          variant="ghost"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear PIN"
          className="text-kiosk-base"
        >
          Clear
        </Button>

        <Button
          size="kiosk"
          variant="primary"
          onClick={() => handleDigitClick('0')}
          disabled={disabled}
          aria-label="Digit 0"
        >
          0
        </Button>

        <Button
          size="kiosk"
          variant="success"
          onClick={handleSubmit}
          disabled={!isSubmitEnabled}
          aria-label="Submit PIN"
          className={cn(
            'text-kiosk-base',
            !isSubmitEnabled && 'bg-ink-300 hover:bg-ink-300',
          )}
        >
          Submit
        </Button>
      </div>

      {/* Cancel Button */}
      <Button
        size="lg"
        variant="secondary"
        onClick={onCancel}
        aria-label="Cancel and return to home"
        className="mt-4"
      >
        Cancel
      </Button>
    </div>
  );
}
