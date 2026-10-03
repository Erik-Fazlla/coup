import React from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Vibration,
} from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { ActionGrid } from '../../components/ActionGrid';
import { OnlineDot } from '../../components/OnlineDot';
import { ResponseBar } from '../../components/ResponseBar';
import { Seat } from '../../components/Seat';
import { REGION_GAP, tableLayout } from '../../components/tableLayout';
import { TopBar } from '../../components/TopBar';
import { REVEAL_MS } from '../../ui/reveal';
import { playSound } from '../../ui/sound';
import { SKIP_AFTER_MS } from '../../ui/stalled';
import { BUZZ_PATTERN } from '../../ui/turnBuzz';
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
const mockSkip = jest.fn();
let mockVibration = true;
let mockSound = true;
let mockGameValue: {
  game: Game | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  online: Record<string, true> | null;
  act: jest.Mock;
  leave: jest.Mock;
  skip: jest.Mock;
};

jest.mock('../../context/GameContext', () => ({
  useGame: () => mockGameValue,
}));
jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ playerId: 'me' }),
}));
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { vibration: mockVibration, sound: mockSound },
    update: jest.fn(),
  }),
}));
jest.mock('../../ui/sound', () => ({ playSound: jest.fn() }));
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
    // Presence has not arrived: no dots, as in every test that does not ask for them.
    online: {},
    act: mockAct,
    leave: mockLeave,
    skip: mockSkip,
    ...overrides,
  };
}

const mounted: ReactTestRenderer[] = [];

function mount(game: Game, overrides: Partial<typeof mockGameValue> = {}) {
  show(game, overrides);
  const renderer = render(<GameScreen />);
  mounted.push(renderer);
  return renderer;
}

/** The view on screen with this testID (not the component that was given it). */
function host(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.find(
    node => typeof node.type === 'string' && node.props.testID === testID,
  );
}

/** Delivers a new snapshot of the game, as the subscription would. */
function deliver(
  renderer: ReactTestRenderer,
  game: Game,
  overrides: Partial<typeof mockGameValue> = {},
) {
  show(game, overrides);
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

let vibrate: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockVibration = true;
  mockSound = true;
  vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
});

afterEach(() => {
  // Unmounting stops the skip and reveal clocks, so no timer outlives its test.
  mounted.splice(0).forEach(renderer => act(() => renderer.unmount()));
  jest.restoreAllMocks();
});

