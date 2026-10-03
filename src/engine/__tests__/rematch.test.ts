import { addPlayer, newGame, rematch, startGame } from '../lobby';
import { deepFreeze, identityRng, makeGame, play } from '../testHelpers';
import { Game, IllegalActionError } from '../types';

/** A three-player game that `a` (the host) has just won, with a claim having been opened on the way. */
function finished(): Game {
  const start = makeGame(
    { a: ['Duke', 'Captain'], b: ['Contessa'], c: ['Assassin'] },
    { coins: { a: 14 } },
  );
  return play(
    start,
    { type: 'coup', playerId: 'a', target: 'b' },
    { type: 'foreignAid', playerId: 'c' },
    { type: 'pass', playerId: 'a' },
    { type: 'coup', playerId: 'a', target: 'c' },
  );
}

describe('rounds and scores', () => {
  it('starts a new lobby at round 1 with no scores', () => {
    const game = newGame('p1', 'P1', 'ABCDE', 1000);
    expect(game.round).toBe(1);
    expect(game.scores).toEqual({});
  });

  it('gives the winner one win at the moment the game finishes', () => {
    const end = finished();
    expect(end.status).toBe('finished');
    expect(end.winner).toBe('a');
    expect(end.scores).toEqual({ a: 1 });
  });

  it('adds to wins the player already has in this lobby', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const end = play(
      { ...start, scores: { a: 2, b: 1 } },
      { type: 'coup', playerId: 'a', target: 'b' },
    );
    expect(end.scores).toEqual({ a: 3, b: 1 });
  });

  it('does not touch the scores while the game is still going', () => {
    const start = makeGame({ a: ['Duke', 'Captain'], b: ['Contessa', 'Duke'] });
    expect(play(start, { type: 'income', playerId: 'a' }).scores).toEqual({});
  });
});

describe('rematch', () => {
  it('returns a finished game to the lobby with the same players in the same order', () => {
    const end = finished();
    const lobby = rematch(end, 'a', identityRng);

    expect(lobby.status).toBe('waiting');
    expect(lobby.host).toBe('a');
    expect(lobby.code).toBe(end.code);
    expect(lobby.createdAt).toBe(end.createdAt);
    expect(lobby.playerOrder).toEqual(['a', 'b', 'c']);
    ['a', 'b', 'c'].forEach(id =>
      expect(lobby.players[id]).toEqual({
        name: id.toUpperCase(),
        coins: 2,
        influence: [],
        eliminatedAt: null,
      }),
    );
  });

  it('clears everything that belonged to the finished round', () => {
    const lobby = rematch(finished(), 'a', identityRng);
    expect(lobby.deck).toEqual([]);
    expect(lobby.log).toEqual([]);
    expect(lobby.winner).toBeNull();
    expect(lobby.state.pending).toBeNull();
    expect(lobby.state.lastAction).toBeNull();
    expect(lobby.state.phase).toBe('action');
    expect(lobby.state.turnNumber).toBe(0);
    expect(lobby.state.currentTurnPlayer).toBe('a');
  });

  it('moves to the next round and keeps the scores', () => {
    const end = finished();
    const lobby = rematch(end, 'a', identityRng);
    expect(lobby.round).toBe(end.round + 1);
    expect(lobby.round).toBe(2);
    expect(lobby.scores).toEqual({ a: 1 });
  });

  it('never lets claimSeq go backwards, in the lobby or in the next round', () => {
    const end = finished();
    expect(end.state.claimSeq).toBeGreaterThan(0);
    const lobby = rematch(end, 'a', identityRng);
    expect(lobby.state.claimSeq).toBe(end.state.claimSeq);

    const second = startGame(lobby, 'a', identityRng);
    expect(second.state.claimSeq).toBe(end.state.claimSeq);
    const asked = play(second, { type: 'tax', playerId: 'a' });
    expect(asked.state.claimSeq).toBe(end.state.claimSeq + 1);
    // A tap left over from the previous round carries a seq that can never be current again.
    expect(() =>
      play(asked, { type: 'pass', playerId: 'b', seq: end.state.claimSeq }),
    ).toThrow('Too late: the game has moved on');
  });

  it('lets the next round be played and counts a second win', () => {
    const lobby = rematch(finished(), 'a', identityRng);
    const second = startGame(lobby, 'a', identityRng);
    expect(second.status).toBe('playing');
    expect(second.round).toBe(2);
    expect(second.state.turnNumber).toBe(1);
    expect(second.deck).toHaveLength(9);
    ['a', 'b', 'c'].forEach(id => {
      expect(second.players[id].coins).toBe(2);
      expect(second.players[id].influence).toHaveLength(2);
      expect(second.players[id].influence.every(i => !i.revealed)).toBe(true);
    });

    const rich: Game = {
      ...second,
      players: {
        ...second.players,
        a: { ...second.players.a, coins: 28 },
        b: {
          ...second.players.b,
          influence: [{ card: 'Duke', revealed: false }],
        },
        c: {
          ...second.players.c,
          influence: [{ card: 'Duke', revealed: false }],
        },
      },
    };
    const end = play(
      rich,
      { type: 'coup', playerId: 'a', target: 'b' },
      { type: 'income', playerId: 'c' },
      { type: 'coup', playerId: 'a', target: 'c' },
    );
    expect(end.status).toBe('finished');
    expect(end.scores).toEqual({ a: 2 });
    expect(rematch(end, 'a', identityRng).round).toBe(3);
  });

  it('lets a new player join the lobby between rounds', () => {
    const lobby = rematch(finished(), 'a', identityRng);
    expect(addPlayer(lobby, 'd', 'Dee').playerOrder).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('is only for the host', () => {
    const end = finished();
    expect(() => rematch(end, 'b', identityRng)).toThrow(IllegalActionError);
    expect(() => rematch(end, 'b', identityRng)).toThrow(
      'Only the host can start a new round',
    );
    expect(() => rematch(end, 'stranger', identityRng)).toThrow(
      'Only the host can start a new round',
    );
  });

  it('is only possible once the game is finished', () => {
    const playing = makeGame({
      a: ['Duke', 'Duke'],
      b: ['Captain', 'Captain'],
    });
    expect(() => rematch(playing, 'a', identityRng)).toThrow(
      IllegalActionError,
    );
    expect(() => rematch(playing, 'a', identityRng)).toThrow(
      'The game is not finished',
    );
    expect(() =>
      rematch(newGame('a', 'A', 'ABCDE', 0), 'a', identityRng),
    ).toThrow('The game is not finished');
  });

  it('does not mutate the finished game', () => {
    const end = deepFreeze(finished());
    const before = JSON.stringify(end);
    rematch(end, 'a', identityRng);
    expect(JSON.stringify(end)).toBe(before);
  });
});
