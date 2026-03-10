// src/config/chartTokens.js
// Centralized color tokens for Recharts components.
// Uses CSS custom property values so charts stay in sync with the design system.

export const CHART_COLORS = {
  info: '#1D4ED8',       // var(--color-info)
  infoBg: '#DBEAFE',     // var(--color-info-bg)
  success: '#15803D',    // var(--color-success)
  border: '#D1D0CB',     // var(--color-border)
  textSecondary: '#555555', // var(--color-text-secondary)
  textMuted: '#888888',  // var(--color-text-muted)
}

export const CHART_AXIS_TICK = {
  fontFamily: 'IBM Plex Sans',
  fontSize: 12,
  fill: CHART_COLORS.textSecondary,
}

export const CHART_AXIS_TICK_MONO = {
  fontFamily: 'IBM Plex Mono',
  fontSize: 11,
  fill: CHART_COLORS.textMuted,
}

export const CHART_GRID_STROKE = CHART_COLORS.border
