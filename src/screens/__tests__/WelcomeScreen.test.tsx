import React from 'react';
import { AppState, ScrollView, StyleSheet, TextInput } from 'react-native';
import { act, ReactTestRenderer } from 'react-test-renderer';
import { fakeKeyboard, render, texts } from '../../components/testUtils';
import { MAX_NAME_LENGTH } from '../../engine/lobby';
import {
  containedRect,
  OUTRO_TIMEOUT_MS,
  WelcomeScreen,
} from '../WelcomeScreen';
import { playSound } from '../../ui/sound';

const mockSetName = jest.fn();
let mockStartupError: string | null = null;
let mockSound = true;

jest.mock('../../context/ProfileContext', () => ({
  useProfile: () => ({ setName: mockSetName, startupError: mockStartupError }),
}));
jest.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: { sound: mockSound, vibration: true },
    update: jest.fn(),
  }),
}));
jest.mock('../../ui/sound', () => ({ playSound: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
// The real player is native; a plain view keeps its props for the tests to read and call.
jest.mock('react-native-video', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const MockVideo = mockReact.forwardRef((props: object, ref: unknown) => {
    mockReact.useImperativeHandle(ref, () => ({ seek: jest.fn() }));
    return mockReact.createElement(View, props);
  });
  return {
    __esModule: true,
    default: MockVideo,
    ResizeMode: { CONTAIN: 'contain' },
    ViewType: { TEXTURE: 0 },
  };
});

let keyboard: ReturnType<typeof fakeKeyboard>;

const field = (renderer: ReactTestRenderer) =>
  renderer.root.findByType(TextInput);
const content = (renderer: ReactTestRenderer) =>
  StyleSheet.flatten(
    renderer.root.findByType(ScrollView).props.contentContainerStyle,
  );
const continueButton = (renderer: ReactTestRenderer) =>
  renderer.root.find(
    node =>
      node.props.accessibilityLabel === 'Continue' &&
      typeof node.props.onPress === 'function',
  );
const video = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.find(
    node => node.props.testID === id && typeof node.type !== 'string',
  );
const hasVideo = (renderer: ReactTestRenderer, id: string) =>
  renderer.root.findAll(
    node => node.props.testID === id && typeof node.type !== 'string',
  ).length > 0;

const typeAndContinue = async (renderer: ReactTestRenderer, name: string) => {
  act(() => {
    field(renderer).props.onChangeText(name);
  });
  await act(async () => {
    continueButton(renderer).props.onPress();
  });
};
const still = (renderer: ReactTestRenderer) =>
  renderer.root.findAll(
    node =>
      node.props.testID === 'intro-still' && typeof node.type !== 'string',
  );
/** The intro plays to its end and its still picture finishes loading. */
const endIntro = (renderer: ReactTestRenderer) => {
  act(() => {
    video(renderer, 'intro-video').props.onEnd();
  });
  act(() => {
    still(renderer)[0].props.onLoadEnd();
  });
};
const videosShown = (renderer: ReactTestRenderer) =>
  ['intro-video', 'outro-video'].filter(id => hasVideo(renderer, id));

beforeEach(() => {
  jest.clearAllMocks();
  mockSetName.mockResolvedValue(undefined);
  mockStartupError = null;
  mockSound = true;
  keyboard = fakeKeyboard();
  // Keeps the form's fall-back timer from firing after a test has finished.
  jest.useFakeTimers();
});

afterEach(() => {
  keyboard.restore();
  jest.useRealTimers();
});

describe('WelcomeScreen', () => {
  it('plays the whoosh when the card is thrown and the flash when the clip ends', async () => {
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    expect(playSound).toHaveBeenCalledWith('whoosh');
    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(playSound).toHaveBeenLastCalledWith('flash');
  });

  it('stays silent with sound switched off', async () => {
    mockSound = false;
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(playSound).not.toHaveBeenCalled();
  });

  it('plays only the intro at first, and never two videos at once', () => {
    const renderer = render(<WelcomeScreen />);
    expect(videosShown(renderer)).toEqual(['intro-video']);
    expect(still(renderer)).toHaveLength(0);
    endIntro(renderer);
    // The intro is let go; the outro is loaded paused, behind the still.
    expect(videosShown(renderer)).toEqual(['outro-video']);
    expect(video(renderer, 'outro-video').props.paused).toBe(true);
    expect(still(renderer)).toHaveLength(1);
  });

  it('plays the outro on Continue and saves the trimmed name when it ends', async () => {
    const onLeaving = jest.fn();
    const renderer = render(<WelcomeScreen onLeaving={onLeaving} />);
    endIntro(renderer);
    act(() => {
      video(renderer, 'outro-video').props.onReadyForDisplay();
    });

    await typeAndContinue(renderer, '  Erik ');
    expect(video(renderer, 'outro-video').props.paused).toBe(false);
    // The still steps aside the moment Continue is tapped.
    expect(still(renderer)).toHaveLength(0);
    expect(field(renderer).props.editable).toBe(false);
    expect(continueButton(renderer).props.disabled).toBe(true);
    expect(mockSetName).not.toHaveBeenCalled();

    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(onLeaving).toHaveBeenCalledWith(true);
    expect(mockSetName).toHaveBeenCalledTimes(1);
    expect(mockSetName).toHaveBeenCalledWith('Erik');
  });

  it('cuts the intro short when Continue comes first, covering the switch with the still', async () => {
    const renderer = render(<WelcomeScreen />);
    await typeAndContinue(renderer, 'Erik');
    expect(still(renderer)).toHaveLength(1);
    expect(video(renderer, 'intro-video').props.paused).toBe(true);
    act(() => {
      still(renderer)[0].props.onLoadEnd();
    });
    expect(videosShown(renderer)).toEqual(['outro-video']);
    expect(video(renderer, 'outro-video').props.paused).toBe(false);
    // Until its first frame is drawn, the still stays in front.
    expect(still(renderer)).toHaveLength(1);
    act(() => {
      video(renderer, 'outro-video').props.onReadyForDisplay();
    });
    expect(still(renderer)).toHaveLength(0);
  });

  it('opens the next screen after 6 seconds if the outro never ends', async () => {
    const onLeaving = jest.fn();
    const renderer = render(<WelcomeScreen onLeaving={onLeaving} />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      jest.advanceTimersByTime(OUTRO_TIMEOUT_MS);
    });
    expect(onLeaving).toHaveBeenCalledWith(false);
    expect(mockSetName).toHaveBeenCalledWith('Erik');
  });

  it('skips the outro when it fails to play', async () => {
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      video(renderer, 'outro-video').props.onError({ error: {} });
    });
    expect(mockSetName).toHaveBeenCalledWith('Erik');
  });

  it('goes straight on when the outro could not even load', async () => {
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await act(async () => {
      video(renderer, 'outro-video').props.onError({ error: {} });
    });
    expect(hasVideo(renderer, 'outro-video')).toBe(false);
    await typeAndContinue(renderer, 'Erik');
    expect(mockSetName).toHaveBeenCalledWith('Erik');
  });

  it('skips the rest of the outro when the app goes to the background', async () => {
    const listeners: Array<(state: string) => void> = [];
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });
    const renderer = render(<WelcomeScreen />);
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      listeners.forEach(listener => listener('background'));
    });
    expect(mockSetName).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    renderer.unmount();
  });

  it('holds the intro on its last frame instead of looping', () => {
    const renderer = render(<WelcomeScreen />);
    const intro = video(renderer, 'intro-video');
    expect(intro.props.repeat).toBe(false);
    expect(intro.props.muted).toBe(true);
    expect(intro.props.controls).toBe(false);
    act(() => {
      intro.props.onEnd();
    });
    expect(video(renderer, 'intro-video').props.paused).toBe(true);
    expect(still(renderer)).toHaveLength(1);
  });

  it('does not continue without a name, and says why saving failed', async () => {
    const renderer = render(<WelcomeScreen />);
    expect(continueButton(renderer).props.disabled).toBe(true);
    act(() => {
      field(renderer).props.onChangeText('   ');
    });
    expect(continueButton(renderer).props.disabled).toBe(true);

    mockSetName.mockRejectedValue(new Error('storage broken'));
    endIntro(renderer);
    await typeAndContinue(renderer, 'Erik');
    await act(async () => {
      video(renderer, 'outro-video').props.onEnd();
    });
    expect(texts(renderer)).toContain(
      'Could not save your name on this device. Try again.',
    );
    // Back on the form, over the still, ready to try again.
    expect(still(renderer)).toHaveLength(1);
    expect(field(renderer).props.editable).toBe(true);
    expect(continueButton(renderer).props.disabled).toBe(false);
  });

  it('keeps the name field in the app, not in the keyboard’s own full-screen editor', () => {
    const input = field(render(<WelcomeScreen />));
    expect(input.props.disableFullscreenUI).toBe(true);
    expect(input.props.underlineColorAndroid).toBe('transparent');
    expect(input.props.maxLength).toBe(MAX_NAME_LENGTH);
  });

  it('makes room for the keyboard', () => {
    const renderer = render(<WelcomeScreen />);
    // A landscape phone: the picture fills the height, so the keyboard covers part of it.
    act(() => {
      renderer.root
        .find(node => typeof node.props.onLayout === 'function')
        .props.onLayout({
          nativeEvent: { layout: { width: 800, height: 360 } },
        });
    });
    expect(
      renderer.root.findByType(ScrollView).props.keyboardShouldPersistTaps,
    ).toBe('handled');
    expect(content(renderer)).toMatchObject({
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom: 0,
    });
    keyboard.show(280);
    expect(content(renderer).paddingBottom).toBe(280);
    keyboard.hide();
    expect(content(renderer).paddingBottom).toBe(0);
  });
});

describe('containedRect', () => {
  it('fits the 16:9 picture by height on a wide phone, centred', () => {
    expect(containedRect(800, 360)).toEqual({
      left: 80,
      top: 0,
      width: 640,
      height: 360,
    });
  });

  it('fits it by width on a squarer screen, centred', () => {
    expect(containedRect(1024, 768)).toEqual({
      left: 0,
      top: 96,
      width: 1024,
      height: 576,
    });
  });
});
