import {
  CAUTIOUS,
  RECKLESS,
  simulateGame,
  SimulationResult,
  Temperament,
} from '../simulation';
import { Phase } from '../types';

// `simulateGame` throws on the first broken rule after any action: 15 cards, no negative coins,
// nobody stuck, forced Coup, exactly one winner, eliminations and scores consistent, a clean
// database round trip, a rejected legal move, or no winner. Inputs are deep-frozen, so a
// mutation throws as well. Reaching an assertion means every game in the batch was clean.

const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const SKIP_PHASES: Phase[] = [
  'action',
  'awaitingResponses',
  'awaitingBlockResponses',
  'loseInfluence',
  'exchange',
];

function batch(
  players: number,
  mood: Temperament,
  firstSeed: number,
  games: number,
  skipChance: number,
): SimulationResult[] {
  return Array.from({ length: games }, (_, index) =>
    simulateGame(firstSeed + index, mood, { players, skipChance }),
  );
}

function totalSkips(results: SimulationResult[], phase: Phase): number {
  return results.reduce((sum, result) => sum + (result.skips[phase] ?? 0), 0);
}

describe('seeded games with 2 to 6 players', () => {
  it('is reproducible for a given seed, with and without skips', () => {
    const plain = simulateGame(11, RECKLESS, { players: 4 });
    expect(simulateGame(11, RECKLESS, { players: 4 }).end).toEqual(plain.end);
    const skipping = simulateGame(11, RECKLESS, {
      players: 4,
      skipChance: 0.3,
    });
    expect(
      simulateGame(11, RECKLESS, { players: 4, skipChance: 0.3 }).end,
    ).toEqual(skipping.end);
  });

  it.each(PLAYER_COUNTS)(
    '60 games with %i players and no skips all end with one winner',
    players => {
      const results = [
        ...batch(players, CAUTIOUS, 100 * players, 30, 0),
        ...batch(players, RECKLESS, 100 * players + 50, 30, 0),
      ];
      results.forEach(result => {
        expect(result.end.status).toBe('finished');
        expect(result.end.eliminations).toHaveLength(players - 1);
        expect(result.end.scores).toEqual({ [result.winner]: 1 });
        expect(result.actions).toBeGreaterThanOrEqual(players - 1);
      });
      expect(
        new Set(results.map(result => result.winner)).size,
      ).toBeGreaterThan(1);
    },
  );

  it.each(PLAYER_COUNTS)(
    '80 games with %i players and random host skips keep every rule intact',
    players => {
      const results = [
        ...batch(players, CAUTIOUS, 1000 * players, 40, 0.25),
        ...batch(players, RECKLESS, 1000 * players + 500, 40, 0.25),
      ];
      results.forEach(result => {
        expect(result.end.status).toBe('finished');
        expect(result.end.eliminations).toHaveLength(players - 1);
        expect(result.end.scores).toEqual({ [result.winner]: 1 });
      });
      // The skips really happened, in every kind of wait.
      SKIP_PHASES.forEach(phase =>
        expect(totalSkips(results, phase)).toBeGreaterThan(0),
      );
    },
  );

  it('a game where the host skips every single wait still ends with a winner', () => {
    PLAYER_COUNTS.forEach(players => {
      const result = simulateGame(players, CAUTIOUS, {
        players,
        skipChance: 1,
      });
      expect(result.end.status).toBe('finished');
      // Nobody ever claims anything: only Income and forced Coups happen.
      expect(result.skips.action).toBe(
        Object.values(result.skips).reduce((sum, n) => sum + (n ?? 0), 0) -
          (result.skips.loseInfluence ?? 0),
      );
      expect(result.end.revealSeq).toBe(0);
    });
  });
});
