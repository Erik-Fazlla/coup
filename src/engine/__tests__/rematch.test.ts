import {
  eliminationLines,
  revealLine,
  revealLoserLine,
  scoreboard,
  statusLine,
} from '../describe';
import {
  addPlayer,
  kickPlayer,
  newGame,
  rematch,
  removePlayer,
  startGame,
} from '../lobby';
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

describe('who takes the first turn of a round', () => {
  /** A waiting lobby of `ids` (the first is the host) with `lastWinner` having won the round before. */
  function lobbyFor(
    ids: string[],
    round = 1,
    lastWinner: string | null = null,
  ): Game {
    const lobby = ids
      .slice(1)
      .reduce(
        (game, id) => addPlayer(game, id, id.toUpperCase()),
        newGame(ids[0], ids[0].toUpperCase(), 'ABCDE', 0),
      );
    return { ...lobby, round, lastWinner };
  }
  const start = (game: Game) =>
    startGame(game, 'a', identityRng).state.currentTurnPlayer;

  it('gives round 1 to the host', () => {
    const started = startGame(lobbyFor(['a', 'b', 'c']), 'a', identityRng);
    expect(started.state.currentTurnPlayer).toBe('a');
    expect(started.state.phase).toBe('action');
    expect(started.state.turnNumber).toBe(1);
  });

  it.each(['a', 'b', 'c'])(
    'gives round 2 to the previous winner (%s) in a three-player game',
    winner => {
      expect(start(lobbyFor(['a', 'b', 'c'], 2, winner))).toBe(winner);
    },
  );

  it('falls back to the old rotation when the previous winner has left', () => {
    const four = { ...lobbyFor(['a', 'b', 'c', 'd'], 3, 'b') };
    const three = removePlayer({ ...four, status: 'finished' }, 'b');
    expect(three.playerOrder).toEqual(['a', 'c', 'd']);
    // Round 3 of three players: index 2 of the remaining order.
    expect(start({ ...three, status: 'waiting' })).toBe('d');
  });

  it('falls back to the old rotation when the previous winner was kicked', () => {
    const three = kickPlayer(lobbyFor(['a', 'b', 'c', 'd'], 2, 'b'), 'a', 'b');
    expect(start(three)).toBe('c');
  });

  it('ignores a winner recorded for round 1', () => {
    expect(start(lobbyFor(['a', 'b'], 1, 'b'))).toBe('a');
  });

  it('hands the first turn to the winner after a real rematch', () => {
    const first = startGame(lobbyFor(['a', 'b', 'c']), 'a', identityRng);
    expect(first.state.currentTurnPlayer).toBe('a');
    const end = {
      ...finished(),
      winner: 'c',
    };
    const lobby = rematch(end, 'a', identityRng);
    expect(lobby.winner).toBeNull();
    expect(lobby.lastWinner).toBe('c');
    const second = startGame(lobby, 'a', identityRng);
    expect(second.round).toBe(2);
    expect(second.state.currentTurnPlayer).toBe('c');
    // Only the starter can act first.
    expect(() => play(second, { type: 'income', playerId: 'a' })).toThrow(
      'It is not your turn',
    );
    expect(
      play(second, { type: 'income', playerId: 'c' }).state.currentTurnPlayer,
    ).toBe('a');
  });

  it('keeps the winner as the starter through consecutive rounds', () => {
    const second = startGame(
      rematch(finished(), 'a', identityRng),
      'a',
      identityRng,
    );
    expect(second.state.currentTurnPlayer).toBe('a');
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
    // Round 2 starts with a, who won round 1.
    const asked = play(second, { type: 'tax', playerId: 'a' });
    expect(asked.state.claimSeq).toBe(end.state.claimSeq + 1);
    // A tap left over from the previous round carries a seq that can never be current again.
    expect(() =>
      play(asked, { type: 'pass', playerId: 'b', seq: end.state.claimSeq }),
    ).toThrow('Too late: the game has moved on');
  });

  it('sizes the deck for whoever is in the lobby when the next round starts', () => {
    let lobby = rematch(finished(), 'a', identityRng);
    ['d', 'e', 'f', 'g'].forEach(id => {
      lobby = addPlayer(lobby, id, id.toUpperCase());
    });
    // Three players played round 1 with 15 cards; seven play round 2 with 20.
    const second = startGame(lobby, 'a', identityRng);
    expect(second.playerOrder).toHaveLength(7);
    expect(second.deck).toHaveLength(20 - 14);

    // And back down: with the seventh player gone, the round is dealt from 15 again.
    const smaller = startGame(removePlayer(lobby, 'g'), 'a', identityRng);
    expect(smaller.deck).toHaveLength(15 - 12);
  });

  it('gives 1 coin to whoever starts the next round of a two-player game', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const end = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(end.winner).toBe('a');
    const second = startGame(rematch(end, 'a', identityRng), 'a', identityRng);
    expect(second.round).toBe(2);
    expect(second.state.currentTurnPlayer).toBe('a');
    expect(second.players.a.coins).toBe(1);
    expect(second.players.b.coins).toBe(2);
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
    // Round 2 starts with a, the winner of round 1.
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

describe('leaving once the game is over', () => {
  /** The finished game with wins from earlier rounds for b and c as well. */
  const scored = (): Game => ({
    ...finished(),
    scores: { a: 1, b: 2, c: 1 },
  });

  it('frees the seat of a guest who goes home', () => {
    const end = scored();
    const after = removePlayer(deepFreeze(end), 'b');
    expect(after.playerOrder).toEqual(['a', 'c']);
    expect(after.players.b).toBeUndefined();
    expect(after.scores).toEqual({ a: 1, c: 1 });
    // The result everyone else is still looking at stays as it was.
    expect(after.status).toBe('finished');
    expect(after.winner).toBe(end.winner);
    expect(after.eliminations).toEqual(end.eliminations);
    expect(after.reveal).toEqual(end.reveal);
    expect(after.log).toEqual(end.log);
    expect(after.round).toBe(end.round);
  });

  it('does nothing for the host, a stranger or a game still being played', () => {
    const end = scored();
    expect(removePlayer(end, 'a')).toBe(end);
    expect(removePlayer(end, 'stranger')).toBe(end);
    const playing = makeGame({
      a: ['Duke', 'Duke'],
      b: ['Captain', 'Captain'],
    });
    expect(removePlayer(playing, 'b')).toBe(playing);
  });

  it('keeps them out of the next round', () => {
    const lobby = rematch(removePlayer(scored(), 'b'), 'a', identityRng);
    expect(lobby.status).toBe('waiting');
    expect(lobby.playerOrder).toEqual(['a', 'c']);
    expect(Object.keys(lobby.players)).toEqual(['a', 'c']);
    expect(lobby.scores).toEqual({ a: 1, c: 1 });

    const second = startGame(lobby, 'a', identityRng);
    expect(second.playerOrder).toEqual(['a', 'c']);
    // The round 1 winner (a) starts round 2.
    expect(second.state.currentTurnPlayer).toBe('a');
    expect(second.players.b).toBeUndefined();
  });

  it('still returns to the lobby when only the host is left, which then needs a second player', () => {
    const alone = removePlayer(removePlayer(scored(), 'b'), 'c');
    const lobby = rematch(alone, 'a', identityRng);
    expect(lobby.status).toBe('waiting');
    expect(lobby.playerOrder).toEqual(['a']);
    expect(() => startGame(lobby, 'a', identityRng)).toThrow(
      'Need at least 2 players',
    );
    expect(addPlayer(lobby, 'd', 'Dee').playerOrder).toEqual(['a', 'd']);
  });

  it('lets a winner who is not the host leave too', () => {
    const end: Game = { ...scored(), winner: 'c', scores: { c: 1 } };
    const after = removePlayer(end, 'c');
    expect(after.winner).toBe('c');
    expect(after.scores).toEqual({});
    expect(rematch(after, 'a', identityRng).playerOrder).toEqual(['a', 'b']);
  });

  it('lets them join again as a new player once the lobby is open', () => {
    const lobby = rematch(removePlayer(scored(), 'b'), 'a', identityRng);
    expect(addPlayer(lobby, 'b', 'B').playerOrder).toEqual(['a', 'c', 'b']);
  });
});

describe('a finished game one player has left', () => {
  /** b took c out, then left; a won. A challenge involving b was the last reveal. */
  const afterLeaving = (): Game => {
    const end = finished();
    return removePlayer(
      {
        ...end,
        scores: { a: 1, b: 2 },
        eliminations: [
          { playerId: 'c', by: 'b', turn: 3 },
          { playerId: 'b', by: 'a', turn: 4 },
        ],
        reveal: {
          id: 1,
          challenger: 'a',
          claimant: 'b',
          card: 'Duke',
          truthful: false,
          block: false,
        },
      },
      'b',
    );
  };

  it('lists only the players still there on the scoreboard', () => {
    expect(scoreboard(afterLeaving())).toEqual([
      { playerId: 'a', name: 'A', wins: 1 },
      { playerId: 'c', name: 'C', wins: 0 },
    ]);
  });

  it('still tells how it went, with a stand-in for the missing name', () => {
    const lines = eliminationLines(afterLeaving());
    expect(lines).toEqual([
      'C — taken out by ? (turn 3)',
      '? — taken out by A (turn 4)',
    ]);
    lines.forEach(line => expect(line).not.toContain('undefined'));
  });

  it('describes the last reveal and the result without throwing', () => {
    const game = afterLeaving();
    expect(revealLine(game)).toBe('? was bluffing — no Duke');
    expect(revealLoserLine(game)).toBe('? loses a card');
    expect(statusLine(game)).toBe('A wins');
    expect(statusLine({ ...game, winner: 'b' })).toBe('? wins');
  });
});
