# Coup Plan 2: Firebase Sync, UI and APK

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tested rules engine from Plan 1 into a playable Android app: Firebase Realtime Database sync, player profile, lobby, game board, signed release APK, README, private GitHub repo.

**Architecture:** `gameService` runs engine functions inside Firebase transactions on `/games/{gameId}`; every phone subscribes to that node. `profileStore` keeps the profile in AsyncStorage and mirrors it to `/profiles`. Two React contexts (`ProfileContext`, `GameContext`) expose state to screens. Screens are chosen from state (no navigation library): no profile → Welcome; no game → Home; `waiting` → Lobby; `playing` → Game; `finished` → Game Over.

**Tech Stack:** React Native CLI, TypeScript, Firebase JS SDK (`firebase`), `@react-native-async-storage/async-storage`, Jest, Firebase Emulator (`firebase-tools`, dev only).

**Spec:** `docs/specs/2026-10-02-coup-design.md`. **Prerequisite:** Plan 1 complete (`npx jest` green).

**Conventions for every task**
- Project root: `D:\Projects\Owned\Coup`. Run all commands from there (PowerShell).
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push without user confirmation (Task 11).
- Steps marked **USER GATE** need the user's answer or action before continuing.

## File map

| File | Responsibility |
|---|---|
| `src/util/id.ts` | `generateId` for player ids |
| `src/profile/profileStore.ts` | Local profile, stats, active game id; mirrors profile to remote |
| `src/firebase/config.ts` | Firebase web config (placeholders until the user pastes theirs) |
| `src/firebase/gameService.ts` | create / join / start / leave / dispatch / subscribe |
| `src/firebase/index.ts` | Lazily builds the app's `gameService` and `profileStore` |
| `database.rules.json`, `firebase.json` | Database security rules; emulator config |
| `sync/sync.test.ts`, `jest.sync.config.js` | Multi-client sync test against the emulator |
| `src/theme.ts` | Colours and spacing |
| `src/components/*` | `Screen`, `Button`, `CardView`, `PlayerSeat`, `GameLog`, `ConnectionBanner`, `ActionBar`, `ResponsePrompt`, `LoseInfluencePicker`, `ExchangePicker` |
| `src/context/ProfileContext.tsx`, `src/context/GameContext.tsx` | App state |
| `src/screens/*` | `SetupScreen`, `WelcomeScreen`, `HomeScreen`, `LobbyScreen`, `GameScreen`, `GameOverScreen` |
| `App.tsx` | Providers and state-based routing |
| `README.md` | Setup, Firebase, build instructions |

---

### Task 1: Dependencies, player id, profile store

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/util/id.ts`, `src/profile/profileStore.ts`
- Test: `src/util/__tests__/id.test.ts`, `src/profile/__tests__/profileStore.test.ts`

- [ ] **Step 1: Install dependencies**

```powershell
npm install firebase @react-native-async-storage/async-storage
npm install --save-dev firebase-tools
```

Expected: both finish without `ERR!`. `package.json` lists `firebase` and `@react-native-async-storage/async-storage` under `dependencies`, `firebase-tools` under `devDependencies`.

- [ ] **Step 2: Write the failing id test**

`src/util/__tests__/id.test.ts`:

```ts
import {generateId} from '../id';

