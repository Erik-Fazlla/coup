# Noir Neon — Plan 2: Sounds — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Coup's seven synthesised beeps with real CC0 sound effects and add sounds for the new moments (deal, block, true/bluff reveal, card lost, exchange, the name screen's card throw and flash), without touching game logic, Firebase or multiplayer code.

**Architecture:** The existing pipeline stays: `soundCues(previous, next, playerId)` (pure) decides which named sounds a game snapshot change plays, `useGameSounds` plays them through `playSound`, and the Kotlin `CoupSoundModule` plays `res/raw/sfx_*.ogg` from a `SoundPool`. This plan swaps the files (chosen CC0 originals kept in `assets/sounds/source/`, converted by a script driven by a manifest), renames and extends the sound names, extends `soundCues`, and wires the two name-screen hooks.

**Tech Stack:** TypeScript, Jest, Kotlin (Android `SoundPool`), Node.js script + ffmpeg (on PATH as `ffmpeg`), Kenney CC0 audio packs.

**Spec:** `docs/specs/2026-11-24-coup-noir-neon-upgrade-design.md`, Part 3.

**Decision recorded here:** the optional `tap` (button press) sound from the spec is **dropped**. `Button` is also rendered by `SetupScreen` outside `SettingsProvider`, so it cannot read the sound setting, and a click on every tap is noisy in a room of players.

## Ground rules

- Branch `feat/noir-neon-ui` in `D:\Projects\Owned\Coup`; do not push.
- Never edit `src/engine/**`, `src/firebase/**`, `database.rules.json`.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx jest <path>`; full checks `npm run typecheck`, `npm run lint`, `npx jest`.

## The sounds

| Name (JS) | Android resource | Source (Kenney pack / file) | Trim |
|---|---|---|---|
| `turn` | `sfx_turn` | interface-sounds / `confirmation_002.ogg` | — |
| `prompt` | `sfx_prompt` | interface-sounds / `question_002.ogg` | — |
| `coin` | `sfx_coin` | casino-audio / `chips-handle-3.ogg` | — |
| `deal` | `sfx_deal` | casino-audio / `card-shuffle.ogg` | first 0.9 s, 0.15 s fade-out |
| `card` | `sfx_card` | casino-audio / `card-place-1.ogg` | — |
| `revealTrue` | `sfx_reveal_true` | digital-audio / `powerUp2.ogg` | — |
| `revealBluff` | `sfx_reveal_bluff` | impact-sounds / `impactPunch_heavy_000.ogg` | — |
| `cardLost` | `sfx_card_lost` | impact-sounds / `impactGlass_medium_001.ogg` | — |
| `block` | `sfx_block` | impact-sounds / `impactSoft_heavy_001.ogg` | — |
| `gameWon` | `sfx_game_won` | digital-audio / `zapThreeToneUp.ogg` | — |
| `gameLost` | `sfx_game_lost` | digital-audio / `zapThreeToneDown.ogg` | — |
| `whoosh` | `sfx_whoosh` | casino-audio / `card-fan-1.ogg` | — |
| `flash` | `sfx_flash` | digital-audio / `phaserUp3.ogg` | — |

The four packs are already downloaded and unzipped (licence files say CC0) in
`C:\Users\erikf\AppData\Local\Temp\claude\d11ddade7e492270\688f897f-2de9-48e6-9d15-266fc1b5de20\scratchpad\kenney\<pack>\` with the audio under `Audio/` (impact-sounds and interface-sounds may nest it one level deeper; find the file with `find <pack> -name <file>`). They are data: only `.ogg` files and `License.txt` are copied; nothing in them is run.

---

### Task 1: Source files, manifest and credits

**Files:**
- Create: `assets/sounds/source/<pack>/<file>.ogg` (the 13 originals above)
- Create: `assets/sounds/source/<pack>/License.txt` (one per pack, copied from the pack)
- Create: `assets/sounds/manifest.json`
- Create: `assets/sounds/CREDITS.md`

- [ ] **Step 1: Copy the 13 originals and the four licence files** into `assets/sounds/source/casino-audio/`, `digital-audio/`, `impact-sounds/`, `interface-sounds/` (flat, no `Audio/` subfolder).

- [ ] **Step 2: Write `assets/sounds/manifest.json`:**

```json
{
  "turn": { "source": "interface-sounds/confirmation_002.ogg" },
  "prompt": { "source": "interface-sounds/question_002.ogg" },
  "coin": { "source": "casino-audio/chips-handle-3.ogg" },
  "deal": { "source": "casino-audio/card-shuffle.ogg", "seconds": 0.9 },
  "card": { "source": "casino-audio/card-place-1.ogg" },
  "revealTrue": { "source": "digital-audio/powerUp2.ogg" },
  "revealBluff": { "source": "impact-sounds/impactPunch_heavy_000.ogg" },
  "cardLost": { "source": "impact-sounds/impactGlass_medium_001.ogg" },
  "block": { "source": "impact-sounds/impactSoft_heavy_001.ogg" },
  "gameWon": { "source": "digital-audio/zapThreeToneUp.ogg" },
  "gameLost": { "source": "digital-audio/zapThreeToneDown.ogg" },
  "whoosh": { "source": "casino-audio/card-fan-1.ogg" },
  "flash": { "source": "digital-audio/phaserUp3.ogg" }
}
```

- [ ] **Step 3: Write `assets/sounds/CREDITS.md`:**

```markdown
# Sound credits

