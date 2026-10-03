import React from 'react';
import { ScrollView } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { makeGame } from '../../engine/testHelpers';
import { Game, GameAction } from '../../engine/types';
import { ActionBar } from '../ActionBar';

function render(game: Game, playerId = 'me') {
  const onAction = jest.fn<void, [GameAction]>();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <ActionBar
        game={game}
        playerId={playerId}
        disabled={false}
        onAction={onAction}
      />,
    );
  });
  const labels = () =>
    renderer.root
      .findAll(
        node =>
          typeof node.props.label === 'string' && typeof node.type !== 'string',
      )
      .map(node => node.props.label as string);
  const press = (label: string) =>
    act(() => {
      renderer.root.findByProps({ label }).props.onPress();
    });
  return { renderer, onAction, labels, press };
}

const rich = () =>
  makeGame(
    { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
    { coins: { me: 8, other: 2 } },
  );

describe('ActionBar', () => {
  it('shows nothing when it is not this player turn', () => {
    const { renderer } = render(rich(), 'other');
    expect(renderer.toJSON()).toBeNull();
  });

  it('sends an untargeted action straight away', () => {
    const { onAction, press } = render(rich());
    press('Income +1');
    expect(onAction).toHaveBeenCalledWith({ type: 'income', playerId: 'me' });
  });

  it('asks for a target, with a way back shown first', () => {
    const { labels, press, onAction } = render(rich());
    press('Steal 2 (Captain)');
    expect(labels()).toEqual(['Back', 'OTHER']);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('starts the target row from its beginning instead of reusing the scrolled action row', () => {
    const { renderer, press } = render(rich());
    const actionRow = renderer.root.findByType(ScrollView).instance;
    press('Steal 2 (Captain)');
    // A reused ScrollView keeps its scroll offset, which pushes the few target
    // buttons out of view when the player had scrolled right to reach "Steal".
    expect(renderer.root.findByType(ScrollView).instance).not.toBe(actionRow);
  });

  it('sends the targeted action once a target is chosen and returns to the action list', () => {
    const { labels, press, onAction } = render(rich());
    press('Steal 2 (Captain)');
    press('OTHER');
    expect(onAction).toHaveBeenCalledWith({
      type: 'steal',
      playerId: 'me',
      target: 'other',
    });
    expect(labels()).toContain('Income +1');
  });

  it('lets the player steal from someone with fewer than two coins', () => {
    const game = makeGame(
      { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
      { coins: { me: 2, other: 0 } },
    );
    const { press, onAction } = render(game);
    press('Steal 2 (Captain)');
    press('OTHER');
    expect(onAction).toHaveBeenCalledWith({
      type: 'steal',
      playerId: 'me',
      target: 'other',
    });
  });

  it('goes back to the action list without acting', () => {
    const { labels, press, onAction } = render(rich());
    press('Coup −7');
    press('Back');
    expect(onAction).not.toHaveBeenCalled();
    expect(labels()).toContain('Steal 2 (Captain)');
    expect(labels()).not.toContain('Back');
  });

  it('only lists living opponents as targets', () => {
    const game = makeGame(
      {
        me: ['Duke', 'Captain'],
        other: ['Contessa', 'Assassin'],
        gone: ['Duke', 'Duke'],
      },
      { coins: { me: 8 } },
    );
    game.players.gone.influence.forEach(i => (i.revealed = true));
    const { labels, press } = render(game);
    press('Coup −7');
    expect(labels()).toEqual(['Back', 'OTHER']);
  });

  it('offers only Coup at 10 or more coins', () => {
    const game = makeGame(
      { me: ['Duke', 'Captain'], other: ['Contessa', 'Assassin'] },
      { coins: { me: 10 } },
    );
    expect(render(game).labels()).toEqual(['Coup −7']);
  });
});
