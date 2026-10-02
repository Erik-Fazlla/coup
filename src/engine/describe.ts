import { pendingResponders } from './rules';
import { ActionType, Game, Pending } from './types';

export const ACTION_LABEL: Record<ActionType, string> = {
  income: 'Income',
  foreignAid: 'Foreign Aid',
  coup: 'Coup',
  tax: 'Tax',
  assassinate: 'Assassinate',
  steal: 'Steal',
  exchange: 'Exchange',
};

/** Button text: label plus cost/gain and the character claimed. */
export const ACTION_BUTTON: Record<ActionType, string> = {
  income: 'Income +1',
  foreignAid: 'Foreign Aid +2',
  coup: 'Coup (7)',
  tax: 'Tax +3 · Duke',
  assassinate: 'Assassinate (3) · Assassin',
  steal: 'Steal 2 · Captain',
  exchange: 'Exchange · Ambassador',
};

function nameOf(game: Game, playerId: string | null): string {
  return (playerId && game.players[playerId]?.name) || '?';
}

function actionText(game: Game, pending: Pending): string {
  const onTarget = pending.target ? ` on ${nameOf(game, pending.target)}` : '';
  return `${ACTION_LABEL[pending.action]}${onTarget}`;
}

/** One line for the centre of the board: what the table is waiting for. */
export function statusLine(game: Game): string {
  const { phase, pending, currentTurnPlayer } = game.state;
  if (phase === 'finished') {
    return `${nameOf(game, game.winner)} wins`;
  }
  if (phase === 'action' || !pending) {
    return `${nameOf(game, currentTurnPlayer)}'s turn`;
  }
  const waiting = pendingResponders(game)
    .map(id => nameOf(game, id))
    .join(', ');
  if (phase === 'awaitingResponses') {
    return `${nameOf(game, pending.actor)}: ${actionText(
      game,
      pending,
    )}. Waiting for ${waiting}`;
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    return `${nameOf(game, pending.block.blocker)} blocks with ${
      pending.block.claim
    }. Waiting for ${waiting}`;
  }
  if (phase === 'loseInfluence' && pending.loseInfluence) {
    return `${nameOf(game, pending.loseInfluence.playerId)} must lose a card`;
  }
  if (phase === 'exchange') {
    return `${nameOf(game, pending.actor)} is exchanging cards`;
  }
  return `${nameOf(game, currentTurnPlayer)}'s turn`;
}

/** What a responding player is being asked about. Empty when nothing is pending. */
export function promptLine(game: Game): string {
  const { phase, pending } = game.state;
  if (!pending) {
    return '';
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    return `${nameOf(game, pending.block.blocker)} claims ${
      pending.block.claim
    } to block ${ACTION_LABEL[pending.action]}`;
  }
  const actor = nameOf(game, pending.actor);
  return pending.claim
    ? `${actor} claims ${pending.claim}: ${actionText(game, pending)}`
    : `${actor} uses ${actionText(game, pending)}`;
}
