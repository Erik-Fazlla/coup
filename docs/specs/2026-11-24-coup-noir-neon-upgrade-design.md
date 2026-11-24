# Coup Noir Neon Upgrade — Design

Date: 2026-11-24
Status: approved in chat, section by section (look, moments, sounds and build order).
Builds on: `2026-10-03-coup-ui-upgrade-design.md` and the intro/name-screen work on `feat/intro-video`.

## Why

The intro clips and the new name screen gave Coup a strong identity: a noir spy in a fedora, pure black, glowing cyan and electric blue. The rest of the game still has the older flat dark look, the important moments at the table pass with little feedback, and the sounds are short synthesised beeps. This upgrade carries the intro's identity through the whole game, gives the key moments weight, and replaces the beeps with real sound effects.

## Decisions (made in chat)

| Question | Choice |
|---|---|
| Overall look | **Noir Neon**: black, cyan `#00E5FF` and electric blue `#1E6BFF` glow, faint cyan haze |
| Depth | **Restyle every screen + rework the key table moments**. Layouts stay. |
| Character cards | **Solid colour fill (gradient) inside a glowing cyan frame** |
| Animation weight | **Mixed**: quick effects everywhere, three ~1 s scenes for the moments that decide the game |
| Sound | **Effects only**, no music |
| Technique | **Built-in tools only**: React Native `Animated` (native driver), `boxShadow`, the existing `CoupSoundModule` |

## Constraints

- **Do not change game logic, Firebase or multiplayer code**: `src/engine`, `src/firebase`, `database.rules.json`, and what is written to the database stay as they are. Animations and sounds are driven only by differences between game snapshots the phone already receives, so every phone sees the same moment and nothing new is sent.
- **No new npm or native dependencies.** Animation uses `Animated` with `useNativeDriver: true` wherever the property allows it. Glow uses `boxShadow` and `textShadow`.
- **Layouts stay.** `tableLayout.ts` sizes, region order, touch targets (≥ 44 dp), the font-scale caps and the small-phone fits are kept. Restyling may not make anything taller or wider than today.
- **Cyan means "you / tap here"** (rule from the first UI spec). Your seat, your turn and pressable targets glow cyan; everything else uses dim edges. Gold stays for coins.
- **Hidden information**: an opponent's unrevealed card is never rendered, logged or put in an accessibility label. Face-down cards show only the card back.
- **Reduce motion** (system setting) and Jest keep using the existing switch in `src/ui/motion.ts`: with motion off, every animation is skipped and the end state shows at once.
- **Never block play.** Quick effects never delay or intercept a tap. A scene may cover the table for at most ~1.2 s and never hides a prompt the local player must answer: if this player has to respond, the scene ends early or does not play.
- **Images**: the first UI spec allowed no image assets. This upgrade allows a small number of decorative images made for this app (the background haze and the card shading), still no official Coup artwork.
- **Sounds**: only files whose licence allows use in a game without attribution (CC0). Every file is listed with its source and licence in `assets/sounds/CREDITS.md`.

## Part 1: The look

### Theme (`src/theme.ts`)

- New tokens: `neon.cyan #00E5FF`, `neon.blue #1E6BFF`, `neon.ice #E6FDFF` (headings), `neon.mist #BFF7FF` (secondary text on glow), glow shadows (`glow.cyan`, `glow.blue`, `glow.soft`), and panel fills (`rgba(0,18,24,0.6)` with a cyan edge at ~35% opacity).
- `colors.primary` becomes the neon cyan, so existing "you / tap here" uses pick up the new colour without changes at each call site.
- The name screen's local constants (`CYAN`, `ELECTRIC_BLUE`) move into the theme.
- Character colours: each character keeps its hue. The card face is its solid `fill` with one shared shading image on top (`assets/images/card-shade.png`: a small vertical white-to-black gradient with partial transparency, stretched to the card), which turns any fill into a light-to-dark gradient of the same hue without a gradient library. The frame is a 1.5 dp cyan border with a cyan glow.

### Shared building blocks (`src/components/`)

