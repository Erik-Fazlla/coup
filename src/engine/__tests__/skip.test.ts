import { newGame } from '../lobby';
import { pendingResponders } from '../rules';
import { deepFreeze, makeGame, play } from '../testHelpers';
import { Game, IllegalActionError } from '../types';

const SKIP = { type: 'skip', playerId: 'a' } as const;

/** `a` is the host and acts first. */
const three = () =>
  makeGame({
    a: ['Duke', 'Captain'],
    b: ['Contessa', 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });

function withoutLog(game: Game): Game {
  return { ...game, log: [] };
}

function lastLog(game: Game): string {
  return game.log[game.log.length - 1];
}

describe('host skip', () => {
  describe('while waiting for responses to an action', () => {
    it('passes for every pending responder, exactly as if they had passed', () => {
      const asked = play(three(), { type: 'foreignAid', playerId: 'a' });
      const skipped = play(asked, SKIP);
      const passed = play(
        asked,
        { type: 'pass', playerId: 'b' },
        { type: 'pass', playerId: 'c' },
      );
      expect(skipped.players.a.coins).toBe(4);
      expect(skipped.state.currentTurnPlayer).toBe('b');
      expect(withoutLog(skipped)).toEqual(withoutLog(passed));
      expect(skipped.log).toContain('Host skipped B, C');
      expect(lastLog(skipped)).toBe('A takes foreign aid');
    });

    it('only names the players who had not answered yet', () => {
      const asked = play(
        three(),
        { type: 'foreignAid', playerId: 'a' },
        { type: 'pass', playerId: 'b' },
      );
      const skipped = play(asked, SKIP);
      expect(skipped.log).toContain('Host skipped C');
      expect(skipped.players.a.coins).toBe(4);
    });

    it('lets the host skip a wait that includes the host', () => {
      const asked = play(
        three(),
        { type: 'income', playerId: 'a' },
        { type: 'tax', playerId: 'b' },
      );
      expect(pendingResponders(asked)).toEqual(['a', 'c']);
      const skipped = play(asked, SKIP);
      expect(skipped.log).toContain('Host skipped A, C');
      expect(skipped.players.b.coins).toBe(5);
      expect(skipped.state.currentTurnPlayer).toBe('c');
    });

    it('stops at the next thing that needs input: an exchange', () => {
      const asked = play(
        three(),
        { type: 'income', playerId: 'a' },
        { type: 'income', playerId: 'b' },
        { type: 'exchange', playerId: 'c' },
      );
      const skipped = play(asked, SKIP);
      expect(skipped.state.phase).toBe('exchange');
      expect(skipped.state.pending?.exchangeOptions).toHaveLength(4);
    });

    it('stops at the next thing that needs input: the target choosing a card', () => {
      const start = makeGame(
        {
          a: ['Assassin', 'Captain'],
          b: ['Contessa', 'Duke'],
          c: ['Duke', 'Duke'],
        },
        { coins: { a: 3 } },
      );
      const skipped = play(
        start,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        SKIP,
      );
      expect(skipped.state.phase).toBe('loseInfluence');
      expect(skipped.state.pending?.loseInfluence?.playerId).toBe('b');
    });

    it('passes for the target when only their chance to block is left', () => {
      const start = makeGame({
        a: ['Captain', 'Duke'],
        b: ['Contessa', 'Duke'],
        c: ['Duke', 'Assassin'],
      });
      const reopened = play(
        start,
        { type: 'steal', playerId: 'a', target: 'b' },
        { type: 'challenge', playerId: 'c' },
        { type: 'loseInfluence', playerId: 'c', cardIndex: 0 },
      );
      expect(pendingResponders(reopened)).toEqual(['b']);
      const skipped = play(reopened, SKIP);
      expect(skipped.log).toContain('Host skipped B');
      expect(skipped.players.a.coins).toBe(4);
      expect(skipped.players.b.coins).toBe(0);
      expect(skipped.state.currentTurnPlayer).toBe('b');
    });
  });

  describe('while waiting for responses to a block', () => {
    it('lets the block stand', () => {
      const blocked = play(
        three(),
        { type: 'foreignAid', playerId: 'a' },
        { type: 'block', playerId: 'b', claim: 'Duke' },
      );
      const skipped = play(blocked, SKIP);
      const passed = play(
        blocked,
        { type: 'pass', playerId: 'a' },
        { type: 'pass', playerId: 'c' },
      );
      expect(skipped.players.a.coins).toBe(2);
      expect(skipped.state.lastAction?.blocked).toBe(true);
      expect(skipped.state.currentTurnPlayer).toBe('b');
      expect(withoutLog(skipped)).toEqual(withoutLog(passed));
      expect(skipped.log).toContain('Host skipped A, C');
      expect(lastLog(skipped)).toBe('B blocks with Duke');
    });
  });

  describe('while waiting for a player to act', () => {
    it('takes Income for the current player', () => {
      const start = play(three(), { type: 'income', playerId: 'a' });
      const skipped = play(start, SKIP);
      expect(withoutLog(skipped)).toEqual(
        withoutLog(play(start, { type: 'income', playerId: 'b' })),
      );
      expect(skipped.players.b.coins).toBe(3);
      expect(skipped.state.currentTurnPlayer).toBe('c');
      expect(skipped.log.slice(-2)).toEqual([
        'Host skipped B',
        'B takes income',
      ]);
    });

    it('takes Income for the host on their own turn', () => {
      const skipped = play(three(), SKIP);
      expect(skipped.players.a.coins).toBe(3);
      expect(skipped.log).toContain('Host skipped A');
    });

    it('still takes Income at 9 coins', () => {
      const start = makeGame(
        { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
        { coins: { a: 9 } },
      );
      const skipped = play(start, SKIP);
      expect(skipped.players.a.coins).toBe(10);
      expect(skipped.state.currentTurnPlayer).toBe('b');
    });

    it('Coups the next living player in turn order at 10 or more coins', () => {
      const start = makeGame(
        {
          a: ['Duke', 'Captain'],
          b: ['Contessa', 'Assassin'],
          c: ['Ambassador', 'Duke'],
        },
        { coins: { b: 10 } },
      );
      const skipped = play(start, { type: 'income', playerId: 'a' }, SKIP);
      expect(skipped.players.b.coins).toBe(3);
      expect(skipped.state.lastAction).toEqual({
        playerId: 'b',
        action: 'coup',
        target: 'c',
        blocked: false,
      });
      // One skip resolves one wait: now the game waits for c to choose a card.
      expect(skipped.state.phase).toBe('loseInfluence');
      expect(skipped.state.pending?.loseInfluence?.playerId).toBe('c');
      expect(skipped.log.slice(-2)).toEqual(['Host skipped B', 'B coups C']);
    });

    it('wraps round the table and passes over eliminated players to find the Coup target', () => {
      const start = makeGame(
        {
          a: ['Duke', 'Captain'],
          b: ['Contessa', 'Assassin'],
          c: ['Ambassador'],
          d: ['Duke', 'Duke'],
        },
        { coins: { a: 7, d: 12 } },
      );
      // a removes c, then b and (skipped) d act: d's next living player is a, not c.
      const game = play(
        start,
        { type: 'coup', playerId: 'a', target: 'c' },
        { type: 'income', playerId: 'b' },
        SKIP,
      );
      expect(game.state.lastAction).toMatchObject({
        playerId: 'd',
        action: 'coup',
        target: 'a',
      });
      expect(game.state.pending?.loseInfluence?.playerId).toBe('a');

      const other = makeGame(
        {
          a: ['Duke', 'Captain'],
          b: ['Contessa'],
          c: ['Ambassador', 'Duke'],
        },
        { coins: { a: 17 } },
      );
      // a's first Coup removes b; a's next (skipped) Coup must pass over b and hit c.
      const second = play(
        other,
        { type: 'coup', playerId: 'a', target: 'b' },
        { type: 'income', playerId: 'c' },
        SKIP,
      );
      expect(second.state.lastAction).toMatchObject({
        playerId: 'a',
        action: 'coup',
        target: 'c',
      });
    });

    it('can end the game, crediting the win and the elimination as a real Coup would', () => {
      const start = makeGame(
        { a: ['Duke', 'Captain'], b: ['Contessa'] },
        { coins: { b: 10 } },
      );
      const cornered = play(
        start,
        { type: 'income', playerId: 'a' },
        SKIP,
        { type: 'loseInfluence', playerId: 'a', cardIndex: 0 },
        { type: 'income', playerId: 'a' },
        { type: 'income', playerId: 'b' },
      );
      const rich: Game = {
        ...cornered,
        players: {
          ...cornered.players,
          a: { ...cornered.players.a, coins: 10 },
        },
      };
      const end = play(rich, SKIP);
      expect(end.status).toBe('finished');
      expect(end.winner).toBe('a');
      expect(end.scores).toEqual({ a: 1 });
      expect(end.eliminations).toEqual([
        { playerId: 'b', by: 'a', turn: rich.state.turnNumber },
      ]);
      expect(end.log.slice(-5)).toEqual([
        'Host skipped A',
        'A coups B',
        'B loses Contessa',
        'B is eliminated',
        'A wins',
      ]);
    });
  });

  describe('while waiting for a player to lose a card', () => {
    it('takes their first hidden card and carries on', () => {
      const start = makeGame(
        { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
        { coins: { a: 7 } },
      );
      const waiting = play(start, {
        type: 'coup',
        playerId: 'a',
        target: 'b',
      });
      const skipped = play(waiting, SKIP);
      expect(skipped.players.b.influence).toEqual([
        { card: 'Contessa', revealed: true },
        { card: 'Assassin', revealed: false },
      ]);
      expect(withoutLog(skipped)).toEqual(
        withoutLog(
          play(waiting, { type: 'loseInfluence', playerId: 'b', cardIndex: 0 }),
        ),
      );
      expect(skipped.state.currentTurnPlayer).toBe('b');
      expect(skipped.log.slice(-2)).toEqual([
        'Host skipped B',
        'B loses Contessa',
      ]);
    });

    it('runs what the lost card was holding up, including a reopened window', () => {
      const start = makeGame(
        {
          a: ['Assassin', 'Duke'],
          b: ['Duke', 'Captain'],
          c: ['Duke', 'Contessa'],
        },
        { coins: { a: 3 } },
      );
      // c wrongly challenges the assassin; skipping c's choice reopens the window for b to block.
      const waiting = play(
        start,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        { type: 'challenge', playerId: 'c' },
      );
      expect(waiting.state.pending?.loseInfluence?.playerId).toBe('c');
      const skipped = play(waiting, SKIP);
      expect(skipped.players.c.influence[0].revealed).toBe(true);
      expect(skipped.state.phase).toBe('awaitingResponses');
      expect(pendingResponders(skipped)).toEqual(['b']);
      expect(skipped.state.claimSeq).toBe(waiting.state.claimSeq + 1);
    });
  });

  describe('while waiting for an exchange', () => {
    it('keeps the cards the player already held and returns the drawn ones', () => {
      const start = makeGame(
        { a: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'] },
        { deck: ['Captain', 'Contessa', 'Duke'] },
      );
      const exchanging = play(
        start,
        { type: 'exchange', playerId: 'a' },
        { type: 'pass', playerId: 'b' },
      );
      expect(exchanging.state.phase).toBe('exchange');
      const skipped = play(exchanging, SKIP);
      expect(skipped.players.a.influence).toEqual([
        { card: 'Ambassador', revealed: false },
        { card: 'Duke', revealed: false },
      ]);
      expect([...skipped.deck].sort()).toEqual(['Captain', 'Contessa', 'Duke']);
      expect(skipped.state.currentTurnPlayer).toBe('b');
      expect(skipped.state.pending).toBeNull();
      expect(skipped.log.slice(-2)).toEqual([
        'Host skipped A',
        'A exchanges cards',
      ]);
    });

    it('keeps the one remaining card of a player who has already lost one', () => {
      const start = makeGame(
        { a: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'] },
        { coins: { b: 7 }, deck: ['Captain', 'Contessa', 'Duke'] },
      );
      const exchanging = play(
        start,
        { type: 'income', playerId: 'a' },
        { type: 'coup', playerId: 'b', target: 'a' },
        { type: 'loseInfluence', playerId: 'a', cardIndex: 0 },
        { type: 'exchange', playerId: 'a' },
        { type: 'pass', playerId: 'b' },
      );
      const skipped = play(exchanging, SKIP);
      expect(skipped.players.a.influence).toEqual([
        { card: 'Ambassador', revealed: true },
        { card: 'Duke', revealed: false },
      ]);
      expect(skipped.deck).toHaveLength(3);
    });
  });

  describe('who may skip, and when', () => {
    it('is only for the host', () => {
      const game = three();
      const before = JSON.stringify(game);
      expect(() => play(game, { type: 'skip', playerId: 'b' })).toThrow(
        IllegalActionError,
      );
      expect(() => play(game, { type: 'skip', playerId: 'b' })).toThrow(
        'Only the host can skip',
      );
      expect(() => play(game, { type: 'skip', playerId: 'stranger' })).toThrow(
        'You are not in this game',
      );
      expect(JSON.stringify(game)).toBe(before);
    });

    it('is only possible while the game is being played', () => {
      expect(() => play(newGame('a', 'A', 'ABCDE', 0), SKIP)).toThrow(
        'Game is not in progress',
      );
      const finished = play(
        makeGame(
          { a: ['Duke', 'Captain'], b: ['Contessa'] },
          { coins: { a: 7 } },
        ),
        { type: 'coup', playerId: 'a', target: 'b' },
      );
      expect(() => play(finished, SKIP)).toThrow('Game is not in progress');
    });

    it('still works for a host who has been eliminated', () => {
      const start = makeGame(
        { a: ['Duke'], b: ['Contessa', 'Assassin'], c: ['Duke', 'Captain'] },
        { coins: { b: 7 } },
      );
      const hostOut = play(
        start,
        { type: 'income', playerId: 'a' },
        { type: 'coup', playerId: 'b', target: 'a' },
      );
      expect(hostOut.players.a.eliminatedAt).not.toBeNull();
      const skipped = play(hostOut, SKIP);
      expect(skipped.players.c.coins).toBe(3);
      expect(skipped.state.currentTurnPlayer).toBe('b');
    });

    describe('when the game has moved on since the host looked', () => {
      const TOO_LATE = 'Too late: the game has moved on';

      /** The host's view: waiting for b and c to answer a's Foreign Aid. */
      const asked = () => play(three(), { type: 'foreignAid', playerId: 'a' });

      it.each([
        ['turn', (game: Game) => ({ turn: game.state.turnNumber - 1 })],
        ['seq', (game: Game) => ({ seq: game.state.claimSeq - 1 })],
        ['phase', () => ({ phase: 'action' as const })],
      ])(
        'rejects a skip carrying a previous %s and changes nothing',
        (_l, stale) => {
          const game = deepFreeze(asked());
          const before = JSON.stringify(game);
          const action = { ...SKIP, ...stale(game) };
          expect(() => play(game, action)).toThrow(IllegalActionError);
          expect(() => play(game, action)).toThrow(TOO_LATE);
          expect(JSON.stringify(game)).toBe(before);
        },
      );

      it('rejects a skip aimed at a wait that has already been answered', () => {
        const waiting = asked();
        const seen = {
          turn: waiting.state.turnNumber,
          seq: waiting.state.claimSeq,
          phase: waiting.state.phase,
        };
        // b and c answer before the host's skip arrives: the game is now waiting for b to act.
        const moved = play(
          waiting,
          { type: 'pass', playerId: 'b' },
          { type: 'pass', playerId: 'c' },
        );
        expect(moved.state.phase).toBe('action');
        expect(() => play(moved, { ...SKIP, ...seen })).toThrow(TOO_LATE);
        // Without the guard this would have taken Income for b.
        expect(moved.players.b.coins).toBe(2);
      });

      it('applies a skip whose values all match the current game', () => {
        const waiting = asked();
        const skipped = play(waiting, {
          ...SKIP,
          turn: waiting.state.turnNumber,
          seq: waiting.state.claimSeq,
          phase: waiting.state.phase,
        });
        expect(skipped.players.a.coins).toBe(4);
      });
    });

    it('resolves one wait per skip', () => {
      const start = makeGame(
        { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
        { coins: { a: 10 } },
      );
      const first = play(start, SKIP);
      expect(first.state.phase).toBe('loseInfluence');
      const second = play(first, SKIP);
      expect(second.state.phase).toBe('action');
      expect(second.state.currentTurnPlayer).toBe('b');
      const third = play(second, SKIP);
      expect(third.players.b.coins).toBe(3);
      expect(third.state.currentTurnPlayer).toBe('a');
    });
  });
});
