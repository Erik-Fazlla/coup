import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ActionTile } from '../ActionTile';
import { Backdrop } from '../Backdrop';
import { CardBack } from '../CardBack';
import { Button } from '../Button';
import { CardShade } from '../CardShade';
import { CharacterCard } from '../CharacterCard';
import { Panel } from '../Panel';
import {
  characterColors,
  colors,
  glow,
  neon,
  neutralPalette,
} from '../../theme';
import { Screen } from '../Screen';
import { Sheet } from '../Sheet';
import { render } from '../testUtils';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const flat = (style: unknown) => StyleSheet.flatten(style as never) ?? {};
/**
 * The native view carrying `testID`. A component and the view it renders both carry the
 * prop, so `findByProps` would find two; the host one (string type) is what is drawn.
 */
const host = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node => node.props.testID === id && typeof node.type === 'string',
  );
const hostCount = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(
    node => node.props.testID === id && typeof node.type === 'string',
  ).length;

describe('Screen backdrop', () => {
  it('draws the cyan haze behind the content, never in front of it', () => {
    const renderer = render(
      <Screen>
        <Text>content</Text>
      </Screen>,
    );
    const backdrop = host(renderer, 'backdrop');
    expect(flat(backdrop.props.style).position).toBe('absolute');
    expect(backdrop.props.pointerEvents).toBe('none');
    expect(backdrop.props.importantForAccessibility).toBe(
      'no-hide-descendants',
    );
    expect(backdrop.findAllByType(Image)).toHaveLength(1);
    // The backdrop is the screen's first child, so everything else is drawn over it.
    expect(
      (host(renderer, 'screen').children[0] as ReactTestInstance).type,
    ).toBe(Backdrop);
  });
});

describe('Panel', () => {
  const panelStyle = (element: React.ReactElement) =>
    flat(host(render(element), 'panel').props.style);

  it('is a quiet see-through surface with a soft glow', () => {
    const style = panelStyle(
      <Panel testID="panel">
        <Text>x</Text>
      </Panel>,
    );
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderColor).toBe(colors.border);
    expect(style.boxShadow).toBe(glow.soft);
  });

  it('lights up fully for "you / your turn"', () => {
    const style = panelStyle(
      <Panel testID="panel" highlight>
        <Text>x</Text>
      </Panel>,
    );
    expect(style.borderColor).toBe(colors.primary);
    expect(style.boxShadow).toBe(glow.cyan);
  });
});

describe('Button', () => {
  const face = (element: React.ReactElement) => {
    const renderer = render(element);
    const view = host(renderer, 'button-face');
    const label = renderer.root.findByType(Text);
    return { style: flat(view.props.style), label: flat(label.props.style) };
  };

  it('main button: electric blue, cyan edge, blue glow, white label', () => {
    const { style, label } = face(
      <Button label="Create Game" onPress={() => {}} />,
    );
    expect(style.backgroundColor).toBe(neon.blue);
    expect(style.borderColor).toBe(neon.cyan);
    expect(style.boxShadow).toBe(glow.blue);
    expect(label.color).toBe(colors.text);
  });

  it('second button: black with a cyan outline', () => {
    const { style, label } = face(
      <Button label="Rules" variant="secondary" onPress={() => {}} />,
    );
    expect(style.backgroundColor).toBe(colors.background);
    expect(style.borderColor).toBe(colors.borderStrong);
    expect(label.color).toBe(neon.mist);
  });

  it('pressed: primary and secondary glow cyan, danger glows red', () => {
    // Pressable hands its children the pressed state; ask for the pressed face directly.
    const pressedStyle = (variant: 'primary' | 'secondary' | 'danger') => {
      const renderer = render(
        <Button label="Go" variant={variant} onPress={() => {}} />,
      );
      const children = renderer.root.find(
        node => typeof node.props.children === 'function',
      ).props.children;
      return flat(children({ pressed: true }).props.style);
    };
    expect(pressedStyle('danger').boxShadow).toBe(glow.danger);
    expect(pressedStyle('primary').boxShadow).toBe(glow.cyan);
    expect(pressedStyle('secondary').boxShadow).toBe(glow.cyan);
  });

  it('a disabled button does not glow', () => {
    const { style } = face(<Button label="Join" disabled onPress={() => {}} />);
    expect(style.boxShadow).toBe('none');
    expect(style.opacity).toBe(0.35);
  });
});

