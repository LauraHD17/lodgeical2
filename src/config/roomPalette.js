// src/config/roomPalette.js
// 18 room colors for calendar bars and room identity.
// Bold + muted mix — punchy, legible, fun.
// Each entry: { name, bg (bar fill), text (dark label), border (mid accent) }

export const ROOM_PALETTE = [
  // ── Bold & punchy ──
  { name: 'Poppy',      bg: '#E85028', text: '#FFFFFF', border: '#C23A16' },
  { name: 'Marigold',   bg: '#E8A817', text: '#3A2800', border: '#C48E10' },
  { name: 'Electric',   bg: '#2563EB', text: '#FFFFFF', border: '#1D4FBF' },
  { name: 'Magenta',    bg: '#C026D3', text: '#FFFFFF', border: '#9B1FAA' },
  { name: 'Chartreuse', bg: '#84CC16', text: '#1A3300', border: '#65A30D' },
  { name: 'Tangerine',  bg: '#F97316', text: '#FFFFFF', border: '#D4610F' },

  // ── Rich & saturated ──
  { name: 'Indigo',     bg: '#4338CA', text: '#FFFFFF', border: '#3730A3' },
  { name: 'Crimson',    bg: '#BE123C', text: '#FFFFFF', border: '#9F1239' },
  { name: 'Teal',       bg: '#0D9488', text: '#FFFFFF', border: '#0F766E' },
  { name: 'Violet',     bg: '#7C3AED', text: '#FFFFFF', border: '#6D28D9' },
  { name: 'Forest',     bg: '#15803D', text: '#FFFFFF', border: '#166534' },
  { name: 'Cobalt',     bg: '#1E40AF', text: '#FFFFFF', border: '#1E3A8A' },

  // ── Muted & earthy ──
  { name: 'Sage',       bg: '#A3B898', text: '#1A2E14', border: '#8CA37C' },
  { name: 'Clay',       bg: '#C09474', text: '#3E2410', border: '#A87C5C' },
  { name: 'Denim',      bg: '#8498B8', text: '#0E1830', border: '#6B80A4' },
  { name: 'Rust',       bg: '#C48C58', text: '#3C2008', border: '#A87040' },
  { name: 'Slate',      bg: '#96A0AD', text: '#1A2030', border: '#78869A' },
  { name: 'Sand',       bg: '#C2B48E', text: '#3A3018', border: '#A89A70' },
]

/** Look up a palette entry by name. Falls back to first entry. */
export function getPaletteColor(name) {
  return ROOM_PALETTE.find(c => c.name === name) ?? ROOM_PALETTE[0]
}

/** Get palette entry by index (for auto-assignment fallback). */
export function getPaletteByIndex(index) {
  return ROOM_PALETTE[index % ROOM_PALETTE.length]
}
