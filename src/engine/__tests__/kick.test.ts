import { addPlayer, kickPlayer, newGame, rematch, startGame } from '../lobby';
import { normalizeGame } from '../serialize';
import { deepFreeze, identityRng, makeGame, play } from '../testHelpers';
import { Game, IllegalActionError } from '../types';

function lobby(playerCount: number): Game {
  let game = newGame('p1', 'P1', 'ABCDE', 1000);
  for (let i = 2; i <= playerCount; i++) {
    game = addPlayer(game, `p${i}`, `P${i}`);
  }
  return game;
}

describe('kickPlayer', () => {
  it('starts with nobody kicked', () => {
    expect(lobby(1).kicked).toEqual({});
  });

  it('removes the player from the lobby and remembers them', () => {
    const after = kickPlayer(lobby(3), 'p1', 'p2');
    expect(after.playerOrder).toEqual(['p1', 'p3']);
    expect(after.players.p2).toBeUndefined();
    expect(after.kicked).toEqual({ p2: true });
    expect(after.status).toBe('waiting');
  });

  it('does not mutate the lobby it was given', () => {
    const before = deepFreeze(lobby(3));
    const snapshot = JSON.stringify(before);
    kickPlayer(before, 'p1', 'p3');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('keeps a kicked player out when they try to join again', () => {
    const after = kickPlayer(lobby(3), 'p1', 'p2');
    expect(() => addPlayer(after, 'p2', 'P2')).toThrow(IllegalActionError);
    expect(() => addPlayer(after, 'p2', 'Other name')).toThrow(
      'The host removed you from this game',
    );
    // Someone else may take the seat, and even the name.
    expect(addPlayer(after, 'p9', 'P2').playerOrder).toEqual([
      'p1',
      'p3',
      'p9',
    ]);
  });

  it('remembers every kicked player', () => {
    const after = kickPlayer(kickPlayer(lobby(4), 'p1', 'p2'), 'p1', 'p4');
    expect(after.kicked).toEqual({ p2: true, p4: true });
    expect(after.playerOrder).toEqual(['p1', 'p3']);
  });

  it('is only for the host', () => {
    const game = lobby(3);
    expect(() => kickPlayer(game, 'p2', 'p3')).toThrow(IllegalActionError);
    expect(() => kickPlayer(game, 'p2', 'p3')).toThrow(
      'Only the host can remove players',
    );
    expect(() => kickPlayer(game, 'stranger', 'p3')).toThrow(
      'Only the host can remove players',
    );
  });

  it('is only possible in the lobby', () => {
    const started = startGame(lobby(3), 'p1', identityRng);
    expect(() => kickPlayer(started, 'p1', 'p2')).toThrow(IllegalActionError);
    expect(() => kickPlayer(started, 'p1', 'p2')).toThrow(
      'Players can only be removed in the lobby',
    );
    const finished = { ...started, status: 'finished' as const };
    expect(() => kickPlayer(finished, 'p1', 'p2')).toThrow(
      'Players can only be removed in the lobby',
    );
  });

  it('does not let the host remove themself', () => {
    expect(() => kickPlayer(lobby(2), 'p1', 'p1')).toThrow(IllegalActionError);
    expect(() => kickPlayer(lobby(2), 'p1', 'p1')).toThrow(
      'The host cannot be removed',
    );
  });

  it('rejects a target who is not in the game', () => {
    expect(() => kickPlayer(lobby(2), 'p1', 'ghost')).toThrow(
      IllegalActionError,
    );
    expect(() => kickPlayer(lobby(2), 'p1', 'ghost')).toThrow(
      'That player is not in this game',
    );
  });

  describe('between rounds', () => {
    /** Round 1 was won by b; a is the host. */
    function secondLobby(): Game {
      const start = makeGame(
        { a: ['Duke'], b: ['Captain', 'Duke'], c: ['Contessa'] },
        { coins: { b: 14 } },
      );
      const end = play(
        { ...start, scores: { a: 1, c: 2 } },
        { type: 'income', playerId: 'a' },
        { type: 'coup', playerId: 'b', target: 'a' },
        { type: 'income', playerId: 'c' },
        { type: 'coup', playerId: 'b', target: 'c' },
      );
      expect(end.scores).toEqual({ a: 1, b: 1, c: 2 });
      return rematch(end, 'a', identityRng);
    }

    it('drops the kicked player from the scores', () => {
      const after = kickPlayer(secondLobby(), 'a', 'c');
      expect(after.scores).toEqual({ a: 1, b: 1 });
      expect(after.playerOrder).toEqual(['a', 'b']);
      expect(after.kicked).toEqual({ c: true });
    });

    it('keeps the kicked list through a rematch and the next round', () => {
      const kicked = kickPlayer(secondLobby(), 'a', 'c');
      const second = startGame(kicked, 'a', identityRng);
      expect(second.kicked).toEqual({ c: true });
      expect(second.playerOrder).toEqual(['a', 'b']);
      expect(() => addPlayer(second, 'c', 'C')).toThrow(
        'The host removed you from this game',
      );
    });
  });

  it('survives the database dropping an empty kicked map and keeps a filled one', () => {
    const empty = JSON.parse(JSON.stringify(lobby(2)));
    delete empty.kicked;
    expect(normalizeGame(empty).kicked).toEqual({});

    const after = kickPlayer(lobby(3), 'p1', 'p2');
    expect(normalizeGame(JSON.parse(JSON.stringify(after))).kicked).toEqual({
      p2: true,
    });
  });
});
