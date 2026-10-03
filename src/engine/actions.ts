import { Rng, shuffle } from './deck';
import {
  ACTION_CLAIM,
  ACTION_COST,
  BLOCK_CLAIMS,
  FORCED_COUP_COINS,
  TARGETED,
  isAlive,
  livingPlayers,
  pendingResponders,
  responseOptions,
  unrevealedCount,
} from './rules';
import {
  Card,
  Continuation,
  DeclareAction,
  Game,
  GameAction,
  IllegalActionError,
  Reveal,
} from './types';

const MAX_LOG = 30;

function fail(message: string): never {
  throw new IllegalActionError(message);
}

function clone(game: Game): Game {
  return JSON.parse(JSON.stringify(game));
}

function nameOf(g: Game, playerId: string): string {
  return g.players[playerId].name;
}

function log(g: Game, message: string): void {
  g.log = [...g.log, message].slice(-MAX_LOG);
}

function hiddenIndexes(g: Game, playerId: string): number[] {
  return g.players[playerId].influence
    .map((inf, i) => (inf.revealed ? -1 : i))
    .filter(i => i >= 0);
}

/** Turns one of the player's hidden cards face up. `by` is the player whose action or challenge took it. */
function loseCard(
  g: Game,
  playerId: string,
  cardIndex: number,
  by: string | null,
): void {
  const player = g.players[playerId];
  const influence = player.influence[cardIndex];
  if (!influence || influence.revealed) {
    fail('That card is not available');
  }
  influence.revealed = true;
  log(g, `${player.name} loses ${influence.card}`);
  if (unrevealedCount(player) === 0) {
    player.eliminatedAt = g.state.turnNumber;
    g.eliminations.push({ playerId, by, turn: g.state.turnNumber });
    log(g, `${player.name} is eliminated`);
  }
}

function endTurn(g: Game): void {
  g.state.pending = null;
  const living = livingPlayers(g);
  if (living.length === 1) {
    g.status = 'finished';
    g.state.phase = 'finished';
    g.winner = living[0];
    g.scores[living[0]] = (g.scores[living[0]] ?? 0) + 1;
    log(g, `${nameOf(g, living[0])} wins`);
    return;
  }
  const order = g.playerOrder;
  let index = order.indexOf(g.state.currentTurnPlayer);
  do {
    index = (index + 1) % order.length;
  } while (!isAlive(g, order[index]));
  g.state.currentTurnPlayer = order[index];
  g.state.turnNumber += 1;
  g.state.phase = 'action';
}

