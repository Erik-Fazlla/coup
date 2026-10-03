import { buildDeck, Rng, shuffle } from './deck';
import { Game, IllegalActionError, Player } from './types';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const MAX_NAME_LENGTH = 16;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

/** Trims the name and checks it is 1 to MAX_NAME_LENGTH characters. */
function cleanName(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
    throw new IllegalActionError(
      `Enter a name (1-${MAX_NAME_LENGTH} characters)`,
    );
  }
  return trimmed;
}

function newPlayer(name: string): Player {
  return { name, coins: 2, influence: [], eliminatedAt: null };
}

function clone(game: Game): Game {
  return JSON.parse(JSON.stringify(game));
}

export function generateCode(rng: Rng): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

export function newGame(
  hostId: string,
  hostName: string,
  code: string,
  now: number,
): Game {
  const name = cleanName(hostName);
  return {
    host: hostId,
    code,
    status: 'waiting',
    playerOrder: [hostId],
    players: { [hostId]: newPlayer(name) },
    deck: [],
    state: {
      phase: 'action',
      currentTurnPlayer: hostId,
      turnNumber: 0,
      pending: null,
      lastAction: null,
      claimSeq: 0,
    },
    log: [],
    winner: null,
    createdAt: now,
    round: 1,
    scores: {},
    eliminations: [],
    reveal: null,
    revealSeq: 0,
    kicked: {},
  };
}

export function addPlayer(game: Game, playerId: string, name: string): Game {
  if (game.players[playerId]) {
    return game;
  }
  if (game.kicked[playerId]) {
    throw new IllegalActionError('The host removed you from this game');
  }
  const cleaned = cleanName(name);
  if (game.status !== 'waiting') {
    throw new IllegalActionError('Game already started');
  }
  const taken = cleaned.toLowerCase();
  if (
    Object.values(game.players).some(
      player => player.name.trim().toLowerCase() === taken,
    )
  ) {
    throw new IllegalActionError('That name is already taken in this game');
  }
  if (game.playerOrder.length >= MAX_PLAYERS) {
    throw new IllegalActionError('Game is full');
  }
  const next = clone(game);
  next.playerOrder.push(playerId);
  next.players[playerId] = newPlayer(cleaned);
  return next;
}

export function removePlayer(game: Game, playerId: string): Game {
  if (
    game.status !== 'waiting' ||
    playerId === game.host ||
    !game.players[playerId]
  ) {
    return game;
  }
  const next = clone(game);
  next.playerOrder = next.playerOrder.filter(id => id !== playerId);
  delete next.players[playerId];
  return next;
}

/** The host removes a player from the lobby. That player cannot join this game again. */
export function kickPlayer(game: Game, hostId: string, targetId: string): Game {
  if (hostId !== game.host) {
    throw new IllegalActionError('Only the host can remove players');
  }
  if (game.status !== 'waiting') {
    throw new IllegalActionError('Players can only be removed in the lobby');
  }
  if (targetId === game.host) {
    throw new IllegalActionError('The host cannot be removed');
  }
  if (!game.players[targetId]) {
    throw new IllegalActionError('That player is not in this game');
  }
  const next = clone(game);
  next.playerOrder = next.playerOrder.filter(id => id !== targetId);
  delete next.players[targetId];
  delete next.scores[targetId];
  next.kicked[targetId] = true;
  return next;
}

export function startGame(game: Game, playerId: string, rng: Rng): Game {
  if (game.status !== 'waiting') {
    throw new IllegalActionError('Game already started');
  }
  if (playerId !== game.host) {
    throw new IllegalActionError('Only the host can start the game');
  }
  if (game.playerOrder.length < MIN_PLAYERS) {
    throw new IllegalActionError(`Need at least ${MIN_PLAYERS} players`);
  }
  const next = clone(game);
  const deck = shuffle(buildDeck(), rng);
  next.playerOrder.forEach(id => {
    next.players[id].coins = 2;
    next.players[id].eliminatedAt = null;
    next.players[id].influence = [
      { card: deck.shift()!, revealed: false },
      { card: deck.shift()!, revealed: false },
    ];
  });
  next.deck = deck;
  next.status = 'playing';
  next.state = {
    phase: 'action',
    // The first turn moves one seat along each round (the host in round 1), wrapping round the table.
    currentTurnPlayer:
      next.playerOrder[(next.round - 1) % next.playerOrder.length],
    turnNumber: 1,
    pending: null,
    lastAction: null,
    // Kept rather than reset: after a rematch a tap from the previous round must never match again.
    claimSeq: next.state.claimSeq,
  };
  next.eliminations = [];
  next.reveal = null;
  next.log = ['Game started'];
  return next;
}

/**
 * Takes a finished game back to the lobby for another round with the same players.
 * Scores carry over; everything that belonged to the finished round is cleared.
 * `rng` is part of the signature so a future change (such as a random seating) needs no new plumbing.
 */
export function rematch(game: Game, playerId: string, _rng: Rng): Game {
  if (playerId !== game.host) {
    throw new IllegalActionError('Only the host can start a new round');
  }
  if (game.status !== 'finished') {
    throw new IllegalActionError('The game is not finished');
  }
  const next = clone(game);
  next.playerOrder.forEach(id => {
    next.players[id] = newPlayer(next.players[id].name);
  });
  next.status = 'waiting';
  next.deck = [];
  next.log = [];
  next.winner = null;
  next.eliminations = [];
  // `revealSeq` is left alone so the next round's reveals carry ids no client has seen before.
  next.reveal = null;
  next.round = game.round + 1;
  next.state = {
    phase: 'action',
    currentTurnPlayer: next.host,
    turnNumber: 0,
    pending: null,
    lastAction: null,
    claimSeq: game.state.claimSeq,
  };
  return next;
}
