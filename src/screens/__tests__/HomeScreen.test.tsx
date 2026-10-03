import React from 'react';
import { Dimensions, StyleSheet, TextInput } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import {
  fakeKeyboard,
  findButton,
  press,
  render,
  rendered,
  texts,
} from '../../components/testUtils';
import { HomeScreen } from '../HomeScreen';

const mockSetName = jest.fn();
const mockUpdate = jest.fn();
const mockCreateGame = jest.fn();
const mockJoinGame = jest.fn();
const mockProfile = { name: 'Erik', gamesPlayed: 4, wins: 3, createdAt: 0 };

jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setName: mockSetName }),
}));
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { vibration: true, sound: true },
    update: mockUpdate,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../context/GameContext', () => ({
  useGame: () => ({
    connected: true,
    busy: false,
    error: null,
    createGame: mockCreateGame,
    joinGame: mockJoinGame,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The style of what scrolls on Home: the two panels. */
const content = (renderer: ReactTestRenderer) =>
  StyleSheet.flatten(
    renderer.root.find(
      node =>
        typeof node.type !== 'string' && !!node.props.contentContainerStyle,
    ).props.contentContainerStyle,
  );

describe('HomeScreen', () => {
  it('shows the player name and stats, with no name field of its own', () => {
    const renderer = render(<HomeScreen />);
    expect(texts(renderer)).toContain('Erik');
    expect(rendered(renderer)).toContain('Games played: 4');
    expect(rendered(renderer)).toContain('Win rate: 75%');
    expect(findButton(renderer, 'open-settings')).toBeDefined();
    expect(findButton(renderer, 'open-rules')).toBeDefined();
    expect(renderer.root.findAllByProps({ label: 'Change name' })).toHaveLength(
      0,
    );
    expect(
      renderer.root
        .findAllByType(TextInput)
        .map(input => input.props.accessibilityLabel),
    ).toEqual(['Join code']);
  });

  it('opens Settings, where the name can be changed and vibration switched', () => {
    const renderer = render(<HomeScreen />);
    expect(rendered(renderer)).not.toContain('settings-sheet');
    press(renderer, 'open-settings');
    expect(rendered(renderer)).toContain('settings-sheet');
    expect(
      renderer.root.findAllByProps({ label: 'Change name' }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'setting-vibration' }).length,
    ).toBeGreaterThan(0);

    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(rendered(renderer)).not.toContain('settings-sheet');
  });

  it('opens the rules', () => {
    const renderer = render(<HomeScreen />);
    press(renderer, 'open-rules');
    expect(rendered(renderer)).toContain('rules-sheet');
    expect(texts(renderer)).toContain('Foreign Aid');
    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(rendered(renderer)).not.toContain('rules-sheet');
  });

  it('creates a game, and joins one once the code is complete', () => {
    const renderer = render(<HomeScreen />);
    act(() => {
      renderer.root.findByProps({ label: 'Create Game' }).props.onPress();
    });
    expect(mockCreateGame).toHaveBeenCalledTimes(1);

    const join = () => renderer.root.findByProps({ label: 'Join' });
    expect(join().props.disabled).toBe(true);
    act(() => {
      renderer.root.findByType(TextInput).props.onChangeText('mr93w');
    });
    expect(join().props.disabled).toBe(false);
    act(() => {
      join().props.onPress();
    });
    expect(mockJoinGame).toHaveBeenCalledWith('MR93W');
  });

  it('puts the two panels side by side in landscape and stacks them in portrait', () => {
    const direction = (width: number, height: number) => {
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ width, height, scale: 1, fontScale: 1 });
      return content(render(<HomeScreen />)).flexDirection ?? 'column';
    };
    expect(direction(640, 360)).toBe('row');
    expect(direction(360, 640)).toBe('column');
  });

  it('keeps the code field in the app, not in the keyboard’s own full-screen editor', () => {
    const input = render(<HomeScreen />).root.findByType(TextInput);
    expect(input.props.disableFullscreenUI).toBe(true);
    expect(input.props.underlineColorAndroid).toBe('transparent');
  });

  it('leaves room under the panels for the keyboard while it is up', () => {
    const keyboard = fakeKeyboard();
    try {
      const renderer = render(<HomeScreen />);
      expect(content(renderer).paddingBottom).toBe(0);
      keyboard.show(264);
      expect(content(renderer).paddingBottom).toBe(264);
      // Still the same layout, only with space to scroll into.
      expect(content(renderer).flexGrow).toBe(1);
      keyboard.hide();
      expect(content(renderer).paddingBottom).toBe(0);
    } finally {
      keyboard.restore();
    }
  });
});
