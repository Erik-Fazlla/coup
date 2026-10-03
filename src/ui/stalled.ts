import { useEffect, useState } from 'react';
import { waitingOn } from '../engine/describe';
import { Game } from '../engine/types';

/** How long the host waits before being offered a skip. */
export const SKIP_AFTER_MS = 45000;

/**
 * Names the thing the game is waiting for. It changes whenever the turn, the
 * phase, the claim or the set of players being waited on changes, and is null
 * when the game is not being played or nobody is being waited on.
 */
export function waitKey(game: Game | null): string | null {
  if (!game) {
    return null;
  }
  const waiting = waitingOn(game);
  if (waiting.length === 0) {
    return null;
  }
  const { turnNumber, phase, claimSeq } = game.state;
  return [
    game.round,
    turnNumber,
    phase,
    claimSeq,
    [...waiting].sort().join(','),
  ].join(':');
}

/**
 * True once `key` has stayed the same for `delayMs` on this device's own
 * clock. Any change of key starts the count again; a null key never stalls.
 */
export function useStalled(
  key: string | null,
  delayMs: number = SKIP_AFTER_MS,
): boolean {
  const [stalledKey, setStalledKey] = useState<string | null>(null);

  useEffect(() => {
    if (key === null) {
      return;
    }
    const timer = setTimeout(() => setStalledKey(key), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs]);

  return key !== null && stalledKey === key;
}
