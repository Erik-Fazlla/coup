import {Card, CARDS} from './types';

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export function buildDeck(): Card[] {
  return CARDS.flatMap(card => [card, card, card]);
}

/** Fisher–Yates. Returns a new array. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
