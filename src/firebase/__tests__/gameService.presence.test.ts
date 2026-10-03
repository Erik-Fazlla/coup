/** Presence against a stand-in for firebase/database: the calls, their order, and failure handling. */
type Listener = (snapshot: { val: () => unknown }) => void;

const mockCalls: string[] = [];
const mockListeners: Record<
  string,
  { onValue: Listener; onError?: (error: Error) => void; off: jest.Mock }
> = {};
const mockDisconnect = {
  remove: jest.fn(),
  cancel: jest.fn(),
};
const mockSetResult = jest.fn();
const mockRemoveResult = jest.fn();

jest.mock('firebase/database', () => ({
  get: jest.fn(),
  push: jest.fn(),
  runTransaction: jest.fn(),
  ref: (_db: unknown, path: string) => ({ path }),
  set: (target: { path: string }, value: unknown) => {
    mockCalls.push(`set ${target.path} ${value}`);
    return mockSetResult();
  },
  remove: (target: { path: string }) => {
    mockCalls.push(`remove ${target.path}`);
    return mockRemoveResult();
  },
  onDisconnect: (target: { path: string }) => ({
    remove: () => {
      mockCalls.push(`onDisconnect.remove ${target.path}`);
      return mockDisconnect.remove();
    },
    cancel: () => {
      mockCalls.push(`onDisconnect.cancel ${target.path}`);
      return mockDisconnect.cancel();
    },
  }),
  onValue: (
    target: { path: string },
    onValue: Listener,
    onError?: (error: Error) => void,
  ) => {
    const off = jest.fn();
    mockListeners[target.path] = { onValue, onError, off };
    return off;
  },
}));

import { createGameService } from '../gameService';

const service = createGameService({} as any);

/** Waits for the promise chains inside trackPresence to settle. */
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

function connection(connected: boolean | null) {
  mockListeners['.info/connected'].onValue({ val: () => connected });
}

beforeEach(() => {
  mockCalls.length = 0;
  Object.keys(mockListeners).forEach(key => delete mockListeners[key]);
  mockDisconnect.remove.mockReset().mockResolvedValue(undefined);
  mockDisconnect.cancel.mockReset().mockResolvedValue(undefined);
  mockSetResult.mockReset().mockResolvedValue(undefined);
  mockRemoveResult.mockReset().mockResolvedValue(undefined);
});

describe('trackPresence', () => {
  it('does nothing until the connection is up', async () => {
    service.trackPresence('g1', 'p1');
    connection(false);
    await settle();
    expect(mockCalls).toEqual([]);
  });

  it('registers the server-side removal first and only then sets the entry', async () => {
    service.trackPresence('g1', 'p1');
    connection(true);
    await settle();
    expect(mockCalls).toEqual([
      'onDisconnect.remove presence/g1/p1',
      'set presence/g1/p1 true',
    ]);
  });

  it('does not set the entry before the removal has been accepted', async () => {
    let accept!: () => void;
    mockDisconnect.remove.mockReturnValue(
      new Promise<void>(resolve => {
        accept = resolve;
      }),
    );
    service.trackPresence('g1', 'p1');
    connection(true);
    await settle();
    expect(mockCalls).toEqual(['onDisconnect.remove presence/g1/p1']);
    accept();
    await settle();
    expect(mockCalls).toContain('set presence/g1/p1 true');
  });

  it('does it all again after every reconnect', async () => {
    service.trackPresence('g1', 'p1');
    connection(true);
    await settle();
    connection(false);
    await settle();
    connection(true);
    await settle();
    expect(mockCalls).toEqual([
      'onDisconnect.remove presence/g1/p1',
      'set presence/g1/p1 true',
      'onDisconnect.remove presence/g1/p1',
      'set presence/g1/p1 true',
    ]);
  });

  it('stops listening and removes the entry when stopped', async () => {
    const stop = service.trackPresence('g1', 'p1');
    connection(true);
    await settle();
    mockCalls.length = 0;

    stop();
    expect(mockListeners['.info/connected'].off).toHaveBeenCalledTimes(1);
    expect(mockCalls).toEqual([
      'onDisconnect.cancel presence/g1/p1',
      'remove presence/g1/p1',
    ]);

    // A later reconnect, or stopping twice, changes nothing.
    mockCalls.length = 0;
    connection(true);
    stop();
    await settle();
    expect(mockCalls).toEqual([]);
  });

  it('does not set the entry when stopped while the removal was being registered', async () => {
    let accept!: () => void;
    mockDisconnect.remove.mockReturnValue(
      new Promise<void>(resolve => {
        accept = resolve;
      }),
    );
    const stop = service.trackPresence('g1', 'p1');
    connection(true);
    stop();
    accept();
    await settle();
    expect(mockCalls).not.toContain('set presence/g1/p1 true');
  });

  it('swallows a refused removal, a refused set and a refused cleanup', async () => {
    mockDisconnect.remove.mockRejectedValue(new Error('permission_denied'));
    const stop = service.trackPresence('g1', 'p1');
    connection(true);
    await settle();
    // Without the removal registered, the entry is never written.
    expect(mockCalls).toEqual(['onDisconnect.remove presence/g1/p1']);

    mockDisconnect.remove.mockResolvedValue(undefined);
    mockSetResult.mockRejectedValue(new Error('permission_denied'));
    connection(true);
    await settle();

    mockDisconnect.cancel.mockRejectedValue(new Error('permission_denied'));
    mockRemoveResult.mockRejectedValue(new Error('permission_denied'));
    expect(() => stop()).not.toThrow();
    // An unhandled rejection from any of the above would fail the run here.
    await settle();
  });

  it('swallows a call that throws straight away instead of rejecting', async () => {
    mockDisconnect.remove.mockImplementation(() => {
      throw new Error('boom');
    });
    const stop = service.trackPresence('g1', 'p1');
    expect(() => connection(true)).not.toThrow();
    mockDisconnect.cancel.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => stop()).not.toThrow();
  });
});

describe('subscribePresence', () => {
  it('reports the players that are online', () => {
    const onChange = jest.fn();
    service.subscribePresence('g1', onChange);
    mockListeners['presence/g1'].onValue({ val: () => ({ a: true, b: true }) });
    expect(onChange).toHaveBeenLastCalledWith({ a: true, b: true });
  });

  it('reports an empty object when nothing is there', () => {
    const onChange = jest.fn();
    service.subscribePresence('g1', onChange);
    mockListeners['presence/g1'].onValue({ val: () => null });
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('only counts entries that are true', () => {
    const onChange = jest.fn();
    service.subscribePresence('g1', onChange);
    mockListeners['presence/g1'].onValue({
      val: () => ({ a: true, b: false, c: 'yes', d: 1 }),
    });
    expect(onChange).toHaveBeenLastCalledWith({ a: true });
  });

  it('calls onUnavailable once, and not onChange, when the list cannot be read', () => {
    const onChange = jest.fn();
    const onUnavailable = jest.fn();
    service.subscribePresence('g1', onChange, onUnavailable);
    mockListeners['presence/g1'].onError?.(new Error('permission_denied'));
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works without an onUnavailable callback', () => {
    service.subscribePresence('g1', jest.fn());
    expect(() =>
      mockListeners['presence/g1'].onError?.(new Error('permission_denied')),
    ).not.toThrow();
  });

  it('returns the unsubscribe function', () => {
    const stop = service.subscribePresence('g1', jest.fn());
    stop();
    expect(mockListeners['presence/g1'].off).toHaveBeenCalledTimes(1);
  });
});
