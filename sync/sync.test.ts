import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  connectDatabaseEmulator,
  Database,
  getDatabase,
  ref,
  set,
} from 'firebase/database';
import { Game, GameAction } from '../src/engine/types';
import { createGameService, GameService } from '../src/firebase/gameService';

const apps: FirebaseApp[] = [];

function client(name: string): { service: GameService; db: Database } {
  const app = initializeApp(
    {
      projectId: 'demo-coup',
      databaseURL: 'http://127.0.0.1:9000?ns=demo-coup-default-rtdb',
    },
    name,
  );
  apps.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return { service: createGameService(db), db };
}

/** Resolves with the first snapshot of the game that satisfies `predicate`. */
function seen(
  service: GameService,
  gameId: string,
  predicate: (game: Game) => boolean,
): Promise<Game> {
  return new Promise((resolve, reject) => {
    let done = false;
    let unsubscribe = () => {};
    const timer = setTimeout(() => {
      done = true;
      unsubscribe();
      reject(new Error('Timed out waiting for game state'));
    }, 10000);
    unsubscribe = service.subscribe(
      gameId,
      game => {
        if (!done && game && predicate(game)) {
          done = true;
          clearTimeout(timer);
          setTimeout(unsubscribe, 0);
          resolve(game);
        }
      },
      reject,
    );
  });
}

const host = client('host');
const second = client('second');
const third = client('third');
const everyone = [host, second, third];

let gameId = '';
let code = '';

afterAll(async () => {
  await Promise.all(apps.map(app => deleteApp(app)));
});

