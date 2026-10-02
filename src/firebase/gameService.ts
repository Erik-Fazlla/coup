import {
  Database,
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
} from 'firebase/database';
import { applyAction } from '../engine/actions';
import { Rng } from '../engine/deck';
import {
  addPlayer,
  generateCode,
  newGame,
  removePlayer,
  startGame as startLobby,
} from '../engine/lobby';
import { normalizeGame } from '../engine/serialize';
import { Game, GameAction } from '../engine/types';

const CREATE_ATTEMPTS = 5;
const CODE_PATTERN = /^[A-Z0-9]{5}$/;

export function createGameService(
  db: Database,
  rng: Rng = Math.random,
  now: () => number = Date.now,
) {
  const gameRef = (gameId: string) => ref(db, `games/${gameId}`);

  /**
   * Applies `change` to the game atomically. If another phone wrote first, Firebase re-runs `change`
   * on the fresh state. An error thrown by `change` aborts the write and is re-thrown to the caller.
   */
  async function mutate(
    gameId: string,
    change: (game: Game) => Game,
  ): Promise<void> {
    const outcome: { error: Error | null } = { error: null };
    const result = await runTransaction(
      gameRef(gameId),
      raw => {
        outcome.error = null;
        if (raw === null) {
          return raw;
        }
        try {
          return change(normalizeGame(raw));
        } catch (error) {
          outcome.error = error as Error;
          return undefined;
        }
      },
      { applyLocally: false },
    );
    if (outcome.error) {
      throw outcome.error;
    }
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error('Game not found');
    }
  }

  /** Creates a waiting game hosted by the player and returns its id. */
  async function createGame(playerId: string, name: string): Promise<string> {
    const gameId = push(ref(db, 'games')).key;
    if (!gameId) {
      throw new Error('Could not create a game. Try again.');
    }
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const code = generateCode(rng);
      const reserved = await runTransaction(
        ref(db, `codes/${code}`),
        current => (current === null ? gameId : undefined),
        { applyLocally: false },
      );
      if (reserved.committed) {
        await set(gameRef(gameId), newGame(playerId, name, code, now()));
        return gameId;
      }
    }
    throw new Error('Could not create a game. Try again.');
  }

  /** Joins (or rejoins) the game with this code and returns its id. */
  async function joinGame(
    code: string,
    playerId: string,
    name: string,
  ): Promise<string> {
    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      throw new Error('No game found with that code');
    }
    const snapshot = await get(ref(db, `codes/${normalized}`));
    if (!snapshot.exists()) {
      throw new Error('No game found with that code');
    }
    const gameId = snapshot.val() as string;
    await mutate(gameId, game => addPlayer(game, playerId, name));
    return gameId;
  }

  function startGame(gameId: string, playerId: string): Promise<void> {
    return mutate(gameId, game => startLobby(game, playerId, rng));
  }

  function leaveLobby(gameId: string, playerId: string): Promise<void> {
    return mutate(gameId, game => removePlayer(game, playerId));
  }

  /** Deletes a waiting game when the host cancels it. Does nothing for anyone else or once started. */
  async function cancelLobby(gameId: string, playerId: string): Promise<void> {
    await runTransaction(
      gameRef(gameId),
      raw => {
        if (raw === null) {
          return raw;
        }
        return raw.status === 'waiting' && raw.host === playerId
          ? null
          : undefined;
      },
      { applyLocally: false },
    );
  }

  function dispatch(gameId: string, action: GameAction): Promise<void> {
    return mutate(gameId, game => applyAction(game, action, rng));
  }

  /** Calls `onGame` with every new state (null if the game does not exist). Returns an unsubscribe function. */
  function subscribe(
    gameId: string,
    onGame: (game: Game | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onValue(
      gameRef(gameId),
      snapshot =>
        onGame(snapshot.exists() ? normalizeGame(snapshot.val()) : null),
      onError,
    );
  }

  function subscribeConnection(
    onChange: (connected: boolean) => void,
  ): () => void {
    return onValue(ref(db, '.info/connected'), snapshot =>
      onChange(snapshot.val() === true),
    );
  }

  return {
    createGame,
    joinGame,
    startGame,
    leaveLobby,
    cancelLobby,
    dispatch,
    subscribe,
    subscribeConnection,
  };
}

export type GameService = ReturnType<typeof createGameService>;
