import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { Game, GameAction } from '../engine/types';
import { getServices } from '../firebase';
import { withTimeout } from '../util/withTimeout';
import { useProfile } from './ProfileContext';

const OPERATION_TIMEOUT_MS = 15000;
const TIMEOUT_MESSAGE = 'No response from the server. Check your connection.';

interface State {
  /** False until the stored active game id has been read. */
  ready: boolean;
  gameId: string | null;
  game: Game | null;
  /** True once the first snapshot for `gameId` has arrived. */
  loaded: boolean;
  connected: boolean;
  /** Players currently connected to this game; null when presence cannot be read, so hide indicators. */
  online: Record<string, true> | null;
  /** Number of remote operations still waiting for the server. */
  inFlight: number;
  error: string | null;
}

type Event =
  | { type: 'entered'; gameId: string | null }
  | { type: 'game'; game: Game | null }
  | { type: 'connected'; connected: boolean }
  | { type: 'presence'; online: Record<string, true> | null }
  | { type: 'operationStarted' }
  | { type: 'operationEnded' }
  | { type: 'error'; error: string | null };

const initialState: State = {
  ready: false,
  gameId: null,
  game: null,
  loaded: false,
  connected: false,
  online: {},
  inFlight: 0,
  error: null,
};

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'entered':
      // A slow join that completes twice must not reset a game that is already open:
      // the subscription effect would not re-run for the same id.
      if (
        state.ready &&
        event.gameId !== null &&
        event.gameId === state.gameId
      ) {
        return state;
      }
      return {
        ...state,
        ready: true,
        gameId: event.gameId,
        game: null,
        loaded: false,
        online: {},
        error: null,
      };
    case 'game': {
      const before = state.game;
      const after = event.game;
      // A message such as "Too late" belongs to the moment it was shown; drop it once the game moves on.
      const moved =
        !!before &&
        !!after &&
        (before.state.claimSeq !== after.state.claimSeq ||
          before.state.turnNumber !== after.state.turnNumber ||
          before.state.phase !== after.state.phase);
      return {
        ...state,
        game: after,
        loaded: true,
        error: moved ? null : state.error,
      };
    }
    case 'connected':
      return { ...state, connected: event.connected };
    case 'presence':
      return { ...state, online: event.online };
    case 'operationStarted':
      return { ...state, inFlight: state.inFlight + 1, error: null };
    case 'operationEnded':
      return { ...state, inFlight: Math.max(0, state.inFlight - 1) };
    case 'error':
      return { ...state, error: event.error };
  }
}

interface GameValue extends Omit<State, 'inFlight'> {
  busy: boolean;
  createGame: () => Promise<void>;
  joinGame: (code: string) => Promise<void>;
  startGame: () => Promise<void>;
  act: (action: GameAction) => Promise<void>;
  /** Host only: takes a finished game back to the lobby for another round. */
  rematch: () => Promise<void>;
  /** Host only: removes a player from the lobby. */
  kick: (targetId: string) => Promise<void>;
  /** Host only: moves the game past whoever it is waiting on. */
  skip: () => Promise<void>;
  leave: () => Promise<void>;
}

