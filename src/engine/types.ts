export type Card = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

export const CARDS: Card[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];

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
export type Continuation = 'endTurn' | 'resolveAction' | 'afterFailedChallenge';

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
  loseInfluence: {playerId: string; next: Continuation} | null;
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
}

export type GameAction =
  | {type: UntargetedAction; playerId: string}
  | {type: TargetedAction; playerId: string; target: string}
  | {type: 'pass'; playerId: string}
  | {type: 'challenge'; playerId: string}
  | {type: 'block'; playerId: string; claim: Card}
  | {type: 'loseInfluence'; playerId: string; cardIndex: number}
  | {type: 'exchangeChoose'; playerId: string; keep: number[]};

export type DeclareAction = Extract<GameAction, {type: ActionType}>;

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
