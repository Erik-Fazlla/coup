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
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'resolveAction'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
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
