# Coup UI Upgrade — Design

Date: 2026-10-03
Status: direction approved in chat ("do everything A–D"); absent-player handling = host skip button.
Builds on: `2026-10-02-coup-design.md`.

## Why

First device test (2 players) showed: the game works and syncs, but the screen is bare, half of it is empty, cards have no identity, and the horizontally scrolling action strip hid buttons (caused the "stuck Steal" bug). A player who walks away stalls the game, and there is no rules reference or rematch.

## Constraints

- Pure black background stays. White text. Cyan stays the "it's you / tap here" colour.
- No new runtime dependencies. Animation uses React Native's built-in `Animated`; haptics use `Vibration`. `react-native-safe-area-context` is already installed.
- No image assets and no official Coup artwork. Icons are drawn in code from simple shapes and letters.
- Rules live in `src/engine` only. Components ask the engine what is allowed; they never decide it.
- Hidden information: another player's unrevealed card names must never be rendered, logged or put in accessibility labels.
- All existing tests stay green. New engine behaviour is test-first. New components get render tests (react-test-renderer) for their logic: what is shown, what is tappable, what is sent.
- Every touch target is at least 44×44. Text scales with the system font size without clipping the layout.

## Phase 1 — Layout and identity (A + B)

### Character identity (`src/theme.ts`, `src/engine/describe.ts`)

| Character | Colour (fill / text accent) | Glyph | Ability line |
|---|---|---|---|
| Duke | purple `#3C3489` / `#CECBF6` | crown shape | Tax +3 · blocks Foreign Aid |
| Assassin | charcoal `#444441` / red `#F09595` | dagger shape | Pay 3: target loses a card |
| Captain | blue `#0C447C` / `#B5D4F4` | anchor/chevron shape | Steal 2 · blocks Steal |
| Ambassador | green `#27500A` / `#C0DD97` | two-arrows shape | Exchange cards · blocks Steal |
| Contessa | crimson `#791F1F` / `#F7C1C1` | diamond shape | Blocks Assassination |

`describe.ts` gains `CHARACTER_INFO: Record<Card, { ability: string; blocks: string | null }>` (text only; colours stay in the theme).

### Components

| Component | Responsibility |
|---|---|
| `CharacterCard` | Own card, face up: colour, glyph, name, ability line. Lost state: dashed outline, struck name, "lost". Optional `onPress`, `selected`, `disabled`. Replaces `CardView`. |
| `CardBack` | Small face-down card for opponents. |
| `MiniCard` | Small face-up lost card for opponents (colour + two-letter code + accessible full name). |
| `Coins` | Coin glyph + number. |
| `Seat` | One opponent: name, coins, card backs, lost cards, turn highlight, "out" state. Becomes a button with a cyan outline and "tap to target" when the screen is in targeting mode and this player is a legal target. Replaces `PlayerSeat`. |
| `ActionGrid` | Fixed grid (4 columns landscape, 2 portrait) of all seven actions, always visible, never scrolling. Each tile: label, cost/gain, claimed character colour. Tiles the player cannot afford are dimmed and disabled with the reason in the accessibility label; at 10+ coins only Coup is enabled. Tapping a targeted action enters targeting mode (tile highlighted, last tile becomes Back). Replaces the scrolling `ActionBar`. |
| `ResponseBar` | Pass / Challenge / Block as … as large tiles in the same slot as the grid. Block tiles use the claimed character's colour. Replaces `ResponsePrompt`. |
| `EventBanner` | Centre of the screen. Line 1: what the local player must do now, or who everyone is waiting for (`statusLine`/`promptLine`). Line 2: the latest log entry. Tap opens `LogSheet`. |
| `LogSheet` | Full action log (last 30 entries), scrollable, dismissible. |
| `TopBar` | Turn number, deck count, join code, Rules button, Leave button. |

`LoseInfluencePicker` and `ExchangePicker` keep their behaviour and use `CharacterCard`.

### Targeting flow

