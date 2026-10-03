export type Presence = Record<string, true>;

/**
 * The presence list, once it can be trusted. Null means "show no dots":
 * presence cannot be read at all, or the first real snapshot has not arrived.
 * This device announces itself as soon as it opens a game, so a list that does
 * not contain the local player yet is not a list of who is offline: it is
 * simply too early to say.
 */
export function knownPresence(
  online: Presence | null | undefined,
  localId: string,
): Presence | null {
  return online && online[localId] === true ? online : null;
}

/** Whether a player is online, or null when no dot should be drawn. */
export function isOnline(
  presence: Presence | null,
  playerId: string,
): boolean | null {
  return presence ? presence[playerId] === true : null;
}
