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
import { useProfile } from './ProfileContext';

interface State {
  /** False until the stored active game id has been read. */
  ready: boolean;
  gameId: string | null;
  game: Game | null;
  /** True once the first snapshot for `gameId` has arrived. */
  loaded: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
}

type Event =
  | { type: 'entered'; gameId: string | null }
  | { type: 'game'; game: Game | null }
  | { type: 'connected'; connected: boolean }
  | { type: 'busy'; busy: boolean }
  | { type: 'error'; error: string | null };

const initialState: State = {
  ready: false,
  gameId: null,
  game: null,
  loaded: false,
  connected: false,
  busy: false,
  error: null,
};

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'entered':
      return {
        ...state,
        ready: true,
        gameId: event.gameId,
        game: null,
        loaded: false,
        error: null,
      };
    case 'game':
      return { ...state, game: event.game, loaded: true };
    case 'connected':
      return { ...state, connected: event.connected };
    case 'busy':
      return { ...state, busy: event.busy };
    case 'error':
      return { ...state, error: event.error };
  }
}

interface GameValue extends State {
  createGame: () => Promise<void>;
  joinGame: (code: string) => Promise<void>;
  startGame: () => Promise<void>;
  act: (action: GameAction) => Promise<void>;
  leave: () => Promise<void>;
}

const GameContext = createContext<GameValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { games, profiles } = getServices();
  const { playerId, profile } = useProfile();
  const name = profile?.name ?? '';
  const [state, send] = useReducer(reducer, initialState);
  const { gameId, game } = state;

  useEffect(() => {
    let active = true;
    profiles.getActiveGameId().then(stored => {
      if (active) {
        send({ type: 'entered', gameId: stored });
      }
    });
    const unsubscribe = games.subscribeConnection(connected =>
      send({ type: 'connected', connected }),
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

  /** Runs a remote operation, showing its error message instead of throwing. */
  const run = useCallback(async (operation: () => Promise<void>) => {
    send({ type: 'busy', busy: true });
    send({ type: 'error', error: null });
    try {
      await operation();
    } catch (error) {
      send({
        type: 'error',
        error: error instanceof Error ? error.message : 'Something went wrong',
      });
    } finally {
      send({ type: 'busy', busy: false });
    }
  }, []);

  const enter = useCallback(
    async (id: string | null) => {
      await profiles.setActiveGameId(id);
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

  const leave = useCallback(
    () =>
      run(async () => {
        const lobbyToLeave =
          gameId && game && game.status === 'waiting' && game.host !== playerId
            ? gameId
            : null;
        await enter(null);
        if (lobbyToLeave) {
          await games.leaveLobby(lobbyToLeave, playerId);
        }
      }),
    [run, enter, games, gameId, game, playerId],
  );

  const value = useMemo(
    () => ({ ...state, createGame, joinGame, startGame, act, leave }),
    [state, createGame, joinGame, startGame, act, leave],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameValue {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return value;
}
