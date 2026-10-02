import {Rng} from './deck';
import {Card, Game, Pending, Player} from './types';

/** With this rng, shuffle() returns its input order unchanged. */
export const identityRng: Rng = () => 0.999999;

interface MakeGameOptions {
  coins?: Record<string, number>;
  deck?: Card[];
}

/** Builds a playing game. Player ids are the keys of `hands`; names are the upper-cased ids. First key acts first. */
export function makeGame(hands: Record<string, Card[]>, options: MakeGameOptions = {}): Game {
  const ids = Object.keys(hands);
  const players: Record<string, Player> = {};
  ids.forEach(id => {
    players[id] = {
      name: id.toUpperCase(),
      coins: options.coins?.[id] ?? 2,
      influence: hands[id].map(card => ({card, revealed: false})),
      eliminatedAt: null,
    };
  });
  return {
    host: ids[0],
    code: 'TEST1',
    status: 'playing',
    playerOrder: ids,
    players,
    deck: options.deck ?? ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'],
    state: {phase: 'action', currentTurnPlayer: ids[0], turnNumber: 1, pending: null, lastAction: null},
    log: [],
    winner: null,
    createdAt: 0,
  };
}

export function makePending(partial: Partial<Pending> & Pick<Pending, 'actor' | 'action'>): Pending {
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
