import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { DEFAULT_SETTINGS } from '../../profile/settingsStore';
import { SettingsProvider, useSettings } from '../SettingsContext';

const mockStore = {
  load: jest.fn(),
  save: jest.fn(),
};

jest.mock('../../firebase', () => ({
  getServices: () => ({ settings: mockStore }),
}));

let value: ReturnType<typeof useSettings>;
let renderer: ReactTestRenderer;

function Probe() {
  value = useSettings();
  return null;
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (result: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function mount() {
  await act(async () => {
    renderer = create(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.load.mockResolvedValue({ vibration: true, sound: true });
  mockStore.save.mockImplementation(async (patch: object) => ({
    ...DEFAULT_SETTINGS,
    ...patch,
  }));
});

afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
});

describe('SettingsProvider', () => {
  it('shows the defaults while the stored settings are loading', async () => {
    const stored = deferred<{ vibration: boolean; sound: boolean }>();
    mockStore.load.mockReturnValue(stored.promise);
    await mount();
    expect(value.settings).toEqual(DEFAULT_SETTINGS);

    await act(async () => stored.resolve({ vibration: false, sound: true }));
    expect(value.settings).toEqual({ vibration: false, sound: true });
  });

  it('loads once on mount and not again when it re-renders', async () => {
    await mount();
    expect(mockStore.load).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.update(
        <SettingsProvider>
          <Probe />
        </SettingsProvider>,
      );
    });
    await act(async () => value.update({ sound: false }));
    expect(mockStore.load).toHaveBeenCalledTimes(1);
  });

  it('applies an update to the state at once and saves it in the background', async () => {
    const saving = deferred<{ vibration: boolean; sound: boolean }>();
    mockStore.save.mockReturnValue(saving.promise);
    await mount();

    await act(async () => value.update({ vibration: false }));
    // The save has not finished, yet the value is already changed.
    expect(value.settings).toEqual({ vibration: false, sound: true });
    expect(mockStore.save).toHaveBeenCalledWith({ vibration: false });

    await act(async () => saving.resolve({ vibration: false, sound: true }));
    expect(value.settings).toEqual({ vibration: false, sound: true });
  });

  it('keeps the other switch when one changes', async () => {
    await mount();
    await act(async () => value.update({ vibration: false }));
    await act(async () => value.update({ sound: false }));
    expect(value.settings).toEqual({ vibration: false, sound: false });
  });

  it('keeps the in-memory value and says nothing when saving fails', async () => {
    mockStore.save.mockRejectedValue(new Error('disk full'));
    await mount();
    await act(async () => value.update({ sound: false }));
    // Let the rejected save settle; an unhandled rejection would fail the run.
    await act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve));
    });
    expect(value.settings).toEqual({ vibration: true, sound: false });
  });

  it('keeps the in-memory value when saving throws straight away', async () => {
    mockStore.save.mockImplementation(() => {
      throw new Error('boom');
    });
    await mount();
    await act(async () => value.update({ sound: false }));
    expect(value.settings).toEqual({ vibration: true, sound: false });
  });

  it('lets a change made while loading win over the stored value', async () => {
    const stored = deferred<{ vibration: boolean; sound: boolean }>();
    mockStore.load.mockReturnValue(stored.promise);
    await mount();

    await act(async () => value.update({ sound: false }));
    await act(async () => stored.resolve({ vibration: false, sound: true }));
    expect(value.settings).toEqual({ vibration: false, sound: false });
  });

  it('stays on the defaults when loading fails', async () => {
    mockStore.load.mockRejectedValue(new Error('broken'));
    await mount();
    expect(value.settings).toEqual(DEFAULT_SETTINGS);
    await act(async () => value.update({ sound: false }));
    expect(value.settings).toEqual({ vibration: true, sound: false });
  });

  it('ignores a load that finishes after the provider was removed', async () => {
    const stored = deferred<{ vibration: boolean; sound: boolean }>();
    mockStore.load.mockReturnValue(stored.promise);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await mount();
    await act(async () => renderer.unmount());
    await act(async () => stored.resolve({ vibration: false, sound: false }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('gives update the same identity for as long as the provider lives', async () => {
    await mount();
    const first = value.update;
    await act(async () => value.update({ sound: false }));
    expect(value.update).toBe(first);
  });
});

describe('useSettings', () => {
  it('throws outside a SettingsProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      act(() => {
        create(<Probe />);
      });
    }).toThrow('useSettings must be used inside SettingsProvider');
    spy.mockRestore();
  });
});
