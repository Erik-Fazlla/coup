import { Card } from './engine/types';

/** The intro's colours. Cyan stays the one "this is you / tap here" colour. */
export const neon = {
  cyan: '#00E5FF',
  blue: '#1E6BFF',
  /** Headings and titles that glow. */
  ice: '#E6FDFF',
  /** Secondary text on a glowing surface. */
  mist: '#BFF7FF',
};

/** Box shadows (React Native `boxShadow`) for the neon glow. */
export const glow = {
  /** Something that is yours or can be tapped. */
  cyan: '0 0 14px rgba(0, 229, 255, 0.45)',
  /** A main button. */
  blue: '0 0 16px rgba(30, 107, 255, 0.75)',
  /** A quiet edge glow on panels. */
  soft: '0 0 10px rgba(0, 229, 255, 0.18)',
  /** A face-down card. */
  cardBack: '0 0 6px rgba(0, 229, 255, 0.45)',
  /** The card picked in a choice. */
  white: '0 0 18px rgba(255, 255, 255, 0.55)',
  /** A destructive button under the finger. */
  danger: '0 0 14px rgba(248, 113, 113, 0.55)',
  /** The player whose turn it is. */
  gold: '0 0 12px rgba(245, 197, 66, 0.45)',
};

/** Text glow for big titles ("COUP", "You won"). */
export const glowText = {
  textShadowColor: neon.cyan,
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 16,
};

export const colors = {
  background: '#000000',
  /** Panels and seats resting on the table: see-through, so the haze shows a little. */
  surface: 'rgba(0, 20, 27, 0.72)',
  /** Tiles and buttons that sit on a panel. */
  surfaceRaised: '#071a20',
  /** The solid fill of a sheet drawn over the table. */
  sheet: '#020b0e',
  border: 'rgba(0, 229, 255, 0.18)',
  borderStrong: 'rgba(0, 229, 255, 0.42)',
  text: '#ffffff',
  muted: '#9db7bd',
  /** Decoration only: too dim for text that must be read. */
  faint: '#5f7c82',
  /** "This is you / tap here". Never used for anything else. */
  primary: '#00E5FF',
  primaryFill: '#03303a',
  secondary: '#4b5563',
  danger: '#f87171',
  dangerFill: '#4a1414',
  coin: '#f5c542',
  coinShade: '#a67c00',
  /** A player who is connected, and a number that just went up. */
  positive: '#4ade80',
  onLight: '#000000',
  scrim: 'rgba(0, 0, 0, 0.9)',
  /** Behind a short-lived overlay: the table stays visible through it. */
  scrimLight: 'rgba(0, 0, 0, 0.72)',
  /** Thin edge that lifts a coloured tile off the black table. */
  edge: 'rgba(0, 229, 255, 0.35)',
  /** Dark well behind a glyph on a coloured card. */
  well: 'rgba(0, 0, 0, 0.32)',
};

export interface CharacterPalette {
  /** Card and tile background. */
  fill: string;
  /** Glyph, border and secondary text on that background. */
  accent: string;
}

/** One colour per character: its card, its action tile and its block tile all share it. */
export const characterColors: Record<Card, CharacterPalette> = {
  Duke: { fill: '#3C3489', accent: '#CECBF6' },
  Assassin: { fill: '#444441', accent: '#F09595' },
  Captain: { fill: '#0C447C', accent: '#B5D4F4' },
  Ambassador: { fill: '#27500A', accent: '#C0DD97' },
  Contessa: { fill: '#791F1F', accent: '#F7C1C1' },
};

/** Actions anyone may take without claiming a character. */
export const neutralPalette: CharacterPalette = {
  fill: colors.surfaceRaised,
  accent: colors.coin,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

export const typography = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: 8 },
  title: { fontSize: 26, fontWeight: '800' },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700' },
  caption: { fontSize: 12 },
  micro: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
} as const;

/** Smallest side of anything that can be tapped. */
export const TOUCH_MIN = 44;

/** Font-scale cap for text inside fixed-size tiles, seats and cards, so a large system font cannot push actions off screen. */
export const DENSE_FONT_SCALE = 1.15;

/** Font-scale cap for text that has room to grow (banner, log, forms). */
export const READING_FONT_SCALE = 1.3;
