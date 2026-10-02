import { TimeoutError, withTimeout } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with the same error when the promise rejects', async () => {
    const failure = new Error('boom');
    await expect(withTimeout(Promise.reject(failure), 1000)).rejects.toBe(
      failure,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects with a timeout error when the promise is too slow', async () => {
    const never = new Promise<void>(() => {});
    const result = withTimeout(never, 1000);
    jest.advanceTimersByTime(1000);
    await expect(result).rejects.toBeInstanceOf(TimeoutError);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not time out before the limit', async () => {
    let finish: (value: string) => void = () => {};
    const slow = new Promise<string>(resolve => {
      finish = resolve;
    });
    const result = withTimeout(slow, 1000);
    jest.advanceTimersByTime(999);
    finish('late but fine');
    await expect(result).resolves.toBe('late but fine');
    expect(jest.getTimerCount()).toBe(0);
  });
});