const GameContext = createContext<GameValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { games, profiles } = getServices();
  const { playerId, profile } = useProfile();
  const name = profile?.name ?? '';
  const [state, send] = useReducer(reducer, initialState);
  const { gameId, game, connected } = state;

  useEffect(() => {
    let active = true;
    profiles
      .getActiveGameId()
      .catch(() => null)
      .then(stored => {
        if (active) {
          send({ type: 'entered', gameId: stored });
        }
      });
    const unsubscribe = games.subscribeConnection(isConnected =>
      send({ type: 'connected', connected: isConnected }),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [games, profiles]);

  useEffect(() => {
    if (!gameId) {
      return;
    }
    return games.subscribe(
      gameId,
      next => send({ type: 'game', game: next }),
      error => send({ type: 'error', error: error.message }),
    );
  }, [games, gameId]);

  // Presence is display-only: a failure here never shows an error or touches the game.
  useEffect(() => {
    if (!gameId) {
      return;
    }
    let active = true;
    const stopTracking = playerId
      ? games.trackPresence(gameId, playerId)
      : () => {};
    const stopWatching = games.subscribePresence(
      gameId,
      online => active && send({ type: 'presence', online }),
      () => active && send({ type: 'presence', online: null }),
    );
    return () => {
      active = false;
      stopTracking();
      stopWatching();
    };
  }, [games, gameId, playerId]);

  /** Runs a remote operation, showing its error message instead of throwing. */
  const run = useCallback(async (operation: () => Promise<void>) => {
    send({ type: 'operationStarted' });
    try {
      // The Firebase call cannot be cancelled and may still apply later; we just stop waiting for it.
      await withTimeout(operation(), OPERATION_TIMEOUT_MS, TIMEOUT_MESSAGE);
    } catch (error) {
      send({
        type: 'error',
        error: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      send({ type: 'operationEnded' });
    }
  }, []);

  const enter = useCallback(
    async (id: string | null) => {
      try {
        await profiles.setActiveGameId(id);
      } catch {
        // Not remembering the game only costs auto-rejoin on the next launch; carry on.
      }
      send({ type: 'entered', gameId: id });
    },
    [profiles],
  );

  const createGame = useCallback(
    () => run(async () => enter(await games.createGame(playerId, name))),
    [run, enter, games, playerId, name],
  );

  const joinGame = useCallback(
    (code: string) =>
      run(async () => enter(await games.joinGame(code, playerId, name))),
    [run, enter, games, playerId, name],
  );

  const startGame = useCallback(
    () =>
      run(async () => {
        if (gameId) {
          await games.startGame(gameId, playerId);
        }
      }),
    [run, games, gameId, playerId],
  );

  const act = useCallback(
    (action: GameAction) =>
      run(async () => {
        if (gameId) {
          await games.dispatch(gameId, action);
        }
      }),
    [run, games, gameId],
  );

  const rematch = useCallback(
    () =>
      run(async () => {
        if (gameId) {
          await games.rematch(gameId, playerId);
        }
      }),
    [run, games, gameId, playerId],
  );

  const kick = useCallback(
    (targetId: string) =>
      run(async () => {
        if (gameId) {
          await games.kickPlayer(gameId, playerId, targetId);
        }
      }),
    [run, games, gameId, playerId],
  );

  const skip = useCallback(
    () =>
      run(async () => {
        // Stamped with what this screen shows, so a skip that arrives after the game moved is refused.
        if (gameId && game) {
          await games.dispatch(gameId, {
            type: 'skip',
            playerId,
            turn: game.state.turnNumber,
            seq: game.state.claimSeq,
            phase: game.state.phase,
          });
        }
      }),
    [run, games, gameId, game, playerId],
  );

  const leave = useCallback(
    () =>
      run(async () => {
        // Tell the server first so a failure keeps the player where they are with the error visible.
        if (gameId && game && connected) {
          if (game.host === playerId) {
            // The host of a finished game just goes: the others can still read the result.
            if (game.status === 'waiting') {
              await games.cancelLobby(gameId, playerId);
            }
          } else if (game.status === 'waiting' || game.status === 'finished') {
            // A guest's seat is freed, so they are not dealt into a round they will not play.
            await games.leaveLobby(gameId, playerId);
          }
        }
        await enter(null);
      }),
    [run, enter, games, gameId, game, playerId, connected],
  );

  const value = useMemo(() => {
    const { inFlight, ...rest } = state;
    return {
      ...rest,
      busy: inFlight > 0,
      createGame,
      joinGame,
      startGame,
      act,
      rematch,
      kick,
      skip,
      leave,
    };
  }, [state, createGame, joinGame, startGame, act, rematch, kick, skip, leave]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameValue {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return value;
}
