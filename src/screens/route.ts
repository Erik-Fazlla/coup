import { Game } from '../engine/types';

export type Route =
  /** Nothing to show yet, or something is about to change: an empty screen. */
  | 'blank'
  | 'home'
  | 'loading'
  /** The game id no longer leads anywhere. */
  | 'missing'
  | 'lobby'
  /** The host removed this player from the lobby; shown for as long as they stay on this game. */
  | 'removed'
  /** This player is not in the lobby and was not removed (they left on another device, say). */
  | 'left'
  | 'game'
  | 'over'
  | 'unknown';

interface RouteInput {
  ready: boolean;
  gameId: string | null;
  game: Game | null;
  loaded: boolean;
  busy: boolean;
}

/**
 * Which screen to show. The decisions that are not a plain switch: a game the
 * local player is not in, and a game that vanishes while they are leaving it.
 *
 * A player is only told "the host removed you" when the game says so
 * (`kicked`). Merely being absent is not enough: when a player leaves, the
 * server drops them from the lobby a moment before this device forgets the
 * game, and that moment must not flash the wrong message. A player who is
 * joining is never absent at all, because the game is only opened after the
 * join has been written.
 */
export function routeFor(input: RouteInput, playerId: string): Route {
  const { ready, gameId, game, loaded, busy } = input;
  if (!ready) {
    return 'blank';
  }
  if (!gameId) {
    return 'home';
  }
  if (!game) {
    if (!loaded) {
      return 'loading';
    }
    // A host cancelling the lobby deletes it a moment before this device forgets the game.
    return busy ? 'blank' : 'missing';
  }
  // Whatever the game goes on to do: a removed player keeps the screen that says so and lets them leave.
  if (game.kicked[playerId]) {
    return 'removed';
  }
  switch (game.status) {
    case 'waiting':
      if (game.players[playerId]) {
        return 'lobby';
      }
      return busy ? 'blank' : 'left';
    case 'playing':
      return 'game';
    case 'finished':
      // A guest going Home is dropped from the game a moment before this device forgets it.
      return busy && !game.players[playerId] ? 'blank' : 'over';
    default:
      return 'unknown';
  }
}