/** Makes the window this size, as rotating the phone would. */
function windowSize(width: number, height: number) {
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

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

describe('GameScreen turn buzz', () => {
  it('buzzes when my turn starts, once', () => {
    const renderer = mount(theirTurn());
    expect(vibrate).not.toHaveBeenCalled();
    deliver(renderer, myTurn());
    deliver(renderer, myTurn());
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(BUZZ_PATTERN.turn);
  });

  it('stays silent when vibration is switched off in settings', () => {
    mockVibration = false;
    const renderer = mount(theirTurn());
    deliver(renderer, myTurn());
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not buzz someone who is only watching', () => {
    mount(makeGame({ a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] }));
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('GameScreen sounds', () => {
  const played = () => (playSound as jest.Mock).mock.calls.map(call => call[0]);

  it('is silent when the game is opened on someone else', () => {
    mount(theirTurn());
    expect(played()).toEqual([]);
  });

  it('plays my turn, and buzzes, when the game is opened on my turn', () => {
    // The first player of a round: the screen opens on their own turn.
    mount(myTurn());
    expect(played()).toEqual(['turn']);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(BUZZ_PATTERN.turn);
  });

  it('plays what a new snapshot brings: coins for anyone, then my turn', () => {
    const renderer = mount(theirTurn());
    const next = play(theirTurn(), { type: 'income', playerId: 'other' });
    deliver(renderer, next);
    expect(played()).toEqual(['coin', 'turn']);
    // The same snapshot again adds nothing.
    deliver(renderer, next);
    expect(played()).toEqual(['coin', 'turn']);
  });

  it('plays the prompt when I am asked to respond', () => {
    const renderer = mount(theirTurn());
    deliver(renderer, play(theirTurn(), { type: 'tax', playerId: 'other' }));
    expect(played()).toEqual(['prompt']);
  });

  it('stays silent when sound is switched off in settings', () => {
    mockSound = false;
    const renderer = mount(theirTurn());
    deliver(renderer, play(theirTurn(), { type: 'income', playerId: 'other' }));
    expect(played()).toEqual([]);
  });

  it('plays nothing for someone who is only watching', () => {
    const watched = () =>
      makeGame({ a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] });
    const renderer = mount(watched());
    deliver(renderer, play(watched(), { type: 'income', playerId: 'a' }));
    expect(played()).toEqual([]);
  });
});

describe('GameScreen challenge reveal', () => {
  /** OTHER claims Duke without holding one, and I challenge. */
  const bluffCalled = () =>
    play(
      theirTurn(),
      { type: 'tax', playerId: 'other' },
      { type: 'challenge', playerId: 'me' },
    );

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const overlay = (renderer: ReactTestRenderer) =>
    findButton(renderer, 'reveal-overlay');

  it('shows a new challenge result in the middle of the table, then removes it', () => {
    const renderer = mount(theirTurn());
    expect(overlay(renderer)).toBeUndefined();

    deliver(renderer, bluffCalled());
    expect(overlay(renderer)).toBeDefined();
    expect(texts(renderer)).toContain('OTHER was bluffing — no Duke');
    expect(texts(renderer)).toContain('OTHER loses a card');
    expect(overlay(renderer)!.props.accessibilityLabel).toBe(
      'OTHER was bluffing — no Duke. OTHER loses a card. Tap to dismiss',
    );

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS);
    });
    expect(overlay(renderer)).toBeUndefined();
  });

  it('says who pays when the claim was true', () => {
    const game = myTurn();
    const renderer = mount(game);
    deliver(
      renderer,
      play(
        game,
        { type: 'tax', playerId: 'me' },
        { type: 'challenge', playerId: 'other' },
      ),
    );
    expect(texts(renderer)).toContain('ME had the Duke');
    expect(texts(renderer)).toContain('OTHER loses a card');
  });

  it('goes away when tapped', () => {
    const renderer = mount(theirTurn());
    deliver(renderer, bluffCalled());
    press(renderer, 'reveal-overlay');
    expect(overlay(renderer)).toBeUndefined();
  });

  it('does not replay the last challenge when the game is opened again', () => {
    const renderer = mount(bluffCalled());
    expect(overlay(renderer)).toBeUndefined();
    deliver(renderer, { ...bluffCalled(), log: ['a later snapshot'] });
    expect(overlay(renderer)).toBeUndefined();
  });

  it('leaves the prompt I must answer on screen and usable once it is gone', () => {
    // OTHER really holds the Duke, so my challenge costs me a card.
    const start = makeGame({
      other: ['Duke', 'Assassin'],
      me: ['Duke', 'Captain'],
    });
    const renderer = mount(start);
    deliver(
      renderer,
      play(
        start,
        { type: 'tax', playerId: 'other' },
        { type: 'challenge', playerId: 'me' },
      ),
    );
    expect(overlay(renderer)).toBeDefined();
    expect(texts(renderer)).toContain('ME loses a card');
    // The picker is already under the overlay, so nothing has to load when it leaves.
    expect(findButton(renderer, 'lose-card-0')).toBeDefined();

    act(() => {
      jest.advanceTimersByTime(REVEAL_MS);
    });
    expect(overlay(renderer)).toBeUndefined();
    press(renderer, 'lose-card-1');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'loseInfluence',
      playerId: 'me',
      cardIndex: 1,
    });
  });

  /** OTHER really holds the Duke: my challenge costs me a card, to be picked at once. */
  const lostChallenge = () => {
    const start = makeGame({
      other: ['Duke', 'Assassin'],
      me: ['Duke', 'Captain'],
    });
    const renderer = mount(start);
    deliver(
      renderer,
      play(
        start,
        { type: 'tax', playerId: 'other' },
        { type: 'challenge', playerId: 'me' },
      ),
    );
    return renderer;
  };

  it('lets me pick the card to lose while the result is still showing', () => {
    const renderer = lostChallenge();
    expect(overlay(renderer)).toBeDefined();
    // Nothing but the result card itself takes touches away from the table.
    expect(host(renderer, 'reveal-scrim').props.pointerEvents).toBe('none');
    expect(host(renderer, 'reveal-region').props.pointerEvents).toBe(
      'box-none',
    );
    press(renderer, 'lose-card-0');
    expect(mockAct).toHaveBeenCalledWith({
      type: 'loseInfluence',
      playerId: 'me',
      cardIndex: 0,
    });
  });

  it.each([
    ['landscape', 640, 360],
    ['portrait', 360, 640],
  ])(
    'keeps the result clear of the hand and the actions in %s',
    (_label, width, height) => {
      windowSize(width, height);
      const renderer = lostChallenge();
      const layout = tableLayout(width - 24, height - 16, 1);
      const region = StyleSheet.flatten(
        host(renderer, 'reveal-region').props.style,
      );
      expect(region.bottom).toBe(layout.bottomHeight + REGION_GAP);
      expect(region.top).toBe(0);
    },
  );
});

