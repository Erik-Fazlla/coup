# Coup Plan 1: Project Scaffold and Rules Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A React Native CLI project containing a fully tested, pure TypeScript Coup rules engine (no Firebase, no UI).

**Architecture:** The engine is a set of pure functions over a plain `Game` object. `applyAction(game, action, rng)` returns a new `Game` or throws `IllegalActionError`. Randomness is injected. Nothing in `src/engine` imports React Native or Firebase, so Plan 2 can run it inside Firebase transactions and tests can run it in plain Jest.

**Tech Stack:** React Native CLI (latest), TypeScript, Jest (template preset).

**Spec:** `docs/specs/2026-10-02-coup-design.md`

**Conventions for every task**
- Project root: `D:\Projects\Owned\Coup`. Run all commands from there (PowerShell).
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never push. Pushing is handled at the end of Plan 2 after user confirmation.

## File map

| File | Responsibility |
|---|---|
| `src/engine/types.ts` | All game types, `GameAction`, `IllegalActionError` |
| `src/engine/deck.ts` | `buildDeck`, `shuffle`, `Rng` |
| `src/engine/lobby.ts` | `newGame`, `addPlayer`, `removePlayer`, `startGame`, `generateCode` |
| `src/engine/rules.ts` | Rule tables and read-only queries (`availableActions`, `pendingResponders`, `responseOptions`) |
| `src/engine/actions.ts` | `applyAction` — the turn state machine |
| `src/engine/describe.ts` | Human-readable labels and status lines |
| `src/engine/serialize.ts` | `normalizeGame` — restores fields Firebase drops (nulls, empty arrays/objects) |
| `src/engine/testHelpers.ts` | `makeGame`, `makePending`, `identityRng`, `play` (test support, not a test file) |
| `src/engine/__tests__/*.test.ts` | One test file per engine file |

---

### Task 1: Scaffold the React Native project

**Files:**
- Create: whole RN template in project root
- Delete: `__tests__/App.test.tsx`
- Modify: `jest.config.js`, `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Generate the template in a sibling folder**

The project folder already contains `docs/` and `.git`, and the RN CLI refuses a non-empty target, so scaffold next to it.

```powershell
npx --yes @react-native-community/cli@latest init Coup --directory D:\Projects\Owned\_coup_scaffold --skip-git-init --pm npm
```

Expected: ends with a "Run instructions for Android" block. `D:\Projects\Owned\_coup_scaffold\package.json` exists.

- [ ] **Step 2: Move the template into the project**

```powershell
robocopy D:\Projects\Owned\_coup_scaffold D:\Projects\Owned\Coup /E /MOVE /NFL /NDL /NJH; if ($LASTEXITCODE -lt 8) { "moved OK" } else { "robocopy failed: $LASTEXITCODE" }
Test-Path D:\Projects\Owned\Coup\package.json; Test-Path D:\Projects\Owned\Coup\docs\specs\2026-10-02-coup-design.md; Test-Path D:\Projects\Owned\_coup_scaffold
```

Expected: `moved OK`, then `True`, `True`, `False`.

- [ ] **Step 3: Remove the template's App render test**

It renders `App`, which will depend on Firebase and AsyncStorage in Plan 2 and would need mocks that test nothing useful.

```powershell
git -C D:\Projects\Owned\Coup rm -q --cached --ignore-unmatch __tests__/App.test.tsx; Remove-Item D:\Projects\Owned\Coup\__tests__\App.test.tsx -Confirm:$false
```

- [ ] **Step 4: Keep the emulator sync tests (Plan 2) out of the default Jest run**

Open `jest.config.js`. Keep the template's existing `preset` line exactly as generated and add `testPathIgnorePatterns`, so the file reads (preset value may differ by RN version — do not change it):

```js
module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/sync/'],
};
```

- [ ] **Step 5: Lock the app to landscape**

In `android/app/src/main/AndroidManifest.xml`, add this attribute to the `<activity android:name=".MainActivity" ...>` element:

```xml
android:screenOrientation="sensorLandscape"
```

- [ ] **Step 6: Verify Jest runs**

Run: `npx jest --passWithNoTests`
Expected: `No tests found, exiting with code 0`

- [ ] **Step 7: Commit**

```powershell
git add -A; git commit -m "Scaffold React Native project"
```

Expected: `git status --short` prints nothing; `node_modules` is not in the commit (template `.gitignore` excludes it).

---

### Task 2: Types and deck

**Files:**
- Create: `src/engine/types.ts`, `src/engine/deck.ts`
- Test: `src/engine/__tests__/deck.test.ts`

- [ ] **Step 1: Write the types**

`src/engine/types.ts`:

```ts
export type Card = 'Duke' | 'Assassin' | 'Captain' | 'Ambassador' | 'Contessa';

export const CARDS: Card[] = ['Duke', 'Assassin', 'Captain', 'Ambassador', 'Contessa'];

export type UntargetedAction = 'income' | 'foreignAid' | 'tax' | 'exchange';
export type TargetedAction = 'coup' | 'assassinate' | 'steal';
export type ActionType = UntargetedAction | TargetedAction;

export type GameStatus = 'waiting' | 'playing' | 'finished';

export type Phase =
  | 'action'
  | 'awaitingResponses'
  | 'awaitingBlockResponses'
  | 'loseInfluence'
  | 'exchange'
  | 'finished';

/** What happens after a player finishes losing an influence. */
export type Continuation = 'endTurn' | 'resolveAction' | 'afterFailedChallenge';

export interface Influence {
  card: Card;
  revealed: boolean;
}

export interface Player {
  name: string;
  coins: number;
  influence: Influence[];
  eliminatedAt: number | null;
}

export interface Block {
  blocker: string;
  claim: Card;
  responses: Record<string, 'pass'>;
}

export interface Pending {
  actor: string;
  action: ActionType;
  target: string | null;
  claim: Card | null;
  responses: Record<string, 'pass'>;
  /** True once a challenge against the action has failed; only a block by the target remains possible. */
  challengeResolved: boolean;
  block: Block | null;
  loseInfluence: {playerId: string; next: Continuation} | null;
  exchangeOptions: Card[] | null;
}

export interface LastAction {
  playerId: string;
  action: ActionType;
  target: string | null;
  blocked: boolean;
}

export interface GameState {
  phase: Phase;
  currentTurnPlayer: string;
  turnNumber: number;
  pending: Pending | null;
  lastAction: LastAction | null;
}

export interface Game {
  host: string;
  code: string;
  status: GameStatus;
  playerOrder: string[];
  players: Record<string, Player>;
  deck: Card[];
  state: GameState;
  log: string[];
  winner: string | null;
  createdAt: number;
}

export type GameAction =
  | {type: UntargetedAction; playerId: string}
  | {type: TargetedAction; playerId: string; target: string}
  | {type: 'pass'; playerId: string}
  | {type: 'challenge'; playerId: string}
  | {type: 'block'; playerId: string; claim: Card}
  | {type: 'loseInfluence'; playerId: string; cardIndex: number}
  | {type: 'exchangeChoose'; playerId: string; keep: number[]};

export type DeclareAction = Extract<GameAction, {type: ActionType}>;

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
```

- [ ] **Step 2: Write the failing deck test**

`src/engine/__tests__/deck.test.ts`:

```ts
import {buildDeck, shuffle} from '../deck';
import {CARDS} from '../types';

describe('buildDeck', () => {
  it('has 15 cards, 3 of each character', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(15);
    CARDS.forEach(card => expect(deck.filter(c => c === card)).toHaveLength(3));
  });
});

