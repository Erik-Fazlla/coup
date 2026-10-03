import { Card } from './engine/types';

export const colors = {
  background: '#000000',
  /** Panels and seats resting on the table. */
  surface: '#131316',
  /** Tiles and buttons that sit on a panel. */
  surfaceRaised: '#1d1d22',
  border: '#2b2b31',
  borderStrong: '#4a4a55',
  text: '#ffffff',
  muted: '#a1a1aa',
  /** Decoration only: too dim for text that must be read. */
  faint: '#71717a',
  /** "This is you / tap here". Never used for anything else. */
  primary: '#22d3ee',
  primaryFill: '#06323a',
  secondary: '#4b5563',
  danger: '#f87171',
  dangerFill: '#4a1414',
  coin: '#f5c542',
  coinShade: '#a67c00',
  onLight: '#000000',
  scrim: 'rgba(0, 0, 0, 0.9)',
  /** Thin edge that lifts a coloured tile off the black table. */
  edge: 'rgba(255, 255, 255, 0.12)',
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
