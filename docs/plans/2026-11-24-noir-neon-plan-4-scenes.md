# Noir Neon — Plan 4: The Three Scenes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the three moments that decide the game a short staged scene: a challenge being settled (card flips, TRUE / BLUFF stamp lands), a card being lost (it cracks and fades, the seat flashes red, your own hand shakes), and the win (the title sweeps in under a burst of cyan sparks, then the results fade in).

**Architecture:** All three build on what exists. The challenge scene upgrades `RevealOverlay` (already shown once per reveal by `useRevealOnce`, already non-blocking: only the card takes touches). The card-lost scene adds a `cardLost` moment to `tableMoments` (plan 3), a red flash in `SeatEffects`, a one-shot crack overlay in `CharacterCard`, and a shake on the hand in `GameScreen`. The win scene adds `SparkBurst` and an entrance to `GameOverScreen`. Everything animates with `Animated` on the native driver and is skipped when `motionEnabled()` is false (reduce motion, Jest).

**Tech Stack:** TypeScript, React Native `Animated`, Jest + react-test-renderer.

**Spec:** `docs/specs/2026-11-24-coup-noir-neon-upgrade-design.md`, Part 2 "Scenes".

**Decision recorded here:** the reveal keeps today's display time (`REVEAL_MS` = 2200 ms in `src/ui/reveal.ts`) instead of the spec's ~1.2 s cap. The overlay never blocks play (only the card itself takes touches; the dimmed table lets every touch through, and it sits above the hand so a player who must lose a card can do so at once), and players need the time to read who loses a card. The animated part of the scene itself takes ~0.8 s.

## Ground rules

- Branch `feat/noir-neon-ui` in `D:\Projects\Owned\Coup`; do not push.
- Never edit `src/engine/**`, `src/firebase/**`, `database.rules.json`, `src/components/tableLayout.ts`.
- Overlays: `position: 'absolute'`, `pointerEvents="none"` (except the reveal card, which keeps its tap-to-dismiss), hidden from accessibility. No size, margin, padding or flex changes to existing views.
- `useNativeDriver: true`; only `opacity` and `transform` animate.
- Hidden information: nothing here may show an opponent's unrevealed card. The crack only ever plays on a card that has just been revealed.
- Tests needing motion use `setMotionInstant(false)` (from `src/ui/motion`) in `beforeEach`, `setMotionInstant(true)` in `afterEach`, and `jest.useFakeTimers()`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Challenge scene (RevealOverlay)

**Files:**
- Modify: `src/components/RevealOverlay.tsx`
- Modify: `src/components/__tests__/overlays.test.tsx`

