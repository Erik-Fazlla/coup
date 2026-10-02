import {Rng} from './deck';
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
import {Card, Continuation, DeclareAction, Game, GameAction, IllegalActionError} from './types';

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
  return g.players[playerId].influence.map((inf, i) => (inf.revealed ? -1 : i)).filter(i => i >= 0);
}

function reveal(g: Game, playerId: string, cardIndex: number): void {
  const player = g.players[playerId];
  const influence = player.influence[cardIndex];
  if (!influence || influence.revealed) {
    fail('That card is not available');
  }
  influence.revealed = true;
  log(g, `${player.name} loses ${influence.card}`);
  if (unrevealedCount(player) === 0) {
    player.eliminatedAt = g.state.turnNumber;
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
  switch (pending.action) {
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
      const amount = Math.min(2, target.coins);
      target.coins -= amount;
      actor.coins += amount;
      log(g, `${actor.name} steals ${amount} from ${target.name}`);
      return endTurn(g);
    }
    case 'assassinate':
      return requireLoseInfluence(g, pending.target!, 'endTurn', rng);
    case 'exchange': {
      const drawn = g.deck.splice(0, 2);
      const hand = actor.influence.filter(i => !i.revealed).map(i => i.card);
      pending.exchangeOptions = [...hand, ...drawn];
      g.state.phase = 'exchange';
      return;
    }
    default:
      return endTurn(g);
  }
}

function runContinuation(g: Game, next: Continuation, rng: Rng): void {
  if (next === 'endTurn') {
    return endTurn(g);
  }
  if (next === 'resolveAction') {
    return resolveAction(g, rng);
  }
  // afterFailedChallenge: the claim was proven, but the target may still block.
  const pending = g.state.pending!;
  const targetMayBlock =
    BLOCK_CLAIMS[pending.action].length > 0 && pending.target !== null && isAlive(g, pending.target);
  if (targetMayBlock) {
    pending.challengeResolved = true;
    pending.responses = {};
    g.state.phase = 'awaitingResponses';
    return;
  }
  resolveAction(g, rng);
}

/** Makes a player lose one influence, asking them to choose when they still hold two. */
function requireLoseInfluence(g: Game, playerId: string, next: Continuation, rng: Rng): void {
  const hidden = hiddenIndexes(g, playerId);
  if (hidden.length === 0) {
    return runContinuation(g, next, rng);
  }
  if (hidden.length === 1) {
    reveal(g, playerId, hidden[0]);
    return runContinuation(g, next, rng);
  }
  g.state.pending!.loseInfluence = {playerId, next};
  g.state.phase = 'loseInfluence';
}

function declare(g: Game, action: DeclareAction, rng: Rng): void {
  const {type, playerId} = action;
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
  const target = 'target' in action ? action.target : null;
  if (TARGETED.includes(type) && (!target || target === playerId || !isAlive(g, target))) {
    fail('Choose a living opponent');
  }

  actor.coins -= ACTION_COST[type];
  g.state.lastAction = {playerId, action: type, target, blocked: false};

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
    return requireLoseInfluence(g, target!, 'endTurn', rng);
  }

  const onTarget = target ? ` on ${nameOf(g, target)}` : '';
  log(g, `${actor.name} declares ${type}${onTarget}`);
  g.state.phase = 'awaitingResponses';
}

function pass(g: Game, playerId: string, rng: Rng): void {
  if (!pendingResponders(g).includes(playerId)) {
    fail('You have nothing to respond to');
  }
  const pending = g.state.pending!;
  if (g.state.phase === 'awaitingBlockResponses') {
    const block = pending.block!;
    block.responses[playerId] = 'pass';
    if (pendingResponders(g).length === 0) {
      g.state.lastAction!.blocked = true;
      log(g, `${nameOf(g, block.blocker)} blocks with ${block.claim}`);
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
  g.state.pending!.block = {blocker: playerId, claim, responses: {}};
  g.state.phase = 'awaitingBlockResponses';
  log(g, `${nameOf(g, playerId)} claims ${claim} to block`);
}

/**
 * Applies one player action and returns the new game. Never mutates `game`.
 * Throws IllegalActionError when the action is not allowed in the current state.
 */
export function applyAction(game: Game, action: GameAction, rng: Rng = Math.random): Game {
  if (game.status !== 'playing') {
    fail('Game is not in progress');
  }
  if (!game.players[action.playerId]) {
    fail('You are not in this game');
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
      if (g.state.phase !== 'loseInfluence' || !waiting || waiting.playerId !== id) {
        fail('You do not need to lose a card');
      }
      reveal(g, id, action.cardIndex);
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
    default:
      fail('Unknown action');
  }
  return g;
}
