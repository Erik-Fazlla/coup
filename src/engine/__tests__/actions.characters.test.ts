import {pendingResponders, responseOptions} from '../rules';
import {makeGame, play} from '../testHelpers';

describe('assassinate', () => {
  const setup = (aHand: ['Assassin', 'Duke'] | ['Duke', 'Duke'] = ['Assassin', 'Duke']) =>
    makeGame({a: aHand, b: ['Duke', 'Captain'], c: ['Captain', 'Ambassador']}, {coins: {a: 3}});

  it('costs 3 and makes the target lose a card when unopposed', () => {
    const resolved = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(resolved.players.a.coins).toBe(0);
    expect(resolved.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'endTurn'});

    const done = play(resolved, {type: 'loseInfluence', playerId: 'b', cardIndex: 1});
    expect(done.players.b.influence[1].revealed).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('keeps the 3 coins spent when blocked by Contessa', () => {
    const done = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.a.coins).toBe(0);
    expect(done.players.b.influence.some(i => i.revealed)).toBe(false);
    expect(done.state.lastAction?.blocked).toBe(true);
  });

  it('refunds the 3 coins when the Assassin claim is exposed as a bluff', () => {
    const challenged = play(
      setup(['Duke', 'Duke']),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'b'},
    );
    expect(challenged.players.a.coins).toBe(3);
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});
  });

  it('costs the target both cards when a Contessa bluff is exposed', () => {
    const challenged = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'challenge', playerId: 'a'},
    );
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'resolveAction'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(done.players.b.influence.every(i => i.revealed)).toBe(true);
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('gives the target a block-only window after their own failed challenge', () => {
    const challenged = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'b'},
      {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    );
    expect(challenged.state.phase).toBe('awaitingResponses');
    expect(challenged.state.pending?.challengeResolved).toBe(true);
    expect(pendingResponders(challenged)).toEqual(['b']);
    expect(responseOptions(challenged, 'b')).toEqual({canChallenge: false, blockClaims: ['Contessa']});
    expect(() => play(challenged, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');

    const done = play(challenged, {type: 'pass', playerId: 'b'});
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('still lets the target block after another player fails a challenge', () => {
    const game = makeGame(
      {a: ['Assassin', 'Duke'], b: ['Contessa', 'Captain'], c: ['Captain', 'Ambassador']},
      {coins: {a: 3}},
    );
    const done = play(
      game,
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'c'},
      {type: 'loseInfluence', playerId: 'c', cardIndex: 0},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.c.influence[0].revealed).toBe(true);
    expect(done.players.b.influence.some(i => i.revealed)).toBe(false);
    expect(done.players.a.coins).toBe(0);
    expect(done.state.currentTurnPlayer).toBe('b');
  });
});

describe('exchange', () => {
  const setup = () =>
    makeGame(
      {a: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'], c: ['Captain', 'Duke']},
      {deck: ['Contessa', 'Assassin', 'Captain']},
    );
  const toExchange = (game = setup()) =>
    play(game, {type: 'exchange', playerId: 'a'}, {type: 'pass', playerId: 'b'}, {type: 'pass', playerId: 'c'});

  it('offers the hand plus two drawn cards', () => {
    const game = toExchange();
    expect(game.state.phase).toBe('exchange');
    expect(game.state.pending?.exchangeOptions).toEqual(['Ambassador', 'Duke', 'Contessa', 'Assassin']);
    expect(game.deck).toEqual(['Captain']);
  });

  it('keeps the chosen cards and returns the rest to the deck', () => {
    const done = play(toExchange(), {type: 'exchangeChoose', playerId: 'a', keep: [2, 3]});
    expect(done.players.a.influence).toEqual([
      {card: 'Contessa', revealed: false},
      {card: 'Assassin', revealed: false},
    ]);
    expect(done.deck).toEqual(['Captain', 'Ambassador', 'Duke']);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('keeps exactly one card when the player has one hidden card', () => {
    const game = setup();
    game.players.a.influence[0].revealed = true;
    const exchanging = toExchange(game);
    expect(exchanging.state.pending?.exchangeOptions).toEqual(['Duke', 'Contessa', 'Assassin']);
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [1, 2]})).toThrow(
      'Choose exactly 1 card(s)',
    );

    const done = play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [1]});
    expect(done.players.a.influence).toEqual([
      {card: 'Ambassador', revealed: true},
      {card: 'Contessa', revealed: false},
    ]);
    expect(done.deck).toHaveLength(3);
  });

  it('rejects duplicate or out-of-range choices and other players', () => {
    const exchanging = toExchange();
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [0, 0]})).toThrow(
      'Choose exactly 2 card(s)',
    );
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [0, 9]})).toThrow(
      'Choose exactly 2 card(s)',
    );
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'b', keep: [0, 1]})).toThrow(
      'You are not exchanging cards',
    );
  });
});
