import { copiesPerCharacter, LARGE_GAME_FROM } from './deck';
import { MAX_PLAYERS, MIN_PLAYERS } from './lobby';
import {
  ACTION_CLAIM,
  ACTION_COST,
  availableActions,
  BLOCK_CLAIMS,
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

/** Who pays for the latest challenge, e.g. "Erik loses a card". Empty when there has been none. */
export function revealLoserLine(game: Game): string {
  const reveal = game.reveal;
  if (!reveal) {
    return '';
  }
  const loser = reveal.truthful ? reveal.challenger : reveal.claimant;
  return `${nameOf(game, loser)} loses a card`;
}

/**
 * The players the game cannot continue without right now: whoever must act,
 * respond, lose a card or finish an exchange. Empty when nobody is.
 */
export function waitingOn(game: Game): string[] {
  if (game.status !== 'playing') {
    return [];
  }
  const { phase, pending, currentTurnPlayer } = game.state;
  switch (phase) {
    case 'action':
      return [currentTurnPlayer];
    case 'awaitingResponses':
    case 'awaitingBlockResponses':
      return pendingResponders(game);
    case 'loseInfluence':
      return pending?.loseInfluence ? [pending.loseInfluence.playerId] : [];
    case 'exchange':
      return pending ? [pending.actor] : [];
    default:
      return [];
  }
}

/** Names of the players the game is waiting for, e.g. "Maria, Nikos". Empty when nobody is. */
export function waitingNames(game: Game): string {
  return waitingOn(game)
    .map(id => nameOf(game, id))
    .join(', ');
}

/** The invitation sent through the share sheet. Plain text, so every app accepts it. */
export function shareMessage(code: string): string {
  return `Join my Coup game — code ${code}`;
}

/** The order actions are listed in: free ones first, then the character actions, Coup last. */
export const ACTION_ORDER: ActionType[] = [
  'income',
  'foreignAid',
  'tax',
  'exchange',
  'steal',
  'assassinate',
  'coup',
];

export interface ActionRule {
  action: ActionType;
  label: string;
  /** "Free" or "3 coins". */
  cost: string;
  effect: string;
  /** The character the player claims to hold, or null when anyone may do it. */
  claim: Card | null;
  /** Characters that may be claimed to stop it. */
  blockedBy: Card[];
}

/** One row per action for the rules reference, read from the tables the engine itself plays by. */
export function actionRules(): ActionRule[] {
  return ACTION_ORDER.map(action => ({
    action,
    label: ACTION_LABEL[action],
    cost: ACTION_COST[action] > 0 ? `${ACTION_COST[action]} coins` : 'Free',
    effect: ACTION_DETAIL[action],
    claim: ACTION_CLAIM[action],
    blockedBy: BLOCK_CLAIMS[action],
  }));
}

/** The rules that are not a table: short paragraphs for the rules reference. */
export const RULE_NOTES: { title: string; text: string }[] = [
  {
    title: 'Players and deck',
    text: `${MIN_PLAYERS} to ${MAX_PLAYERS} players. Up to ${
      LARGE_GAME_FROM - 1
    } play with ${copiesPerCharacter(
      MIN_PLAYERS,
    )} of each character; from ${LARGE_GAME_FROM} there are ${copiesPerCharacter(
      LARGE_GAME_FROM,
    )} of each. With ${MAX_PLAYERS} players every card is dealt, so the deck starts empty.`,
  },
  {
    title: 'Challenges',
    text: 'Whenever a player claims a character, for an action or for a block, any other player may challenge. If the claim was true, the challenger loses a card and the claimant swaps the shown card for a new one from the deck. If it was a bluff, the claimant loses a card and the action or block fails.',
  },
  {
    title: 'Blocks',
    text: 'Some actions can be stopped by claiming the character listed next to them. Anyone may block Foreign Aid; only the target may block a Steal or an Assassination. A block is a claim too, so it can be challenged.',
  },
  {
    title: 'Losing influence',
    text: 'When you lose a card you choose which one, and it stays face up for everyone to see. Lose both and you are out. The last player holding a card wins.',
  },
  {
    title: 'Forced Coup',
    text: `With ${FORCED_COUP_COINS} or more coins you must Coup on your turn. A Coup costs ${ACTION_COST.coup} coins and cannot be blocked or challenged.`,
  },
];

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
