import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tailwind CSS Configuration
 *
 * Design System: Grok/X Style
 * - Lights Out: Pure black (#000000) with X Blue (#1D9BF0) accent
 * - Dim: #15202B alternative dark theme
 * - System font stack matching X/Twitter
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base colors (shadcn/ui compatible)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Semantic colors (Grok/X style)
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },

        // Chart colors for data visualization
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
          6: 'hsl(var(--chart-6))',
        },

        // X/Grok specific named colors
        'x-blue': '#1D9BF0',
        'x-green': '#00BA7C',
        'x-red': '#F4212E',
        'x-yellow': '#FFAD1F',
        'x-purple': '#7856FF',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      fontFamily: {
        // X/Twitter system font stack
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // X/Twitter typography scale
        xs: ['0.75rem', { lineHeight: '1rem' }], // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px
        base: ['0.9375rem', { lineHeight: '1.5rem' }], // 15px
        lg: ['1.0625rem', { lineHeight: '1.75rem' }], // 17px
        xl: ['1.25rem', { lineHeight: '1.75rem' }], // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }], // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.5rem', { lineHeight: '2.75rem' }], // 40px
      },
      spacing: {
        // Extended spacing for larger components
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      keyframes: {
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(10px)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.95)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'slide-in': 'slide-in 200ms ease-out',
        'slide-out': 'slide-out 200ms ease-in',
        'fade-in': 'fade-in 200ms ease-out',
        'fade-out': 'fade-out 200ms ease-in',
        'scale-in': 'scale-in 200ms ease-out',
        'scale-out': 'scale-out 200ms ease-in',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        shimmer: 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      boxShadow: {
        // X/Grok style shadows
        'glow-sm': '0 0 10px hsl(var(--primary) / 0.2)',
        'glow-md': '0 0 20px hsl(var(--primary) / 0.3)',
        'glow-lg': '0 0 40px hsl(var(--primary) / 0.4)',
        'inner-glow': 'inset 0 0 20px hsl(var(--primary) / 0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionDuration: {
        '50': '50ms',
        '250': '250ms',
        '400': '400ms',
      },
    },
  },
  plugins: [animate],
};

export default config;
