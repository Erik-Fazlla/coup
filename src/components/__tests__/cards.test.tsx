import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { CHARACTER_INFO } from '../../engine/describe';
import { CARDS } from '../../engine/types';
import { CardBack } from '../CardBack';
import { CharacterCard } from '../CharacterCard';
import { Coins } from '../Coins';
import { MiniCard } from '../MiniCard';

function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

const text = (renderer: ReactTestRenderer) => JSON.stringify(renderer.toJSON());

const labelled = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll(node => node.props.accessibilityLabel === label);

describe('CharacterCard', () => {
  it('shows the name and ability of every character', () => {
    CARDS.forEach(card => {
      const renderer = render(<CharacterCard card={card} />);
      expect(text(renderer)).toContain(card);
      expect(text(renderer)).toContain(CHARACTER_INFO[card].ability);
      expect(
        labelled(renderer, `${card}: ${CHARACTER_INFO[card].ability}`).length,
      ).toBeGreaterThan(0);
    });
  });

  it('reads a lost card as "<name>, lost" and drops its ability', () => {
    const renderer = render(<CharacterCard card="Duke" lost />);
    expect(labelled(renderer, 'Duke, lost').length).toBeGreaterThan(0);
    expect(text(renderer)).toContain('LOST');
    expect(text(renderer)).not.toContain(CHARACTER_INFO.Duke.ability);
  });

  it('is not a button unless it can be pressed', () => {
    const renderer = render(<CharacterCard card="Duke" />);
    expect(
      renderer.root.findAll(node => node.props.accessibilityRole === 'button'),
    ).toHaveLength(0);
  });

  it('is a button that reports its selected and disabled state', () => {
    const onPress = jest.fn();
    const renderer = render(
      <CharacterCard card="Captain" selected disabled onPress={onPress} />,
    );
    const button = renderer.root.findAll(
      node => node.props.accessibilityRole === 'button',
    )[0];
    expect(button.props.onPress).toBe(onPress);
    expect(button.props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });
    expect(button.props.disabled).toBe(true);
  });

  it('hides the ability text when told there is no room for it', () => {
    const renderer = render(<CharacterCard card="Duke" abilityLines={0} />);
    const shown = renderer.root
      .findAllByType(Text)
      .map(node => node.props.children);
    expect(shown).toEqual(['Duke']);
  });
});

describe('MiniCard', () => {
  it('shows the two-letter code and reads the full name as lost', () => {
    const renderer = render(<MiniCard card="Contessa" />);
    expect(text(renderer)).toContain('Co');
    expect(labelled(renderer, 'Contessa, lost').length).toBeGreaterThan(0);
  });
});

describe('CardBack', () => {
  it('renders no text and no label at all', () => {
    const renderer = render(<CardBack />);
    expect(text(renderer)).not.toContain('accessibilityLabel');
    CARDS.forEach(card => expect(text(renderer)).not.toContain(card));
  });
});

describe('Coins', () => {
  it('shows the count and reads it with the right plural', () => {
    expect(
      labelled(render(<Coins count={1} />), '1 coin').length,
    ).toBeGreaterThan(0);
    const renderer = render(<Coins count={7} />);
    expect(text(renderer)).toContain('7');
    expect(labelled(renderer, '7 coins').length).toBeGreaterThan(0);
  });
});
