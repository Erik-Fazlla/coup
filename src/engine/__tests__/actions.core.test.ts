import {applyAction} from '../actions';
import {identityRng, makeGame, play} from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']}, {coins});

describe('income', () => {
  it('gives 1 coin and passes the turn', () => {
    const game = play(three(), {type: 'income', playerId: 'a'});
    expect(game.players.a.coins).toBe(3);
    expect(game.state).toEqual({
      phase: 'action',
      currentTurnPlayer: 'b',
      turnNumber: 2,
      pending: null,
      lastAction: {playerId: 'a', action: 'income', target: null, blocked: false},
    });
  });

  it('does not mutate the input game', () => {
    const game = three();
    const before = JSON.stringify(game);
    play(game, {type: 'income', playerId: 'a'});
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('illegal input', () => {
  it('rejects a player acting out of turn', () => {
    expect(() => play(three(), {type: 'income', playerId: 'b'})).toThrow('It is not your turn');
  });

  it('rejects a player who is not in the game', () => {
    expect(() => play(three(), {type: 'income', playerId: 'z'})).toThrow('You are not in this game');
  });

  it('rejects actions when the game is not in progress', () => {
    const game = three();
    game.status = 'waiting';
    expect(() => applyAction(game, {type: 'income', playerId: 'a'}, identityRng)).toThrow(
      'Game is not in progress',
    );
  });

  it('throws an error named IllegalActionError', () => {
    try {
      play(three(), {type: 'income', playerId: 'b'});
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as Error).name).toBe('IllegalActionError');
    }
  });
});

describe('coup', () => {
  it('needs 7 coins', () => {
    expect(() => play(three(), {type: 'coup', playerId: 'a', target: 'b'})).toThrow('Not enough coins');
  });

  it('needs a living opponent as target', () => {
    const game = three({a: 7});
    expect(() => play(game, {type: 'coup', playerId: 'a', target: 'a'})).toThrow('Choose a living opponent');
    game.players.b.influence.forEach(i => (i.revealed = true));
    expect(() => play(game, {type: 'coup', playerId: 'a', target: 'b'})).toThrow('Choose a living opponent');
  });

  it('costs 7 and makes the target choose a card to lose', () => {
    const declared = play(three({a: 7}), {type: 'coup', playerId: 'a', target: 'b'});
    expect(declared.players.a.coins).toBe(0);
    expect(declared.state.phase).toBe('loseInfluence');
    expect(declared.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'endTurn'});

    const done = play(declared, {type: 'loseInfluence', playerId: 'b', cardIndex: 1});
    expect(done.players.b.influence).toEqual([
      {card: 'Contessa', revealed: false},
      {card: 'Assassin', revealed: true},
    ]);
    expect(done.state.phase).toBe('action');
    expect(done.state.currentTurnPlayer).toBe('b');
    expect(done.state.turnNumber).toBe(2);
    expect(done.state.pending).toBeNull();
  });

  it('only lets the chosen player pick, and only a hidden card', () => {
    const declared = play(three({a: 7}), {type: 'coup', playerId: 'a', target: 'b'});
    expect(() => play(declared, {type: 'loseInfluence', playerId: 'c', cardIndex: 0})).toThrow(
      'You do not need to lose a card',
    );
    expect(() => play(declared, {type: 'loseInfluence', playerId: 'b', cardIndex: 5})).toThrow(
      'That card is not available',
    );
  });

  it('is forced at 10 or more coins', () => {
    expect(() => play(three({a: 10}), {type: 'income', playerId: 'a'})).toThrow(
      'You must Coup with 10 or more coins',
    );
  });

  it('reveals the last card automatically and eliminates the player', () => {
    const game = three({a: 7});
    game.players.b.influence[0].revealed = true;
    const done = play(game, {type: 'coup', playerId: 'a', target: 'b'});
    expect(done.players.b.influence.every(i => i.revealed)).toBe(true);
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.phase).toBe('action');
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('ends the game when one player remains', () => {
    const game = makeGame({a: ['Duke', 'Captain'], b: ['Contessa']}, {coins: {a: 7}});
    const done = play(game, {type: 'coup', playerId: 'a', target: 'b'});
    expect(done.status).toBe('finished');
    expect(done.state.phase).toBe('finished');
    expect(done.winner).toBe('a');
    expect(done.log[done.log.length - 1]).toBe('A wins');
  });
});

describe('turn order', () => {
  it('skips eliminated players', () => {
    const game = three();
    game.players.b.influence.forEach(i => (i.revealed = true));
    game.players.b.eliminatedAt = 0;
    expect(play(game, {type: 'income', playerId: 'a'}).state.currentTurnPlayer).toBe('c');
  });

  it('wraps around to the first player', () => {
    const game = three();
    game.state.currentTurnPlayer = 'c';
    expect(play(game, {type: 'income', playerId: 'c'}).state.currentTurnPlayer).toBe('a');
  });
});
