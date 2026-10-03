import React from 'react';
import { press, render, texts } from '../../components/testUtils';
import { kickPlayer, removePlayer } from '../../engine/lobby';
import { makeGame } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { RemovedScreen } from '../RemovedScreen';
import { routeFor } from '../route';

const mockLeave = jest.fn();
let mockError: string | null = null;

jest.mock('../../context/GameContext', () => ({
  useGame: () => ({ error: mockError, leave: mockLeave }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const lobby = (): Game => ({
  ...makeGame({ host: [], maria: [], nikos: [] }),
  status: 'waiting',
});

const open = (game: Game | null, busy = false) => ({
  ready: true,
  gameId: 'game-1',
  game,
  loaded: true,
  busy,
});

describe('routeFor', () => {
  it('shows nothing until the stored game id has been read', () => {
    expect(
      routeFor(
        { ready: false, gameId: null, game: null, loaded: false, busy: false },
        'maria',
      ),
    ).toBe('blank');
  });

  it('shows Home without a game', () => {
    expect(
      routeFor(
        { ready: true, gameId: null, game: null, loaded: false, busy: false },
        'maria',
      ),
    ).toBe('home');
  });

  it('shows loading until the first snapshot, then says a missing game is gone', () => {
    expect(routeFor({ ...open(null), loaded: false }, 'maria')).toBe('loading');
    expect(routeFor(open(null), 'maria')).toBe('missing');
  });

  it('follows the game status for a player who is in it', () => {
    expect(routeFor(open(lobby()), 'maria')).toBe('lobby');
    expect(routeFor(open({ ...lobby(), status: 'playing' }), 'maria')).toBe(
      'game',
    );
    expect(routeFor(open({ ...lobby(), status: 'finished' }), 'maria')).toBe(
      'over',
    );
  });

  it('shows the lobby to everyone after a rematch', () => {
    const rematched = { ...lobby(), round: 2 };
    ['host', 'maria', 'nikos'].forEach(id =>
      expect(routeFor(open(rematched), id)).toBe('lobby'),
    );
  });

  it('tells a kicked player the host removed them', () => {
    const after = kickPlayer(lobby(), 'host', 'maria');
    expect(routeFor(open(after), 'maria')).toBe('removed');
    // Whatever else is going on: they must be able to read it and leave.
    expect(routeFor(open(after, true), 'maria')).toBe('removed');
    expect(routeFor(open(after), 'nikos')).toBe('lobby');
    expect(routeFor(open(after), 'host')).toBe('lobby');
  });

  it('keeps telling a kicked player so after the host starts, and after the round ends', () => {
    const after = kickPlayer(lobby(), 'host', 'maria');
    (['playing', 'finished'] as const).forEach(status => {
      const game: Game = { ...after, status };
      expect(routeFor(open(game), 'maria')).toBe('removed');
      expect(routeFor(open(game, true), 'maria')).toBe('removed');
      // Everyone who is still in it sees the game as before.
      expect(routeFor(open(game), 'nikos')).toBe(
        status === 'playing' ? 'game' : 'over',
      );
    });
  });

  it('shows nothing, not "no longer exists", while the host is cancelling the lobby', () => {
    // The lobby is deleted a moment before the host's phone forgets it.
    expect(routeFor(open(null, true), 'host')).toBe('blank');
    // Once nothing is in flight a game that is gone is reported as gone.
    expect(routeFor(open(null), 'host')).toBe('missing');
    // Still loading is still loading, busy or not.
    expect(routeFor({ ...open(null, true), loaded: false }, 'host')).toBe(
      'loading',
    );
  });

  it('never tells a player who is joining that they were removed', () => {
    // The game is opened only after the join was written, so the first snapshot already has them.
    expect(routeFor({ ...open(null), loaded: false }, 'maria')).toBe('loading');
    expect(routeFor(open(lobby()), 'maria')).toBe('lobby');
  });

  it('never tells a player who is leaving that they were removed', () => {
    // The server drops them from the lobby a moment before this phone forgets the game.
    const after = removePlayer(lobby(), 'maria');
    expect(after.players.maria).toBeUndefined();
    expect(routeFor(open(after, true), 'maria')).toBe('blank');
  });

  it('shows nothing while a guest is leaving a finished game', () => {
    // Their seat is freed a moment before this phone forgets the game.
    const over: Game = { ...lobby(), status: 'finished' };
    const after = removePlayer(over, 'maria');
    expect(after.players.maria).toBeUndefined();
    expect(routeFor(open(after, true), 'maria')).toBe('blank');
    // Anyone else who is merely busy keeps the result on screen.
    expect(routeFor(open(after, true), 'nikos')).toBe('over');
    expect(routeFor(open(after), 'maria')).toBe('over');
  });

  it('gives a player who is simply not in the lobby a way out', () => {
    expect(routeFor(open(removePlayer(lobby(), 'maria')), 'maria')).toBe(
      'left',
    );
    expect(routeFor(open(lobby()), 'stranger')).toBe('left');
  });
});

describe('RemovedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockError = null;
  });

  it('says the host removed the player and takes them Home', () => {
    const renderer = render(<RemovedScreen />);
    expect(texts(renderer)).toContain('The host removed you from this game');
    expect(mockLeave).not.toHaveBeenCalled();
    press(renderer, 'back-home');
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('shows why going Home failed', () => {
    mockError = 'No response from the server.';
    expect(texts(render(<RemovedScreen />))).toContain(
      'No response from the server.',
    );
  });
});
