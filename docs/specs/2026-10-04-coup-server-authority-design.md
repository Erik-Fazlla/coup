# Coup Server Authority (Anti-Cheat) — Design

Date: 2026-10-04
Status: SHELVED on 2026-10-04. The Blaze plan is not available, so the app stays trust-based (cards hidden by the app, not by the database). Kept as a reference in case paid hosting or a free external server is chosen later. Nothing in this document is implemented.
Builds on: `2026-10-02-coup-design.md`, `2026-10-03-coup-ui-upgrade-design.md`.

## Goal

No player — including the host — can see another player's hidden cards or the deck, or change the game outside the rules, even by reading or writing the database directly.

## Why the current design cannot do this

Every phone runs the rules engine inside a database transaction, so every phone must be able to read and write the whole game: deck and all hands. Hiding is done by the app only. The fix is to move the rules to a place players cannot touch and give each phone only what its player may know.

## Approach

Firebase Cloud Functions run the existing engine (`src/engine`, unchanged in behaviour). Phones send requests; the server validates, applies them and publishes a redacted view.

### Identity

Firebase Anonymous Authentication. No sign-up screen: the app signs in silently on first launch and receives a stable `uid`. The `uid` becomes the player id. Existing local profiles keep their name and stats; the local player id is replaced by the `uid` on first launch after the update.

### Data layout

```
/games/{gameId}            PUBLIC VIEW. Readable by signed-in users. Written only by the server.
    host, code, status, round, scores, kicked, playerOrder, winner, createdAt
    players/{uid}: { name, coins, eliminatedAt,
                     influence: [ { revealed: true, card } | { revealed: false } ] }
    deckCount: number
    state: { phase, currentTurnPlayer, turnNumber, claimSeq, lastAction,
             pending: { actor, action, target, claim, responses, challengeResolved,
                        block, loseInfluence, exchanging: boolean } }
    log, eliminations, reveal

/hands/{gameId}/{uid}      PRIVATE. Readable only by that uid. Written only by the server.
    cards: [card, card]            (by influence slot; revealed slots included)
    exchangeOptions: [card] | null (only while this player is exchanging)

/secret/{gameId}           FULL GAME (deck, every hand). No client access at all.

/codes/{code}: gameId      Readable by signed-in users. Written only by the server.

/presence/{gameId}/{uid}   true while that phone is connected. Written by its owner
                           (set on connect, removed by onDisconnect). Readable by signed-in users.

/profiles/{uid}            Readable by signed-in users; writable only by its owner.
```

The public view never contains an unrevealed card name, the deck order, or another player's exchange options.

### Requests

Callable functions (HTTPS, authenticated, region `europe-west1` to sit next to the database):

| Function | Does |
|---|---|
| `createGame({ name })` | Reserves a code, creates the lobby, returns `gameId` |
| `joinGame({ code, name })` | Adds or re-admits the caller, returns `gameId` |
| `leaveLobby({ gameId })`, `cancelLobby({ gameId })`, `kickPlayer({ gameId, targetId })` | Lobby management |
| `startGame({ gameId })`, `rematch({ gameId })` | Host only |
| `act({ gameId, action })` | Any in-game action, including `skip` |

Each function: checks the caller is signed in; forces `playerId = caller uid` (a client can never act as someone else); runs the same engine function used today inside a transaction on `/secret/{gameId}`; on success writes the redacted `/games/{gameId}` and each `/hands/{gameId}/{uid}` in one multi-path update; on an `IllegalActionError` returns its message to the caller and writes nothing. Randomness (shuffle, codes) comes from the server.

Engine addition: `publicView(game)` and `handFor(game, uid)` — pure functions with tests asserting that no hidden card name appears anywhere in the public view for any reachable state (checked across the seeded random simulations).

### Client

- `gameService` keeps its interface (`createGame`, `joinGame`, `dispatch`, `subscribe`, …) so screens and `GameContext` do not change. Internally it calls the functions and subscribes to `/games/{gameId}` plus the caller's own `/hands/{gameId}/{uid}`, and merges them into the `Game` shape the UI already consumes. Unknown cards become an explicit `'Hidden'` placeholder that no component can render as a character (the UI already draws opponents' hidden cards without a name).
- Engine query functions used by the UI (`availableActions`, `pendingResponders`, `responseOptions`, text helpers) only depend on public information and keep working on the merged view.
- Presence: on connect each phone sets `/presence/{gameId}/{uid}` and registers `onDisconnect().remove()`. Seats show an online/offline dot. Presence is display-only; it never affects rules.

### Security rules

Default deny. Clients can write only their own presence and their own profile. Everything else is written by the server (the Admin SDK bypasses rules). Rules are covered by emulator tests: a signed-in client cannot read `/secret`, cannot read another player's `/hands`, cannot write `/games`, `/codes` or `/hands`; an unauthenticated client can read nothing.

### Costs and limits

- Requires the Firebase **Blaze** (pay-as-you-go) plan because Cloud Functions are not available on the free plan. Expected usage for a group of friends is far inside the free monthly allowance (2 million function calls); expected bill 0 EUR. A budget alert at 1 EUR is part of the setup steps.
- Each move makes one function call: typically 0.3–1 s, up to about 3 s on a cold start (first move after the functions have been idle). The UI already shows a busy state and has a 15 s timeout.
- The app needs a connection for every move (already true today).

## What the user must do (cannot be done for them)

1. Firebase console → upgrade the project to Blaze; set a 1 EUR budget alert.
2. Firebase console → Authentication → Sign-in method → enable **Anonymous**.
3. In a terminal, once: `npx firebase login`, then `npx firebase deploy --only functions,database` (deploys the functions and the new rules).

Until step 3 is done the new app version cannot play; the previous APK keeps working against the old rules until the new rules are deployed. Deploying the new rules ends compatibility with old APKs, so everyone updates at the same time.

## Testing

- Engine: `publicView` / `handFor` unit tests and a leak check over the seeded simulations.
- Functions + rules: the existing multi-client sync suite is ported to run against the Functions, Auth and Database emulators together (`firebase emulators:exec`), covering every existing scenario plus the access-control cases above and "a client cannot act as another player".
- Client: `gameService` tests for merging public view and hand; existing `GameContext` and screen tests stay unchanged because the service interface is unchanged.
- Manual: two phones on the real project after deploy.

## Migration

One release switches everything: new rules, functions, app. Games in progress at deploy time are abandoned (the old `/games` documents have a different shape and are deleted by a one-off cleanup in the deploy steps). Local profiles and stats are kept.

## Later, enabled by this

Push notification "your turn" while the phone is locked (Firebase Cloud Messaging, sent by the same functions). Not part of this work.

## Out of scope

Email/Google sign-in, moving profiles between phones, spectators, push notifications, iOS.
