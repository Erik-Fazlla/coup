import { buildDeck, copiesPerCharacter, deckSize, shuffle } from '../deck';
import { CARDS } from '../types';

describe('buildDeck', () => {
  it.each([2, 3, 4, 5, 6])(
    'has 15 cards, 3 of each character, for %i players',
    players => {
      const deck = buildDeck(players);
      expect(deck).toHaveLength(15);
      expect(deckSize(players)).toBe(15);
      expect(copiesPerCharacter(players)).toBe(3);
      CARDS.forEach(card =>
        expect(deck.filter(c => c === card)).toHaveLength(3),
      );
    },
  );

  it.each([7, 8, 9, 10])(
    'has 20 cards, 4 of each character, for %i players',
    players => {
      const deck = buildDeck(players);
      expect(deck).toHaveLength(20);
      expect(deckSize(players)).toBe(20);
      expect(copiesPerCharacter(players)).toBe(4);
      CARDS.forEach(card =>
        expect(deck.filter(c => c === card)).toHaveLength(4),
      );
    },
  );

  it('keeps the copies of a character together, in the order of CARDS', () => {
    expect(buildDeck(2).slice(0, 4)).toEqual([
      CARDS[0],
      CARDS[0],
      CARDS[0],
      CARDS[1],
    ]);
    expect(buildDeck(7).slice(0, 5)).toEqual([
      CARDS[0],
      CARDS[0],
      CARDS[0],
      CARDS[0],
      CARDS[1],
    ]);
  });
});

describe('shuffle', () => {
  it('keeps the same cards', () => {
    const deck = buildDeck(7);
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
