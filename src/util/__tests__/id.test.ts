import {generateId} from '../id';

describe('generateId', () => {
  it('is a database-safe key: p followed by 20 base-36 characters', () => {
    expect(generateId()).toMatch(/^p[0-9a-z]{20}$/);
  });

  it('is driven by the injected rng', () => {
    expect(generateId(() => 0)).toBe('p00000000000000000000');
  });

  it('differs between calls', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