/** Carries out the declared action once nobody can stop it any more. */
function resolveAction(g: Game, rng: Rng): void {
  const pending = g.state.pending!;
  const actor = g.players[pending.actor];
  const action = pending.action;
  switch (action) {
    case 'foreignAid':
      actor.coins += 2;
      log(g, `${actor.name} takes foreign aid`);
      return endTurn(g);
    case 'tax':
      actor.coins += 3;
      log(g, `${actor.name} collects tax`);
      return endTurn(g);
    case 'steal': {
      const target = g.players[pending.target!];
      const amount = isAlive(g, pending.target!)
        ? Math.min(2, target.coins)
        : 0;
      target.coins -= amount;
      actor.coins += amount;
      log(g, `${actor.name} steals ${amount} from ${target.name}`);
      return endTurn(g);
    }
    case 'assassinate':
      return requireLoseInfluence(
        g,
        pending.target!,
        'endTurn',
        rng,
        pending.actor,
      );
    case 'exchange': {
      const drawn = g.deck.splice(0, 2);
      const hand = actor.influence.filter(i => !i.revealed).map(i => i.card);
      pending.exchangeOptions = [...hand, ...drawn];
      g.state.phase = 'exchange';
      return;
    }
    // Income and Coup finish inside `declare` and never become pending responses.
    case 'income':
    case 'coup':
      return endTurn(g);
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

function runContinuation(g: Game, next: Continuation, rng: Rng): void {
  if (livingPlayers(g).length === 1) {
    return endTurn(g);
  }
  switch (next) {
    case 'endTurn':
      return endTurn(g);
    case 'resolveAction':
      return resolveAction(g, rng);
    case 'afterFailedBlock': {
      // The block was a bluff: whoever had not yet answered the action still gets their say.
      g.state.phase = 'awaitingResponses';
      if (pendingResponders(g).length > 0) {
        g.state.claimSeq += 1;
        return;
      }
      return resolveAction(g, rng);
    }
    case 'afterFailedChallenge': {
      // The claim was proven, but the target may still block.
      const pending = g.state.pending!;
      const targetMayBlock =
        BLOCK_CLAIMS[pending.action].length > 0 &&
        pending.target !== null &&
        isAlive(g, pending.target);
      if (targetMayBlock) {
        pending.challengeResolved = true;
        pending.responses = {};
        g.state.phase = 'awaitingResponses';
        g.state.claimSeq += 1;
        return;
      }
      return resolveAction(g, rng);
    }
    default: {
      const unreachable: never = next;
      return unreachable;
    }
  }
}

/**
 * Makes a player lose one influence, asking them to choose when they still hold two.
 * `by` is the player responsible. It only matters when the card is the player's last one, and that
 * is never a choice, so it does not have to be remembered while a choice is pending.
 */
function requireLoseInfluence(
  g: Game,
  playerId: string,
  next: Continuation,
  rng: Rng,
  by: string,
): void {
  const hidden = hiddenIndexes(g, playerId);
  if (hidden.length === 0) {
    return runContinuation(g, next, rng);
  }
  if (hidden.length === 1) {
    loseCard(g, playerId, hidden[0], by);
    return runContinuation(g, next, rng);
  }
  g.state.pending!.loseInfluence = { playerId, next };
  g.state.phase = 'loseInfluence';
}

function declare(g: Game, action: DeclareAction, rng: Rng): void {
  const { type, playerId } = action;
  if (g.state.phase !== 'action' || g.state.currentTurnPlayer !== playerId) {
    fail('It is not your turn');
  }
  const actor = g.players[playerId];
  if (actor.coins >= FORCED_COUP_COINS && type !== 'coup') {
    fail('You must Coup with 10 or more coins');
  }
  if (actor.coins < ACTION_COST[type]) {
    fail('Not enough coins');
  }
  const target =
    TARGETED.includes(type) && 'target' in action ? action.target : null;
  if (
    TARGETED.includes(type) &&
    (!target || target === playerId || !isAlive(g, target))
  ) {
    fail('Choose a living opponent');
  }

  actor.coins -= ACTION_COST[type];
  g.state.lastAction = { playerId, action: type, target, blocked: false };

  if (type === 'income') {
    actor.coins += 1;
    log(g, `${actor.name} takes income`);
    return endTurn(g);
  }

  g.state.pending = {
    actor: playerId,
    action: type,
    target,
    claim: ACTION_CLAIM[type],
    responses: {},
    challengeResolved: false,
    block: null,
    loseInfluence: null,
    exchangeOptions: null,
  };

  if (type === 'coup') {
    log(g, `${actor.name} coups ${nameOf(g, target!)}`);
    return requireLoseInfluence(g, target!, 'endTurn', rng, playerId);
  }

  const onTarget = target ? ` on ${nameOf(g, target)}` : '';
  log(g, `${actor.name} declares ${type}${onTarget}`);
  g.state.phase = 'awaitingResponses';
  g.state.claimSeq += 1;
}

function pass(g: Game, playerId: string, rng: Rng): void {
  if (!pendingResponders(g).includes(playerId)) {
    fail('You have nothing to respond to');
  }
  const pending = g.state.pending!;
  if (g.state.phase === 'awaitingBlockResponses') {
    const activeBlock = pending.block!;
    activeBlock.responses[playerId] = 'pass';
    if (pendingResponders(g).length === 0) {
      g.state.lastAction!.blocked = true;
      log(
        g,
        `${nameOf(g, activeBlock.blocker)} blocks with ${activeBlock.claim}`,
      );
      endTurn(g);
    }
    return;
  }
  pending.responses[playerId] = 'pass';
  if (pendingResponders(g).length === 0) {
    resolveAction(g, rng);
  }
}

function block(g: Game, playerId: string, claim: Card): void {
  const options = responseOptions(g, playerId);
  if (!options || !options.blockClaims.includes(claim)) {
    fail('You cannot block now');
  }
  g.state.pending!.block = { blocker: playerId, claim, responses: {} };
  g.state.phase = 'awaitingBlockResponses';
  g.state.claimSeq += 1;
  log(g, `${nameOf(g, playerId)} claims ${claim} to block`);
}

/** Index of a hidden copy of `card` in the player's hand, or -1. */
function hiddenCardIndex(g: Game, playerId: string, card: Card): number {
  return g.players[playerId].influence.findIndex(
    inf => !inf.revealed && inf.card === card,
  );
}

/** A proven card goes back into the deck and is replaced by a fresh draw. */
function swapProvenCard(
  g: Game,
  playerId: string,
  cardIndex: number,
  rng: Rng,
): void {
  const player = g.players[playerId];
  const deck = shuffle([...g.deck, player.influence[cardIndex].card], rng);
  player.influence[cardIndex] = { card: deck.shift()!, revealed: false };
  g.deck = deck;
}

/** Publishes how a challenge turned out, under an id that is never reused within this game id. */
function recordReveal(g: Game, outcome: Omit<Reveal, 'id'>): void {
  g.revealSeq += 1;
  g.reveal = { id: g.revealSeq, ...outcome };
}

function challenge(g: Game, challengerId: string, rng: Rng): void {
  const options = responseOptions(g, challengerId);
  if (!options || !options.canChallenge) {
    fail('You cannot challenge now');
  }
  const pending = g.state.pending!;
  const challenger = nameOf(g, challengerId);

  if (g.state.phase === 'awaitingBlockResponses') {
    const blockClaim = pending.block!;
    const blocker = nameOf(g, blockClaim.blocker);
    const index = hiddenCardIndex(g, blockClaim.blocker, blockClaim.claim);
    recordReveal(g, {
      challenger: challengerId,
      claimant: blockClaim.blocker,
      card: blockClaim.claim,
      truthful: index >= 0,
      block: true,
    });
    if (index >= 0) {
      log(
        g,
        `${challenger} challenges ${blocker}, who shows ${blockClaim.claim}`,
      );
      swapProvenCard(g, blockClaim.blocker, index, rng);
      g.state.lastAction!.blocked = true;
      return requireLoseInfluence(
        g,
        challengerId,
        'endTurn',
        rng,
        blockClaim.blocker,
      );
    }
    log(g, `${challenger} challenges ${blocker}, who was bluffing`);
    pending.block = null;
    pending.responses[blockClaim.blocker] = 'pass';
    return requireLoseInfluence(
      g,
      blockClaim.blocker,
      'afterFailedBlock',
      rng,
      challengerId,
    );
  }

  const claim = pending.claim!;
  const actor = nameOf(g, pending.actor);
  const index = hiddenCardIndex(g, pending.actor, claim);
  recordReveal(g, {
    challenger: challengerId,
    claimant: pending.actor,
    card: claim,
    truthful: index >= 0,
    block: false,
  });
  if (index >= 0) {
    log(g, `${challenger} challenges ${actor}, who shows ${claim}`);
    swapProvenCard(g, pending.actor, index, rng);
    return requireLoseInfluence(
      g,
      challengerId,
      'afterFailedChallenge',
      rng,
      pending.actor,
    );
  }
  log(g, `${challenger} challenges ${actor}, who was bluffing`);
  // The action never happened, so anything paid for it is returned.
  g.players[pending.actor].coins += ACTION_COST[pending.action];
  requireLoseInfluence(g, pending.actor, 'endTurn', rng, challengerId);
}

function exchangeChoose(
  g: Game,
  playerId: string,
  keep: number[],
  rng: Rng,
): void {
  const pending = g.state.pending;
  if (
    g.state.phase !== 'exchange' ||
    !pending ||
    pending.actor !== playerId ||
    !pending.exchangeOptions
  ) {
    fail('You are not exchanging cards');
  }
  const options = pending.exchangeOptions;
  const slots = hiddenIndexes(g, playerId);
  const valid =
    Array.isArray(keep) &&
    keep.length === slots.length &&
    new Set(keep).size === keep.length &&
    keep.every(i => Number.isInteger(i) && i >= 0 && i < options.length);
  if (!valid) {
    fail(`Choose exactly ${slots.length} card(s)`);
  }
  const actor = g.players[playerId];
  slots.forEach((slot, n) => {
    actor.influence[slot] = { card: options[keep[n]], revealed: false };
  });
  const returned = options.filter((_, i) => !keep.includes(i));
  g.deck = shuffle([...g.deck, ...returned], rng);
  log(g, `${actor.name} exchanges cards`);
  endTurn(g);
}

/**
 * Applies one player action and returns the new game. Never mutates `game`.
 * Throws IllegalActionError when the action is not allowed in the current state.
 * Expects a game produced by `normalizeGame` or by the engine itself.
 * `rng` is required so every shuffle is injected and tests stay deterministic.
 */
export function applyAction(game: Game, action: GameAction, rng: Rng): Game {
  if (game.status !== 'playing') {
    fail('Game is not in progress');
  }
  if (!game.players[action.playerId]) {
    fail('You are not in this game');
  }
  if (
    (action.type === 'pass' ||
      action.type === 'challenge' ||
      action.type === 'block') &&
    action.seq !== game.state.claimSeq
  ) {
    fail('Too late: the game has moved on');
  }
  const g = clone(game);
  const id = action.playerId;

  switch (action.type) {
    case 'income':
    case 'foreignAid':
    case 'tax':
    case 'exchange':
    case 'coup':
    case 'assassinate':
    case 'steal':
      declare(g, action, rng);
      break;
    case 'loseInfluence': {
      const waiting = g.state.pending?.loseInfluence;
      if (
        g.state.phase !== 'loseInfluence' ||
        !waiting ||
        waiting.playerId !== id
      ) {
        fail('You do not need to lose a card');
      }
      // A choice is only offered with two hidden cards, so this is never an elimination.
      loseCard(g, id, action.cardIndex, null);
      g.state.pending!.loseInfluence = null;
      runContinuation(g, waiting.next, rng);
      break;
    }
    case 'pass':
      pass(g, id, rng);
      break;
    case 'block':
      block(g, id, action.claim);
      break;
    case 'challenge':
      challenge(g, id, rng);
      break;
    case 'exchangeChoose':
      exchangeChoose(g, id, action.keep, rng);
      break;
    default:
      fail('Unknown action');
  }
  return g;
}
