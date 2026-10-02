export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Resolves or rejects like `promise`, but rejects with a TimeoutError if it has not settled after `ms`.
 * The underlying operation is not cancelled; its late result is simply ignored.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Timed out',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
