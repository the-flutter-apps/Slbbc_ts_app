import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // SLBBC brand palette
        brand: {
          primary: '#0E3A5F', // Industrial blue
          secondary: '#3B4A55', // Steel gray
          accent: '#F26B1F', // Safety orange
          success: '#1F7A3A',
          danger: '#C62828',
          warning: '#F4A623',
        },
        surface: {
          0: '#FFFFFF',
          1: '#F5F7FA',
          2: '#E8EDF2',
        },
        ink: {
          900: '#1A1F2A',
          700: '#3B4A55',
          500: '#5C6772',
          300: '#9AA4B0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Kiosk-friendly scale: bigger than typical web app
        'kiosk-xs': ['1rem', { lineHeight: '1.5' }],
        'kiosk-sm': ['1.25rem', { lineHeight: '1.5' }],
        'kiosk-base': ['1.5rem', { lineHeight: '1.5' }],
        'kiosk-lg': ['2rem', { lineHeight: '1.4' }],
        'kiosk-xl': ['3rem', { lineHeight: '1.2' }],
        'kiosk-2xl': ['4rem', { lineHeight: '1.1' }],
        'kiosk-3xl': ['6rem', { lineHeight: '1' }],
      },
      spacing: {
        // Big tap targets for kiosk
        'tap-sm': '4rem', // 64px
        'tap-md': '5rem', // 80px
        'tap-lg': '6rem', // 96px
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 250ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
