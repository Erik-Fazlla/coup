import {
  ACTION_COST,
  availableActions,
  FORCED_COUP_COINS,
  pendingResponders,
} from './rules';
import { ActionType, Card, Game, Pending } from './types';

/** What each character does, for card faces and the rules reference. Text only: colours live in the theme. */
export const CHARACTER_INFO: Record<
  Card,
  { ability: string; blocks: string | null }
> = {
  Duke: { ability: 'Tax +3 · blocks Foreign Aid', blocks: 'Foreign Aid' },
  Assassin: { ability: 'Pay 3: target loses a card', blocks: null },
  Captain: { ability: 'Steal 2 · blocks Steal', blocks: 'Steal' },
  Ambassador: { ability: 'Exchange cards · blocks Steal', blocks: 'Steal' },
  Contessa: { ability: 'Blocks Assassination', blocks: 'Assassination' },
};

/** Two-letter code for places too small for the full name. */
export const CHARACTER_CODE: Record<Card, string> = {
  Duke: 'Du',
  Assassin: 'As',
  Captain: 'Ca',
  Ambassador: 'Am',
  Contessa: 'Co',
};

/** Shortest form of what an action costs or gives, for an action tile. */
export const ACTION_EFFECT: Record<ActionType, string> = {
  income: '+1',
  foreignAid: '+2',
  coup: `Pay ${ACTION_COST.coup}`,
  tax: '+3',
  assassinate: `Pay ${ACTION_COST.assassinate}`,
  steal: 'Take 2',
  exchange: 'Swap',
};

/** Spoken form of what an action costs and does, for screen readers. */
export const ACTION_DETAIL: Record<ActionType, string> = {
  income: 'take 1 coin',
  foreignAid: 'take 2 coins',
  coup: `costs ${ACTION_COST.coup} coins, a player loses a card`,
  tax: 'take 3 coins',
  assassinate: `costs ${ACTION_COST.assassinate} coins, a player loses a card`,
  steal: 'take 2 coins from a player',
  exchange: 'swap cards with the deck',
};

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
  coup: 'Coup −7',
  tax: 'Tax +3 (Duke)',
  assassinate: 'Assassinate −3',
  steal: 'Steal 2 (Captain)',
  exchange: 'Exchange (Ambassador)',
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

/** How the latest challenge turned out, e.g. "Maria had the Duke". Empty when there has been none. */
export function revealLine(game: Game): string {
  const reveal = game.reveal;
  if (!reveal) {
    return '';
  }
  const claimant = nameOf(game, reveal.claimant);
  return reveal.truthful
    ? `${claimant} had the ${reveal.card}`
    : `${claimant} was bluffing — no ${reveal.card}`;
}

/** One line per player who went out this round, in order: who, taken out by whom, on which turn. */
export function eliminationLines(game: Game): string[] {
  return game.eliminations.map(({ playerId, by, turn }) => {
    const cause = by ? `taken out by ${nameOf(game, by)}` : 'out';
    return `${nameOf(game, playerId)} — ${cause} (turn ${turn})`;
  });
}

export interface ScoreRow {
  playerId: string;
  name: string;
  wins: number;
}

/** Wins in this lobby for every current player, most first; equal scores stay in join order. */
export function scoreboard(game: Game): ScoreRow[] {
  return game.playerOrder
    .map((playerId, joined) => ({
      joined,
      row: {
        playerId,
        name: nameOf(game, playerId),
        wins: game.scores[playerId] ?? 0,
      },
    }))
    .sort((a, b) => b.row.wins - a.row.wins || a.joined - b.joined)
    .map(entry => entry.row);
}

/** Why the player cannot declare this action right now, or null when they can. */
export function unavailableReason(
  game: Game,
  playerId: string,
  action: ActionType,
): string | null {
  if (availableActions(game, playerId).includes(action)) {
    return null;
  }
  const { phase, currentTurnPlayer } = game.state;
  const player = game.players[playerId];
  if (
    !player ||
    game.status !== 'playing' ||
    phase !== 'action' ||
    currentTurnPlayer !== playerId
  ) {
    return 'not your turn';
  }
  if (player.coins >= FORCED_COUP_COINS) {
    return `you must Coup with ${FORCED_COUP_COINS} or more coins`;
  }
  return `needs ${ACTION_COST[action]} coins`;
}

/**
 * The line one player sees in the centre of the table: what they must do now,
 * or (when nothing is asked of them) what the table is waiting for.
 */
export function viewerLine(
  game: Game,
  playerId: string,
): { text: string; yours: boolean } {
  const { phase, pending } = game.state;
  if (pendingResponders(game).includes(playerId)) {
    return { text: promptLine(game), yours: true };
  }
  if (
    phase === 'loseInfluence' &&
    pending?.loseInfluence?.playerId === playerId
  ) {
    return { text: 'Choose a card to lose', yours: true };
  }
  if (phase === 'exchange' && pending?.actor === playerId) {
    return { text: 'Choose the cards to keep', yours: true };
  }
  if (availableActions(game, playerId).length > 0) {
    const mustCoup = game.players[playerId].coins >= FORCED_COUP_COINS;
    return {
      text: mustCoup
        ? `You have ${FORCED_COUP_COINS} or more coins: you must Coup`
        : 'Your turn: choose an action',
      yours: true,
    };
  }
  return { text: statusLine(game), yours: false };
}
