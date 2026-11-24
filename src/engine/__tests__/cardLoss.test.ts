import { applyAction } from '../actions';
import { pendingResponders, unrevealedCount } from '../rules';
import { normalizeGame } from '../serialize';
import { identityRng, LooseAction, makeGame, play } from '../testHelpers';
import { Card, Game, GameAction, IllegalActionError } from '../types';

/**
 * Every way a card can be lost, in 2, 3 and 4 player games.
 *
 * Every step of every scenario goes through `go`, which also checks that
 *  - nobody lost a card that was not expected (the scenario asserts exact counts),
 *  - the structural invariants hold (alive iff a hidden card, status finished iff one player left, ...),
 *  - the game survives a Firebase write + read unchanged, and that playing the same action on the
 *    copy that came back from Firebase gives exactly the same game.
 */

const IDS = ['a', 'b', 'c', 'd'];
const COUNTS = [2, 3, 4];
type Hands = Partial<Record<string, Card[]>>;

const FILLER: Card[] = ['Ambassador', 'Ambassador'];
const BLOCK_DECK: Card[] = ['Contessa', 'Assassin', 'Ambassador', 'Captain'];
const CONTESSA_DECK: Card[] = ['Captain', 'Assassin', 'Duke', 'Ambassador'];

function table(
  n: number,
  hands: Hands,
  coins: Record<string, number> = {},
  deck?: Card[],
): Game {
  const full: Record<string, Card[]> = {};
  IDS.slice(0, n).forEach(id => {
    full[id] = hands[id] ?? FILLER;
  });
  return makeGame(full, { coins, deck });
}

const others = (n: number, except: string) =>
  IDS.slice(0, n).filter(id => id !== except);

// ---------------------------------------------------------------- Firebase

/**
 * What Realtime Database keeps of a value: no null, no empty array, no empty object.
 * An array that lost an entry comes back as an object keyed by index; `dense` keeps full arrays as arrays.
 */
function strip(value: unknown, dense: boolean): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(v => strip(v, dense));
    if (dense && items.every(v => v !== undefined)) {
      return items.length === 0 ? undefined : items;
    }
    const keyed: Record<string, unknown> = {};
    items.forEach((v, i) => {
      if (v !== undefined) {
        keyed[String(i)] = v;
      }
    });
    return Object.keys(keyed).length === 0 ? undefined : keyed;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      const s = strip(v, dense);
      if (s !== undefined) {
        out[k] = s;
      }
    });
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

/** Writes the game the way the database stores it and reads it back the way gameService does. */
function viaFirebase(game: Game, dense = false): Game {
  return normalizeGame(JSON.parse(JSON.stringify(strip(game, dense))));
}

// -------------------------------------------------------------- invariants

const revealedOf = (g: Game, id: string) =>
  g.players[id].influence.filter(i => i.revealed).length;

function counts(g: Game, n: number): Record<string, number> {
  return Object.fromEntries(IDS.slice(0, n).map(id => [id, revealedOf(g, id)]));
}

/** `expected` lists only the players who should have lost cards; everybody else must have lost none. */
function expectRevealed(g: Game, n: number, expected: Record<string, number>) {
  const zero = Object.fromEntries(IDS.slice(0, n).map(id => [id, 0]));
  expect(counts(g, n)).toEqual({ ...zero, ...expected });
}

function invariants(g: Game): void {
  const alive = g.playerOrder.filter(id => unrevealedCount(g.players[id]) > 0);
  g.playerOrder.forEach(id => {
    const p = g.players[id];
    expect(revealedOf(g, id)).toBeLessThanOrEqual(p.influence.length);
    // Alive means holding a hidden card; being out means eliminatedAt is set, and nothing else does.
    expect({ id, out: p.eliminatedAt !== null }).toEqual({
      id,
      out: unrevealedCount(p) === 0,
    });
  });
  expect(alive.length).toBeGreaterThanOrEqual(1);
  expect(g.eliminations.map(e => e.playerId).sort()).toEqual(
    g.playerOrder.filter(id => !alive.includes(id)).sort(),
  );
  if (alive.length === 1) {
    expect(g.status).toBe('finished');
    expect(g.state.phase).toBe('finished');
    expect(g.winner).toBe(alive[0]);
    expect(g.scores[alive[0]]).toBe(1);
  } else {
    expect(g.status).toBe('playing');
    expect(g.winner).toBeNull();
    expect(g.state.phase).not.toBe('finished');
  }
  if (g.state.phase === 'loseInfluence') {
    const waiting = g.state.pending?.loseInfluence;
    expect(waiting).toBeTruthy();
    // A choice is only ever asked of someone who still has two hidden cards.
    expect(unrevealedCount(g.players[waiting!.playerId])).toBe(2);
  } else {
    expect(g.state.pending?.loseInfluence ?? null).toBeNull();
  }
  if (g.state.phase === 'action') {
    expect(g.state.pending).toBeNull();
    expect(alive).toContain(g.state.currentTurnPlayer);
  }
}

/** Plays the actions one at a time, checking invariants and the Firebase round trip after each. */
function go(game: Game, ...actions: LooseAction[]): Game {
  let cur = game;
  for (const action of actions) {
    const next = play(cur, action);
    expect(play(viaFirebase(cur), action)).toEqual(next);
    expect(play(viaFirebase(cur, true), action)).toEqual(next);
    invariants(next);
    expect(viaFirebase(next)).toEqual(next);
    expect(viaFirebase(next, true)).toEqual(next);
    cur = next;
  }
  return cur;
}

const pass = (playerId: string): LooseAction => ({ type: 'pass', playerId });
const challenge = (playerId: string): LooseAction => ({
  type: 'challenge',
  playerId,
});
const block = (playerId: string, claim: Card): LooseAction => ({
  type: 'block',
  playerId,
  claim,
});
const lose = (playerId: string, cardIndex: number): LooseAction => ({
  type: 'loseInfluence',
  playerId,
  cardIndex,
});

function expectAsked(g: Game, id: string) {
  expect(g.state.phase).toBe('loseInfluence');
  expect(g.state.pending?.loseInfluence?.playerId).toBe(id);
}

function expectTurn(g: Game, id: string) {
  expect(g.status).toBe('playing');
  expect(g.state.phase).toBe('action');
  expect(g.state.pending).toBeNull();
  expect(g.state.currentTurnPlayer).toBe(id);
}

function expectWon(g: Game, id: string) {
  expect(g.status).toBe('finished');
  expect(g.winner).toBe(id);
  expect(g.state.phase).toBe('finished');
}

/** The proven card went back in the deck and the claimant drew the top card instead. Nothing was lost. */
function expectSwapped(
  g: Game,
  id: string,
  index: number,
  proven: Card,
  deckBefore: Card[],
  checkDeck = true,
) {
  expect(deckBefore[0]).not.toBe(proven);
  expect(g.players[id].influence[index]).toEqual({
    card: deckBefore[0],
    revealed: false,
  });
  if (checkDeck) {
    expect(g.deck).toEqual([...deckBefore.slice(1), proven]);
  }
  expect(revealedOf(g, id)).toBe(0);
}

