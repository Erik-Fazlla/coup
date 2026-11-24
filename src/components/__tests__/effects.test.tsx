import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act } from 'react-test-renderer';
import { setMotionInstant } from '../../ui/motion';
import { FadeIn } from '../FadeIn';
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

describe('FadeIn', () => {
  afterEach(() => setMotionInstant(true));

  const root = (renderer: ReturnType<typeof render>) =>
    StyleSheet.flatten(
      renderer.root.findAll(node => typeof node.type === 'string')[0].props
        .style,
    );

  it('shows its children at once, filling the screen, with motion off', () => {
    const renderer = render(
      <FadeIn>
        <Text>Lobby</Text>
      </FadeIn>,
    );
    expect(texts(renderer)).toEqual(['Lobby']);
    expect(root(renderer)).toMatchObject({ flex: 1, opacity: 1 });
  });

  it('starts hidden and fades in when motion is on', () => {
    // Under Jest the native driver finishes without writing the value back,
    // so the test checks the animation that is started.
    const timing = jest.spyOn(Animated, 'timing');
    setMotionInstant(false);
    const renderer = render(
      <FadeIn>
        <Text>Lobby</Text>
      </FadeIn>,
    );
    expect(root(renderer)).toMatchObject({ flex: 1, opacity: 0 });
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, useNativeDriver: true }),
    );
    act(() => renderer.unmount());
    timing.mockRestore();
  });
});
