import { buildDeck, Rng, shuffle } from './deck';
import { Game, IllegalActionError, Player } from './types';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

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
  return {
    host: hostId,
    code,
    status: 'waiting',
    playerOrder: [hostId],
    players: { [hostId]: newPlayer(hostName) },
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
  };
}

export function addPlayer(game: Game, playerId: string, name: string): Game {
  if (game.players[playerId]) {
    return game;
  }
  if (game.status !== 'waiting') {
    throw new IllegalActionError('Game already started');
  }
  if (game.playerOrder.length >= MAX_PLAYERS) {
    throw new IllegalActionError('Game is full');
  }
  const next = clone(game);
  next.playerOrder.push(playerId);
  next.players[playerId] = newPlayer(name);
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
    currentTurnPlayer: next.playerOrder[0],
    turnNumber: 1,
    pending: null,
    lastAction: null,
    claimSeq: 0,
  };
  next.log = ['Game started'];
  return next;
}