describe('generateId', () => {
  it('is a database-safe key: p followed by 20 base-36 characters', () => {
    expect(generateId()).toMatch(/^p[0-9a-z]{20}$/);
  });

  it('is driven by the injected rng', () => {
    expect(generateId(() => 0)).toBe('p00000000000000000000');
  });

  it('differs between calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest id.test`
Expected: FAIL — `Cannot find module '../id'`

- [ ] **Step 4: Implement generateId**

`src/util/id.ts`:

```ts
/** Random id safe to use as a Realtime Database key. Identifies a device/player; not a secret. */
export function generateId(rng: () => number = Math.random): string {
  let id = 'p';
  for (let i = 0; i < 20; i++) {
    id += Math.floor(rng() * 36).toString(36);
  }
  return id;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx jest id.test`
Expected: PASS, 3 tests

- [ ] **Step 6: Write the failing profile store test**

`src/profile/__tests__/profileStore.test.ts`:

```ts
import {createProfileStore, Profile, winRate} from '../profileStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
}

function setup() {
  const saved: Array<{playerId: string; profile: Profile}> = [];
  const remoteSave = jest.fn(async (playerId: string, profile: Profile) => {
    saved.push({playerId, profile});
  });
  const store = createProfileStore(memoryStorage(), remoteSave, () => 0, () => 5000);
  return {store, saved, remoteSave};
}

describe('profile store', () => {
  it('generates the player id once and reuses it', async () => {
    const {store} = setup();
    const first = await store.getPlayerId();
    expect(first).toBe('p00000000000000000000');
    expect(await store.getPlayerId()).toBe(first);
  });

  it('has no profile before a name is set', async () => {
    expect(await setup().store.loadProfile()).toBeNull();
  });

  it('creates a profile with zeroed stats and mirrors it remotely', async () => {
    const {store, saved} = setup();
    const profile = await store.setName('Erik');
    expect(profile).toEqual({name: 'Erik', gamesPlayed: 0, wins: 0, createdAt: 5000});
    expect(await store.loadProfile()).toEqual(profile);
    expect(saved).toEqual([{playerId: 'p00000000000000000000', profile}]);
  });

  it('keeps stats when the name changes', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    expect(await store.setName('E')).toEqual({name: 'E', gamesPlayed: 1, wins: 1, createdAt: 5000});
  });

  it('records wins and losses', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    const profile = await store.recordResult('g2', false);
    expect(profile).toMatchObject({gamesPlayed: 2, wins: 1});
  });

  it('counts each game only once', async () => {
    const {store} = setup();
    await store.setName('Erik');
    await store.recordResult('g1', true);
    const profile = await store.recordResult('g1', true);
    expect(profile).toMatchObject({gamesPlayed: 1, wins: 1});
  });

  it('returns null when recording without a profile', async () => {
    expect(await setup().store.recordResult('g1', true)).toBeNull();
  });

  it('still saves locally when the remote save fails', async () => {
    const {store, remoteSave} = setup();
    remoteSave.mockRejectedValue(new Error('offline'));
    await store.setName('Erik');
    expect(await store.loadProfile()).toMatchObject({name: 'Erik'});
  });

  it('remembers and clears the active game id', async () => {
    const {store} = setup();
    expect(await store.getActiveGameId()).toBeNull();
    await store.setActiveGameId('game-1');
    expect(await store.getActiveGameId()).toBe('game-1');
    await store.setActiveGameId(null);
    expect(await store.getActiveGameId()).toBeNull();
  });
});

describe('winRate', () => {
  it('is 0 with no games and a rounded percentage otherwise', () => {
    expect(winRate({name: 'x', gamesPlayed: 0, wins: 0, createdAt: 0})).toBe(0);
    expect(winRate({name: 'x', gamesPlayed: 3, wins: 2, createdAt: 0})).toBe(67);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx jest profileStore`
Expected: FAIL — `Cannot find module '../profileStore'`

- [ ] **Step 8: Implement the profile store**

`src/profile/profileStore.ts`:

```ts
import {generateId} from '../util/id';

export interface Profile {
  name: string;
  gamesPlayed: number;
  wins: number;
  createdAt: number;
}

/** The subset of AsyncStorage the store needs. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export type RemoteSave = (playerId: string, profile: Profile) => Promise<void>;

const KEYS = {
  playerId: 'coup.playerId',
  profile: 'coup.profile',
  activeGameId: 'coup.activeGameId',
  countedGames: 'coup.countedGames',
};

const MAX_COUNTED_GAMES = 50;

export function winRate(profile: Profile): number {
  return profile.gamesPlayed === 0 ? 0 : Math.round((100 * profile.wins) / profile.gamesPlayed);
}

export function createProfileStore(
  storage: KeyValueStorage,
  remoteSave: RemoteSave,
  rng: () => number = Math.random,
  now: () => number = Date.now,
) {
  async function getPlayerId(): Promise<string> {
    const existing = await storage.getItem(KEYS.playerId);
    if (existing) {
      return existing;
    }
    const created = generateId(rng);
    await storage.setItem(KEYS.playerId, created);
    return created;
  }

  async function loadProfile(): Promise<Profile | null> {
    const raw = await storage.getItem(KEYS.profile);
    return raw ? (JSON.parse(raw) as Profile) : null;
  }

  async function save(profile: Profile): Promise<Profile> {
    await storage.setItem(KEYS.profile, JSON.stringify(profile));
    try {
      await remoteSave(await getPlayerId(), profile);
    } catch {
      // The device copy is the source of truth; the remote mirror catches up on the next save.
    }
    return profile;
  }

  async function setName(name: string): Promise<Profile> {
    const existing = await loadProfile();
    return save(existing ? {...existing, name} : {name, gamesPlayed: 0, wins: 0, createdAt: now()});
  }

  /** Adds one finished game to the stats. Safe to call repeatedly for the same game. */
  async function recordResult(gameId: string, won: boolean): Promise<Profile | null> {
    const profile = await loadProfile();
    if (!profile) {
      return null;
    }
    const counted: string[] = JSON.parse((await storage.getItem(KEYS.countedGames)) ?? '[]');
    if (counted.includes(gameId)) {
      return profile;
    }
    await storage.setItem(KEYS.countedGames, JSON.stringify([...counted, gameId].slice(-MAX_COUNTED_GAMES)));
    return save({...profile, gamesPlayed: profile.gamesPlayed + 1, wins: profile.wins + (won ? 1 : 0)});
  }

  async function getActiveGameId(): Promise<string | null> {
    return storage.getItem(KEYS.activeGameId);
  }

  async function setActiveGameId(gameId: string | null): Promise<void> {
    if (gameId) {
      await storage.setItem(KEYS.activeGameId, gameId);
    } else {
      await storage.removeItem(KEYS.activeGameId);
    }
  }

  return {getPlayerId, loadProfile, setName, recordResult, getActiveGameId, setActiveGameId};
}

export type ProfileStore = ReturnType<typeof createProfileStore>;
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npx jest profileStore id.test`
Expected: PASS, 13 tests

- [ ] **Step 10: Commit**

```powershell
git add package.json package-lock.json src/util src/profile; git commit -m "Add player id and profile store"
```

---

### Task 2: Firebase config, security rules, game service, emulator sync test

**Files:**
- Create: `src/firebase/config.ts`, `src/firebase/gameService.ts`, `database.rules.json`, `firebase.json`, `jest.sync.config.js`, `sync/sync.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the Firebase config file**

`src/firebase/config.ts`:

```ts
/**
 * Paste your Firebase project's web config here (Firebase console → Project settings → Your apps → Web app).
 * `databaseURL` is required: create a Realtime Database first so the console includes it.
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export function isConfigured(): boolean {
  return !firebaseConfig.apiKey.startsWith('YOUR_') && !firebaseConfig.databaseURL.includes('YOUR_');
}
```

- [ ] **Step 2: Write the database rules and emulator config**

`database.rules.json`:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "games": {
      "$gameId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['host', 'code', 'status', 'playerOrder', 'players', 'state'])"
      }
    },
    "codes": {
      "$code": {
        ".read": true,
        ".write": "!data.exists()",
        ".validate": "newData.isString() && $code.matches(/^[A-Z0-9]{5}$/)"
      }
    },
    "profiles": {
      "$playerId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['name', 'gamesPlayed', 'wins', 'createdAt']) && newData.child('name').isString() && newData.child('name').val().length <= 20"
      }
    }
  }
}
```

`firebase.json`:

```json
{
  "database": {
    "rules": "database.rules.json"
  },
  "emulators": {
    "database": {
      "host": "127.0.0.1",
      "port": 9000
    },
    "ui": {
      "enabled": false
    },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 3: Add the sync Jest config and npm scripts**

`jest.sync.config.js`:

```js
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/sync/**/*.test.ts'],
  testTimeout: 20000,
};
```

In `package.json`, add to `"scripts"`:

```json
"typecheck": "tsc --noEmit",
"test:sync": "firebase emulators:exec --only database --project demo-coup \"jest --config jest.sync.config.js\""
```

- [ ] **Step 4: Write the failing sync test**

`sync/sync.test.ts`:

```ts
import {deleteApp, FirebaseApp, initializeApp} from 'firebase/app';
import {connectDatabaseEmulator, Database, getDatabase, ref, set} from 'firebase/database';
import {Game} from '../src/engine/types';
import {createGameService, GameService} from '../src/firebase/gameService';

const apps: FirebaseApp[] = [];

function client(name: string): {service: GameService; db: Database} {
  const app = initializeApp(
    {projectId: 'demo-coup', databaseURL: 'http://127.0.0.1:9000?ns=demo-coup-default-rtdb'},
    name,
  );
  apps.push(app);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return {service: createGameService(db), db};
}

/** Resolves with the first snapshot of the game that satisfies `predicate`. */
function seen(service: GameService, gameId: string, predicate: (game: Game) => boolean): Promise<Game> {
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

    expect(await second.service.joinGame(code.toLowerCase(), 'p2', 'Second')).toBe(gameId);
    expect(await third.service.joinGame(` ${code} `, 'p3', 'Third')).toBe(gameId);

    const lobbies = await Promise.all(everyone.map(c => seen(c.service, gameId, g => g.playerOrder.length === 3)));
    lobbies.forEach(lobby => expect(lobby.playerOrder).toEqual(['h', 'p2', 'p3']));

    await host.service.startGame(gameId, 'h');
    const started = await Promise.all(everyone.map(c => seen(c.service, gameId, g => g.status === 'playing')));
    started.forEach(game => {
      expect(game.state.currentTurnPlayer).toBe('h');
      expect(game.players.p3.influence).toHaveLength(2);
      expect(game.deck).toHaveLength(9);
    });
  });

  it('broadcasts an action to every client', async () => {
    await host.service.dispatch(gameId, {type: 'income', playerId: 'h'});
    const games = await Promise.all(
      everyone.map(c => seen(c.service, gameId, g => g.state.currentTurnPlayer === 'p2')),
    );
    games.forEach(game => expect(game.players.h.coins).toBe(3));
  });

  it('rejects an out-of-turn action without changing the game', async () => {
    await expect(third.service.dispatch(gameId, {type: 'income', playerId: 'p3'})).rejects.toThrow(
      'It is not your turn',
    );
    const game = await seen(host.service, gameId, () => true);
    expect(game.players.p3.coins).toBe(2);
    expect(game.state.currentTurnPlayer).toBe('p2');
  });

  it('keeps both responses when two clients respond at the same moment', async () => {
    await second.service.dispatch(gameId, {type: 'foreignAid', playerId: 'p2'});
    await Promise.all(everyone.map(c => seen(c.service, gameId, g => g.state.phase === 'awaitingResponses')));

    await Promise.all([
      host.service.dispatch(gameId, {type: 'pass', playerId: 'h'}),
      third.service.dispatch(gameId, {type: 'pass', playerId: 'p3'}),
    ]);

    const games = await Promise.all(
      everyone.map(c => seen(c.service, gameId, g => g.state.currentTurnPlayer === 'p3')),
    );
    games.forEach(game => expect(game.players.p2.coins).toBe(4));
  });

  it('rejects joining a started game, a full-of-typos code and an unknown code', async () => {
    const late = client('late');
    await expect(late.service.joinGame(code, 'p9', 'Late')).rejects.toThrow('Game already started');
    await expect(late.service.joinGame('ZZZZZ', 'p9', 'Late')).rejects.toThrow('No game found with that code');
    await expect(late.service.joinGame('a.b#c', 'p9', 'Late')).rejects.toThrow('No game found with that code');
  });

  it('lets a non-host leave the lobby', async () => {
    const lobbyId = await host.service.createGame('h', 'Host');
    const lobbyCode = (await seen(host.service, lobbyId, () => true)).code;
    await second.service.joinGame(lobbyCode, 'p2', 'Second');
    await second.service.leaveLobby(lobbyId, 'p2');
    const lobby = await seen(host.service, lobbyId, g => g.playerOrder.length === 1);
    expect(lobby.playerOrder).toEqual(['h']);
  });
});