- **`Backdrop`**: pure black plus a pre-rendered cyan haze PNG (`assets/images/haze.png`, about 30 KB) in the top-left corner. Used by `Screen`, so every screen gets it.
- **`Panel`**: dark see-through fill, thin cyan edge, faint inner glow. Variant `highlight` (full cyan edge and outer glow) for "you / your turn".
- **`Button`**: `primary` = electric-blue fill, cyan edge and glow (the name screen's Continue); `secondary` = black with a cyan outline; `danger` keeps red. The pressed state adds the existing press-scale plus a brighter glow. Disabled = dim, no glow.
- **`CharacterCard`**: gradient fill in a cyan frame (above). The lost face is grey, the frame dims, and a "LOST" tag shows.
- **`CardBack`**: black card, cyan frame, small fedora mark drawn in code (`CharacterGlyph`-style shapes).
- **Headings**: same system font, heavier weight and wider letter spacing, soft cyan `textShadow` on big titles (like "COUP" on the name screen). No custom font files.

### Screens and surfaces restyled

Home, Lobby, Game table (top bar, seats, event banner, hand, action grid, response bar, pickers), Game Over, Removed, Fallback, Setup, the Log / Rules / Settings sheets, the connection banner, and the reveal overlay. The name screen already has the look; it switches to the shared tokens.

### Launch screen

The Android launch window shows white with the icon today. `AppTheme` gets `android:windowBackground` = black (and the Android 12+ splash background colour = black), so the app opens black into the black intro.

## Part 2: Motion and moments

All effects are computed from the previous and the next game snapshot, the same way `src/ui/soundCues.ts` decides sounds. One pure function, `tableMoments(previous, next, playerId)`, returns the list of moments for a snapshot change; components subscribe to the moments that concern them. The first snapshot of a game or round plays no burst for what is already on the table (same rule as the sounds).

### Quick effects (≤ ~500 ms, never block)

| Moment | Effect |
|---|---|
| Turn changes | The active seat gets a cyan pulse (existing `usePulse`, recoloured). On your turn "YOUR TURN" sweeps across the top bar. The existing turn buzz stays. |
| Coins change | 1–3 small gold coins fly from the source to the receiver (the bank in the middle for Income, Foreign Aid and Tax; seat to seat for Steal; into the bank for Coup and Assassinate costs). The count tick stays. |
| Action claimed | A tag ("TAX · Duke") pops out of the acting player's seat and fades. |
| Block | A short shield flash on the blocker's seat. |
| Targeting | Opponents you can target get a pulsing cyan outline. |
| Game start | Cards are dealt from the middle to every seat, staggered (each about 80 ms apart, the whole deal capped at ~700 ms). |
| Lobby join | A newly joined player pops into place (scale + fade). |
| Screen change | Home, Lobby, Game and Game Over cross-fade (~200 ms) instead of a hard cut. |
| Buttons | Press-in scale plus brighter glow. |

### Scenes (~1 s, three of them)

1. **Challenge settled**: upgrade of `RevealOverlay`. The revealed card appears in the centre and flips; a stamp lands: **TRUE** (cyan) or **BLUFF** (red), with the name of the player who loses a card. It closes itself; tapping skips it.
2. **Card lost**: the card turns face up, cracks (two or three pieces drawn as clipped views drifting apart) and fades to grey; the owner's seat flashes red. If it is the local player's card, the hand shakes briefly.
3. **Win**: Game Over opens with the winner's name sweeping in under a burst of cyan sparks (about 12 small views on the native driver), then the existing results table fades in.

Scenes queue rather than overlap: if two arrive together (a challenge whose loser then loses a card), they play one after the other within the cap.

## Part 3: Sounds

### Sources and files

- CC0 packs, mainly Kenney (Casino Audio, Interface Sounds, Impact Sounds). Each file is checked for its licence before it is added and recorded in `assets/sounds/CREDITS.md` (file, pack, URL, licence).
- Stored as OGG Vorbis (Android's `SoundPool` plays OGG) in `android/app/src/main/res/raw/`, trimmed and loudness-matched; about 300 KB in total.
- `scripts/generate-sounds.js` and the generated WAVs are retired. Its test is replaced by a test that every name in `SOUND_NAMES` has a matching file.

### Sound list

| Name | Moment |
|---|---|
| `turn` | your turn (soft synth chime) |
| `prompt` | you must respond (short two-note alert) |
| `coin` | coins gained or stolen (coin clink) |
| `deal` | cards dealt at game start (quick shuffle) |
| `card` | a card flips (card snap) |
| `revealTrue` | challenge settled: the claim was true (bright sting) |
| `revealBluff` | challenge settled: it was a bluff (low hit) |
| `cardLost` | a card is lost (crack) |
| `block` | a block is declared (dull thud) |
| `gameWon` / `gameLost` | game over, you won / you lost |
| `tap` | button press (very quiet; dropped if it feels noisy on the phone) |
| `whoosh` / `flash` | name screen outro: card throw and the final flash (the two marked SOUND HOOKs in `WelcomeScreen.tsx`) |

This list replaces today's seven names (`turn`, `prompt`, `coin`, `card`, `challenge`, `win`, `lose`); `turn`, `prompt`, `coin` and `card` keep their meaning, `challenge` splits into `revealTrue` / `revealBluff`, and `win` / `lose` become `gameWon` / `gameLost`. `soundCues.ts` moves to the new names with the same ordering and first-snapshot rules.

### Behaviour kept

The Settings sound switch, playing only when the ringer is on, following the media volume, and never requesting audio focus (other apps' music is not paused) all stay exactly as in `CoupSoundModule.kt`. Its pool size may rise from today's limit to allow coin + card + sting together.

## Build order

Each step is its own commit series and its own installable APK, so it can be tested on the phone before the next one starts.

1. **The look**: theme tokens, `Backdrop`, `Panel`, `Button`, `CharacterCard`, `CardBack`, every screen and sheet restyled, black launch window.
2. **Sounds**: new files, credits, extended `soundCues`, the two name-screen hooks. Independent of step 1.
3. **Quick effects**: `tableMoments`, coins, turn sweep, claim tag, block flash, targeting pulse, deal, lobby pop, screen cross-fade.
4. **Scenes**: challenge, card lost, win.

## Verification

- `npm run typecheck`, `npm run lint` and all Jest suites stay green at every step.
- New unit tests: `tableMoments` (every moment, the first-snapshot rule, no hidden card names), the extended `soundCues`, and a check that every sound name has a file.
- Render tests for the restyled building blocks (what is shown, what is pressable, disabled states) and for the scenes (they end, they skip on tap, they yield to a required response, nothing plays with motion off).
- On the emulator: a real 3-player game, the app on the emulator plus two scripted players that join and act through the app's own `gameService` against the Realtime Database emulator (the `npm run test:sync` setup). Recorded with `screenrecord` and checked frame by frame for each moment.
- Final check by Erik on his phone after each step.

## Out of scope

- Background music.
- New layouts or moving controls (that was option C, not chosen).
- Changes to rules, game flow, Firebase structure or security rules.
- iOS.
- New libraries (Reanimated, Skia, Lottie). If a scene later needs real particles, adding one is a separate decision.