describe('multiplayer sync', () => {
  it('syncs the lobby and the start to every client', async () => {
    gameId = await host.service.createGame('h', 'Host');
    code = (await seen(host.service, gameId, () => true)).code;
    expect(code).toMatch(/^[A-Z0-9]{5}$/);

    expect(
      await second.service.joinGame(code.toLowerCase(), 'p2', 'Second'),
    ).toBe(gameId);
    expect(await third.service.joinGame(` ${code} `, 'p3', 'Third')).toBe(
      gameId,
    );

    const lobbies = await Promise.all(
      everyone.map(c =>
        seen(c.service, gameId, g => g.playerOrder.length === 3),
      ),
    );
    lobbies.forEach(lobby =>
      expect(lobby.playerOrder).toEqual(['h', 'p2', 'p3']),
    );

    await host.service.startGame(gameId, 'h');
    const started = await Promise.all(
      everyone.map(c => seen(c.service, gameId, g => g.status === 'playing')),
    );
    started.forEach(game => {
      expect(game.state.currentTurnPlayer).toBe('h');
      expect(game.players.p3.influence).toHaveLength(2);
      expect(game.deck).toHaveLength(9);
    });
  });

  it('broadcasts an action to every client', async () => {
    await host.service.dispatch(gameId, { type: 'income', playerId: 'h' });
    const games = await Promise.all(
      everyone.map(c =>
        seen(c.service, gameId, g => g.state.currentTurnPlayer === 'p2'),
      ),
    );
    games.forEach(game => expect(game.players.h.coins).toBe(3));
  });

  it('rejects an out-of-turn action without changing the game', async () => {
    await expect(
      third.service.dispatch(gameId, { type: 'income', playerId: 'p3' }),
    ).rejects.toThrow('It is not your turn');
    const game = await seen(host.service, gameId, () => true);
    expect(game.players.p3.coins).toBe(2);
    expect(game.state.currentTurnPlayer).toBe('p2');
  });

  it('keeps both responses when two clients respond at the same moment', async () => {
    await second.service.dispatch(gameId, {
      type: 'foreignAid',
      playerId: 'p2',
    });
    const asked = await Promise.all(
      everyone.map(c =>
        seen(c.service, gameId, g => g.state.phase === 'awaitingResponses'),
      ),
    );
    const seq = asked[0].state.claimSeq;

    await Promise.all([
      host.service.dispatch(gameId, { type: 'pass', playerId: 'h', seq }),
      third.service.dispatch(gameId, { type: 'pass', playerId: 'p3', seq }),
    ]);

    const games = await Promise.all(
      everyone.map(c =>
        seen(c.service, gameId, g => g.state.currentTurnPlayer === 'p3'),
      ),
    );
    games.forEach(game => expect(game.players.p2.coins).toBe(4));
  });

  it('rejects joining a started game, a full-of-typos code and an unknown code', async () => {
    const late = client('late');
    await expect(late.service.joinGame(code, 'p9', 'Late')).rejects.toThrow(
      'Game already started',
    );
    await expect(late.service.joinGame('ZZZZZ', 'p9', 'Late')).rejects.toThrow(
      'No game found with that code',
    );
    await expect(late.service.joinGame('a.b#c', 'p9', 'Late')).rejects.toThrow(
      'No game found with that code',
    );
  });

  it('lets a non-host leave the lobby', async () => {
    const lobbyId = await host.service.createGame('h', 'Host');
    const lobbyCode = (await seen(host.service, lobbyId, () => true)).code;
    await second.service.joinGame(lobbyCode, 'p2', 'Second');
    await second.service.leaveLobby(lobbyId, 'p2');
    const lobby = await seen(
      host.service,
      lobbyId,
      g => g.playerOrder.length === 1,
    );
    expect(lobby.playerOrder).toEqual(['h']);
  });

  it('lets the host cancel a waiting lobby for everyone', async () => {
    const lobbyId = await host.service.createGame('h', 'Host');
    const lobbyCode = (await seen(host.service, lobbyId, () => true)).code;
    await second.service.joinGame(lobbyCode, 'p2', 'Second');
    await seen(second.service, lobbyId, g => g.playerOrder.length === 2);

    const gone = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Timed out waiting for cancel')),
        10000,
      );
      const unsubscribe = second.service.subscribe(
        lobbyId,
        g => {
          if (g === null) {
            clearTimeout(timer);
            setTimeout(unsubscribe, 0);
            resolve();
          }
        },
        reject,
      );
    });
    await expect(
      host.service.cancelLobby(lobbyId, 'h'),
    ).resolves.toBeUndefined();
    await gone;
  });

  it('does not cancel a lobby for a non-host or a started game', async () => {
    const lobbyId = await host.service.createGame('h', 'Host');
    const lobbyCode = (await seen(host.service, lobbyId, () => true)).code;
    await second.service.joinGame(lobbyCode, 'p2', 'Second');

    await second.service.cancelLobby(lobbyId, 'p2');
    const stillThere = await seen(host.service, lobbyId, () => true);
    expect(stillThere.playerOrder).toEqual(['h', 'p2']);

    await host.service.startGame(lobbyId, 'h');
    await host.service.cancelLobby(lobbyId, 'h');
    const started = await seen(host.service, lobbyId, () => true);
    expect(started.status).toBe('playing');
  });
});

/** Creates a lobby with all three clients in it and returns its id and code. */
async function threePlayerLobby(): Promise<{ id: string; lobbyCode: string }> {
  const id = await host.service.createGame('h', 'Host');
  const lobbyCode = (await seen(host.service, id, () => true)).code;
  await second.service.joinGame(lobbyCode, 'p2', 'Second');
  await third.service.joinGame(lobbyCode, 'p3', 'Third');
  await Promise.all(
    everyone.map(c => seen(c.service, id, g => g.playerOrder.length === 3)),
  );
  return { id, lobbyCode };
}

/** A skip stamped with what the host currently sees, as the app sends it. */
function skipOf(game: Game, playerId: string): GameAction {
  return {
    type: 'skip',
    playerId,
    turn: game.state.turnNumber,
    seq: game.state.claimSeq,
    phase: game.state.phase,
  };
}

/** Changes whenever the game starts waiting for something else. */
function waitKey(game: Game): string {
  const { phase, turnNumber, claimSeq, pending } = game.state;
  return JSON.stringify([
    game.status,
    phase,
    turnNumber,
    claimSeq,
    pending?.loseInfluence?.playerId ?? null,
  ]);
}

