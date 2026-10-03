import React from 'react';
import { Alert, ScrollView } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import {
  button,
  findButton,
  isEnabled,
  press,
  render,
  rendered,
  texts,
} from '../../components/testUtils';
import { ACTION_COST } from '../../engine/rules';
import { makeGame, play } from '../../engine/testHelpers';
import { ActionType, Card, Game } from '../../engine/types';
import { GameScreen } from '../GameScreen';

const mockAct = jest.fn();
const mockLeave = jest.fn();
let mockGameValue: {
  game: Game | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  act: jest.Mock;
  leave: jest.Mock;
};

jest.mock('../../context/GameContext', () => ({
  useGame: () => mockGameValue,
}));
jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ playerId: 'me' }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const ALL_ACTIONS = Object.keys(ACTION_COST) as ActionType[];

function show(game: Game, overrides: Partial<typeof mockGameValue> = {}) {
  mockGameValue = {
    game,
    connected: true,
    busy: false,
    error: null,
    act: mockAct,
    leave: mockLeave,
    ...overrides,
  };
}

function mount(game: Game, overrides: Partial<typeof mockGameValue> = {}) {
  show(game, overrides);
  return render(<GameScreen />);
}

/** Delivers a new snapshot of the game, as the subscription would. */
function deliver(renderer: ReactTestRenderer, game: Game) {
  show(game);
  act(() => {
    renderer.update(<GameScreen />);
  });
}

/** It is my turn, with enough coins for everything. */
const myTurn = () =>
  makeGame(
    { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
    { coins: { me: 8, other: 2 } },
  );

/** The opponent acts first. */
const theirTurn = () =>
  makeGame({ other: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'] });

const isTarget = (renderer: ReactTestRenderer, id: string) =>
  findButton(renderer, `seat-${id}`) !== undefined;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GameScreen targeting', () => {
  it('sends a targeted action only after a seat is tapped', () => {
    const renderer = mount(myTurn());
    expect(isTarget(renderer, 'other')).toBe(false);

    press(renderer, 'action-steal');
    expect(mockAct).not.toHaveBeenCalled();
    expect(texts(renderer)).toContain('Steal: tap a player above');
    expect(isTarget(renderer, 'other')).toBe(true);
    expect(findButton(renderer, 'action-back')).toBeDefined();

    press(renderer, 'seat-other');
    expect(mockAct).toHaveBeenCalledTimes(1);
    expect(mockAct).toHaveBeenCalledWith({
      type: 'steal',
      playerId: 'me',
      target: 'other',
    });
    expect(isTarget(renderer, 'other')).toBe(false);
    expect(findButton(renderer, 'action-back')).toBeUndefined();
  });

  it('keeps every action on screen while a target is being chosen', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-coup');
    ALL_ACTIONS.forEach(action => {
      expect(findButton(renderer, `action-${action}`)).toBeDefined();
    });
  });

  it('cancels with Back without sending anything', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-coup');
    press(renderer, 'action-back');
    expect(mockAct).not.toHaveBeenCalled();
    expect(isTarget(renderer, 'other')).toBe(false);
    expect(texts(renderer)).toContain('Your turn: choose an action');
  });

  it('sends an untargeted action directly', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-income');
    expect(mockAct).toHaveBeenCalledWith({ type: 'income', playerId: 'me' });
  });

  it('drops the aim when an untargeted action is sent instead', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-steal');
    press(renderer, 'action-tax');
    expect(mockAct).toHaveBeenCalledWith({ type: 'tax', playerId: 'me' });
    expect(isTarget(renderer, 'other')).toBe(false);
  });

  it('makes only living opponents targetable', () => {
    const game = makeGame(
      {
        me: ['Duke', 'Captain'],
        other: ['Contessa', 'Assassin'],
        gone: ['Duke', 'Duke'],
      },
      { coins: { me: 8 } },
    );
    game.players.gone.influence.forEach(i => (i.revealed = true));
    const renderer = mount(game);
    press(renderer, 'action-coup');
    expect(isTarget(renderer, 'other')).toBe(true);
    expect(isTarget(renderer, 'gone')).toBe(false);
  });

  it('lets the player steal from someone with no coins', () => {
    const game = makeGame(
      { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
      { coins: { me: 2, other: 0 } },
    );
    const renderer = mount(game);
    press(renderer, 'action-steal');
    press(renderer, 'seat-other');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'steal',
      playerId: 'me',
      target: 'other',
    });
  });

  it('clears the aim when the phase changes, and does not bring it back', () => {
    const game = myTurn();
    const renderer = mount(game);
    press(renderer, 'action-steal');
    expect(isTarget(renderer, 'other')).toBe(true);

    // The game moves on without this screen sending anything.
    deliver(renderer, play(game, { type: 'tax', playerId: 'me' }));
    expect(isTarget(renderer, 'other')).toBe(false);
    expect(findButton(renderer, 'action-back')).toBeUndefined();

    // Back in the player's action phase: the old aim must not reappear.
    deliver(renderer, myTurn());
    expect(isTarget(renderer, 'other')).toBe(false);
    expect(findButton(renderer, 'action-back')).toBeUndefined();
    expect(mockAct).not.toHaveBeenCalled();
  });

  it('does not let a seat be tapped while offline', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-steal');
    show(myTurn(), { connected: false });
    act(() => {
      renderer.update(<GameScreen />);
    });
    press(renderer, 'seat-other');
    expect(mockAct).not.toHaveBeenCalled();
  });
});

