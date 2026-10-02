import { makeGame, play } from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame(
    {
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    },
    { coins },
  );

describe('passing', () => {
  it('resolves foreign aid only after everyone else passes', () => {
    const declared = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(declared.state.phase).toBe('awaitingResponses');
    expect(declared.players.a.coins).toBe(2);

    const onePass = play(declared, { type: 'pass', playerId: 'b' });
    expect(onePass.state.phase).toBe('awaitingResponses');
    expect(onePass.players.a.coins).toBe(2);

    const done = play(onePass, { type: 'pass', playerId: 'c' });
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('b');
    expect(done.state.phase).toBe('action');
  });

  it('rejects a pass from the actor or a second pass', () => {
    const declared = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(() => play(declared, { type: 'pass', playerId: 'a' })).toThrow(
      'You have nothing to respond to',
    );
    const onePass = play(declared, { type: 'pass', playerId: 'b' });
    expect(() => play(onePass, { type: 'pass', playerId: 'b' })).toThrow(
      'You have nothing to respond to',
    );
  });

  it('resolves tax for 3 coins', () => {
    const done = play(
      three(),
      { type: 'tax', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(done.players.a.coins).toBe(5);
  });

  it('resolves steal for up to 2 coins', () => {
    const full = play(
      three(),
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(full.players.a.coins).toBe(4);
    expect(full.players.b.coins).toBe(0);

    const partial = play(
      three({ b: 1 }),
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(partial.players.a.coins).toBe(3);
    expect(partial.players.b.coins).toBe(0);
  });
});

describe('blocking', () => {
  it('cancels foreign aid when a Duke block goes unchallenged', () => {
    const blocked = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(blocked.state.phase).toBe('awaitingBlockResponses');
    expect(blocked.state.pending?.block).toEqual({
      blocker: 'b',
      claim: 'Duke',
      responses: {},
    });

    const done = play(
      blocked,
      { type: 'pass', playerId: 'a' },
      { type: 'pass', playerId: 'c' },
    );
    expect(done.players.a.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('does not let the blocker pass on their own block', () => {
    const blocked = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(() => play(blocked, { type: 'pass', playerId: 'b' })).toThrow(
      'You have nothing to respond to',
    );
  });

  it('does not allow blocking tax', () => {
    const declared = play(three(), { type: 'tax', playerId: 'a' });
    expect(() =>
      play(declared, { type: 'block', playerId: 'b', claim: 'Duke' }),
    ).toThrow('You cannot block now');
  });

  it('lets only the target block a steal, and only as Captain or Ambassador', () => {
    const declared = play(three(), {
      type: 'steal',
      playerId: 'a',
      target: 'b',
    });
    expect(() =>
      play(declared, { type: 'block', playerId: 'c', claim: 'Captain' }),
    ).toThrow('You cannot block now');
    expect(() =>
      play(declared, { type: 'block', playerId: 'b', claim: 'Duke' }),
    ).toThrow('You cannot block now');

    const done = play(
      declared,
      { type: 'block', playerId: 'b', claim: 'Ambassador' },
      { type: 'pass', playerId: 'a' },
      { type: 'pass', playerId: 'c' },
    );
    expect(done.players.a.coins).toBe(2);
    expect(done.players.b.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
  });

  it('does not allow blocking a block', () => {
    const blocked = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(() =>
      play(blocked, { type: 'block', playerId: 'c', claim: 'Duke' }),
    ).toThrow('You cannot block now');
  });
});
