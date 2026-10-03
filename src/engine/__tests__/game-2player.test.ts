import { addPlayer, newGame, startGame } from '../lobby';
import {
  availableActions,
  FORCED_COUP_COINS,
  livingPlayers,
  pendingResponders,
  responseOptions,
} from '../rules';
import { CAUTIOUS, RECKLESS, simulateGame, Temperament } from '../simulation';
import { identityRng, LooseAction, makeGame, play } from '../testHelpers';
import { Game } from '../types';

/** Asserts the action is rejected with `message` and that the game is left exactly as it was. */
function expectRejected(game: Game, action: LooseAction, message: string) {
  const before = JSON.stringify(game);
  expect(() => play(game, action)).toThrow(message);
  expect(JSON.stringify(game)).toBe(before);
}

function hiddenCards(game: Game, playerId: string): string[] {
  return game.players[playerId].influence
    .filter(i => !i.revealed)
    .map(i => i.card);
}

describe('2-Player Game Scenarios', () => {
  test('Full game: income, foreign aid, character abilities', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { deck: ['Ambassador', 'Assassin', 'Captain'] },
    );
    expect(start.players.a.coins).toBe(2);
    expect(start.players.b.coins).toBe(2);

    // Turn 1: A takes income. Nobody can respond to income.
    const afterIncome = play(start, { type: 'income', playerId: 'a' });
    expect(afterIncome.players.a.coins).toBe(3);
    expect(afterIncome.state.currentTurnPlayer).toBe('b');
    expect(afterIncome.state.turnNumber).toBe(2);

    // Turn 2: B takes foreign aid; it only resolves once A has passed.
    const aidDeclared = play(afterIncome, {
      type: 'foreignAid',
      playerId: 'b',
    });
    expect(aidDeclared.state.phase).toBe('awaitingResponses');
    expect(pendingResponders(aidDeclared)).toEqual(['a']);
    expect(aidDeclared.players.b.coins).toBe(2);

    const afterAid = play(aidDeclared, { type: 'pass', playerId: 'a' });
    expect(afterAid.players.b.coins).toBe(4);
    expect(afterAid.state.currentTurnPlayer).toBe('a');
    expect(afterAid.state.turnNumber).toBe(3);

    // Turn 3: A claims Duke for tax and B challenges. A really holds a Duke.
    const challenged = play(
      afterAid,
      { type: 'tax', playerId: 'a' },
      { type: 'challenge', playerId: 'b' },
    );
    // The proven Duke goes back into the deck and A draws a replacement.
    expect(challenged.players.a.influence).toEqual([
      { card: 'Ambassador', revealed: false },
      { card: 'Captain', revealed: false },
    ]);
    expect(challenged.deck).toEqual(['Assassin', 'Captain', 'Duke']);
    // B was wrong and still has two cards, so B must choose one to lose.
    expect(challenged.state.phase).toBe('loseInfluence');
    expect(challenged.state.pending?.loseInfluence?.playerId).toBe('b');
    expect(challenged.players.a.coins).toBe(3);

    const end = play(challenged, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 1,
    });
    expect(end.players.b.influence).toEqual([
      { card: 'Contessa', revealed: false },
      { card: 'Assassin', revealed: true },
    ]);
    // The tax still happens after the failed challenge.
    expect(end.players.a.coins).toBe(6);
    expect(end.players.b.coins).toBe(4);
    expect(end.players.b.eliminatedAt).toBeNull();
    expect(end.status).toBe('playing');
    expect(end.state.phase).toBe('action');
    expect(end.state.pending).toBeNull();
    expect(end.state.currentTurnPlayer).toBe('b');
    expect(end.state.turnNumber).toBe(4);
    expect(end.state.lastAction).toEqual({
      playerId: 'a',
      action: 'tax',
      target: null,
      blocked: false,
    });
  });

  describe('Challenge + block + challenge-block cycle', () => {
    test('a bluffed Contessa costs the target both cards and the game', () => {
      const start = makeGame(
        { a: ['Assassin', 'Duke'], b: ['Duke', 'Captain'] },
        { coins: { a: 3 } },
      );

      const declared = play(start, {
        type: 'assassinate',
        playerId: 'a',
        target: 'b',
      });
      expect(declared.players.a.coins).toBe(0);
      expect(declared.state.phase).toBe('awaitingResponses');
      expect(responseOptions(declared, 'b')).toEqual({
        canChallenge: true,
        blockClaims: ['Contessa'],
      });

      const blocked = play(declared, {
        type: 'block',
        playerId: 'b',
        claim: 'Contessa',
      });
      expect(blocked.state.phase).toBe('awaitingBlockResponses');
      expect(blocked.state.pending?.block).toEqual({
        blocker: 'b',
        claim: 'Contessa',
        responses: {},
      });
      expect(pendingResponders(blocked)).toEqual(['a']);

      // A challenges the block. B has no Contessa, so B must lose a card for the bluff...
      const challenged = play(blocked, { type: 'challenge', playerId: 'a' });
      expect(challenged.state.phase).toBe('loseInfluence');
      expect(challenged.state.pending?.loseInfluence?.playerId).toBe('b');
      expect(challenged.state.pending?.block).toBeNull();

      // ...and then the assassination goes through and takes B's last card.
      const end = play(challenged, {
        type: 'loseInfluence',
        playerId: 'b',
        cardIndex: 0,
      });
      expect(end.players.b.influence.every(i => i.revealed)).toBe(true);
      expect(end.players.b.eliminatedAt).toBe(1);
      expect(end.players.a.coins).toBe(0);
      expect(end.state.lastAction?.blocked).toBe(false);
      expect(end.status).toBe('finished');
      expect(end.winner).toBe('a');
    });

    test('a real Contessa survives the challenge and costs the challenger a card', () => {
      const start = makeGame(
        { a: ['Assassin', 'Duke'], b: ['Contessa', 'Captain'] },
        { coins: { a: 3 }, deck: ['Ambassador', 'Duke', 'Captain'] },
      );

      const challenged = play(
        start,
        { type: 'assassinate', playerId: 'a', target: 'b' },
        { type: 'block', playerId: 'b', claim: 'Contessa' },
        { type: 'challenge', playerId: 'a' },
      );
      // B showed the Contessa and swapped it for a new card.
      expect(challenged.players.b.influence[0]).toEqual({
        card: 'Ambassador',
        revealed: false,
      });
      expect(challenged.state.pending?.loseInfluence).toEqual({
        playerId: 'a',
        next: 'endTurn',
      });

      const end = play(challenged, {
        type: 'loseInfluence',
        playerId: 'a',
        cardIndex: 1,
      });
      expect(hiddenCards(end, 'a')).toEqual(['Assassin']);
      expect(hiddenCards(end, 'b')).toHaveLength(2);
      // The 3 coins stay spent: the assassination was blocked, not exposed.
      expect(end.players.a.coins).toBe(0);
      expect(end.state.lastAction?.blocked).toBe(true);
      expect(end.status).toBe('playing');
      expect(end.state.currentTurnPlayer).toBe('b');
    });
  });

  test('Forced Coup at 10+ coins', () => {
    const start = makeGame({
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
    });

    // A taxes three times (2 -> 5 -> 8 -> 11); B takes income in between.
    const round: LooseAction[] = [
      { type: 'tax', playerId: 'a' },
      { type: 'pass', playerId: 'b' },
      { type: 'income', playerId: 'b' },
    ];
    const afterTwoRounds = play(start, ...round, ...round);
    expect(afterTwoRounds.players.a.coins).toBe(8);
    // At 8 coins a coup is possible but not required.
    expect(availableActions(afterTwoRounds, 'a')).toEqual(
      expect.arrayContaining(['income', 'tax', 'coup']),
    );

    const rich = play(afterTwoRounds, ...round);
    expect(rich.players.a.coins).toBe(11);
    expect(rich.players.b.coins).toBe(5);
    expect(rich.state.currentTurnPlayer).toBe('a');

    // At 10 or more, coup is the only action offered and the only one accepted.
    expect(rich.players.a.coins).toBeGreaterThanOrEqual(FORCED_COUP_COINS);
    expect(availableActions(rich, 'a')).toEqual(['coup']);
    const forbidden: LooseAction[] = [
      { type: 'income', playerId: 'a' },
      { type: 'foreignAid', playerId: 'a' },
      { type: 'tax', playerId: 'a' },
      { type: 'exchange', playerId: 'a' },
      { type: 'steal', playerId: 'a', target: 'b' },
      { type: 'assassinate', playerId: 'a', target: 'b' },
    ];
    forbidden.forEach(action =>
      expectRejected(rich, action, 'You must Coup with 10 or more coins'),
    );

    const couped = play(rich, { type: 'coup', playerId: 'a', target: 'b' });
    expect(couped.players.a.coins).toBe(4);
    // A coup cannot be challenged or blocked: it goes straight to the target choosing a card.
    expect(couped.state.phase).toBe('loseInfluence');
    expect(pendingResponders(couped)).toEqual([]);

    const end = play(couped, {
      type: 'loseInfluence',
      playerId: 'b',
      cardIndex: 0,
    });
    expect(hiddenCards(end, 'b')).toEqual(['Assassin']);
    expect(end.status).toBe('playing');
    expect(end.state.currentTurnPlayer).toBe('b');
  });

  test('Elimination and win condition', () => {
    const start = makeGame(
      { a: ['Duke', 'Captain'], b: ['Contessa', 'Assassin'] },
      { coins: { a: 14 } },
    );

    const firstLoss = play(
      start,
      { type: 'coup', playerId: 'a', target: 'b' },
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
    );
    expect(hiddenCards(firstLoss, 'b')).toHaveLength(1);
    expect(firstLoss.players.b.eliminatedAt).toBeNull();
    expect(firstLoss.status).toBe('playing');
    expect(firstLoss.winner).toBeNull();

    // B's last card is revealed automatically: there is nothing left to choose.
    const end = play(
      firstLoss,
      { type: 'income', playerId: 'b' },
      { type: 'coup', playerId: 'a', target: 'b' },
    );
    expect(end.players.b.influence).toEqual([
      { card: 'Contessa', revealed: true },
      { card: 'Assassin', revealed: true },
    ]);
    expect(end.players.b.eliminatedAt).toBe(3);
    expect(end.players.a.eliminatedAt).toBeNull();
    expect(livingPlayers(end)).toEqual(['a']);
    expect(end.status).toBe('finished');
    expect(end.state.phase).toBe('finished');
    expect(end.state.pending).toBeNull();
    expect(end.winner).toBe('a');
    expect(end.log[end.log.length - 1]).toBe('A wins');

    // Nothing more can happen in a finished game.
    expect(availableActions(end, 'a')).toEqual([]);
    expect(availableActions(end, 'b')).toEqual([]);
    expectRejected(
      end,
      { type: 'income', playerId: 'a' },
      'Game is not in progress',
    );
  });

  test('Illegal actions rejected', () => {
    const start = makeGame({
      a: ['Duke', 'Captain'],
      b: ['Contessa', 'Assassin'],
    });

    // Not enough coins.
    expectRejected(
      start,
      { type: 'coup', playerId: 'a', target: 'b' },
      'Not enough coins',
    );
    expectRejected(
      start,
      { type: 'assassinate', playerId: 'a', target: 'b' },
      'Not enough coins',
    );

    // Wrong player.
    expectRejected(
      start,
      { type: 'income', playerId: 'b' },
      'It is not your turn',
    );
    expectRejected(
      start,
      { type: 'tax', playerId: 'b' },
      'It is not your turn',
    );
    expectRejected(
      start,
      { type: 'income', playerId: 'stranger' },
      'You are not in this game',
    );

    // Bad target.
    expectRejected(
      start,
      { type: 'steal', playerId: 'a', target: 'a' },
      'Choose a living opponent',
    );
    expectRejected(
      start,
      { type: 'steal', playerId: 'a', target: 'stranger' },
      'Choose a living opponent',
    );

    // Responses when nothing is waiting for one.
    expectRejected(
      start,
      { type: 'pass', playerId: 'b' },
      'You have nothing to respond to',
    );
    expectRejected(
      start,
      { type: 'challenge', playerId: 'b' },
      'You cannot challenge now',
    );
    expectRejected(
      start,
      { type: 'block', playerId: 'b', claim: 'Duke' },
      'You cannot block now',
    );
    expectRejected(
      start,
      { type: 'loseInfluence', playerId: 'b', cardIndex: 0 },
      'You do not need to lose a card',
    );
    expectRejected(
      start,
      { type: 'exchangeChoose', playerId: 'a', keep: [0, 1] },
      'You are not exchanging cards',
    );

    // While a claim is waiting for a response, nobody may start another action.
    const waiting = play(start, { type: 'tax', playerId: 'a' });
    expectRejected(
      waiting,
      { type: 'income', playerId: 'a' },
      'It is not your turn',
    );
    expectRejected(
      waiting,
      { type: 'income', playerId: 'b' },
      'It is not your turn',
    );
    expectRejected(
      waiting,
      { type: 'pass', playerId: 'a' },
      'You have nothing to respond to',
    );
    expectRejected(
      waiting,
      { type: 'block', playerId: 'b', claim: 'Duke' },
      'You cannot block now',
    );
    // A response aimed at an earlier prompt.
    expectRejected(
      waiting,
      { type: 'pass', playerId: 'b', seq: waiting.state.claimSeq - 1 },
      'Too late: the game has moved on',
    );
  });

  describe('Full game to completion (50+ actions)', () => {
    /** Plays one seeded 2-player game to the end and returns how many actions it took. */
    function simulate(seed: number, mood: Temperament): number {
      return simulateGame(seed, mood).actions;
    }

    test('a single seeded game is reproducible', () => {
      expect(simulate(7, CAUTIOUS)).toBe(simulate(7, CAUTIOUS));
    });

    // `simulate` throws on the first rule violation, stuck state, rejected legal move or
    // missing winner, so reaching the assertions means every game below was clean.

    test('200 cautious games end with a winner, including long games of 50+ actions', () => {
      const lengths = Array.from({ length: 200 }, (_, index) =>
        simulate(index + 1, CAUTIOUS),
      );
      const total = lengths.reduce((sum, length) => sum + length, 0);
      // Two-player Coup is short: most games finish in under 50 actions, so this checks
      // that the long ones are covered rather than pretending every game is long.
      expect(
        lengths.filter(length => length >= 50).length,
      ).toBeGreaterThanOrEqual(10);
      expect(Math.max(...lengths)).toBeGreaterThanOrEqual(70);
      expect(total).toBeGreaterThan(5000);
    });

    test('200 reckless games with frequent challenges and blocks end with a winner', () => {
      const lengths = Array.from({ length: 200 }, (_, index) =>
        simulate(index + 1001, RECKLESS),
      );
      const total = lengths.reduce((sum, length) => sum + length, 0);
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(4);
      expect(total).toBeGreaterThan(2000);
    });

    test('the identity rng used by scripted tests also completes a game', () => {
      const lobby = addPlayer(newGame('p1', 'One', 'SIMUL', 0), 'p2', 'Two');
      const start = startGame(lobby, 'p1', identityRng);
      const end = play(
        start,
        // p1 holds Duke, Duke; p2 holds Duke, Assassin (unshuffled deck).
        { type: 'tax', playerId: 'p1' },
        { type: 'pass', playerId: 'p2' },
        { type: 'income', playerId: 'p2' },
        { type: 'tax', playerId: 'p1' },
        { type: 'pass', playerId: 'p2' },
        { type: 'income', playerId: 'p2' },
        { type: 'coup', playerId: 'p1', target: 'p2' },
        { type: 'loseInfluence', playerId: 'p2', cardIndex: 0 },
        { type: 'income', playerId: 'p2' },
        { type: 'tax', playerId: 'p1' },
        { type: 'pass', playerId: 'p2' },
        { type: 'income', playerId: 'p2' },
        { type: 'tax', playerId: 'p1' },
        { type: 'pass', playerId: 'p2' },
        { type: 'income', playerId: 'p2' },
        { type: 'coup', playerId: 'p1', target: 'p2' },
      );
      expect(end.status).toBe('finished');
      expect(end.winner).toBe('p1');
    });
  });
});
