import { ACTION_BUTTON, promptLine, statusLine } from '../describe';
import { ACTION_COST } from '../rules';
import { ActionType } from '../types';
import { makeGame, makePending, play } from '../testHelpers';

const three = () =>
  makeGame({
    a: ['Duke', 'Captain'],
    b: ['Contessa', 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });

describe('statusLine', () => {
  it('names whose turn it is', () => {
    expect(statusLine(three())).toBe("A's turn");
  });

  it('names who still has to respond to an action', () => {
    const game = play(
      three(),
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(statusLine(game)).toBe('A: Steal on B. Waiting for B');
  });

  it('names who still has to respond to a block', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    expect(statusLine(game)).toBe('B blocks with Duke. Waiting for A, C');
  });

  it('names who must lose a card', () => {
    const game = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: 7 } },
    );
    expect(
      statusLine(play(game, { type: 'coup', playerId: 'a', target: 'b' })),
    ).toBe('B must lose a card');
  });

  it('names the exchanging player and the winner', () => {
    const exchanging = play(
      three(),
      { type: 'exchange', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(statusLine(exchanging)).toBe('A is exchanging cards');

    const finished = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa'] },
      { coins: { a: 7 } },
    );
    expect(
      statusLine(play(finished, { type: 'coup', playerId: 'a', target: 'b' })),
    ).toBe('A wins');
  });
});

describe('statusLine fallback', () => {
  it('falls back to the turn line, not the exchange text, for an inconsistent loseInfluence state', () => {
    const game = three();
    game.state.phase = 'loseInfluence';
    game.state.pending = makePending({
      actor: 'a',
      action: 'coup',
      target: 'b',
      loseInfluence: null,
    });
    expect(statusLine(game)).toBe("A's turn");
  });

  it('falls back to the turn line for a block phase without a block', () => {
    const game = three();
    game.state.phase = 'awaitingBlockResponses';
    game.state.pending = makePending({ actor: 'a', action: 'foreignAid' });
    expect(statusLine(game)).toBe("A's turn");
  });
});

describe('promptLine', () => {
  it('describes a claimed action', () => {
    expect(promptLine(play(three(), { type: 'tax', playerId: 'a' }))).toBe(
      'A claims Duke: Tax',
    );
    expect(
      promptLine(play(three(), { type: 'steal', playerId: 'a', target: 'b' })),
    ).toBe('A claims Captain: Steal on B');
  });

  it('describes an unclaimed action and a block', () => {
    const aid = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(promptLine(aid)).toBe('A uses Foreign Aid');
    expect(
      promptLine(play(aid, { type: 'block', playerId: 'b', claim: 'Duke' })),
    ).toBe('B claims Duke to block Foreign Aid');
  });

  it('is empty when nothing is pending', () => {
    expect(promptLine(three())).toBe('');
  });
});

describe('ACTION_BUTTON', () => {
  it('has a non-empty label for every action type', () => {
    (Object.keys(ACTION_COST) as ActionType[]).forEach(action => {
      expect(ACTION_BUTTON[action].trim().length).toBeGreaterThan(0);
    });
  });

  it('uses the short labels', () => {
    expect(ACTION_BUTTON).toEqual({
      income: 'Income +1',
      foreignAid: 'Foreign Aid +2',
      coup: 'Coup −7',
      tax: 'Tax +3 (Duke)',
      assassinate: 'Assassinate −3',
      steal: 'Steal 2 (Captain)',
      exchange: 'Exchange (Ambassador)',
    });
  });
});
