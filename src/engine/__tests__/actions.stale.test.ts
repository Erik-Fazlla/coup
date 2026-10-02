import { applyAction } from '../actions';
import { identityRng, makeGame } from '../testHelpers';
import { GameAction } from '../types';

const TOO_LATE = 'Too late: the game has moved on';

const three = () =>
  makeGame({
    a: ['Captain', 'Captain'],
    b: ['Duke', 'Contessa'],
    c: ['Ambassador', 'Assassin'],
  });

const apply = (game: ReturnType<typeof three>, action: GameAction) =>
  applyAction(game, action, identityRng);

/** A steals from B (claim seq 1); B then blocks as Ambassador (claim seq 2). */
const stealThenBlocked = () => {
  const declared = apply(three(), {
    type: 'steal',
    playerId: 'a',
    target: 'b',
  });
  return apply(declared, {
    type: 'block',
    playerId: 'b',
    claim: 'Ambassador',
    seq: 1,
  });
};

describe('stale responses', () => {
  it('rejects a challenge aimed at the action once a block has been declared', () => {
    const blocked = stealThenBlocked();
    expect(blocked.state.phase).toBe('awaitingBlockResponses');

    expect(() =>
      apply(blocked, { type: 'challenge', playerId: 'c', seq: 1 }),
    ).toThrow(TOO_LATE);
    expect(
      Object.values(blocked.players).every(p =>
        p.influence.every(i => !i.revealed),
      ),
    ).toBe(true);
    expect(blocked.state.pending?.loseInfluence).toBeNull();
  });

  it('rejects a pass aimed at the action once a block has been declared, and does not record it', () => {
    const blocked = stealThenBlocked();

    expect(() =>
      apply(blocked, { type: 'pass', playerId: 'c', seq: 1 }),
    ).toThrow(TOO_LATE);
    expect(blocked.state.pending?.block?.responses).toEqual({});
  });

  it('rejects a block that carries an old seq, and does not record it', () => {
    const declared = apply(three(), { type: 'foreignAid', playerId: 'a' });
    const stale = declared.state.claimSeq - 1;

    expect(() =>
      apply(declared, {
        type: 'block',
        playerId: 'b',
        claim: 'Duke',
        seq: stale,
      }),
    ).toThrow(TOO_LATE);
    expect(declared.state.phase).toBe('awaitingResponses');
    expect(declared.state.pending?.block).toBeNull();

    const blocked = apply(declared, {
      type: 'block',
      playerId: 'b',
      claim: 'Duke',
      seq: declared.state.claimSeq,
    });
    expect(blocked.state.pending?.block?.blocker).toBe('b');
  });

  it('rejects a response whose seq is missing', () => {
    const declared = apply(three(), { type: 'foreignAid', playerId: 'a' });
    const missing: GameAction[] = [
      { type: 'pass', playerId: 'b', seq: undefined as any },
      { type: 'challenge', playerId: 'b', seq: undefined as any },
      { type: 'block', playerId: 'b', claim: 'Duke', seq: undefined as any },
    ];
    missing.forEach(action => {
      expect(() => apply(declared, action)).toThrow(TOO_LATE);
    });
    expect(declared.state.pending?.responses).toEqual({});
    expect(declared.state.pending?.block).toBeNull();
  });

  it('accepts a pass that carries the current seq', () => {
    const declared = apply(three(), {
      type: 'steal',
      playerId: 'a',
      target: 'b',
    });
    const passed = apply(declared, {
      type: 'pass',
      playerId: 'c',
      seq: declared.state.claimSeq,
    });
    expect(passed.state.pending?.responses).toEqual({ c: 'pass' });
  });

  it("rejects a pass that carries the previous turn's seq", () => {
    const turn1 = [
      { type: 'tax', playerId: 'a' },
      { type: 'pass', playerId: 'b', seq: 1 },
      { type: 'pass', playerId: 'c', seq: 1 },
    ] as GameAction[];
    const afterTurn1 = turn1.reduce(apply, three());
    expect(afterTurn1.state.currentTurnPlayer).toBe('b');

    const turn2 = apply(afterTurn1, { type: 'tax', playerId: 'b' });
    expect(() => apply(turn2, { type: 'pass', playerId: 'c', seq: 1 })).toThrow(
      TOO_LATE,
    );
    expect(turn2.state.pending?.responses).toEqual({});
  });
});
