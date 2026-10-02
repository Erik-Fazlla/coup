import {
  addPlayer,
  generateCode,
  MAX_NAME_LENGTH,
  newGame,
  removePlayer,
  startGame,
} from '../lobby';
import { Game, IllegalActionError } from '../types';

const identityRng = () => 0.999999;

function lobby(playerCount: number): Game {
  let game = newGame('p1', 'P1', 'ABCDE', 1000);
  for (let i = 2; i <= playerCount; i++) {
    game = addPlayer(game, `p${i}`, `P${i}`);
  }
  return game;
}

const NAME_ERROR = 'Enter a name (1-16 characters)';
const invalidNames: [string, unknown][] = [
  ['empty', ''],
  ['blank', '   '],
  ['too long', 'x'.repeat(MAX_NAME_LENGTH + 1)],
  ['too long with padding', ` ${'x'.repeat(MAX_NAME_LENGTH + 1)} `],
  ['undefined', undefined],
  ['null', null],
  ['a number', 42],
];

describe('MAX_NAME_LENGTH', () => {
  it('is 16', () => {
    expect(MAX_NAME_LENGTH).toBe(16);
  });
});

describe('newGame', () => {
  it('trims the host name', () => {
    expect(newGame('p1', '  Ann  ', 'ABCDE', 1).players.p1.name).toBe('Ann');
  });

  it('accepts a name of exactly the maximum length', () => {
    const name = 'x'.repeat(MAX_NAME_LENGTH);
    expect(newGame('p1', name, 'ABCDE', 1).players.p1.name).toBe(name);
  });

  it.each(invalidNames)('rejects a host name that is %s', (_label, name) => {
    expect(() => newGame('p1', name as string, 'ABCDE', 1)).toThrow(
      IllegalActionError,
    );
    expect(() => newGame('p1', name as string, 'ABCDE', 1)).toThrow(NAME_ERROR);
  });

  it('creates a waiting game with the host as only player', () => {
    const game = newGame('p1', 'P1', 'ABCDE', 1000);
    expect(game.status).toBe('waiting');
    expect(game.host).toBe('p1');
    expect(game.code).toBe('ABCDE');
    expect(game.playerOrder).toEqual(['p1']);
    expect(game.players.p1).toEqual({
      name: 'P1',
      coins: 2,
      influence: [],
      eliminatedAt: null,
    });
    expect(game.createdAt).toBe(1000);
    expect(game.winner).toBeNull();
  });
});

describe('addPlayer', () => {
  it('adds players in join order without mutating the input', () => {
    const before = lobby(1);
    const after = addPlayer(before, 'p2', 'P2');
    expect(after.playerOrder).toEqual(['p1', 'p2']);
    expect(after.players.p2.name).toBe('P2');
    expect(before.playerOrder).toEqual(['p1']);
  });

  it('returns the same game when the player is already in it', () => {
    const game = lobby(2);
    expect(addPlayer(game, 'p2', 'Other name')).toBe(game);
  });

  it('lets a player rejoin without validating the name again', () => {
    const game = lobby(2);
    expect(addPlayer(game, 'p2', '')).toBe(game);
    expect(addPlayer(game, 'p2', undefined as any)).toBe(game);
  });

  it('trims the name', () => {
    expect(addPlayer(lobby(1), 'p2', '  Bo ').players.p2.name).toBe('Bo');
  });

  it('accepts a name of exactly the maximum length', () => {
    const name = 'x'.repeat(MAX_NAME_LENGTH);
    expect(addPlayer(lobby(1), 'p2', name).players.p2.name).toBe(name);
  });

  it.each(invalidNames)('rejects a joining name that is %s', (_label, name) => {
    const before = lobby(1);
    expect(() => addPlayer(before, 'p2', name as string)).toThrow(
      IllegalActionError,
    );
    expect(() => addPlayer(before, 'p2', name as string)).toThrow(NAME_ERROR);
    expect(before.playerOrder).toEqual(['p1']);
  });

  it('rejects a seventh player', () => {
    expect(() => addPlayer(lobby(6), 'p7', 'P7')).toThrow('Game is full');
  });

  it('rejects new players once started but lets existing players rejoin', () => {
    const started = startGame(lobby(2), 'p1', identityRng);
    expect(() => addPlayer(started, 'p3', 'P3')).toThrow(
      'Game already started',
    );
    expect(addPlayer(started, 'p2', 'P2')).toBe(started);
  });
});

describe('removePlayer', () => {
  it('removes a non-host player from a waiting game', () => {
    const after = removePlayer(lobby(3), 'p2');
    expect(after.playerOrder).toEqual(['p1', 'p3']);
    expect(after.players.p2).toBeUndefined();
  });

  it('leaves the game unchanged for the host or once started', () => {
    const waiting = lobby(2);
    expect(removePlayer(waiting, 'p1')).toBe(waiting);
    const started = startGame(waiting, 'p1', identityRng);
    expect(removePlayer(started, 'p2')).toBe(started);
  });
});

describe('startGame', () => {
  it('deals two cards each and starts with the first player', () => {
    const game = startGame(lobby(3), 'p1', identityRng);
    expect(game.status).toBe('playing');
    expect(game.state).toEqual({
      phase: 'action',
      currentTurnPlayer: 'p1',
      turnNumber: 1,
      pending: null,
      lastAction: null,
      claimSeq: 0,
    });
    expect(game.players.p1.influence).toEqual([
      { card: 'Duke', revealed: false },
      { card: 'Duke', revealed: false },
    ]);
    expect(game.players.p2.influence.map(i => i.card)).toEqual([
      'Duke',
      'Assassin',
    ]);
    expect(game.players.p3.influence.map(i => i.card)).toEqual([
      'Assassin',
      'Assassin',
    ]);
    expect(game.deck).toHaveLength(9);
    expect(game.players.p3.coins).toBe(2);
  });

  it('only lets the host start', () => {
    expect(() => startGame(lobby(2), 'p2', identityRng)).toThrow(
      'Only the host can start the game',
    );
  });

  it('needs at least two players', () => {
    expect(() => startGame(lobby(1), 'p1', identityRng)).toThrow(
      'Need at least 2 players',
    );
  });

  it('cannot start twice', () => {
    const started = startGame(lobby(2), 'p1', identityRng);
    expect(() => startGame(started, 'p1', identityRng)).toThrow(
      'Game already started',
    );
  });
});

describe('generateCode', () => {
  it('produces 5 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode(Math.random)).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/,
      );
    }
  });

  it('is driven by the injected rng', () => {
    expect(generateCode(() => 0)).toBe('AAAAA');
  });
});
