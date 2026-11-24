import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { Backdrop } from '../Backdrop';
import { Button } from '../Button';
import { Panel } from '../Panel';
import { colors, glow, neon } from '../../theme';
import { Screen } from '../Screen';
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
    // The face is the one host view with rounded corners (the touch area has none).
    const view = renderer.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.style &&
        flat(node.props.style).borderRadius !== undefined,
    )[0];
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
    expect(label.color).toBe('#ffffff');
  });

  it('second button: black with a cyan outline', () => {
    const { style, label } = face(
      <Button label="Rules" variant="secondary" onPress={() => {}} />,
    );
    expect(style.backgroundColor).toBe(colors.background);
    expect(style.borderColor).toBe(colors.borderStrong);
    expect(label.color).toBe(neon.mist);
  });

  it('a disabled button does not glow', () => {
    const { style } = face(<Button label="Join" disabled onPress={() => {}} />);
    expect(style.boxShadow).toBe('none');
    expect(style.opacity).toBe(0.35);
  });
});