All sound effects come from Kenney's free audio packs, released under
Creative Commons Zero (CC0 1.0, public domain): https://creativecommons.org/publicdomain/zero/1.0/
Credit is not required; it is given here anyway. Each pack's own licence file is in `source/<pack>/License.txt`.

| Sound | File | Pack |
|---|---|---|
| turn | confirmation_002.ogg | Interface Sounds — https://kenney.nl/assets/interface-sounds |
| prompt | question_002.ogg | Interface Sounds |
| coin | chips-handle-3.ogg | Casino Audio — https://kenney.nl/assets/casino-audio |
| deal | card-shuffle.ogg (first 0.9 s) | Casino Audio |
| card | card-place-1.ogg | Casino Audio |
| revealTrue | powerUp2.ogg | Digital Audio — https://kenney.nl/assets/digital-audio |
| revealBluff | impactPunch_heavy_000.ogg | Impact Sounds — https://kenney.nl/assets/impact-sounds |
| cardLost | impactGlass_medium_001.ogg | Impact Sounds |
| block | impactSoft_heavy_001.ogg | Impact Sounds |
| gameWon | zapThreeToneUp.ogg | Digital Audio |
| gameLost | zapThreeToneDown.ogg | Digital Audio |
| whoosh | card-fan-1.ogg | Casino Audio |
| flash | phaserUp3.ogg | Digital Audio |

The app plays converted copies (`android/app/src/main/res/raw/sfx_*.ogg`), made by `npm run sounds` (`scripts/import-sounds.js`).
```

- [ ] **Step 4: Commit**

```bash
git add assets/sounds
git commit -m "Add the CC0 sound effect sources, their manifest and credits"
```

---

### Task 2: Import script (replaces the synthesiser)

**Files:**
- Create: `scripts/import-sounds.js`
- Create: `scripts/__tests__/import-sounds.test.js`
- Delete: `scripts/generate-sounds.js`, `scripts/__tests__/generate-sounds.test.js`, `android/app/src/main/res/raw/sfx_*.wav`
- Modify: `package.json` (`"sounds"` script), `README.md` (sound paragraph, around line 148)

- [ ] **Step 1: Write the failing test** `scripts/__tests__/import-sounds.test.js`:

```js
const fs = require('fs');
const path = require('path');
const { MANIFEST, RAW_DIR, resourceName, ffmpegArgs } = require('../import-sounds');

describe('resourceName', () => {
  it('turns a JS sound name into an Android resource name', () => {
    expect(resourceName('turn')).toBe('sfx_turn');
    expect(resourceName('revealTrue')).toBe('sfx_reveal_true');
    expect(resourceName('gameLost')).toBe('sfx_game_lost');
  });
});

