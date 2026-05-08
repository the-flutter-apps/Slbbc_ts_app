import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'kiosk';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-2xl font-semibold',
          'transition-all duration-150 active:scale-95',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',

          // Variants
          {
            'bg-brand-accent text-white hover:bg-brand-accent/90': variant === 'primary',
            'bg-white/10 text-white hover:bg-white/20': variant === 'secondary',
            'bg-brand-success text-white hover:bg-brand-success/90': variant === 'success',
            'bg-brand-danger text-white hover:bg-brand-danger/90': variant === 'danger',
            'bg-transparent text-white hover:bg-white/10': variant === 'ghost',
          },

          // Sizes
          {
            'px-4 py-2 text-kiosk-xs': size === 'sm',
            'px-6 py-3 text-kiosk-sm': size === 'md',
            'px-8 py-4 text-kiosk-base': size === 'lg',
            'w-tap-lg h-tap-lg text-kiosk-xl': size === 'kiosk',
          },

          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
