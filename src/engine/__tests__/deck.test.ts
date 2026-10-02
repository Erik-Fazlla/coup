import { buildDeck, shuffle } from '../deck';
import { CARDS } from '../types';

describe('buildDeck', () => {
  it('has 15 cards, 3 of each character', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(15);
    CARDS.forEach(card => expect(deck.filter(c => c === card)).toHaveLength(3));
  });
});

describe('shuffle', () => {
  it('keeps the same cards', () => {
    const deck = buildDeck();
    expect([...shuffle(deck, Math.random)].sort()).toEqual([...deck].sort());
  });

  it('does not mutate its input', () => {
    const items = [1, 2, 3, 4];
    shuffle(items, () => 0);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it('is driven entirely by the injected rng', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4]);
  });
});
