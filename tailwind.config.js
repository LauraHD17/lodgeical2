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
      white: '#FFFFFF',
      black: '#000000',

      // Design tokens
      background: '#E8E8E8',
      surface: '#F4F4F4',
      'surface-raised': '#FFFFFF',
      border: '#D4D4D4',
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
      tableAlt: '#ECEEF1',
    },
    extend: {
      fontFamily: {
        heading: ['Questrial', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
