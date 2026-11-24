import { useEffect, useRef, useState } from 'react';
import { ACTION_LABEL } from '../engine/describe';
import { Game, Player } from '../engine/types';

/** Something on the table worth a short animation. Never names a hidden card. */
export type Moment =
  | { kind: 'coins'; playerId: string; delta: number }
  | { kind: 'claim'; playerId: string; label: string }
  | { kind: 'block'; playerId: string; label: string }
  | { kind: 'cardLost'; playerId: string }
  | { kind: 'deal' };

/** The moments of one snapshot change, numbered so a component can tell a new batch from an old one. */
export interface MomentBatch {
  seq: number;
  moments: Moment[];
}

/** What one seat (or the local player's hand) shows for a batch. */
export interface SeatMoment {
  id: number;
  coins?: number;
  tag?: string;
  block: boolean;
  /** The player has just lost a card. */
  lost: boolean;
}

const revealed = (player: Player) =>
  player.influence.filter(card => card.revealed).length;

function sameRound(a: Game, b: Game): boolean {
  return (
    a.code === b.code && a.createdAt === b.createdAt && a.round === b.round
  );
}

/** The first snapshot of a game nobody has moved in yet: the cards are being dealt. */
export function isDealSnapshot(game: Game): boolean {
  const { state } = game;
  return (
    game.status === 'playing' &&
    state.turnNumber === 1 &&
    state.lastAction === null &&
    state.pending === null &&
    state.phase === 'action'
  );
}

/**
 * The moments between two snapshots, as everyone at the table sees them. A first
 * snapshot (no previous one, or another game or round) shows only the deal, and
 * only when nobody has moved yet: reopening the app never replays the table.
 */
export function tableMoments(previous: Game | null, next: Game): Moment[] {
  if (previous === next) {
    return [];
  }
  if (!previous || !sameRound(previous, next)) {
    return isDealSnapshot(next) ? [{ kind: 'deal' }] : [];
  }
  const moments: Moment[] = [];
  const before = previous.state.pending;
  const after = next.state.pending;
  if (
    after &&
    (!before || before.actor !== after.actor || before.action !== after.action)
  ) {
    const label = ACTION_LABEL[after.action].toUpperCase();
    moments.push({
      kind: 'claim',
      playerId: after.actor,
      label: after.claim ? `${label} · ${after.claim}` : label,
    });
  }
  if (after?.block && !before?.block) {
    moments.push({
      kind: 'block',
      playerId: after.block.blocker,
      label: `BLOCK · ${after.block.claim}`,
    });
  }
  for (const id of next.playerOrder) {
    const was = previous.players[id];
    const now = next.players[id];
    if (was && now && now.coins !== was.coins) {
      moments.push({
        kind: 'coins',
        playerId: id,
        delta: now.coins - was.coins,
      });
    }
  }
  for (const id of next.playerOrder) {
    const was = previous.players[id];
    const now = next.players[id];
    if (was && now && revealed(now) > revealed(was)) {
      moments.push({ kind: 'cardLost', playerId: id });
    }
  }
  return moments;
}

/** Keeps the previous snapshot and hands out each new non-empty batch of moments. */
export function useTableMoments(game: Game | null): MomentBatch {
  const previous = useRef<Game | null>(null);
  const [batch, setBatch] = useState<MomentBatch>({ seq: 0, moments: [] });
  useEffect(() => {
    if (!game) {
      return;
    }
    const moments = tableMoments(previous.current, game);
    previous.current = game;
    if (moments.length > 0) {
      setBatch(current => ({ seq: current.seq + 1, moments }));
    }
  }, [game]);
  return batch;
}

/** One player's part of a batch, or null when the batch does not concern them. */
export function seatMoment(
  batch: MomentBatch,
  playerId: string,
): SeatMoment | null {
  let coins: number | undefined;
  let tag: string | undefined;
  let block = false;
  let lost = false;
  for (const moment of batch.moments) {
    if (moment.kind === 'deal' || moment.playerId !== playerId) {
      continue;
    }
    if (moment.kind === 'coins') {
      coins = moment.delta;
    } else if (moment.kind === 'cardLost') {
      lost = true;
    } else {
      tag = moment.label;
      block = block || moment.kind === 'block';
    }
  }
  return coins === undefined && tag === undefined && !lost
    ? null
    : { id: batch.seq, coins, tag, block, lost };
}

/** The batch number of the latest deal, or null if the latest batch is not a deal. */
export function dealId(batch: MomentBatch): number | null {
  return batch.moments.some(moment => moment.kind === 'deal')
    ? batch.seq
    : null;
}
