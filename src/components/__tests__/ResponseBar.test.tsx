import React from 'react';
import { ScrollView } from 'react-native';
import { makeGame, play } from '../../engine/testHelpers';
import { Game, GameAction } from '../../engine/types';
import { ResponseBar } from '../ResponseBar';
import {
  button,
  findButton,
  isEnabled,
  press,
  render as renderElement,
  texts,
} from '../testUtils';

const TILES = [
  'response-pass',
  'response-challenge',
  'response-block-Duke',
  'response-block-Contessa',
  'response-block-Captain',
  'response-block-Ambassador',
];

function render(game: Game, playerId: string, disabled = false) {
  const onAction = jest.fn<void, [GameAction]>();
  const renderer = renderElement(
    <ResponseBar
      game={game}
      playerId={playerId}
      disabled={disabled}
      onAction={onAction}
    />,
  );
  const tiles = () => TILES.filter(id => findButton(renderer, id));
  return { renderer, onAction, tiles };
}

const three = (coins: Record<string, number> = {}) =>
  makeGame(
    {
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
      c: ['Ambassador', 'Duke'],
    },
    { coins },
  );

describe('ResponseBar', () => {
  it('renders nothing for a player who is not being asked', () => {
    expect(render(three(), 'b').renderer.toJSON()).toBeNull();
    const taxed = play(three(), { type: 'tax', playerId: 'a' });
    expect(render(taxed, 'a').renderer.toJSON()).toBeNull();
    const passed = play(taxed, { type: 'pass', playerId: 'b' });
    expect(render(passed, 'b').renderer.toJSON()).toBeNull();
  });

  it('offers Pass and Challenge against a claimed action that cannot be blocked', () => {
    const game = play(three(), { type: 'tax', playerId: 'a' });
    const { renderer, tiles } = render(game, 'b');
    expect(tiles()).toEqual(['response-pass', 'response-challenge']);
    expect(
      button(renderer, 'response-challenge').props.accessibilityLabel,
    ).toBe('Challenge, doubt the Duke claim');
  });

  it('keeps the line under Challenge short enough for four tiles on a small phone', () => {
    const stolen = play(three(), { type: 'steal', playerId: 'a', target: 'b' });
    const { renderer, tiles } = render(stolen, 'b');
    expect(tiles()).toHaveLength(4);
    const shown = texts(renderer);
    expect(shown).toContain('Doubt Captain');
    expect(shown).not.toContain('Doubt the Captain');
    // The longest character name still reads in full to a screen reader.
    expect(
      button(renderer, 'response-challenge').props.accessibilityLabel,
    ).toBe('Challenge, doubt the Captain claim');
  });

  it('offers Pass and Block as Duke, but no Challenge, against Foreign Aid', () => {
    const game = play(three(), { type: 'foreignAid', playerId: 'a' });
    expect(render(game, 'c').tiles()).toEqual([
      'response-pass',
      'response-block-Duke',
    ]);
  });

  it('offers both block claims to the target of a Steal and none to a bystander', () => {
    const game = play(three(), { type: 'steal', playerId: 'a', target: 'b' });
    expect(render(game, 'b').tiles()).toEqual([
      'response-pass',
      'response-challenge',
      'response-block-Captain',
      'response-block-Ambassador',
    ]);
    expect(render(game, 'c').tiles()).toEqual([
      'response-pass',
      'response-challenge',
    ]);
  });

  it('offers Block as Contessa to the target of an Assassination', () => {
    const game = play(three({ a: 3 }), {
      type: 'assassinate',
      playerId: 'a',
      target: 'b',
    });
    const { renderer, tiles } = render(game, 'b');
    expect(tiles()).toContain('response-block-Contessa');
    expect(
      button(renderer, 'response-block-Contessa').props.accessibilityLabel,
    ).toBe('Block as Contessa, claims Contessa');
  });

  it('offers only Pass and Challenge against a block, naming the blocker claim', () => {
    const game = play(
      three(),
      { type: 'foreignAid', playerId: 'a' },
      { type: 'block', playerId: 'b', claim: 'Duke' },
    );
    const { renderer, tiles } = render(game, 'a');
    expect(tiles()).toEqual(['response-pass', 'response-challenge']);
    expect(
      button(renderer, 'response-challenge').props.accessibilityLabel,
    ).toBe('Challenge, doubt the Duke claim');
  });

  it('sends each response with the claim sequence of the prompt on screen', () => {
    const game = play(three(), { type: 'steal', playerId: 'a', target: 'b' });
    game.state.claimSeq = 41;
    const { renderer, onAction } = render(game, 'b');
    press(renderer, 'response-pass');
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'pass',
      playerId: 'b',
      seq: 41,
    });
    press(renderer, 'response-challenge');
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'challenge',
      playerId: 'b',
      seq: 41,
    });
    press(renderer, 'response-block-Ambassador');
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'block',
      playerId: 'b',
      claim: 'Ambassador',
      seq: 41,
    });
    expect(onAction).toHaveBeenCalledTimes(3);
  });

  it('disables every tile while offline or busy', () => {
    const game = play(three(), { type: 'steal', playerId: 'a', target: 'b' });
    const { renderer, onAction, tiles } = render(game, 'b', true);
    tiles().forEach(id => expect(isEnabled(renderer, id)).toBe(false));
    press(renderer, 'response-pass');
    expect(onAction).not.toHaveBeenCalled();
  });

  it('never scrolls', () => {
    const game = play(three(), { type: 'steal', playerId: 'a', target: 'b' });
    expect(
      render(game, 'b').renderer.root.findAllByType(ScrollView),
    ).toHaveLength(0);
  });
});
