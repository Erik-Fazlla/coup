import {statusLine} from '../describe';
import {pendingResponders, responseOptions} from '../rules';
import {makeGame, play} from '../testHelpers';

describe('challenging an action', () => {
  it('costs the challenger a card when the claim is true, and swaps the proven card', () => {
    const game = makeGame(
      {a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']},
      {deck: ['Contessa', 'Assassin', 'Captain']},
    );
    const challenged = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'b'});
    expect(challenged.players.a.influence[0]).toEqual({card: 'Contessa', revealed: false});
    expect(challenged.deck).toEqual(['Assassin', 'Captain', 'Duke']);
    expect(challenged.state.phase).toBe('loseInfluence');
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'afterFailedChallenge'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(done.players.b.influence[0].revealed).toBe(true);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('costs the actor a card and cancels the action when the claim is a bluff', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    const challenged = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'c'});
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'a', cardIndex: 0});
    expect(done.players.a.coins).toBe(2);
    expect(done.players.a.influence[0].revealed).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('eliminates a one-card challenger automatically and still resolves the action', () => {
    const game = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    game.players.c.influence[0].revealed = true;
    const done = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'c'});
    expect(done.players.c.eliminatedAt).toBe(1);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('is not allowed against unclaimed actions or by the actor', () => {
    const three = () => makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    const aid = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(() => play(aid, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');
    const tax = play(three(), {type: 'tax', playerId: 'a'});
    expect(() => play(tax, {type: 'challenge', playerId: 'a'})).toThrow('You cannot challenge now');
  });
});

describe('challenging a block', () => {
  it('upholds a true block: challenger loses a card, blocker swaps the proven card', () => {
    const game = makeGame(
      {a: ['Captain', 'Captain'], b: ['Duke', 'Contessa'], c: ['Ambassador', 'Assassin']},
      {deck: ['Assassin', 'Ambassador', 'Captain']},
    );
    const challenged = play(
      game,
      {type: 'foreignAid', playerId: 'a'},
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'a'},
    );
    expect(challenged.players.b.influence[0]).toEqual({card: 'Assassin', revealed: false});
    expect(challenged.state.lastAction?.blocked).toBe(true);
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'a', cardIndex: 0});
    expect(done.players.a.coins).toBe(2);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('defeats a bluffed block: blocker loses a card and the action goes through', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Contessa', 'Contessa'], c: ['Ambassador', 'Assassin']});
    const challenged = play(
      game,
      {type: 'foreignAid', playerId: 'a'},
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'c'},
    );
    expect(challenged.state.pending?.block).toBeNull();
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'afterFailedBlock'});

    // C has not answered the Foreign Aid itself yet, so C is still asked before it resolves.
    const reopened = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(reopened.state.phase).toBe('awaitingResponses');
    const done = play(reopened, {type: 'pass', playerId: 'c'});
    expect(done.players.a.coins).toBe(4);
    expect(done.state.lastAction?.blocked).toBe(false);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('cannot be challenged by the blocker', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Duke', 'Contessa'], c: ['Ambassador', 'Assassin']});
    const blocked = play(game, {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(() => play(blocked, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');
  });
});

describe('after a bluffed block is exposed', () => {
  /** A bluffs Captain to steal from B; B bluff-blocks as Ambassador before C answers; A exposes the block. */
  const stealBlockExposed = () =>
    play(
      makeGame({a: ['Duke', 'Duke'], b: ['Contessa', 'Contessa'], c: ['Assassin', 'Assassin']}),
      {type: 'steal', playerId: 'a', target: 'b'},
      {type: 'block', playerId: 'b', claim: 'Ambassador'},
      {type: 'challenge', playerId: 'a'},
      {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    );

  /** A takes Foreign Aid; B bluff-blocks as Duke; A exposes the block. `before` runs first (e.g. a pass). */
  const aidBlockExposed = (hands: Parameters<typeof makeGame>[0], ...before: Parameters<typeof play>[1][]) =>
    play(
      makeGame(hands),
      {type: 'foreignAid', playerId: 'a'},
      ...before,
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'a'},
      {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    );

  it('lets players who had not answered yet challenge the action', () => {
    const reopened = stealBlockExposed();
    expect(reopened.state.phase).toBe('awaitingResponses');
    expect(reopened.state.pending?.block).toBeNull();
    expect(reopened.state.pending?.responses).toEqual({b: 'pass'});
    expect(pendingResponders(reopened)).toEqual(['c']);
    expect(statusLine(reopened)).toBe('A: Steal on B. Waiting for C');

    const caught = play(
      reopened,
      {type: 'challenge', playerId: 'c'},
      {type: 'loseInfluence', playerId: 'a', cardIndex: 0},
    );
    expect(caught.players.a.influence[0].revealed).toBe(true);
    expect(caught.players.a.coins).toBe(2);
    expect(caught.players.b.coins).toBe(2);
    expect(caught.state.currentTurnPlayer).toBe('b');
  });

  it('resolves the action once the remaining players pass', () => {
    const done = play(stealBlockExposed(), {type: 'pass', playerId: 'c'});
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
    expect(responseOptions(reopened, 'c')).toEqual({canChallenge: false, blockClaims: ['Duke']});

    const done = play(
      reopened,
      {type: 'block', playerId: 'c', claim: 'Duke'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'b'},
    );
    expect(done.players.a.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('resolves at once when nobody is left to ask', () => {
    const done = aidBlockExposed(
      {a: ['Captain', 'Captain'], b: ['Contessa', 'Contessa'], c: ['Duke', 'Assassin']},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('does not ask a blocker who was eliminated by the exposure', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Contessa'], c: ['Duke', 'Assassin']});
    const done = play(
      game,
      {type: 'foreignAid', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'a'},
    );
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('c');
  });
});
