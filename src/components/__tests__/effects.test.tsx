import React from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { act } from 'react-test-renderer';
import { setMotionInstant } from '../../ui/motion';
import { CardCrack } from '../CardCrack';
import { FadeIn } from '../FadeIn';
import { PulseRing } from '../PulseRing';
import { SeatEffects } from '../SeatEffects';
import { SparkBurst } from '../SparkBurst';
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
        moment={{
          id: 1,
          coins: 2,
          tag: 'TAX · Duke',
          block: false,
          lost: false,
        }}
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

  it('lets the running effect finish when the moment goes to null', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 1, coins: 2, block: false, lost: false }} />,
    );
    expect(texts(renderer)).toContain('+2');
    act(() => {
      renderer.update(<SeatEffects moment={null} />);
    });
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(texts(renderer)).toEqual([]);
  });

  it('writes a loss with a minus sign', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 2, coins: -2, block: false, lost: false }} />,
    );
    expect(texts(renderer)).toContain('−2');
  });

  it('flashes the seat red when it loses a card', () => {
    const flash = (lost: boolean) =>
      render(
        <SeatEffects moment={{ id: 5, block: false, lost }} />,
      ).root.findAll(
        node =>
          node.props.testID === 'seat-lost-flash' &&
          typeof node.type === 'string',
      );
    expect(flash(true)).toHaveLength(1);
    expect(flash(false)).toHaveLength(0);
  });

  it('draws nothing with motion off', () => {
    setMotionInstant(true);
    const renderer = render(
      <SeatEffects
        moment={{
          id: 3,
          coins: 2,
          tag: 'TAX · Duke',
          block: true,
          lost: false,
        }}
      />,
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('takes no touches and is hidden from screen readers', () => {
    const renderer = render(
      <SeatEffects moment={{ id: 4, coins: 1, block: false, lost: false }} />,
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

describe('CardCrack', () => {
  beforeEach(() => {
    setMotionInstant(false);
    jest.useFakeTimers();
  });
  afterEach(() => {
    setMotionInstant(true);
    jest.useRealTimers();
  });

  const halves = (renderer: ReturnType<typeof render>) =>
    renderer.root
      .findAll(node => typeof node.type === 'string')
      .map(node => node.props.testID)
      .filter(id => id === 'crack-left' || id === 'crack-right');

  it('breaks in two, takes no touches, and clears itself', () => {
    const renderer = render(<CardCrack play />);
    expect(halves(renderer)).toEqual(['crack-left', 'crack-right']);
    const root = renderer.root.findAll(
      node => typeof node.type === 'string',
    )[0];
    expect(root.props.pointerEvents).toBe('none');
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('draws nothing when not playing or with motion off', () => {
    expect(render(<CardCrack play={false} />).toJSON()).toBeNull();
    setMotionInstant(true);
    expect(render(<CardCrack play />).toJSON()).toBeNull();
  });
});

describe('SparkBurst', () => {
  afterEach(() => {
    setMotionInstant(true);
    jest.useRealTimers();
  });

  const sparks = (renderer: ReturnType<typeof render>) =>
    renderer.root.findAll(
      node => typeof node.type === 'string' && node.props.testID === 'spark',
    );

  it('bursts twelve sparks once, taking no touches, then clears itself', () => {
    setMotionInstant(false);
    jest.useFakeTimers();
    const renderer = render(<SparkBurst />);
    expect(sparks(renderer)).toHaveLength(12);
    const root = renderer.root.findAll(
      node => typeof node.type === 'string',
    )[0];
    expect(root.props.pointerEvents).toBe('none');
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(renderer.toJSON()).toBeNull();
  });

  it('draws nothing with motion off', () => {
    expect(render(<SparkBurst />).toJSON()).toBeNull();
  });
});