describe('shuffle', () => {
  it('keeps the same cards', () => {
    const deck = buildDeck();
    expect([...shuffle(deck, Math.random)].sort()).toEqual([...deck].sort());
  });

  it('does not mutate its input', () => {
    const items = [1, 2, 3, 4];
    shuffle(items, () => 0);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('is driven entirely by the injected rng', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest deck`
Expected: FAIL — `Cannot find module '../deck'`

- [ ] **Step 4: Implement the deck**

`src/engine/deck.ts`:

```ts
import {Card, CARDS} from './types';

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export function buildDeck(): Card[] {
  return CARDS.flatMap(card => [card, card, card]);
}

/** Fisher–Yates. Returns a new array. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx jest deck`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```powershell
git add src/engine; git commit -m "Add engine types and deck"
```

---

### Task 3: Lobby (create, join, leave, start)

**Files:**
- Create: `src/engine/lobby.ts`
- Test: `src/engine/__tests__/lobby.test.ts`

- [ ] **Step 1: Write the failing test**

`src/engine/__tests__/lobby.test.ts`:

```ts
import {addPlayer, generateCode, newGame, removePlayer, startGame} from '../lobby';
import {Game} from '../types';

const identityRng = () => 0.999999;

function lobby(playerCount: number): Game {
  let game = newGame('p1', 'P1', 'ABCDE', 1000);
  for (let i = 2; i <= playerCount; i++) {
    game = addPlayer(game, `p${i}`, `P${i}`);
  }
  return game;
}

describe('newGame', () => {
  it('creates a waiting game with the host as only player', () => {
    const game = newGame('p1', 'P1', 'ABCDE', 1000);
    expect(game.status).toBe('waiting');
    expect(game.host).toBe('p1');
    expect(game.code).toBe('ABCDE');
    expect(game.playerOrder).toEqual(['p1']);
    expect(game.players.p1).toEqual({name: 'P1', coins: 2, influence: [], eliminatedAt: null});
    expect(game.createdAt).toBe(1000);
    expect(game.winner).toBeNull();
  });
});

describe('addPlayer', () => {
  it('adds players in join order without mutating the input', () => {
    const before = lobby(1);
    const after = addPlayer(before, 'p2', 'P2');
    expect(after.playerOrder).toEqual(['p1', 'p2']);
    expect(after.players.p2.name).toBe('P2');
    expect(before.playerOrder).toEqual(['p1']);
  });

  it('returns the same game when the player is already in it', () => {
    const game = lobby(2);
    expect(addPlayer(game, 'p2', 'Other name')).toBe(game);
  });

  it('rejects a seventh player', () => {
    expect(() => addPlayer(lobby(6), 'p7', 'P7')).toThrow('Game is full');
  });

  it('rejects new players once started but lets existing players rejoin', () => {
    const started = startGame(lobby(2), 'p1', identityRng);
    expect(() => addPlayer(started, 'p3', 'P3')).toThrow('Game already started');
    expect(addPlayer(started, 'p2', 'P2')).toBe(started);
  });
});

describe('removePlayer', () => {
  it('removes a non-host player from a waiting game', () => {
    const after = removePlayer(lobby(3), 'p2');
    expect(after.playerOrder).toEqual(['p1', 'p3']);
    expect(after.players.p2).toBeUndefined();
  });

  it('leaves the game unchanged for the host or once started', () => {
    const waiting = lobby(2);
    expect(removePlayer(waiting, 'p1')).toBe(waiting);
    const started = startGame(waiting, 'p1', identityRng);
    expect(removePlayer(started, 'p2')).toBe(started);
  });
});

describe('startGame', () => {
  it('deals two cards each and starts with the first player', () => {
    const game = startGame(lobby(3), 'p1', identityRng);
    expect(game.status).toBe('playing');
    expect(game.state).toEqual({
      phase: 'action',
      currentTurnPlayer: 'p1',
      turnNumber: 1,
      pending: null,
      lastAction: null,
    });
    expect(game.players.p1.influence).toEqual([
      {card: 'Duke', revealed: false},
      {card: 'Duke', revealed: false},
    ]);
    expect(game.players.p2.influence.map(i => i.card)).toEqual(['Duke', 'Assassin']);
    expect(game.players.p3.influence.map(i => i.card)).toEqual(['Assassin', 'Assassin']);
    expect(game.deck).toHaveLength(9);
    expect(game.players.p3.coins).toBe(2);
  });

  it('only lets the host start', () => {
    expect(() => startGame(lobby(2), 'p2', identityRng)).toThrow('Only the host can start the game');
  });

  it('needs at least two players', () => {
    expect(() => startGame(lobby(1), 'p1', identityRng)).toThrow('Need at least 2 players');
  });

  it('cannot start twice', () => {
    const started = startGame(lobby(2), 'p1', identityRng);
    expect(() => startGame(started, 'p1', identityRng)).toThrow('Game already started');
  });
});

describe('generateCode', () => {
  it('produces 5 unambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode(Math.random)).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });

  it('is driven by the injected rng', () => {
    expect(generateCode(() => 0)).toBe('AAAAA');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest lobby`
Expected: FAIL — `Cannot find module '../lobby'`

- [ ] **Step 3: Implement the lobby**

`src/engine/lobby.ts`:

```ts
import {buildDeck, Rng, shuffle} from './deck';
import {Game, IllegalActionError, Player} from './types';

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

function newPlayer(name: string): Player {
  return {name, coins: 2, influence: [], eliminatedAt: null};
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

export function newGame(hostId: string, hostName: string, code: string, now: number): Game {
  return {
    host: hostId,
    code,
    status: 'waiting',
    playerOrder: [hostId],
    players: {[hostId]: newPlayer(hostName)},
    deck: [],
    state: {phase: 'action', currentTurnPlayer: hostId, turnNumber: 0, pending: null, lastAction: null},
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
  if (game.status !== 'waiting' || playerId === game.host || !game.players[playerId]) {
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
      {card: deck.shift()!, revealed: false},
      {card: deck.shift()!, revealed: false},
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
  };
  next.log = ['Game started'];
  return next;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest lobby`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```powershell
git add src/engine; git commit -m "Add lobby: create, join, leave, start"
```

---

### Task 4: Rule tables and queries

**Files:**
- Create: `src/engine/rules.ts`, `src/engine/testHelpers.ts`
- Test: `src/engine/__tests__/rules.test.ts`

- [ ] **Step 1: Write the test helpers**

`src/engine/testHelpers.ts` (lives outside `__tests__` so Jest does not treat it as a test file):

```ts
import {applyAction} from './actions';
import {Rng} from './deck';
import {Card, Game, GameAction, Pending, Player} from './types';

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

/** Applies actions in order with the identity rng. */
export function play(game: Game, ...actions: GameAction[]): Game {
  return actions.reduce((state, action) => applyAction(state, action, identityRng), game);
}
```

`testHelpers.ts` imports `./actions`, which is created in Task 5. For this task, create a temporary one-line `src/engine/actions.ts` so the import resolves; Task 5 replaces it:

```ts
export {};
```

and, for this task only, leave the `play` function and the `applyAction`/`GameAction` imports out of `testHelpers.ts`. Task 5 Step 1 adds them back.

- [ ] **Step 2: Write the failing test**

`src/engine/__tests__/rules.test.ts`:

```ts
import {availableActions, isAlive, livingPlayers, pendingResponders, responseOptions} from '../rules';
import {makeGame, makePending} from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']}, {coins});

describe('livingPlayers', () => {
  it('excludes players with no hidden cards', () => {
    const game = three();
    game.players.b.influence.forEach(i => (i.revealed = true));
    expect(livingPlayers(game)).toEqual(['a', 'c']);
    expect(isAlive(game, 'b')).toBe(false);
  });
});

describe('availableActions', () => {
  it('offers the free actions at 2 coins', () => {
    expect(availableActions(three(), 'a')).toEqual(['income', 'foreignAid', 'tax', 'steal', 'exchange']);
  });

  it('adds assassinate at 3 coins and coup at 7', () => {
    expect(availableActions(three({a: 3}), 'a')).toContain('assassinate');
    expect(availableActions(three({a: 3}), 'a')).not.toContain('coup');
    expect(availableActions(three({a: 7}), 'a')).toContain('coup');
  });

  it('forces coup at 10 coins', () => {
    expect(availableActions(three({a: 10}), 'a')).toEqual(['coup']);
  });

  it('offers nothing to players whose turn it is not', () => {
    expect(availableActions(three(), 'b')).toEqual([]);
  });

  it('offers nothing outside the action phase', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke'});
    expect(availableActions(game, 'a')).toEqual([]);
  });
});

describe('pendingResponders and responseOptions', () => {
  it('asks every other living player about a claimed action', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke'});
    expect(pendingResponders(game)).toEqual(['b', 'c']);
    expect(responseOptions(game, 'b')).toEqual({canChallenge: true, blockClaims: []});
    expect(responseOptions(game, 'a')).toBeNull();
  });

  it('lets anyone block foreign aid as Duke but not challenge it', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'foreignAid'});
    expect(responseOptions(game, 'c')).toEqual({canChallenge: false, blockClaims: ['Duke']});
  });

  it('lets only the target block a steal', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'steal', target: 'b', claim: 'Captain'});
    expect(responseOptions(game, 'b')).toEqual({canChallenge: true, blockClaims: ['Captain', 'Ambassador']});
    expect(responseOptions(game, 'c')).toEqual({canChallenge: true, blockClaims: []});
  });

  it('stops asking players who passed or are eliminated', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({actor: 'a', action: 'tax', claim: 'Duke', responses: {b: 'pass'}});
    expect(pendingResponders(game)).toEqual(['c']);
    game.players.c.influence.forEach(i => (i.revealed = true));
    expect(pendingResponders(game)).toEqual([]);
  });

  it('asks only the target, block-only, after a failed challenge', () => {
    const game = three();
    game.state.phase = 'awaitingResponses';
    game.state.pending = makePending({
      actor: 'a',
      action: 'steal',
      target: 'b',
      claim: 'Captain',
      challengeResolved: true,
    });
    expect(pendingResponders(game)).toEqual(['b']);
    expect(responseOptions(game, 'b')).toEqual({canChallenge: false, blockClaims: ['Captain', 'Ambassador']});
    expect(responseOptions(game, 'c')).toBeNull();
  });

  it('asks everyone but the blocker about a block', () => {
    const game = three();
    game.state.phase = 'awaitingBlockResponses';
    game.state.pending = makePending({
      actor: 'a',
      action: 'foreignAid',
      block: {blocker: 'b', claim: 'Duke', responses: {}},
    });
    expect(pendingResponders(game)).toEqual(['a', 'c']);
    expect(responseOptions(game, 'a')).toEqual({canChallenge: true, blockClaims: []});
    expect(responseOptions(game, 'b')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest rules`
Expected: FAIL — `Cannot find module '../rules'`

- [ ] **Step 4: Implement the rules**

`src/engine/rules.ts`:

```ts
import {ActionType, Card, Game, Player} from './types';

export const FORCED_COUP_COINS = 10;

export const ACTION_COST: Record<ActionType, number> = {
  income: 0,
  foreignAid: 0,
  coup: 7,
  tax: 0,
  assassinate: 3,
  steal: 0,
  exchange: 0,
};

/** Character a player claims to hold when declaring the action. */
export const ACTION_CLAIM: Record<ActionType, Card | null> = {
  income: null,
  foreignAid: null,
  coup: null,
  tax: 'Duke',
  assassinate: 'Assassin',
  steal: 'Captain',
  exchange: 'Ambassador',
};

/** Characters that may be claimed to block the action. */
export const BLOCK_CLAIMS: Record<ActionType, Card[]> = {
  income: [],
  foreignAid: ['Duke'],
  coup: [],
  tax: [],
  assassinate: ['Contessa'],
  steal: ['Captain', 'Ambassador'],
  exchange: [],
};

export const TARGETED: ActionType[] = ['coup', 'assassinate', 'steal'];

export function unrevealedCount(player: Player): number {
  return player.influence.filter(i => !i.revealed).length;
}

export function isAlive(game: Game, playerId: string): boolean {
  const player = game.players[playerId];
  return !!player && unrevealedCount(player) > 0;
}

export function livingPlayers(game: Game): string[] {
  return game.playerOrder.filter(id => isAlive(game, id));
}

/** Actions the player may declare right now. Empty when it is not their turn to act. */
export function availableActions(game: Game, playerId: string): ActionType[] {
  const {phase, currentTurnPlayer} = game.state;
  if (game.status !== 'playing' || phase !== 'action' || currentTurnPlayer !== playerId) {
    return [];
  }
  const coins = game.players[playerId].coins;
  if (coins >= FORCED_COUP_COINS) {
    return ['coup'];
  }
  return (Object.keys(ACTION_COST) as ActionType[]).filter(action => coins >= ACTION_COST[action]);
}

/** Players who still have to pass, challenge or block before the game can continue. */
export function pendingResponders(game: Game): string[] {
  const {phase, pending} = game.state;
  if (!pending) {
    return [];
  }
  if (phase === 'awaitingResponses') {
    const asked = pending.challengeResolved
      ? pending.target
        ? [pending.target]
        : []
      : game.playerOrder.filter(id => id !== pending.actor);
    return asked.filter(id => isAlive(game, id) && !pending.responses[id]);
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    const block = pending.block;
    return livingPlayers(game).filter(id => id !== block.blocker && !block.responses[id]);
  }
  return [];
}

export interface ResponseOptions {
  canChallenge: boolean;
  blockClaims: Card[];
}

/** What the player may do besides passing, or null when they are not being asked. */
export function responseOptions(game: Game, playerId: string): ResponseOptions | null {
  const pending = game.state.pending;
  if (!pending || !pendingResponders(game).includes(playerId)) {
    return null;
  }
  if (game.state.phase === 'awaitingBlockResponses') {
    return {canChallenge: true, blockClaims: []};
  }
  const claims = BLOCK_CLAIMS[pending.action];
  const mayBlock = claims.length > 0 && (pending.action === 'foreignAid' || pending.target === playerId);
  return {
    canChallenge: pending.claim !== null && !pending.challengeResolved,
    blockClaims: mayBlock ? claims : [],
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx jest rules`
Expected: PASS, 12 tests

- [ ] **Step 6: Commit**

```powershell
git add src/engine; git commit -m "Add rule tables and response queries"
```

---

### Task 5: applyAction core — income, coup, losing influence, turn order, win

**Files:**
- Create (replace stub): `src/engine/actions.ts`
- Modify: `src/engine/testHelpers.ts`
- Test: `src/engine/__tests__/actions.core.test.ts`

- [ ] **Step 1: Restore `play` in the test helpers**

Make `src/engine/testHelpers.ts` match the full listing in Task 4 Step 1 (with the `applyAction` and `GameAction` imports and the `play` function).

- [ ] **Step 2: Write the failing test**

`src/engine/__tests__/actions.core.test.ts`:

```ts
import {applyAction} from '../actions';
import {identityRng, makeGame, play} from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']}, {coins});

describe('income', () => {
  it('gives 1 coin and passes the turn', () => {
    const game = play(three(), {type: 'income', playerId: 'a'});
    expect(game.players.a.coins).toBe(3);
    expect(game.state).toEqual({
      phase: 'action',
      currentTurnPlayer: 'b',
      turnNumber: 2,
      pending: null,
      lastAction: {playerId: 'a', action: 'income', target: null, blocked: false},
    });
  });

  it('does not mutate the input game', () => {
    const game = three();
    const before = JSON.stringify(game);
    play(game, {type: 'income', playerId: 'a'});
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('illegal input', () => {
  it('rejects a player acting out of turn', () => {
    expect(() => play(three(), {type: 'income', playerId: 'b'})).toThrow('It is not your turn');
  });

  it('rejects a player who is not in the game', () => {
    expect(() => play(three(), {type: 'income', playerId: 'z'})).toThrow('You are not in this game');
  });

  it('rejects actions when the game is not in progress', () => {
    const game = three();
    game.status = 'waiting';
    expect(() => applyAction(game, {type: 'income', playerId: 'a'}, identityRng)).toThrow(
      'Game is not in progress',
    );
  });

  it('throws an error named IllegalActionError', () => {
    try {
      play(three(), {type: 'income', playerId: 'b'});
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as Error).name).toBe('IllegalActionError');
    }
  });
});

describe('coup', () => {
  it('needs 7 coins', () => {
    expect(() => play(three(), {type: 'coup', playerId: 'a', target: 'b'})).toThrow('Not enough coins');
  });

  it('needs a living opponent as target', () => {
    const game = three({a: 7});
    expect(() => play(game, {type: 'coup', playerId: 'a', target: 'a'})).toThrow('Choose a living opponent');
    game.players.b.influence.forEach(i => (i.revealed = true));
    expect(() => play(game, {type: 'coup', playerId: 'a', target: 'b'})).toThrow('Choose a living opponent');
  });

  it('costs 7 and makes the target choose a card to lose', () => {
    const declared = play(three({a: 7}), {type: 'coup', playerId: 'a', target: 'b'});
    expect(declared.players.a.coins).toBe(0);
    expect(declared.state.phase).toBe('loseInfluence');
    expect(declared.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'endTurn'});

    const done = play(declared, {type: 'loseInfluence', playerId: 'b', cardIndex: 1});
    expect(done.players.b.influence).toEqual([
      {card: 'Contessa', revealed: false},
      {card: 'Assassin', revealed: true},
    ]);
    expect(done.state.phase).toBe('action');
    expect(done.state.currentTurnPlayer).toBe('b');
    expect(done.state.turnNumber).toBe(2);
    expect(done.state.pending).toBeNull();
  });

  it('only lets the chosen player pick, and only a hidden card', () => {
    const declared = play(three({a: 7}), {type: 'coup', playerId: 'a', target: 'b'});
    expect(() => play(declared, {type: 'loseInfluence', playerId: 'c', cardIndex: 0})).toThrow(
      'You do not need to lose a card',
    );
    expect(() => play(declared, {type: 'loseInfluence', playerId: 'b', cardIndex: 5})).toThrow(
      'That card is not available',
    );
  });

  it('is forced at 10 or more coins', () => {
    expect(() => play(three({a: 10}), {type: 'income', playerId: 'a'})).toThrow(
      'You must Coup with 10 or more coins',
    );
  });

  it('reveals the last card automatically and eliminates the player', () => {
    const game = three({a: 7});
    game.players.b.influence[0].revealed = true;
    const done = play(game, {type: 'coup', playerId: 'a', target: 'b'});
    expect(done.players.b.influence.every(i => i.revealed)).toBe(true);
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.phase).toBe('action');
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('ends the game when one player remains', () => {
    const game = makeGame({a: ['Duke', 'Captain'], b: ['Contessa']}, {coins: {a: 7}});
    const done = play(game, {type: 'coup', playerId: 'a', target: 'b'});
    expect(done.status).toBe('finished');
    expect(done.state.phase).toBe('finished');
    expect(done.winner).toBe('a');
    expect(done.log[done.log.length - 1]).toBe('A wins');
  });
});

describe('turn order', () => {
  it('skips eliminated players', () => {
    const game = three();
    game.players.b.influence.forEach(i => (i.revealed = true));
    game.players.b.eliminatedAt = 0;
    expect(play(game, {type: 'income', playerId: 'a'}).state.currentTurnPlayer).toBe('c');
  });

  it('wraps around to the first player', () => {
    const game = three();
    game.state.currentTurnPlayer = 'c';
    expect(play(game, {type: 'income', playerId: 'c'}).state.currentTurnPlayer).toBe('a');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest actions.core`
Expected: FAIL — `applyAction is not a function` (stub file exports nothing)

- [ ] **Step 4: Implement the core state machine**

Replace `src/engine/actions.ts` with:

```ts
import {Rng} from './deck';
import {
  ACTION_CLAIM,
  ACTION_COST,
  BLOCK_CLAIMS,
  FORCED_COUP_COINS,
  TARGETED,
  isAlive,
  livingPlayers,
  unrevealedCount,
} from './rules';
import {Continuation, DeclareAction, Game, GameAction, IllegalActionError} from './types';

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
    default:
      fail('Unknown action');
  }
  return g;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx jest actions.core`
Expected: PASS, 15 tests

- [ ] **Step 6: Commit**

```powershell
git add src/engine; git commit -m "Add applyAction core: income, coup, influence loss, turn order"
```

---

### Task 6: Passing and blocking

**Files:**
- Modify: `src/engine/actions.ts`
- Test: `src/engine/__tests__/actions.responses.test.ts`

- [ ] **Step 1: Write the failing test**

`src/engine/__tests__/actions.responses.test.ts`:

```ts
import {makeGame, play} from '../testHelpers';

const three = (coins: Record<string, number> = {}) =>
  makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']}, {coins});

describe('passing', () => {
  it('resolves foreign aid only after everyone else passes', () => {
    const declared = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(declared.state.phase).toBe('awaitingResponses');
    expect(declared.players.a.coins).toBe(2);

    const onePass = play(declared, {type: 'pass', playerId: 'b'});
    expect(onePass.state.phase).toBe('awaitingResponses');
    expect(onePass.players.a.coins).toBe(2);

    const done = play(onePass, {type: 'pass', playerId: 'c'});
    expect(done.players.a.coins).toBe(4);
    expect(done.state.currentTurnPlayer).toBe('b');
    expect(done.state.phase).toBe('action');
  });

  it('rejects a pass from the actor or a second pass', () => {
    const declared = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(() => play(declared, {type: 'pass', playerId: 'a'})).toThrow('You have nothing to respond to');
    const onePass = play(declared, {type: 'pass', playerId: 'b'});
    expect(() => play(onePass, {type: 'pass', playerId: 'b'})).toThrow('You have nothing to respond to');
  });

  it('resolves tax for 3 coins', () => {
    const done = play(
      three(),
      {type: 'tax', playerId: 'a'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.a.coins).toBe(5);
  });

  it('resolves steal for up to 2 coins', () => {
    const full = play(
      three(),
      {type: 'steal', playerId: 'a', target: 'b'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(full.players.a.coins).toBe(4);
    expect(full.players.b.coins).toBe(0);

    const partial = play(
      three({b: 1}),
      {type: 'steal', playerId: 'a', target: 'b'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(partial.players.a.coins).toBe(3);
    expect(partial.players.b.coins).toBe(0);
  });
});

describe('blocking', () => {
  it('cancels foreign aid when a Duke block goes unchallenged', () => {
    const blocked = play(three(), {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(blocked.state.phase).toBe('awaitingBlockResponses');
    expect(blocked.state.pending?.block).toEqual({blocker: 'b', claim: 'Duke', responses: {}});

    const done = play(blocked, {type: 'pass', playerId: 'a'}, {type: 'pass', playerId: 'c'});
    expect(done.players.a.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('does not let the blocker pass on their own block', () => {
    const blocked = play(three(), {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(() => play(blocked, {type: 'pass', playerId: 'b'})).toThrow('You have nothing to respond to');
  });

  it('does not allow blocking tax', () => {
    const declared = play(three(), {type: 'tax', playerId: 'a'});
    expect(() => play(declared, {type: 'block', playerId: 'b', claim: 'Duke'})).toThrow('You cannot block now');
  });

  it('lets only the target block a steal, and only as Captain or Ambassador', () => {
    const declared = play(three(), {type: 'steal', playerId: 'a', target: 'b'});
    expect(() => play(declared, {type: 'block', playerId: 'c', claim: 'Captain'})).toThrow('You cannot block now');
    expect(() => play(declared, {type: 'block', playerId: 'b', claim: 'Duke'})).toThrow('You cannot block now');

    const done = play(
      declared,
      {type: 'block', playerId: 'b', claim: 'Ambassador'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.a.coins).toBe(2);
    expect(done.players.b.coins).toBe(2);
    expect(done.state.lastAction?.blocked).toBe(true);
  });

  it('does not allow blocking a block', () => {
    const blocked = play(three(), {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(() => play(blocked, {type: 'block', playerId: 'c', claim: 'Duke'})).toThrow('You cannot block now');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest actions.responses`
Expected: FAIL — every test throws `Unknown action`

- [ ] **Step 3: Implement pass and block**

In `src/engine/actions.ts`:

a) Add `pendingResponders` and `responseOptions` to the `./rules` import, and `Card` to the `./types` import:

```ts
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
```

b) Add these two functions directly above `applyAction`:

```ts
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
```

c) In the `switch` inside `applyAction`, add these cases above `default:`:

```ts
    case 'pass':
      pass(g, id, rng);
      break;
    case 'block':
      block(g, id, action.claim);
      break;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest actions`
Expected: PASS — `actions.core` 15 tests, `actions.responses` 9 tests

- [ ] **Step 5: Commit**

```powershell
git add src/engine; git commit -m "Add passing and blocking"
```

---

### Task 7: Challenges

**Files:**
- Modify: `src/engine/actions.ts`
- Test: `src/engine/__tests__/actions.challenges.test.ts`

- [ ] **Step 1: Write the failing test**

`src/engine/__tests__/actions.challenges.test.ts`:

```ts
import {makeGame, play} from '../testHelpers';

describe('challenging an action', () => {
  it('costs the challenger a card when the claim is true, and swaps the proven card', () => {
    const game = makeGame(
      {a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']},
      {deck: ['Contessa', 'Assassin', 'Captain']},
    );
    const challenged = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'b'});
    expect(challenged.players.a.influence[0]).toEqual({card: 'Contessa', revealed: false});
    expect(challenged.deck).toEqual(['Assassin', 'Captain', 'Duke']);
    expect(challenged.state.phase).toBe('loseInfluence');
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'afterFailedChallenge'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(done.players.b.influence[0].revealed).toBe(true);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('costs the actor a card and cancels the action when the claim is a bluff', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    const challenged = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'c'});
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'a', cardIndex: 0});
    expect(done.players.a.coins).toBe(2);
    expect(done.players.a.influence[0].revealed).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('eliminates a one-card challenger automatically and still resolves the action', () => {
    const game = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    game.players.c.influence[0].revealed = true;
    const done = play(game, {type: 'tax', playerId: 'a'}, {type: 'challenge', playerId: 'c'});
    expect(done.players.c.eliminatedAt).toBe(1);
    expect(done.players.a.coins).toBe(5);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('is not allowed against unclaimed actions or by the actor', () => {
    const three = () => makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});
    const aid = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(() => play(aid, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');
    const tax = play(three(), {type: 'tax', playerId: 'a'});
    expect(() => play(tax, {type: 'challenge', playerId: 'a'})).toThrow('You cannot challenge now');
  });
});

describe('challenging a block', () => {
  it('upholds a true block: challenger loses a card, blocker swaps the proven card', () => {
    const game = makeGame(
      {a: ['Captain', 'Captain'], b: ['Duke', 'Contessa'], c: ['Ambassador', 'Assassin']},
      {deck: ['Assassin', 'Ambassador', 'Captain']},
    );
    const challenged = play(
      game,
      {type: 'foreignAid', playerId: 'a'},
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'a'},
    );
    expect(challenged.players.b.influence[0]).toEqual({card: 'Assassin', revealed: false});
    expect(challenged.state.lastAction?.blocked).toBe(true);
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'a', cardIndex: 0});
    expect(done.players.a.coins).toBe(2);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('defeats a bluffed block: blocker loses a card and the action goes through', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Contessa', 'Contessa'], c: ['Ambassador', 'Assassin']});
    const challenged = play(
      game,
      {type: 'foreignAid', playerId: 'a'},
      {type: 'block', playerId: 'b', claim: 'Duke'},
      {type: 'challenge', playerId: 'c'},
    );
    expect(challenged.state.pending?.block).toBeNull();
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'resolveAction'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(done.players.a.coins).toBe(4);
    expect(done.state.lastAction?.blocked).toBe(false);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('cannot be challenged by the blocker', () => {
    const game = makeGame({a: ['Captain', 'Captain'], b: ['Duke', 'Contessa'], c: ['Ambassador', 'Assassin']});
    const blocked = play(game, {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(() => play(blocked, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest actions.challenges`
Expected: FAIL — tests throw `Unknown action`

- [ ] **Step 3: Implement challenges**

In `src/engine/actions.ts`:

a) Change the deck import to:

```ts
import {Rng, shuffle} from './deck';
```

b) Add these functions directly above `applyAction`:

```ts
/** Index of a hidden copy of `card` in the player's hand, or -1. */
function hiddenCardIndex(g: Game, playerId: string, card: Card): number {
  return g.players[playerId].influence.findIndex(inf => !inf.revealed && inf.card === card);
}

/** A proven card goes back into the deck and is replaced by a fresh draw. */
function swapProvenCard(g: Game, playerId: string, cardIndex: number, rng: Rng): void {
  const player = g.players[playerId];
  const deck = shuffle([...g.deck, player.influence[cardIndex].card], rng);
  player.influence[cardIndex] = {card: deck.shift()!, revealed: false};
  g.deck = deck;
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
    if (index >= 0) {
      log(g, `${challenger} challenges ${blocker}, who shows ${blockClaim.claim}`);
      swapProvenCard(g, blockClaim.blocker, index, rng);
      g.state.lastAction!.blocked = true;
      return requireLoseInfluence(g, challengerId, 'endTurn', rng);
    }
    log(g, `${challenger} challenges ${blocker}, who was bluffing`);
    pending.block = null;
    return requireLoseInfluence(g, blockClaim.blocker, 'resolveAction', rng);
  }

  const claim = pending.claim!;
  const actor = nameOf(g, pending.actor);
  const index = hiddenCardIndex(g, pending.actor, claim);
  if (index >= 0) {
    log(g, `${challenger} challenges ${actor}, who shows ${claim}`);
    swapProvenCard(g, pending.actor, index, rng);
    return requireLoseInfluence(g, challengerId, 'afterFailedChallenge', rng);
  }
  log(g, `${challenger} challenges ${actor}, who was bluffing`);
  // The action never happened, so anything paid for it is returned.
  g.players[pending.actor].coins += ACTION_COST[pending.action];
  requireLoseInfluence(g, pending.actor, 'endTurn', rng);
}
```

c) In the `switch` inside `applyAction`, add above `default:`:

```ts
    case 'challenge':
      challenge(g, id, rng);
      break;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest actions`
Expected: PASS — core 15, responses 9, challenges 7

- [ ] **Step 5: Commit**

```powershell
git add src/engine; git commit -m "Add challenges for actions and blocks"
```

---

### Task 8: Assassinate and Exchange

**Files:**
- Modify: `src/engine/actions.ts`
- Test: `src/engine/__tests__/actions.characters.test.ts`

- [ ] **Step 1: Write the test**

`src/engine/__tests__/actions.characters.test.ts`:

```ts
import {pendingResponders, responseOptions} from '../rules';
import {makeGame, play} from '../testHelpers';

describe('assassinate', () => {
  const setup = (aHand: ['Assassin', 'Duke'] | ['Duke', 'Duke'] = ['Assassin', 'Duke']) =>
    makeGame({a: aHand, b: ['Duke', 'Captain'], c: ['Captain', 'Ambassador']}, {coins: {a: 3}});

  it('costs 3 and makes the target lose a card when unopposed', () => {
    const resolved = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(resolved.players.a.coins).toBe(0);
    expect(resolved.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'endTurn'});

    const done = play(resolved, {type: 'loseInfluence', playerId: 'b', cardIndex: 1});
    expect(done.players.b.influence[1].revealed).toBe(true);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('keeps the 3 coins spent when blocked by Contessa', () => {
    const done = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.a.coins).toBe(0);
    expect(done.players.b.influence.some(i => i.revealed)).toBe(false);
    expect(done.state.lastAction?.blocked).toBe(true);
  });

  it('refunds the 3 coins when the Assassin claim is exposed as a bluff', () => {
    const challenged = play(
      setup(['Duke', 'Duke']),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'b'},
    );
    expect(challenged.players.a.coins).toBe(3);
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'a', next: 'endTurn'});
  });

  it('costs the target both cards when a Contessa bluff is exposed', () => {
    const challenged = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'challenge', playerId: 'a'},
    );
    expect(challenged.state.pending?.loseInfluence).toEqual({playerId: 'b', next: 'resolveAction'});

    const done = play(challenged, {type: 'loseInfluence', playerId: 'b', cardIndex: 0});
    expect(done.players.b.influence.every(i => i.revealed)).toBe(true);
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('gives the target a block-only window after their own failed challenge', () => {
    const challenged = play(
      setup(),
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'b'},
      {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    );
    expect(challenged.state.phase).toBe('awaitingResponses');
    expect(challenged.state.pending?.challengeResolved).toBe(true);
    expect(pendingResponders(challenged)).toEqual(['b']);
    expect(responseOptions(challenged, 'b')).toEqual({canChallenge: false, blockClaims: ['Contessa']});
    expect(() => play(challenged, {type: 'challenge', playerId: 'b'})).toThrow('You cannot challenge now');

    const done = play(challenged, {type: 'pass', playerId: 'b'});
    expect(done.players.b.eliminatedAt).toBe(1);
    expect(done.state.currentTurnPlayer).toBe('c');
  });

  it('still lets the target block after another player fails a challenge', () => {
    const game = makeGame(
      {a: ['Assassin', 'Duke'], b: ['Contessa', 'Captain'], c: ['Captain', 'Ambassador']},
      {coins: {a: 3}},
    );
    const done = play(
      game,
      {type: 'assassinate', playerId: 'a', target: 'b'},
      {type: 'challenge', playerId: 'c'},
      {type: 'loseInfluence', playerId: 'c', cardIndex: 0},
      {type: 'block', playerId: 'b', claim: 'Contessa'},
      {type: 'pass', playerId: 'a'},
      {type: 'pass', playerId: 'c'},
    );
    expect(done.players.c.influence[0].revealed).toBe(true);
    expect(done.players.b.influence.some(i => i.revealed)).toBe(false);
    expect(done.players.a.coins).toBe(0);
    expect(done.state.currentTurnPlayer).toBe('b');
  });
});

describe('exchange', () => {
  const setup = () =>
    makeGame(
      {a: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'], c: ['Captain', 'Duke']},
      {deck: ['Contessa', 'Assassin', 'Captain']},
    );
  const toExchange = (game = setup()) =>
    play(game, {type: 'exchange', playerId: 'a'}, {type: 'pass', playerId: 'b'}, {type: 'pass', playerId: 'c'});

  it('offers the hand plus two drawn cards', () => {
    const game = toExchange();
    expect(game.state.phase).toBe('exchange');
    expect(game.state.pending?.exchangeOptions).toEqual(['Ambassador', 'Duke', 'Contessa', 'Assassin']);
    expect(game.deck).toEqual(['Captain']);
  });

  it('keeps the chosen cards and returns the rest to the deck', () => {
    const done = play(toExchange(), {type: 'exchangeChoose', playerId: 'a', keep: [2, 3]});
    expect(done.players.a.influence).toEqual([
      {card: 'Contessa', revealed: false},
      {card: 'Assassin', revealed: false},
    ]);
    expect(done.deck).toEqual(['Captain', 'Ambassador', 'Duke']);
    expect(done.state.currentTurnPlayer).toBe('b');
  });

  it('keeps exactly one card when the player has one hidden card', () => {
    const game = setup();
    game.players.a.influence[0].revealed = true;
    const exchanging = toExchange(game);
    expect(exchanging.state.pending?.exchangeOptions).toEqual(['Duke', 'Contessa', 'Assassin']);
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [1, 2]})).toThrow(
      'Choose exactly 1 card(s)',
    );

    const done = play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [1]});
    expect(done.players.a.influence).toEqual([
      {card: 'Ambassador', revealed: true},
      {card: 'Contessa', revealed: false},
    ]);
    expect(done.deck).toHaveLength(3);
  });

  it('rejects duplicate or out-of-range choices and other players', () => {
    const exchanging = toExchange();
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [0, 0]})).toThrow(
      'Choose exactly 2 card(s)',
    );
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'a', keep: [0, 9]})).toThrow(
      'Choose exactly 2 card(s)',
    );
    expect(() => play(exchanging, {type: 'exchangeChoose', playerId: 'b', keep: [0, 1]})).toThrow(
      'You are not exchanging cards',
    );
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx jest actions.characters`
Expected: the 6 `assassinate` tests and `offers the hand plus two drawn cards` PASS (Tasks 5–7 already cover them). The other 3 `exchange` tests FAIL with `Unknown action`. If any assassinate test fails, fix `actions.ts` before continuing — the expected values above are the specification.

- [ ] **Step 3: Implement exchangeChoose**

In `src/engine/actions.ts`, add directly above `applyAction`:

```ts
function exchangeChoose(g: Game, playerId: string, keep: number[], rng: Rng): void {
  const pending = g.state.pending;
  if (g.state.phase !== 'exchange' || !pending || pending.actor !== playerId || !pending.exchangeOptions) {
    fail('You are not exchanging cards');
  }
  const options = pending.exchangeOptions;
  const slots = hiddenIndexes(g, playerId);
  const valid =
    keep.length === slots.length &&
    new Set(keep).size === keep.length &&
    keep.every(i => Number.isInteger(i) && i >= 0 && i < options.length);
  if (!valid) {
    fail(`Choose exactly ${slots.length} card(s)`);
  }
  const actor = g.players[playerId];
  slots.forEach((slot, n) => {
    actor.influence[slot] = {card: options[keep[n]], revealed: false};
  });
  const returned = options.filter((_, i) => !keep.includes(i));
  g.deck = shuffle([...g.deck, ...returned], rng);
  log(g, `${actor.name} exchanges cards`);
  endTurn(g);
}
```

In the `switch` inside `applyAction`, add above `default:`:

```ts
    case 'exchangeChoose':
      exchangeChoose(g, id, action.keep, rng);
      break;
```

- [ ] **Step 4: Run the whole engine suite**

Run: `npx jest src/engine`
Expected: PASS — all suites (deck 4, lobby 13, rules 12, core 15, responses 9, challenges 7, characters 10)

- [ ] **Step 5: Commit**

```powershell
git add src/engine; git commit -m "Add assassinate coverage and ambassador exchange"
```

---

### Task 9: Status text and a full scripted game

**Files:**
- Create: `src/engine/describe.ts`
- Test: `src/engine/__tests__/describe.test.ts`, `src/engine/__tests__/fullGame.test.ts`

- [ ] **Step 1: Write the failing describe test**

`src/engine/__tests__/describe.test.ts`:

```ts
import {promptLine, statusLine} from '../describe';
import {makeGame, play} from '../testHelpers';

const three = () => makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});

describe('statusLine', () => {
  it('names whose turn it is', () => {
    expect(statusLine(three())).toBe("A's turn");
  });

  it('names who still has to respond to an action', () => {
    const game = play(three(), {type: 'steal', playerId: 'a', target: 'b'}, {type: 'pass', playerId: 'c'});
    expect(statusLine(game)).toBe('A: Steal on B. Waiting for B');
  });

  it('names who still has to respond to a block', () => {
    const game = play(three(), {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(statusLine(game)).toBe('B blocks with Duke. Waiting for A, C');
  });

  it('names who must lose a card', () => {
    const game = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin']}, {coins: {a: 7}});
    expect(statusLine(play(game, {type: 'coup', playerId: 'a', target: 'b'}))).toBe('B must lose a card');
  });

  it('names the exchanging player and the winner', () => {
    const exchanging = play(
      three(),
      {type: 'exchange', playerId: 'a'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(statusLine(exchanging)).toBe('A is exchanging cards');

    const finished = makeGame({a: ['Duke', 'Captain'], b: ['Contessa']}, {coins: {a: 7}});
    expect(statusLine(play(finished, {type: 'coup', playerId: 'a', target: 'b'}))).toBe('A wins');
  });
});

describe('promptLine', () => {
  it('describes a claimed action', () => {
    expect(promptLine(play(three(), {type: 'tax', playerId: 'a'}))).toBe('A claims Duke: Tax');
    expect(promptLine(play(three(), {type: 'steal', playerId: 'a', target: 'b'}))).toBe(
      'A claims Captain: Steal on B',
    );
  });

  it('describes an unclaimed action and a block', () => {
    const aid = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(promptLine(aid)).toBe('A uses Foreign Aid');
    expect(promptLine(play(aid, {type: 'block', playerId: 'b', claim: 'Duke'}))).toBe(
      'B claims Duke to block Foreign Aid',
    );
  });

  it('is empty when nothing is pending', () => {
    expect(promptLine(three())).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest describe`
Expected: FAIL — `Cannot find module '../describe'`

- [ ] **Step 3: Implement describe**

`src/engine/describe.ts`:

```ts
import {pendingResponders} from './rules';
import {ActionType, Game, Pending} from './types';

export const ACTION_LABEL: Record<ActionType, string> = {
  income: 'Income',
  foreignAid: 'Foreign Aid',
  coup: 'Coup',
  tax: 'Tax',
  assassinate: 'Assassinate',
  steal: 'Steal',
  exchange: 'Exchange',
};

/** Button text: label plus cost/gain and the character claimed. */
export const ACTION_BUTTON: Record<ActionType, string> = {
  income: 'Income +1',
  foreignAid: 'Foreign Aid +2',
  coup: 'Coup (7)',
  tax: 'Tax +3 · Duke',
  assassinate: 'Assassinate (3) · Assassin',
  steal: 'Steal 2 · Captain',
  exchange: 'Exchange · Ambassador',
};

function nameOf(game: Game, playerId: string | null): string {
  return (playerId && game.players[playerId]?.name) || '?';
}

function actionText(game: Game, pending: Pending): string {
  const onTarget = pending.target ? ` on ${nameOf(game, pending.target)}` : '';
  return `${ACTION_LABEL[pending.action]}${onTarget}`;
}

/** One line for the centre of the board: what the table is waiting for. */
export function statusLine(game: Game): string {
  const {phase, pending, currentTurnPlayer} = game.state;
  if (phase === 'finished') {
    return `${nameOf(game, game.winner)} wins`;
  }
  if (phase === 'action' || !pending) {
    return `${nameOf(game, currentTurnPlayer)}'s turn`;
  }
  const waiting = pendingResponders(game)
    .map(id => nameOf(game, id))
    .join(', ');
  if (phase === 'awaitingResponses') {
    return `${nameOf(game, pending.actor)}: ${actionText(game, pending)}. Waiting for ${waiting}`;
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    return `${nameOf(game, pending.block.blocker)} blocks with ${pending.block.claim}. Waiting for ${waiting}`;
  }
  if (phase === 'loseInfluence' && pending.loseInfluence) {
    return `${nameOf(game, pending.loseInfluence.playerId)} must lose a card`;
  }
  return `${nameOf(game, pending.actor)} is exchanging cards`;
}

/** What a responding player is being asked about. Empty when nothing is pending. */
export function promptLine(game: Game): string {
  const {phase, pending} = game.state;
  if (!pending) {
    return '';
  }
  if (phase === 'awaitingBlockResponses' && pending.block) {
    return `${nameOf(game, pending.block.blocker)} claims ${pending.block.claim} to block ${
      ACTION_LABEL[pending.action]
    }`;
  }
  const actor = nameOf(game, pending.actor);
  return pending.claim
    ? `${actor} claims ${pending.claim}: ${actionText(game, pending)}`
    : `${actor} uses ${actionText(game, pending)}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest describe`
Expected: PASS, 8 tests

- [ ] **Step 5: Write the full-game test**

`src/engine/__tests__/fullGame.test.ts`:

```ts
import {makeGame, play} from '../testHelpers';

it('plays a complete three-player game to a winner', () => {
  const start = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});

  const end = play(
    start,
    // Turn 1: A taxes -> A 5
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    {type: 'pass', playerId: 'c'},
    // Turn 2: B income -> B 3
    {type: 'income', playerId: 'b'},
    // Turn 3: C taxes -> C 5
    {type: 'tax', playerId: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 4: A taxes -> A 8
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    {type: 'pass', playerId: 'c'},
    // Turn 5: B assassinates C -> B 0, C loses Ambassador
    {type: 'assassinate', playerId: 'b', target: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'c'},
    {type: 'loseInfluence', playerId: 'c', cardIndex: 0},
    // Turn 6: C taxes -> C 8
    {type: 'tax', playerId: 'c'},
    {type: 'pass', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 7: A coups C -> A 1, C eliminated
    {type: 'coup', playerId: 'a', target: 'c'},
    // Turn 8: B income -> B 1
    {type: 'income', playerId: 'b'},
    // Turn 9: A taxes, B challenges and is wrong -> B loses Contessa, A 4
    {type: 'tax', playerId: 'a'},
    {type: 'challenge', playerId: 'b'},
    {type: 'loseInfluence', playerId: 'b', cardIndex: 0},
    // Turn 10: B income -> B 2
    {type: 'income', playerId: 'b'},
    // Turn 11: A taxes -> A 7
    {type: 'tax', playerId: 'a'},
    {type: 'pass', playerId: 'b'},
    // Turn 12: B income -> B 3
    {type: 'income', playerId: 'b'},
    // Turn 13: A coups B -> B eliminated, A wins
    {type: 'coup', playerId: 'a', target: 'b'},
  );

  expect(end.status).toBe('finished');
  expect(end.state.phase).toBe('finished');
  expect(end.winner).toBe('a');
  expect(end.players.a.coins).toBe(0);
  expect(end.players.b.eliminatedAt).toBe(13);
  expect(end.players.c.eliminatedAt).toBe(7);
  expect(end.state.turnNumber).toBe(13);
  expect(end.log[end.log.length - 1]).toBe('A wins');
  expect(() => play(end, {type: 'income', playerId: 'a'})).toThrow('Game is not in progress');
});
```

- [ ] **Step 6: Run it**

Run: `npx jest fullGame`
Expected: PASS. A failure here means an engine bug — fix `actions.ts`, not the test.

- [ ] **Step 7: Commit**

```powershell
git add src/engine; git commit -m "Add status text and full-game engine test"
```

---

### Task 10: Firebase-safe serialization

Firebase Realtime Database drops `null` values, empty arrays and empty objects on write. `normalizeGame` restores them on read so the engine always sees a complete `Game`.

**Files:**
- Create: `src/engine/serialize.ts`
- Test: `src/engine/__tests__/serialize.test.ts`

- [ ] **Step 1: Write the failing test**

`src/engine/__tests__/serialize.test.ts`:

```ts
import {newGame} from '../lobby';
import {normalizeGame} from '../serialize';
import {makeGame, play} from '../testHelpers';

/** Mimics what Realtime Database does to a value: nulls, empty arrays and empty objects vanish. */
function firebaseLike(value: unknown): unknown {
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

const three = () => makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'], c: ['Ambassador', 'Duke']});

describe('normalizeGame', () => {
  it('round-trips a waiting game', () => {
    const game = newGame('p1', 'P1', 'ABCDE', 1000);
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game awaiting responses', () => {
    const game = play(three(), {type: 'foreignAid', playerId: 'a'});
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game with a pending block', () => {
    const game = play(three(), {type: 'foreignAid', playerId: 'a'}, {type: 'block', playerId: 'b', claim: 'Duke'});
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a game waiting for a card to be lost', () => {
    const start = makeGame({a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin']}, {coins: {a: 7, b: 0}});
    const game = play(start, {type: 'coup', playerId: 'a', target: 'b'});
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips an exchange in progress with an empty deck', () => {
    const start = makeGame(
      {a: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'], c: ['Captain', 'Duke']},
      {deck: ['Contessa', 'Assassin']},
    );
    const game = play(
      start,
      {type: 'exchange', playerId: 'a'},
      {type: 'pass', playerId: 'b'},
      {type: 'pass', playerId: 'c'},
    );
    expect(game.deck).toEqual([]);
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('round-trips a finished game', () => {
    const start = makeGame({a: ['Duke', 'Captain'], b: ['Contessa']}, {coins: {a: 7}});
    const game = play(start, {type: 'coup', playerId: 'a', target: 'b'});
    expect(normalizeGame(firebaseLike(game))).toEqual(game);
  });

  it('accepts arrays that Firebase returned as keyed objects', () => {
    const raw = firebaseLike(three()) as Record<string, unknown>;
    raw.playerOrder = {0: 'a', 1: 'b', 2: 'c'};
    expect(normalizeGame(raw).playerOrder).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest serialize`
Expected: FAIL — `Cannot find module '../serialize'`

- [ ] **Step 3: Implement normalizeGame**

`src/engine/serialize.ts`:

```ts
import {Game, Player} from './types';

function toArray<T>(value: unknown): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : (Object.values(value as object) as T[]);
}

/**
 * Rebuilds a complete Game from a Realtime Database snapshot value.
 * The database omits nulls, empty arrays and empty objects; this puts them back.
 */
export function normalizeGame(raw: any): Game {
  const players: Record<string, Player> = {};
  Object.keys(raw.players ?? {}).forEach(id => {
    const player = raw.players[id];
    players[id] = {
      name: player.name,
      coins: player.coins ?? 0,
      influence: toArray(player.influence),
      eliminatedAt: player.eliminatedAt ?? null,
    };
  });

  const state = raw.state ?? {};
  const pending = state.pending;
  const lastAction = state.lastAction;

  return {
    host: raw.host,
    code: raw.code,
    status: raw.status,
    playerOrder: toArray(raw.playerOrder),
    players,
    deck: toArray(raw.deck),
    state: {
      phase: state.phase,
      currentTurnPlayer: state.currentTurnPlayer,
      turnNumber: state.turnNumber ?? 0,
      pending: pending
        ? {
            actor: pending.actor,
            action: pending.action,
            target: pending.target ?? null,
            claim: pending.claim ?? null,
            responses: pending.responses ?? {},
            challengeResolved: !!pending.challengeResolved,
            block: pending.block
              ? {
                  blocker: pending.block.blocker,
                  claim: pending.block.claim,
                  responses: pending.block.responses ?? {},
                }
              : null,
            loseInfluence: pending.loseInfluence ?? null,
            exchangeOptions: pending.exchangeOptions ? toArray(pending.exchangeOptions) : null,
          }
        : null,
      lastAction: lastAction
        ? {
            playerId: lastAction.playerId,
            action: lastAction.action,
            target: lastAction.target ?? null,
            blocked: !!lastAction.blocked,
          }
        : null,
    },
    log: toArray(raw.log),
    winner: raw.winner ?? null,
    createdAt: raw.createdAt ?? 0,
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest serialize`
Expected: PASS, 7 tests

- [ ] **Step 5: Full gate for Plan 1**

Run: `npx jest; npx tsc --noEmit`
Expected: all suites PASS (86 tests); `tsc` prints nothing.

- [ ] **Step 6: Commit**

```powershell
git add src/engine; git commit -m "Add Firebase-safe game normalization"
```

---

## Plan 1 done when

- `npx jest` is green with every engine suite.
- `npx tsc --noEmit` is clean.
- `src/engine` has no import from `react-native` or `firebase`.

Continue with `docs/plans/2026-10-02-coup-plan-2-app.md`.
