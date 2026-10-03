import React from 'react';
import { Keyboard } from 'react-native';
import {
  act,
  create,
  ReactTestInstance,
  ReactTestRenderer,
} from 'react-test-renderer';

type KeyboardHandler = (event: unknown) => void;

/**
 * Stands in for the system keyboard. Call before rendering; `show` and `hide`
 * tell every listener what the real keyboard would, and `restore` puts the
 * real one back.
 */
export function fakeKeyboard() {
  const original = Keyboard.addListener;
  const listeners: Record<string, Set<KeyboardHandler>> = {};
  const tell = (event: string, payload: unknown) =>
    act(() => {
      listeners[event]?.forEach(handler => handler(payload));
    });
  (Keyboard as { addListener: unknown }).addListener = (
    event: string,
    handler: KeyboardHandler,
  ) => {
    (listeners[event] ??= new Set()).add(handler);
    return { remove: () => listeners[event].delete(handler) };
  };
  return {
    show: (height: number) =>
      tell('keyboardDidShow', { endCoordinates: { height } }),
    hide: () => tell('keyboardDidHide', {}),
    restore: () => {
      (Keyboard as { addListener: unknown }).addListener = original;
    },
  };
}

/** Renders inside `act`, as every component test needs. */
export function render(element: React.ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

/** Everything that reaches the screen or a screen reader, as one string: text, labels and props of host views. */
export function rendered(renderer: ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

/** The content of every text element on screen, in order. */
export function texts(renderer: ReactTestRenderer): unknown[] {
  return renderer.root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node => node.props.children);
}

/** The button with this testID, or undefined. A view that merely carries the testID does not count. */
export function findButton(
  renderer: ReactTestRenderer,
  testID: string,
): ReactTestInstance | undefined {
  return renderer.root.findAll(
    node =>
      node.props.testID === testID && node.props.accessibilityRole === 'button',
  )[0];
}

export function button(
  renderer: ReactTestRenderer,
  testID: string,
): ReactTestInstance {
  const found = findButton(renderer, testID);
  if (!found) {
    throw new Error(`No button with testID "${testID}"`);
  }
  return found;
}

/** Taps a button the way a finger would: a disabled button does nothing. */
export function press(renderer: ReactTestRenderer, testID: string): void {
  const target = button(renderer, testID);
  act(() => {
    if (!target.props.disabled) {
      target.props.onPress();
    }
  });
}

export function isEnabled(
  renderer: ReactTestRenderer,
  testID: string,
): boolean {
  const target = button(renderer, testID);
  // Both must agree: what the finger can do and what a screen reader is told.
  const blocked = target.props.disabled === true;
  const announced = target.props.accessibilityState?.disabled === true;
  if (blocked !== announced) {
    throw new Error(`"${testID}" is disabled for touch or for speech only`);
  }
  return !blocked;
}
