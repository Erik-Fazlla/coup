import {ActionType, Card, Game, Player} from './types';

export const FORCED_COUP_COINS = 10;

export const ACTION_COST: Record<ActionType, number> = {
  income: 0,
  foreignAid: 0,
  coup: 7,
  tax: 0,
  assassinate: 3,
  steal: 0,
  exchange: 0,
};

/** Character a player claims to hold when declaring the action. */
export const ACTION_CLAIM: Record<ActionType, Card | null> = {
  income: null,
  foreignAid: null,
  coup: null,
  tax: 'Duke',
  assassinate: 'Assassin',
  steal: 'Captain',
  exchange: 'Ambassador',
};

/** Characters that may be claimed to block the action. */
export const BLOCK_CLAIMS: Record<ActionType, Card[]> = {
  income: [],
  foreignAid: ['Duke'],
  coup: [],
  tax: [],
  assassinate: ['Contessa'],
  steal: ['Captain', 'Ambassador'],
  exchange: [],
};

export const TARGETED: ActionType[] = ['coup', 'assassinate', 'steal'];

export function unrevealedCount(player: Player): number {
  return player.influence.filter(i => !i.revealed).length;
}

export function isAlive(game: Game, playerId: string): boolean {
  const player = game.players[playerId];
  return !!player && unrevealedCount(player) > 0;
}

export function livingPlayers(game: Game): string[] {
  return game.playerOrder.filter(id => isAlive(game, id));
}

/** Actions the player may declare right now. Empty when it is not their turn to act. */
export function availableActions(game: Game, playerId: string): ActionType[] {
  const {phase, currentTurnPlayer} = game.state;
  if (game.status !== 'playing' || phase !== 'action' || currentTurnPlayer !== playerId) {
    return [];
  }
  const coins = game.players[playerId].coins;
  if (coins >= FORCED_COUP_COINS) {
    return ['coup'];
  }
  return (Object.keys(ACTION_COST) as ActionType[]).filter(action => coins >= ACTION_COST[action]);
}

/** Players who still have to pass, challenge or block before the game can continue. */
export function pendingResponders(game: Game): string[] {
  const {phase, pending} = game.state;
  if (!pending) {
    return [];
  }
  if (phase === 'awaitingResponses') {
    const asked = pending.challengeResolved
      ? pending.target
        ? [pending.target]
        : []
      : game.playerOrder.filter(id => id !== pending.actor);
    return asked.filter(id => isAlive(game, id) && !pending.responses[id]);
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    const block = pending.block;
    return livingPlayers(game).filter(id => id !== block.blocker && !block.responses[id]);
  }
  return [];
}

export interface ResponseOptions {
  canChallenge: boolean;
  blockClaims: Card[];
}

/** What the player may do besides passing, or null when they are not being asked. */
export function responseOptions(game: Game, playerId: string): ResponseOptions | null {
  const pending = game.state.pending;
  if (!pending || !pendingResponders(game).includes(playerId)) {
    return null;
  }
  if (game.state.phase === 'awaitingBlockResponses') {
    return {canChallenge: true, blockClaims: []};
  }
  const claims = BLOCK_CLAIMS[pending.action];
  const mayBlock = claims.length > 0 && (pending.action === 'foreignAid' || pending.target === playerId);
  return {
    canChallenge: pending.claim !== null && !pending.challengeResolved,
    blockClaims: mayBlock ? claims : [],
  };
}
