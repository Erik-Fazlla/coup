import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * All animation in the app goes through the hooks in this file, so components
 * stay declarative and there is one switch that turns motion off.
 *
 * Motion is off (every change is instant, no timers are started) when:
 *  - the system "reduce motion" setting is on, or
 *  - the code runs under Jest, so tests never depend on timing.
 */

declare const process: { env?: Record<string, string | undefined> } | undefined;

const underJest =
  typeof process !== 'undefined' && !!process?.env?.JEST_WORKER_ID;

let instant = underJest;
let reduceMotion = false;
let watching = false;

/** Tests of the motion hooks themselves switch this off; everything else leaves it alone. */
export function setMotionInstant(value: boolean): void {
  instant = value;
}

/** Reads the system setting once and keeps it up to date. Safe to call many times. */
export function watchReduceMotion(): void {
  if (watching) {
    return;
  }
  watching = true;
  try {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(enabled => {
        reduceMotion = enabled === true;
      })
      .catch(() => {});
    AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      reduceMotion = enabled === true;
    });
  } catch {
    // Not knowing the setting only means motion stays on.
  }
}

/** Test seam: what the system setting was last reported as. */
export function setReduceMotion(value: boolean): void {
  reduceMotion = value;
}

/** Whether anything may animate right now. Asked at the moment an animation would start. */
export function motionEnabled(): boolean {
  return !instant && !reduceMotion;
}

export const DURATION = { fast: 120, base: 220, slow: 300 };

const easeOut = Easing.out(Easing.cubic);

function useValue(initial: number): Animated.Value {
  const ref = useRef<Animated.Value | null>(null);
  if (ref.current === null) {
    ref.current = new Animated.Value(initial);
  }
  return ref.current;
}

/** Pressed feedback: the surface dips slightly while a finger is on it. */
export function usePressScale(pressedScale = 0.96) {
  const scale = useValue(1);
  const to = useCallback(
    (value: number) => {
      if (!motionEnabled()) {
        scale.setValue(1);
        return;
      }
      Animated.timing(scale, {
        toValue: value,
        duration: DURATION.fast,
        easing: easeOut,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );
  const onPressIn = useCallback(() => to(pressedScale), [to, pressedScale]);
  const onPressOut = useCallback(() => to(1), [to]);
  return { scale, onPressIn, onPressOut };
}

/**
 * Something new appeared: fade it in while it rises a few points. Runs again
 * whenever `key` changes. Returns a style for an Animated.View.
 */
export function useEnter(key: string | number | null, rise = 6) {
  const progress = useValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!motionEnabled()) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION.base,
      easing: easeOut,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [key, progress]);
  return {
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [rise, 0],
        }),
      },
    ],
  };
}

/**
 * Something appeared for the first time (an overlay): fade and grow in on
 * mount. Returns a style for an Animated.View.
 */
export function useAppear() {
  const progress = useValue(motionEnabled() ? 0 : 1);
  useEffect(() => {
    if (!motionEnabled()) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION.base,
      easing: easeOut,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return {
    opacity: progress,
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      },
    ],
  };
}

/**
 * The one looping animation in the app: a slow breath between 0 and 1 while
 * `active`. With motion off it rests at 1, so the highlight is simply on.
 */
export function usePulse(active: boolean): Animated.Value {
  const value = useValue(1);
  useEffect(() => {
    if (!active || !motionEnabled()) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 0.25,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      value.setValue(1);
    };
  }, [active, value]);
  return value;
}

/**
 * A card turning over. `shown` is the face to draw: it follows `flipped` at
 * once when motion is off, and halfway through the turn when it is on.
 */
export function useFlip(flipped: boolean) {
  const scaleX = useValue(1);
  const [shown, setShown] = useState(flipped);
  useEffect(() => {
    if (shown === flipped) {
      return;
    }
    if (!motionEnabled()) {
      scaleX.setValue(1);
      setShown(flipped);
      return;
    }
    let cancelled = false;
    const half = DURATION.slow / 2;
    const close = Animated.timing(scaleX, {
      toValue: 0,
      duration: half,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    const open = Animated.timing(scaleX, {
      toValue: 1,
      duration: half,
      easing: easeOut,
      useNativeDriver: true,
    });
    close.start(({ finished }) => {
      if (cancelled || !finished) {
        return;
      }
      setShown(flipped);
      open.start();
    });
    return () => {
      cancelled = true;
      close.stop();
      open.stop();
      scaleX.setValue(1);
    };
    // `shown` is left out on purpose: it changes mid-turn and must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, scaleX]);
  return {
    shown: motionEnabled() ? shown : flipped,
    style: { transform: [{ scaleX }] },
  };
}

const TICK_MS = 45;
const MAX_TICKS = 8;
const TINT_MS = 700;

export type CountTint = 'gain' | 'loss' | null;

/**
 * A number changing: it counts to the new value, bumps in size, and is tinted
 * for a moment by direction. With motion off the new number simply appears.
 */
export function useCountTick(count: number) {
  const scale = useValue(1);
  const [shown, setShown] = useState(count);
  const [tint, setTint] = useState<CountTint>(null);
  const from = useRef(count);

  useEffect(() => {
    const start = from.current;
    from.current = count;
    if (start === count) {
      return;
    }
    if (!motionEnabled()) {
      setShown(count);
      setTint(null);
      return;
    }
    const distance = Math.abs(count - start);
    const ticks = Math.min(distance, MAX_TICKS);
    let tick = 0;
    setTint(count > start ? 'gain' : 'loss');
    const interval = setInterval(() => {
      tick += 1;
      setShown(
        tick >= ticks
          ? count
          : Math.round(start + ((count - start) * tick) / ticks),
      );
      if (tick >= ticks) {
        clearInterval(interval);
      }
    }, TICK_MS);
    const clearTint = setTimeout(() => setTint(null), TINT_MS);
    const bump = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.25,
        duration: DURATION.fast,
        easing: easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: DURATION.base,
        easing: easeOut,
        useNativeDriver: true,
      }),
    ]);
    bump.start();
    return () => {
      clearInterval(interval);
      clearTimeout(clearTint);
      bump.stop();
      scale.setValue(1);
    };
  }, [count, scale]);

  return motionEnabled()
    ? { shown, tint, scale }
    : { shown: count, tint: null as CountTint, scale };
}
