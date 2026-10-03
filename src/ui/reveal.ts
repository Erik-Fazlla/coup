import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, Reveal } from '../engine/types';

/** How long a challenge result stays on screen. */
export const REVEAL_MS = 2200;

/**
 * The reveal id to treat as already shown when a game is first opened, so
 * reopening the app never replays an old challenge.
 */
export function seenAtOpen(game: Game): number {
  return Math.max(game.revealSeq, game.reveal?.id ?? 0);
}

/** The game's latest reveal if this screen has not shown it yet. */
export function unseenReveal(game: Game, seen: number): Reveal | null {
  return game.reveal && game.reveal.id > seen ? game.reveal : null;
}

/**
 * Shows each new challenge result exactly once, for REVEAL_MS, and lets a tap
 * end it early. `reveal` is null whenever nothing should be on screen.
 */
export function useRevealOnce(game: Game | null): {
  reveal: Reveal | null;
  dismiss: () => void;
} {
  const seen = useRef<number | null>(null);
  const [showing, setShowing] = useState<number | null>(null);

  useEffect(() => {
    if (!game) {
      return;
    }
    if (seen.current === null) {
      seen.current = seenAtOpen(game);
      return;
    }
    const fresh = unseenReveal(game, seen.current);
    if (fresh) {
      seen.current = fresh.id;
      setShowing(fresh.id);
    }
  }, [game]);

  // The clock belongs to the reveal, not to the snapshot: later snapshots must not restart or cancel it.
  useEffect(() => {
    if (showing === null) {
      return;
    }
    const timer = setTimeout(() => setShowing(null), REVEAL_MS);
    return () => clearTimeout(timer);
  }, [showing]);

  const dismiss = useCallback(() => setShowing(null), []);
  const current = game?.reveal ?? null;

  return {
    reveal: current && current.id === showing ? current : null,
    dismiss,
  };
}
