import {availableActions, isAlive, livingPlayers, pendingResponders, responseOptions} from '../rules';
import {makeGame, makePending} from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']}, {coins});

describe('livingPlayers', () => {
  it('excludes players with no hidden cards', () => {
    const game = three();
    game.players.b.influence.forEach(i => (i.revealed = true));
    expect(livingPlayers(game)).toEqual(['a', 'c']);
    expect(isAlive(game, 'b')).toBe(false);
  });
});

describe('availableActions', () => {
  it('offers the free actions at 2 coins', () => {
    expect(availableActions(three(), 'a')).toEqual(['income', 'foreignAid', 'tax', 'steal', 'exchange']);
  });

  it('adds assassinate at 3 coins and coup at 7', () => {
    expect(availableActions(three({a: 3}), 'a')).toContain('assassinate');
    expect(availableActions(three({a: 3}), 'a')).not.toContain('coup');
    expect(availableActions(three({a: 7}), 'a')).toContain('coup');
  });

  it('forces coup at 10 coins', () => {
    expect(availableActions(three({a: 10}), 'a')).toEqual(['coup']);
  });

  it('offers nothing to players whose turn it is not', () => {
    expect(availableActions(three(), 'b')).toEqual([]);
  });

  it('offers nothing outside the action phase', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke'});
    expect(availableActions(game, 'a')).toEqual([]);
  });
});

describe('pendingResponders and responseOptions', () => {
  it('asks every other living player about a claimed action', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke'});
    expect(pendingResponders(game)).toEqual(['b', 'c']);
    expect(responseOptions(game, 'b')).toEqual({canChallenge: true, blockClaims: []});
    expect(responseOptions(game, 'a')).toBeNull();
  });

  it('lets anyone block foreign aid as Duke but not challenge it', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'foreignAid'});
    expect(responseOptions(game, 'c')).toEqual({canChallenge: false, blockClaims: ['Duke']});
  });

  it('lets only the target block a steal', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'steal', target: 'b', claim: 'Captain'});
    expect(responseOptions(game, 'b')).toEqual({canChallenge: true, blockClaims: ['Captain', 'Ambassador']});
    expect(responseOptions(game, 'c')).toEqual({canChallenge: true, blockClaims: []});
  });

  it('stops asking players who passed or are eliminated', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke', responses: {b: 'pass'}});
    expect(pendingResponders(game)).toEqual(['c']);
    game.players.c.influence.forEach(i => (i.revealed = true));
    expect(pendingResponders(game)).toEqual([]);
  });

  it('asks only the target, block-only, after a failed challenge', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({
      actor: 'a',
      action: 'steal',
      target: 'b',
      claim: 'Captain',
      challengeResolved: true,
    });
    expect(pendingResponders(game)).toEqual(['b']);
    expect(responseOptions(game, 'b')).toEqual({canChallenge: false, blockClaims: ['Captain', 'Ambassador']});
    expect(responseOptions(game, 'c')).toBeNull();
  });

  it('asks everyone but the blocker about a block', () => {
    const game = three();
    game.state.phase = 'awaitingBlockResponses';
    game.state.pending = makePending({
      actor: 'a',
      action: 'foreignAid',
      block: {blocker: 'b', claim: 'Duke', responses: {}},
    });
    expect(pendingResponders(game)).toEqual(['a', 'c']);
    expect(responseOptions(game, 'a')).toEqual({canChallenge: true, blockClaims: []});
    expect(responseOptions(game, 'b')).toBeNull();
  });
});