describe('GameScreen actions', () => {
  it('offers only Coup at 10 or more coins', () => {
    const game = makeGame(
      { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
      { coins: { me: 10 } },
    );
    const renderer = mount(game);
    expect(
      ALL_ACTIONS.filter(action => isEnabled(renderer, `action-${action}`)),
    ).toEqual(['coup']);
    expect(texts(renderer)).toContain(
      'You have 10 or more coins: you must Coup',
    );
  });

  it('enables nothing when it is not the player turn, and says whose turn it is', () => {
    const renderer = mount(theirTurn());
    expect(
      ALL_ACTIONS.filter(action => isEnabled(renderer, `action-${action}`)),
    ).toEqual([]);
    expect(texts(renderer)).toContain("OTHER's turn");
    press(renderer, 'action-income');
    expect(mockAct).not.toHaveBeenCalled();
  });

  it('enables nothing while offline and says so', () => {
    const renderer = mount(myTurn(), { connected: false });
    expect(
      ALL_ACTIONS.filter(action => isEnabled(renderer, `action-${action}`)),
    ).toEqual([]);
    expect(rendered(renderer)).toContain('Reconnecting');
  });

  it('never scrolls sideways or at all while the log is closed', () => {
    const five = makeGame({
      me: ['Duke', 'Captain'],
      p1: ['Contessa', 'Assassin'],
      p2: ['Contessa', 'Assassin'],
      p3: ['Ambassador', 'Duke'],
      p4: ['Ambassador', 'Captain'],
      p5: ['Contessa', 'Assassin'],
    });
    const renderer = mount(five);
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
    press(renderer, 'action-steal');
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
    ['p1', 'p2', 'p3', 'p4', 'p5'].forEach(id =>
      expect(isTarget(renderer, id)).toBe(true),
    );
  });
});

describe('GameScreen responses', () => {
  it('shows a responder the prompt and the response tiles in place of the grid', () => {
    const game = play(theirTurn(), { type: 'tax', playerId: 'other' });
    const renderer = mount(game);
    expect(texts(renderer)).toContain('OTHER claims Duke: Tax');
    expect(findButton(renderer, 'action-income')).toBeUndefined();

    press(renderer, 'response-challenge');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'challenge',
      playerId: 'me',
      seq: game.state.claimSeq,
    });
  });

  it('shows the actor who is waiting the grid, disabled, and the wait', () => {
    const game = play(myTurn(), { type: 'tax', playerId: 'me' });
    const renderer = mount(game);
    expect(findButton(renderer, 'response-pass')).toBeUndefined();
    expect(texts(renderer)).toContain('ME: Tax. Waiting for OTHER');
    expect(isEnabled(renderer, 'action-income')).toBe(false);
  });

  it('asks the player who must lose a card to pick one', () => {
    const game = play(
      makeGame(
        { other: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'] },
        { coins: { other: 7 } },
      ),
      { type: 'coup', playerId: 'other', target: 'me' },
    );
    const renderer = mount(game);
    expect(texts(renderer)).toContain('Choose a card to lose');
    press(renderer, 'lose-card-1');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'loseInfluence',
      playerId: 'me',
      cardIndex: 1,
    });
  });

  it('lets the exchanging player choose which cards to keep', () => {
    const game = play(
      myTurn(),
      { type: 'exchange', playerId: 'me' },
      { type: 'pass', playerId: 'other' },
    );
    const renderer = mount(game);
    expect(texts(renderer)).toContain('Choose the cards to keep');
    press(renderer, 'exchange-card-0');
    press(renderer, 'exchange-card-2');
    press(renderer, 'exchange-confirm');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'exchangeChoose',
      playerId: 'me',
      keep: [0, 2],
    });
  });

  it('tells an eliminated player they are out instead of offering actions', () => {
    const game = makeGame({
      other: ['Contessa', 'Assassin'],
      me: ['Duke', 'Captain'],
      third: ['Ambassador', 'Duke'],
    });
    game.players.me.influence.forEach(i => (i.revealed = true));
    const renderer = mount(game);
    expect(texts(renderer)).toContain('You are out');
    expect(findButton(renderer, 'action-income')).toBeUndefined();
  });
});

