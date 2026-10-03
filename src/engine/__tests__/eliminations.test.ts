import { newGame, rematch, startGame } from '../lobby';
import { identityRng, makeGame, play } from '../testHelpers';

describe('eliminations', () => {
  it('starts empty and stays empty while nobody is out', () => {
    expect(newGame('p1', 'P1', 'ABCDE', 0).eliminations).toEqual([]);
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: 7 } },
    );
    const game = play(
      start,
      { type: 'coup', playerId: 'a', target: 'b' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    expect(game.eliminations).toEqual([]);
  });

  it('credits a Coup to the player who paid for it', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'], c: ['Duke', 'Duke'] },
      { coins: { a: 7 } },
    );
    const game = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
  });

  it('credits an assassination to the assassin', () => {
    const start = makeGame(
      { a: ['Assassin', 'Captain'], b: ['Duke'], c: ['Duke', 'Duke'] },
      { coins: { a: 3 } },
    );
    const game = play(
      start,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
  });

  it('credits a wrong challenge of an action to the claimant who proved the card', () => {
    const start = makeGame({
      a: ['Duke', 'Captain'],
      b: ['Contessa'],
      c: ['Duke', 'Duke'],
    });
    const game = play(
      start,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
  });

  it('credits an exposed bluff to the challenger', () => {
    const start = makeGame({
      a: ['Captain'],
      b: ['Contessa', 'Duke'],
      c: ['Duke', 'Duke'],
    });
    const game = play(
      start,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'a', by: 'c', turn: 1 }]);
  });

  it('credits an exposed bluffed block to whoever challenged the block', () => {
    const start = makeGame({
      a: ['Captain', 'Assassin'],
      b: ['Assassin'],
      c: ['Contessa', 'Duke'],
    });
    const game = play(
      start,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'c', turn: 1 }]);
  });

  it('credits a wrong challenge of a block to the blocker who proved the card', () => {
    const start = makeGame({
      a: ['Captain', 'Assassin'],
      b: ['Duke', 'Assassin'],
      c: ['Contessa'],
    });
    const game = play(
      start,
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'c', by: 'b', turn: 1 }]);
  });

  it('credits the assassin when a bluffed Contessa costs one card and the assassination the last', () => {
    const start = makeGame(
      { a: ['Assassin', 'Duke'], b: ['Duke', 'Captain'], c: ['Duke', 'Duke'] },
      { coins: { a: 3 } },
    );
    const game = play(
      start,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Contessa' },
      // c exposes the bluff: that takes b's first card...
      { type: 'challenge', playerId: 'c' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    // ...and a's assassination takes the last one.
    expect(game.players.b.eliminatedAt).toBe(1);
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
  });

  it('credits the challenger when the bluffed Contessa was the last card', () => {
    const start = makeGame(
      { a: ['Assassin', 'Duke'], b: ['Duke'], c: ['Duke', 'Captain'] },
      { coins: { a: 3 } },
    );
    const game = play(
      start,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'c' },
      { type: 'block', playerId: 'b', claim: 'Contessa' },
      { type: 'challenge', playerId: 'c' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'c', turn: 1 }]);
  });

  it('credits the assassin when the target wrongly challenges and then loses the last card', () => {
    const start = makeGame(
      { a: ['Assassin', 'Duke'], b: ['Duke', 'Captain'], c: ['Duke', 'Duke'] },
      { coins: { a: 3 } },
    );
    const game = play(
      start,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      { type: 'challenge', playerId: 'b' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 1 },
      { type: 'pass', playerId: 'b' },
    );
    expect(game.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
  });

  it('lists eliminations in order with the turn each happened on', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'], c: ['Assassin'] },
      { coins: { a: 14 } },
    );
    const game = play(
      start,
      { type: 'coup', playerId: 'a', target: 'b' },
      { type: 'income', playerId: 'c' },
      { type: 'coup', playerId: 'a', target: 'c' },
    );
    expect(game.status).toBe('finished');
    expect(game.eliminations).toEqual([
      { playerId: 'b', by: 'a', turn: 1 },
      { playerId: 'c', by: 'a', turn: 3 },
    ]);
    // The record always agrees with the players' own eliminatedAt.
    game.eliminations.forEach(entry =>
      expect(game.players[entry.playerId].eliminatedAt).toBe(entry.turn),
    );
  });

  it('belongs to the current round only', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    const end = play(start, { type: 'coup', playerId: 'a', target: 'b' });
    expect(end.eliminations).toHaveLength(1);
    const lobby = rematch(end, 'a', identityRng);
    expect(lobby.eliminations).toEqual([]);
    expect(startGame(lobby, 'a', identityRng).eliminations).toEqual([]);
  });
});
