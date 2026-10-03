import { useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Game, Player } from '../engine/types';
import { seenAtOpen, unseenReveal } from './reveal';
import { playSound, SoundName } from './sound';
import { buzzMoment } from './turnBuzz';

function revealedCount(player: Player): number {
  return player.influence.filter(influence => influence.revealed).length;
}

/** Whether two snapshots belong to the same round of the same game. */
function sameRound(a: Game, b: Game): boolean {
  return (
    a.code === b.code && a.createdAt === b.createdAt && a.round === b.round
  );
}

/**
 * The sounds to play, in order, when the game goes from `previous` to `next`
 * as seen by `playerId`. Each name appears at most once.
 *
 * Nothing for the first snapshot (`previous` is null), so opening a game is
 * silent, and nothing when the two snapshots are different games or rounds.
 *
 * Order: challenge, card, coin, then turn or prompt, then win or lose.
 */
export function soundCues(
  previous: Game | null,
  next: Game,
  playerId: string,
): SoundName[] {
  if (!previous || previous === next || !sameRound(previous, next)) {
    return [];
  }
  const cues: SoundName[] = [];
  const ids = Object.keys(next.players).filter(id => previous.players[id]);

  // A challenge was settled: the same test the reveal overlay uses to appear.
  if (unseenReveal(next, seenAtOpen(previous))) {
    cues.push('challenge');
  }
  if (
    ids.some(
      id =>
        revealedCount(next.players[id]) > revealedCount(previous.players[id]),
    )
  ) {
    cues.push('card');
  }
  if (ids.some(id => next.players[id].coins !== previous.players[id].coins)) {
    cues.push('coin');
  }

  // The game now waits for this player: exactly when the phone would buzz.
  const moment = buzzMoment(next, playerId);
  if (moment && moment.key !== buzzMoment(previous, playerId)?.key) {
    cues.push(moment.kind === 'turn' ? 'turn' : 'prompt');
  }

  // Only players hear the result; someone merely looking at the game does not.
  if (
    next.status === 'finished' &&
    previous.status !== 'finished' &&
    next.players[playerId]
  ) {
    cues.push(next.winner === playerId ? 'win' : 'lose');
  }
  return cues;
}

/**
 * The last snapshot of a screen that has just closed, kept for the screen that
 * opens in its place. The game screen closes at the very moment the game ends
 * and the Game Over screen opens, and the end must still be heard.
 */
let handedOver: Game | null = null;

/** The snapshot to compare a screen's first snapshot with, or null if it is simply being opened. */
function takeHandover(first: Game): Game | null {
  const previous = handedOver;
  handedOver = null;
  return previous &&
    previous.status === 'playing' &&
    first.status === 'finished' &&
    sameRound(previous, first)
    ? previous
    : null;
}

/**
 * Plays the sounds for each new snapshot of the game, unless the player has
 * switched sound off. Used by the game screen and the Game Over screen.
 *
 * The first snapshot a screen sees is silent, so reopening the app never
 * plays a burst. The one exception is the snapshot that ends the game: it
 * arrives on the Game Over screen, which takes over from the game screen.
 */
export function useGameSounds(game: Game | null, playerId: string): void {
  const { settings } = useSettings();
  const enabled = settings.sound;
  const previous = useRef<Game | null>(null);

  useEffect(() => {
    if (!game) {
      return;
    }
    const before = previous.current ?? takeHandover(game);
    previous.current = game;
    if (!enabled) {
      return;
    }
    soundCues(before, game, playerId).forEach(playSound);
  }, [game, playerId, enabled]);

  useEffect(
    () => () => {
      handedOver = previous.current;
      const mine = handedOver;
      // Only a screen opening in this same instant may take it; afterwards it is stale.
      setTimeout(() => {
        if (handedOver === mine) {
          handedOver = null;
        }
      }, 0);
    },
    [],
  );
}
