import React from 'react';
import { ReactTestRenderer } from 'react-test-renderer';
import {
  findButton,
  isEnabled,
  press,
  render,
  rendered,
  texts,
} from '../../components/testUtils';
import { makeGame } from '../../engine/testHelpers';
import { Card, Game } from '../../engine/types';
import { GameOverScreen } from '../GameOverScreen';

const mockLeave = jest.fn();
const mockRematch = jest.fn();
const mockRecordResult = jest.fn();
let mockPlayerId = 'a';
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

function mount(
  as: string,
  overrides: Partial<typeof mockGameValue> = {},
): ReactTestRenderer {
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
  return render(<GameOverScreen />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRecordResult.mockResolvedValue(undefined);
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

  it('records nothing for someone who was not playing', () => {
    mount('stranger');
    expect(mockRecordResult).not.toHaveBeenCalled();
  });

  it('renders nothing without a game', () => {
    expect(mount('a', { game: null }).toJSON()).toBeNull();
  });
});
