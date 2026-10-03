import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { waitingOn } from '../engine/describe';
import { unrevealedCount } from '../engine/rules';
import { Game } from '../engine/types';

export type BuzzKind = 'turn' | 'respond' | 'lose' | 'exchange';

export interface BuzzMoment {
  /** The same for every snapshot of one moment, different for every new one. */
  key: string;
  kind: BuzzKind;
}

/**
 * Whether the game is waiting for this player right now, and for what.
 * Null when it is someone else's moment, so their prompts never buzz this phone.
 *
 * The key is built from what makes a moment new for this player: the round,
 * the turn, the claim being answered, the phase, and how many cards they still
 * hold (two losses in a row are two moments). Who else is being waited on is
 * left out on purpose: another player passing must not buzz this phone again.
 */
export function buzzMoment(
  game: Game | null,
  playerId: string,
): BuzzMoment | null {
  if (!game || !waitingOn(game).includes(playerId)) {
    return null;
  }
  const { phase, turnNumber, claimSeq } = game.state;
  const kind: BuzzKind =
    phase === 'action'
      ? 'turn'
      : phase === 'loseInfluence'
      ? 'lose'
      : phase === 'exchange'
      ? 'exchange'
      : 'respond';
  const cards = unrevealedCount(game.players[playerId]);
  return {
    key: [game.round, turnNumber, claimSeq, phase, playerId, cards].join(':'),
    kind,
  };
}

/** Android patterns are [wait, buzz, wait, buzz]; a number is one buzz of that length. */
export const BUZZ_PATTERN: Record<BuzzKind, number | number[]> = {
  /** Two firm pulses: it is your turn. */
  turn: [0, 90, 130, 90],
  /** One pulse: you are asked to respond. */
  respond: 70,
  /** One pulse: choose your exchange cards. */
  exchange: 70,
  /** One long pulse: you must lose a card. */
  lose: 400,
};

/**
 * Buzzes the phone once when it becomes this player's moment to act. Later
 * snapshots of the same moment are silent. Turning `enabled` off silences it
 * entirely; turning it back on does not replay a moment already under way.
 */
export function useTurnBuzz(
  game: Game | null,
  playerId: string,
  enabled: boolean,
): void {
  const moment = buzzMoment(game, playerId);
  const key = moment?.key ?? null;
  const kind = moment?.kind ?? null;
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (key === null || kind === null) {
      last.current = null;
      return;
    }
    if (key === last.current) {
      return;
    }
    last.current = key;
    if (!enabled) {
      return;
    }
    try {
      Vibration.vibrate(BUZZ_PATTERN[kind]);
    } catch {
      // No vibrator or no permission: the banner still says it is their turn.
    }
  }, [key, kind, enabled]);
}
