import { addPlayer, kickPlayer, newGame, rematch } from '../lobby';
import { normalizeGame } from '../serialize';
import { identityRng, makeGame, play } from '../testHelpers';
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

  it('round-trips the round number and the lobby scores', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const game = play(
      { ...start, round: 3, scores: { b: 2 } },
      { type: 'coup', playerId: 'a', target: 'b' },
    );
    expect(game.scores).toEqual({ a: 1, b: 2 });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips the lobby a rematch returns to', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const lobby = rematch(
      play(start, { type: 'coup', playerId: 'a', target: 'b' }),
      'a',
      identityRng,
    );
    expect(normalizeGame(firebaseLike(lobby))).toEqual(lobby);
  });

  it('round-trips a lobby with a kicked player', () => {
    const lobby = kickPlayer(
      addPlayer(newGame('p1', 'P1', 'ABCDE', 1000), 'p2', 'P2'),
      'p1',
      'p2',
    );
    expect(lobby.kicked).toEqual({ p2: true });
    expect(normalizeGame(firebaseLike(lobby))).toEqual(lobby);
  });

  it('defaults a game stored before rounds existed to round 1 with no scores', () => {
    const raw = firebaseLike(three()) as Record<string, unknown>;
    delete raw.round;
    delete raw.scores;
    delete raw.revealSeq;
    const game = normalizeGame(raw);
    expect(game.round).toBe(1);
    expect(game.scores).toEqual({});
    expect(game.eliminations).toEqual([]);
    expect(game.reveal).toBeNull();
    expect(game.revealSeq).toBe(0);
  });

  it('round-trips a reveal whose flags are both false', () => {
    const game = play(
      three(),
      { type: 'exchange', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(game.reveal).toMatchObject({ truthful: false, block: false });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a reveal whose flags are both true', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'c', claim: 'Duke' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(game.reveal).toMatchObject({ truthful: true, block: true });
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips eliminations, including one nobody caused', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'], c: ['Assassin', 'Duke'] },
      { coins: { a: 7 } },
    );
    const game = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
    expect(normalizeGame(firebaseLike(game))).toEqual(game);

    const uncaused = {
      ...game,
      eliminations: [{ playerId: 'b', by: null, turn: 1 }],
    };
    expect(normalizeGame(firebaseLike(uncaused))).toEqual(uncaused);
  });

  it('accepts eliminations that Firebase returned as a keyed object', () => {
    const raw = firebaseLike(three()) as Record<string, unknown>;
    raw.eliminations = { 0: { playerId: 'b', by: 'a', turn: 4 } };
    expect(normalizeGame(raw).eliminations).toEqual([
      { playerId: 'b', by: 'a', turn: 4 },
    ]);
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

  it('drops playerOrder ids that have no player entry', () => {
    const raw = firebaseLike(three()) as Record<string, any>;
    raw.playerOrder = ['a', 'ghost', 'b', 'c'];
    const game = normalizeGame(raw);
    expect(game.playerOrder).toEqual(['a', 'b', 'c']);
  });
});
