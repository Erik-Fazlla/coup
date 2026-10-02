import { applyAction } from './actions';
import { Rng } from './deck';
import { Card, Game, GameAction, Pending, Player } from './types';

/** With this rng, shuffle() returns its input order unchanged. */
export const identityRng: Rng = () => 0.999999;

interface MakeGameOptions {
  coins?: Record<string, number>;
  deck?: Card[];
}

/** Builds a playing game. Player ids are the keys of `hands`; names are the upper-cased ids. First key acts first. */
export function makeGame(
  hands: Record<string, Card[]>,
  options: MakeGameOptions = {},
): Game {
  const ids = Object.keys(hands);
  const players: Record<string, Player> = {};
  ids.forEach(id => {
    players[id] = {
      name: id.toUpperCase(),
      coins: options.coins?.[id] ?? 2,
      influence: hands[id].map(card => ({ card, revealed: false })),
      eliminatedAt: null,
    };
  });
  return {
    host: ids[0],
    code: 'TEST1',
    status: 'playing',
    playerOrder: ids,
    players,
    deck: options.deck ?? [
      'Duke',
      'Assassin',
      'Captain',
      'Ambassador',
      'Contessa',
    ],
    state: {
      phase: 'action',
      currentTurnPlayer: ids[0],
      turnNumber: 1,
      pending: null,
      lastAction: null,
      claimSeq: 0,
    },
    log: [],
    winner: null,
    createdAt: 0,
  };
}

export function makePending(
  partial: Partial<Pending> & Pick<Pending, 'actor' | 'action'>,
): Pending {
  return {
    target: null,
    claim: null,
    responses: {},
    challengeResolved: false,
    block: null,
    loseInfluence: null,
    exchangeOptions: null,
    ...partial,
  };
}

type WithOptionalSeq<A> = A extends { seq: number }
  ? Omit<A, 'seq'> & { seq?: number }
  : A;

/** A GameAction whose `seq` may be left out; `play` then uses the claim that is open at that moment. */
export type LooseAction = WithOptionalSeq<GameAction>;

function withSeq(game: Game, action: LooseAction): GameAction {
  const needsSeq =
    action.type === 'pass' ||
    action.type === 'challenge' ||
    action.type === 'block';
  if (needsSeq && action.seq === undefined) {
    return { ...action, seq: game.state.claimSeq } as GameAction;
  }
  return action as GameAction;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
}

/**
 * Applies actions in order with the identity rng, filling in a missing `seq` with the current `claimSeq`.
 * Every state is deep-frozen before it reaches `applyAction`, so any mutation of an input game throws.
 * That includes `game` itself: build and tweak it before calling `play`, not after.
 */
export function play(game: Game, ...actions: LooseAction[]): Game {
  return actions.reduce(
    (state, action) =>
      applyAction(deepFreeze(state), withSeq(state, action), identityRng),
    game,
  );
}
