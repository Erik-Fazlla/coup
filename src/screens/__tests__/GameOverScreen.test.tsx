import React from 'react';
import { act, ReactTestRenderer } from 'react-test-renderer';
import {
  findButton,
  isEnabled,
  press,
  render,
  rendered,
  texts,
} from '../../components/testUtils';
import { removePlayer } from '../../engine/lobby';
import { makeGame } from '../../engine/testHelpers';
import { Card, Game } from '../../engine/types';
import { playSound } from '../../ui/sound';
import { useGameSounds } from '../../ui/soundCues';
import { GameOverScreen } from '../GameOverScreen';

const mockLeave = jest.fn();
const mockRematch = jest.fn();
const mockRecordResult = jest.fn();
let mockPlayerId = 'a';
let mockSound = true;
let mockGameValue: {
  game: Game | null;
  gameId: string | null;
  connected: boolean;
  busy: boolean;
  error: string | null;
  leave: jest.Mock;
  rematch: jest.Mock;
};

jest.mock('../../context/GameContext', () => ({
  useGame: () => mockGameValue,
}));
jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({
    playerId: mockPlayerId,
    recordResult: mockRecordResult,
  }),
}));
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { vibration: true, sound: mockSound },
    update: jest.fn(),
  }),
}));
jest.mock('../../ui/sound', () => ({ playSound: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/** A finished game of three: A (the host) won, C went out first, then B. */
function finished(): Game {
  const game = makeGame({
    a: ['Duke', 'Captain'],
    b: ['SecretOne' as Card, 'Assassin'],
    c: ['Ambassador', 'Duke'],
  });
  ['b', 'c'].forEach(id =>
    game.players[id].influence.forEach(card => (card.revealed = true)),
  );
  // B's first card was lost; pretend the other never was, to prove it cannot leak.
  game.players.b.influence[0].revealed = false;
  return {
    ...game,
    status: 'finished',
    winner: 'a',
    round: 2,
    scores: { a: 2, c: 1 },
    eliminations: [
      { playerId: 'c', by: 'b', turn: 6 },
      { playerId: 'b', by: 'a', turn: 11 },
    ],
    state: { ...game.state, phase: 'finished', turnNumber: 11 },
    log: ['Game started', 'A wins'],
  };
}

/** What the contexts hand the screen: the finished game, seen by player `as`. */
function show(as: string, overrides: Partial<typeof mockGameValue> = {}) {
  mockPlayerId = as;
  mockGameValue = {
    game: finished(),
    gameId: 'game-1',
    connected: true,
    busy: false,
    error: null,
    leave: mockLeave,
    rematch: mockRematch,
    ...overrides,
  };
}

function mount(
  as: string,
  overrides: Partial<typeof mockGameValue> = {},
): ReactTestRenderer {
  show(as, overrides);
  return render(<GameOverScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordResult.mockResolvedValue(undefined);
  mockSound = true;
});

describe('GameOverScreen summary', () => {
  it('announces the winner by name, or as you', () => {
    expect(texts(mount('b'))).toContain('A wins');
    expect(texts(mount('a'))).toContain('You win!');
  });

  it('tells how it went, one line per elimination, in order', () => {
    const lines = texts(mount('b')).filter(
      (text): text is string =>
        typeof text === 'string' && text.includes('taken out'),
    );
    expect(lines).toEqual([
      'C — taken out by B (turn 6)',
      'B — taken out by A (turn 11)',
    ]);
  });

  it('shows the lobby scoreboard and the round', () => {
    const renderer = mount('b');
    expect(rendered(renderer)).toContain('A: 2 wins');
    expect(rendered(renderer)).toContain('C: 1 win');
    expect(rendered(renderer)).toContain('B (you): 0 wins');
    expect(rendered(renderer)).toContain('ROUND ');
  });

  describe('when a challenge ended the game', () => {
    /** B called A's Duke, was wrong, and went out on it: nobody saw the result on the table. */
    const byChallenge = (): Game => ({
      ...finished(),
      revealSeq: 3,
      reveal: {
        id: 3,
        challenger: 'b',
        claimant: 'a',
        card: 'Duke',
        truthful: true,
        block: false,
      },
    });

    /** The lines under "How it went", top to bottom. */
    const story = (renderer: ReactTestRenderer) =>
      texts(renderer).filter(
        (text): text is string =>
          typeof text === 'string' &&
          (text.includes('taken out') ||
            text.includes('had the') ||
            text.includes('bluffing')),
      );

    it('tells how the last challenge went, first', () => {
      expect(story(mount('c', { game: byChallenge() }))).toEqual([
        'A had the Duke',
        'C — taken out by B (turn 6)',
        'B — taken out by A (turn 11)',
      ]);
    });

    it('says a bluff was a bluff', () => {
      const game = byChallenge();
      const bluff: Game = {
        ...game,
        reveal: { ...game.reveal!, truthful: false },
      };
      expect(story(mount('c', { game: bluff }))[0]).toBe(
        'A was bluffing — no Duke',
      );
    });

    it('shows it even when nobody was taken out', () => {
      const game: Game = { ...byChallenge(), eliminations: [] };
      const renderer = mount('c', { game });
      expect(story(renderer)).toEqual(['A had the Duke']);
      expect(texts(renderer)).not.toContain('Nobody was taken out.');
    });

    it('still makes sense when the claimant has gone home', () => {
      const game = byChallenge();
      const left = removePlayer(
        {
          ...game,
          reveal: { ...game.reveal!, claimant: 'b', challenger: 'a' },
        },
        'b',
      );
      expect(left.players.b).toBeUndefined();
      const renderer = mount('c', { game: left });
      expect(story(renderer)[0]).toBe('? had the Duke');
      expect(rendered(renderer)).not.toContain('undefined');
    });

    it('adds no line when there was no challenge', () => {
      expect(story(mount('c'))).toHaveLength(2);
    });
  });

  it('says so when nobody was taken out', () => {
    const game = { ...finished(), eliminations: [] };
    expect(texts(mount('a', { game }))).toContain('Nobody was taken out.');
  });

  it('shows no bluff statistics and no hidden card', () => {
    ['a', 'b', 'c'].forEach(viewer => {
      const text = rendered(mount(viewer));
      expect(text.toLowerCase()).not.toContain('bluff');
      expect(text).not.toContain('SecretOne');
    });
  });
});

describe('GameOverScreen buttons', () => {
  it('lets the host play again', () => {
    const renderer = mount('a');
    press(renderer, 'play-again');
    expect(mockRematch).toHaveBeenCalledTimes(1);
    expect(rendered(renderer)).not.toContain('Waiting for the host');
  });

  it('tells everyone else to wait for the host', () => {
    const renderer = mount('b');
    expect(findButton(renderer, 'play-again')).toBeUndefined();
    expect(texts(renderer)).toContain(
      'Waiting for the host to start the next round…',
    );
  });

  it('does not let the host play again while offline or busy', () => {
    expect(isEnabled(mount('a', { connected: false }), 'play-again')).toBe(
      false,
    );
    expect(isEnabled(mount('a', { busy: true }), 'play-again')).toBe(false);
  });

  it('takes anyone back to Home', () => {
    ['a', 'b'].forEach(viewer => press(mount(viewer), 'back-home'));
    expect(mockLeave).toHaveBeenCalledTimes(2);
    expect(mockRematch).not.toHaveBeenCalled();
  });

  it('shows why playing again failed', () => {
    expect(texts(mount('a', { error: 'No response' }))).toContain(
      'No response',
    );
  });
});

describe('GameOverScreen stats', () => {
  it('records the result once per game and round', () => {
    mount('a');
    expect(mockRecordResult).toHaveBeenCalledTimes(1);
    expect(mockRecordResult).toHaveBeenCalledWith('game-1:2', true);
  });

  it('records a loss for a player who did not win', () => {
    mount('b');
    expect(mockRecordResult).toHaveBeenCalledWith('game-1:2', false);
  });

  it('keeps the one record when the player then leaves and their seat is freed', () => {
    const renderer = mount('b');
    expect(mockRecordResult).toHaveBeenCalledTimes(1);
    expect(mockRecordResult).toHaveBeenCalledWith('game-1:2', false);

    // "Back to Home": the server drops B a moment before this screen closes.
    const after = removePlayer(finished(), 'b');
    expect(after.players.b).toBeUndefined();
    show('b', { game: after });
    act(() => {
      renderer.update(<GameOverScreen />);
    });
    expect(mockRecordResult).toHaveBeenCalledTimes(1);
    expect(rendered(renderer)).not.toContain('undefined');
  });

  it('records nothing for someone who was not playing', () => {
    mount('stranger');
    expect(mockRecordResult).not.toHaveBeenCalled();
  });

  it('renders nothing without a game', () => {
    expect(mount('a', { game: null }).toJSON()).toBeNull();
  });
});

describe('GameOverScreen sounds', () => {
  const played = () => (playSound as jest.Mock).mock.calls.map(call => call[0]);

  /** The same game one snapshot earlier: B still held a card and nobody had won. */
  function stillPlaying(): Game {
    const game = finished();
    game.players.b.influence[0].revealed = false;
    game.players.b.influence[1].revealed = false;
    return {
      ...game,
      status: 'playing',
      winner: null,
      state: { ...game.state, phase: 'action' },
    };
  }

  /** Stands in for the game screen, which was showing the game until it ended. */
  function Playing({ as }: { as: string }) {
    useGameSounds(stillPlaying(), as);
    return null;
  }

  /** The router's swap when the game ends: the game screen closes and this one opens, in one update. */
  function finishFor(as: string) {
    show(as);
    const renderer = render(<Playing as={as} />);
    // Whatever opening the game screen played (A's own turn, say) is not what is being tested.
    (playSound as jest.Mock).mockClear();
    act(() => {
      renderer.update(<GameOverScreen />);
    });
    return renderer;
  }

  it('is silent when a finished game is opened', () => {
    mount('a');
    mount('b');
    expect(played()).toEqual([]);
  });

  it('plays the win sound for the winner when the game ends', () => {
    finishFor('a');
    expect(played()).toEqual(['card', 'win']);
  });

  it('plays the lose sound for everyone else who played', () => {
    finishFor('b');
    expect(played()).toEqual(['card', 'lose']);
  });

  it('plays nothing with sound switched off', () => {
    mockSound = false;
    finishFor('a');
    expect(played()).toEqual([]);
  });

  it('plays nothing for someone who was not playing', () => {
    finishFor('stranger');
    expect(played()).toEqual([]);
  });
});
