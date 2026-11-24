# Noir Neon — Plan 3: Quick Effects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Short (≤ ~0.7 s), never-blocking animations at the table and between screens: coin changes, claim tags, block flash, turn and target pulses, the "your turn" sweep, the deal at game start, lobby joins popping in, and screens fading in.

**Architecture:** One pure function, `tableMoments(previous, next)` in `src/ui/tableMoments.ts`, turns two game snapshots into a list of moments (same rule as `soundCues`: nothing for what a first snapshot already holds, except the deal). `useTableMoments` keeps the previous snapshot and numbers each batch; `seatMoment()` picks out one player's part. Small presentational pieces (`SeatEffects`, `PulseRing`, a sweep in `EventBanner`, a deal-in on card rows, `FadeIn` around routed screens) animate with React Native `Animated` on the native driver. Every animation goes through `motionEnabled()` (`src/ui/motion.ts`): with reduce-motion on, or under Jest, nothing animates and effects that only exist as motion are not drawn.

**Tech Stack:** TypeScript, React Native `Animated`, Jest + react-test-renderer.

**Spec:** `docs/specs/2026-11-24-coup-noir-neon-upgrade-design.md`, Part 2 "Quick effects".

**Decision recorded here (deviation from the spec table):** coins are shown as a gold "+2" / "−2" chip that rises and fades on the seat (or on your hand) of each player whose coins changed, instead of coins flying between seats. Flying needs on-screen positions of every seat and the bank measured across rows, which is fragile with 3–10 players in landscape and portrait; the rising chip shows the same information (who gained, who lost, how much) at the same moment. Button press feedback was already done in plan 1.

## Ground rules

- Branch `feat/noir-neon-ui` in `D:\Projects\Owned\Coup`; do not push.
- Never edit `src/engine/**`, `src/firebase/**`, `database.rules.json`, `src/components/tableLayout.ts`.
- Effects are overlays (`position: 'absolute'`, `pointerEvents="none"`, hidden from accessibility) or `opacity`/`transform` on views that already exist. They never change a size, margin, padding or flex value.
- `useNativeDriver: true` for every animation (only `opacity` and `transform` are animated).
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests: `npx jest <path>`. Tests that need motion on call `setMotionInstant(false)` from `src/ui/motion` in `beforeEach` and `setMotionInstant(true)` in `afterEach`, and use `jest.useFakeTimers()`.

---

### Task 1: `tableMoments`

**Files:**
- Create: `src/ui/tableMoments.ts`
- Create: `src/ui/__tests__/tableMoments.test.ts`

- [ ] **Step 1: Failing tests** (`src/ui/__tests__/tableMoments.test.ts`):

