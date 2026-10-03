import {
  ACTION_BUTTON,
  ACTION_DETAIL,
  ACTION_EFFECT,
  CHARACTER_CODE,
  CHARACTER_INFO,
  promptLine,
  statusLine,
  unavailableReason,
  viewerLine,
} from '../describe';
import { ACTION_COST, BLOCK_CLAIMS } from '../rules';
import { ActionType, CARDS } from '../types';
import { makeGame, makePending, play } from '../testHelpers';

const ALL_ACTIONS = Object.keys(ACTION_COST) as ActionType[];

describe('CHARACTER_INFO', () => {
  it('has an ability line and a distinct two-letter code for every character', () => {
    CARDS.forEach(card => {
      expect(CHARACTER_INFO[card].ability.trim().length).toBeGreaterThan(0);
      expect(CHARACTER_CODE[card]).toHaveLength(2);
    });
    expect(new Set(CARDS.map(card => CHARACTER_CODE[card])).size).toBe(
      CARDS.length,
    );
  });

  it('says a character blocks something exactly when the rules let it block', () => {
    CARDS.forEach(card => {
      const blocksInRules = ALL_ACTIONS.some(action =>
        BLOCK_CLAIMS[action].includes(card),
      );
      expect(CHARACTER_INFO[card].blocks !== null).toBe(blocksInRules);
    });
  });
});

describe('ACTION_EFFECT and ACTION_DETAIL', () => {
  it('cover every action and state the real cost', () => {
    ALL_ACTIONS.forEach(action => {
      expect(ACTION_EFFECT[action].trim().length).toBeGreaterThan(0);
      expect(ACTION_DETAIL[action].trim().length).toBeGreaterThan(0);
      if (ACTION_COST[action] > 0) {
        expect(ACTION_EFFECT[action]).toBe(`Pay ${ACTION_COST[action]}`);
        expect(ACTION_DETAIL[action]).toContain(
          `costs ${ACTION_COST[action]} coins`,
        );
      }
    });
  });
});

describe('unavailableReason', () => {
  const two = (coins: number) =>
    makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: coins } },
    );

  it('is null for every action the rules allow', () => {
    const game = two(7);
    ALL_ACTIONS.forEach(action => {
      expect(unavailableReason(game, 'a', action)).toBeNull();
    });
  });

  it('names the missing coins', () => {
    const game = two(2);
    expect(unavailableReason(game, 'a', 'assassinate')).toBe('needs 3 coins');
    expect(unavailableReason(game, 'a', 'coup')).toBe('needs 7 coins');
    expect(unavailableReason(game, 'a', 'steal')).toBeNull();
  });

  it('explains the forced Coup', () => {
    const game = two(10);
    expect(unavailableReason(game, 'a', 'coup')).toBeNull();
    expect(unavailableReason(game, 'a', 'income')).toBe(
      'you must Coup with 10 or more coins',
    );
  });

  it('says it is not the turn of anyone else, including strangers and responders', () => {
    const game = two(7);
    expect(unavailableReason(game, 'b', 'income')).toBe('not your turn');
    expect(unavailableReason(game, 'nobody', 'income')).toBe('not your turn');
    const waiting = play(game, { type: 'tax', playerId: 'a' });
    expect(unavailableReason(waiting, 'a', 'income')).toBe('not your turn');
  });
});

describe('viewerLine', () => {
  it('tells the current player to act, and everyone else whose turn it is', () => {
    expect(viewerLine(three(), 'a')).toEqual({
      text: 'Your turn: choose an action',
      yours: true,
    });
    expect(viewerLine(three(), 'b')).toEqual({
      text: "A's turn",
      yours: false,
    });
  });

  it('tells a player with 10 or more coins that they must Coup', () => {
    const game = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: 10 } },
    );
    expect(viewerLine(game, 'a')).toEqual({
      text: 'You have 10 or more coins: you must Coup',
      yours: true,
    });
  });

  it('shows the prompt to a player who must respond and the wait to the actor', () => {
    const game = play(three(), { type: 'tax', playerId: 'a' });
    expect(viewerLine(game, 'b')).toEqual({
      text: 'A claims Duke: Tax',
      yours: true,
    });
    expect(viewerLine(game, 'a')).toEqual({
      text: 'A: Tax. Waiting for B, C',
      yours: false,
    });
  });

  it('stops prompting a responder who has already passed', () => {
    const game = play(
      three(),
      { type: 'tax', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
    );
    expect(viewerLine(game, 'b')).toEqual({
      text: 'A: Tax. Waiting for C',
      yours: false,
    });
  });

  it('tells the player who must lose a card, and only them', () => {
    const game = play(
      makeGame(
        { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
        { coins: { a: 7 } },
      ),
      { type: 'coup', playerId: 'a', target: 'b' },
    );
    expect(viewerLine(game, 'b')).toEqual({
      text: 'Choose a card to lose',
      yours: true,
    });
    expect(viewerLine(game, 'a')).toEqual({
      text: 'B must lose a card',
      yours: false,
    });
  });

  it('tells the exchanging player to choose cards', () => {
    const game = play(
      three(),
      { type: 'exchange', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'pass', playerId: 'c' },
    );
    expect(viewerLine(game, 'a')).toEqual({
      text: 'Choose the cards to keep',
      yours: true,
    });
    expect(viewerLine(game, 'b').yours).toBe(false);
  });
});

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
