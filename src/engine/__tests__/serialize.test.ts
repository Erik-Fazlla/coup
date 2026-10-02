import { newGame } from '../lobby';
import { normalizeGame } from '../serialize';
import { makeGame, play } from '../testHelpers';
import { IllegalActionError } from '../types';

/** Mimics what Realtime Database does to a value: nulls, empty arrays and empty objects vanish. */
function firebaseLike(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(firebaseLike);
    return items.length === 0 ? undefined : items;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const converted = firebaseLike(child);
      if (converted !== undefined) {
        out[key] = converted;
      }
    });
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

const three = () =>
  makeGame({
    a: ['Duke', 'Captain'],
    b: ['Contessa', 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });

describe('normalizeGame', () => {
  it('round-trips a waiting game', () => {
    const game = newGame('p1', 'P1', 'ABCDE', 1000);
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game awaiting responses', () => {
    const game = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game with a pending block', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game waiting for a card to be lost', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: 7, b: 0 } },
    );
    const game = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips an exchange in progress with an empty deck', () => {
    const start = makeGame(
      {
        a: ['Ambassador', 'Duke'],
        b: ['Contessa', 'Assassin'],
        c: ['Captain', 'Duke'],
      },
      { deck: ['Contessa', 'Assassin'] },
    );
    const game = play(
      start,
      { type: 'exchange', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(game.deck).toEqual([]);
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a finished game', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const game = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('throws a typed error when the game does not exist', () => {
    expect(() => normalizeGame(null)).toThrow(IllegalActionError);
    expect(() => normalizeGame(undefined)).toThrow('Game not found');
  });

  it('accepts arrays that Firebase returned as keyed objects', () => {
    const raw = firebaseLike(three()) as Record<string, unknown>;
    raw.playerOrder = { 0: 'a', 1: 'b', 2: 'c' };
    expect(normalizeGame(raw).playerOrder).toEqual(['a', 'b', 'c']);
  });
});