describe('ffmpegArgs', () => {
  it('converts to mono OGG Vorbis at a matched loudness', () => {
    const args = ffmpegArgs('in.ogg', 'out.ogg', {});
    expect(args).toEqual(expect.arrayContaining(['-ac', '1', '-c:a', 'libvorbis']));
    expect(args.join(' ')).toContain('loudnorm');
    expect(args[args.length - 1]).toBe('out.ogg');
  });

  it('cuts and fades a long source when the manifest gives seconds', () => {
    const args = ffmpegArgs('in.ogg', 'out.ogg', { seconds: 0.9 });
    expect(args).toEqual(expect.arrayContaining(['-t', '0.9']));
    expect(args.join(' ')).toContain('afade=t=out');
  });
});

describe('the committed sounds', () => {
  it('has a source file for every manifest entry', () => {
    for (const entry of Object.values(MANIFEST)) {
      expect(fs.existsSync(path.join(__dirname, '../../assets/sounds/source', entry.source))).toBe(true);
    }
  });

  it('has a converted file in res/raw for every manifest entry, and nothing left over', () => {
    const expected = Object.keys(MANIFEST).map(name => `${resourceName(name)}.ogg`).sort();
    const present = fs.readdirSync(RAW_DIR).filter(file => file.startsWith('sfx_')).sort();
    expect(present).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run it to see it fail** — `npx jest scripts/__tests__/import-sounds.test.js` → FAIL (module missing).

- [ ] **Step 3: Write `scripts/import-sounds.js`:**

```js
/**
 * Converts the sound effects listed in assets/sounds/manifest.json from their CC0
 * sources (assets/sounds/source/) into the files the app plays:
 * android/app/src/main/res/raw/sfx_<name>.ogg (mono OGG Vorbis, loudness matched).
 *
 *   npm run sounds        (needs ffmpeg on the PATH)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'sounds', 'source');
const RAW_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'raw');
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets', 'sounds', 'manifest.json'), 'utf8'),
);
const FADE_SECONDS = 0.15;

/** `revealTrue` -> `sfx_reveal_true` (Android resource names are lower case with underscores). */
function resourceName(name) {
  return `sfx_${name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
}

/** The ffmpeg arguments that turn one source into one app sound. */
function ffmpegArgs(input, output, { seconds }) {
  const filters = ['loudnorm=I=-18:TP=-2:LRA=7'];
  const args = ['-y', '-v', 'error', '-i', input];
  if (seconds) {
    args.push('-t', String(seconds));
    filters.push(`afade=t=out:st=${(seconds - FADE_SECONDS).toFixed(2)}:d=${FADE_SECONDS}`);
  }
  args.push('-af', filters.join(','), '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '4', output);
  return args;
}

function main() {
  for (const file of fs.readdirSync(RAW_DIR)) {
    if (file.startsWith('sfx_')) {
      fs.unlinkSync(path.join(RAW_DIR, file));
    }
  }
  for (const [name, entry] of Object.entries(MANIFEST)) {
    const output = path.join(RAW_DIR, `${resourceName(name)}.ogg`);
    execFileSync('ffmpeg', ffmpegArgs(path.join(SOURCE_DIR, entry.source), output, entry));
    console.log(`${name} -> ${path.relative(ROOT, output)}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MANIFEST, RAW_DIR, resourceName, ffmpegArgs };
```

- [ ] **Step 4: Retire the synthesiser.** `git rm scripts/generate-sounds.js scripts/__tests__/generate-sounds.test.js android/app/src/main/res/raw/sfx_*.wav`. In `package.json` set `"sounds": "node scripts/import-sounds.js"`. In `README.md` replace the sound paragraph with: "The sound effects are Kenney's free CC0 sounds (see `assets/sounds/CREDITS.md`). `npm run sounds` converts the sources in `assets/sounds/source/` into the files the app plays in `android/app/src/main/res/raw/` (needs ffmpeg); the converted files are committed. They follow the phone's media volume and stay quiet when the phone is on silent or vibrate. To turn them off in the app: **Home → Settings → Sound**."

- [ ] **Step 5: Convert** — run `npm run sounds`. Expect 13 lines `name -> android/app/src/main/res/raw/sfx_….ogg`. Check total size: `du -ch android/app/src/main/res/raw/sfx_*.ogg | tail -1` (expect well under 400 KB).

- [ ] **Step 6: Run the test** — `npx jest scripts/__tests__/import-sounds.test.js` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A scripts package.json README.md android/app/src/main/res/raw
git commit -m "Replace the synthesised beeps with converted CC0 sound effects"
```

(The app does not build between this commit and Task 3, because the Kotlin module still names the old `.wav` resources; Task 3 fixes that. Do not build in between.)

---

### Task 3: Native module and JS names

**Files:**
- Modify: `android/app/src/main/java/com/coup/CoupSoundModule.kt` (`SOUNDS` map, `MAX_STREAMS`)
- Modify: `src/ui/sound.ts` (`SOUND_NAMES`)
- Modify: `src/ui/__tests__/sound.test.ts` (if it lists names)
- Test: `scripts/__tests__/import-sounds.test.js`

- [ ] **Step 1: Add a failing test** to `scripts/__tests__/import-sounds.test.js` that ties the three lists together:

```js
describe('the names the app knows', () => {
  const soundTs = fs.readFileSync(path.join(__dirname, '../../src/ui/sound.ts'), 'utf8');
  const kotlin = fs.readFileSync(
    path.join(__dirname, '../../android/app/src/main/java/com/coup/CoupSoundModule.kt'),
    'utf8',
  );

  it('lists exactly the manifest sounds in SOUND_NAMES', () => {
    const block = soundTs.match(/SOUND_NAMES = \[([\s\S]*?)\]/)[1];
    const names = [...block.matchAll(/'(\w+)'/g)].map(m => m[1]).sort();
    expect(names).toEqual(Object.keys(MANIFEST).sort());
  });

  it('maps every sound to its resource in the native module', () => {
    for (const name of Object.keys(MANIFEST)) {
      expect(kotlin).toContain(`"${name}" to R.raw.${resourceName(name)}`);
    }
  });
});
```

- [ ] **Step 2: Run it** → FAIL.

- [ ] **Step 3: Implement.** In `src/ui/sound.ts` replace `SOUND_NAMES` with:

```ts
export const SOUND_NAMES = [
  'turn',
  'prompt',
  'coin',
  'deal',
  'card',
  'revealTrue',
  'revealBluff',
  'cardLost',
  'block',
  'gameWon',
  'gameLost',
  'whoosh',
  'flash',
] as const;
```

and update its doc comment to say the files are made by `npm run sounds` (`scripts/import-sounds.js`) from `assets/sounds/`.

In `CoupSoundModule.kt` set `private const val MAX_STREAMS = 6` (coin + card + sting can overlap) and replace the `SOUNDS` map with:

```kotlin
    private val SOUNDS =
        mapOf(
            "turn" to R.raw.sfx_turn,
            "prompt" to R.raw.sfx_prompt,
            "coin" to R.raw.sfx_coin,
            "deal" to R.raw.sfx_deal,
            "card" to R.raw.sfx_card,
            "revealTrue" to R.raw.sfx_reveal_true,
            "revealBluff" to R.raw.sfx_reveal_bluff,
            "cardLost" to R.raw.sfx_card_lost,
            "block" to R.raw.sfx_block,
            "gameWon" to R.raw.sfx_game_won,
            "gameLost" to R.raw.sfx_game_lost,
            "whoosh" to R.raw.sfx_whoosh,
            "flash" to R.raw.sfx_flash,
        )
```

Update the module's doc comment ("res/raw/sfx_*.wav, made by npm run sounds") to `.ogg` from `assets/sounds`.

- [ ] **Step 4: Run** `npx jest scripts src/ui/__tests__/sound.test.ts` → PASS (fix `sound.test.ts` only where it hard-codes an old name). `npm run typecheck` will now fail in `soundCues.ts` (old names) — that is Task 4; do not commit yet if typecheck is red… instead commit together with Task 4. Continue straight to Task 4.

---

### Task 4: New cues in `soundCues`

**Files:**
- Modify: `src/ui/soundCues.ts`
- Modify: `src/ui/__tests__/soundCues.test.tsx`
- Modify: `src/screens/LobbyScreen.tsx` (one hook call)

Rules for the cues (order in the returned list):
1. `revealTrue` / `revealBluff` — a challenge was settled (`unseenReveal(next, seenAtOpen(previous))` returns a reveal): `revealTrue` if `reveal.truthful`, else `revealBluff`.
2. `block` — `next.state.pending?.block` is set and `previous.state.pending?.block` was not.
3. `cardLost` — any player's revealed-card count went up (today's `card` rule).
4. `coin` — any player's coins changed (unchanged).
5. `card` — an exchange finished: `previous.state.phase === 'exchange'` and `next.state.phase !== 'exchange'`.
6. `turn` / `prompt` — unchanged.
7. `gameWon` / `gameLost` — today's `win` / `lose`.

Game start (`deal`): the lobby screen now also runs `useGameSounds`, so its last snapshot (status `waiting`) is handed over to the game screen. `soundCues` treats `previous.status === 'waiting'` → `next.status === 'playing'` for the same game (`code` and `createdAt` equal) as the deal: it returns `['deal']` followed by the usual first-snapshot cue (`turn` or `prompt` if the game waits for this player). `takeHandover` accepts that pair as well as today's playing → finished pair. Lobby snapshots themselves produce no sounds (no cue rule fires for a waiting game).

- [ ] **Step 1: Update the existing tests to the new names** in `src/ui/__tests__/soundCues.test.tsx`:
  - `'card'` (a card is lost) → `'cardLost'`, `'challenge'` → `'revealBluff'` in the B-bluffs-tax tests (B claimed Duke with `['Contessa','Assassin']`, so it was a bluff), `'win'` → `'gameWon'`, `'lose'` → `'gameLost'`.
  - Rename test titles accordingly (e.g. "orders them reveal, card lost, coin, then turn").
  - In "orders them …", `truthful: false` → expected first cue `'revealBluff'`.

- [ ] **Step 2: Add failing tests** (inside `describe('soundCues')`):

```tsx
  it('plays revealTrue when the challenged claim was true', () => {
    // I hold the Duke: my tax is honest, B's challenge fails.
    const claimed = play(table(), { type: 'tax', playerId: 'me' });
    const challenged = play(claimed, { type: 'challenge', playerId: 'b' });
    expect(challenged.reveal?.truthful).toBe(true);
    expect(soundCues(claimed, challenged, 'c')[0]).toBe('revealTrue');
  });

  it('plays block when a block is declared', () => {
    // B steals from me; I block with my Captain.
    const stolen = play(theirTurn(), { type: 'steal', playerId: 'b', target: 'me' });
    const blocked = play(stolen, { type: 'block', playerId: 'me', claim: 'Captain' });
    expect(blocked.state.pending?.block).toBeTruthy();
    expect(soundCues(stolen, blocked, 'c')).toContain('block');
    expect(soundCues(blocked, { ...blocked, log: [] }, 'c')).not.toContain('block');
  });

  it('plays card when an exchange is finished', () => {
    const exchanging = play(
      makeGame({ me: ['Ambassador', 'Duke'], b: ['Contessa', 'Assassin'] }),
      { type: 'exchange', playerId: 'me' },
      { type: 'pass', playerId: 'b' },
    );
    expect(exchanging.state.phase).toBe('exchange');
    const done = play(exchanging, { type: 'exchangeChoose', playerId: 'me', keep: [0, 1] });
    expect(soundCues(exchanging, done, 'b')).toContain('card');
  });

  it('plays the deal when the lobby turns into a game', () => {
    const started = table();
    const lobby: Game = { ...started, status: 'waiting' };
    expect(soundCues(lobby, started, 'me')).toEqual(['deal', 'turn']);
    expect(soundCues(lobby, started, 'b')).toEqual(['deal']);
    // Not for another game.
    expect(soundCues({ ...lobby, code: 'OTHER' }, started, 'b')).toEqual([]);
  });

  it('plays nothing for lobby snapshots', () => {
    const lobby: Game = { ...table(), status: 'waiting' };
    expect(soundCues(lobby, { ...lobby, log: ['x'] }, 'me')).toEqual([]);
  });
```

If any of these setups does not reach the state the test expects (check with the `expect(...)` guard lines; e.g. the exact actions needed to reach the `exchange` phase), read `src/engine/testHelpers.ts` and `src/engine/actions.ts` (read only) and fix the **setup**, never the asserted cue.

Also add to the `useGameSounds` tests:

```tsx
  it('hands the lobby over to the game screen so the deal is heard', () => {
    const started = table();
    const lobby: Game = { ...started, status: 'waiting' };
    const lobbyScreen = render(<Sounds game={lobby} playerId="me" />);
    act(() => lobbyScreen.unmount());
    render(<Sounds game={started} playerId="me" />);
    expect(played()).toEqual(['deal', 'turn']);
  });
```

(`Sounds` is the existing test component in that file that calls `useGameSounds`; use its real name.)

- [ ] **Step 3: Run** `npx jest src/ui/__tests__/soundCues.test.tsx` → FAIL.

- [ ] **Step 4: Implement** in `src/ui/soundCues.ts`:
  - Add a helper `sameGame(a, b)` = same `code` and `createdAt`.
  - At the top of `soundCues`, after the `previous === next` check:
    ```ts
    if (previous && previous.status === 'waiting' && next.status === 'playing' && sameGame(previous, next)) {
      const opening = buzzMoment(next, playerId);
      return ['deal', ...(opening ? [opening.kind === 'turn' ? 'turn' : 'prompt'] as SoundName[] : [])];
    }
    ```
  - Replace the challenge cue with `revealTrue` / `revealBluff` from the reveal's `truthful`.
  - Add the `block` cue after it, `cardLost` replaces the old `card` push, keep `coin`, add the exchange `card` cue after coin.
  - `win`/`lose` → `gameWon`/`gameLost`.
  - Update the doc comment's order line.
  - `takeHandover`: accept `previous.status === 'waiting' && first.status === 'playing' && sameGame(previous, first)` in addition to the existing condition.

  In `src/screens/LobbyScreen.tsx` call `useGameSounds(game, playerId)` (import from `../ui/soundCues`; get `playerId` the way the screen already does via `useProfile`). Lobby snapshots play nothing; the hook exists only so the last lobby snapshot is handed over.

  In `src/components/SettingsSheet.tsx` the sound preview `playSound('coin')` stays.

- [ ] **Step 5: Run** `npx jest src/ui src/screens src/components scripts` → PASS; `npm run typecheck` → clean.

- [ ] **Step 6: Commit (Tasks 3 + 4 together)**

```bash
git add -A src/ui src/screens/LobbyScreen.tsx android/app/src/main/java/com/coup/CoupSoundModule.kt scripts
git commit -m "Play the new sounds: deal, true or bluff reveal, block, card lost, exchange, win and loss"
```

---

### Task 5: Name screen whoosh and flash

**Files:**
- Modify: `src/screens/WelcomeScreen.tsx` (the two `SOUND HOOK` comments)
- Modify: `src/screens/__tests__/WelcomeScreen.test.tsx`

- [ ] **Step 1: Failing tests.** In `WelcomeScreen.test.tsx` mock `../../ui/sound` (`playSound: jest.fn()`) and `../../context/SettingsContext` (`useSettings: () => ({ settings: { sound: mockSound, vibration: true }, update: jest.fn() })`, with `let mockSound = true` reset in `beforeEach`). Add:

```tsx
  it('plays the whoosh when the card is thrown and the flash when the clip ends', async () => {
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    expect(playSound).toHaveBeenCalledWith('whoosh');
    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(playSound).toHaveBeenLastCalledWith('flash');
  });

  it('stays silent with sound switched off, and plays no flash when the clip is skipped', async () => {
    mockSound = false;
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(playSound).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.** In `WelcomeScreen.tsx`: `const { settings } = useSettings();`. Replace the whoosh `SOUND HOOK` comment in `submit` with `if (settings.sound) { playSound('whoosh'); }` (only on the path that plays the outro, not when it failed to load). Replace the flash comment in `finish` with `if (flash && settings.sound) { playSound('flash'); }`. Add `settings.sound` to `finish`'s `useCallback` dependencies.

- [ ] **Step 4: Run** `npx jest src/screens` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/WelcomeScreen.tsx src/screens/__tests__/WelcomeScreen.test.tsx
git commit -m "Play the card-throw whoosh and the final flash on the name screen"
```

---

### Task 6: Full check and build

- [ ] `npm run typecheck`, `npm run lint`, `npx jest` → all clean.
- [ ] Build: from `android/`, `JAVA_HOME='C:\Users\erikf\.jdk\jdk-17.0.16' ./gradlew.bat assembleRelease --console=plain -q` → exit 0.
- [ ] `du -ch android/app/src/main/res/raw/sfx_*.ogg | tail -1` → report the total.
- [ ] Commit any fixes.
