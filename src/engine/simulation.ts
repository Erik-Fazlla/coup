import { applyAction } from './actions';
import { Rng } from './deck';
import { addPlayer, newGame, startGame } from './lobby';
import {
  availableActions,
  FORCED_COUP_COINS,
  livingPlayers,
  pendingResponders,
  responseOptions,
  TARGETED,
  unrevealedCount,
} from './rules';
import { normalizeGame } from './serialize';
import { deepFreeze } from './testHelpers';
import { ActionType, Game, GameAction, Phase, TargetedAction } from './types';

/**
 * Test support: plays whole seeded random games and checks the rules after every single action.
 * Lives outside `__tests__` only because Jest treats every file in there as a test suite.
 */

export const TOTAL_CARDS = 15;
export const MAX_ACTIONS = 5000;
const NAMES = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** Park–Miller generator: the same seed always produces the same game. */
export function seeded(seed: number): Rng {
  let state = (seed % 2147483646) + 1;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** How willing a simulated player is to coup early, challenge and block. */
export interface Temperament {
  coupWhenOptional: number;
  challenge: number;
  block: number;
}

export const CAUTIOUS: Temperament = {
  coupWhenOptional: 0.1,
  challenge: 0.05,
  block: 0.2,
};
export const RECKLESS: Temperament = {
  coupWhenOptional: 0.6,
  challenge: 0.4,
  block: 0.5,
};

/** Chooses one legal move for whoever has to act. Never looks at hidden cards, so players bluff freely. */
export function chooseMove(
  game: Game,
  rng: Rng,
  mood: Temperament,
): GameAction {
  const { phase, pending, currentTurnPlayer, claimSeq } = game.state;

  if (phase === 'action') {
    const playerId = currentTurnPlayer;
    const actions = availableActions(game, playerId);
    const nonCoup = actions.filter(action => action !== 'coup');
    const type: ActionType =
      nonCoup.length === 0 ||
      (actions.includes('coup') && rng() < mood.coupWhenOptional)
        ? 'coup'
        : pick(nonCoup, rng);
    if (TARGETED.includes(type)) {
      const opponents = livingPlayers(game).filter(id => id !== playerId);
      return {
        type: type as TargetedAction,
        playerId,
        target: pick(opponents, rng),
      };
    }
    return { type, playerId } as GameAction;
  }

  if (phase === 'awaitingResponses' || phase === 'awaitingBlockResponses') {
    const playerId = pick(pendingResponders(game), rng);
    const options = responseOptions(game, playerId)!;
    if (options.canChallenge && rng() < mood.challenge) {
      return { type: 'challenge', playerId, seq: claimSeq };
    }
    if (options.blockClaims.length > 0 && rng() < mood.block) {
      return {
        type: 'block',
        playerId,
        claim: pick(options.blockClaims, rng),
        seq: claimSeq,
      };
    }
    return { type: 'pass', playerId, seq: claimSeq };
  }

  if (phase === 'loseInfluence') {
    const playerId = pending!.loseInfluence!.playerId;
    const hidden = game.players[playerId].influence
      .map((influence, index) => (influence.revealed ? -1 : index))
      .filter(index => index >= 0);
    return {
      type: 'loseInfluence',
      playerId,
      cardIndex: pick(hidden, rng),
    };
  }

  if (phase === 'exchange') {
    const playerId = pending!.actor;
    const keepCount = unrevealedCount(game.players[playerId]);
    const indexes = pending!.exchangeOptions!.map((_, index) => index);
    const keep: number[] = [];
    while (keep.length < keepCount) {
      keep.push(indexes.splice(Math.floor(rng() * indexes.length), 1)[0]);
    }
    return { type: 'exchangeChoose', playerId, keep };
  }

  throw new Error(`Nobody can act in phase "${phase}"`);
}

/** Mimics what Realtime Database does to a value: nulls, empty arrays and empty objects vanish. */
export function firebaseLike(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(firebaseLike);
    return items.length === 0 ? undefined : items;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      const converted = firebaseLike(child);
      if (converted !== undefined) {
        out[key] = converted;
      }
    });
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

/** Path of the first `undefined` inside the value, or null. The database refuses to store one. */
function findUndefined(value: unknown, path: string): string | null {
  if (value === undefined) {
    return path;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const found = findUndefined(child, `${path}.${key}`);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** JSON with object keys in a fixed order, so two equal values always give the same text. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, child) =>
    child !== null && typeof child === 'object' && !Array.isArray(child)
      ? Object.fromEntries(
          Object.entries(child).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : child,
  );
}