`GameScreen` owns `targeting: TargetedAction | null`.
1. Player taps Steal / Assassinate / Coup in `ActionGrid` → `targeting` set.
2. Legal targets (living opponents) show as tappable `Seat`s; the banner reads "Steal: tap a player above".
3. Tapping a seat sends the action and clears `targeting`. Back (in the grid) clears it without sending.
4. `targeting` is cleared whenever it stops being this player's action phase.

### Screen layout (landscape)

Top bar · opponents row (wraps to two rows for 4–5 opponents, seats shrink; never scrolls off) · event banner (flex) · bottom row: own cards + coins on the left, action/response/picker area on the right.

Other screens (Welcome, Home, Lobby, Game Over, Setup, error fallback) adopt the same tokens: card-like panels, coin and character accents, consistent buttons. No layout change beyond that.

## Phase 2 — Motion and feedback (C)

All via `Animated` with `useNativeDriver: true` where the property allows it. Respect the system "reduce motion" setting (`AccessibilityInfo.isReduceMotionEnabled`): when on, changes are instant.

- Own card lost: flip to the lost face (≈300 ms).
- Opponent card lost: card back flips to the `MiniCard`.
- Coins: number ticks to the new value; brief scale bump; green for gain, red for loss.
- Your turn / you must respond: hand panel outline pulses; one short vibration when the prompt first appears (not on every snapshot).
- Event banner: new line slides/fades in.
- Buttons: pressed scale feedback.

Animation code lives in small hooks (`src/ui/motion.ts`) so components stay declarative and tests can run with motion disabled.

## Phase 3 — Extras (D)

### Rules sheet
`RulesSheet`, opened from the top bar and from Home. Table of actions (cost, effect, claim, who blocks) generated from the engine's rule tables (`ACTION_COST`, `ACTION_CLAIM`, `BLOCK_CLAIMS`) plus `CHARACTER_INFO`, so it cannot drift from the real rules. Short text on challenges and the forced Coup.

### Rematch
- Engine: `rematch(game, playerId, rng)` in `lobby.ts`. Allowed for the host when `status === 'finished'`. Returns the game to `waiting` with the same players, coins/influence/deck/log/winner/state reset, and `round` incremented (`Game.round`, starts at 1; `normalizeGame` defaults a missing value to 1).
- Service: `gameService.rematch(gameId, playerId)`.
- UI: Game Over shows "Play again" for the host and "Waiting for the host…" for others; everyone lands in the lobby on the same game id and code. Players may leave from the lobby as today.
- Stats: a result is recorded once per `gameId` + `round` (the counted key becomes `${gameId}:${round}`), so rematches count.

### Portrait
- Remove the landscape lock (`android:screenOrientation`) and let the activity rotate.
- Layout decisions use `useWindowDimensions()`: portrait stacks top bar, opponents (wrapping grid), banner, own hand, then the action grid in 2 columns. Landscape as in Phase 1.
- No screen may require scrolling to reach an action in either orientation on a 360×640 dp phone with 5 opponents.

### Host skip
- Engine: `{ type: 'skip', playerId }` in `applyAction`. Only the host may send it, only while `playing`. It performs the minimal default for whoever the game is waiting on:
  - `awaitingResponses` / `awaitingBlockResponses`: every pending responder passes.
  - `action`: the current player takes Income; with 10+ coins they Coup the next living player in turn order.
  - `loseInfluence`: the waiting player loses their first hidden card.
  - `exchange`: the actor keeps their current cards.
  The log records "Host skipped <name>". The host may skip a wait that includes themself.
- UI: the host's phone tracks how long the game state has been unchanged (local clock, from the last snapshot whose `turnNumber`, `phase`, `claimSeq` or pending responders changed). After 45 s a "Skip <names>" button appears for the host; tapping asks for confirmation. No clock synchronisation is needed because only the host's own elapsed time matters.

## Verification

- Jest: engine tests for `rematch` and `skip` (every phase), including the seeded simulation with random skips mixed in and the existing invariants; component tests for targeting, disabled tiles, response tiles, banner text, rules table content.
- `npm run test:sync`: rematch and skip across clients.
- Typecheck, lint, Prettier clean.
- Release APK built after each phase and handed to the user for a device look; visual issues are fixed before the next phase starts.

## Out of scope

Automatic timers, sound, AI players, chat, authentication, iOS.
