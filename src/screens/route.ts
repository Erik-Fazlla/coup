import { Game } from '../engine/types';

export type Route =
  /** Nothing to show yet, or something is about to change: an empty screen. */
  | 'blank'
  | 'home'
  | 'loading'
  /** The game id no longer leads anywhere. */
  | 'missing'
  | 'lobby'
  /** The host removed this player from the lobby. */
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
 * Which screen to show. The one decision that is not a plain switch: a lobby
 * the local player is not in.
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
    return loaded ? 'missing' : 'loading';
  }
  switch (game.status) {
    case 'waiting':
      if (game.players[playerId]) {
        return 'lobby';
      }
      if (game.kicked[playerId]) {
        return 'removed';
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