- [ ] **Step 1: Failing tests** in `overlays.test.tsx` (use its existing RevealOverlay render helper):
  - The verdict stamp has `testID="reveal-stamp"` and its text is `'TRUE'` when `truthful`, `'BLUFF'` otherwise (today's text is `'TRUE CLAIM'` / `'BLUFF'`; the stamp replaces the verdict line).
  - The stamp's colour is `neon.cyan` for TRUE and `colors.danger` for BLUFF.
  - The card frame uses the neon frame: `borderColor` `neon.cyan` and `boxShadow` `glow.cyan` (instead of the character accent border).
  - With motion on, the stamp starts with opacity 0 and is fully shown (opacity 1) after `jest.advanceTimersByTime(1000)`; with motion off it is shown at once.
  - The accessibility label is unchanged (`"<headline>. <consequence>. Tap to dismiss"`).

- [ ] **Step 2: Run** `npx jest src/components/__tests__/overlays.test.tsx` → FAIL.

- [ ] **Step 3: Implement.**
  - Replace `useAppear()` on the card with a two-part entrance driven by one `Animated.Value` (`progress`, 0 → 1 over 800 ms, `Easing.out(Easing.cubic)`, started on mount when `motionEnabled()`, else set to 1):
    - card: `opacity` = progress mapped `[0, 0.2] → [0, 1]` (clamp), `transform: [{ scaleX: progress mapped [0, 0.35] → [0.05, 1] (clamp) }]` (the card turns over into view).
    - stamp: an absolutely positioned `Animated.View` (`testID="reveal-stamp"`) over the top-right of the card with `opacity` = progress `[0.45, 0.6] → [0, 1]` and `transform: [{ scale: progress [0.45, 0.7] → [1.8, 1] }, { rotate: '-10deg' }]`. Its text is `TRUE` or `BLUFF`, `fontSize: 22`, `fontWeight: '900'`, `letterSpacing: 3`, colour `neon.cyan` / `colors.danger`, `borderWidth: 2.5` in the same colour, `borderRadius: radius.sm`, `paddingHorizontal: 8`, and a matching text glow (`textShadowColor` = the colour, radius 10).
  - Remove the old verdict `Text` (the stamp says it now); keep headline and consequence as they are.
  - Card frame: `borderColor: neon.cyan`, `borderWidth: 1.5`, `boxShadow: glow.cyan`; keep `backgroundColor: palette.fill` and add `<CardShade />` (from plan 1) as the card's first child.
  - Keep `pointerEvents`, `testID`s, `accessibilityLabel`, `bottomInset` and `compact` behaviour exactly.

- [ ] **Step 4: Run** → PASS; `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — "Stage the challenge result: the card turns over and a TRUE or BLUFF stamp lands".

---

### Task 2: Card-lost scene

**Files:**
- Modify: `src/ui/tableMoments.ts` (+ test): new moment `{ kind: 'cardLost'; playerId: string }`; `SeatMoment` gains `lost: boolean`.
- Modify: `src/components/SeatEffects.tsx` (+ test): red flash when `lost`.
- Create: `src/components/CardCrack.tsx`; Modify: `src/components/CharacterCard.tsx` (+ test).
- Modify: `src/ui/motion.ts` (+ test): `useShake(key)`.
- Modify: `src/screens/GameScreen.tsx`: shake the hand when the local player loses a card.

- [ ] **Step 1: Failing tests.**
  - `tableMoments`: after `{ type: 'coup', playerId: 'b', target: 'c' }` then `{ type: 'loseInfluence', playerId: 'c', cardIndex: 0 }` (use the B-first table from `tableMoments.test.ts`, giving B 7 coins), the second change contains `{ kind: 'cardLost', playerId: 'c' }`; `seatMoment(batch, 'c')` has `lost: true`; a batch without it has `lost: false`. Update the existing `seatMoment` expectations to include `lost: false`.
  - `SeatEffects` with `{ id: 1, block: false, lost: true }` (motion on) renders a view with `testID="seat-lost-flash"`; without `lost` it does not.
  - `CardCrack`: renders two halves (`testID="crack-left"`, `testID="crack-right"`) when `play` is true and motion is on; renders nothing when motion is off or `play` is false; root has `pointerEvents="none"`.
  - `CharacterCard`: rendering with `lost={false}` and then updating to `lost={true}` (motion on) shows a `CardCrack` (find by type) during the scene; rendering a card that is already `lost` on mount shows no crack.
  - `useShake(key)`: returns a translateX `Animated.Value`; with motion on and a changed non-null key it moves away from 0 and is back to 0 after `jest.advanceTimersByTime(600)`; with motion off it stays 0.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

  `tableMoments.ts`: inside `tableMoments`, after the coin loop:

  ```ts
  for (const id of next.playerOrder) {
    const was = previous.players[id];
    const now = next.players[id];
    if (was && now && revealed(now) > revealed(was)) {
      moments.push({ kind: 'cardLost', playerId: id });
    }
  }
  ```

  with `const revealed = (player: Player) => player.influence.filter(card => card.revealed).length;` (import `Player`). Add `'cardLost'` to the `Moment` union, `lost: boolean` to `SeatMoment`, and in `seatMoment` set `lost = lost || moment.kind === 'cardLost'` (a `cardLost` moment alone also makes the result non-null).

  `SeatEffects.tsx`: when `shown.lost`, render `<Animated.View testID="seat-lost-flash" style={[styles.lostFlash, { opacity: flash }]} />` with `lostFlash` = the `flash` style but `borderColor: colors.danger` and `backgroundColor: 'rgba(248, 113, 113, 0.22)'`.

  `src/ui/motion.ts`:

  ```ts
  /** A short side-to-side shake each time `key` changes to a new non-null value. */
  export function useShake(key: number | null): Animated.Value {
    const offset = useValue(0);
    useEffect(() => {
      if (key === null || !motionEnabled()) {
        offset.setValue(0);
        return;
      }
      const step = (toValue: number) =>
        Animated.timing(offset, { toValue, duration: 60, useNativeDriver: true });
      const animation = Animated.sequence([step(-6), step(6), step(-4), step(4), step(0)]);
      animation.start();
      return () => {
        animation.stop();
        offset.setValue(0);
      };
    }, [key, offset]);
    return offset;
  }
  ```

  `src/components/CardCrack.tsx`:

  ```tsx
  import React, { useEffect, useRef, useState } from 'react';
  import { Animated, Easing, StyleSheet, View } from 'react-native';
  import { colors } from '../theme';
  import { motionEnabled } from '../ui/motion';

  /**
   * A card breaking: its two halves drift apart and fade, over a short red flash.
   * Plays once each time `play` turns true; draws nothing with motion off.
   * Decoration only: the card underneath already shows its lost face.
   */
  export function CardCrack({ play }: { play: boolean }) {
    const progress = useRef(new Animated.Value(1)).current;
    const [running, setRunning] = useState(false);
    useEffect(() => {
      if (!play || !motionEnabled()) {
        return;
      }
      setRunning(true);
      progress.setValue(0);
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
      animation.start(() => setRunning(false));
      return () => animation.stop();
    }, [play, progress]);
    if (!running || !motionEnabled()) {
      return null;
    }
    const fade = progress.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
    const apart = (direction: number) =>
      progress.interpolate({ inputRange: [0, 1], outputRange: [0, 14 * direction] });
    const tilt = (direction: number) =>
      progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${8 * direction}deg`] });
    return (
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.fill}
      >
        <Animated.View
          testID="crack-left"
          style={[styles.half, styles.left, { opacity: fade, transform: [{ translateX: apart(-1) }, { rotate: tilt(-1) }] }]}
        />
        <Animated.View
          testID="crack-right"
          style={[styles.half, styles.right, { opacity: fade, transform: [{ translateX: apart(1) }, { rotate: tilt(1) }] }]}
        />
      </View>
    );
  }

  const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
    half: { flex: 1, backgroundColor: 'rgba(248, 113, 113, 0.35)', borderColor: colors.danger },
    left: { borderRightWidth: 1 },
    right: { borderLeftWidth: 1 },
  });
  ```

  `CharacterCard.tsx`: track the previous `lost` value with a `useRef`; `const cracking = lost && wasLost.current === false;` computed in an effect-safe way: keep `const [crackKey, setCrackKey] = useState(false)`; in a `useEffect` on `lost`, if `lost && !previousLost.current` set `setCrackKey(true)`; always update `previousLost.current = lost`. Render `<CardCrack play={crackKey} />` as the card's last child. A card mounted already lost never cracks.

  `GameScreen.tsx`: with the other hooks, `const myLoss = useMemo(...)`-free approach: compute `const myBatch = seatMoment(moments, playerId);` and `const shake = useShake(myBatch?.lost ? myBatch.id : null);`; the hand container `View` (the one with `styles.hand`) becomes an `Animated.View` with `transform: [{ translateX: shake }]` added to its style array (no size change).

- [ ] **Step 4: Run** `npx jest src/ui src/components src/screens` → PASS; `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit** — "Stage a lost card: it cracks apart, the seat flashes red and your hand shakes".

---

### Task 3: Win scene

**Files:**
- Create: `src/components/SparkBurst.tsx`
- Modify: `src/screens/GameOverScreen.tsx`
- Test: `src/components/__tests__/effects.test.tsx`, `src/screens/__tests__/GameOverScreen.test.tsx`

- [ ] **Step 1: Failing tests.**
  - `SparkBurst` (motion on): renders 12 sparks (`testID="spark"`), root `pointerEvents="none"`; after `jest.advanceTimersByTime(1500)` it renders nothing; motion off → nothing at all.
  - `GameOverScreen` (motion on, existing fixtures for a finished game): the title is wrapped in an `Animated.View` with `testID="title-entrance"`; a `SparkBurst` is rendered over the headline panel when the local player won, and not when they lost; the details panel (`testID="results"`) starts at opacity 0 and is 1 after `jest.advanceTimersByTime(1500)`. With motion off everything is shown at once and there is no `SparkBurst`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

  `src/components/SparkBurst.tsx`:

  ```tsx
  import React, { useEffect, useRef, useState } from 'react';
  import { Animated, Easing, StyleSheet, View } from 'react-native';
  import { neon } from '../theme';
  import { motionEnabled } from '../ui/motion';

  const SPARKS = 12;
  const REACH = 70;

  /** A one-off burst of cyan sparks from the middle of its parent. Decoration only. */
  export function SparkBurst() {
    const progress = useRef(new Animated.Value(0)).current;
    const [done, setDone] = useState(!motionEnabled());
    useEffect(() => {
      if (!motionEnabled()) {
        return;
      }
      const animation = Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(() => setDone(true));
      return () => animation.stop();
    }, [progress]);
    if (done) {
      return null;
    }
    const fade = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.8, 0] });
    return (
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.fill}
      >
        {Array.from({ length: SPARKS }, (_, index) => {
          const angle = (index / SPARKS) * 2 * Math.PI;
          const reach = REACH * (index % 2 === 0 ? 1 : 0.7);
          return (
            <Animated.View
              key={index}
              testID="spark"
              style={[
                styles.spark,
                {
                  opacity: fade,
                  transform: [
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * reach] }) },
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * reach] }) },
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1.4, 0.4] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </View>
    );
  }

  const styles = StyleSheet.create({
    fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    spark: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: neon.cyan, boxShadow: '0 0 8px rgba(0, 229, 255, 0.9)' },
  });
  ```

  `GameOverScreen.tsx`:
  - One `entrance` `Animated.Value` (0 → 1 over 1200 ms on mount when `motionEnabled()`, else 1).
  - Wrap the title `Text` in `<Animated.View testID="title-entrance" style={{ opacity: entrance mapped [0, 0.3] → [0, 1], transform: [{ translateX: entrance mapped [0, 0.3] → [-30, 0] }] }}>` (put the static parts in a StyleSheet style to satisfy `react-native/no-inline-styles`).
  - When `youWon`, render `<SparkBurst />` as the last child of the headline `Panel`.
  - The details `Panel`: add `testID="results"` (Panel accepts `testID` since plan 1) and wrap it in an `Animated.View` with `opacity` = entrance mapped `[0.45, 0.75] → [0, 1]` — the wrapper must keep the panel's layout: give the wrapper the layout styles the panel had (`styles.details`, `!portrait && styles.beside`) and make the panel inside `flex: 1`; check in the emulator screenshots that the two columns are unchanged.
  - Clamp all interpolations (`extrapolate: 'clamp'`).

- [ ] **Step 4: Run** full `npx jest`, `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit** — "Stage the win: the title sweeps in under cyan sparks, then the results appear".

---

### Task 4: Build

- [ ] Release build: from `android/`, `JAVA_HOME='C:\Users\erikf\.jdk\jdk-17.0.16' ./gradlew.bat assembleRelease --console=plain -q` → exit 0. Commit any fixes.