describe('host skip', () => {
  let skipId = '';

  it('advances a waiting game for every client', async () => {
    skipId = (await threePlayerLobby()).id;
    await host.service.startGame(skipId, 'h');
    await host.service.dispatch(skipId, { type: 'income', playerId: 'h' });
    const waiting = await seen(
      host.service,
      skipId,
      g => g.state.currentTurnPlayer === 'p2',
    );

    // The table is waiting for Second; the host moves it on.
    await host.service.dispatch(skipId, skipOf(waiting, 'h'));
    const games = await Promise.all(
      everyone.map(c =>
        seen(c.service, skipId, g => g.state.currentTurnPlayer === 'p3'),
      ),
    );
    games.forEach(game => {
      expect(game.players.p2.coins).toBe(3);
      expect(game.state.turnNumber).toBe(3);
      expect(game.log).toContain('Host skipped Second');
    });
  });

  it('passes for everyone who has not answered a claim', async () => {
    await third.service.dispatch(skipId, { type: 'tax', playerId: 'p3' });
    const asked = await seen(
      host.service,
      skipId,
      g => g.state.phase === 'awaitingResponses',
    );
    await host.service.dispatch(skipId, skipOf(asked, 'h'));
    const games = await Promise.all(
      everyone.map(c =>
        seen(c.service, skipId, g => g.state.currentTurnPlayer === 'h'),
      ),
    );
    games.forEach(game => {
      expect(game.players.p3.coins).toBe(5);
      expect(game.log).toContain('Host skipped Host, Second');
    });
  });

  it('rejects a skip from a player who is not the host', async () => {
    const before = await seen(host.service, skipId, () => true);
    await expect(
      second.service.dispatch(skipId, skipOf(before, 'p2')),
    ).rejects.toThrow('Only the host can skip');
    const after = await seen(host.service, skipId, () => true);
    expect(after).toEqual(before);
  });

  it('rejects a skip stamped with a wait the game has already left', async () => {
    const before = await seen(host.service, skipId, () => true);
    const stale = skipOf(before, 'h');
    // Someone acts first, so the game is waiting for something else when the skip arrives.
    await host.service.dispatch(skipId, {
      type: 'income',
      playerId: before.state.currentTurnPlayer,
    });
    const moved = await seen(
      host.service,
      skipId,
      g => g.state.turnNumber > before.state.turnNumber,
    );
    await expect(host.service.dispatch(skipId, stale)).rejects.toThrow(
      'Too late: the game has moved on',
    );
    const after = await seen(host.service, skipId, () => true);
    expect(after).toEqual(moved);
  });
});

describe('kicking a player', () => {
  it('removes them for every client and refuses their rejoin by code', async () => {
    const { id, lobbyCode } = await threePlayerLobby();

    await expect(third.service.kickPlayer(id, 'p3', 'p2')).rejects.toThrow(
      'Only the host can remove players',
    );

    await host.service.kickPlayer(id, 'h', 'p2');
    // The kicked player's own subscription shows them gone.
    const lobbies = await Promise.all(
      everyone.map(c => seen(c.service, id, g => g.playerOrder.length === 2)),
    );
    lobbies.forEach(lobby => {
      expect(lobby.playerOrder).toEqual(['h', 'p3']);
      expect(lobby.players.p2).toBeUndefined();
      expect(lobby.kicked).toEqual({ p2: true });
      expect(lobby.status).toBe('waiting');
    });

    await expect(
      second.service.joinGame(lobbyCode, 'p2', 'Second'),
    ).rejects.toThrow('The host removed you from this game');
    await expect(
      second.service.joinGame(lobbyCode, 'p2', 'Other name'),
    ).rejects.toThrow('The host removed you from this game');
    const still = await seen(host.service, id, () => true);
    expect(still.playerOrder).toEqual(['h', 'p3']);

    // The game goes on without them.
    await host.service.startGame(id, 'h');
    const started = await seen(third.service, id, g => g.status === 'playing');
    expect(started.playerOrder).toEqual(['h', 'p3']);
    expect(started.kicked).toEqual({ p2: true });
  });
});