describe('security rules', () => {
  it('blocks writes outside the known paths', async () => {
    await expect(set(ref(host.db, 'anything/else'), 1)).rejects.toThrow();
  });

  it('does not let an existing join code be overwritten', async () => {
    await expect(set(ref(second.db, `codes/${code}`), 'hijacked')).rejects.toThrow();
  });

  it('rejects a malformed game', async () => {
    await expect(set(ref(host.db, 'games/bad'), {host: 'h'})).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npm run test:sync`
Expected: emulator starts, Jest FAILS with `Cannot find module '../src/firebase/gameService'`, emulator shuts down.

If instead the emulator itself fails to start, read the message: it needs a Java runtime on `PATH` (Java 26 on this machine is fine for the emulator) and port 9000 free.

- [ ] **Step 6: Implement the game service**

`src/firebase/gameService.ts`:

```ts
import {Database, get, onValue, push, ref, runTransaction, set} from 'firebase/database';
import {applyAction} from '../engine/actions';
import {Rng} from '../engine/deck';
import {addPlayer, generateCode, newGame, removePlayer, startGame as startLobby} from '../engine/lobby';
import {normalizeGame} from '../engine/serialize';
import {Game, GameAction} from '../engine/types';

const CREATE_ATTEMPTS = 5;
const CODE_PATTERN = /^[A-Z0-9]{5}$/;

export function createGameService(db: Database, rng: Rng = Math.random, now: () => number = Date.now) {
  const gameRef = (gameId: string) => ref(db, `games/${gameId}`);

  /**
   * Applies `change` to the game atomically. If another phone wrote first, Firebase re-runs `change`
   * on the fresh state. An error thrown by `change` aborts the write and is re-thrown to the caller.
   */
  async function mutate(gameId: string, change: (game: Game) => Game): Promise<void> {
    const outcome: {error: Error | null} = {error: null};
    const result = await runTransaction(
      gameRef(gameId),
      raw => {
        outcome.error = null;
        if (raw === null) {
          return raw;
        }
        try {
          return change(normalizeGame(raw));
        } catch (error) {
          outcome.error = error as Error;
          return undefined;
        }
      },
      {applyLocally: false},
    );
    if (outcome.error) {
      throw outcome.error;
    }
    if (!result.committed || !result.snapshot.exists()) {
      throw new Error('Game not found');
    }
  }

  /** Creates a waiting game hosted by the player and returns its id. */
  async function createGame(playerId: string, name: string): Promise<string> {
    const gameId = push(ref(db, 'games')).key;
    if (!gameId) {
      throw new Error('Could not create a game. Try again.');
    }
    for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
      const code = generateCode(rng);
      const reserved = await runTransaction(
        ref(db, `codes/${code}`),
        current => (current === null ? gameId : undefined),
        {applyLocally: false},
      );
      if (reserved.committed) {
        await set(gameRef(gameId), newGame(playerId, name, code, now()));
        return gameId;
      }
    }
    throw new Error('Could not create a game. Try again.');
  }

  /** Joins (or rejoins) the game with this code and returns its id. */
  async function joinGame(code: string, playerId: string, name: string): Promise<string> {
    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      throw new Error('No game found with that code');
    }
    const snapshot = await get(ref(db, `codes/${normalized}`));
    if (!snapshot.exists()) {
      throw new Error('No game found with that code');
    }
    const gameId = snapshot.val() as string;
    await mutate(gameId, game => addPlayer(game, playerId, name));
    return gameId;
  }

  function startGame(gameId: string, playerId: string): Promise<void> {
    return mutate(gameId, game => startLobby(game, playerId, rng));
  }

  function leaveLobby(gameId: string, playerId: string): Promise<void> {
    return mutate(gameId, game => removePlayer(game, playerId));
  }

  function dispatch(gameId: string, action: GameAction): Promise<void> {
    return mutate(gameId, game => applyAction(game, action, rng));
  }

  /** Calls `onGame` with every new state (null if the game does not exist). Returns an unsubscribe function. */
  function subscribe(
    gameId: string,
    onGame: (game: Game | null) => void,
    onError: (error: Error) => void,
  ): () => void {
    return onValue(
      gameRef(gameId),
      snapshot => onGame(snapshot.exists() ? normalizeGame(snapshot.val()) : null),
      onError,
    );
  }

  function subscribeConnection(onChange: (connected: boolean) => void): () => void {
    return onValue(ref(db, '.info/connected'), snapshot => onChange(snapshot.val() === true));
  }

  return {createGame, joinGame, startGame, leaveLobby, dispatch, subscribe, subscribeConnection};
}

export type GameService = ReturnType<typeof createGameService>;
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npm run test:sync`
Expected: PASS, 9 tests.

If only the three `security rules` tests fail because the writes succeed, the emulator loaded the rules for a different namespace than the test uses. The emulator's startup log names the namespace it applied `database.rules.json` to; put that name in the `?ns=` part of `databaseURL` in `sync/sync.test.ts` and re-run.

- [ ] **Step 8: Run the unit suite and typecheck**

Run: `npx jest; npm run typecheck`
Expected: unit suites PASS (sync tests not included); `tsc` prints nothing.

- [ ] **Step 9: Commit**

```powershell
git add src/firebase database.rules.json firebase.json jest.sync.config.js sync package.json; git commit -m "Add Firebase game service, security rules and emulator sync test"
```

---

### Task 3: App services, theme and base components

**Files:**
- Create: `src/firebase/index.ts`, `src/theme.ts`, `src/components/Screen.tsx`, `src/components/Button.tsx`, `src/components/CardView.tsx`, `src/components/PlayerSeat.tsx`, `src/components/GameLog.tsx`, `src/components/ConnectionBanner.tsx`

No unit tests in this task: these files are wiring and presentation with no logic of their own. They are verified by `tsc` here and on a device in Task 8.

- [ ] **Step 1: Services**

`src/firebase/index.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {initializeApp} from 'firebase/app';
import {getDatabase, ref, set} from 'firebase/database';
import {createProfileStore, ProfileStore} from '../profile/profileStore';
import {firebaseConfig} from './config';
import {createGameService, GameService} from './gameService';

interface Services {
  games: GameService;
  profiles: ProfileStore;
}

let services: Services | null = null;

/** Built on first use so the app can show the setup screen when the config is still a placeholder. */
export function getServices(): Services {
  if (!services) {
    const db = getDatabase(initializeApp(firebaseConfig));
    services = {
      games: createGameService(db),
      profiles: createProfileStore(AsyncStorage, (playerId, profile) =>
        set(ref(db, `profiles/${playerId}`), profile),
      ),
    };
  }
  return services;
}
```

- [ ] **Step 2: Theme**

`src/theme.ts`:

```ts
export const colors = {
  background: '#000000',
  surface: '#1a1a1a',
  border: '#333333',
  text: '#ffffff',
  muted: '#9ca3af',
  primary: '#22d3ee',
  secondary: '#4b5563',
  danger: '#f87171',
  onLight: '#000000',
};

export const spacing = {xs: 4, sm: 8, md: 12, lg: 20};
```

- [ ] **Step 3: Screen and Button**

`src/components/Screen.tsx`:

```tsx
import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {colors, spacing} from '../theme';

export function Screen({children}: {children: React.ReactNode}) {
  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
```

`src/components/Button.tsx`:

```tsx
import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {colors, spacing} from '../theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}

export function Button({label, onPress, variant = 'primary', disabled = false}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [styles.base, styles[variant], pressed && styles.pressed, disabled && styles.disabled]}>
      <Text style={[styles.label, variant !== 'secondary' && styles.labelOnLight]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    margin: spacing.xs,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {backgroundColor: colors.primary},
  secondary: {backgroundColor: colors.secondary},
  danger: {backgroundColor: colors.danger},
  pressed: {opacity: 0.7},
  disabled: {opacity: 0.35},
  label: {color: colors.text, fontSize: 14, fontWeight: '600'},
  labelOnLight: {color: colors.onLight},
});
```

- [ ] **Step 4: CardView and PlayerSeat**

`src/components/CardView.tsx`:

```tsx
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Card} from '../engine/types';
import {colors, spacing} from '../theme';

interface Props {
  card: Card;
  revealed?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export function CardView({card, revealed = false, selected = false, onPress}: Props) {
  const box = (
    <View style={[styles.card, selected && styles.selected, revealed && styles.revealed]}>
      <Text style={[styles.name, revealed && styles.nameRevealed]}>{card}</Text>
      {revealed && <Text style={styles.lost}>LOST</Text>}
    </View>
  );
  if (!onPress) {
    return box;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={card} onPress={onPress}>
      {box}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 96,
    height: 64,
    margin: spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {borderColor: colors.primary, borderWidth: 3},
  revealed: {borderColor: colors.border},
  name: {color: colors.text, fontSize: 14, fontWeight: '700'},
  nameRevealed: {color: colors.muted, textDecorationLine: 'line-through'},
  lost: {color: colors.danger, fontSize: 10, marginTop: 2},
});
```

`src/components/PlayerSeat.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {unrevealedCount} from '../engine/rules';
import {Player} from '../engine/types';
import {colors, spacing} from '../theme';

interface Props {
  player: Player;
  isTurn: boolean;
}

/** An opponent: name, coins, how many cards are still face down, and which cards they have lost. */
export function PlayerSeat({player, isTurn}: Props) {
  const hidden = unrevealedCount(player);
  const lost = player.influence.filter(i => i.revealed).map(i => i.card);
  const eliminated = hidden === 0;
  return (
    <View style={[styles.seat, isTurn && styles.turn, eliminated && styles.eliminated]}>
      <Text style={styles.name} numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={styles.detail}>{eliminated ? 'Out' : `${player.coins} coins · ${hidden} card${hidden === 1 ? '' : 's'}`}</Text>
      {lost.length > 0 && <Text style={styles.lost}>Lost: {lost.join(', ')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    minWidth: 120,
    margin: spacing.xs,
    padding: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  turn: {borderColor: colors.primary, borderWidth: 2},
  eliminated: {opacity: 0.45},
  name: {color: colors.text, fontSize: 14, fontWeight: '700'},
  detail: {color: colors.text, fontSize: 12, marginTop: 2},
  lost: {color: colors.muted, fontSize: 11, marginTop: 2},
});
```

- [ ] **Step 5: GameLog and ConnectionBanner**

`src/components/GameLog.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors, spacing} from '../theme';

const VISIBLE_LINES = 5;

export function GameLog({log}: {log: string[]}) {
  return (
    <View style={styles.log}>
      {log.slice(-VISIBLE_LINES).map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  log: {flex: 1, paddingHorizontal: spacing.md, justifyContent: 'center'},
  line: {color: colors.muted, fontSize: 12},
});
```

`src/components/ConnectionBanner.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {colors, spacing} from '../theme';

export function ConnectionBanner({connected}: {connected: boolean}) {
  if (connected) {
    return null;
  }
  return <Text style={styles.banner}>Connecting to server… actions are paused</Text>;
}

const styles = StyleSheet.create({
  banner: {
    color: colors.onLight,
    backgroundColor: colors.danger,
    textAlign: 'center',
    fontSize: 12,
    padding: spacing.xs,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
});
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 7: Commit**

```powershell
git add src/firebase/index.ts src/theme.ts src/components; git commit -m "Add services, theme and base components"
```

---

### Task 4: Profile and game contexts

**Files:**
- Create: `src/context/ProfileContext.tsx`, `src/context/GameContext.tsx`

- [ ] **Step 1: ProfileContext**

`src/context/ProfileContext.tsx`:

```tsx
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {getServices} from '../firebase';
import {Profile} from '../profile/profileStore';

interface ProfileValue {
  loading: boolean;
  playerId: string;
  profile: Profile | null;
  setName: (name: string) => Promise<void>;
  recordResult: (gameId: string, won: boolean) => Promise<void>;
}

const ProfileContext = createContext<ProfileValue | null>(null);

export function ProfileProvider({children}: {children: React.ReactNode}) {
  const {profiles} = getServices();
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const id = await profiles.getPlayerId();
      const stored = await profiles.loadProfile();
      if (active) {
        setPlayerId(id);
        setProfile(stored);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [profiles]);

  const setName = useCallback(
    async (name: string) => {
      setProfile(await profiles.setName(name));
    },
    [profiles],
  );

  const recordResult = useCallback(
    async (gameId: string, won: boolean) => {
      const updated = await profiles.recordResult(gameId, won);
      if (updated) {
        setProfile(updated);
      }
    },
    [profiles],
  );

  const value = useMemo(
    () => ({loading, playerId, profile, setName, recordResult}),
    [loading, playerId, profile, setName, recordResult],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileValue {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile must be used inside ProfileProvider');
  }
  return value;
}
```

- [ ] **Step 2: GameContext**

`src/context/GameContext.tsx`:

```tsx
import React, {createContext, useCallback, useContext, useEffect, useMemo, useReducer} from 'react';
import {Game, GameAction} from '../engine/types';
import {getServices} from '../firebase';
import {useProfile} from './ProfileContext';

interface State {
  /** False until the stored active game id has been read. */
  ready: boolean;
  gameId: string | null;
  game: Game | null;
  /** True once the first snapshot for `gameId` has arrived. */
  loaded: boolean;
  connected: boolean;
  busy: boolean;
  error: string | null;
}

type Event =
  | {type: 'entered'; gameId: string | null}
  | {type: 'game'; game: Game | null}
  | {type: 'connected'; connected: boolean}
  | {type: 'busy'; busy: boolean}
  | {type: 'error'; error: string | null};

const initialState: State = {
  ready: false,
  gameId: null,
  game: null,
  loaded: false,
  connected: false,
  busy: false,
  error: null,
};

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case 'entered':
      return {...state, ready: true, gameId: event.gameId, game: null, loaded: false, error: null};
    case 'game':
      return {...state, game: event.game, loaded: true};
    case 'connected':
      return {...state, connected: event.connected};
    case 'busy':
      return {...state, busy: event.busy};
    case 'error':
      return {...state, error: event.error};
  }
}

interface GameValue extends State {
  createGame: () => Promise<void>;
  joinGame: (code: string) => Promise<void>;
  startGame: () => Promise<void>;
  act: (action: GameAction) => Promise<void>;
  leave: () => Promise<void>;
}

const GameContext = createContext<GameValue | null>(null);

export function GameProvider({children}: {children: React.ReactNode}) {
  const {games, profiles} = getServices();
  const {playerId, profile} = useProfile();
  const name = profile?.name ?? '';
  const [state, send] = useReducer(reducer, initialState);
  const {gameId, game} = state;

  useEffect(() => {
    let active = true;
    profiles.getActiveGameId().then(stored => {
      if (active) {
        send({type: 'entered', gameId: stored});
      }
    });
    const unsubscribe = games.subscribeConnection(connected => send({type: 'connected', connected}));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [games, profiles]);

  useEffect(() => {
    if (!gameId) {
      return;
    }
    return games.subscribe(
      gameId,
      next => send({type: 'game', game: next}),
      error => send({type: 'error', error: error.message}),
    );
  }, [games, gameId]);

  /** Runs a remote operation, showing its error message instead of throwing. */
  const run = useCallback(async (operation: () => Promise<void>) => {
    send({type: 'busy', busy: true});
    send({type: 'error', error: null});
    try {
      await operation();
    } catch (error) {
      send({type: 'error', error: error instanceof Error ? error.message : 'Something went wrong'});
    } finally {
      send({type: 'busy', busy: false});
    }
  }, []);

  const enter = useCallback(
    async (id: string | null) => {
      await profiles.setActiveGameId(id);
      send({type: 'entered', gameId: id});
    },
    [profiles],
  );

  const createGame = useCallback(
    () => run(async () => enter(await games.createGame(playerId, name))),
    [run, enter, games, playerId, name],
  );

  const joinGame = useCallback(
    (code: string) => run(async () => enter(await games.joinGame(code, playerId, name))),
    [run, enter, games, playerId, name],
  );

  const startGame = useCallback(
    () =>
      run(async () => {
        if (gameId) {
          await games.startGame(gameId, playerId);
        }
      }),
    [run, games, gameId, playerId],
  );

  const act = useCallback(
    (action: GameAction) =>
      run(async () => {
        if (gameId) {
          await games.dispatch(gameId, action);
        }
      }),
    [run, games, gameId],
  );

  const leave = useCallback(
    () =>
      run(async () => {
        const lobbyToLeave =
          gameId && game && game.status === 'waiting' && game.host !== playerId ? gameId : null;
        await enter(null);
        if (lobbyToLeave) {
          await games.leaveLobby(lobbyToLeave, playerId);
        }
      }),
    [run, enter, games, gameId, game, playerId],
  );

  const value = useMemo(
    () => ({...state, createGame, joinGame, startGame, act, leave}),
    [state, createGame, joinGame, startGame, act, leave],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameValue {
  const value = useContext(GameContext);
  if (!value) {
    throw new Error('useGame must be used inside GameProvider');
  }
  return value;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 4: Commit**

```powershell
git add src/context; git commit -m "Add profile and game contexts"
```

---

### Task 5: Turn interaction components

**Files:**
- Create: `src/components/ActionBar.tsx`, `src/components/ResponsePrompt.tsx`, `src/components/LoseInfluencePicker.tsx`, `src/components/ExchangePicker.tsx`

All rule decisions come from `src/engine/rules.ts` (already tested); these components only render the options and emit a `GameAction`.

- [ ] **Step 1: ActionBar**

`src/components/ActionBar.tsx`:

```tsx
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ACTION_BUTTON, ACTION_LABEL} from '../engine/describe';
import {availableActions, livingPlayers, TARGETED} from '../engine/rules';
import {ActionType, Game, GameAction, TargetedAction, UntargetedAction} from '../engine/types';
import {colors, spacing} from '../theme';
import {Button} from './Button';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  onAction: (action: GameAction) => void;
}

function isTargeted(action: ActionType): action is TargetedAction {
  return TARGETED.includes(action);
}

/** The current player's action buttons. Renders nothing when it is not this player's turn to act. */
export function ActionBar({game, playerId, disabled, onAction}: Props) {
  const [targeting, setTargeting] = useState<TargetedAction | null>(null);
  const actions = availableActions(game, playerId);

  if (actions.length === 0) {
    return null;
  }

  if (targeting) {
    const opponents = livingPlayers(game).filter(id => id !== playerId);
    return (
      <View>
        <Text style={styles.prompt}>{ACTION_LABEL[targeting]}: choose a target</Text>
        <View style={styles.row}>
          {opponents.map(id => (
            <Button
              key={id}
              label={game.players[id].name}
              disabled={disabled}
              onPress={() => {
                setTargeting(null);
                onAction({type: targeting, playerId, target: id});
              }}
            />
          ))}
          <Button label="Cancel" variant="secondary" onPress={() => setTargeting(null)} />
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.prompt}>
        {actions.length === 1 ? 'You have 10 or more coins: you must Coup' : 'Your turn: choose an action'}
      </Text>
      <View style={styles.row}>
        {actions.map(action => (
          <Button
            key={action}
            label={ACTION_BUTTON[action]}
            disabled={disabled}
            onPress={() =>
              isTargeted(action) ? setTargeting(action) : onAction({type: action as UntargetedAction, playerId})
            }
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {color: colors.text, fontSize: 13, marginLeft: spacing.xs, marginBottom: spacing.xs},
  row: {flexDirection: 'row', flexWrap: 'wrap'},
});
```

- [ ] **Step 2: ResponsePrompt**

`src/components/ResponsePrompt.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {promptLine} from '../engine/describe';
import {responseOptions} from '../engine/rules';
import {Game, GameAction} from '../engine/types';
import {colors, spacing} from '../theme';
import {Button} from './Button';

interface Props {
  game: Game;
  playerId: string;
  disabled: boolean;
  onAction: (action: GameAction) => void;
}

/** Pass / Challenge / Block buttons. Renders nothing when this player is not being asked. */
export function ResponsePrompt({game, playerId, disabled, onAction}: Props) {
  const options = responseOptions(game, playerId);
  if (!options) {
    return null;
  }
  return (
    <View>
      <Text style={styles.prompt}>{promptLine(game)}</Text>
      <View style={styles.row}>
        <Button
          label="Pass"
          variant="secondary"
          disabled={disabled}
          onPress={() => onAction({type: 'pass', playerId})}
        />
        {options.canChallenge && (
          <Button
            label="Challenge"
            variant="danger"
            disabled={disabled}
            onPress={() => onAction({type: 'challenge', playerId})}
          />
        )}
        {options.blockClaims.map(claim => (
          <Button
            key={claim}
            label={`Block as ${claim}`}
            disabled={disabled}
            onPress={() => onAction({type: 'block', playerId, claim})}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {color: colors.text, fontSize: 13, marginLeft: spacing.xs, marginBottom: spacing.xs},
  row: {flexDirection: 'row', flexWrap: 'wrap'},
});
```

- [ ] **Step 3: LoseInfluencePicker**

`src/components/LoseInfluencePicker.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Player} from '../engine/types';
import {colors, spacing} from '../theme';
import {CardView} from './CardView';

interface Props {
  player: Player;
  disabled: boolean;
  onPick: (cardIndex: number) => void;
}

/** Shown when the local player must choose which of their hidden cards to lose. */
export function LoseInfluencePicker({player, disabled, onPick}: Props) {
  return (
    <View>
      <Text style={styles.prompt}>Choose a card to lose</Text>
      <View style={styles.row}>
        {player.influence.map((influence, index) =>
          influence.revealed ? null : (
            <CardView key={index} card={influence.card} onPress={disabled ? undefined : () => onPick(index)} />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {color: colors.danger, fontSize: 13, marginLeft: spacing.xs, marginBottom: spacing.xs},
  row: {flexDirection: 'row', flexWrap: 'wrap'},
});
```

- [ ] **Step 4: ExchangePicker**

`src/components/ExchangePicker.tsx`:

```tsx
import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Card} from '../engine/types';
import {colors, spacing} from '../theme';
import {Button} from './Button';
import {CardView} from './CardView';

interface Props {
  options: Card[];
  keepCount: number;
  disabled: boolean;
  onConfirm: (keep: number[]) => void;
}

/** Ambassador exchange: tap cards to select the ones to keep, then confirm. */
export function ExchangePicker({options, keepCount, disabled, onConfirm}: Props) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggle = (index: number) =>
    setSelected(current => {
      if (current.includes(index)) {
        return current.filter(i => i !== index);
      }
      return current.length < keepCount ? [...current, index] : current;
    });

  return (
    <View>
      <Text style={styles.prompt}>
        Choose {keepCount} card{keepCount === 1 ? '' : 's'} to keep
      </Text>
      <View style={styles.row}>
        {options.map((card, index) => (
          <CardView key={index} card={card} selected={selected.includes(index)} onPress={() => toggle(index)} />
        ))}
        <Button
          label="Confirm"
          disabled={disabled || selected.length !== keepCount}
          onPress={() => onConfirm(selected)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: {color: colors.text, fontSize: 13, marginLeft: spacing.xs, marginBottom: spacing.xs},
  row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center'},
});
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no output.

- [ ] **Step 6: Commit**

```powershell
git add src/components; git commit -m "Add turn interaction components"
```

---

### Task 6: Screens and App

**Files:**
- Create: `src/screens/SetupScreen.tsx`, `src/screens/WelcomeScreen.tsx`, `src/screens/HomeScreen.tsx`, `src/screens/LobbyScreen.tsx`, `src/screens/GameScreen.tsx`, `src/screens/GameOverScreen.tsx`
- Replace: `App.tsx`

- [ ] **Step 1: SetupScreen and WelcomeScreen**

`src/screens/SetupScreen.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {Screen} from '../components/Screen';
import {colors, spacing} from '../theme';

/** Shown when src/firebase/config.ts still holds placeholder values. */
export function SetupScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Firebase is not configured</Text>
      <Text style={styles.body}>
        Paste your Firebase web config into src/firebase/config.ts and rebuild the app. See README.md, section
        "Firebase setup".
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.md},
  body: {color: colors.muted, fontSize: 14},
});
```

`src/screens/WelcomeScreen.tsx`:

```tsx
import React, {useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {Button} from '../components/Button';
import {Screen} from '../components/Screen';
import {useProfile} from '../context/ProfileContext';
import {colors, spacing} from '../theme';

export const MAX_NAME_LENGTH = 16;

export function WelcomeScreen() {
  const {setName} = useProfile();
  const [text, setText] = useState('');
  const name = text.trim();

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>COUP</Text>
        <Text style={styles.label}>Choose your player name</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Name"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          accessibilityLabel="Player name"
        />
        <Button label="Continue" disabled={name.length === 0} onPress={() => setName(name)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  title: {color: colors.primary, fontSize: 40, fontWeight: '800', letterSpacing: 6, marginBottom: spacing.lg},
  label: {color: colors.text, fontSize: 14, marginBottom: spacing.sm},
  input: {
    width: 260,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
});
```

- [ ] **Step 2: HomeScreen**

`src/screens/HomeScreen.tsx`:

```tsx
import React, {useState} from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';
import {Button} from '../components/Button';
import {ConnectionBanner} from '../components/ConnectionBanner';
import {Screen} from '../components/Screen';
import {useGame} from '../context/GameContext';
import {useProfile} from '../context/ProfileContext';
import {winRate} from '../profile/profileStore';
import {colors, spacing} from '../theme';

const CODE_LENGTH = 5;

export function HomeScreen() {
  const {profile} = useProfile();
  const {connected, busy, error, createGame, joinGame} = useGame();
  const [code, setCode] = useState('');
  const disabled = !connected || busy;

  if (!profile) {
    return null;
  }

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.heading}>{profile.name}</Text>
          <Text style={styles.stat}>Games played: {profile.gamesPlayed}</Text>
          <Text style={styles.stat}>Wins: {profile.wins}</Text>
          <Text style={styles.stat}>Win rate: {winRate(profile)}%</Text>
        </View>
        <View style={styles.column}>
          <Button label="Create Game" disabled={disabled} onPress={createGame} />
          <Text style={styles.or}>or join with a code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={value => setCode(value.toUpperCase())}
            maxLength={CODE_LENGTH}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="CODE"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Join code"
          />
          <Button
            label="Join"
            variant="secondary"
            disabled={disabled || code.trim().length !== CODE_LENGTH}
            onPress={() => joinGame(code)}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  column: {flex: 1, alignItems: 'center'},
  heading: {color: colors.primary, fontSize: 26, fontWeight: '700', marginBottom: spacing.md},
  stat: {color: colors.text, fontSize: 15, marginBottom: spacing.xs},
  or: {color: colors.muted, fontSize: 12, marginVertical: spacing.sm},
  input: {
    width: 180,
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 4,
  },
  error: {color: colors.danger, fontSize: 13, marginTop: spacing.sm},
});
```

- [ ] **Step 3: LobbyScreen**

`src/screens/LobbyScreen.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button} from '../components/Button';
import {ConnectionBanner} from '../components/ConnectionBanner';
import {Screen} from '../components/Screen';
import {useGame} from '../context/GameContext';
import {useProfile} from '../context/ProfileContext';
import {MAX_PLAYERS, MIN_PLAYERS} from '../engine/lobby';
import {colors, spacing} from '../theme';

export function LobbyScreen() {
  const {game, connected, busy, error, startGame, leave} = useGame();
  const {playerId} = useProfile();

  if (!game) {
    return null;
  }

  const isHost = game.host === playerId;
  const count = game.playerOrder.length;
  const disabled = !connected || busy;

  return (
    <Screen>
      <ConnectionBanner connected={connected} />
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.label}>Join code</Text>
          <Text style={styles.code} selectable>
            {game.code}
          </Text>
          {isHost ? (
            <Button label="Start Game" disabled={disabled || count < MIN_PLAYERS} onPress={startGame} />
          ) : (
            <Text style={styles.label}>Waiting for the host to start…</Text>
          )}
          <Button label="Leave" variant="secondary" onPress={leave} />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>
            Players {count}/{MAX_PLAYERS}
          </Text>
          {game.playerOrder.map(id => (
            <Text key={id} style={styles.player}>
              {game.players[id].name}
              {id === game.host ? ' (host)' : ''}
              {id === playerId ? ' (you)' : ''}
            </Text>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  columns: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  column: {flex: 1, alignItems: 'center'},
  label: {color: colors.muted, fontSize: 13, marginBottom: spacing.xs},
  code: {color: colors.primary, fontSize: 48, fontWeight: '800', letterSpacing: 8, marginBottom: spacing.md},
  player: {color: colors.text, fontSize: 16, marginBottom: spacing.xs},
  error: {color: colors.danger, fontSize: 13, marginTop: spacing.sm},
});
```

- [ ] **Step 4: GameScreen**

`src/screens/GameScreen.tsx`:

```tsx
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ActionBar} from '../components/ActionBar';
import {Button} from '../components/Button';
import {CardView} from '../components/CardView';
import {ConnectionBanner} from '../components/ConnectionBanner';
import {ExchangePicker} from '../components/ExchangePicker';
import {GameLog} from '../components/GameLog';
import {LoseInfluencePicker} from '../components/LoseInfluencePicker';
import {PlayerSeat} from '../components/PlayerSeat';
import {ResponsePrompt} from '../components/ResponsePrompt';
import {Screen} from '../components/Screen';
import {useGame} from '../context/GameContext';
import {useProfile} from '../context/ProfileContext';
import {statusLine} from '../engine/describe';
import {unrevealedCount} from '../engine/rules';
import {colors, spacing} from '../theme';

export function GameScreen() {
  const {game, connected, busy, error, act, leave} = useGame();
  const {playerId} = useProfile();

  if (!game) {
    return null;
  }

  const me = game.players[playerId];
  if (!me) {
    return (
      <Screen>
        <Text style={styles.status}>You are not a player in this game.</Text>
        <Button label="Back to Home" onPress={leave} />
      </Screen>
    );
  }

  const {phase, pending, currentTurnPlayer, turnNumber} = game.state;
  const disabled = !connected || busy;
  const opponents = game.playerOrder.filter(id => id !== playerId);
  const mustLose = phase === 'loseInfluence' && pending?.loseInfluence?.playerId === playerId;
  const exchangeOptions =
    phase === 'exchange' && pending?.actor === playerId ? pending.exchangeOptions : null;

  return (
    <Screen>
      <ConnectionBanner connected={connected} />

      <View style={styles.opponents}>
        {opponents.map(id => (
          <PlayerSeat key={id} player={game.players[id]} isTurn={id === currentTurnPlayer} />
        ))}
      </View>

      <View style={styles.middle}>
        <View style={styles.statusBox}>
          <Text style={styles.status}>{statusLine(game)}</Text>
          <Text style={styles.meta}>
            Turn {turnNumber} · Deck {game.deck.length}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
        <GameLog log={game.log} />
        <Button label="Quit" variant="secondary" onPress={leave} />
      </View>

      <View style={styles.bottom}>
        <View style={[styles.hand, currentTurnPlayer === playerId && styles.handTurn]}>
          {me.influence.map((influence, index) => (
            <CardView key={index} card={influence.card} revealed={influence.revealed} />
          ))}
          <Text style={styles.coins}>{me.coins} coins</Text>
        </View>
        <View style={styles.controls}>
          {exchangeOptions ? (
            <ExchangePicker
              options={exchangeOptions}
              keepCount={unrevealedCount(me)}
              disabled={disabled}
              onConfirm={keep => act({type: 'exchangeChoose', playerId, keep})}
            />
          ) : mustLose ? (
            <LoseInfluencePicker
              player={me}
              disabled={disabled}
              onPick={cardIndex => act({type: 'loseInfluence', playerId, cardIndex})}
            />
          ) : (
            <>
              <ResponsePrompt game={game} playerId={playerId} disabled={disabled} onAction={act} />
              <ActionBar game={game} playerId={playerId} disabled={disabled} onAction={act} />
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  opponents: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center'},
  middle: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  statusBox: {flex: 1},
  status: {color: colors.text, fontSize: 16, fontWeight: '700'},
  meta: {color: colors.muted, fontSize: 12, marginTop: 2},
  error: {color: colors.danger, fontSize: 13, marginTop: spacing.xs},
  bottom: {flexDirection: 'row', alignItems: 'flex-end'},
  hand: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.background,
  },
  handTurn: {borderColor: colors.primary},
  coins: {color: colors.text, fontSize: 15, fontWeight: '700', marginHorizontal: spacing.sm},
  controls: {flex: 1, marginLeft: spacing.sm},
});
```

- [ ] **Step 5: GameOverScreen**

`src/screens/GameOverScreen.tsx`:

```tsx
import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button} from '../components/Button';
import {Screen} from '../components/Screen';
import {useGame} from '../context/GameContext';
import {useProfile} from '../context/ProfileContext';
import {colors, spacing} from '../theme';

export function GameOverScreen() {
  const {game, gameId, leave} = useGame();
  const {playerId, recordResult} = useProfile();
  const winner = game?.winner ?? null;
  const played = !!game?.players[playerId];

  useEffect(() => {
    if (gameId && winner && played) {
      recordResult(gameId, winner === playerId);
    }
  }, [gameId, winner, played, playerId, recordResult]);

  if (!game || !winner) {
    return null;
  }

  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.title}>{winner === playerId ? 'You win!' : `${game.players[winner].name} wins`}</Text>
        <Text style={styles.meta}>Game over after {game.state.turnNumber} turns</Text>
        <Button label="Back to Home" onPress={leave} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  title: {color: colors.primary, fontSize: 34, fontWeight: '800', marginBottom: spacing.sm},
  meta: {color: colors.muted, fontSize: 14, marginBottom: spacing.lg},
});
```

- [ ] **Step 6: App**

Replace `App.tsx` with:

```tsx
import React from 'react';
import {StyleSheet, Text} from 'react-native';
import {Button} from './src/components/Button';
import {Screen} from './src/components/Screen';
import {GameProvider, useGame} from './src/context/GameContext';
import {ProfileProvider, useProfile} from './src/context/ProfileContext';
import {isConfigured} from './src/firebase/config';
import {GameOverScreen} from './src/screens/GameOverScreen';
import {GameScreen} from './src/screens/GameScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {LobbyScreen} from './src/screens/LobbyScreen';
import {SetupScreen} from './src/screens/SetupScreen';
import {WelcomeScreen} from './src/screens/WelcomeScreen';
import {colors, spacing} from './src/theme';

function GameRouter() {
  const {ready, gameId, game, loaded, error, leave} = useGame();

  if (!ready) {
    return <Screen>{null}</Screen>;
  }
  if (!gameId) {
    return <HomeScreen />;
  }
  if (!game) {
    return (
      <Screen>
        <Text style={styles.message}>{loaded ? 'This game no longer exists.' : 'Loading game…'}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Back to Home" variant="secondary" onPress={leave} />
      </Screen>
    );
  }
  switch (game.status) {
    case 'waiting':
      return <LobbyScreen />;
    case 'playing':
      return <GameScreen />;
    case 'finished':
      return <GameOverScreen />;
  }
}

function ProfileRouter() {
  const {loading, profile} = useProfile();

  if (loading) {
    return <Screen>{null}</Screen>;
  }
  if (!profile) {
    return <WelcomeScreen />;
  }
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default function App() {
  if (!isConfigured()) {
    return <SetupScreen />;
  }
  return (
    <ProfileProvider>
      <ProfileRouter />
    </ProfileProvider>
  );
}

const styles = StyleSheet.create({
  message: {color: colors.text, fontSize: 16, marginBottom: spacing.md},
  error: {color: colors.danger, fontSize: 13, marginBottom: spacing.md},
});
```

- [ ] **Step 7: Full gate**

Run: `npx jest; npm run typecheck; npm run test:sync`
Expected: unit suites PASS; `tsc` silent; sync suite PASS (9 tests).

- [ ] **Step 8: Commit**

```powershell
git add App.tsx src/screens; git commit -m "Add screens and app routing"
```

---

### Task 7: JDK for the Android build

React Native's Gradle build does not run on Java 26 (the machine default). It needs JDK 17. Nothing in this task changes the system default Java; the JDK is selected per PowerShell session.

- [ ] **Step 1: Look for a JDK 17 already on the machine**

```powershell
$candidates = @("$env:USERPROFILE\.jdk", "$env:ProgramFiles\Android\Android Studio\jbr", "$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Java", "D:\SDKs")
Get-ChildItem $candidates -Recurse -Depth 3 -Filter java.exe -ErrorAction SilentlyContinue | ForEach-Object { $v = (& $_.FullName -version 2>&1 | Select-Object -First 1); "$($_.FullName)  ->  $v" }
```

Expected: a list of `java.exe` paths with versions. If one reports version `17.x`, note its JDK root (the folder containing `bin`) and skip Step 2.

- [ ] **Step 2: USER GATE — install JDK 17 if none was found**

Explain to the user, then wait for a yes:
- What: download Eclipse Temurin JDK 17 (Windows x64 zip, about 190 MB) from `https://adoptium.net/temurin/releases/?version=17` and extract it to `D:\SDKs\jdk-17`.
- Effect: a new folder only. No installer, no `PATH` or `JAVA_HOME` change, Java 26 stays the default everywhere else.
- Trade-off: about 300 MB of disk; builds for this project must set `JAVA_HOME` first (Step 3).

After approval, download the zip, extract it, and move the inner `jdk-17.*` folder's contents so that `D:\SDKs\jdk-17\bin\java.exe` exists.

- [ ] **Step 3: Verify Gradle sees JDK 17**

Use the JDK root from Step 1 or `D:\SDKs\jdk-17`:

```powershell
$env:JAVA_HOME = 'D:\SDKs\jdk-17'; $env:Path = "$env:JAVA_HOME\bin;$env:Path"; Set-Location D:\Projects\Owned\Coup\android; .\gradlew --version; Set-Location ..
```

Expected: the `JVM:` line (or `Launcher JVM:`) shows `17.`. First run downloads the Gradle distribution.

No commit: nothing in the repo changed.

---

### Task 8: Firebase project and device smoke test

- [ ] **Step 1: USER GATE — Firebase project**

Ask the user to do these in the Firebase console (they are account actions only the user can take), following README "Firebase setup" (Task 10 text; give them the steps directly if the README is not written yet):

1. Create a Firebase project (Analytics not needed).
2. Build → Realtime Database → Create database → locked mode.
3. Realtime Database → Rules → paste the contents of `database.rules.json` → Publish.
4. Project settings → Your apps → add a Web app → copy the `firebaseConfig` values into `src/firebase/config.ts`.

Wait until the user confirms `src/firebase/config.ts` is filled in. Then run `npm run typecheck` (expected: no output).

- [ ] **Step 2: Build a debug-signed release APK and install it**

A release build bundles the JavaScript, so no Metro dev server is needed.

```powershell
$env:JAVA_HOME = 'D:\SDKs\jdk-17'; $env:Path = "$env:JAVA_HOME\bin;$env:Path"; Set-Location D:\Projects\Owned\Coup\android; .\gradlew assembleRelease; Set-Location ..
Test-Path android\app\build\outputs\apk\release\app-release.apk
```

Expected: `BUILD SUCCESSFUL`, then `True`. (The template signs release builds with the debug key until Task 9.)

Install on every connected phone or running emulator:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r android\app\build\outputs\apk\release\app-release.apk
```

Use `adb -s <serial> install -r ...` per device when more than one is listed.

- [ ] **Step 3: Smoke test with 2–3 players**

Play through this checklist on two or three devices/emulators. Every line must hold:

1. First launch shows Welcome; after entering a name, Home shows the name and `Games played: 0`.
2. The app is in landscape and the background is black.
3. Device A: Create Game → Lobby shows a 5-character code and A as host.
4. Devices B (and C): enter the code → Join → all lobbies list all players.
5. A taps Start Game → every device shows the board; each sees only its own two card names; opponents show `2 coins · 2 cards`.
6. Only the current player sees action buttons.
7. Income: coins go up by 1 on every device and the turn indicator moves.
8. Tax: other players get Pass / Challenge; after all pass, +3 coins.
9. Foreign Aid, blocked as Duke, then all pass: no coins gained.
10. A wrong challenge: the challenger is asked to choose a card to lose; the lost card is shown as LOST to everyone.
11. Steal on a target: only the target sees `Block as Captain` / `Block as Ambassador`.
12. Exchange: four cards offered, two kept, hand updates.
13. Coup with 7 coins: target loses a card.
14. Turn aeroplane mode on for one device: the red "Connecting to server…" banner appears and buttons are disabled; turning it off restores the game.
15. Force-close and reopen the app mid-game: it returns to the same game.
16. Play until one player remains: every device shows Game Over; Home then shows `Games played: 1` and the winner shows `Wins: 1`.

Fix any failure before continuing: reproduce it as a failing engine or sync test where the cause is in logic, then fix.

- [ ] **Step 4: Commit**

```powershell
git add -A; git commit -m "Configure Firebase project and fix smoke-test findings"
```

(`src/firebase/config.ts` now contains the project's web config. That is acceptable in a private repo; the config is an identifier, not a secret, and access is governed by the database rules.)

---

### Task 9: Release signing and final APK

Without a stable signing key, a later APK cannot be installed over an earlier one.

**Files:**
- Create (not committed): `android/app/coup-release.keystore`, `android/keystore.properties`
- Modify: `android/app/build.gradle`, `.gitignore`

- [ ] **Step 1: Ignore the signing files**

Append to `.gitignore`:

```
# Release signing (never commit)
android/keystore.properties
android/app/*.keystore
!android/app/debug.keystore
dist/
```

- [ ] **Step 2: Generate the keystore and its properties file**

The password is generated and written straight to the ignored properties file; it is never printed.

```powershell
$env:JAVA_HOME = 'D:\SDKs\jdk-17'
$pw = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -storetype PKCS12 -keystore android\app\coup-release.keystore -alias coup -keyalg RSA -keysize 2048 -validity 10000 -storepass $pw -keypass $pw -dname "CN=Coup, O=Erik Fazlla, C=GR"
"storeFile=coup-release.keystore`nstorePassword=$pw`nkeyAlias=coup`nkeyPassword=$pw" | Set-Content -Encoding ascii android\keystore.properties
Remove-Variable pw
git status --short android
```

Expected: `git status` does not list `coup-release.keystore` or `keystore.properties`.

Tell the user: back up `android/app/coup-release.keystore` and `android/keystore.properties` somewhere safe outside the repo. Losing them means friends must uninstall before installing a future version.

- [ ] **Step 3: Use the keystore for release builds**

In `android/app/build.gradle`:

a) Directly above the `android {` line, add:

```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

b) Inside the existing `signingConfigs { ... }` block, after the `debug { ... }` entry, add:

```gradle
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
```

c) Inside `buildTypes { release { ... } }`, replace the line `signingConfig signingConfigs.debug` with:

```gradle
            signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug
```

(A fresh clone without the keystore still builds, debug-signed.)

- [ ] **Step 4: Build and collect the APK**

```powershell
$env:JAVA_HOME = 'D:\SDKs\jdk-17'; $env:Path = "$env:JAVA_HOME\bin;$env:Path"; Set-Location D:\Projects\Owned\Coup\android; .\gradlew clean assembleRelease; Set-Location ..
New-Item -ItemType Directory -Force dist | Out-Null; Copy-Item android\app\build\outputs\apk\release\app-release.apk dist\coup.apk
& "$env:ANDROID_HOME\build-tools\$((Get-ChildItem $env:ANDROID_HOME\build-tools | Sort-Object Name | Select-Object -Last 1).Name)\apksigner.bat" verify --print-certs dist\coup.apk
```

Expected: `BUILD SUCCESSFUL`; `apksigner` prints a signer with `CN=Coup` (not `CN=Android Debug`).

- [ ] **Step 5: Install the final APK on one device and open it**

The earlier debug-signed install has a different signature, so uninstall first:

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" uninstall com.coup
& "$env:ANDROID_HOME\platform-tools\adb.exe" install dist\coup.apk
```

Expected: `Success`. The app opens to Welcome (uninstall cleared local data).

- [ ] **Step 6: Commit**

```powershell
git add .gitignore android/app/build.gradle; git commit -m "Sign release builds with project keystore"
```

---

### Task 10: README

**Files:**
- Replace: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:

````markdown
# Coup

Multiplayer Coup card game for Android. React Native + Firebase Realtime Database. 2–6 players, each on their own phone, joined by a 5-character code.

## Requirements

- Node 20 or newer
- JDK 17 (the Android build does not run on newer Java defaults; see "Build the APK")
- Android SDK with `ANDROID_HOME` set
- A Firebase project (free Spark plan is enough)

## Install

```bash
npm install
```

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com), create a project. Analytics is not needed.
2. **Build → Realtime Database → Create database.** Choose a region, start in locked mode.
3. **Realtime Database → Rules:** replace the contents with `database.rules.json` from this repo and publish.
4. **Project settings → Your apps → Web app (`</>`)**: register an app, then copy the values of `firebaseConfig` into `src/firebase/config.ts`. `databaseURL` must be present.
5. Rebuild the app. Until the config is filled in, the app shows "Firebase is not configured".

### About security

The app has no login. The rules allow anyone who has the Firebase config to read and write `/games`, `/codes` and `/profiles`, and nothing else. Hidden cards are hidden by the app, not by the database. This is fine for playing with friends; do not store anything sensitive in this Firebase project and do not reuse it for another app.

## Tests

```bash
npm test
```

Rules engine and profile store.

```bash
npm run test:sync
```

Runs three simulated players against the local Firebase emulator (needs Java on `PATH`).

```bash
npm run typecheck
```

## Build the APK

Point the build at JDK 17 for the current PowerShell session (adjust the path to your JDK 17):

```powershell
$env:JAVA_HOME = 'D:\SDKs\jdk-17'; $env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

Build:

```powershell
cd android; .\gradlew assembleRelease; cd ..
```

The APK is at `android/app/build/outputs/apk/release/app-release.apk`.

### Signing

Release builds are signed with `android/app/coup-release.keystore` using the credentials in `android/keystore.properties`:

```
storeFile=coup-release.keystore
storePassword=...
keyAlias=coup
keyPassword=...
```

Both files are git-ignored. Keep a backup: an APK signed with a different key cannot be installed over an existing install. Without these files the build falls back to the debug key.

To create a new keystore:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -storetype PKCS12 -keystore android\app\coup-release.keystore -alias coup -keyalg RSA -keysize 2048 -validity 10000
```

## Install on phones

Send `app-release.apk` to each player. On the phone, open the file and allow "Install unknown apps" for the app used to open it.

Or with a USB cable and USB debugging enabled:

```powershell
adb install -r android\app\build\outputs\apk\release\app-release.apk
```

## Run in development

```bash
npm start
```

```bash
npm run android
```

## How to play

1. Everyone enters a name on first launch.
2. One player taps **Create Game** and shares the code.
3. Others enter the code and tap **Join**. The host taps **Start Game** (2–6 players).
4. On your turn, choose an action. After a claim, every other player taps **Pass**, **Challenge** or **Block**; the game continues once everyone has answered.

Full base-game rules are implemented: Income, Foreign Aid, Coup, Duke (Tax, blocks Foreign Aid), Assassin, Captain (Steal, blocks Steal), Ambassador (Exchange, blocks Steal), Contessa (blocks Assassination), challenges on actions and blocks, forced Coup at 10 coins.

## Known limits

- No turn timer: if a player stops responding, the game waits for them. Reopening the app returns them to the game.
- A player who taps **Quit** during a game stays in it as a silent player; the others will be waiting for their responses.
- Android only.

## Project layout

```
src/engine      Rules as pure functions (no React Native, no Firebase)
src/firebase    Config and game service (transactions on /games/{gameId})
src/profile     Local profile and stats
src/context     React contexts
src/screens     Welcome, Home, Lobby, Game, Game Over
src/components  Cards, seats, action and response controls
sync            Emulator-based multiplayer test
docs            Design spec and implementation plans
```
````

- [ ] **Step 2: Check the README's commands against reality**

Confirm `package.json` has scripts named `start`, `android`, `test`, `typecheck`, `test:sync`. If the template named any differently, change the README to match `package.json`.

- [ ] **Step 3: Commit**

```powershell
git add README.md; git commit -m "Add README with setup and APK build instructions"
```

---

### Task 11: GitHub private repo

- [ ] **Step 1: Final gate**

Run: `npx jest; npm run typecheck; npm run test:sync; git status --short`
Expected: all green; `git status` prints nothing.

- [ ] **Step 2: Check nothing secret is tracked**

```powershell
git ls-files | Select-String -Pattern 'keystore|\.jks|\.env|keystore\.properties'
```

Expected: only `android/app/debug.keystore` (the template's public debug key). Anything else: stop and remove it from the index before continuing.

- [ ] **Step 3: USER GATE — create the private repo**

Ask the user to confirm creating the private repository `Erik-Fazlla/coup`. After a yes:

```powershell
gh repo create Erik-Fazlla/coup --private --source . --remote origin --description "Multiplayer Coup card game (React Native + Firebase)"
git remote -v
```

Expected: `origin  https://github.com/Erik-Fazlla/coup.git` for fetch and push. Nothing is pushed yet.

- [ ] **Step 4: Hand the push to the user**

Give the user this command to run:

```bash
git push -u origin main
```

Optional, to share the APK with friends who have repo access (only if the user asks):

```bash
gh release create v1.0.0 dist/coup.apk --title "Coup 1.0.0" --notes "First playable build"
```

---

## Plan 2 done when

- `npx jest`, `npm run typecheck` and `npm run test:sync` are green.
- The 16-point smoke test passed on 2–3 devices.
- `dist/coup.apk` is signed with the project key and installs.
- README is accurate; all work is committed; the private repo exists and the user has the push command.
