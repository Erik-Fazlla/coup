import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { makeGame } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { GameProvider, useGame } from '../GameContext';

const mockGames = {
  createGame: jest.fn(),
  joinGame: jest.fn(),
  startGame: jest.fn(),
  rematch: jest.fn(),
  kickPlayer: jest.fn(),
  dispatch: jest.fn(),
  leaveLobby: jest.fn(),
  cancelLobby: jest.fn(),
  subscribe: jest.fn(),
  subscribeConnection: jest.fn(),
  trackPresence: jest.fn(),
  subscribePresence: jest.fn(),
};
const mockProfiles = {
  getActiveGameId: jest.fn(),
  setActiveGameId: jest.fn(),
};

jest.mock('../../firebase', () => ({
  getServices: () => ({ games: mockGames, profiles: mockProfiles }),
}));
jest.mock('../ProfileContext', () => ({
  useProfile: () => ({
    playerId: 'me',
    profile: { name: 'Me', gamesPlayed: 0, wins: 0, createdAt: 0 },
  }),
}));

type GameValue = ReturnType<typeof useGame>;

interface Subscription {
  onGame: (game: Game | null) => void;
  onError: (error: Error) => void;
  unsubscribe: jest.Mock;
}

let value: GameValue;
let renderer: ReactTestRenderer;
let subscriptions: Record<string, Subscription>;
let setConnected: (connected: boolean) => void;
let connectionUnsubscribe: jest.Mock;
let watchers: Record<
  string,
  {
    onChange: (online: Record<string, true>) => void;
    onUnavailable?: () => void;
    unsubscribe: jest.Mock;
  }
>;
let trackers: Record<string, jest.Mock>;

function Probe() {
  value = useGame();
  return null;
}

/** A promise the test settles by hand, to hold an operation "in flight". */
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function mount(storedGameId: string | null = null) {
  mockProfiles.getActiveGameId.mockResolvedValue(storedGameId);
  await act(async () => {
    renderer = create(
      <GameProvider>
        <Probe />
      </GameProvider>,
    );
  });
}

/** Mounts with a game already open and delivered, online by default. */
async function mountInGame(game: Game, connected = true) {
  await mount('g1');
  await act(async () => {
    setConnected(connected);
    subscriptions.g1.onGame(game);
  });
}

function lobby(host: string): Game {
  const game = makeGame({ me: [], other: [] });
  return { ...game, host, status: 'waiting' };
}

function playing(): Game {
  return makeGame({ me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] });
}

beforeEach(() => {
  jest.clearAllMocks();
  subscriptions = {};
  watchers = {};
  trackers = {};
  connectionUnsubscribe = jest.fn();
  mockGames.subscribe.mockImplementation((gameId, onGame, onError) => {
    const unsubscribe = jest.fn();
    subscriptions[gameId] = { onGame, onError, unsubscribe };
    return unsubscribe;
  });
  mockGames.subscribeConnection.mockImplementation(onChange => {
    setConnected = onChange;
    return connectionUnsubscribe;
  });
  mockGames.trackPresence.mockImplementation((gameId: string) => {
    const stop = jest.fn();
    trackers[gameId] = stop;
    return stop;
  });
  mockGames.subscribePresence.mockImplementation(
    (gameId: string, onChange: any, onUnavailable?: () => void) => {
      const unsubscribe = jest.fn();
      watchers[gameId] = { onChange, onUnavailable, unsubscribe };
      return unsubscribe;
    },
  );
  mockProfiles.setActiveGameId.mockResolvedValue(undefined);
  mockGames.leaveLobby.mockResolvedValue(undefined);
  mockGames.cancelLobby.mockResolvedValue(undefined);
  mockGames.dispatch.mockResolvedValue(undefined);
  mockGames.startGame.mockResolvedValue(undefined);
  mockGames.rematch.mockResolvedValue(undefined);
  mockGames.kickPlayer.mockResolvedValue(undefined);
});

afterEach(async () => {
  jest.useRealTimers();
  await act(async () => {
    renderer?.unmount();
  });
});