/** Rules that must hold after every single action. Returns a description of the first violation, or null. */
export function violation(before: Game, after: Game): string | null {
  const ids = after.playerOrder;
  const { phase, pending, currentTurnPlayer } = after.state;

  // Cards are never created or destroyed.
  const inHands = ids.reduce(
    (sum, id) => sum + after.players[id].influence.length,
    0,
  );
  const drawnForExchange =
    phase === 'exchange' && pending?.exchangeOptions
      ? pending.exchangeOptions.length -
        unrevealedCount(after.players[pending.actor])
      : 0;
  const total = after.deck.length + inHands + drawnForExchange;
  if (total !== TOTAL_CARDS) {
    return `card count is ${total}, expected ${TOTAL_CARDS}`;
  }

  for (const id of ids) {
    const player = after.players[id];
    if (player.influence.length !== 2) {
      return `${id} holds ${player.influence.length} cards`;
    }
    if (!Number.isInteger(player.coins) || player.coins < 0) {
      return `${id} has ${player.coins} coins`;
    }
    const out = unrevealedCount(player) === 0;
    if (out !== (player.eliminatedAt !== null)) {
      return `${id} eliminatedAt does not match their cards`;
    }
    // A lost card stays lost.
    const wasLost = before.players[id].influence.filter(i => i.revealed).length;
    const isLost = player.influence.filter(i => i.revealed).length;
    if (isLost < wasLost) {
      return `${id} regained a lost card`;
    }
  }

  if (after.state.turnNumber < before.state.turnNumber) {
    return 'turnNumber went backwards';
  }
  if (after.state.claimSeq < before.state.claimSeq) {
    return 'claimSeq went backwards';
  }

  // The elimination record is exactly the players who are out, in order, each blamed on someone else.
  const eliminated = ids.filter(id => after.players[id].eliminatedAt !== null);
  if (after.eliminations.length !== eliminated.length) {
    return `${after.eliminations.length} eliminations recorded for ${eliminated.length} eliminated players`;
  }
  for (let i = 0; i < after.eliminations.length; i++) {
    const entry = after.eliminations[i];
    if (
      i < before.eliminations.length &&
      canonical(before.eliminations[i]) !== canonical(entry)
    ) {
      return 'an earlier elimination was rewritten';
    }
    if (after.players[entry.playerId]?.eliminatedAt !== entry.turn) {
      return `elimination of ${entry.playerId} does not match their eliminatedAt`;
    }
    if (
      entry.by === null ||
      entry.by === entry.playerId ||
      !after.players[entry.by]
    ) {
      return `elimination of ${entry.playerId} is blamed on ${entry.by}`;
    }
    if (i > 0 && after.eliminations[i - 1].turn > entry.turn) {
      return 'eliminations are out of order';
    }
  }

  // Reveal ids only ever count up, and the visible reveal is always the latest one.
  if (after.revealSeq < before.revealSeq) {
    return 'revealSeq went backwards';
  }
  if (after.revealSeq > before.revealSeq + 1) {
    return 'more than one reveal in a single action';
  }
  if (
    after.reveal ? after.reveal.id !== after.revealSeq : after.revealSeq > 0
  ) {
    return 'reveal does not carry the latest reveal id';
  }

  // What is written to the database must come back unchanged, with nothing undefined in it.
  const hole = findUndefined(after, 'game');
  if (hole) {
    return `${hole} is undefined`;
  }
  if (canonical(normalizeGame(firebaseLike(after))) !== canonical(after)) {
    return 'the game does not survive a database round trip';
  }

  const living = livingPlayers(after);
  if (after.status === 'finished') {
    if (living.length !== 1 || after.winner !== living[0]) {
      return 'finished without exactly one living winner';
    }
    if (phase !== 'finished' || pending !== null) {
      return 'finished game still has a phase or pending action';
    }
    const expected = { ...before.scores };
    expected[after.winner] = (expected[after.winner] ?? 0) + 1;
    if (canonical(after.scores) !== canonical(expected)) {
      return 'the winner was not given exactly one win';
    }
    return null;
  }

  if (after.status !== 'playing') {
    return `unexpected status ${after.status}`;
  }
  if (living.length < 2) {
    return 'game still playing with fewer than two living players';
  }
  if (after.winner !== null) {
    return 'winner set while still playing';
  }
  if (canonical(after.scores) !== canonical(before.scores)) {
    return 'scores changed while still playing';
  }

  // Exactly the right people can act: never nobody (a stuck game).
  if (phase === 'action') {
    if (!living.includes(currentTurnPlayer)) {
      return 'an eliminated player has the turn';
    }
    const actions = availableActions(after, currentTurnPlayer);
    if (actions.length === 0) {
      return 'current player has no available action';
    }
    const coins = after.players[currentTurnPlayer].coins;
    if (
      coins >= FORCED_COUP_COINS &&
      (actions.length !== 1 || actions[0] !== 'coup')
    ) {
      return 'coup not forced at 10 or more coins';
    }
    if (pending !== null) {
      return 'pending action left over in action phase';
    }
  } else if (
    phase === 'awaitingResponses' ||
    phase === 'awaitingBlockResponses'
  ) {
    if (pendingResponders(after).length === 0) {
      return `nobody is asked to respond in ${phase}`;
    }
  } else if (phase === 'loseInfluence') {
    const loser = pending?.loseInfluence?.playerId;
    if (!loser || unrevealedCount(after.players[loser]) !== 2) {
      return 'loseInfluence phase without a player who has a choice';
    }
  } else if (phase === 'exchange') {
    if (!pending?.exchangeOptions || !living.includes(pending.actor)) {
      return 'exchange phase without options or a living actor';
    }
  } else {
    return `unexpected phase ${phase} while playing`;
  }
  return null;
}

