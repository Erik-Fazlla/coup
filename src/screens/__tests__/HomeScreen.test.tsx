import React from 'react';
import { TextInput } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { render, rendered } from '../../components/testUtils';
import { HomeScreen } from '../HomeScreen';

const mockSetName = jest.fn();
const mockProfile = { name: 'Erik', gamesPlayed: 4, wins: 3, createdAt: 0 };

jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setName: mockSetName }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('../../context/GameContext', () => ({
  useGame: () => ({
    connected: true,
    busy: false,
    error: null,
    createGame: jest.fn(),
    joinGame: jest.fn(),
  }),
}));

function hasButton(renderer: ReactTestRenderer, label: string): boolean {
  return renderer.root.findAllByProps({ label }).length > 0;
}

function pressButton(renderer: ReactTestRenderer, label: string) {
  const target = renderer.root.findAllByProps({ label })[0];
  return act(async () => {
    if (!target.props.disabled) {
      await target.props.onPress();
    }
  });
}

function nameField(renderer: ReactTestRenderer) {
  return renderer.root
    .findAllByType(TextInput)
    .find(input => input.props.accessibilityLabel === 'Player name');
}

function typeName(renderer: ReactTestRenderer, text: string) {
  act(() => {
    nameField(renderer)!.props.onChangeText(text);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetName.mockResolvedValue(undefined);
});

describe('HomeScreen name', () => {
  it('shows the name with a way to change it, and no name field until asked', () => {
    const renderer = render(<HomeScreen />);
    expect(rendered(renderer)).toContain('Erik');
    expect(hasButton(renderer, 'Change name')).toBe(true);
    expect(nameField(renderer)).toBeUndefined();
  });

  it('opens a field pre-filled with the current name', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    expect(nameField(renderer)!.props.value).toBe('Erik');
    expect(hasButton(renderer, 'Save')).toBe(true);
    expect(hasButton(renderer, 'Cancel')).toBe(true);
  });

  it('saves the trimmed new name and closes the field', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    typeName(renderer, '  Maria  ');
    await pressButton(renderer, 'Save');
    expect(mockSetName).toHaveBeenCalledWith('Maria');
    expect(nameField(renderer)).toBeUndefined();
  });

  it('does not allow an empty name', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    typeName(renderer, '   ');
    expect(
      renderer.root.findAllByProps({ label: 'Save' })[0].props.disabled,
    ).toBe(true);
    await pressButton(renderer, 'Save');
    expect(mockSetName).not.toHaveBeenCalled();
  });

  it('closes without saving when the name was not changed', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    await pressButton(renderer, 'Save');
    expect(mockSetName).not.toHaveBeenCalled();
    expect(nameField(renderer)).toBeUndefined();
  });

  it('cancels without saving', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    typeName(renderer, 'Maria');
    await pressButton(renderer, 'Cancel');
    expect(mockSetName).not.toHaveBeenCalled();
    expect(nameField(renderer)).toBeUndefined();
    expect(rendered(renderer)).toContain('Erik');
  });

  it('keeps the field open and explains when saving fails', async () => {
    mockSetName.mockRejectedValue(new Error('storage broken'));
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    typeName(renderer, 'Maria');
    await pressButton(renderer, 'Save');
    expect(nameField(renderer)!.props.value).toBe('Maria');
    expect(rendered(renderer)).toContain('Could not save your name');
  });

  it('limits the name to 16 characters', async () => {
    const renderer = render(<HomeScreen />);
    await pressButton(renderer, 'Change name');
    expect(nameField(renderer)!.props.maxLength).toBe(16);
  });
});
