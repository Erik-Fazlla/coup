import { Game, IllegalActionError, Player } from './types';

function toArray<T>(value: unknown): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value)
    ? (value as T[])
    : (Object.values(value as object) as T[]);
}

/**
 * Rebuilds a complete Game from a Realtime Database snapshot value.
 * The database omits nulls, empty arrays and empty objects; this puts them back.
 * Throws IllegalActionError('Game not found') when there is no game at that location.
 */
export function normalizeGame(raw: any): Game {
  if (raw === null || raw === undefined) {
    throw new IllegalActionError('Game not found');
  }
  const players: Record<string, Player> = {};
  Object.keys(raw.players ?? {}).forEach(id => {
    const player = raw.players[id];
    players[id] = {
      name: player.name,
      coins: player.coins ?? 0,
      influence: toArray(player.influence),
      eliminatedAt: player.eliminatedAt ?? null,
    };
  });

  const state = raw.state ?? {};
  const pending = state.pending;
  const lastAction = state.lastAction;

  return {
    host: raw.host,
    code: raw.code,
    status: raw.status,
    playerOrder: toArray<string>(raw.playerOrder).filter(id => !!players[id]),
    players,
    deck: toArray(raw.deck),
    state: {
      phase: state.phase,
      currentTurnPlayer: state.currentTurnPlayer,
      turnNumber: state.turnNumber ?? 0,
      claimSeq: state.claimSeq ?? 0,
      pending: pending
        ? {
            actor: pending.actor,
            action: pending.action,
            target: pending.target ?? null,
            claim: pending.claim ?? null,
            responses: pending.responses ?? {},
            challengeResolved: !!pending.challengeResolved,
            block: pending.block
              ? {
                  blocker: pending.block.blocker,
                  claim: pending.block.claim,
                  responses: pending.block.responses ?? {},
                }
              : null,
            loseInfluence: pending.loseInfluence ?? null,
            exchangeOptions: pending.exchangeOptions
              ? toArray(pending.exchangeOptions)
              : null,
          }
        : null,
      lastAction: lastAction
        ? {
            playerId: lastAction.playerId,
            action: lastAction.action,
            target: lastAction.target ?? null,
            blocked: !!lastAction.blocked,
          }
        : null,
    },
    log: toArray(raw.log),
    winner: raw.winner ?? null,
    createdAt: raw.createdAt ?? 0,
    round: raw.round ?? 1,
    scores: { ...(raw.scores ?? {}) },
  };
}