describe('GameScreen hidden information', () => {
  /** Card names that exist nowhere else, so finding one on screen can only be a leak. */
  const hands = () =>
    makeGame(
      {
        me: ['Duke', 'Captain'],
        other: ['SecretOne' as Card, 'SecretTwo' as Card],
        third: ['SecretThree' as Card, 'Ambassador'],
      },
      { coins: { me: 8 } },
    );

  const expectNoLeak = (renderer: ReactTestRenderer) => {
    ['SecretOne', 'SecretTwo', 'SecretThree'].forEach(name =>
      expect(rendered(renderer)).not.toContain(name),
    );
  };

  it('never renders an opponent hidden card, in text or in a label', () => {
    const game = hands();
    game.players.third.influence[1].revealed = true;
    const renderer = mount(game);
    expectNoLeak(renderer);
    // The card that was lost is public and is shown.
    expect(rendered(renderer)).toContain('Ambassador, lost');

    press(renderer, 'action-steal');
    expectNoLeak(renderer);

    press(renderer, 'event-banner');
    expectNoLeak(renderer);
  });

  it('does not name a real hidden card either', () => {
    // Nothing on my side of the table mentions Contessa, so any occurrence is the opponent's card.
    const renderer = mount(
      makeGame({ me: ['Duke', 'Captain'], other: ['Contessa', 'Contessa'] }),
    );
    expect(rendered(renderer)).not.toContain('Contessa');
  });

  it('shows my own cards, and a lost one as lost', () => {
    const game = myTurn();
    game.players.me.influence[0].revealed = true;
    const labels = mount(game)
      .root.findAll(node => typeof node.type === 'string')
      .map(node => node.props.accessibilityLabel);
    expect(labels).toContain('Duke, lost');
    expect(labels).toContain('Captain: Steal 2 · blocks Steal');
  });
});

describe('GameScreen banner, log and leaving', () => {
  it('shows the latest log entry and opens the full log when tapped', () => {
    const game = myTurn();
    game.log = ['first thing', 'second thing'];
    const renderer = mount(game);
    expect(texts(renderer)).toContain('second thing');
    expect(texts(renderer)).not.toContain('first thing');

    press(renderer, 'event-banner');
    expect(texts(renderer)).toContain('first thing');

    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(texts(renderer)).not.toContain('first thing');
  });

  it('shows an error from the last tap', () => {
    const renderer = mount(myTurn(), { error: 'Too late' });
    expect(texts(renderer)).toContain('Too late');
  });

  it('asks before leaving', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const renderer = mount(myTurn());
    press(renderer, 'leave');
    expect(mockLeave).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find(option => option.text === 'Leave')?.onPress?.();
    expect(mockLeave).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('offers a way home to someone who is not in the game', () => {
    const renderer = mount(
      makeGame({ a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] }),
    );
    expect(texts(renderer)).toContain('You are not a player in this game.');
    act(() => {
      renderer.root.findByProps({ label: 'Back to Home' }).props.onPress();
    });
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without a game', () => {
    show(myTurn(), { game: null });
    expect(render(<GameScreen />).toJSON()).toBeNull();
  });
});

describe('GameScreen buttons', () => {
  it('gives every button a role, a label and a disabled state a screen reader can read', () => {
    const renderer = mount(myTurn());
    press(renderer, 'action-steal');
    const buttons = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.accessibilityRole === 'button',
    );
    expect(buttons.length).toBeGreaterThanOrEqual(10);
    buttons.forEach(node => {
      expect(typeof node.props.accessibilityLabel).toBe('string');
    });
    expect(button(renderer, 'seat-other').props.accessibilityLabel).toBe(
      'Steal: OTHER, 2 coins, 2 hidden cards. Tap to target',
    );
  });
});
