import React from 'react';
import { Dimensions, TextInput } from 'react-native';
import { act } from 'react-test-renderer';
import {
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
      const content = render(<HomeScreen />).root.find(
        node =>
          typeof node.type !== 'string' && !!node.props.contentContainerStyle,
      ).props.contentContainerStyle;
      return content.flexDirection ?? 'column';
    };
    expect(direction(640, 360)).toBe('row');
    expect(direction(360, 640)).toBe('column');
  });
});