describe('GameScreen rules', () => {
  it('opens the rules from the top bar and closes them again', () => {
    const renderer = mount(myTurn());
    expect(rendered(renderer)).not.toContain('rules-sheet');
    press(renderer, 'rules');
    expect(rendered(renderer)).toContain('rules-sheet');
    ALL_ACTIONS.forEach(action =>
      expect(
        renderer.root.findAllByProps({ testID: `rule-${action}` }).length,
      ).toBeGreaterThan(0),
    );
    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(rendered(renderer)).not.toContain('rules-sheet');
  });
});

describe('GameScreen host skip', () => {
  /** I am the host (first to join) and the game waits for OTHER. */
  const waitingForOther = () => {
    const game = myTurn();
    game.state.currentTurnPlayer = 'other';
    return game;
  };

  const wait = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms);
    });

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers the host a skip after 45 seconds of the same wait, naming who is skipped', () => {
    const renderer = mount(waitingForOther());
    wait(SKIP_AFTER_MS - 1);
    expect(findButton(renderer, 'skip')).toBeUndefined();
    wait(1);
    expect(button(renderer, 'skip').props.accessibilityLabel).toBe(
      'Skip OTHER',
    );
  });

  it('asks before skipping, then calls skip', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const renderer = mount(waitingForOther());
    wait(SKIP_AFTER_MS);
    press(renderer, 'skip');
    expect(mockSkip).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Skip OTHER?');
    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find(option => option.text === 'Cancel')?.onPress?.();
    expect(mockSkip).not.toHaveBeenCalled();
    buttons.find(option => option.text === 'Skip')?.onPress?.();
    expect(mockSkip).toHaveBeenCalledTimes(1);
  });

  it('lets the host skip their own turn too', () => {
    const renderer = mount(myTurn());
    wait(SKIP_AFTER_MS);
    expect(button(renderer, 'skip').props.accessibilityLabel).toBe('Skip ME');
  });

  it('names everyone who has not responded', () => {
    const game = makeGame({
      me: ['Duke', 'Captain'],
      other: ['Contessa', 'Assassin'],
      third: ['Ambassador', 'Duke'],
    });
    const renderer = mount(play(game, { type: 'tax', playerId: 'me' }));
    wait(SKIP_AFTER_MS);
    expect(button(renderer, 'skip').props.accessibilityLabel).toBe(
      'Skip OTHER, THIRD',
    );
  });

  it('starts the count again when the game moves on', () => {
    const game = waitingForOther();
    const renderer = mount(game);
    wait(SKIP_AFTER_MS - 1000);
    const moved = waitingForOther();
    moved.state.turnNumber = game.state.turnNumber + 1;
    deliver(renderer, moved);
    wait(1000);
    expect(findButton(renderer, 'skip')).toBeUndefined();
    wait(SKIP_AFTER_MS);
    expect(findButton(renderer, 'skip')).toBeDefined();
  });

  it('takes the skip away as soon as the wait ends', () => {
    const game = waitingForOther();
    const renderer = mount(game);
    wait(SKIP_AFTER_MS);
    expect(findButton(renderer, 'skip')).toBeDefined();
    deliver(renderer, play(game, { type: 'income', playerId: 'other' }));
    expect(findButton(renderer, 'skip')).toBeUndefined();
  });

  it('is never offered to a player who is not the host', () => {
    const renderer = mount(theirTurn());
    wait(SKIP_AFTER_MS * 3);
    expect(findButton(renderer, 'skip')).toBeUndefined();
  });

  it('cannot be used while offline', () => {
    const renderer = mount(waitingForOther());
    wait(SKIP_AFTER_MS);
    deliver(renderer, waitingForOther(), { connected: false });
    expect(isEnabled(renderer, 'skip')).toBe(false);
  });
});

