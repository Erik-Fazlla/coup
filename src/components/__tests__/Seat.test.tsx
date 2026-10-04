import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Player } from '../../engine/types';
import { CardBack } from '../CardBack';
import { MiniCard } from '../MiniCard';
import { Seat, SeatTarget } from '../Seat';
import { button, findButton, press, render, rendered } from '../testUtils';

/** A card name that exists nowhere else, so finding it on screen can only be a leak. */
const SECRET = 'Zzsecret' as Card;

function player(partial: Partial<Player> = {}): Player {
  return {
    name: 'OTHER',
    coins: 3,
    influence: [
      { card: SECRET, revealed: false },
      { card: SECRET, revealed: false },
    ],
    eliminatedAt: null,
    ...partial,
  };
}

function target(partial: Partial<SeatTarget> = {}): SeatTarget {
  return { verb: 'Steal', disabled: false, onPress: jest.fn(), ...partial };
}

const label = (renderer: ReturnType<typeof render>) =>
  renderer.root.findAll(
    node => typeof node.props.accessibilityLabel === 'string',
  )[0].props.accessibilityLabel as string;

describe('Seat', () => {
  it('shows the name, the coins and one card back per hidden card', () => {
    const renderer = render(<Seat player={player()} isTurn={false} />);
    expect(rendered(renderer)).toContain('OTHER');
    expect(renderer.root.findAllByType(CardBack)).toHaveLength(2);
    expect(renderer.root.findAllByType(MiniCard)).toHaveLength(0);
    expect(label(renderer)).toBe('OTHER, 3 coins, 2 hidden cards');
  });

  it('never renders or speaks the name of a hidden card', () => {
    [
      <Seat player={player()} isTurn />,
      <Seat player={player()} isTurn={false} target={target()} />,
    ].forEach(element => {
      expect(rendered(render(element))).not.toContain(SECRET);
    });
  });

  it('shows a lost card by name and keeps the other one hidden', () => {
    const renderer = render(
      <Seat
        player={player({
          coins: 1,
          influence: [
            { card: 'Duke', revealed: true },
            { card: SECRET, revealed: false },
          ],
        })}
        isTurn={false}
      />,
    );
    expect(renderer.root.findAllByType(CardBack)).toHaveLength(1);
    expect(
      renderer.root.findAllByType(MiniCard).map(node => node.props.card),
    ).toEqual(['Duke']);
    expect(label(renderer)).toBe('OTHER, 1 coin, 1 hidden card, lost Duke');
    expect(rendered(renderer)).not.toContain(SECRET);
  });

  it('shows an eliminated player as out, with both lost cards', () => {
    const renderer = render(
      <Seat
        player={player({
          influence: [
            { card: 'Duke', revealed: true },
            { card: 'Contessa', revealed: true },
          ],
        })}
        isTurn={false}
      />,
    );
    expect(rendered(renderer)).toContain('OUT');
    expect(renderer.root.findAllByType(CardBack)).toHaveLength(0);
    expect(label(renderer)).toBe('OTHER, out, lost Duke and Contessa');
  });

  it('marks whose turn it is', () => {
    const renderer = render(<Seat player={player()} isTurn />);
    expect(rendered(renderer)).toContain('TURN');
    expect(label(renderer)).toBe('OTHER, 3 coins, 2 hidden cards, their turn');
  });

  it('is not tappable outside targeting mode', () => {
    const renderer = render(
      <Seat player={player()} isTurn={false} testID="seat" />,
    );
    expect(findButton(renderer, 'seat')).toBeUndefined();
    expect(rendered(renderer)).not.toContain('TAP');
  });

  it('becomes a button that sends the target in targeting mode', () => {
    const chosen = target();
    const renderer = render(
      <Seat player={player()} isTurn={false} target={chosen} testID="seat" />,
    );
    expect(rendered(renderer)).toContain('TAP TO TARGET');
    expect(button(renderer, 'seat').props.accessibilityLabel).toBe(
      'Steal: OTHER, 3 coins, 2 hidden cards. Tap to target',
    );
    press(renderer, 'seat');
    expect(chosen.onPress).toHaveBeenCalledTimes(1);
  });

  it('shortens the tag on a narrow seat', () => {
    const renderer = render(
      <Seat player={player()} isTurn={false} target={target()} compact />,
    );
    expect(rendered(renderer)).toContain('TAP');
    expect(rendered(renderer)).not.toContain('TAP TO TARGET');
  });

  describe('room for the name while a target is being chosen', () => {
    const parts = (width: number) => {
      const renderer = render(
        <Seat
          player={player({ name: 'Αλεξανδρόπουλος1' })}
          isTurn={false}
          target={target()}
          compact
          width={width}
        />,
      );
      const text = (children: string) =>
        StyleSheet.flatten(
          renderer.root.find(
            node =>
              typeof node.type === 'string' && node.props.children === children,
          ).props.style,
        );
      return { name: text('Αλεξανδρόπουλος1'), tag: text('TAP') };
    };

    it('lets the name give way and never the tag', () => {
      const { name, tag } = parts(108);
      expect(name.flexShrink).toBe(1);
      expect(tag.flexShrink).toBe(0);
      expect(tag.marginLeft).toBeLessThan(4);
    });

    it('keeps the full-size name on a wide seat, which still gets the short tag', () => {
      expect(parts(220).name.fontSize).toBe(14);
      expect(parts(150).name.fontSize).toBe(14);
      expect(parts(149).name.fontSize).toBe(12);
      expect(parts(108).name.fontSize).toBe(12);
    });
  });

  describe('at the slim height of a full table', () => {
    const parts = (height?: number) => {
      const renderer = render(
        <Seat
          player={player()}
          isTurn={false}
          width={220}
          height={height}
          testID="seat"
        />,
      );
      return {
        frame: StyleSheet.flatten(
          renderer.root.find(
            node =>
              typeof node.type === 'string' && node.props.testID === 'seat',
          ).props.style,
        ),
        name: StyleSheet.flatten(
          renderer.root.find(
            node =>
              typeof node.type === 'string' && node.props.children === 'OTHER',
          ).props.style,
        ),
        backs: renderer.root.findAllByType(CardBack).length,
      };
    };

    it('is 56 high with the full-size name by default', () => {
      const { frame, name } = parts();
      expect(frame.height).toBe(56);
      expect(frame.paddingVertical).toBe(5);
      expect(name.fontSize).toBe(14);
    });

    it('is 48 high with less padding and the smaller name, still showing both cards', () => {
      const { frame, name, backs } = parts(48);
      expect(frame.height).toBe(48);
      expect(frame.paddingVertical).toBe(2);
      expect(name.fontSize).toBe(12);
      expect(backs).toBe(2);
      // Border 2+2, padding 2+2, a 15 name line and the 24 cards.
      expect(4 + 4 + name.lineHeight + 24).toBeLessThanOrEqual(48);
    });
  });

  it('cannot be tapped while offline or busy', () => {
    const chosen = target({ disabled: true });
    const renderer = render(
      <Seat player={player()} isTurn={false} target={chosen} testID="seat" />,
    );
    expect(button(renderer, 'seat').props.accessibilityState).toEqual({
      disabled: true,
    });
    press(renderer, 'seat');
    expect(chosen.onPress).not.toHaveBeenCalled();
  });

  it('keeps a long name on one line', () => {
    const renderer = render(
      <Seat
        player={player({ name: 'Αλεξανδρόπουλος1' })}
        isTurn={false}
        compact
      />,
    );
    const name = renderer.root.find(
      node =>
        typeof node.type === 'string' &&
        node.props.children === 'Αλεξανδρόπουλος1',
    );
    expect(name.props.numberOfLines).toBe(1);
    expect(name.props.ellipsizeMode).toBe('tail');
  });
});