```ts
import { makeGame, play } from '../../engine/testHelpers';
import { Game } from '../../engine/types';
import { isDealSnapshot, seatMoment, tableMoments } from '../tableMoments';

/** B acts first. */
const table = (): Game =>
  makeGame(
    { b: ['Contessa', 'Assassin'], me: ['Duke', 'Captain'], c: ['Ambassador', 'Duke'] },
    { coins: { b: 7 } },
  );

describe('tableMoments', () => {
  it('deals on the first snapshot of a game that has just started, and nothing else', () => {
    const start = table();
    expect(isDealSnapshot(start)).toBe(true);
    expect(tableMoments(null, start)).toEqual([{ kind: 'deal' }]);
    const later = play(start, { type: 'income', playerId: 'b' });
    expect(tableMoments(null, later)).toEqual([]);
  });

  it('shows coin changes for every player they changed for', () => {
    const before = table();
    const after = play(before, { type: 'income', playerId: 'b' });
    expect(tableMoments(before, after)).toEqual([{ kind: 'coins', playerId: 'b', delta: 1 }]);
  });

  it('tags the claim when an action opens for responses', () => {
    const before = table();
    const claimed = play(before, { type: 'tax', playerId: 'b' });
    expect(tableMoments(before, claimed)).toContainEqual({
      kind: 'claim',
      playerId: 'b',
      label: 'TAX · Duke',
    });
    // The same claim is not tagged again while others answer.
    expect(tableMoments(claimed, { ...claimed, log: [] })).toEqual([]);
  });

  it('flashes the blocker when a block is declared', () => {
    const stolen = play(table(), { type: 'steal', playerId: 'b', target: 'me' });
    const blocked = play(stolen, { type: 'block', playerId: 'me', claim: 'Captain' });
    expect(tableMoments(stolen, blocked)).toContainEqual({
      kind: 'block',
      playerId: 'me',
      label: 'BLOCK · Captain',
    });
  });

  it('treats another round or another game like a first snapshot', () => {
    const before = play(table(), { type: 'income', playerId: 'b' });
    const other = { ...table(), round: 2 };
    expect(tableMoments(before, other)).toEqual([{ kind: 'deal' }]);
  });

  it('never names a hidden card', () => {
    const before = table();
    const after = play(before, { type: 'tax', playerId: 'b' });
    const text = JSON.stringify(tableMoments(before, after));
    // B holds Contessa and Assassin; only the claimed Duke may appear.
    expect(text).not.toContain('Contessa');
    expect(text).not.toContain('Assassin');
  });
});

describe('seatMoment', () => {
  it('gathers one player’s part of a batch', () => {
    const batch = {
      seq: 3,
      moments: [
        { kind: 'coins' as const, playerId: 'b', delta: -2 },
        { kind: 'claim' as const, playerId: 'b', label: 'STEAL · Captain' },
        { kind: 'coins' as const, playerId: 'c', delta: 2 },
      ],
    };
    expect(seatMoment(batch, 'b')).toEqual({ id: 3, coins: -2, tag: 'STEAL · Captain', block: false });
    expect(seatMoment(batch, 'me')).toBeNull();
  });
});
```

If an engine setup does not reach the state a test expects (e.g. `pending` is not set after `steal`), read `src/engine/testHelpers.ts` / `src/engine/actions.ts` (read only) and fix the setup, never the asserted moment.

- [ ] **Step 2: Run** `npx jest src/ui/__tests__/tableMoments.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/ui/tableMoments.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { ACTION_LABEL } from '../engine/describe';
import { Game } from '../engine/types';

/** Something on the table worth a short animation. Never names a hidden card. */
export type Moment =
  | { kind: 'coins'; playerId: string; delta: number }
  | { kind: 'claim'; playerId: string; label: string }
  | { kind: 'block'; playerId: string; label: string }
  | { kind: 'deal' };

/** The moments of one snapshot change, numbered so a component can tell a new batch from an old one. */
export interface MomentBatch {
  seq: number;
  moments: Moment[];
}

/** What one seat (or the local player's hand) shows for a batch. */
export interface SeatMoment {
  id: number;
  coins?: number;
  tag?: string;
  block: boolean;
}

function sameRound(a: Game, b: Game): boolean {
  return a.code === b.code && a.createdAt === b.createdAt && a.round === b.round;
}

/** The first snapshot of a game nobody has moved in yet: the cards are being dealt. */
export function isDealSnapshot(game: Game): boolean {
  const { state } = game;
  return (
    game.status === 'playing' &&
    state.turnNumber === 1 &&
    state.lastAction === null &&
    state.pending === null &&
    state.phase === 'action'
  );
}

/**
 * The moments between two snapshots, as everyone at the table sees them. A first
 * snapshot (no previous one, or another game or round) shows only the deal, and
 * only when nobody has moved yet: reopening the app never replays the table.
 */
export function tableMoments(previous: Game | null, next: Game): Moment[] {
  if (previous === next) {
    return [];
  }
  if (!previous || !sameRound(previous, next)) {
    return isDealSnapshot(next) ? [{ kind: 'deal' }] : [];
  }
  const moments: Moment[] = [];
  const before = previous.state.pending;
  const after = next.state.pending;
  if (after && (!before || before.actor !== after.actor || before.action !== after.action)) {
    const label = ACTION_LABEL[after.action].toUpperCase();
    moments.push({
      kind: 'claim',
      playerId: after.actor,
      label: after.claim ? `${label} · ${after.claim}` : label,
    });
  }
  if (after?.block && !before?.block) {
    moments.push({
      kind: 'block',
      playerId: after.block.blocker,
      label: `BLOCK · ${after.block.claim}`,
    });
  }
  for (const id of next.playerOrder) {
    const was = previous.players[id];
    const now = next.players[id];
    if (was && now && now.coins !== was.coins) {
      moments.push({ kind: 'coins', playerId: id, delta: now.coins - was.coins });
    }
  }
  return moments;
}

/** Keeps the previous snapshot and hands out each new non-empty batch of moments. */
export function useTableMoments(game: Game | null): MomentBatch {
  const previous = useRef<Game | null>(null);
  const [batch, setBatch] = useState<MomentBatch>({ seq: 0, moments: [] });
  useEffect(() => {
    if (!game) {
      return;
    }
    const moments = tableMoments(previous.current, game);
    previous.current = game;
    if (moments.length > 0) {
      setBatch(current => ({ seq: current.seq + 1, moments }));
    }
  }, [game]);
  return batch;
}

/** One player's part of a batch, or null when the batch does not concern them. */
export function seatMoment(batch: MomentBatch, playerId: string): SeatMoment | null {
  let coins: number | undefined;
  let tag: string | undefined;
  let block = false;
  for (const moment of batch.moments) {
    if (moment.kind === 'deal' || moment.playerId !== playerId) {
      continue;
    }
    if (moment.kind === 'coins') {
      coins = moment.delta;
    } else {
      tag = moment.label;
      block = block || moment.kind === 'block';
    }
  }
  return coins === undefined && tag === undefined ? null : { id: batch.seq, coins, tag, block };
}

/** The batch number of the latest deal, or null if the latest batch is not a deal. */
export function dealId(batch: MomentBatch): number | null {
  return batch.moments.some(moment => moment.kind === 'deal') ? batch.seq : null;
}
```

