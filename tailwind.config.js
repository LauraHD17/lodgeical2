/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './stories/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    // Reset ALL default colors — only design tokens exist
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FAFAF7',
      black: '#000000',

      // Design tokens — e-ink warm
      background: '#EAEAE6',
      surface: '#F2F1ED',
      'surface-raised': '#FAFAF7',
      border: '#D1D0CB',
      'text-primary': '#1A1A1A',
      'text-secondary': '#555555',
      'text-muted': '#888888',
      success: '#15803D',
      'success-bg': '#DCFCE7',
      warning: '#B45309',
      'warning-bg': '#FEF3C7',
      danger: '#BE123C',
      'danger-bg': '#FFE4E6',
      info: '#1D4ED8',
      'info-bg': '#DBEAFE',
      tableAlt: '#EDECE8',
    },
    extend: {
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