describe('GameScreen presence dots', () => {
  const seatLabel = (renderer: ReactTestRenderer) =>
    host(renderer, 'seat-other').props.accessibilityLabel as string;
  const dots = (renderer: ReactTestRenderer) =>
    renderer.root.findAllByType(OnlineDot).map(dot => dot.props.online);

  it('marks an opponent who is connected', () => {
    const renderer = mount(myTurn(), { online: { me: true, other: true } });
    expect(dots(renderer)).toEqual([true]);
    expect(seatLabel(renderer)).toBe('OTHER, 2 coins, 2 hidden cards, online');
  });

  it('marks an opponent who is not connected', () => {
    const renderer = mount(myTurn(), { online: { me: true } });
    expect(dots(renderer)).toEqual([false]);
    expect(seatLabel(renderer)).toBe('OTHER, 2 coins, 2 hidden cards, offline');
  });

  it('draws no dots when presence cannot be read', () => {
    const renderer = mount(myTurn(), { online: null });
    expect(dots(renderer)).toEqual([]);
    expect(seatLabel(renderer)).toBe('OTHER, 2 coins, 2 hidden cards');
  });

  it('draws no dots before the first presence snapshot that includes this phone', () => {
    expect(dots(mount(myTurn(), { online: {} }))).toEqual([]);
    expect(dots(mount(myTurn(), { online: { other: true } }))).toEqual([]);
  });
});

describe('GameScreen orientation', () => {
  const five = () =>
    makeGame({
      me: ['Duke', 'Captain'],
      p1: ['Contessa', 'Assassin'],
      p2: ['Contessa', 'Assassin'],
      p3: ['Ambassador', 'Duke'],
      p4: ['Ambassador', 'Captain'],
      p5: ['Contessa', 'Assassin'],
    });

  it('uses four action columns and the full top bar in landscape', () => {
    windowSize(640, 360);
    const renderer = mount(five());
    expect(renderer.root.findByType(ActionGrid).props.columns).toBe(4);
    expect(renderer.root.findByType(TopBar).props.compact).toBe(false);
    expect(
      renderer.root.findAllByType(Seat).map(seat => seat.props.width),
    ).toEqual([118, 118, 118, 118, 118]);
  });

  it('stacks the table with two action columns in portrait, and nothing scrolls', () => {
    windowSize(360, 640);
    const renderer = mount(five());
    expect(renderer.root.findByType(ActionGrid).props.columns).toBe(2);
    expect(renderer.root.findByType(TopBar).props.compact).toBe(true);
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
    ALL_ACTIONS.forEach(action =>
      expect(findButton(renderer, `action-${action}`)).toBeDefined(),
    );
    expect(
      renderer.root.findAllByType(Seat).map(seat => seat.props.width),
    ).toEqual([108, 108, 108, 108, 108]);
  });

  it('wraps the response tiles into two columns in portrait', () => {
    windowSize(360, 640);
    const game = play(theirTurn(), { type: 'tax', playerId: 'other' });
    const renderer = mount(game);
    expect(renderer.root.findByType(ResponseBar).props.columns).toBe(2);
  });

  it('follows the measured table size rather than the window', () => {
    windowSize(640, 360);
    const renderer = mount(five());
    act(() => {
      renderer.root
        .findAll(node => typeof node.props.onLayout === 'function')[0]
        .props.onLayout({
          nativeEvent: { layout: { width: 336, height: 624 } },
        });
    });
    expect(renderer.root.findByType(ActionGrid).props.columns).toBe(2);
  });
});

describe('GameScreen hidden information with every overlay open', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('never names an opponent hidden card in the reveal, the log or the rules', () => {
    const game = makeGame(
      {
        me: ['Duke', 'Captain'],
        other: ['SecretOne' as Card, 'SecretTwo' as Card],
        third: ['SecretThree' as Card, 'SecretFour' as Card],
      },
      { coins: { me: 8 } },
    );
    const secrets = ['SecretOne', 'SecretTwo', 'SecretThree', 'SecretFour'];
    const expectNoLeak = (renderer: ReactTestRenderer) =>
      secrets.forEach(name => expect(rendered(renderer)).not.toContain(name));

    const renderer = mount(game, { online: { me: true, other: true } });
    // I claim the Duke, THIRD challenges and is wrong: a reveal about my own card.
    deliver(
      renderer,
      play(
        game,
        { type: 'tax', playerId: 'me' },
        { type: 'challenge', playerId: 'third' },
      ),
      { online: { me: true, other: true } },
    );
    expect(findButton(renderer, 'reveal-overlay')).toBeDefined();
    expectNoLeak(renderer);

    press(renderer, 'event-banner');
    expect(rendered(renderer)).toContain('log-sheet');
    expectNoLeak(renderer);

    press(renderer, 'rules');
    expect(rendered(renderer)).toContain('rules-sheet');
    expectNoLeak(renderer);
  });
});