describe('CharacterCard', () => {
  const cardStyle = (element: React.ReactElement) => {
    const renderer = render(element);
    return { renderer, style: flat(host(renderer, 'card').props.style) };
  };

  it('keeps the character colour inside a glowing cyan frame, with shading', () => {
    const { renderer, style } = cardStyle(
      <CharacterCard card="Duke" testID="card" />,
    );
    expect(style.backgroundColor).toBe(characterColors.Duke.fill);
    expect(style.borderColor).toBe(neon.cyan);
    expect(style.borderWidth).toBe(1.5);
    expect(style.boxShadow).toBe(glow.cyan);
    expect(hostCount(renderer, 'card-shade')).toBe(1);
  });

  it('marks a selected card with a white frame', () => {
    const { style } = cardStyle(
      <CharacterCard card="Duke" selected testID="card" />,
    );
    expect(style.borderColor).toBe(colors.text);
    expect(style.boxShadow).toBe(glow.white);
  });

  it('a lost card loses its colour and its glow', () => {
    const { renderer, style } = cardStyle(
      <CharacterCard card="Duke" lost testID="card" />,
    );
    expect(style.backgroundColor).toBe(colors.background);
    expect(style.borderColor).toBe(colors.faint);
    expect(style.boxShadow).toBe('none');
    expect(hostCount(renderer, 'card-shade')).toBe(0);
  });
});

describe('CardBack', () => {
  it('is a black card in a cyan frame with a hat, and says nothing about the card', () => {
    const renderer = render(<CardBack />);
    const style = flat(host(renderer, 'card-back').props.style);
    expect(style.backgroundColor).toBe(colors.background);
    expect(style.borderColor).toBe(neon.cyan);
    expect(style.boxShadow).toBe(glow.cardBack);
    expect(hostCount(renderer, 'card-back-hat')).toBe(1);
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  });
});

describe('ActionTile', () => {
  const tile = (selected: boolean) => {
    const renderer = render(
      <ActionTile
        label="Income"
        detail="+1"
        accessibilityLabel="Income"
        palette={neutralPalette}
        selected={selected}
        onPress={() => {}}
      />,
    );
    const face = host(renderer, 'tile-face');
    return { renderer, style: flat(face.props.style) };
  };

  it('has a cyan edge and the colour shading', () => {
    const { renderer, style } = tile(false);
    expect(style.borderColor).toBe(colors.edge);
    expect(hostCount(renderer, 'card-shade')).toBe(1);
  });

  it('glows when it is the chosen action', () => {
    const { style } = tile(true);
    expect(style.borderColor).toBe(colors.primary);
    expect(style.boxShadow).toBe(glow.cyan);
  });
});

describe('CardShade', () => {
  it('stretches the shading image over the whole card, not its intrinsic width', () => {
    const renderer = render(<CardShade />);
    const shade = host(renderer, 'card-shade');
    expect(shade.props.pointerEvents).toBe('none');
    expect(shade.props.importantForAccessibility).toBe('no-hide-descendants');
    const style = flat(renderer.root.findByType(Image).props.style);
    expect(style.width).toBe('100%');
    expect(style.height).toBe('100%');
    expect(style.position).toBe('absolute');
  });
});

describe('Sheet', () => {
  it('has a quiet glow and a theme-token fill; cyan is kept for "you / tap here"', () => {
    const renderer = render(
      <Sheet title="Rules" onClose={() => {}} testID="sheet">
        <Text>x</Text>
      </Sheet>,
    );
    const sheet = renderer.root.find(
      node =>
        typeof node.type === 'string' &&
        flat(node.props.style).maxWidth === 560,
    );
    const style = flat(sheet.props.style);
    expect(style.boxShadow).toBe(glow.soft);
    expect(style.backgroundColor).toBe(colors.sheet);
  });
});
