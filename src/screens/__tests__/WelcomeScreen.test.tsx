import React from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { fakeKeyboard, render, texts } from '../../components/testUtils';
import { WelcomeScreen } from '../WelcomeScreen';

const mockSetName = jest.fn();
let mockStartupError: string | null = null;

jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ setName: mockSetName, startupError: mockStartupError }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

let keyboard: ReturnType<typeof fakeKeyboard>;

const field = (renderer: ReactTestRenderer) =>
  renderer.root.findByType(TextInput);
const content = (renderer: ReactTestRenderer) =>
  StyleSheet.flatten(
    renderer.root.findByType(ScrollView).props.contentContainerStyle,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSetName.mockResolvedValue(undefined);
  mockStartupError = null;
  keyboard = fakeKeyboard();
});

afterEach(() => {
  keyboard.restore();
});

describe('WelcomeScreen', () => {
  it('saves the trimmed name', async () => {
    const renderer = render(<WelcomeScreen />);
    act(() => {
      field(renderer).props.onChangeText('  Erik ');
    });
    await act(async () => {
      await renderer.root.findByProps({ label: 'Continue' }).props.onPress();
    });
    expect(mockSetName).toHaveBeenCalledWith('Erik');
  });

  it('does not continue without a name, and says why saving failed', async () => {
    const renderer = render(<WelcomeScreen />);
    expect(
      renderer.root.findByProps({ label: 'Continue' }).props.disabled,
    ).toBe(true);
    mockSetName.mockRejectedValue(new Error('storage broken'));
    act(() => {
      field(renderer).props.onChangeText('Erik');
    });
    await act(async () => {
      await renderer.root.findByProps({ label: 'Continue' }).props.onPress();
    });
    expect(texts(renderer)).toContain(
      'Could not save your name on this device. Try again.',
    );
  });

  it('keeps the name field in the app, not in the keyboard’s own full-screen editor', () => {
    const input = field(render(<WelcomeScreen />));
    expect(input.props.disableFullscreenUI).toBe(true);
    expect(input.props.underlineColorAndroid).toBe('transparent');
  });

  it('centres the form in a scroll view that makes room for the keyboard', () => {
    const renderer = render(<WelcomeScreen />);
    expect(
      renderer.root.findByType(ScrollView).props.keyboardShouldPersistTaps,
    ).toBe('handled');
    expect(content(renderer)).toMatchObject({
      flexGrow: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      alignContent: 'center',
      justifyContent: 'center',
      paddingBottom: 0,
    });

    keyboard.show(280);
    expect(content(renderer).paddingBottom).toBe(280);
    keyboard.hide();
    expect(content(renderer).paddingBottom).toBe(0);
  });
});
