import React from 'react';
import { Animated } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import {
  CountTint,
  motionEnabled,
  setMotionInstant,
  setReduceMotion,
  useCountTick,
  useDealIn,
  useFlip,
  useShake,
  useSweep,
} from '../motion';

afterEach(() => {
  setMotionInstant(true);
  setReduceMotion(false);
});

describe('motionEnabled', () => {
  it('is off under Jest, so no test depends on timing', () => {
    expect(motionEnabled()).toBe(false);
  });

  it('is on in the app and off again with the system reduce-motion setting', () => {
    setMotionInstant(false);
    expect(motionEnabled()).toBe(true);
    setReduceMotion(true);
    expect(motionEnabled()).toBe(false);
  });
});

describe('useFlip', () => {
  let shown = false;

  function Probe({ flipped }: { flipped: boolean }) {
    shown = useFlip(flipped).shown;
    return null;
  }

  it('shows the new face at once when motion is off', () => {
    const renderer = render(<Probe flipped={false} />);
    expect(shown).toBe(false);
    act(() => {
      renderer.update(<Probe flipped />);
    });
    expect(shown).toBe(true);
  });

  it('shows the new face at once with reduce motion on', () => {
    setMotionInstant(false);
    setReduceMotion(true);
    const renderer = render(<Probe flipped={false} />);
    act(() => {
      renderer.update(<Probe flipped />);
    });
    expect(shown).toBe(true);
  });
});

describe('useCountTick', () => {
  let current: { shown: number; tint: CountTint };

  function Probe({ count }: { count: number }) {
    current = useCountTick(count);
    return null;
  }

  const update = (renderer: ReactTestRenderer, count: number) =>
    act(() => {
      renderer.update(<Probe count={count} />);
    });

  it('shows the new number at once, untinted, when motion is off', () => {
    const renderer = render(<Probe count={2} />);
    update(renderer, 5);
    expect(current).toMatchObject({ shown: 5, tint: null });
  });

  it('counts up to the new value and tints it as a gain when motion is on', () => {
    jest.useFakeTimers();
    setMotionInstant(false);
    const renderer = render(<Probe count={2} />);
    update(renderer, 5);
    expect(current.tint).toBe('gain');
    expect(current.shown).toBe(2);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(current).toMatchObject({ shown: 5, tint: null });
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  it('tints a drop as a loss', () => {
    jest.useFakeTimers();
    setMotionInstant(false);
    const renderer = render(<Probe count={7} />);
    update(renderer, 0);
    expect(current.tint).toBe('loss');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(current).toMatchObject({ shown: 0, tint: null });
    act(() => renderer.unmount());
    jest.useRealTimers();
  });
});

/** The current number behind an animated value or interpolation. */
const valueOf = (value: unknown): number =>
  (value as { __getValue: () => number }).__getValue();

describe('useDealIn', () => {
  let style: ReturnType<typeof useDealIn>;

  function Probe({ id, delay }: { id: number | null; delay: number }) {
    style = useDealIn(id, delay);
    return null;
  }

  it('shows the cards as they are when there is nothing to deal', () => {
    setMotionInstant(false);
    render(<Probe id={null} delay={0} />);
    expect(valueOf(style.opacity)).toBe(1);
    expect(valueOf(style.transform[0].scale)).toBe(1);
  });

  it('fades and grows the cards in for a new deal when motion is on', () => {
    // Under Jest the native driver finishes without writing the value back,
    // so the test checks the animation that is started rather than the end value.
    const timing = jest.spyOn(Animated, 'timing');
    setMotionInstant(false);
    const renderer = render(<Probe id={5} delay={160} />);
    expect(valueOf(style.opacity)).toBe(0);
    expect(valueOf(style.transform[0].scale)).toBeCloseTo(0.6);
    expect(timing).toHaveBeenCalledWith(
      style.opacity,
      expect.objectContaining({
        toValue: 1,
        delay: 160,
        useNativeDriver: true,
      }),
    );
    act(() => renderer.unmount());
    timing.mockRestore();
  });

  it('deals again for a new deal id only', () => {
    const timing = jest.spyOn(Animated, 'timing');
    setMotionInstant(false);
    const renderer = render(<Probe id={5} delay={0} />);
    act(() => {
      renderer.update(<Probe id={5} delay={0} />);
    });
    expect(timing).toHaveBeenCalledTimes(1);
    act(() => {
      renderer.update(<Probe id={6} delay={0} />);
    });
    expect(timing).toHaveBeenCalledTimes(2);
    act(() => renderer.unmount());
    timing.mockRestore();
  });

  it('deals nothing with motion off', () => {
    render(<Probe id={5} delay={160} />);
    expect(valueOf(style.opacity)).toBe(1);
  });
});

describe('useSweep', () => {
  let sweep: Animated.Value | null;

  function Probe({ active }: { active: boolean }) {
    sweep = useSweep(active);
    return null;
  }

  it('crosses once when it turns on with motion on', () => {
    jest.useFakeTimers();
    setMotionInstant(false);
    const renderer = render(<Probe active />);
    expect(sweep).not.toBeNull();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(sweep).toBeNull();
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  it('draws nothing with motion off', () => {
    render(<Probe active />);
    expect(sweep).toBeNull();
  });
});

describe('useShake', () => {
  let offset: Animated.Value;

  function Probe({ shakeKey }: { shakeKey: number | null }) {
    offset = useShake(shakeKey);
    return null;
  }

  it('shakes side to side and settles back at 0 for a new key', () => {
    // Under Jest the native driver finishes without writing the value back,
    // so the test checks the steps that are started.
    const timing = jest.spyOn(Animated, 'timing');
    jest.useFakeTimers();
    setMotionInstant(false);
    const renderer = render(<Probe shakeKey={null} />);
    expect(timing).not.toHaveBeenCalled();
    act(() => {
      renderer.update(<Probe shakeKey={3} />);
    });
    const steps = timing.mock.calls.map(([value, config]) => {
      expect(value).toBe(offset);
      expect(config).toMatchObject({ useNativeDriver: true });
      return (config as { toValue: number }).toValue;
    });
    expect(steps).toEqual([-6, 6, -4, 4, 0]);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    act(() => renderer.unmount());
    expect(valueOf(offset)).toBe(0);
    jest.useRealTimers();
    timing.mockRestore();
  });

  it('stays still with motion off', () => {
    const timing = jest.spyOn(Animated, 'timing');
    render(<Probe shakeKey={3} />);
    expect(timing).not.toHaveBeenCalled();
    expect(valueOf(offset)).toBe(0);
    timing.mockRestore();
  });
});
