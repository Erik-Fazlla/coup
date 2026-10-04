import { Card, CARDS } from './types';

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

/** From this many players on, the game is played with the larger deck. */
export const LARGE_GAME_FROM = 7;

/** Copies of each character in the deck: 3 for 2 to 6 players, 4 for 7 to 10. */
export function copiesPerCharacter(playerCount: number): number {
  return playerCount >= LARGE_GAME_FROM ? 4 : 3;
}

/** Cards in the whole game (deck and hands together) for this many players: 15 or 20. */
export function deckSize(playerCount: number): number {
  return CARDS.length * copiesPerCharacter(playerCount);
}

export function buildDeck(playerCount: number): Card[] {
  const copies = copiesPerCharacter(playerCount);
  return CARDS.flatMap(card => Array.from({ length: copies }, () => card));
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
