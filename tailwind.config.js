/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0b0d12',
          soft: '#11141b',
          hard: '#060810',
        },
        panel: '#161a23',
        line: '#252a36',
        ink: '#e6e8ee',
        muted: '#8a90a0',
        accent: {
          DEFAULT: '#6366f1',
          warm: '#f97316',
          cool: '#22d3ee',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