describe('startup', () => {
  it('is not ready until the stored game id has been read', async () => {
    const stored = deferred<string | null>();
    mockProfiles.getActiveGameId.mockReturnValue(stored.promise);
    await act(async () => {
      renderer = create(
        <GameProvider>
          <Probe />
        </GameProvider>,
      );
    });
    expect(value.ready).toBe(false);

    await act(async () => stored.resolve(null));
    expect(value.ready).toBe(true);
    expect(value.gameId).toBeNull();
  });

  it('reopens the stored game and subscribes to it', async () => {
    await mount('g1');
    expect(value.ready).toBe(true);
    expect(value.gameId).toBe('g1');
    expect(value.loaded).toBe(false);
    expect(mockGames.subscribe).toHaveBeenCalledWith(
      'g1',
      expect.any(Function),
      expect.any(Function),
    );

    const game = playing();
    await act(async () => subscriptions.g1.onGame(game));
    expect(value.loaded).toBe(true);
    expect(value.game).toBe(game);
  });

  it('still becomes ready when reading the stored id fails', async () => {
    mockProfiles.getActiveGameId.mockRejectedValue(new Error('storage broken'));
    await act(async () => {
      renderer = create(
        <GameProvider>
          <Probe />
        </GameProvider>,
      );
    });
    expect(value.ready).toBe(true);
    expect(value.gameId).toBeNull();
  });

  it('reports a deleted game as loaded with no game', async () => {
    await mount('g1');
    await act(async () => subscriptions.g1.onGame(null));
    expect(value.loaded).toBe(true);
    expect(value.game).toBeNull();
  });

  it('tracks the connection state', async () => {
    await mount();
    expect(value.connected).toBe(false);
    await act(async () => setConnected(true));
    expect(value.connected).toBe(true);
  });

  it('shows a subscription error', async () => {
    await mount('g1');
    await act(async () =>
      subscriptions.g1.onError(new Error('permission_denied')),
    );
    expect(value.error).toBe('permission_denied');
  });

  it('unsubscribes from the game and the connection on unmount', async () => {
    await mount('g1');
    await act(async () => renderer.unmount());
    expect(subscriptions.g1.unsubscribe).toHaveBeenCalledTimes(1);
    expect(connectionUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('presence', () => {
  it('starts tracking this player and watching the game once a game is open', async () => {
    await mount('g1');
    expect(mockGames.trackPresence).toHaveBeenCalledTimes(1);
    expect(mockGames.trackPresence).toHaveBeenCalledWith('g1', 'me');
    expect(mockGames.subscribePresence).toHaveBeenCalledTimes(1);
    expect(mockGames.subscribePresence).toHaveBeenCalledWith(
      'g1',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('does nothing while no game is open', async () => {
    await mount();
    expect(mockGames.trackPresence).not.toHaveBeenCalled();
    expect(mockGames.subscribePresence).not.toHaveBeenCalled();
    expect(value.online).toEqual({});
  });

  it('exposes who is online and follows changes', async () => {
    await mountInGame(playing());
    expect(value.online).toEqual({});
    await act(async () => watchers.g1.onChange({ me: true }));
    expect(value.online).toEqual({ me: true });
    await act(async () => watchers.g1.onChange({ me: true, other: true }));
    expect(value.online).toEqual({ me: true, other: true });
    await act(async () => watchers.g1.onChange({ other: true }));
    expect(value.online).toEqual({ other: true });
  });

  it('exposes null once presence turns out to be unavailable', async () => {
    await mountInGame(playing());
    await act(async () => watchers.g1.onChange({ me: true }));
    await act(async () => watchers.g1.onUnavailable?.());
    expect(value.online).toBeNull();
    // Presence is display-only: the game itself carries on and shows no error.
    expect(value.error).toBeNull();
    expect(value.game).not.toBeNull();
  });

  it('keeps tracking across game updates instead of restarting', async () => {
    const game = playing();
    await mountInGame(game);
    await act(async () =>
      subscriptions.g1.onGame({ ...game, log: ['something'] }),
    );
    await act(async () =>
      subscriptions.g1.onGame({
        ...game,
        state: { ...game.state, turnNumber: 2 },
      }),
    );
    expect(mockGames.trackPresence).toHaveBeenCalledTimes(1);
    expect(mockGames.subscribePresence).toHaveBeenCalledTimes(1);
    expect(trackers.g1).not.toHaveBeenCalled();
    expect(watchers.g1.unsubscribe).not.toHaveBeenCalled();
  });

  it('stops both and starts again for another game when the game id changes', async () => {
    mockGames.joinGame.mockResolvedValue('g2');
    await mountInGame(playing());
    await act(async () => watchers.g1.onChange({ me: true, other: true }));
    await act(async () => value.joinGame('ABCDE'));

    expect(trackers.g1).toHaveBeenCalledTimes(1);
    expect(watchers.g1.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockGames.trackPresence).toHaveBeenLastCalledWith('g2', 'me');
    expect(mockGames.subscribePresence).toHaveBeenLastCalledWith(
      'g2',
      expect.any(Function),
      expect.any(Function),
    );
    // The old game's players are not shown for the new one.
    expect(value.online).toEqual({});
  });

  it('shows presence again for the next game after it was unavailable', async () => {
    mockGames.joinGame.mockResolvedValue('g2');
    await mountInGame(playing());
    await act(async () => watchers.g1.onUnavailable?.());
    expect(value.online).toBeNull();
    await act(async () => value.joinGame('ABCDE'));
    expect(value.online).toEqual({});
    await act(async () => watchers.g2.onChange({ me: true }));
    expect(value.online).toEqual({ me: true });
  });

  it('stops both when the player leaves the game', async () => {
    await mountInGame({ ...playing(), status: 'finished' });
    await act(async () => value.leave());
    expect(value.gameId).toBeNull();
    expect(trackers.g1).toHaveBeenCalledTimes(1);
    expect(watchers.g1.unsubscribe).toHaveBeenCalledTimes(1);
    expect(value.online).toEqual({});
  });

  it('stops both on unmount', async () => {
    await mountInGame(playing());
    await act(async () => renderer.unmount());
    expect(trackers.g1).toHaveBeenCalledTimes(1);
    expect(watchers.g1.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignores a presence update that arrives for a game that is no longer open', async () => {
    mockGames.joinGame.mockResolvedValue('g2');
    await mountInGame(playing());
    const oldWatcher = watchers.g1;
    await act(async () => value.joinGame('ABCDE'));
    await act(async () => oldWatcher.onChange({ stale: true }));
    expect(value.online).toEqual({});
  });
});

describe('creating and joining', () => {
  it('creates a game, remembers it and opens it', async () => {
    mockGames.createGame.mockResolvedValue('g9');
    await mount();
    await act(async () => value.createGame());

    expect(mockGames.createGame).toHaveBeenCalledWith('me', 'Me');
    expect(mockProfiles.setActiveGameId).toHaveBeenCalledWith('g9');
    expect(value.gameId).toBe('g9');
    expect(value.busy).toBe(false);
    expect(value.error).toBeNull();
    expect(subscriptions.g9).toBeDefined();
  });

  it('joins by code', async () => {
    mockGames.joinGame.mockResolvedValue('g2');
    await mount();
    await act(async () => value.joinGame('ABCDE'));
    expect(mockGames.joinGame).toHaveBeenCalledWith('ABCDE', 'me', 'Me');
    expect(value.gameId).toBe('g2');
  });

  it('shows the join error and stays on Home', async () => {
    mockGames.joinGame.mockRejectedValue(
      new Error('No game found with that code'),
    );
    await mount();
    await act(async () => value.joinGame('ZZZZZ'));
    expect(value.error).toBe('No game found with that code');
    expect(value.gameId).toBeNull();
    expect(value.busy).toBe(false);
    expect(mockProfiles.setActiveGameId).not.toHaveBeenCalled();
  });

  it('still opens the game when remembering it fails', async () => {
    mockGames.createGame.mockResolvedValue('g9');
    mockProfiles.setActiveGameId.mockRejectedValue(new Error('storage broken'));
    await mount();
    await act(async () => value.createGame());
    expect(value.gameId).toBe('g9');
    expect(value.error).toBeNull();
  });

  it('does not reset an open game when the same join completes twice', async () => {
    mockGames.joinGame.mockResolvedValue('g1');
    const game = playing();
    await mountInGame(game);
    await act(async () => value.joinGame('ABCDE'));
    expect(value.game).toBe(game);
    expect(value.loaded).toBe(true);
    expect(mockGames.subscribe).toHaveBeenCalledTimes(1);
  });

  it('switches subscription when a different game is opened', async () => {
    mockGames.joinGame.mockResolvedValue('g2');
    await mountInGame(playing());
    await act(async () => value.joinGame('ABCDE'));
    expect(subscriptions.g1.unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscriptions.g2).toBeDefined();
    expect(value.game).toBeNull();
    expect(value.loaded).toBe(false);
  });
});

describe('acting', () => {
  it('dispatches actions and start to the open game', async () => {
    await mountInGame(playing());
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    expect(mockGames.dispatch).toHaveBeenCalledWith('g1', {
      type: 'income',
      playerId: 'me',
    });
    await act(async () => value.startGame());
    expect(mockGames.startGame).toHaveBeenCalledWith('g1', 'me');
  });

  it('does nothing when no game is open', async () => {
    await mount();
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    await act(async () => value.startGame());
    expect(mockGames.dispatch).not.toHaveBeenCalled();
    expect(mockGames.startGame).not.toHaveBeenCalled();
    expect(value.error).toBeNull();
  });

  it('asks for a rematch of the open game as this player', async () => {
    await mountInGame({ ...playing(), status: 'finished' });
    await act(async () => value.rematch());
    expect(mockGames.rematch).toHaveBeenCalledWith('g1', 'me');
    expect(value.error).toBeNull();
    expect(value.busy).toBe(false);
  });

  it('kicks the chosen player from the open game as this player', async () => {
    await mountInGame(lobby('me'));
    await act(async () => value.kick('other'));
    expect(mockGames.kickPlayer).toHaveBeenCalledWith('g1', 'me', 'other');
    expect(value.error).toBeNull();
  });

  it('sends a skip for the open game as this player, stamped with what the game shows', async () => {
    const game = playing();
    await mountInGame({
      ...game,
      state: {
        ...game.state,
        turnNumber: 4,
        claimSeq: 3,
        phase: 'awaitingResponses',
      },
    });
    await act(async () => value.skip());
    expect(mockGames.dispatch).toHaveBeenCalledWith('g1', {
      type: 'skip',
      playerId: 'me',
      turn: 4,
      seq: 3,
      phase: 'awaitingResponses',
    });
    expect(value.error).toBeNull();
  });

  it('stamps a skip with the latest game it has been given', async () => {
    const game = playing();
    await mountInGame(game);
    await act(async () =>
      subscriptions.g1.onGame({
        ...game,
        state: { ...game.state, turnNumber: 2, phase: 'exchange' },
      }),
    );
    await act(async () => value.skip());
    expect(mockGames.dispatch).toHaveBeenCalledWith('g1', {
      type: 'skip',
      playerId: 'me',
      turn: 2,
      seq: game.state.claimSeq,
      phase: 'exchange',
    });
  });

  it('does not skip before the game has loaded', async () => {
    await mount('g1');
    await act(async () => value.skip());
    expect(mockGames.dispatch).not.toHaveBeenCalled();
  });

  it('does not rematch, kick or skip when no game is open', async () => {
    await mount();
    await act(async () => value.rematch());
    await act(async () => value.kick('other'));
    await act(async () => value.skip());
    expect(mockGames.rematch).not.toHaveBeenCalled();
    expect(mockGames.kickPlayer).not.toHaveBeenCalled();
    expect(mockGames.dispatch).not.toHaveBeenCalled();
    expect(value.error).toBeNull();
  });

  it.each([
    [
      'rematch',
      'Only the host can start a new round',
      () => value.rematch(),
      () => mockGames.rematch,
    ],
    [
      'kick',
      'Only the host can remove players',
      () => value.kick('other'),
      () => mockGames.kickPlayer,
    ],
    [
      'skip',
      'Only the host can skip',
      () => value.skip(),
      () => mockGames.dispatch,
    ],
  ])(
    'shows the error when a %s is rejected',
    async (_label, message, call, mock) => {
      mock().mockRejectedValueOnce(new Error(message));
      await mountInGame(playing());
      await act(async () => call());
      expect(value.error).toBe(message);
      expect(value.busy).toBe(false);
    },
  );

  it('shows a rejected action and clears it on the next attempt', async () => {
    mockGames.dispatch.mockRejectedValueOnce(new Error('It is not your turn'));
    await mountInGame(playing());
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    expect(value.error).toBe('It is not your turn');
    expect(value.busy).toBe(false);

    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    expect(value.error).toBeNull();
  });

  it('uses a generic message when something that is not an Error is thrown', async () => {
    mockGames.dispatch.mockRejectedValueOnce('boom');
    await mountInGame(playing());
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    expect(value.error).toBe('Something went wrong');
  });

  it('keeps an error while the game stands still and drops it once the game moves on', async () => {
    mockGames.dispatch.mockRejectedValueOnce(
      new Error('Too late: the game has moved on'),
    );
    const game = playing();
    await mountInGame(game);
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    expect(value.error).toBe('Too late: the game has moved on');

    // Same turn, same prompt, same phase: only the log changed.
    await act(async () =>
      subscriptions.g1.onGame({ ...game, log: ['something'] }),
    );
    expect(value.error).toBe('Too late: the game has moved on');

    await act(async () =>
      subscriptions.g1.onGame({
        ...game,
        state: { ...game.state, turnNumber: game.state.turnNumber + 1 },
      }),
    );
    expect(value.error).toBeNull();
  });

  it.each([
    ['claimSeq', { claimSeq: 5 }],
    ['phase', { phase: 'awaitingResponses' as const }],
  ])('drops an error when %s changes', async (_label, change) => {
    mockGames.dispatch.mockRejectedValueOnce(new Error('nope'));
    const game = playing();
    await mountInGame(game);
    await act(async () => value.act({ type: 'income', playerId: 'me' }));
    await act(async () =>
      subscriptions.g1.onGame({
        ...game,
        state: { ...game.state, ...change },
      }),
    );
    expect(value.error).toBeNull();
  });
});

describe('busy and timeouts', () => {
  it('is busy while an operation is pending', async () => {
    const pending = deferred<void>();
    mockGames.dispatch.mockReturnValue(pending.promise);
    await mountInGame(playing());

    let finished!: Promise<void>;
    await act(async () => {
      finished = value.act({ type: 'income', playerId: 'me' });
    });
    expect(value.busy).toBe(true);

    await act(async () => {
      pending.resolve();
      await finished;
    });
    expect(value.busy).toBe(false);
  });

  it('stays busy until every overlapping operation has finished', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    mockGames.dispatch
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    await mountInGame(playing());

    let a!: Promise<void>;
    let b!: Promise<void>;
    await act(async () => {
      a = value.act({ type: 'income', playerId: 'me' });
      b = value.act({ type: 'income', playerId: 'me' });
    });
    expect(value.busy).toBe(true);

    await act(async () => {
      first.resolve();
      await a;
    });
    expect(value.busy).toBe(true);

    await act(async () => {
      second.resolve();
      await b;
    });
    expect(value.busy).toBe(false);
  });

  it('gives up waiting after 15 seconds and says so', async () => {
    await mountInGame(playing());
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'],
    });
    const never = deferred<void>();
    mockGames.dispatch.mockReturnValue(never.promise);

    let finished!: Promise<void>;
    await act(async () => {
      finished = value.act({ type: 'income', playerId: 'me' });
    });
    expect(value.busy).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(14999);
    });
    expect(value.busy).toBe(true);
    expect(value.error).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await finished;
    });
    expect(value.busy).toBe(false);
    expect(value.error).toBe(
      'No response from the server. Check your connection.',
    );

    // The abandoned call failing later must not disturb anything.
    await act(async () => never.reject(new Error('late failure')));
    expect(value.error).toBe(
      'No response from the server. Check your connection.',
    );
    expect(value.busy).toBe(false);
  });
});

describe('leaving', () => {
  it('removes a guest from a waiting lobby on the server before leaving locally', async () => {
    const order: string[] = [];
    mockGames.leaveLobby.mockImplementation(async () => {
      order.push('server');
    });
    mockProfiles.setActiveGameId.mockImplementation(async () => {
      order.push('local');
    });
    await mountInGame(lobby('other'));
    await act(async () => value.leave());

    expect(mockGames.leaveLobby).toHaveBeenCalledWith('g1', 'me');
    expect(mockGames.cancelLobby).not.toHaveBeenCalled();
    expect(order).toEqual(['server', 'local']);
    expect(mockProfiles.setActiveGameId).toHaveBeenLastCalledWith(null);
    expect(value.gameId).toBeNull();
    expect(value.game).toBeNull();
  });

  it('cancels the lobby when the host leaves', async () => {
    await mountInGame(lobby('me'));
    await act(async () => value.leave());
    expect(mockGames.cancelLobby).toHaveBeenCalledWith('g1', 'me');
    expect(mockGames.leaveLobby).not.toHaveBeenCalled();
    expect(value.gameId).toBeNull();
  });

  it('keeps the player in the lobby with the error when the server call fails', async () => {
    mockGames.leaveLobby.mockRejectedValue(new Error('network down'));
    await mountInGame(lobby('other'));
    await act(async () => value.leave());
    expect(value.gameId).toBe('g1');
    expect(value.error).toBe('network down');
    expect(mockProfiles.setActiveGameId).not.toHaveBeenCalled();
  });

  it('leaves locally only when offline', async () => {
    await mountInGame(lobby('other'), false);
    await act(async () => value.leave());
    expect(mockGames.leaveLobby).not.toHaveBeenCalled();
    expect(mockGames.cancelLobby).not.toHaveBeenCalled();
    expect(value.gameId).toBeNull();
  });

  it.each([
    ['being played, as the host', playing()],
    ['being played, as a guest', { ...playing(), host: 'other' }],
    // The others can still read the result; nobody is left to start another round.
    ['finished, as the host', { ...playing(), status: 'finished' as const }],
  ])('leaves locally only when the game is %s', async (_label, game) => {
    await mountInGame(game);
    await act(async () => value.leave());
    expect(mockGames.leaveLobby).not.toHaveBeenCalled();
    expect(mockGames.cancelLobby).not.toHaveBeenCalled();
    expect(mockProfiles.setActiveGameId).toHaveBeenCalledWith(null);
    expect(value.gameId).toBeNull();
  });

  describe('a guest on a finished game', () => {
    const over = (): Game => ({
      ...playing(),
      host: 'other',
      status: 'finished',
    });

    it('frees their seat on the server before leaving locally', async () => {
      const order: string[] = [];
      mockGames.leaveLobby.mockImplementation(async () => {
        order.push('server');
      });
      mockProfiles.setActiveGameId.mockImplementation(async () => {
        order.push('local');
      });
      await mountInGame(over());
      await act(async () => value.leave());

      expect(mockGames.leaveLobby).toHaveBeenCalledTimes(1);
      expect(mockGames.leaveLobby).toHaveBeenCalledWith('g1', 'me');
      expect(mockGames.cancelLobby).not.toHaveBeenCalled();
      expect(order).toEqual(['server', 'local']);
      expect(value.gameId).toBeNull();
    });

    it('stays on the result with the error when the server call fails', async () => {
      mockGames.leaveLobby.mockRejectedValue(new Error('network down'));
      await mountInGame(over());
      await act(async () => value.leave());
      expect(value.gameId).toBe('g1');
      expect(value.error).toBe('network down');
      expect(mockProfiles.setActiveGameId).not.toHaveBeenCalled();
    });

    it('leaves locally only when offline', async () => {
      await mountInGame(over(), false);
      await act(async () => value.leave());
      expect(mockGames.leaveLobby).not.toHaveBeenCalled();
      expect(value.gameId).toBeNull();
    });
  });

  it('leaves locally when the game never loaded', async () => {
    await mount('g1');
    await act(async () => setConnected(true));
    await act(async () => value.leave());
    expect(mockGames.leaveLobby).not.toHaveBeenCalled();
    expect(value.gameId).toBeNull();
    expect(subscriptions.g1.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useGame', () => {
  it('throws outside a GameProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      act(() => {
        create(<Probe />);
      });
    }).toThrow('useGame must be used inside GameProvider');
    spy.mockRestore();
  });
});
