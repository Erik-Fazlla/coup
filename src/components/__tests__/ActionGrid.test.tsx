import React from 'react';
import { ScrollView } from 'react-native';
import { ACTION_COST } from '../../engine/rules';
import { makeGame, play } from '../../engine/testHelpers';
import {
  ActionType,
  Game,
  GameAction,
  TargetedAction,
} from '../../engine/types';
import { ActionGrid } from '../ActionGrid';
import {
  button,
  findButton,
  isEnabled,
  press,
  render as renderElement,
} from '../testUtils';

const ALL_ACTIONS = Object.keys(ACTION_COST) as ActionType[];

function render(
  game: Game,
  options: {
    playerId?: string;
    targeting?: TargetedAction | null;
    disabled?: boolean;
  } = {},
) {
  const onAction = jest.fn<void, [GameAction]>();
  const onTargeting = jest.fn<void, [TargetedAction | null]>();
  const renderer = renderElement(
    <ActionGrid
      game={game}
      playerId={options.playerId ?? 'me'}
      disabled={options.disabled ?? false}
      targeting={options.targeting ?? null}
      onAction={onAction}
      onTargeting={onTargeting}
    />,
  );
  const enabled = () =>
    ALL_ACTIONS.filter(action => isEnabled(renderer, `action-${action}`));
  return { renderer, onAction, onTargeting, enabled };
}

const withCoins = (coins: number) =>
  makeGame(
    { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
    { coins: { me: coins, other: 2 } },
  );

describe('ActionGrid', () => {
  it('always shows all seven actions, whatever the state of the game', () => {
    const waiting = play(withCoins(2), { type: 'tax', playerId: 'me' });
    [
      render(withCoins(8)),
      render(withCoins(0)),
      render(withCoins(10)),
      render(withCoins(8), { playerId: 'other' }),
      render(withCoins(8), { targeting: 'steal' }),
      render(withCoins(8), { disabled: true }),
      render(waiting),
    ].forEach(({ renderer }) => {
      ALL_ACTIONS.forEach(action => {
        expect(findButton(renderer, `action-${action}`)).toBeDefined();
      });
    });
  });

  it('never scrolls', () => {
    const { renderer } = render(withCoins(8));
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('sends an untargeted action straight away', () => {
    const { renderer, onAction, onTargeting } = render(withCoins(8));
    press(renderer, 'action-income');
    expect(onAction).toHaveBeenCalledWith({ type: 'income', playerId: 'me' });
    expect(onTargeting).not.toHaveBeenCalled();
  });

  it('asks for a target instead of sending a targeted action', () => {
    const { renderer, onAction, onTargeting } = render(withCoins(8));
    (['steal', 'assassinate', 'coup'] as const).forEach(action => {
      press(renderer, `action-${action}`);
      expect(onTargeting).toHaveBeenLastCalledWith(action);
    });
    expect(onAction).not.toHaveBeenCalled();
  });

  it('shows no Back tile until a target is being chosen', () => {
    const { renderer } = render(withCoins(8));
    expect(findButton(renderer, 'action-back')).toBeUndefined();
  });

  it('marks the action being aimed and offers Back, which cancels without sending', () => {
    const { renderer, onAction, onTargeting } = render(withCoins(8), {
      targeting: 'steal',
    });
    expect(
      button(renderer, 'action-steal').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      button(renderer, 'action-coup').props.accessibilityState.selected,
    ).toBe(false);
    press(renderer, 'action-back');
    expect(onTargeting).toHaveBeenCalledWith(null);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('disables what the player cannot afford and says why', () => {
    const { renderer, enabled, onTargeting } = render(withCoins(2));
    expect(enabled()).toEqual([
      'income',
      'foreignAid',
      'tax',
      'steal',
      'exchange',
    ]);
    expect(
      button(renderer, 'action-assassinate').props.accessibilityLabel,
    ).toBe(
      'Assassinate, costs 3 coins, a player loses a card, claims Assassin. Unavailable: needs 3 coins',
    );
    expect(button(renderer, 'action-coup').props.accessibilityLabel).toContain(
      'Unavailable: needs 7 coins',
    );
    press(renderer, 'action-coup');
    expect(onTargeting).not.toHaveBeenCalled();
  });

  it('lets the player steal whatever the coins on the table', () => {
    const game = makeGame(
      { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
      { coins: { me: 0, other: 0 } },
    );
    const { renderer, onTargeting } = render(game);
    press(renderer, 'action-steal');
    expect(onTargeting).toHaveBeenCalledWith('steal');
  });

  it('enables only Coup at 10 or more coins and says why', () => {
    const { renderer, enabled } = render(withCoins(10));
    expect(enabled()).toEqual(['coup']);
    expect(button(renderer, 'action-income').props.accessibilityLabel).toBe(
      'Income, take 1 coin, no claim. Unavailable: you must Coup with 10 or more coins',
    );
  });

  it('enables nothing when it is not this player turn', () => {
    const { renderer, enabled, onAction } = render(withCoins(8), {
      playerId: 'other',
    });
    expect(enabled()).toEqual([]);
    expect(
      button(renderer, 'action-income').props.accessibilityLabel,
    ).toContain('Unavailable: not your turn');
    press(renderer, 'action-income');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('enables nothing while the player waits for responses to their own action', () => {
    const waiting = play(withCoins(2), { type: 'tax', playerId: 'me' });
    expect(render(waiting).enabled()).toEqual([]);
  });

  it('enables nothing while offline or busy', () => {
    const { renderer, enabled } = render(withCoins(8), { disabled: true });
    expect(enabled()).toEqual([]);
    expect(
      button(renderer, 'action-income').props.accessibilityLabel,
    ).toContain('Unavailable: waiting for the server');
  });

  it('names the cost and the claimed character in every label', () => {
    const { renderer } = render(withCoins(8));
    const label = (action: ActionType) =>
      button(renderer, `action-${action}`).props.accessibilityLabel as string;
    expect(label('tax')).toBe('Tax, take 3 coins, claims Duke');
    expect(label('steal')).toBe(
      'Steal, take 2 coins from a player, claims Captain',
    );
    expect(label('exchange')).toBe(
      'Exchange, swap cards with the deck, claims Ambassador',
    );
    expect(label('coup')).toBe(
      'Coup, costs 7 coins, a player loses a card, no claim',
    );
    expect(label('foreignAid')).toBe('Foreign Aid, take 2 coins, no claim');
  });
});
