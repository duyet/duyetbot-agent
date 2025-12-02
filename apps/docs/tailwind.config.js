/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx,mdx}',
    './src/**/*.{ts,tsx,mdx}',
    '../../docs/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.02)', opacity: '1' },
        },
        'flow-pulse': {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(168, 85, 247, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)' },
        },
        'dot-flow': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        breathe: 'breathe 4s ease-in-out infinite',
        'flow-pulse': 'flow-pulse 2s linear infinite',
        'slide-in': 'slide-in 200ms ease-out',
        'fade-in': 'fade-in 300ms ease-out',
        glow: 'glow 2s ease-in-out infinite',
        'dot-flow': 'dot-flow 3s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
