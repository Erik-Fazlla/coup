export type Card = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

export const CARDS: Card[] = [
  'Duke',
  'Assassin',
  'Captain',
  'Ambassador',
  'Contessa',
];

export type UntargetedAction = 'income' | 'foreignAid' | 'tax' | 'exchange';
export type TargetedAction = 'coup' | 'assassinate' | 'steal';
export type ActionType = UntargetedAction | TargetedAction;

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type Phase =
  | 'action'
  | 'awaitingResponses'
  | 'awaitingBlockResponses'
  | 'loseInfluence'
  | 'exchange'
  | 'finished';

/** What happens after a player finishes losing an influence. */
export type Continuation =
  | 'endTurn'
  | 'resolveAction'
  | 'afterFailedChallenge'
  | 'afterFailedBlock';

export interface Influence {
  card: Card;
  revealed: boolean;
}

export interface Player {
  name: string;
  coins: number;
  influence: Influence[];
  eliminatedAt: number | null;
}

export interface Block {
  blocker: string;
  claim: Card;
  responses: Record<string, 'pass'>;
}

export interface Pending {
  actor: string;
  action: ActionType;
  target: string | null;
  claim: Card | null;
  responses: Record<string, 'pass'>;
  /** True once a challenge against the action has failed; only a block by the target remains possible. */
  challengeResolved: boolean;
  block: Block | null;
  loseInfluence: { playerId: string; next: Continuation } | null;
  exchangeOptions: Card[] | null;
}

export interface LastAction {
  playerId: string;
  action: ActionType;
  target: string | null;
  blocked: boolean;
}

export interface GameState {
  phase: Phase;
  currentTurnPlayer: string;
  turnNumber: number;
  pending: Pending | null;
  lastAction: LastAction | null;
  /** Bumped whenever something new opens for responses, so late taps on an older prompt can be rejected. */
  claimSeq: number;
}

/** One player going out. `by` is the player whose action or challenge took their last card. */
export interface Elimination {
  playerId: string;
  by: string | null;
  turn: number;
}

/** How the most recent challenge turned out. Says nothing the log does not already say publicly. */
export interface Reveal {
  /** Goes up by 1 with every reveal for the lifetime of the game id, so each can be shown exactly once. */
  id: number;
  challenger: string;
  claimant: string;
  /** The character that was claimed. */
  card: Card;
  /** Whether the claimant really held it. */
  truthful: boolean;
  /** Whether the challenged claim was a block rather than an action. */
  block: boolean;
}

export interface Game {
  host: string;
  code: string;
  status: GameStatus;
  playerOrder: string[];
  players: Record<string, Player>;
  deck: Card[];
  state: GameState;
  log: string[];
  winner: string | null;
  createdAt: number;
  /** Which game of this lobby is being played; starts at 1 and goes up with every rematch. */
  round: number;
  /** Wins in this lobby across rounds. Players without a win may be missing. */
  scores: Record<string, number>;
  /** Who went out this round, in order. */
  eliminations: Elimination[];
  /** Outcome of the latest challenge; stays until the next one or a rematch. */
  reveal: Reveal | null;
  /** Id of the last reveal ever made in this game id. Survives rematches so ids never repeat. */
  revealSeq: number;
  /** Players the host removed from the lobby; they cannot join this game again. */
  kicked: Record<string, true>;
}

export type GameAction =
  | { type: UntargetedAction; playerId: string }
  | { type: TargetedAction; playerId: string; target: string }
  | { type: 'pass'; playerId: string; seq: number }
  | { type: 'challenge'; playerId: string; seq: number }
  | { type: 'block'; playerId: string; claim: Card; seq: number }
  | { type: 'loseInfluence'; playerId: string; cardIndex: number }
  | { type: 'exchangeChoose'; playerId: string; keep: number[] };

export type DeclareAction = Extract<GameAction, { type: ActionType }>;

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