Also add `dealId` to the test file imports and a test: `expect(dealId({ seq: 4, moments: [{ kind: 'deal' }] })).toBe(4)` and `toBeNull()` for a batch without a deal.

- [ ] **Step 4: Run** → PASS. `npm run typecheck` → clean.

- [ ] **Step 5: Commit** — `git add src/ui/tableMoments.ts src/ui/__tests__/tableMoments.test.ts` → "Work out the table moments (coins, claims, blocks, the deal) from game snapshots".

---

### Task 2: Effect pieces

**Files:**
- Create: `src/components/SeatEffects.tsx`, `src/components/PulseRing.tsx`
- Modify: `src/ui/motion.ts` (add `useDealIn`, `useSweep`)
- Create: `src/components/__tests__/effects.test.tsx`
- Modify: `src/ui/__tests__/motion.test.tsx`

- [ ] **Step 1: Failing tests** (`src/components/__tests__/effects.test.tsx`):

```tsx
import React from 'react';
import { Text } from 'react-native';
import { act } from 'react-test-renderer';
import { setMotionInstant } from '../../ui/motion';
import { PulseRing } from '../PulseRing';
import { SeatEffects } from '../SeatEffects';
import { render } from '../testUtils';

const texts = (renderer: ReturnType<typeof render>) =>
  renderer.root.findAllByType(Text).map(node => node.props.children);

describe('SeatEffects', () => {
  beforeEach(() => {
    setMotionInstant(false);
    jest.useFakeTimers();
  });
  afterEach(() => {
    setMotionInstant(true);
    jest.useRealTimers();
  });

  it('shows the coin change and the claim tag for a new moment, then clears them', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 1, coins: 2, tag: 'TAX · Duke', block: false }} />,
    );
    expect(texts(renderer)).toEqual(expect.arrayContaining(['+2', 'TAX · Duke']));
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(texts(renderer)).toEqual([]);
  });

  it('writes a loss with a minus sign', () => {
    const renderer = render(<SeatEffects moment={{ id: 2, coins: -2, block: false }} />);
    expect(texts(renderer)).toContain('−2');
  });

  it('draws nothing with motion off', () => {
    setMotionInstant(true);
    const renderer = render(
      <SeatEffects moment={{ id: 3, coins: 2, tag: 'TAX · Duke', block: true }} />,
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('takes no touches and is hidden from screen readers', () => {
    const renderer = render(<SeatEffects moment={{ id: 4, coins: 1, block: false }} />);
    const root = renderer.root.findAll(node => node.props.testID === 'seat-effects' && typeof node.type === 'string')[0];
    expect(root.props.pointerEvents).toBe('none');
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('PulseRing', () => {
  it('is drawn only while active', () => {
    expect(render(<PulseRing active={false} color="#00E5FF" />).toJSON()).toBeNull();
    expect(render(<PulseRing active color="#00E5FF" />).toJSON()).not.toBeNull();
  });
});
```