// ================================================================ 1. Coup

describe('1. Coup', () => {
  describe.each(COUNTS)('%i players', n => {
    it.each([0, 1])(
      'target with two cards is asked, and choosing card %i reveals exactly that card',
      idx => {
        const hand: Card[] = ['Assassin', 'Contessa'];
        let g = table(n, { a: ['Duke', 'Captain'], b: hand }, { a: 7 });
        g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
        expectAsked(g, 'b');
        expectRevealed(g, n, {});
        expect(g.players.a.coins).toBe(0);
        g = go(g, lose('b', idx));
        expectRevealed(g, n, { b: 1 });
        expect(g.players.b.influence.map(i => i.revealed)).toEqual(
          idx === 0 ? [true, false] : [false, true],
        );
        expect(g.players.b.influence.map(i => i.card)).toEqual(hand);
        expect(g.winner).toBeNull();
        expectTurn(g, 'b');
      },
    );

    it('target with one card goes out at once, with no question asked', () => {
      let g = table(n, { a: ['Duke', 'Captain'], b: ['Contessa'] }, { a: 7 });
      g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
      expectRevealed(g, n, { b: 1 });
      expect(g.players.b.eliminatedAt).not.toBeNull();
      expect(g.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
      if (n === 2) {
        expectWon(g, 'a');
        expect(() => play(g, { type: 'income', playerId: 'a' })).toThrow(
          IllegalActionError,
        );
      } else {
        expect(g.status).toBe('playing');
        expectTurn(g, 'c');
      }
    });

    it('only the target may choose, and only a card that exists', () => {
      const g = go(
        table(
          n,
          { a: ['Duke', 'Captain'], b: ['Assassin', 'Contessa'] },
          { a: 7 },
        ),
        { type: 'coup', playerId: 'a', target: 'b' },
      );
      expect(() => play(g, lose('a', 0))).toThrow(IllegalActionError);
      expect(() => play(g, lose('b', 2))).toThrow(IllegalActionError);
      expect(() => play(g, lose('b', -1))).toThrow(IllegalActionError);
      expect(() => play(g, { type: 'income', playerId: 'a' })).toThrow(
        IllegalActionError,
      );
    });

    it('a revealed card cannot be chosen again', () => {
      // b already has card 0 face up and one hidden card, so a Coup takes the last one without asking.
      let g = table(
        n,
        { a: ['Duke', 'Captain'], b: ['Assassin', 'Contessa'] },
        { a: 14 },
      );
      g = go(g, { type: 'coup', playerId: 'a', target: 'b' }, lose('b', 0));
      // Fast-forward to a's next turn: everyone else takes income.
      const rest = others(n, 'a').filter(id => id !== 'b');
      g = go(
        g,
        { type: 'income', playerId: 'b' },
        ...rest.map(id => ({ type: 'income', playerId: id } as LooseAction)),
      );
      expectTurn(g, 'a');
      g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
      expectRevealed(g, n, { b: 2 });
      expect(g.players.b.influence.map(i => i.revealed)).toEqual([true, true]);
    });
  });
});

// ======================================================= 2. Assassination

describe('2. Assassination, unchallenged and unblocked', () => {
  function assassinate(n: number, targetHand: Card[]) {
    let g = table(n, { a: ['Assassin', 'Duke'], b: targetHand }, { a: 3 });
    g = go(g, { type: 'assassinate', playerId: 'a', target: 'b' });
    const responders = others(n, 'a');
    responders.slice(0, -1).forEach(id => {
      g = go(g, pass(id));
      expectRevealed(g, n, {});
      expect(g.state.phase).toBe('awaitingResponses');
    });
    return go(g, pass(responders[responders.length - 1]));
  }

  describe.each(COUNTS)('%i players', n => {
    it('target with two cards loses exactly one, of their own choosing', () => {
      let g = assassinate(n, ['Duke', 'Contessa']);
      expectAsked(g, 'b');
      expectRevealed(g, n, {});
      expect(g.players.a.coins).toBe(0);
      g = go(g, lose('b', 1));
      expectRevealed(g, n, { b: 1 });
      expect(g.players.b.influence.map(i => i.revealed)).toEqual([false, true]);
      expect(g.winner).toBeNull();
      expectTurn(g, 'b');
    });

    it('target with one card goes out', () => {
      const g = assassinate(n, ['Contessa']);
      expectRevealed(g, n, { b: 1 });
      expect(g.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
      if (n === 2) {
        expectWon(g, 'a');
      } else {
        expectTurn(g, 'c');
      }
    });
  });
});

// ============================================== 3. Bluff caught by challenge

describe('3. A bluffing claimant is challenged', () => {
  const CASES: {
    name: string;
    hand: Card[];
    declare: LooseAction;
    coins: Record<string, number>;
    aCoinsAfter: number;
  }[] = [
    {
      name: 'tax',
      hand: ['Contessa', 'Captain'],
      declare: { type: 'tax', playerId: 'a' },
      coins: {},
      aCoinsAfter: 2,
    },
    {
      name: 'steal',
      hand: ['Duke', 'Contessa'],
      declare: { type: 'steal', playerId: 'a', target: 'b' },
      coins: {},
      aCoinsAfter: 2,
    },
    {
      name: 'assassinate',
      hand: ['Duke', 'Captain'],
      declare: { type: 'assassinate', playerId: 'a', target: 'b' },
      coins: { a: 3 },
      aCoinsAfter: 3, // the fee comes back when the claim is a bluff
    },
    {
      name: 'exchange',
      hand: ['Duke', 'Contessa'],
      declare: { type: 'exchange', playerId: 'a' },
      coins: {},
      aCoinsAfter: 2,
    },
  ];

  describe.each(COUNTS)('%i players', n => {
    it.each(CASES)('$name bluff, claimant has two cards', c => {
      let g = table(n, { a: c.hand }, c.coins);
      g = go(g, c.declare, challenge('b'));
      expectAsked(g, 'a');
      expectRevealed(g, n, {});
      expect(g.reveal).toMatchObject({
        challenger: 'b',
        claimant: 'a',
        truthful: false,
        block: false,
      });
      g = go(g, lose('a', 1));
      expectRevealed(g, n, { a: 1 });
      expect(g.players.a.influence.map(i => i.revealed)).toEqual([false, true]);
      expect(g.players.a.coins).toBe(c.aCoinsAfter);
      expect(g.players.b.coins).toBe(2);
      expect(g.state.lastAction?.blocked).toBe(false);
      expectTurn(g, 'b');
    });

    it.each(CASES)('$name bluff, claimant has one card and goes out', c => {
      let g = table(n, { a: [c.hand[0]] }, c.coins);
      g = go(g, c.declare, challenge('b'));
      expectRevealed(g, n, { a: 1 });
      expect(g.eliminations).toEqual([{ playerId: 'a', by: 'b', turn: 1 }]);
      expect(g.players.a.coins).toBe(c.aCoinsAfter);
      if (n === 2) {
        expectWon(g, 'b');
      } else {
        expectTurn(g, 'b');
      }
    });

    it('a bluffed block claim (Duke against foreign aid) costs the blocker one card', () => {
      let g = table(n, {
        a: ['Captain', 'Captain'],
        b: ['Contessa', 'Captain'],
      });
      g = go(
        g,
        { type: 'foreignAid', playerId: 'a' },
        block('b', 'Duke'),
        challenge('a'),
      );
      expectAsked(g, 'b');
      g = go(g, lose('b', 0));
      expectRevealed(g, n, { b: 1 });
    });
  });
});

// ================================== 4. Truthful claimant, failed challenge

describe('4. A truthful claimant is challenged', () => {
  const DECK: Card[] = ['Contessa', 'Assassin', 'Duke', 'Captain'];
  const CASES: {
    name: string;
    claim: Card;
    hand: Card[];
    declare: LooseAction;
  }[] = [
    {
      name: 'tax',
      claim: 'Duke',
      hand: ['Duke', 'Contessa'],
      declare: { type: 'tax', playerId: 'a' },
    },
    {
      name: 'steal',
      claim: 'Captain',
      hand: ['Captain', 'Contessa'],
      declare: { type: 'steal', playerId: 'a', target: 'b' },
    },
    {
      name: 'exchange',
      claim: 'Ambassador',
      hand: ['Ambassador', 'Contessa'],
      declare: { type: 'exchange', playerId: 'a' },
    },
  ];

  describe.each(COUNTS)('%i players', n => {
    it.each(CASES)(
      '$name: challenger with two cards loses one, claimant swaps',
      c => {
        let g = table(n, { a: c.hand, b: ['Assassin', 'Captain'] }, {}, DECK);
        g = go(g, c.declare, challenge('b'));
        expectAsked(g, 'b');
        expect(g.reveal).toMatchObject({
          challenger: 'b',
          claimant: 'a',
          card: c.claim,
          truthful: true,
          block: false,
        });
        expectSwapped(g, 'a', 0, c.claim, DECK);
        expectRevealed(g, n, {});
        g = go(g, lose('b', 0));
        expectRevealed(g, n, { b: 1 });
        expect(g.players.b.influence.map(i => i.revealed)).toEqual([
          true,
          false,
        ]);
        if (c.name === 'tax') {
          expect(g.players.a.coins).toBe(5);
          expectTurn(g, 'b');
        } else if (c.name === 'steal') {
          // The target may still block, and is asked; passing lets the steal go through.
          expect(g.state.phase).toBe('awaitingResponses');
          expect(g.state.pending?.challengeResolved).toBe(true);
          expect(pendingResponders(g)).toEqual(['b']);
          g = go(g, pass('b'));
          expect([g.players.a.coins, g.players.b.coins]).toEqual([4, 0]);
          expectRevealed(g, n, { b: 1 });
          expectTurn(g, 'b');
        } else {
          expect(g.state.phase).toBe('exchange');
          expect(g.state.pending?.exchangeOptions).toHaveLength(4);
          g = go(g, { type: 'exchangeChoose', playerId: 'a', keep: [0, 1] });
          expectRevealed(g, n, { b: 1 });
          expectTurn(g, 'b');
        }
        expect(revealedOf(g, 'a')).toBe(0);
        expect(unrevealedCount(g.players.a)).toBe(2);
      },
    );

    it.each(CASES)(
      '$name: challenger with one card goes out; the claimant is not hurt',
      c => {
        let g = table(n, { a: c.hand, b: ['Assassin'] }, {}, DECK);
        g = go(g, c.declare, challenge('b'));
        expectRevealed(g, n, { b: 1 });
        expectSwapped(g, 'a', 0, c.claim, DECK, c.name !== 'exchange');
        expect(g.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
        if (n === 2) {
          expectWon(g, 'a');
          return;
        }
        if (c.name === 'exchange') {
          expect(g.state.phase).toBe('exchange');
          g = go(g, { type: 'exchangeChoose', playerId: 'a', keep: [0, 1] });
        }
        expectTurn(g, 'c');
        expect(g.players.a.coins).toBe(c.name === 'tax' ? 5 : 2);
        expect(g.players.b.coins).toBe(2); // dead target, nothing to steal
        expectRevealed(g, n, { b: 1 });
      },
    );
  });
});

// ========================================================= 5. Challenged blocks

describe('5. Challenged blocks', () => {
  const ACTOR: Card[] = ['Duke', 'Duke'];

  describe.each(COUNTS)('%i players', n => {
    const challengers = n === 2 ? ['a'] : ['a', 'c'];

    describe('Duke blocking foreign aid', () => {
      function challenged(
        blockerHand: Card[],
        challenger: string,
        challengerHand: Card[],
      ) {
        const hands: Hands = { a: ACTOR, b: blockerHand };
        hands[challenger] = challengerHand;
        const g = table(n, hands, {}, BLOCK_DECK);
        return go(
          g,
          { type: 'foreignAid', playerId: 'a' },
          block('b', 'Duke'),
          challenge(challenger),
        );
      }

      it.each(challengers)(
        'truthful blocker, challenger %s with two cards loses one',
        who => {
          let g = challenged(['Duke', 'Contessa'], who, [
            'Captain',
            'Assassin',
          ]);
          expectAsked(g, who);
          expect(g.reveal).toMatchObject({
            truthful: true,
            block: true,
            claimant: 'b',
          });
          expectSwapped(g, 'b', 0, 'Duke', BLOCK_DECK);
          g = go(g, lose(who, 1));
          expectRevealed(g, n, { [who]: 1 });
          expect(g.players[who].influence.map(i => i.revealed)).toEqual([
            false,
            true,
          ]);
          expect(g.players.a.coins).toBe(2); // blocked
          expect(g.state.lastAction?.blocked).toBe(true);
          expectTurn(g, 'b');
        },
      );

      it.each(challengers)(
        'truthful blocker, challenger %s with one card goes out',
        who => {
          const g = challenged(['Duke', 'Contessa'], who, ['Captain']);
          expectRevealed(g, n, { [who]: 1 });
          expect(g.players.a.coins).toBe(2);
          if (who === 'a' && n === 2) {
            expectWon(g, 'b');
          } else {
            expectTurn(g, 'b');
          }
        },
      );

      it.each(challengers)(
        'bluffing blocker, challenged by %s: blocker loses one, aid goes through',
        who => {
          let g = challenged(['Contessa', 'Captain'], who, [
            'Captain',
            'Assassin',
          ]);
          expectAsked(g, 'b');
          expect(g.reveal).toMatchObject({
            truthful: false,
            block: true,
            claimant: 'b',
          });
          g = go(g, lose('b', 0));
          expectRevealed(g, n, { b: 1 });
          // Anyone who has not answered the foreign aid still gets their say.
          const waiting = others(n, 'a').filter(id => id !== 'b');
          expect(pendingResponders(g).sort()).toEqual(waiting.sort());
          waiting.forEach(id => {
            g = go(g, pass(id));
          });
          expectRevealed(g, n, { b: 1 });
          expect(g.players.a.coins).toBe(4);
          expect(g.state.lastAction?.blocked).toBe(false);
          expectTurn(g, 'b');
        },
      );

      it.each(challengers)(
        'bluffing blocker with one card, challenged by %s: goes out',
        who => {
          let g = challenged(['Contessa'], who, ['Captain', 'Assassin']);
          expectRevealed(g, n, { b: 1 });
          if (n === 2) {
            expectWon(g, 'a');
            expect(g.players.a.coins).toBe(2); // the game is over, nothing more resolves
            return;
          }
          const waiting = others(n, 'a').filter(id => id !== 'b');
          waiting.forEach(id => {
            g = go(g, pass(id));
          });
          expectRevealed(g, n, { b: 1 });
          expect(g.players.a.coins).toBe(4);
          expectTurn(g, 'c');
        },
      );
    });

    describe.each<Card>(['Captain', 'Ambassador'])(
      '%s blocking steal',
      claim => {
        function challenged(
          blockerHand: Card[],
          challenger: string,
          challengerHand: Card[],
        ) {
          const hands: Hands = { a: ACTOR, b: blockerHand };
          hands[challenger] = challengerHand;
          return go(
            table(n, hands, {}, BLOCK_DECK),
            { type: 'steal', playerId: 'a', target: 'b' },
            block('b', claim),
            challenge(challenger),
          );
        }

        it.each(challengers)(
          'truthful blocker, challenger %s loses one, steal blocked',
          who => {
            let g = challenged([claim, 'Duke'], who, ['Captain', 'Assassin']);
            expectAsked(g, who);
            expectSwapped(g, 'b', 0, claim, BLOCK_DECK);
            g = go(g, lose(who, 0));
            expectRevealed(g, n, { [who]: 1 });
            expect([g.players.a.coins, g.players.b.coins]).toEqual([2, 2]);
            expectTurn(g, 'b');
          },
        );

        it.each(challengers)(
          'truthful blocker, challenger %s has one card and goes out',
          who => {
            const g = challenged([claim, 'Duke'], who, ['Captain']);
            expectRevealed(g, n, { [who]: 1 });
            expect([g.players.a.coins, g.players.b.coins]).toEqual([2, 2]);
            if (who === 'a' && n === 2) {
              expectWon(g, 'b');
            } else {
              expectTurn(g, 'b');
            }
          },
        );

        it.each(challengers)(
          'bluffing blocker, challenged by %s: blocker loses one, steal goes through',
          who => {
            const wrong: Card = claim === 'Captain' ? 'Duke' : 'Contessa';
            let g = challenged([wrong, 'Assassin'], who, [
              'Captain',
              'Assassin',
            ]);
            expectAsked(g, 'b');
            g = go(g, lose('b', 0));
            expectRevealed(g, n, { b: 1 });
            others(n, 'a')
              .filter(id => id !== 'b')
              .forEach(id => {
                g = go(g, pass(id));
              });
            expectRevealed(g, n, { b: 1 });
            expect([g.players.a.coins, g.players.b.coins]).toEqual([4, 0]);
            expectTurn(g, 'b');
          },
        );

        it.each(challengers)(
          'bluffing blocker with one card, challenged by %s: goes out, nothing is stolen',
          who => {
            const wrong: Card = claim === 'Captain' ? 'Duke' : 'Contessa';
            let g = challenged([wrong], who, ['Captain', 'Assassin']);
            expectRevealed(g, n, { b: 1 });
            if (n === 2) {
              expectWon(g, 'a');
              return;
            }
            others(n, 'a')
              .filter(id => id !== 'b')
              .forEach(id => {
                g = go(g, pass(id));
              });
            expectRevealed(g, n, { b: 1 });
            expect(g.players.a.coins).toBe(2); // the target is gone, so nothing to take
            expectTurn(g, 'c');
          },
        );
      },
    );
  });
});

// ================================ 6. Assassination: the official double loss

describe('6. Assassination double loss', () => {
  const DECK = CONTESSA_DECK;

  describe.each(COUNTS)('%i players', n => {
    const assassinate = (hands: Hands) =>
      go(table(n, { a: ['Assassin', 'Duke'], ...hands }, { a: 3 }, DECK), {
        type: 'assassinate',
        playerId: 'a',
        target: 'b',
      });

    it('target wrongly challenges: loses 1 for the challenge, may still block, and loses a 2nd if they pass', () => {
      let g = assassinate({ b: ['Duke', 'Captain'] });
      g = go(g, challenge('b'));
      expectAsked(g, 'b');
      expectSwapped(g, 'a', 0, 'Assassin', DECK);
      expectRevealed(g, n, {});
      g = go(g, lose('b', 0));
      // One card gone, still alive, the game is on and the block is still open to them.
      expectRevealed(g, n, { b: 1 });
      expect(g.players.b.eliminatedAt).toBeNull();
      expect(g.status).toBe('playing');
      expect(g.state.phase).toBe('awaitingResponses');
      expect(g.state.pending?.challengeResolved).toBe(true);
      expect(pendingResponders(g)).toEqual(['b']);
      g = go(g, pass('b'));
      expectRevealed(g, n, { b: 2 });
      expect(g.players.b.eliminatedAt).not.toBeNull();
      expect(g.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
      if (n === 2) {
        expectWon(g, 'a');
      } else {
        expectTurn(g, 'c');
      }
    });

    it('target wrongly challenges, then blocks with a real Contessa: only 1 card lost in total', () => {
      let g = assassinate({ b: ['Duke', 'Contessa'] });
      g = go(g, challenge('b'), lose('b', 0));
      expectRevealed(g, n, { b: 1 });
      g = go(g, block('b', 'Contessa'));
      expect(g.state.phase).toBe('awaitingBlockResponses');
      others(n, 'b').forEach(id => {
        g = go(g, pass(id));
      });
      expectRevealed(g, n, { b: 1 });
      expect(g.players.a.coins).toBe(0);
      expect(g.state.lastAction?.blocked).toBe(true);
      expectTurn(g, 'b');
    });

    it('target with one card wrongly challenges: goes out for the challenge and is not hit again', () => {
      const g = assassinate({ b: ['Duke'] });
      const after = go(g, challenge('b'));
      expectRevealed(after, n, { b: 1 });
      expect(after.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
      if (n === 2) {
        expectWon(after, 'a');
      } else {
        expectTurn(after, 'c');
      }
    });

    it.each(n === 2 ? ['a'] : ['a', 'c'])(
      'target bluffs Contessa and is challenged by %s: loses 1 for the bluff and 1 to the assassination',
      who => {
        let g = assassinate({ b: ['Duke', 'Captain'] });
        g = go(g, block('b', 'Contessa'), challenge(who));
        expectAsked(g, 'b');
        expectRevealed(g, n, {});
        g = go(g, lose('b', 1));
        if (n > 2) {
          expectRevealed(g, n, { b: 1 });
          expect(g.players.b.eliminatedAt).toBeNull();
        }
        if (n === 2) {
          // Nobody else is left to answer, so the assassination lands straight away.
          expectRevealed(g, n, { b: 2 });
          expectWon(g, 'a');
          return;
        }
        expect(g.status).toBe('playing');
        expect(g.state.phase).toBe('awaitingResponses');
        const waiting = others(n, 'a').filter(id => id !== 'b');
        expect(pendingResponders(g).sort()).toEqual(waiting.sort());
        waiting.forEach((id, i) => {
          g = go(g, pass(id));
          expectRevealed(g, n, i < waiting.length - 1 ? { b: 1 } : { b: 2 });
        });
        expect(g.players.b.eliminatedAt).not.toBeNull();
        expect(g.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
        expectTurn(g, 'c');
      },
    );

    it('target with one card bluffs Contessa: the bluff takes the last card, the assassination takes nothing more', () => {
      let g = assassinate({ b: ['Duke'] });
      g = go(g, block('b', 'Contessa'), challenge('a'));
      expectRevealed(g, n, { b: 1 });
      if (n === 2) {
        expectWon(g, 'a');
        return;
      }
      others(n, 'a')
        .filter(id => id !== 'b')
        .forEach(id => {
          g = go(g, pass(id));
        });
      expectRevealed(g, n, { b: 1 });
      expect(g.eliminations).toHaveLength(1);
      expectTurn(g, 'c');
    });

    it.each(n === 2 ? ['a'] : ['a', 'c'])(
      'target blocks with a real Contessa and %s challenges: challenger loses 1, target loses none',
      who => {
        const hands: Hands = { b: ['Contessa', 'Duke'] };
        hands[who] = who === 'a' ? ['Assassin', 'Duke'] : ['Captain', 'Duke'];
        let g = assassinate(hands);
        g = go(g, block('b', 'Contessa'), challenge(who));
        expectAsked(g, who);
        expectSwapped(g, 'b', 0, 'Contessa', DECK);
        g = go(g, lose(who, 0));
        expectRevealed(g, n, { [who]: 1 });
        expect(g.state.lastAction?.blocked).toBe(true);
        expectTurn(g, 'b');
      },
    );

    it('assassin with one card who wrongly challenges a real Contessa goes out; target is untouched', () => {
      const g = go(
        table(n, { a: ['Assassin'], b: ['Contessa', 'Duke'] }, { a: 3 }, DECK),
        { type: 'assassinate', playerId: 'a', target: 'b' },
        block('b', 'Contessa'),
        challenge('a'),
      );
      expectRevealed(g, n, { a: 1 });
      if (n === 2) {
        expectWon(g, 'b');
      } else {
        expectTurn(g, 'b');
      }
    });
  });

  describe('3 players: a non-target who challenges both the action and the block', () => {
    // Not an assassination-only path: each claim is separately challengeable, so a player can lose
    // twice by challenging a truthful claim and then a truthful block in the same turn.
    it('loses a card for each failed challenge, and nobody else loses anything', () => {
      let g = table(
        3,
        {
          a: ['Assassin', 'Duke'],
          b: ['Contessa', 'Duke'],
          c: ['Captain', 'Assassin'],
        },
        { a: 3 },
        CONTESSA_DECK,
      );
      g = go(
        g,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        challenge('c'),
        lose('c', 0),
      );
      expectRevealed(g, 3, { c: 1 });
      g = go(g, block('b', 'Contessa'), challenge('c'));
      // c now has a single card, so there is no choice to make.
      expectRevealed(g, 3, { c: 2 });
      expect(g.players.c.eliminatedAt).not.toBeNull();
      expect(g.status).toBe('playing');
      expectTurn(g, 'b');
    });
  });

  it('exhaustively: one turn costs one player two cards only through the rules above', () => {
    type Start = { name: string; game: Game };
    const starts: Start[] = [
      {
        name: '3p all hold two cards',
        game: table(
          3,
          {
            a: ['Assassin', 'Captain'],
            b: ['Contessa', 'Duke'],
            c: ['Ambassador', 'Duke'],
          },
          { a: 7 },
          CONTESSA_DECK,
        ),
      },
      {
        name: '3p bluffer and a one-card target',
        game: table(
          3,
          { a: ['Duke', 'Duke'], b: ['Contessa'], c: ['Captain', 'Assassin'] },
          { a: 7 },
          CONTESSA_DECK,
        ),
      },
      {
        name: '3p one-card actor',
        game: table(
          3,
          { a: ['Assassin'], b: ['Contessa', 'Captain'], c: ['Duke'] },
          { a: 7 },
          CONTESSA_DECK,
        ),
      },
      {
        name: '2p two cards each',
        game: table(
          2,
          { a: ['Assassin', 'Captain'], b: ['Contessa', 'Duke'] },
          { a: 7 },
          CONTESSA_DECK,
        ),
      },
      {
        name: '2p bluffer vs one card',
        game: table(
          2,
          { a: ['Duke', 'Duke'], b: ['Contessa'] },
          { a: 7 },
          CONTESSA_DECK,
        ),
      },
      {
        name: '4p mixed',
        game: table(
          4,
          {
            a: ['Assassin', 'Duke'],
            b: ['Contessa', 'Captain'],
            c: ['Duke'],
            d: ['Ambassador', 'Contessa'],
          },
          { a: 3 },
          CONTESSA_DECK,
        ),
      },
    ];

    let sawTargetDouble = false;
    let sawChallengerDouble = false;
    let terminals = 0;

    starts.forEach(({ name, game: start }) => {
      const startCounts = Object.fromEntries(
        start.playerOrder.map(id => [id, revealedOf(start, id)]),
      );
      const key = (g: Game) =>
        JSON.stringify({ ...g, log: [], reveal: null, revealSeq: 0 });
      const seen = new Set<string>();
      const stack: { game: Game; path: GameAction[] }[] = [
        { game: start, path: [] },
      ];
      while (stack.length > 0) {
        const { game, path } = stack.pop()!;
        const k = key(game);
        if (seen.has(k)) {
          continue;
        }
        seen.add(k);
        invariants(game);
        const ended =
          game.status === 'finished' ||
          game.state.turnNumber !== start.state.turnNumber;
        if (ended) {
          terminals += 1;
          const declared = path[0] as Extract<GameAction, { target?: string }>;
          const target = 'target' in declared ? declared.target : null;
          game.playerOrder.forEach(p => {
            const delta = revealedOf(game, p) - startCounts[p];
            const label = `${name}: ${p} lost ${delta} via ${JSON.stringify(
              path,
            )}`;
            if (delta >= 2) {
              const challenges = path.filter(
                x =>
                  (x.type === 'challenge' || x.type === 'block') &&
                  x.playerId === p,
              ).length;
              const viaTarget = declared.type === 'assassinate' && p === target;
              const viaTwoChallenges =
                p !== declared.playerId && challenges >= 2;
              expect({ label, ok: viaTarget || viaTwoChallenges }).toEqual({
                label,
                ok: true,
              });
              sawTargetDouble = sawTargetDouble || viaTarget;
              sawChallengerDouble = sawChallengerDouble || viaTwoChallenges;
            }
            expect({ label, ok: delta <= 2 }).toEqual({ label, ok: true });
            if (p === declared.playerId) {
              // The actor can lose one card per turn at most: a bluff caught, or a lost challenge of a block.
              expect({ label, ok: delta <= 1 }).toEqual({ label, ok: true });
            }
          });
          continue;
        }
        candidates(game).forEach(candidate => {
          let next: Game;
          try {
            next = applyAction(game, candidate, identityRng);
          } catch (error) {
            if (error instanceof IllegalActionError) {
              return;
            }
            throw error;
          }
          stack.push({ game: next, path: [...path, candidate] });
        });
      }
      expect(seen.size).toBeLessThan(500000);
    });

    expect(terminals).toBeGreaterThan(100);
    expect(sawTargetDouble).toBe(true);
    expect(sawChallengerDouble).toBe(true);
  }, 120000);
});

/** Every action anyone could try in this state; the engine refuses the illegal ones. */
function candidates(g: Game): GameAction[] {
  const out: GameAction[] = [];
  const seq = g.state.claimSeq;
  const keeps = [
    [0],
    [1],
    [2],
    [3],
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ];
  g.playerOrder.forEach(p => {
    (['income', 'foreignAid', 'tax', 'exchange'] as const).forEach(type =>
      out.push({ type, playerId: p }),
    );
    (['coup', 'assassinate', 'steal'] as const).forEach(type =>
      g.playerOrder
        .filter(t => t !== p)
        .forEach(target => out.push({ type, playerId: p, target })),
    );
    out.push({ type: 'pass', playerId: p, seq });
    out.push({ type: 'challenge', playerId: p, seq });
    (
      ['Duke', 'Captain', 'Ambassador', 'Contessa', 'Assassin'] as Card[]
    ).forEach(claim => out.push({ type: 'block', playerId: p, claim, seq }));
    [0, 1].forEach(cardIndex =>
      out.push({ type: 'loseInfluence', playerId: p, cardIndex }),
    );
    keeps.forEach(keep =>
      out.push({ type: 'exchangeChoose', playerId: p, keep }),
    );
  });
  return out;
}

// ===================================== 7. Challenger who is not the target

describe('7. A challenger who is not the target loses, then the action lands on the target', () => {
  describe.each([3, 4])('%i players', n => {
    it('assassination: c loses one card, then b is still asked and loses one', () => {
      let g = table(
        n,
        {
          a: ['Assassin', 'Duke'],
          b: ['Contessa', 'Captain'],
          c: ['Duke', 'Captain'],
        },
        { a: 3 },
        CONTESSA_DECK,
      );
      g = go(
        g,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        challenge('c'),
      );
      expectAsked(g, 'c');
      g = go(g, lose('c', 1));
      expectRevealed(g, n, { c: 1 });
      expect(g.state.phase).toBe('awaitingResponses');
      expect(pendingResponders(g)).toEqual(['b']);
      g = go(g, pass('b'));
      expectAsked(g, 'b');
      expectRevealed(g, n, { c: 1 });
      g = go(g, lose('b', 0));
      expectRevealed(g, n, { b: 1, c: 1 });
      expect(g.status).toBe('playing');
      expectTurn(g, 'b');
    });

    it('assassination: a one-card challenger goes out and the target is still hit once', () => {
      let g = table(
        n,
        { a: ['Assassin', 'Duke'], b: ['Contessa', 'Captain'], c: ['Duke'] },
        { a: 3 },
        CONTESSA_DECK,
      );
      g = go(
        g,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        challenge('c'),
      );
      expectRevealed(g, n, { c: 1 });
      expect(g.status).toBe('playing');
      g = go(g, pass('b'));
      expectAsked(g, 'b');
      g = go(g, lose('b', 1));
      expectRevealed(g, n, { b: 1, c: 1 });
      expect(g.status).toBe('playing');
      expectTurn(g, 'b');
    });

    it('assassination in a 3 player game: both extra players out leaves the assassin the winner', () => {
      if (n !== 3) {
        return;
      }
      let g = table(
        3,
        { a: ['Assassin', 'Duke'], b: ['Contessa'], c: ['Duke'] },
        { a: 3 },
        CONTESSA_DECK,
      );
      g = go(
        g,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        challenge('c'),
      );
      expectRevealed(g, 3, { c: 1 });
      expect(g.status).toBe('playing');
      g = go(g, pass('b'));
      expectRevealed(g, 3, { b: 1, c: 1 });
      expectWon(g, 'a');
    });

    it('steal: b loses one for a failed challenge, then c is robbed', () => {
      let g = table(
        n,
        {
          a: ['Captain', 'Duke'],
          b: ['Contessa', 'Captain'],
          c: ['Duke', 'Assassin'],
        },
        {},
        CONTESSA_DECK.map(card => (card === 'Captain' ? 'Ambassador' : card)),
      );
      g = go(g, { type: 'steal', playerId: 'a', target: 'c' }, challenge('b'));
      expectAsked(g, 'b');
      g = go(g, lose('b', 0));
      expectRevealed(g, n, { b: 1 });
      expect(pendingResponders(g)).toEqual(['c']);
      g = go(g, pass('c'));
      expect([g.players.a.coins, g.players.c.coins]).toEqual([4, 0]);
      expectRevealed(g, n, { b: 1 });
      expectTurn(g, 'b');
    });

    it('steal: the target blocks after someone else lost a challenge, and nobody else loses anything', () => {
      let g = table(
        n,
        {
          a: ['Captain', 'Duke'],
          b: ['Contessa', 'Captain'],
          c: ['Duke', 'Assassin'],
        },
        {},
        ['Ambassador', 'Assassin', 'Duke', 'Contessa'],
      );
      g = go(
        g,
        { type: 'steal', playerId: 'a', target: 'c' },
        challenge('b'),
        lose('b', 1),
        block('c', 'Ambassador'),
      );
      others(n, 'c').forEach(id => {
        g = go(g, pass(id));
      });
      expectRevealed(g, n, { b: 1 });
      expect([g.players.a.coins, g.players.c.coins]).toEqual([2, 2]);
      expectTurn(g, 'b');
    });
  });
});

// ============================================================== 8. Turn order

describe('8. Who loses, and where the turn goes', () => {
  describe.each(COUNTS)('%i players', n => {
    it('the current player loses a card (bluff caught): the turn passes on to the next player', () => {
      let g = table(n, { a: ['Contessa', 'Captain'] });
      g = go(g, { type: 'tax', playerId: 'a' }, challenge('b'), lose('a', 0));
      expectRevealed(g, n, { a: 1 });
      expectTurn(g, 'b');
      expect(g.state.turnNumber).toBe(2);
    });

    it('someone else loses a card (coup): the turn still goes to the player after the actor', () => {
      let g = table(
        n,
        {
          a: ['Duke', 'Duke'],
          b: ['Captain', 'Captain'],
          c: ['Duke', 'Captain'],
        },
        { a: 7 },
      );
      const target = n === 2 ? 'b' : 'c';
      g = go(g, { type: 'coup', playerId: 'a', target }, lose(target, 0));
      expectRevealed(g, n, { [target]: 1 });
      expectTurn(g, 'b');
    });
  });

  it('4 players: an eliminated player is skipped in every round', () => {
    let g = table(
      4,
      {
        a: ['Duke', 'Duke'],
        b: ['Captain', 'Captain'],
        c: ['Contessa'],
        d: ['Duke', 'Captain'],
      },
      { a: 7 },
    );
    g = go(g, { type: 'coup', playerId: 'a', target: 'c' });
    expectRevealed(g, 4, { c: 1 });
    expectTurn(g, 'b');
    const income = (id: string): LooseAction => ({
      type: 'income',
      playerId: id,
    });
    g = go(g, income('b'));
    expectTurn(g, 'd'); // c is skipped
    g = go(g, income('d'));
    expectTurn(g, 'a');
    g = go(g, income('a'));
    expectTurn(g, 'b');
    g = go(g, income('b'));
    expectTurn(g, 'd');
    expect(g.status).toBe('playing');
  });

  it('4 players: the actor who goes out on their own bluff is skipped from then on', () => {
    let g = table(4, { a: ['Contessa'] });
    g = go(g, { type: 'tax', playerId: 'a' }, challenge('c'));
    expectRevealed(g, 4, { a: 1 });
    expect(g.eliminations).toEqual([{ playerId: 'a', by: 'c', turn: 1 }]);
    expectTurn(g, 'b');
    const income = (id: string): LooseAction => ({
      type: 'income',
      playerId: id,
    });
    g = go(g, income('b'));
    expectTurn(g, 'c');
    g = go(g, income('c'));
    expectTurn(g, 'd');
    g = go(g, income('d'));
    expectTurn(g, 'b'); // a is skipped
    expect(g.status).toBe('playing');
  });

  it('3 players: a player who is out is never asked to respond', () => {
    let g = table(3, { a: ['Duke', 'Duke'], b: ['Contessa'] }, { a: 7 });
    g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
    expectTurn(g, 'c');
    g = go(g, { type: 'tax', playerId: 'c' });
    expect(pendingResponders(g)).toEqual(['a']);
    expect(() => play(g, pass('b'))).toThrow(IllegalActionError);
    g = go(g, pass('a'));
    expectRevealed(g, 3, { b: 1 });
    expectTurn(g, 'a');
  });
});

// ============================================== 9. Eliminations and game end

describe('9. The game goes on until one player is left', () => {
  const income = (id: string): LooseAction => ({
    type: 'income',
    playerId: id,
  });

  it('3 players: one elimination leaves two players and a running game; the next ends it', () => {
    let g = table(
      3,
      { a: ['Duke', 'Duke'], b: ['Captain'], c: ['Contessa'] },
      { a: 14 },
    );
    g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
    expectRevealed(g, 3, { b: 1 });
    expect(g.status).toBe('playing');
    expect(g.winner).toBeNull();
    expect(g.scores).toEqual({});
    expectTurn(g, 'c');
    g = go(g, income('c'));
    expectTurn(g, 'a'); // b skipped
    g = go(g, { type: 'coup', playerId: 'a', target: 'c' });
    expectRevealed(g, 3, { b: 1, c: 1 });
    expectWon(g, 'a');
    expect(g.scores).toEqual({ a: 1 });
    expect(g.eliminations.map(e => e.playerId)).toEqual(['b', 'c']);
  });

  it('4 players: three eliminations one by one, the game only finishes at the last', () => {
    let g = table(
      4,
      { a: ['Duke', 'Duke'], b: ['Captain'], c: ['Contessa'], d: ['Assassin'] },
      { a: 21 },
    );
    g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
    expect(g.status).toBe('playing');
    g = go(g, income('c'), income('d'));
    g = go(g, { type: 'coup', playerId: 'a', target: 'c' });
    expect(g.status).toBe('playing');
    expectTurn(g, 'd');
    g = go(g, income('d'));
    expectTurn(g, 'a');
    g = go(g, { type: 'coup', playerId: 'a', target: 'd' });
    expectWon(g, 'a');
    expectRevealed(g, 4, { b: 1, c: 1, d: 1 });
  });

  it('3 players: a player eliminated by a failed challenge does not end the game while two remain', () => {
    let g = table(3, {
      a: ['Duke', 'Contessa'],
      b: ['Captain', 'Assassin'],
      c: ['Ambassador'],
    });
    g = go(g, { type: 'tax', playerId: 'a' }, challenge('c'));
    expectRevealed(g, 3, { c: 1 });
    expect(g.status).toBe('playing');
    expect(g.players.a.coins).toBe(5); // the tax still went through
    expectTurn(g, 'b');
  });

  it('3 players: the last two players, each down to one card, end the game on the next loss only', () => {
    let g = table(
      3,
      { a: ['Duke', 'Captain'], b: ['Captain', 'Assassin'], c: ['Contessa'] },
      { a: 7 },
    );
    g = go(g, { type: 'coup', playerId: 'a', target: 'c' });
    expect(g.status).toBe('playing');
    expectTurn(g, 'b');
    g = go(g, income('b'), income('a'));
    expectTurn(g, 'b');
    expectRevealed(g, 3, { c: 1 });
    expect(g.status).toBe('playing');
  });
});

// ============================================================ 10. Round trip

describe('10. Firebase round trip', () => {
  it('the helper really drops nulls, empty arrays and empty objects', () => {
    const g = table(3, { a: ['Duke', 'Captain'], b: ['Contessa'] });
    const raw = JSON.stringify(strip(g, false));
    expect(raw).not.toMatch(/null|\[\]|\{\}/);
    expect(raw).toContain('"revealed":false');
  });

  it.each([false, true])(
    'mid-choice game keeps the question, the phase and every flag (dense=%s)',
    dense => {
      const g = go(
        table(
          3,
          { a: ['Duke', 'Captain'], b: ['Assassin', 'Contessa'] },
          { a: 7 },
        ),
        { type: 'coup', playerId: 'a', target: 'b' },
      );
      const back = viaFirebase(g, dense);
      expect(back).toEqual(g);
      expect(back.state.phase).toBe('loseInfluence');
      expect(back.state.pending?.loseInfluence).toEqual({
        playerId: 'b',
        next: 'endTurn',
      });
      expect(back.state.pending?.responses).toEqual({});
      expect(back.state.pending?.block).toBeNull();
      expect(back.state.pending?.exchangeOptions).toBeNull();
      expect(back.players.b.influence.map(i => i.revealed)).toEqual([
        false,
        false,
      ]);
      // Finishing the choice on the restored copy gives the same game as on the original.
      expect(play(back, lose('b', 1))).toEqual(play(g, lose('b', 1)));
    },
  );

  it('revealed flags and elimination survive, down to a finished game with a winner', () => {
    let g = table(
      3,
      { a: ['Duke', 'Captain'], b: ['Contessa'], c: ['Duke'] },
      { a: 14 },
    );
    g = go(g, { type: 'coup', playerId: 'a', target: 'b' });
    let back = viaFirebase(g);
    expect(back.players.b.influence).toEqual([
      { card: 'Contessa', revealed: true },
    ]);
    expect(back.players.b.eliminatedAt).toBe(1);
    expect(back.status).toBe('playing');
    expect(back.eliminations).toEqual([{ playerId: 'b', by: 'a', turn: 1 }]);
    g = go(
      g,
      { type: 'income', playerId: 'c' },
      { type: 'coup', playerId: 'a', target: 'c' },
    );
    back = viaFirebase(g);
    expect(back).toEqual(g);
    expect(back.status).toBe('finished');
    expect(back.winner).toBe('a');
    expect(back.scores).toEqual({ a: 1 });
    expect(back.players.c.influence.every(i => i.revealed)).toBe(true);
  });

  it('a pending challenge with no responses yet and an empty deck comes back whole', () => {
    const g = go(
      table(2, { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] }, {}, []),
      { type: 'tax', playerId: 'a' },
    );
    expect(g.deck).toEqual([]);
    const back = viaFirebase(g);
    expect(back).toEqual(g);
    expect(back.deck).toEqual([]);
    expect(back.state.pending?.responses).toEqual({});
    expect(back.log.length).toBeGreaterThan(0);
  });

  it('the double-loss path survives the round trip at every step (after the first loss the target is alive with one card)', () => {
    let g = table(
      3,
      {
        a: ['Assassin', 'Duke'],
        b: ['Duke', 'Captain'],
        c: ['Duke', 'Captain'],
      },
      { a: 3 },
      CONTESSA_DECK,
    );
    g = go(
      g,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      challenge('b'),
      lose('b', 0),
    );
    const mid = viaFirebase(g);
    expect(mid).toEqual(g);
    expect(mid.players.b.influence.map(i => i.revealed)).toEqual([true, false]);
    expect(mid.players.b.eliminatedAt).toBeNull();
    expect(mid.status).toBe('playing');
    expect(mid.state.pending?.challengeResolved).toBe(true);
    expect(mid.state.pending?.loseInfluence).toBeNull();
    const done = play(mid, pass('b'));
    expect(done).toEqual(play(g, pass('b')));
    expect(done.players.b.influence.every(i => i.revealed)).toBe(true);
    expect(done.status).toBe('playing');
  });

  it('a challenged block mid-flight keeps the block, its claim and who may still respond', () => {
    const g = go(
      table(3, { a: ['Duke', 'Duke'], b: ['Duke', 'Contessa'] }),
      { type: 'foreignAid', playerId: 'a' },
      block('b', 'Duke'),
      pass('c'),
    );
    const back = viaFirebase(g);
    expect(back).toEqual(g);
    expect(back.state.pending?.block).toEqual({
      blocker: 'b',
      claim: 'Duke',
      responses: { c: 'pass' },
    });
    expect(pendingResponders(back)).toEqual(['a']);
  });

  it('repair on read puts back everything the database drops, from a hand-written raw snapshot', () => {
    // What the database holds for a mid-choice game: no nulls, no empty containers, arrays as keyed objects.
    const raw = {
      host: 'a',
      code: 'TEST1',
      status: 'playing',
      playerOrder: { 0: 'a', 1: 'b', 2: 'c' },
      players: {
        a: {
          name: 'A',
          coins: 0,
          influence: {
            0: { card: 'Duke', revealed: false },
            1: { card: 'Captain', revealed: false },
          },
        },
        b: {
          name: 'B',
          coins: 2,
          influence: {
            0: { card: 'Assassin', revealed: false },
            1: { card: 'Contessa', revealed: true },
          },
        },
        c: {
          name: 'C',
          coins: 2,
          influence: { 0: { card: 'Duke', revealed: true } },
          eliminatedAt: 3,
        },
      },
      deck: { 0: 'Duke' },
      state: {
        phase: 'loseInfluence',
        currentTurnPlayer: 'a',
        turnNumber: 4,
        claimSeq: 2,
        pending: {
          actor: 'a',
          action: 'coup',
          target: 'b',
          loseInfluence: { playerId: 'b', next: 'endTurn' },
        },
        lastAction: { playerId: 'a', action: 'coup', target: 'b' },
      },
      round: 1,
      createdAt: 1,
    };
    const game = normalizeGame(raw);
    expect(game.state.phase).toBe('loseInfluence');
    expect(game.state.pending?.loseInfluence).toEqual({
      playerId: 'b',
      next: 'endTurn',
    });
    expect(game.state.pending?.responses).toEqual({});
    expect(game.state.pending?.block).toBeNull();
    expect(game.state.pending?.claim).toBeNull();
    expect(game.state.pending?.challengeResolved).toBe(false);
    expect(game.players.b.influence.map(i => i.revealed)).toEqual([
      false,
      true,
    ]);
    expect(game.players.c.eliminatedAt).toBe(3);
    expect(game.players.a.eliminatedAt).toBeNull();
    expect(game.winner).toBeNull();
    expect(game.log).toEqual([]);
    expect(game.eliminations).toEqual([]);
    expect(game.scores).toEqual({});
    expect(game.state.lastAction?.blocked).toBe(false);
    // The engine accepts it and the choice reveals exactly the chosen card.
    const next = applyAction(game, lose('b', 0) as GameAction, identityRng);
    expect(next.players.b.influence.map(i => i.revealed)).toEqual([true, true]);
    expect(next.players.b.eliminatedAt).toBe(4);
    // b and c are both out, so a is the last one standing.
    expect(next.status).toBe('finished');
    expect(next.winner).toBe('a');
  });
});