describe('rematch', () => {
  it('returns every client to the lobby in round 2 with the scores kept', async () => {
    const { id, lobbyCode } = await threePlayerLobby();
    await host.service.startGame(id, 'h');
    let game = await seen(host.service, id, g => g.status === 'playing');
    expect(game.round).toBe(1);

    // Play the round out with host skips: only Income and forced Coups happen, so it always ends.
    for (let step = 0; game.status === 'playing'; step++) {
      expect(step).toBeLessThan(400);
      const key = waitKey(game);
      await host.service.dispatch(id, skipOf(game, 'h'));
      game = await seen(host.service, id, g => waitKey(g) !== key);
    }

    const finished = await Promise.all(
      everyone.map(c => seen(c.service, id, g => g.status === 'finished')),
    );
    const winner = finished[0].winner!;
    finished.forEach(end => {
      expect(end.winner).toBe(winner);
      expect(end.scores).toEqual({ [winner]: 1 });
      expect(end.eliminations).toHaveLength(2);
      end.eliminations.forEach(entry => expect(entry.by).not.toBeNull());
      expect(end.round).toBe(1);
    });

    await expect(second.service.rematch(id, 'p2')).rejects.toThrow(
      'Only the host can start a new round',
    );

    await host.service.rematch(id, 'h');
    const lobbies = await Promise.all(
      everyone.map(c => seen(c.service, id, g => g.status === 'waiting')),
    );
    lobbies.forEach(lobby => {
      expect(lobby.round).toBe(2);
      expect(lobby.scores).toEqual({ [winner]: 1 });
      expect(lobby.code).toBe(lobbyCode);
      expect(lobby.playerOrder).toEqual(['h', 'p2', 'p3']);
      expect(lobby.winner).toBeNull();
      expect(lobby.eliminations).toEqual([]);
      expect(lobby.reveal).toBeNull();
      expect(lobby.log).toEqual([]);
      expect(lobby.deck).toEqual([]);
      expect(lobby.state.claimSeq).toBe(finished[0].state.claimSeq);
      ['h', 'p2', 'p3'].forEach(playerId =>
        expect(lobby.players[playerId]).toMatchObject({
          coins: 2,
          influence: [],
          eliminatedAt: null,
        }),
      );
    });

    await expect(host.service.rematch(id, 'h')).rejects.toThrow(
      'The game is not finished',
    );

    // The same lobby starts a second round for everyone.
    await host.service.startGame(id, 'h');
    const second2 = await Promise.all(
      everyone.map(c => seen(c.service, id, g => g.status === 'playing')),
    );
    second2.forEach(next => {
      expect(next.round).toBe(2);
      expect(next.scores).toEqual({ [winner]: 1 });
      expect(next.deck).toHaveLength(9);
      expect(next.players.p3.influence).toHaveLength(2);
    });
  }, 60000);

  it('publishes a challenge reveal to every client', async () => {
    const { id } = await threePlayerLobby();
    await host.service.startGame(id, 'h');
    await host.service.dispatch(id, { type: 'tax', playerId: 'h' });
    const asked = await seen(
      second.service,
      id,
      g => g.state.phase === 'awaitingResponses',
    );
    await second.service.dispatch(id, {
      type: 'challenge',
      playerId: 'p2',
      seq: asked.state.claimSeq,
    });
    const games = await Promise.all(
      everyone.map(c => seen(c.service, id, g => g.reveal !== null)),
    );
    const heldDuke = asked.players.h.influence.some(i => i.card === 'Duke');
    games.forEach(game =>
      expect(game.reveal).toEqual({
        id: 1,
        challenger: 'p2',
        claimant: 'h',
        card: 'Duke',
        truthful: heldDuke,
        block: false,
      }),
    );
  });
});

describe('security rules', () => {
  it('blocks writes outside the known paths', async () => {
    await expect(set(ref(host.db, 'anything/else'), 1)).rejects.toThrow();
  });

  it('does not let an existing join code be overwritten', async () => {
    await expect(
      set(ref(second.db, `codes/${code}`), 'hijacked'),
    ).rejects.toThrow();
  });

  it('rejects a malformed game', async () => {
    await expect(
      set(ref(host.db, 'games/bad'), { host: 'h' }),
    ).rejects.toThrow();
  });

  it('rejects a game with an unknown status', async () => {
    await expect(
      set(ref(host.db, 'games/bogus'), {
        host: 'h',
        code: 'ABCDE',
        status: 'bogus',
        playerOrder: ['h'],
        players: { h: { name: 'Host', coins: 2 } },
        state: { phase: 'action' },
      }),
    ).rejects.toThrow();
  });
});
