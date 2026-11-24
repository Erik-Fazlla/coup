import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { ReactTestRenderer } from 'react-test-renderer';
import { Backdrop } from '../Backdrop';
import { Panel } from '../Panel';
import { colors, glow } from '../../theme';
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
  renderer.root.find(node => node.props.testID === id && typeof node.type === 'string');

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
    expect(host(renderer, 'screen').children[0].type).toBe(Backdrop);
  });
});

describe('Panel', () => {
  const panelStyle = (element: React.ReactElement) =>
    flat(host(render(element), 'panel').props.style);

  it('is a quiet see-through surface with a soft glow', () => {
    const style = panelStyle(<Panel testID="panel"><Text>x</Text></Panel>);
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderColor).toBe(colors.border);
    expect(style.boxShadow).toBe(glow.soft);
  });

  it('lights up fully for "you / your turn"', () => {
    const style = panelStyle(
      <Panel testID="panel" highlight><Text>x</Text></Panel>,
    );
    expect(style.borderColor).toBe(colors.primary);
    expect(style.boxShadow).toBe(glow.cyan);
  });
});
