// LIBERTA หัวหิน brand tokens — single source of truth for colors, fonts and
// corner radii. Every other place in the codebase (Tailwind config, UI
// components) must import from here rather than hardcoding hex values again.

export const colors = {
  /** Deep Forest Green — primary brand color */
  primary: '#2E4432',
  /** Dark Green — darker primary shade, used for headings/hover states */
  primaryDark: '#1A2A1D',
  /** Warm Gold/Beige — accent color for CTAs and highlights */
  accent: '#B49872',
  /** Cream — page background / light surfaces */
  cream: '#F5F0E3',
  /** Sage Gray — muted text, borders, disabled states */
  sageGray: '#6B7268',
  /** Sage Teal — secondary accent color */
  sageTeal: '#5A7A6E',
} as const;

// No external font files are bundled in this sandboxed environment — these
// stacks fall back to close system equivalents so the brand's serif/sans
// contrast still reads correctly fully offline (no Google Fonts fetch).
export const fontFamily = {
  serif: ['"Playfair Display"', 'Georgia', '"Times New Roman"', 'serif'],
  sans: ['Inter', '-apple-system', '"Segoe UI"', 'sans-serif'],
} as const;

export const radius = {
  /** Card corner radius per brand spec */
  card: '8px',
  /** Button corner radius per brand spec */
  button: '12px',
} as const;
