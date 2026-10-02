import {makeGame, play} from '../testHelpers';

it('plays a complete three-player game to a winner', () => {
  const start = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});

  const end = play(
    start,
    // Turn 1: A taxes -> A 5
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    {type: 'pass', playerId: 'c'},
    // Turn 2: B income -> B 3
    {type: 'income', playerId: 'b'},
    // Turn 3: C taxes -> C 5
    {type: 'tax', playerId: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 4: A taxes -> A 8
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    {type: 'pass', playerId: 'c'},
    // Turn 5: B assassinates C -> B 0, C loses Ambassador
    {type: 'assassinate', playerId: 'b', target: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'c'},
    {type: 'loseInfluence', playerId: 'c', cardIndex: 0},
    // Turn 6: C taxes -> C 8
    {type: 'tax', playerId: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 7: A coups C -> A 1, C eliminated
    {type: 'coup', playerId: 'a', target: 'c'},
    // Turn 8: B income -> B 1
    {type: 'income', playerId: 'b'},
    // Turn 9: A taxes, B challenges and is wrong -> B loses Contessa, A 4
    {type: 'tax', playerId: 'a'},
    {type: 'challenge', playerId: 'b'},
    {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    // Turn 10: B income -> B 2
    {type: 'income', playerId: 'b'},
    // Turn 11: A taxes -> A 7
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 12: B income -> B 3
    {type: 'income', playerId: 'b'},
    // Turn 13: A coups B -> B eliminated, A wins
    {type: 'coup', playerId: 'a', target: 'b'},
  );

  expect(end.status).toBe('finished');
  expect(end.state.phase).toBe('finished');
  expect(end.winner).toBe('a');
  expect(end.players.a.coins).toBe(0);
  expect(end.players.b.eliminatedAt).toBe(13);
  expect(end.players.c.eliminatedAt).toBe(7);
  expect(end.state.turnNumber).toBe(13);
  expect(end.log[end.log.length - 1]).toBe('A wins');
  expect(() => play(end, {type: 'income', playerId: 'a'})).toThrow('Game is not in progress');
});
