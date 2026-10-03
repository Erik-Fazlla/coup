import React from 'react';
import { Keyboard } from 'react-native';
import { act } from 'react-test-renderer';
import { render } from '../../components/testUtils';
import { useKeyboardInset } from '../keyboard';

type Handler = (event: unknown) => void;

let handlers: Record<string, Handler>;
let removers: Record<string, jest.Mock>;
let inset: number;

function Probe() {
  inset = useKeyboardInset();
  return null;
}

const fire = (event: string, payload: unknown) =>
  act(() => {
    handlers[event](payload);
  });

beforeEach(() => {
  handlers = {};
  removers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((
    event: string,
    handler: Handler,
  ) => {
    handlers[event] = handler;
    removers[event] = jest.fn();
    return { remove: removers[event] };
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useKeyboardInset', () => {
  it('is 0 while the keyboard is hidden', () => {
    render(<Probe />);
    expect(inset).toBe(0);
    expect(Object.keys(handlers).sort()).toEqual([
      'keyboardDidHide',
      'keyboardDidShow',
    ]);
  });

  it('is the height of the keyboard while it is shown, and 0 again once it hides', () => {
    render(<Probe />);
    fire('keyboardDidShow', { endCoordinates: { height: 264 } });
    expect(inset).toBe(264);
    // The keyboard changes height (a suggestion row appears).
    fire('keyboardDidShow', { endCoordinates: { height: 301.5 } });
    expect(inset).toBe(301.5);
    fire('keyboardDidHide', {});
    expect(inset).toBe(0);
  });

  it('treats an event without a usable height as no keyboard', () => {
    render(<Probe />);
    fire('keyboardDidShow', { endCoordinates: { height: 200 } });
    [
      undefined,
      {},
      { endCoordinates: {} },
      { endCoordinates: { height: -4 } },
    ].forEach(payload => {
      fire('keyboardDidShow', { endCoordinates: { height: 200 } });
      fire('keyboardDidShow', payload);
      expect(inset).toBe(0);
    });
  });

  it('stops listening when the screen closes', () => {
    const renderer = render(<Probe />);
    expect(removers.keyboardDidShow).not.toHaveBeenCalled();
    act(() => {
      renderer.unmount();
    });
    expect(removers.keyboardDidShow).toHaveBeenCalledTimes(1);
    expect(removers.keyboardDidHide).toHaveBeenCalledTimes(1);
  });
});
