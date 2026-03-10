// src/config/roomPalette.js
// 20 room colors for calendar bars and room identity.
// Each entry: { name, bg (bar fill), text (dark label), border (mid accent) }

export const ROOM_PALETTE = [
  // ── Row 1 ──
  { name: 'Fiery Terracotta',  bg: '#F4442E', text: '#FFFFFF', border: '#D03520' },
  { name: 'Dark Raspberry',    bg: '#830A48', text: '#FFFFFF', border: '#6A0839' },
  { name: 'Light Cyan',        bg: '#D4F5F5', text: '#1A3333', border: '#B0D8D8' },
  { name: 'Honey Bronze',      bg: '#F6AE2D', text: '#3A2800', border: '#D49520' },
  { name: 'Cerulean',          bg: '#007090', text: '#FFFFFF', border: '#005A74' },

  // ── Row 2 ──
  { name: 'Emerald',           bg: '#86CB92', text: '#1A3320', border: '#6BB078' },
  { name: 'Midnight Violet',   bg: '#361134', text: '#FFFFFF', border: '#280D28' },
  { name: 'Cotton Rose',       bg: '#F7C1BB', text: '#3E1A14', border: '#D8A49E' },
  { name: 'Orchid Mist',       bg: '#B96AC9', text: '#FFFFFF', border: '#9C52AA' },
  { name: 'Laser Blue',        bg: '#2B59C3', text: '#FFFFFF', border: '#2248A0' },

  // ── Row 3 ──
  { name: 'Sage Green',        bg: '#679436', text: '#FFFFFF', border: '#537A2B' },
  { name: 'Lime Moss',         bg: '#A5BE00', text: '#2A3000', border: '#8AA000' },
  { name: 'Dusty Lavender',    bg: '#995D81', text: '#FFFFFF', border: '#7E4A6A' },
  { name: 'Blue Bell',         bg: '#5998C5', text: '#FFFFFF', border: '#4880A8' },
  { name: 'Almond Silk',       bg: '#E6CCBE', text: '#3A2E24', border: '#C8AE9E' },

  // ── Row 4 ──
  { name: 'Yale Blue',         bg: '#003D5B', text: '#FFFFFF', border: '#002E44' },
  { name: 'Bright Gold',       bg: '#FDE12D', text: '#3A3000', border: '#D8C020' },
  { name: 'Mauve Shadow',      bg: '#673C4F', text: '#FFFFFF', border: '#52303F' },
  { name: 'Wisteria Blue',     bg: '#89A6FB', text: '#0E1830', border: '#6E8CE0' },
  { name: 'Vibrant Coral',     bg: '#FE5F55', text: '#FFFFFF', border: '#D84E44' },
]

/** Look up a palette entry by name. Tries exact match first, then partial (legacy 'Sage' → 'Sage Green'). Falls back to first entry. */
export function getPaletteColor(name) {
  if (!name) return ROOM_PALETTE[0]
  return ROOM_PALETTE.find(c => c.name === name)
    ?? ROOM_PALETTE.find(c => c.name.toLowerCase().startsWith(name.toLowerCase()))
    ?? ROOM_PALETTE[0]
}

/** Get palette entry by index (for auto-assignment fallback). */
export function getPaletteByIndex(index) {
  return ROOM_PALETTE[index % ROOM_PALETTE.length]
}
