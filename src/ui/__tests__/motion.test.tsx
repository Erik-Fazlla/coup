import React from 'react';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import {
  CountTint,
  motionEnabled,
  setMotionInstant,
  setReduceMotion,
  useCountTick,
  useFlip,
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