/** Identifies what the game is waiting for; a skip must always change it. */
function waitKey(game: Game): string {
  const { phase, turnNumber, claimSeq, pending } = game.state;
  return JSON.stringify([
    game.status,
    phase,
    turnNumber,
    claimSeq,
    pendingResponders(game),
    pending?.loseInfluence?.playerId ?? null,
  ]);
}

export interface SimulationOptions {
  /** Number of players, 2 to 6. */
  players?: number;
  /** Chance that the host skips whoever the game is waiting on instead of them acting. */
  skipChance?: number;
}

export interface SimulationResult {
  actions: number;
  /** How many host skips were made in each phase. */
  skips: Partial<Record<Phase, number>>;
  winner: string;
  end: Game;
}

/** Plays one seeded game to the end, checking every rule after every action. Throws on the first problem. */
export function simulateGame(
  seed: number,
  mood: Temperament,
  options: SimulationOptions = {},
): SimulationResult {
  const playerCount = options.players ?? 2;
  const skipChance = options.skipChance ?? 0;
  const rng = seeded(seed);
  let lobby = newGame('p1', NAMES[0], 'SIMUL', 0);
  for (let i = 1; i < playerCount; i++) {
    lobby = addPlayer(lobby, `p${i + 1}`, NAMES[i]);
  }
  let game = startGame(lobby, 'p1', rng);
  const history: string[] = [];
  const skips: Partial<Record<Phase, number>> = {};

  for (let count = 0; count < MAX_ACTIONS; count++) {
    if (game.status === 'finished') {
      return { actions: count, skips, winner: game.winner!, end: game };
    }
    const before = deepFreeze(game);
    const move: GameAction =
      skipChance > 0 && rng() < skipChance
        ? { type: 'skip', playerId: before.host }
        : chooseMove(before, rng, mood);
    history.push(JSON.stringify(move));
    let problem: string | null;
    try {
      game = applyAction(before, move, rng);
      problem = violation(before, game);
      if (!problem && move.type === 'skip') {
        const phase = before.state.phase;
        skips[phase] = (skips[phase] ?? 0) + 1;
        if (waitKey(before) === waitKey(game)) {
          problem = `a skip in ${phase} left the game waiting for the same thing`;
        }
      }
    } catch (error) {
      problem = `engine rejected a legal move: ${(error as Error).message}`;
    }
    if (problem) {
      throw new Error(
        `seed ${seed}, ${playerCount} players, action ${
          count + 1
        }: ${problem}\n` + history.slice(-12).join('\n'),
      );
    }
  }
  throw new Error(
    `seed ${seed}, ${playerCount} players: no winner after ${MAX_ACTIONS} actions\n` +
      history.slice(-12).join('\n'),
  );
}
