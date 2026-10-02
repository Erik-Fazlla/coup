import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  connectDatabaseEmulator,
  Database,
  getDatabase,
  ref,
  set,
} from 'firebase/database';
import { Game } from '../src/engine/types';
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
});
