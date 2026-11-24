import React from 'react';
import { act } from 'react-test-renderer';
import { setMotionInstant } from '../../ui/motion';
import { PulseRing } from '../PulseRing';
import { SeatEffects } from '../SeatEffects';
import { render, texts } from '../testUtils';

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
      <SeatEffects
        moment={{ id: 1, coins: 2, tag: 'TAX · Duke', block: false }}
      />,
    );
    expect(texts(renderer)).toEqual(
      expect.arrayContaining(['+2', 'TAX · Duke']),
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(texts(renderer)).toEqual([]);
  });

  it('writes a loss with a minus sign', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 2, coins: -2, block: false }} />,
    );
    expect(texts(renderer)).toContain('−2');
  });

  it('draws nothing with motion off', () => {
    setMotionInstant(true);
    const renderer = render(
      <SeatEffects
        moment={{ id: 3, coins: 2, tag: 'TAX · Duke', block: true }}
      />,
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('takes no touches and is hidden from screen readers', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 4, coins: 1, block: false }} />,
    );
    const root = renderer.root.findAll(
      node =>
        node.props.testID === 'seat-effects' && typeof node.type === 'string',
    )[0];
    expect(root.props.pointerEvents).toBe('none');
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('PulseRing', () => {
  it('is drawn only while active', () => {
    expect(
      render(<PulseRing active={false} color="#00E5FF" />).toJSON(),
    ).toBeNull();
    expect(
      render(<PulseRing active color="#00E5FF" />).toJSON(),
    ).not.toBeNull();
  });
});
