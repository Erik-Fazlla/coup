import { applyAction } from '../actions';
import { shuffle } from '../deck';
import { statusLine } from '../describe';
import { pendingResponders, responseOptions } from '../rules';
import { makeGame, play } from '../testHelpers';

describe('challenging an action', () => {
  it('costs the challenger a card when the claim is true, and swaps the proven card', () => {
    const game = makeGame(
      {
        a: ['Duke', 'Captain'],
        b: ['Contessa', 'Assassin'],
        c: ['Ambassador', 'Duke'],
      },
      { deck: ['Contessa', 'Assassin', 'Captain'] },
    );
    const challenged = play(
      game,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(challenged.players.a.influence[0]).toEqual({
      card: 'Contessa',
      revealed: false,
    });
    expect(challenged.deck).toEqual(['Assassin', 'Captain', 'Duke']);
    expect(challenged.state.phase).toBe('loseInfluence');
    expect(challenged.state.pending?.loseInfluence).toEqual({
      playerId: 'b',
      next: 'afterFailedChallenge',
    });

    const done = play(challenged, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 0,
    });
    expect(done.players.b.influence[0].revealed).toBe(true);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('shuffles the proven card into the deck with the injected rng', () => {
    const game = makeGame(
      {
        a: ['Duke', 'Captain'],
        b: ['Contessa', 'Assassin'],
        c: ['Ambassador', 'Duke'],
      },
      { deck: ['Contessa', 'Assassin', 'Captain'] },
    );
    const declared = play(game, { type: 'tax', playerId: 'a' });
    const rng = jest.fn(() => 0);
    const challenged = applyAction(
      declared,
      { type: 'challenge', playerId: 'b', seq: declared.state.claimSeq },
      rng,
    );

    const unshuffled = ['Contessa', 'Assassin', 'Captain', 'Duke'];
    const expected = shuffle(unshuffled, () => 0);
    expect(expected).not.toEqual(unshuffled);
    expect(rng).toHaveBeenCalled();
    expect(challenged.players.a.influence[0]).toEqual({
      card: expected[0],
      revealed: false,
    });
    expect(challenged.deck).toEqual(expected.slice(1));
  });

  it('costs the actor a card and cancels the action when the claim is a bluff', () => {
    const game = makeGame({
      a: ['Captain', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    });
    const challenged = play(
      game,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(challenged.state.pending?.loseInfluence).toEqual({
      playerId: 'a',
      next: 'endTurn',
    });

    const done = play(challenged, {
      type: 'loseInfluence',
      playerId: 'a',
      cardIndex: 0,
    });
    expect(done.players.a.coins).toBe(2);
    expect(done.players.a.influence[0].revealed).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('eliminates a one-card challenger automatically and still resolves the action', () => {
    const game = makeGame({
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    });
    game.players.c.influence[0].revealed = true;
    const done = play(
      game,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(done.players.c.eliminatedAt).toBe(1);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('is not allowed against unclaimed actions or by the actor', () => {
    const three = () =>
      makeGame({
        a: ['Duke', 'Captain'],
        b: ['Contessa', 'Assassin'],
        c: ['Ambassador', 'Duke'],
      });
    const aid = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(() => play(aid, { type: 'challenge', playerId: 'b' })).toThrow(
      'You cannot challenge now',
    );
    const tax = play(three(), { type: 'tax', playerId: 'a' });
    expect(() => play(tax, { type: 'challenge', playerId: 'a' })).toThrow(
      'You cannot challenge now',
    );
  });
});

describe('challenging a block', () => {
  it('upholds a true block: challenger loses a card, blocker swaps the proven card', () => {
    const game = makeGame(
      {
        a: ['Captain', 'Captain'],
        b: ['Duke', 'Contessa'],
        c: ['Ambassador', 'Assassin'],
      },
      { deck: ['Assassin', 'Ambassador', 'Captain'] },
    );
    const challenged = play(
      game,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'a' },
    );
    expect(challenged.players.b.influence[0]).toEqual({
      card: 'Assassin',
      revealed: false,
    });
    expect(challenged.state.lastAction?.blocked).toBe(true);
    expect(challenged.state.pending?.loseInfluence).toEqual({
      playerId: 'a',
      next: 'endTurn',
    });

    const done = play(challenged, {
      type: 'loseInfluence',
      playerId: 'a',
      cardIndex: 0,
    });
    expect(done.players.a.coins).toBe(2);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('defeats a bluffed block: blocker loses a card and the action goes through', () => {
    const game = makeGame({
      a: ['Captain', 'Captain'],
      b: ['Contessa', 'Contessa'],
      c: ['Ambassador', 'Assassin'],
    });
    const challenged = play(
      game,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(challenged.state.pending?.block).toBeNull();
    expect(challenged.state.pending?.loseInfluence).toEqual({
      playerId: 'b',
      next: 'afterFailedBlock',
    });

    // C has not answered the Foreign Aid itself yet, so C is still asked before it resolves.
    const reopened = play(challenged, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 0,
    });
    expect(reopened.state.phase).toBe('awaitingResponses');
    const done = play(reopened, { type: 'pass', playerId: 'c' });
    expect(done.players.a.coins).toBe(4);
    expect(done.state.lastAction?.blocked).toBe(false);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('cannot be challenged by the blocker', () => {
    const game = makeGame({
      a: ['Captain', 'Captain'],
      b: ['Duke', 'Contessa'],
      c: ['Ambassador', 'Assassin'],
    });
    const blocked = play(
      game,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(() => play(blocked, { type: 'challenge', playerId: 'b' })).toThrow(
      'You cannot challenge now',
    );
  });
});

describe('after a bluffed block is exposed', () => {
  /** A bluffs Captain to steal from B; B bluff-blocks as Ambassador before C answers; A exposes the block. */
  const stealBlockExposed = () =>
    play(
      makeGame({
        a: ['Duke', 'Duke'],
        b: ['Contessa', 'Contessa'],
        c: ['Assassin', 'Assassin'],
      }),
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'block', playerId: 'b', claim: 'Ambassador' },
      { type: 'challenge', playerId: 'a' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );

  /** A takes Foreign Aid; B bluff-blocks as Duke; A exposes the block. `before` runs first (e.g. a pass). */
  const aidBlockExposed = (
    hands: Parameters<typeof makeGame>[0],
    ...before: Parameters<typeof play>[1][]
  ) =>
    play(
      makeGame(hands),
      { type: 'foreignAid', playerId: 'a' },
      ...before,
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'a' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );

  it('lets players who had not answered yet challenge the action', () => {
    const reopened = stealBlockExposed();
    expect(reopened.state.phase).toBe('awaitingResponses');
    expect(reopened.state.pending?.block).toBeNull();
    expect(reopened.state.pending?.responses).toEqual({ b: 'pass' });
    expect(pendingResponders(reopened)).toEqual(['c']);
    expect(statusLine(reopened)).toBe('A: Steal on B. Waiting for C');

    const caught = play(
      reopened,
      { type: 'challenge', playerId: 'c' },
      { type: 'loseInfluence', playerId: 'a', cardIndex: 0 },
    );
    expect(caught.players.a.influence[0].revealed).toBe(true);
    expect(caught.players.a.coins).toBe(2);
    expect(caught.players.b.coins).toBe(2);
    expect(caught.state.currentTurnPlayer).toBe('b');
  });

  it('resolves the action once the remaining players pass', () => {
    const done = play(stealBlockExposed(), { type: 'pass', playerId: 'c' });
    expect(done.players.a.coins).toBe(4);
    expect(done.players.b.coins).toBe(0);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('lets a player who had not answered block Foreign Aid themselves', () => {
    const reopened = aidBlockExposed({
      a: ['Captain', 'Captain'],
      b: ['Contessa', 'Contessa'],
      c: ['Duke', 'Assassin'],
    });
    expect(reopened.state.phase).toBe('awaitingResponses');
    expect(pendingResponders(reopened)).toEqual(['c']);
    expect(responseOptions(reopened, 'c')).toEqual({
      canChallenge: false,
      blockClaims: ['Duke'],
    });

    const done = play(
      reopened,
      { type: 'block', playerId: 'c', claim: 'Duke' },
      { type: 'pass', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
    );
    expect(done.players.a.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('resolves at once when nobody is left to ask', () => {
    const done = aidBlockExposed(
      {
        a: ['Captain', 'Captain'],
        b: ['Contessa', 'Contessa'],
        c: ['Duke', 'Assassin'],
      },
      { type: 'pass', playerId: 'c' },
    );
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('does not ask a blocker who was eliminated by the exposure', () => {
    const game = makeGame({
      a: ['Captain', 'Captain'],
      b: ['Contessa'],
      c: ['Duke', 'Assassin'],
    });
    const done = play(
      game,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'a' },
    );
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('c');
  });
});

describe('after a block has been exposed as a bluff', () => {
  const hidden = (game: ReturnType<typeof makeGame>, id: string) =>
    game.players[id].influence.filter(i => !i.revealed).length;

  it('does not let the target block a steal a second time once the steal is proven', () => {
    const game = makeGame(
      {
        a: ['Captain', 'Duke'],
        b: ['Duke', 'Contessa'],
        c: ['Duke', 'Assassin'],
      },
      { deck: ['Contessa', 'Assassin', 'Ambassador'] },
    );
    const blockExposed = play(
      game,
      { type: 'steal', playerId: 'a', target: 'c' },
      { type: 'block', playerId: 'c', claim: 'Captain' },
      { type: 'challenge', playerId: 'b' },
      { type: 'loseInfluence', playerId: 'c', cardIndex: 0 },
    );
    expect(blockExposed.state.phase).toBe('awaitingResponses');
    expect(blockExposed.state.pending?.failedBlockers).toEqual({ c: true });
    expect(pendingResponders(blockExposed)).toEqual(['b']);

    const done = play(
      blockExposed,
      { type: 'challenge', playerId: 'b' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    // The steal goes through: c is not asked again and cannot block.
    expect(done.state.phase).toBe('action');
    expect(done.state.pending).toBeNull();
    expect(done.state.currentTurnPlayer).toBe('b');
    expect(done.players.a.coins).toBe(4);
    expect(done.players.c.coins).toBe(0);
    expect(done.state.lastAction?.blocked).toBe(false);
    // c lost exactly the one card for the bluff, b the one for the failed challenge.
    expect(hidden(done, 'c')).toBe(1);
    expect(hidden(done, 'b')).toBe(1);
    expect(hidden(done, 'a')).toBe(2);
  });

  it('does not let the target block an assassination a second time once the Assassin is proven', () => {
    const game = makeGame(
      {
        a: ['Assassin', 'Duke'],
        b: ['Duke', 'Captain'],
        c: ['Duke', 'Captain'],
      },
      { coins: { a: 3 }, deck: ['Contessa', 'Ambassador', 'Ambassador'] },
    );
    const blockExposed = play(
      game,
      { type: 'assassinate', playerId: 'a', target: 'c' },
      { type: 'block', playerId: 'c', claim: 'Contessa' },
      { type: 'challenge', playerId: 'b' },
      { type: 'loseInfluence', playerId: 'c', cardIndex: 0 },
    );
    expect(blockExposed.state.phase).toBe('awaitingResponses');
    expect(responseOptions(blockExposed, 'c')).toBeNull();

    const afterChallenge = play(blockExposed, {
      type: 'challenge',
      playerId: 'b',
    });
    expect(afterChallenge.state.pending?.loseInfluence).toEqual({
      playerId: 'b',
      next: 'afterFailedChallenge',
    });
    const done = play(afterChallenge, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 0,
    });
    // The assassination resolves: c lost one card for the bluff and one to the Assassin.
    expect(hidden(done, 'c')).toBe(0);
    expect(done.players.c.eliminatedAt).toBe(1);
    expect(hidden(done, 'b')).toBe(1);
    expect(hidden(done, 'a')).toBe(2);
    expect(done.players.a.coins).toBe(0);
    expect(done.state.phase).toBe('action');
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('lets another player block foreign aid, but not the one whose Duke was exposed', () => {
    const game = makeGame({
      a: ['Captain', 'Assassin'],
      b: ['Captain', 'Assassin'],
      c: ['Duke', 'Captain'],
    });
    const blockExposed = play(
      game,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'c' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    expect(blockExposed.state.phase).toBe('awaitingResponses');
    expect(blockExposed.state.pending?.failedBlockers).toEqual({ b: true });
    expect(responseOptions(blockExposed, 'b')).toBeNull();
    expect(() =>
      play(blockExposed, { type: 'block', playerId: 'b', claim: 'Duke' }),
    ).toThrow('You cannot block now');
    expect(responseOptions(blockExposed, 'c')).toEqual({
      canChallenge: false,
      blockClaims: ['Duke'],
    });

    const blocked = play(
      blockExposed,
      { type: 'block', playerId: 'c', claim: 'Duke' },
      { type: 'pass', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
    );
    expect(blocked.state.lastAction?.blocked).toBe(true);
    expect(blocked.players.a.coins).toBe(2);
    expect(blocked.state.currentTurnPlayer).toBe('b');
  });
});
