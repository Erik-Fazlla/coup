import React from 'react';
import { BackHandler, Switch, TextInput } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { SettingsSheet } from '../SettingsSheet';
import { render, rendered } from '../testUtils';

const mockSetName = jest.fn();
const mockUpdate = jest.fn();
const mockProfile = { name: 'Erik', gamesPlayed: 4, wins: 3, createdAt: 0 };
let mockSettings = { vibration: true, sound: true };

jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setName: mockSetName }),
}));
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ settings: mockSettings, update: mockUpdate }),
}));

const open = (onClose = jest.fn()) =>
  render(<SettingsSheet visible onClose={onClose} />);

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
  mockSettings = { vibration: true, sound: true };
});

describe('SettingsSheet', () => {
  it('renders nothing while closed', () => {
    const renderer = render(
      <SettingsSheet visible={false} onClose={jest.fn()} />,
    );
    expect(renderer.toJSON()).toBeNull();
  });

  it('closes with its button and with the hardware back key', () => {
    let back: (() => unknown) | undefined;
    const listen = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        back = handler as unknown as () => unknown;
        return { remove: jest.fn() };
      });
    const onClose = jest.fn();
    const renderer = open(onClose);
    act(() => {
      renderer.root.findByProps({ label: 'Close' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(back?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    listen.mockRestore();
  });
});

describe('SettingsSheet vibration', () => {
  const vibration = (renderer: ReactTestRenderer) =>
    renderer.root
      .findAllByType(Switch)
      .find(node => node.props.testID === 'setting-vibration')!;

  it('shows the current setting with a label a screen reader can read', () => {
    const renderer = open();
    expect(vibration(renderer).props.value).toBe(true);
    expect(vibration(renderer).props.accessibilityLabel).toBe('Vibration');
  });

  it('shows it off when it is off', () => {
    mockSettings = { vibration: false, sound: true };
    expect(vibration(open()).props.value).toBe(false);
  });

  it('saves a change through the settings context, touching nothing else', () => {
    const renderer = open();
    act(() => {
      vibration(renderer).props.onValueChange(false);
    });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ vibration: false });
  });

  it('has no sound switch yet', () => {
    const renderer = open();
    expect(renderer.root.findAllByType(Switch)).toHaveLength(1);
    expect(rendered(renderer)).not.toContain('Sound');
  });
});

describe('SettingsSheet name', () => {
  it('shows the name with a way to change it, and no name field until asked', () => {
    const renderer = open();
    expect(rendered(renderer)).toContain('Erik');
    expect(hasButton(renderer, 'Change name')).toBe(true);
    expect(nameField(renderer)).toBeUndefined();
  });

  it('opens a field pre-filled with the current name', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    expect(nameField(renderer)!.props.value).toBe('Erik');
    expect(hasButton(renderer, 'Save')).toBe(true);
    expect(hasButton(renderer, 'Cancel')).toBe(true);
  });

  it('saves the trimmed new name and closes the field', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    typeName(renderer, '  Maria  ');
    await pressButton(renderer, 'Save');
    expect(mockSetName).toHaveBeenCalledWith('Maria');
    expect(nameField(renderer)).toBeUndefined();
  });

  it('does not allow an empty name', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    typeName(renderer, '   ');
    expect(
      renderer.root.findAllByProps({ label: 'Save' })[0].props.disabled,
    ).toBe(true);
    await pressButton(renderer, 'Save');
    expect(mockSetName).not.toHaveBeenCalled();
  });

  it('closes without saving when the name was not changed', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    await pressButton(renderer, 'Save');
    expect(mockSetName).not.toHaveBeenCalled();
    expect(nameField(renderer)).toBeUndefined();
  });

  it('cancels without saving', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    typeName(renderer, 'Maria');
    await pressButton(renderer, 'Cancel');
    expect(mockSetName).not.toHaveBeenCalled();
    expect(nameField(renderer)).toBeUndefined();
    expect(rendered(renderer)).toContain('Erik');
  });

  it('keeps the field open and explains when saving fails', async () => {
    mockSetName.mockRejectedValue(new Error('storage broken'));
    const renderer = open();
    await pressButton(renderer, 'Change name');
    typeName(renderer, 'Maria');
    await pressButton(renderer, 'Save');
    expect(nameField(renderer)!.props.value).toBe('Maria');
    expect(rendered(renderer)).toContain('Could not save your name');
  });

  it('limits the name to 16 characters', async () => {
    const renderer = open();
    await pressButton(renderer, 'Change name');
    expect(nameField(renderer)!.props.maxLength).toBe(16);
  });
});