Add to `src/ui/__tests__/motion.test.tsx` (follow that file's existing pattern for testing hooks with `setMotionInstant(false)`):
- `useDealIn(null, 0)` returns opacity 1 / scale 1 (nothing to deal).
- `useDealIn(5, 160)` with motion on starts at opacity 0 and reaches 1 after `jest.advanceTimersByTime(1000)`.
- `useSweep(true)` returns a translate value; with motion off `useSweep` returns `null`.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

Add to `src/ui/motion.ts`:

```ts
/**
 * Cards arriving at the start of a game: fade and grow in after `delay` ms,
 * once per `dealId` (a new id deals again). With no deal or motion off: shown as is.
 */
export function useDealIn(dealId: number | null, delay: number) {
  const progress = useValue(1);
  useEffect(() => {
    if (dealId === null || !motionEnabled()) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: DURATION.slow,
      easing: easeOut,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [dealId, delay, progress]);
  return {
    opacity: progress,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
  };
}

/**
 * A band of light crossing a surface once each time `active` turns true.
 * Returns 0→1 progress to map onto a translateX, or null when nothing should be drawn.
 */
export function useSweep(active: boolean): Animated.Value | null {
  const progress = useValue(1);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!active || !motionEnabled()) {
      setRunning(false);
      return;
    }
    progress.setValue(0);
    setRunning(true);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 550,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(() => setRunning(false));
    return () => animation.stop();
  }, [active, progress]);
  return running ? progress : null;
}
```

Create `src/components/PulseRing.tsx`:

```tsx
import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { radius } from '../theme';
import { usePulse } from '../ui/motion';

/**
 * A glowing outline that breathes while `active`: the player whose turn it is
 * (gold) or an opponent you can target (cyan). Drawn over the seat's own border.
 */
export function PulseRing({ active, color }: { active: boolean; color: string }) {
  const pulse = usePulse(active);
  if (!active) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.ring,
        { borderColor: color, boxShadow: `0 0 14px ${color}`, opacity: pulse },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: radius.md + 2,
    borderWidth: 2,
  },
});
```

Create `src/components/SeatEffects.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, DENSE_FONT_SCALE, glow, neon, radius, typography } from '../theme';
import { motionEnabled } from '../ui/motion';
import { SeatMoment } from '../ui/tableMoments';

const SHOW_MS = 1100;

/**
 * The short-lived effects on one seat (or the local player's hand): a gold coin
 * change rising and fading, a claim or block tag popping in, and a flash for a
 * block. Each new `moment.id` plays once. Draws nothing with motion off.
 */
export function SeatEffects({ moment }: { moment: SeatMoment | null }) {
  const progress = useRef(new Animated.Value(1)).current;
  const [shown, setShown] = useState<SeatMoment | null>(null);

  useEffect(() => {
    if (!moment || !motionEnabled()) {
      return;
    }
    setShown(moment);
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SHOW_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) {
        setShown(null);
      }
    });
    return () => animation.stop();
    // Only a new moment id starts the effect again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment?.id]);

  if (!shown || !motionEnabled()) {
    return null;
  }
  const fadeOut = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [6, -14] });
  const pop = progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.7, 1, 1] });
  const flash = progress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 0, 0] });
  const coins = shown.coins;

  return (
    <View
      testID="seat-effects"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.fill}
    >
      {shown.block && <Animated.View style={[styles.flash, { opacity: flash }]} />}
      {shown.tag !== undefined && (
        <Animated.View style={[styles.tag, { opacity: fadeOut, transform: [{ scale: pop }] }]}>
          <Text style={styles.tagText} numberOfLines={1} maxFontSizeMultiplier={DENSE_FONT_SCALE}>
            {shown.tag}
          </Text>
        </Animated.View>
      )}
      {coins !== undefined && (
        <Animated.Text
          style={[
            styles.coins,
            coins < 0 && styles.coinsLost,
            { opacity: fadeOut, transform: [{ translateY: rise }] },
          ]}
          maxFontSizeMultiplier={DENSE_FONT_SCALE}
        >
          {coins > 0 ? `+${coins}` : `−${Math.abs(coins)}`}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.md, borderWidth: 2, borderColor: neon.cyan, backgroundColor: 'rgba(0, 229, 255, 0.18)' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.borderStrong, boxShadow: glow.soft },
  tagText: { ...typography.micro, color: neon.ice },
  coins: { position: 'absolute', right: 6, bottom: 4, fontSize: 15, fontWeight: '800', color: colors.coin, textShadowColor: colors.coinShade, textShadowRadius: 6 },
  coinsLost: { color: colors.danger, textShadowColor: colors.dangerFill },
});
```

(`colors.sheet` was added in plan 1's fixes. Note that `Animated.Text` content is found by `findAllByType(Text)` in the test only if it renders a host `Text`; if the test cannot see it, find text nodes with `renderer.root.findAll(n => typeof n.props.children === 'string')` instead — keep the assertions.)

- [ ] **Step 4: Run** `npx jest src/components/__tests__/effects.test.tsx src/ui/__tests__/motion.test.tsx` → PASS.

- [ ] **Step 5: Commit** — "Add seat effects, the pulse ring, the deal-in and the sweep".

---

### Task 3: Wire the effects into the table

**Files:**
- Modify: `src/components/Seat.tsx` (props `moment`, `dealId`, `dealDelay`; `PulseRing`s; `SeatEffects`; deal-in on the cards row)
- Modify: `src/components/EventBanner.tsx` (sweep when `yours` turns true)
- Modify: `src/screens/GameScreen.tsx` (call `useTableMoments`, pass moments; deal-in on the hand cards; `SeatEffects` in the hand)
- Modify: `src/components/__tests__/table.test.tsx` / `Seat.test.tsx` (new prop tests)

- [ ] **Step 1: Failing tests.** In `src/components/__tests__/Seat.test.tsx` (follow its existing render helper), with `setMotionInstant(false)` + fake timers in that describe block:
  - A seat rendered with `moment={{ id: 1, coins: 2, block: false }}` shows `+2`.
  - A seat with `isTurn` renders a `PulseRing` (find by type) and one without does not; a seat with a `target` renders a `PulseRing`.
  - The seat's accessibility label (`summary`) is unchanged by a moment (effects are not spoken).

  In the GameScreen tests (`src/screens/__tests__/GameScreen.test.tsx`), add: re-rendering the screen with a snapshot where an opponent gained coins (use the file's existing game fixtures and the way it feeds new snapshots) shows `+N` on that seat when motion is on.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`Seat.tsx`:
- New optional props: `moment?: SeatMoment | null`, `dealId?: number | null`, `dealDelay?: number`.
- Import `PulseRing`, `SeatEffects`, `useDealIn`, `SeatMoment`, and `neon`, `colors`.
- Inside the seat's frame (as the last children, so they draw on top): `<PulseRing active={isTurn && !target} color={colors.coin} />`, `<PulseRing active={!!target} color={neon.cyan} />`, `<SeatEffects moment={moment ?? null} />`.
- The row of cards (`<View style={styles.cards}>`) becomes `<Animated.View style={[styles.cards, deal]}>` with `const deal = useDealIn(dealId ?? null, dealDelay ?? 0);`.
- Keep the `summary` accessibility label exactly as it is.

`EventBanner.tsx`:
- `const sweep = useSweep(yours);` and a measured width (`onLayout` on the banner, kept in state).
- When `sweep` is not null, render as the banner's last child:
  ```tsx
  <Animated.View
    pointerEvents="none"
    style={[
      styles.sweep,
      { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-SWEEP_WIDTH, width] }) }] },
    ]}
  />
  ```
  with `const SWEEP_WIDTH = 90;` and style `sweep: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SWEEP_WIDTH, backgroundColor: 'rgba(0, 229, 255, 0.22)' }`. The banner already has `overflow: 'hidden'`, so the band is clipped to it.

`GameScreen.tsx`:
- `const moments = useTableMoments(playing ? game : null);` next to `useGameSounds`, and `const deal = dealId(moments);`.
- Each `<Seat>` gets `moment={seatMoment(moments, id)}`, `dealId={deal}`, `dealDelay={index * 80}` where `index` is the seat's position in `opponents` (`opponents.indexOf(id)`).
- The hand: `<View style={styles.handCards}>` becomes `<Animated.View style={[styles.handCards, handDeal]}>` with `const handDeal = useDealIn(deal, Math.min(opponents.length * 80, 640));` — declare it with the other hooks at the top of the component (hooks before any early `return`), passing `deal` from there.
- Inside the hand container, after the cards, `<SeatEffects moment={seatMoment(moments, playerId)} />`.

- [ ] **Step 4: Run** `npx jest src/components src/screens` → PASS; `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit** — "Show coin changes, claims, blocks, turn and target pulses, the your-turn sweep and the deal at the table".

---

### Task 4: Lobby pop-in and screen fade-in

**Files:**
- Create: `src/components/FadeIn.tsx`
- Modify: `App.tsx` (`GameRouter` wraps the routed screen)
- Modify: `src/screens/LobbyScreen.tsx` (each player row pops in)
- Test: `src/components/__tests__/effects.test.tsx`, `src/screens/__tests__/LobbyScreen.test.tsx`

- [ ] **Step 1: Failing tests.**
  - `FadeIn`: renders its children; with motion on its root starts at opacity 0 and is 1 after `jest.advanceTimersByTime(500)`; with motion off opacity is 1 at once; its root has `flex: 1`.
  - Lobby: every player row is wrapped in an `Animated.View` keyed by player id (a newly joined player appears; existing rows keep their keys). Assert that the number of player rows equals `game.playerOrder.length` before and after a player joins (existing test fixtures), and that the row content (name, Remove button) is unchanged.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement.**

`src/components/FadeIn.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { DURATION, motionEnabled } from '../ui/motion';

/** A screen fading in when it opens (mount). Fills its parent like the screen it wraps. */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(motionEnabled() ? 0 : 1)).current;
  useEffect(() => {
    if (!motionEnabled()) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: DURATION.base,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  return <Animated.View style={[styles.fill, { opacity }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flex: 1, backgroundColor: '#000000' } });
```

`App.tsx` — in `GameRouter`, compute `const route = routeFor(game, playerId);`, build the screen element with the existing `switch` (move it into a small `screenFor(route)` helper inside the component, unchanged otherwise), and return `<FadeIn key={route}>{screen}</FadeIn>`. The key makes each route change mount a fresh fade.

`LobbyScreen.tsx` — wrap each player row (the element returned inside `game.playerOrder.map`) in a small component:

```tsx
function PopIn({ children }: { children: React.ReactNode }) {
  const style = useAppear();
  return <Animated.View style={style}>{children}</Animated.View>;
}
```

keyed by the player id (move the existing `key` onto `PopIn`). `useAppear` is in `src/ui/motion.ts` (fade + grow on mount; instant with motion off). The wrapper only adds opacity/scale; check the rows still stretch to full width (the rows' container has `alignSelf: 'stretch'`; give `PopIn`'s `Animated.View` `alignSelf: 'stretch'` through a StyleSheet style if the rows narrow).

- [ ] **Step 4: Run** `npx jest` (full, ~60 s), `npm run typecheck`, `npm run lint` → clean.

- [ ] **Step 5: Commit** — "Fade screens in and pop new players into the lobby".

---

### Task 5: Build

- [ ] Release build: from `android/`, `JAVA_HOME='C:\Users\erikf\.jdk\jdk-17.0.16' ./gradlew.bat assembleRelease --console=plain -q` → exit 0.
- [ ] Commit any fixes.
