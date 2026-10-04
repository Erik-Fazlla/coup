# Coup Card Game App — Design

Date: 2026-10-02
Status: approved in chat, pending written-spec review

## Goal

A multiplayer Coup card game for Android, built with React Native CLI, synced in real time through Firebase Realtime Database, distributed to friends as an APK from a private GitHub repo. Multiplayer only, 2–6 players (2–10 since the amendment of 2026-10-04 below), no AI opponents.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Hidden information | Trust-based: all hands stored in the game node, the app never renders other players' unrevealed cards | No auth in spec, free Firebase plan, friends only |
| Response window | Every other living player must tap Pass, Challenge or Block; no timer | No clock sync, no accidental misses |
| Rules | Full official base-game rules | Spec's subset leaves Captain unblockable |
| Sync model | Pure rules engine run inside a Firebase transaction by whichever client acts | No races, no host dependency, engine testable without device |
| Firebase client | Firebase JS SDK (`firebase` npm) | Config is a single file; no `google-services.json` or native setup |
| State | Context API + `useReducer` | Small app, no Redux needed |
| Player id | UUID generated on first launch, stored in AsyncStorage | Avoids a native device-id dependency |
| Language | TypeScript | Typed game state catches rule bugs early |
| Orientation | Locked landscape | Spec preference |

## Rules implemented

Deck: 15 cards, 3 each of Duke, Assassin, Captain, Ambassador, Contessa (20 cards, 4 each, for 7–10 players; see the amendment below). Each player starts with 2 coins and 2 face-down influence.

| Action | Cost | Effect | Claim | Blocked by |
|---|---|---|---|---|
| Income | 0 | +1 coin | none | — |
| Foreign Aid | 0 | +2 coins | none | Duke (any player) |
| Coup | 7 | Target loses an influence | none | — |
| Tax | 0 | +3 coins | Duke | — |
| Assassinate | 3 | Target loses an influence | Assassin | Contessa (target only) |
| Steal | 0 | Take up to 2 coins from target | Captain | Captain or Ambassador (target only) |
| Exchange | 0 | Draw 2, keep same number of cards as before, return 2 | Ambassador | — |

- Any other living player may challenge any character claim, including a block claim.
- Challenge resolution: if the claimant holds the card, the challenger loses an influence, and the claimant shuffles that card into the deck and draws a replacement. If not, the claimant loses an influence and the claimed action or block fails.
- A player who loses an influence chooses which card to reveal (automatic when only one remains).
- Assassinate's 3 coins are spent when declared and are not refunded if the action is blocked. They are refunded only if the Assassin claim itself is successfully challenged (the action never happened).
- A player holding 10 or more coins at the start of their turn must Coup.
- A player with both influence revealed is eliminated. Last player standing wins.

## Architecture

```
src/
  engine/       types.ts, deck.ts, rules.ts, actions.ts     pure TS, no RN or Firebase imports
  firebase/     config.ts, gameService.ts, profileService.ts
  context/      ProfileContext.tsx, GameContext.tsx
  screens/      WelcomeScreen, HomeScreen, LobbyScreen, GameScreen, GameOverScreen
  components/   Card, PlayerSeat, ActionBar, ResponsePrompt,
                LoseInfluencePicker, ExchangePicker, GameLog, ConnectionBanner
  theme.ts
```

- **engine**: `applyAction(game, action, rng) → game` and `legalActions(game, playerId)`. Throws `IllegalActionError` on illegal or stale input. Randomness (shuffle, draw) is injected so tests are deterministic.
- **gameService**: `createGame`, `joinGame`, `startGame`, `subscribe(gameId, cb)`, `dispatch(gameId, action)`. `dispatch` wraps `applyAction` in `runTransaction` on `/games/{gameId}`.
- **profileService**: read/write `/profiles/{playerId}` and the AsyncStorage copy.
- **GameContext**: holds the subscribed game, derives the local player's view (own hand, others' card counts and revealed cards), exposes `dispatch`.
- **Screens** only read context and call `dispatch`; no rule logic in UI.

## Turn state machine

`state.phase` values:

1. `action` — current player chooses an action. Income resolves immediately; Coup goes straight to `loseInfluence`.
2. `awaitingResponses` — every other living player must Pass, Challenge (if a character was claimed) or Block (if eligible). First Challenge or Block wins; all Pass → resolve.
3. `awaitingBlockResponses` — a block was declared; every other living player must Pass or Challenge the block. All Pass → action cancelled.
4. `loseInfluence` — a specific player must pick a card to reveal (from a challenge, Coup or Assassinate). Carries a continuation saying what happens next.
5. `exchange` — Ambassador player picks which cards to keep.
6. `finished` — one player left; `winner` set, `status` = `finished`.

After resolution the turn passes to the next living player in join order and `turnNumber` increments.

Amendments after engine review (2026-10-02):

- `state.claimSeq` increments whenever a new prompt opens for responses. Pass, Challenge and Block carry the `seq` of the prompt they answer; the engine rejects a mismatch, so a late tap cannot land on a different claim.
- When a block is challenged and exposed as a bluff, players who had not yet answered the original action are asked again (they may still challenge it or, for Foreign Aid, block it) before the action resolves.
- A player eliminated mid-resolution loses nothing further: a Steal against them takes 0 coins.
- The game finishes the moment one player is left, even mid-resolution.

## Database schema

```
/games/{gameId}
  host: playerId
  code: string                 5-char join code, unambiguous alphabet (no 0/O/1/I)
  status: "waiting" | "playing" | "finished"
  playerOrder: [playerId]
  players: {
    {playerId}: {
      name: string
      coins: number
      influence: [{ card, revealed }]
      eliminatedAt: number | null
    }
  }
  deck: [card]
  state: {
    phase
    currentTurnPlayer: playerId
    turnNumber: number
    pending: {                  null during "action" phase
      actor, action, target?, claim?,
      responses: { playerId: "pass" },
      block?: { blocker, claim, responses },
      loseInfluence?: { playerId, reason, next },
      exchangeOptions?: [card]
    }
    lastAction: { playerId, action, target?, blocked? }
  }
  log: [string]                 last 30 human-readable events
  winner: playerId | null
  createdAt: timestamp

/codes/{code}: gameId           join-code lookup

/profiles/{playerId}
  name, gamesPlayed, wins, createdAt
```

Changes from the original brief: added `deck`, `playerOrder`, `state.phase`, `state.pending`, `log`, `/codes`; `influence` entries carry a `revealed` flag; the `challenges` array is replaced by log entries. Win rate is computed on the client from `wins / gamesPlayed`.

Profile stats: when a game reaches `finished`, each client increments its own profile once, guarded by a locally stored list of counted game ids.

## UI

- Background `#000000`, text white, primary buttons cyan, secondary gray.
- **Welcome**: name entry on first launch.
- **Home**: profile (name, games, wins, win rate), Create Game, Join Game with code field.
- **Lobby**: join code shown large, player list, host-only Start (needs 2+ players).
- **Game**: opponents along the top (name, coins, face-down count, revealed cards); centre shows turn indicator, deck count and log; bottom shows own two cards and coins. Action bar appears only on the local player's turn. Response prompt, influence picker and exchange picker appear as overlays when the local player must act.
- **Game Over**: winner, Back to Home.

## Error handling

- `.info/connected` listener drives a "Reconnecting…" banner; action buttons disabled while offline.
- Join failures surfaced as messages: code not found, game full, game already started.
- A transaction that hits an `IllegalActionError` aborts without writing and shows a short message.
- Active `gameId` is stored locally; reopening the app returns the player to that game.
- A missing or placeholder Firebase config shows a setup message instead of crashing.

## Security

There is no authentication, so database rules must allow public read and write on `/games`, `/codes` and `/profiles`. Shipped rules restrict access to those paths and validate basic shape, but anyone who extracts the Firebase config from the APK can read or overwrite game data. This is accepted for a friends-only app that stores nothing sensitive. The Firebase project must not be shared with any other app.

## Testing

- Engine built test-first with Jest: each action, each block, challenges won and lost for actions and blocks, forced Coup, Assassinate coin handling, exchange, elimination, win detection, illegal-action rejection.
- A scripted three-player full game through the engine.
- Sync test against the Firebase Emulator with two to three simulated clients.
- Real-device play test requires the user's Firebase project.

## Build and delivery

- React Native's Android build requires JDK 17; the machine has Java 26. JDK 17 is installed side by side and selected for this project only.
- Release APK via `gradlew assembleRelease` with a project keystore kept out of git.
- README covers Firebase project setup, pasting config, database rules, running on a device, and building the APK.
- Local git from the start with regular commits; private GitHub repo `Erik-Fazlla/coup`, pushed only after confirmation.

## Out of scope

AI opponents, chat, animations, iOS build, spectators, turn timers, expansion cards, authentication.

## Amendment 2026-10-04: 7–10 players

- `MAX_PLAYERS` is 10. `buildDeck(playerCount)` gives 3 of each character for 2–6 players and 4 of each for 7–10 (`LARGE_GAME_FROM = 7`). The deck is built in `startGame` from the number of players in the lobby at that moment, so it can differ between rounds of the same lobby.
- With 10 players all 20 cards are dealt and the deck starts empty. An Exchange then offers only the player's own cards; a proven card is shuffled into the deck and drawn back from it. The engine needed no change for this. The published Coup expansion uses 5 of each for 9–10 players; this app uses 4 as requested. Changing it is one line in `copiesPerCharacter`.
- Table layout: with 6 or more opponents the minimum seat width drops from 108 to 100 so that nine seats fit in two rows on a 640x360 phone in landscape. When the regular 56-high seats would leave the banner less than one line, seats become 48 high (`SLIM_SEAT_HEIGHT`). In portrait nine opponents take three rows of three; that fits down to a table height of about 540.
- The seeded simulation and its invariants run for 2 to 10 players; the card-count invariant uses `deckSize(playerCount)`.
- An iOS build workflow was added and removed again the same day (never run; needs a paid Apple Developer account). iOS stays out of scope.
